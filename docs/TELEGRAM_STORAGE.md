# Telegram Video Storage Architecture

This document explains the Telegram storage architecture used in NexusEdu.

## WHY TELEGRAM AS VIDEO STORAGE

The platform needs to store 1,400+ lecture videos averaging 800MB–1.5GB each — approximately 1.4 Terabytes total. Every conventional option fails:

- **Google Drive free:** 15GB total — cannot hold even 1% of the content
- **YouTube:** Detects and removes re-uploaded copyrighted course content even when set to Unlisted
- **AWS S3:** ~$30/month for storage + transfer — no budget
- **Bunny.net:** Paid CDN — no budget

**Telegram solves all of this:**
- Completely free, unlimited file storage forever
- Supports files up to 2GB each (all videos fit within this)
- Never deletes content from private channels
- No copyright detection on private channels
- Files are permanent once uploaded — file_id never changes
- Accessible via Pyrogram's MTProto protocol for large-file streaming

---

## THE 18-CHANNEL ARCHITECTURE

The content has this hierarchy:
```
3 subjects × 6 cycles each = 18 cycles total
→ 1 dedicated private Telegram channel per cycle = 18 channels
```

| Channel Name | Subject | Cycle | Channel ID |
|---|---|---|---|
| NexusEdu PHY C1 | Physics | Cycle 1 | (stored securely) |
| NexusEdu PHY C2 | Physics | Cycle 2 | (stored in DB) |
| NexusEdu PHY C3–C6 | Physics | Cycles 3–6 | (stored in DB) |
| NexusEdu CHE C1–C6 | Chemistry | Cycles 1–6 | (stored in DB) |
| NexusEdu HM C1–C6 | Higher Math | Cycles 1–6 | (stored in DB) |

Each channel holds approximately 80 videos. The Telegram Channel ID for each cycle is stored in the `cycles` table in Supabase (`telegram_channel_id` column). This is the link between the database and the video storage.

---

## HOW TELEGRAM FILE ADDRESSING WORKS

Every file uploaded to Telegram gets two permanent identifiers:

**`telegram_file_id`** — a long string like `BQACAgUAAxkBAAIBcGX...AAHZ2-IhAA` — this is Telegram's internal permanent reference to the exact file bytes. It never changes, even if the message is forwarded. This is what Pyrogram uses to stream the video.

**`telegram_message_id`** — a simple integer (1, 2, 3, 4...) — the sequential message number within that specific channel. Used to fetch the message object that contains the file.

Both are stored per video row in the `videos` database table:
```
videos.telegram_file_id     = "BQACAgUAAxkBAAIBcGX..."
videos.telegram_message_id  = 3
videos.telegram_channel_id  = "-100xxxxxxx"
```

---

## WHY PYROGRAM INSTEAD OF TELEGRAM BOT API

The standard Telegram Bot API (the simple one everyone knows) has a **hard 20MB file size limit**. Our videos are 800MB–1.5GB — 40–75x over that limit. It simply cannot work.

**Pyrogram** uses Telegram's full MTProto protocol — the same protocol the Telegram app itself uses. This supports files up to **2GB** with no limitations. Pyrogram logs in as a regular Telegram user account (using a session string), not as a bot, which gives it full access to all channels that account is a member of.

---

## FINDING THE CORRECT CHANNEL ID (Crucial)

Many users incorrectly provide a User ID instead of a Channel ID when configuring the platform.

**Understanding Telegram IDs:**
- **User IDs** are typically 6-10 digits (e.g., `7950033441`).
- **Private Channel IDs** ALWAYS start with `-100` followed by 13 digits (e.g., `-1001234567890`).

If you forward a message from your channel to `@userinfobot`, it will show you the **sender's User ID** (your own ID, or the channel owner's ID), NOT the actual Channel ID.

**How to get the CORRECT Channel ID:**
1. **Invite a Bot:** Add `@userinfobot` (or your own bot) as an Administrator to your channel.
2. **Send a Message:** Send any test message in the channel.
3. The bot will receive the message and reply with the true Channel ID (e.g., `-100xxxxxxx`).

**Python Script Fallback:**
If you already use Pyrogram, you can easily fetch the ID of a channel by its name:
```python
from pyrogram import Client
app = Client("my_account", api_id=12345678, api_hash="abcdef...")
async def main():
    async with app:
        chat = await app.get_chat("NexusEdu Thumbnails")
        print(chat.id)  # Returns -100xxxxxxxxxxx
app.run(main())
```

---

## TELEGRAM BOT PERMISSIONS (For the Webhook Manager)

The platform runs a pure Telegram Bot using `python-telegram-bot` to monitor channels and manage uploads when the backend server is idle.

