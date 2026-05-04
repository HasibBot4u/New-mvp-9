# Telegram Upload & Processing Pipeline

This document explains the automated system for processing videos uploaded to Telegram storage channels.

## 1. Overview
The platform uses Telegram channels (up to 18 private channels) as a highly scalable, free CDN for serving large video files (800MB-1.5GB) to students. Previously, managing file IDs, metadata, and uploads was completely manual.

The new automated pipeline performs the following steps seamlessly:
1. **Auto-Detection:** A Pyrogram event listener monitors all 18 channels for any newly posted video or document.
2. **Metadata Extraction:** Extracts resolution, duration, file size, MIME type, and Telegram `file_id`.
3. **Queueing:** Inserts the raw metrics into a Supabase `upload_queue` table with a `pending` status.
4. **Processing (Background Worker):**
   - Drops the file onto local ephemeral disk via Telegram MTProto download.
   - Extracts rigorous codec details via `ffprobe`.
   - Captures responsive thumbnails (10% mark) and uploads to standard storage.
   - Generates responsive web-ready variants (360p, 720p, 1080p fallback) using `ffmpeg` hardware-accelerated loops (where applicable).
   - Verifies file integrity (MD5, SHA256 checksums).
   - Re-uploads the variants back to a designated Telegram storage channel to procure new `file_id` pointers.
5. **Database Finalization:** Modifies the Supabase `videos` and `video_variants` tables to permanently point to the newly encoded files, completing the upload automatically without front-end interaction.
6. **Notification:** A notification service pings the admin Telegram chat indicating upload success or rendering errors.

## 2. Infrastructure Components

### `backend/services/telegram_upload_service.py`
A Pyrogram event hook service binding to `app.on_message` on the backend's primary `Client`. When an Admin uses a mobile or desktop client to upload an MP4, the event hook detects it, retrieves object characteristics, and POSTs an initial skeleton to Supabase. This mitigates the risk of a "blind" upload getting lost.

### `backend/services/video_processor.py`
Wraps `ffmpeg` and `ffprobe` operations async via Python's `asyncio.create_subprocess_exec`. This handles generating H.264/AAC variants configured for adaptive bitrate streaming without saturating the main FastAPI loop.

### `backend/workers/upload_worker.py`
An intermittent polling worker monitoring the `upload_queue`. It operates defensively — tracking `retry_count`, downloading the raw chunk data iteratively to avoid memory pressure, processing the video sequentially, and then wiping the `/tmp` variants to conserve ephemeral disk usage.

### `backend/services/notification_service.py`
Centralized service for proactive monitoring. Exposes functions like `notify_upload_complete`, `notify_error`, and `check_channel_capacity`. 

### `backend/api/admin/upload.py`
Provides HTTP routes integrated with FastAPI `Depend(verify_admin)` wrappers to perform bulk actions:
- `POST /api/admin/bulk_url_upload`: Insert raw URLs/links directly to queue.
- `POST /api/admin/bulk_delete`: Drop sets of videos and associated DB rows.
- `POST /api/admin/bulk_move`: Safely map videos between chapters (`target_chapter_id`).
- `PATCH /api/admin/bulk_update`: Modify descriptions/tags en masse.

## 3. Worker Strategy & Deployment Considerations
- **Concurrency:** The implementation currently processes videos serially. For high concurrency, it is recommended to run a separate Celery cluster pointing to the Supabase `upload_queue`, replacing the inline `asyncio.create_task` worker.
- **Disk Space:** Processing a 1.5GB file into 3 variants requires ~5GB of temporary free space. If running on Cloud Run or Render, ensure the instance has adequate `/tmp` capacity (in-memory overlay or attached storage).
