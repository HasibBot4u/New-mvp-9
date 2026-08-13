# Telegram Infrastructure — Forensic Recovery & Reconstruction Guide

**Status:** Channels & Bot DELETED externally. Repository evidence remains.

**Date:** 2026-08-09

## 1. What existed (CONFIRMED from repo evidence)

### 1.1 Channel Map (18 channels)
CONFIRMED in `backend/main.py:95-113` and `.env.example` + `backend/.env.example`:

- Physics C1..C6: env `PHY_C1_CHANNEL_ID` .. `PHY_C6_CHANNEL_ID`
- Chemistry C1..C6: `CHE_C1_CHANNEL_ID` .. `CHE_C6_CHANNEL_ID`
- Math C1..C6: `HM_C1_CHANNEL_ID` .. `HM_C6_CHANNEL_ID`

Additionally `THUMBNAIL_CHANNEL_ID` for thumbnails.

Evidence: `CHANNEL_MAP` dict, `bot_manager.py` scans all env vars ending with `_CHANNEL_ID`.

No hardcoded real IDs in repo — only example fake IDs like `-1009999999901` in `.env.example`. Real IDs were in production `.env` on Render dashboard, now lost if Render env cleared.

### 1.2 Bot
- Library: `python-telegram-bot` v21 (from bot_manager.py imports)
- Commands: `/start`, `/help`, `/ping`, `/status`, `/stats`, `/notify`, `/scan`, `/scan_cancel`
- Webhook: `WEBHOOK_URL` env + `/api/bot_webhook` endpoint. `bot_manager.config.WEBHOOK_URL` + `get_webhook_info()`.
- Token: `TELEGRAM_BOT_TOKEN` env, also `ADMIN_CHAT_ID` for alerts.
- Bot username NOT found in repo — would have been in BotFather.

### 1.3 User Account (Pyrogram) for storage
- Library: Pyrogram 2.0.106 + tgcrypto
- Session strings: `PYROGRAM_SESSION_STRING`, `PYROGRAM_SESSION_STRING_2` (two sessions for load balancing)
- API ID/Hash: `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` from my.telegram.org
- The user account is the actual CDN: it is added as admin to all 18 channels, uploads videos as **files** (not compressed video) to preserve quality.

### 1.4 Message format
- videos.telegram_channel_id = string "-100...."
- videos.telegram_message_id = int
- videos.thumbnail_telegram_message_id = bigint (optional, dedicated thumb channel)
- videos.file_size_bytes, mime_type cached after first fetch.

### 1.5 Automation
- `TelegramUploadService` (`backend/services/telegram_upload_service.py`): listens on_message filters.video|document, if chat_id in channel list, queues to `upload_queue` table (pending). That was for auto-ingesting if someone uploads directly to channel.
- `UploadWorker` (`backend/workers/upload_worker.py`): polls `upload_queue` status=pending limit 1 every 10s, downloads via `app.download_media(file_id)`, checks disk space, extracts metadata, optionally creates variants (360p etc) and uploads back, watermark (service exists but not wired), inserts to video_variants.
- `bot_manager.cmd_scan`: iterates env `_CHANNEL_ID`, calls `client.get_chat_history(cid, limit=100)` counts videos/documents, reports per channel.
- Catalog builder resolves channels via `resolve_channel()` calling `client.get_chat(cid)` — does dialog preload via `get_dialogs(limit=100)` to auto-discover.

### 1.6 Database Relations
- `cycles.telegram_channel_id` text (cycle level channel pointer)
- `videos` stores telegram pointers.
- `upload_queue` stores telegram_file_id, channel_id, message_id.
- `video_variants` stores variant file_ids.

## 2. What was deleted

- 18 Telegram channels (private channels) — IDs lost unless Render env backup exists.
- 1 Telegram bot — token deleted, username unknown.
- All message history in those channels (video files) — permanently lost unless you have local backup or Pyrogram session still can access? If channels deleted, messages gone even if session still valid, Telegram server deletes.
- Thumbnails channel.

INFERRED: No backup found in repo, no SQL dump, no JSON fixtures.

## 3. What can be recovered from repository

**Recoverable:**
- Channel role naming convention (physics-c1.. etc)
- Code logic for handling channel IDs
- Bot command implementations
- Workflow for uploading: upload as file to channel, get file_id, message_id via helper bot, insert into admin dashboard.
- Env variable names list
- Migration schema for tables