**CRITICAL: Bot Permissions in Channels**

The bot does **NOT** need the following permissions in channels:
- Change Channel Info: **OFF**
- Post Messages: **OFF**
- Edit Messages of Others: **OFF**
- Delete Messages of Others: **OFF**
- Post Stories: **OFF**
- Edit Stories of Others: **OFF**
- Delete Stories of Others: **OFF**
- Manage Direct Messages: **OFF** (This is for user messaging, not channel posts)
- Invite Users via Link: **OFF**
- Manage Live Streams: **OFF**
- Add New Admins: **OFF**
- Ban Users: **OFF**

**The ONLY permission the bot needs is Implicit Read Access.**
When you add a bot as an Administrator to a channel (even if you turn all the sliders above to "OFF"), Telegram automatically grants the bot permission to **Read Messages**. This is how the backend `MessageHandler` listens for new `CHANNEL_POST` updates (new videos being uploaded).

To verify if your bot can see channel messages, run the `/checkpermissions` admin command to the bot directly in a private message, or watch the backend logs.

---

## THE SESSION STRING — HOW TELEGRAM AUTH WORKS

Normal Telegram login requires entering your phone number and a one-time OTP code every time. For a server that restarts automatically, this is impossible.

The **session string** is a base64-encoded representation of your complete Telegram login state — phone number, auth keys, server salts, everything. It is generated once using a small script, then stored as an environment variable. When Pyrogram starts, it reads this string and is instantly logged in without any OTP prompt. The session string is approximately 356 characters long.

```
PYROGRAM_SESSION_STRING=BQJKcIcAIs5USh35...AAHZ2-IhAA
```

---

## THE CHANNEL RESOLUTION PROBLEM (Critical)

When Pyrogram first starts using a session string, it does NOT automatically know about channels. Even though the account is a member of all 18 channels, Pyrogram's internal cache is empty. Trying to call `get_messages(channel_id, message_id)` immediately returns "CHANNEL_INVALID" error.

**The fix:** Before fetching any message, call `tg.get_chat(channel_id)` first. This "resolves" the channel — Pyrogram downloads the channel's metadata and caches it. After this, `get_messages()` works perfectly.

The system must:
1. On server startup: resolve the test channel immediately
2. On startup: call `tg.get_dialogs(limit=100)` to auto-discover all channels in the account's chat list
3. On catalog refresh: loop through all 18 cycle channel IDs and resolve any that haven't been resolved yet
4. On every stream request: call `resolve_channel()` as a safety check before `get_messages()`

---

## THE STREAMING PIPELINE (Byte by Byte)

```
User's browser                   FastAPI Backend              Telegram
     │                                │                           │
     │ GET /api/stream/{video_uuid}   │                           │
     │ [Optional: Range: bytes=X-]   │                           │
     │ ──────────────────────────→   │                           │
     │                                │ lookup video_uuid         │
     │                                │ → get channel_id          │
     │                                │ → get message_id          │
     │                                │                           │
     │                                │ resolve_channel()         │
     │                                │ ──────────────────────→  │
     │                                │ ←── channel metadata ──  │
     │                                │                           │
     │                                │ get_messages()            │
     │                                │ ──────────────────────→  │
     │                                │ ←── message object ────  │
     │                                │                           │
     │                                │ stream_media() ─────────→│
     │                                │ ←── 1MB chunk 1 ───────  │
     │ ←── HTTP 200 + chunk 1 ─────  │                           │
     │                                │ ←── 1MB chunk 2 ───────  │
     │ ←── chunk 2 ────────────────  │                           │
     │ [video starts playing]         │ ←── chunk 3 ...  ───────  │
     │ ←── chunk 3... (continuous) ─ │                           │
```

**For seeking (Range requests):**
```
User drags to 30:00 mark
→ Browser calculates byte offset: ~450,000,000
→ Sends: Range: bytes=450000000-
→ Backend calculates: chunk_offset = 450000000 ÷ 1048576 = chunk 429
→ skip_bytes = 450000000 % 1048576 = bytes to skip in first chunk
→ Streams from chunk 429 onward, skipping the leading bytes
→ Returns HTTP 206 Partial Content
→ Video resumes from exact 30:00 position
```

---

## HOW VIDEOS GET INTO THE SYSTEM (Upload Workflow)

1. Admin uploads video to the correct Telegram channel **as a FILE** (not as a video — sending as file preserves quality, filename, and prevents compression)
2. The File ID Helper Bot (running in Replit) detects the new upload automatically and prints: `message_id`, `telegram_file_id`, `filename`, `size_mb`
3. Admin copies these values and enters them into the admin dashboard under the correct chapter
4. The catalog cache refreshes and the video appears on the website
