# Telegram Infrastructure Reconstruction Guide

**Context (evidence):** `docs/PROJECT_REVIVAL_ROADMAP.md` + `TELEGRAM_RECOVERY_GUIDE.md` state the original **18 storage channels and the bot were deleted externally**. All channel/bot identifiers, message IDs and video files from that era are **permanently lost**. This guide rebuilds the infrastructure from scratch using only what the code requires. **No old ID is reusable — never assume one.**

## 1. What the code expects (inventory from repository evidence)

| Integration point | Evidence | What it needs |
|---|---|---|
| MTProto streaming/download | `main.py` (`Client(..., session_string=SESSION_STRING, in_memory=True)`), `get_active_client`, `_stream_telegram` | `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, a **user** session string (optionally `_2` for fallback) |
| Channel map | `CHANNEL_MAP` in `main.py`: keys `physics-c1..c6`, `chemistry-c1..c6`, `math-c1..c6` ← env `PHY_C1..C6_CHANNEL_ID`, `CHE_C1..C6_CHANNEL_ID`, `HM_C1..C6_CHANNEL_ID` | 18 private channels, IDs as `-100…` integers |
| Cycle↔channel link | `cycles.telegram_channel_id` column; `refresh_catalog()` resolves those channels | DB rows updated with the NEW channel ids |
| Thumbnails | `THUMBNAIL_CHANNEL_ID` channel; worker uploads JPEGs there; `/api/thumbnail/{id}` reads them | 1 private channel |
| Bot (webhook mode) | `bot_manager.py`: commands `/start /help /ping /status /stats /notify /scan /scan_cancel`; webhook at `{WEBHOOK_URL}[/api/bot_webhook]` with secret header `X-Telegram-Bot-Api-Secret-Token` | `TELEGRAM_BOT_TOKEN`, `WEBHOOK_URL`, `TELEGRAM_WEBHOOK_SECRET`, `ADMIN_CHAT_ID` |
| Admin notifications | `services/notification_service.py` posts to Bot API `sendMessage` | bot token + `ADMIN_CHAT_ID` |
| Upload ingestion | `telegram_upload_service.py`: Pyrogram handler watches every `CHANNEL_MAP` channel for new videos/documents → `upload_queue` | bot NOT needed; user session must be **admin/poster** in each channel |
| Channel scanner | bot `/scan` reads history of every `*_CHANNEL_ID` env var | bot must be member of channels |

## 2. Step-by-step reconstruction

### 2.1 Telegram account + API credentials
1. Use the owner's Telegram account (the one whose session may stream the content).
2. Open `https://my.telegram.org` → API development tools → create/confirm an application → note `api_id` + `api_hash` → `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`.
   *Status of the old credentials: UNKNOWN — if the app was deleted with the account assets, create a new one.*

### 2.2 Generate Pyrogram session string(s)
From the repo root with the venv active:
```python
from pyrogram import Client
Client("nexusedu_session", api_id=<ID>, api_hash="<HASH>").run()  # interactive login
```
The repo's `.gitignore` (`*.session`, `nexusedu_session*`) shows sessions were historically stored as local `nexusedu_session.session` files. Convert to string per Pyrogram docs and set `PYROGRAM_SESSION_STRING` (and optionally `PYROGRAM_SESSION_STRING_2` from a **second account** for FloodWait resilience — the watchdog fails over automatically).

### 2.3 Create the channels (19 total)
Create **private channels**: `NexusEdu PHY C1..C6`, `NexusEdu CHE C1..C6`, `NexusEdu HM C1..C6`, plus `NexusEdu Thumbnails`.
- Add the **user session's account as owner/admin** (it streams AND the upload watcher needs read access).
- Add the **bot as admin** (for `/scan`, `/notify` and webhook features).

### 2.4 Obtain channel IDs
IDs are not visible in the UI. Run the repo's own script (evidence: `scripts/get_channel_id.py`):
```bash
python3 scripts/get_channel_id.py
```
It uses the session to enumerate dialogs and print `-100…` ids. Forwarding a channel post to @userinfobot-class bots also works. Fill all 19 env vars (`PHY_C1_CHANNEL_ID=-100XXXXXXXXXX` … `THUMBNAIL_CHANNEL_ID`).

### 2.5 Create the bot
1. @BotFather → `/newbot` → copy token → `TELEGRAM_BOT_TOKEN`.
2. Set a webhook secret: any random 32+ char string → `TELEGRAM_WEBHOOK_SECRET`.
3. `WEBHOOK_URL` = your public backend base (e.g. `https://<svc>.onrender.com`) **or** with `/api/bot_webhook` — Stage 2 code normalizes both.
4. Start the backend once; `bot_manager.initialize()` deletes any stale webhook and sets the new one (`_set_webhook`). Verify: `GET /api/setup_webhook` as admin returns `info.webhook_set=true`; in Telegram `/start` then `/ping`.
5. `ADMIN_CHAT_ID` = your numeric Telegram id (bot's `/start` reply shows it; multiple admins comma-separated).

### 2.6 Database backfill
For every cycle row, set the new channel id:
```sql
UPDATE cycles SET telegram_channel_id = '<-100…>' WHERE name = 'Physics Cycle 1';  -- etc.
```
(`refresh_catalog()` resolves these at boot; mis-set ids log "Could not resolve".)

### 2.7 Re-upload content (the unrecoverable part)
The 1,400 video files are gone with the old channels. Two ingest paths now work:
- **Manual channel upload:** drop video files into the right channel → the `telegram_upload_service` watcher queues them (`upload_queue`) → `UploadWorker` downloads, extracts metadata/thumbnails, links `thumbnail_telegram_message_id`, notifies the admin chat. Then create the `videos` row (admin panel → Content) with the channel/message ids shown by the worker logs or by `/scan`.
- **Admin bulk endpoints:** `POST /api/admin/videos` with `telegram_channel_id` + `telegram_message_id` (whitelisted fields), or `bulk_move/bulk_update` for housekeeping.
After ingest: `GET /api/refresh` and confirm the video streams.

## 3. Testing the rebuilt integration
1. `GET /api/channels/health` (authed) → every configured channel `status: ok`.
2. `/scan` in Telegram → counts videos per channel.
3. Upload a short MP4 to `PHY C1` → watch worker logs → thumbnail appears at `/api/thumbnail/{video_id}` after linking.
4. Stream it: open `/watch/{id}` as an enrolled user → 206 responses in network tab.
5. Negative tests: wrong `ticket` → 401; non-enrolled user on locked chapter → 403; stop the session → watchdog reconnect logs within ~60s; `telegram_connected` gauge drops to 0 (Prometheus).

## 4. What is still impossible
- Restoring original channel/bot IDs, message numbering, or the uploaded video bytes (no repository/DB copy of the media exists — **confirmed**: repo contains metadata schema only).
- Recovering the old bot's command state or webhook registration.
- Knowing whether the old `TELEGRAM_API_ID/HASH` remain valid → treat as UNKNOWN, re-issue to be safe.
