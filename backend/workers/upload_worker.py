import asyncio
import logging
import os
import httpx
from datetime import datetime
from backend.core.security import secrets_manager
from backend.services.video_processor import video_processor

logger = logging.getLogger("NexusEdu.UploadWorker")

class UploadWorker:
    def __init__(self, app):
        self.app = app
        self.supabase_url = secrets_manager.get_secret("supabase_url")
        self.supabase_key = secrets_manager.get_secret("supabase_service_key")
        self.is_running = False

    async def start(self):
        self.is_running = True
        logger.info("Upload Worker started.")
        while self.is_running:
            await self.poll_queue()
            await asyncio.sleep(10)

    def stop(self):
        self.is_running = False

    async def update_status(self, queue_id: str, status: str, error_message: str = None):
        payload = {"status": status, "updated_at": datetime.utcnow().isoformat()}
        if error_message:
            payload["error_message"] = error_message
            
        async with httpx.AsyncClient() as client:
            await client.patch(
                f"{self.supabase_url}/rest/v1/upload_queue?id=eq.{queue_id}",
                headers={
                    "apikey": self.supabase_key,
                    "Authorization": f"Bearer {self.supabase_key}",
                    "Content-Type": "application/json"
                },
                json=payload
            )

    async def update_progress(self, current: int, total: int, queue_id: str):
        # Throttle progress updates to avoid too many DB calls
        percent = int(current * 100 / total)
        if hasattr(self, '_last_progress') and getattr(self, '_last_progress', 0) == percent:
            return
        if percent % 5 != 0: # Only update every 5%
            return
        self._last_progress = percent
        
        async with httpx.AsyncClient() as client:
            await client.patch(
                f"{self.supabase_url}/rest/v1/upload_queue?id=eq.{queue_id}",
                headers={
                    "apikey": self.supabase_key,
                    "Authorization": f"Bearer {self.supabase_key}",
                    "Content-Type": "application/json"
                },
                json={"progress_percent": percent, "updated_at": datetime.utcnow().isoformat()}
            )

    def is_render_free_tier(self):
        # Render provides RENDER environment variable.
        return os.environ.get("RENDER") == "true" and os.environ.get("IS_FREE_TIER", "true") == "true"

    def check_disk_space(self, required_bytes):
        import shutil
        total, used, free = shutil.disk_usage(video_processor.work_dir)
        return free > required_bytes

    async def poll_queue(self):
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.supabase_url}/rest/v1/upload_queue?status=eq.pending&limit=1",
                    headers={"apikey": self.supabase_key, "Authorization": f"Bearer {self.supabase_key}"}
                )
                if response.status_code != 200:
                    return
                
                tasks = response.json()
                if not tasks:
                    return
                    
                task = tasks[0]
                queue_id = task['id']
                file_id = task['telegram_file_id']
                file_name = task['file_name'] or f"video_{queue_id}.mp4"
                file_size = task.get('file_size_bytes', 1000000000)
                
                await self.process_task(queue_id, file_id, file_name, file_size)
        except Exception as e:
            logger.error(f"Error polling queue: {e}")

    async def process_task(self, queue_id: str, file_id: str, file_name: str, file_size: int = 1000000000):
        download_path = ""
        thumbnails = []
        variants = {}
        try:
            await self.update_status(queue_id, "processing")
            
            # 0. Check Disk Space (Assume we need 2x file size)
            estimated_size = file_size * 2
            if not self.check_disk_space(estimated_size):
                from backend.services.notification_service import notification_service
                await notification_service.notify_admin(f"Disk space insufficient for {file_name}")
                raise Exception("Insufficient disk space")

            # 1. Download file
            download_path = os.path.join(video_processor.work_dir, file_name)
            logger.info(f"Downloading {file_id} to {download_path}")
            
            # Download using app (Pyrogram) with progress tracking
            await self.app.download_media(file_id, file_name=download_path, progress=self.update_progress, progress_args=(queue_id,))
            
            # 2. Extract metadata
            metadata = await video_processor.get_metadata(download_path)
            
            # Handle Render Free Tier Limitations
            if self.is_render_free_tier():
                logger.info("Render free tier detected. Skipping FFmpeg processing.")
            else:
                # 3. Generate Thumbnails
                thumbnails = await video_processor.generate_thumbnails(download_path, metadata['duration'])
                
            thumbnail_msg_id = None
            if thumbnails:
                # Upload the largest variant to Telegram (last one is usually 1280x720)
                thumb_to_upload = thumbnails[-1]
                thumb_channel_str = os.environ.get("THUMBNAIL_CHANNEL_ID")
                if thumb_channel_str:
                    thumb_channel_id = int(thumb_channel_str)
                    thumbnail_msg_id = await video_processor.upload_thumbnail_to_telegram(self.app, thumb_to_upload, thumb_channel_id)
            
            if not self.is_render_free_tier():
                # 4. Generate variants
                variants = await video_processor.generate_variants(download_path)
                
                # 5. Upload variants back to telegram and save to DB
                for variant_name, variant_path in variants.items():
                    # Send back to telegram (Using a designated channel, e.g., the same source channel)
                    # This needs the actual channel ID or a designated storage channel id.
                    
                    # Checksums
                    checksums = video_processor.calculate_checksums(variant_path)
                    
                    # In a real workflow you'd upload: await self.app.send_video(chat_id, variant_path)
                    # and record the new file_ids into `video_variants` table.
                    
                    # Cleanup variants
                    if os.path.exists(variant_path):
                        os.remove(variant_path)
                    
            for thumb_path in thumbnails:
                if os.path.exists(thumb_path):
                    os.remove(thumb_path)
                
            if os.path.exists(download_path):
                os.remove(download_path)
            
            # Update the video directly to store the thumbnail_telegram_message_id (Assuming queue_id or similar is used to link to main DB, here update_status will be enough if main video table is updated elsewhere, but we'll try to update 'videos' table directly)
            if thumbnail_msg_id:
                async with httpx.AsyncClient() as client:
                    await client.patch(
                        f"{self.supabase_url}/rest/v1/videos?file_id=eq.{file_id}",
                        headers={
                            "apikey": self.supabase_key,
                            "Authorization": f"Bearer {self.supabase_key}",
                            "Content-Type": "application/json"
                        },
                        json={"thumbnail_telegram_message_id": thumbnail_msg_id}
                    )

            await self.update_status(queue_id, "completed")
            
            # Notification trigger (needs importing notification_service)
            from backend.services.notification_service import notification_service
            if notification_service:
                await notification_service.notify_upload_complete(file_id, file_name)
                
        except Exception as e:
            logger.error(f"Failed processing {queue_id}: {e}")
            await self.update_status(queue_id, "failed", str(e))
            from backend.services.notification_service import notification_service
            if notification_service:
                await notification_service.notify_upload_error(file_id, str(e))
        finally:
            # Cleanup handlers
            if download_path and os.path.exists(download_path):
                try:
                    os.remove(download_path)
                except Exception as e:
                    logger.warning(f"Failed to cleanup {download_path}: {e}")
                    
            for thumb_path in thumbnails:
                if os.path.exists(thumb_path):
                    try:
                        os.remove(thumb_path)
                    except Exception:
                        pass
                        
            for variant_path in variants.values():
                if os.path.exists(variant_path):
                    try:
                        os.remove(variant_path)
                    except Exception:
                        pass