**Reconstructable:**
- New channels can be created with same purpose, new IDs.
- New bot can be created via @BotFather, new token.
- New session strings can be generated via Pyrogram login script (`scripts/get_channel_id.py` maybe? Check file).

**Requires new resources:**
- 18 new Telegram channels (private)
- 1 new bot
- New API ID/Hash if old compromised
- New session string (requires phone number OTP)

**Permanently lost:**
- Original channel IDs (unless you have Render dashboard env export or old .env file)
- Original video files (if not backed up)
- Original message IDs
- Thumbnail message IDs
- Historical file_size_bytes if not in DB backup (but DB still has videos rows if Supabase not wiped, but file pointers invalid now)

**Unknown:**
- Whether Supabase still has videos rows with old channel/message IDs — check Supabase dashboard. If DB intact, rows exist but point to deleted messages → streaming will 404.
- Bot username, channel usernames (if any) — private channels have no username.

## 4. Recreation Steps

### 4.1 Prepare Telegram Account

1. Need a Telegram user account (personal or dedicated) that will own channels. This account's phone number required for Pyrogram session.
2. Go to https://my.telegram.org → API development tools → create app → get `TELEGRAM_API_ID` (int) and `TELEGRAM_API_HASH` (hex).
3. Save securely.

### 4.2 Generate Pyrogram Session

Use script `scripts/get_channel_id.py` or create new:

```python
from pyrogram import Client
api_id = int(input("API ID: "))
api_hash = input("API HASH: ")
app = Client("my_account", api_id=api_id, api_hash=api_hash)
app.start()
print("Session string:")
print(app.export_session_string())
app.stop()
```

Run locally `python gen.py`, enter phone + OTP + 2FA password. Copy session string to `PYROGRAM_SESSION_STRING`. For second session, repeat with different name or same account second instance.

### 4.3 Create Bot via @BotFather

1. In Telegram, chat @BotFather → `/newbot` → choose name `NexusEduManagerBot` maybe, username must be unique like `NxsEduBot` → get token `123456:AAF...`.
2. Set env `TELEGRAM_BOT_TOKEN`.
3. Optionally set webhook later via API, but our backend sets webhook automatically if `WEBHOOK_URL` configured.
4. Get admin chat ID: chat @userinfobot → get your user ID → set `ADMIN_CHAT_ID`.

### 4.4 Create 18 Channels + Thumbnail Channel

1. In Telegram client (same user account that will be Pyrogram), create 19 private channels:
   - physics-c1 .. physics-c6
   - chemistry-c1 .. chemistry-c6
   - math-c1 .. math-c6
   - thumbnails (single channel for all thumbs)

2. For each channel:
   - Create as private channel (not public)
   - Add your bot as admin with post messages permission.
   - Add your user account as admin.

3. To get channel IDs:
   - Option A: Use helper bot `scripts/get_channel_id.py` — look at file content. Run it with bot token, forward a message from channel to bot, it replies with ID.
   - Option B: Use Pyrogram:
     ```python
     from pyrogram import Client
     app = Client("my_account", api_id=..., api_hash=..., session_string=SESSION_STRING)
     app.start()
     for dialog in app.get_dialogs():
         print(dialog.chat.title, dialog.chat.id)
     app.stop()
     ```
   - Channel IDs start with `-100` and are 13-14 digits.

4. Set env vars:
```
PHY_C1_CHANNEL_ID=-100xxxx1
...
HM_C6_CHANNEL_ID=-100xxxx18
THUMBNAIL_CHANNEL_ID=-100yyyy
```

### 4.5 Configure Backend

- Update `.env` and Render dashboard env vars with new IDs, tokens, session strings.
- Set `WEBHOOK_URL=https://your-backend.onrender.com/api/bot_webhook`
- Set `TELEGRAM_WEBHOOK_SECRET` to a random 32+ char string, e.g., `openssl rand -hex 32`. Also set same secret when bot sets webhook: need to modify bot_manager to pass secret_token.

Currently bot_manager sets webhook without secret. Update `backend/bot_manager.py:_set_webhook` to include `secret_token=WEBHOOK_SECRET` parameter.

In code:

```python
await self.application.bot.set_webhook(
    url=webhook_path,
    secret_token=os.getenv("TELEGRAM_WEBHOOK_SECRET")
)
```

- Also set `ALLOWED_ORIGINS` to include frontend URL.

### 4.6 Re-upload Videos

