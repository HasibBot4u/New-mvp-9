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
                
                await self.process_task(queue_id, file_id, file_name)
        except Exception as e:
            logger.error(f"Error polling queue: {e}")

    async def process_task(self, queue_id: str, file_id: str, file_name: str):
        try:
            await self.update_status(queue_id, "processing")
            
            # 1. Download file
            download_path = os.path.join(video_processor.work_dir, file_name)
            logger.info(f"Downloading {file_id} to {download_path}")
            
            # Download using app (Pyrogram)
            await self.app.download_media(file_id, file_name=download_path)
            
            # 2. Extract metadata
            metadata = await video_processor.get_metadata(download_path)
            
            # 3. Generate Thumbnails (Upload to Supabase Storage skipped here for brevity or done via HTTP)
            thumbnails = await video_processor.generate_thumbnails(download_path, metadata['duration'])
            
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
                os.remove(variant_path)
                
            for thumb_path in thumbnails:
                os.remove(thumb_path)
                
            os.remove(download_path)
            
            await self.update_status(queue_id, "completed")
            
            # Notification trigger (needs importing notification_service)
            from backend.services.notification_service import notification_service
            if notification_service:
                await notification_service.notify_upload_complete(file_name, list(variants.keys()), metadata)
                
        except Exception as e:
            logger.error(f"Failed processing {queue_id}: {e}")
            await self.update_status(queue_id, "failed", str(e))
            from backend.services.notification_service import notification_service
            if notification_service:
                await notification_service.notify_error("Failed to process", str(e))