Since old channels deleted, video files lost. You must re-upload all videos:

1. For each video file (source mp4), upload to appropriate channel as **file** (Telegram client: send as file, not compressed video). This preserves quality and filename.
2. Helper bot (or Pyrogram session) captures message_id, file_id, file_name, size.
3. In admin dashboard `/admin/content`, edit video entry: set `telegram_channel_id` = channel ID string, `telegram_message_id` = int, `thumbnail_telegram_message_id` optional.
4. Alternatively, use `upload_queue` flow: upload to channel, `TelegramUploadService` will auto-queue, worker will download and process? But current worker expects to process from telegram_file_id; you still need to manually link to catalog video.

Simpler: Bulk upload via script that after upload, inserts into Supabase `videos` table directly using service key.

### 4.7 Test

- Call `/api/channels/health` with admin JWT to verify each channel reachable.
- Call `/api/catalog` to see videos.
- Try streaming one video via `/api/stream/{id}` with auth.
- Test bot: send `/ping` to bot, should reply Pong.
- Test `/scan` command in Telegram to bot admin, should count videos.

## 5. Recommended Improvements During Recreation

- Use single channel per subject instead of 6 per subject? Original 18 channels maybe for Telegram 2GB/file limit workaround per channel? But 6 per subject seems excessive. Consider consolidating to 3 channels (physics, chemistry, math) + thumbnails.
- Implement encryption: before upload, encrypt chunk with per-video key, store key in DB, decrypt on stream — prevents Telegram account compromise leaking videos.
- Use channel usernames? Private better for security.
- Backup channel IDs and message IDs to JSON file in private repo or encrypted storage.
- Create documentation file `TELEGRAM_CHANNELS.md` (private, not committed) with mapping of channel purpose to ID and title.

## 6. Environment Variables Required for Telegram

| Var | Purpose | Required | Example |
|-----|---------|----------|---------|
| TELEGRAM_API_ID | my.telegram.org app ID | Yes | 12345678 |
| TELEGRAM_API_HASH | my.telegram.org hash | Yes | abcdef... |
| PYROGRAM_SESSION_STRING | User account session | Yes | AgA... |
| PYROGRAM_SESSION_STRING_2 | Secondary (optional) | No | AgB... |
| TELEGRAM_BOT_TOKEN | BotFather token | Yes | 123:AAF... |
| ADMIN_CHAT_ID | Your user ID for alerts | Yes | 123456789 |
| THUMBNAIL_CHANNEL_ID | Thumbs channel -100... | Yes | -100123... |
| PHY_C1_CHANNEL_ID ... HM_C6_CHANNEL_ID | 18 channels -100... | Yes if using old mapping, else at least 3 | -100... |
| WEBHOOK_URL | Backend public URL + /api/bot_webhook | Yes | https://...onrender.com/api/bot_webhook |
| TELEGRAM_WEBHOOK_SECRET | Secret token for webhook validation | Recommended | random 32 hex |

## 7. Scripts Available

- `scripts/get_channel_id.py`: likely helper to get channel IDs — review and use.
- `backend/diagnose_bot.py`: checks bot token, admin ID format.

## 8. Final Checklist for Telegram Recovery

- [ ] Telegram API ID/Hash obtained
- [ ] Pyrogram session string(s) generated
- [ ] Bot created via BotFather, token saved
- [ ] 19 channels created (18 + 1 thumb)
- [ ] Bot added as admin to all channels
- [ ] Channel IDs obtained via Pyrogram get_dialogs
- [ ] Env vars set in local .env and Render dashboard
- [ ] Bot webhook set (call `/api/setup_webhook` as admin)
- [ ] Test `/api/channels/health` all healthy
- [ ] Re-upload video files to appropriate channels
- [ ] Update videos table with new channel/message IDs
- [ ] Test streaming one video per subject
- [ ] Document new IDs in private secure storage (not Git)

## 9. Permanent Loss Acknowledgment

Even with perfect recreation, you cannot recover:
- Original message IDs (Telegram assigns new IDs on re-upload)
- Original view counts per Telegram message (not tracked)
- Any historical comments in channels
- Any user bookmarks tied to old message IDs (but video_id stays same, so bookmarks still valid if you reuse same video_id)

If Supabase still has videos rows, you can reuse same video UUIDs and just update telegram_* columns to new values — user watch_history remains valid.

If Supabase was also wiped, you need to recreate entire catalog from scratch.
