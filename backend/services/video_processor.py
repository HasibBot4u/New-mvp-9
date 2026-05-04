import os
import asyncio
import json
import logging
import hashlib
from typing import Dict, Any, List

logger = logging.getLogger("NexusEdu.VideoProcessor")

class VideoProcessor:
    def __init__(self, work_dir: str = "/tmp/video_processing"):
        self.work_dir = work_dir
        os.makedirs(self.work_dir, exist_ok=True)
        
    async def get_metadata(self, file_path: str) -> Dict[str, Any]:
        """Extract metadata using ffprobe."""
        cmd = [
            "ffprobe", "-v", "error", "-print_format", "json",
            "-show_format", "-show_streams", file_path
        ]
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        if process.returncode != 0:
            logger.error(f"ffprobe error: {stderr.decode()}")
            raise Exception("Failed to extract metadata")
            
        data = json.loads(stdout.decode())
        
        video_stream = next((s for s in data.get('streams', []) if s['codec_type'] == 'video'), None)
        format_info = data.get('format', {})
        
        return {
            "duration": float(format_info.get('duration', 0)),
            "width": int(video_stream.get('width', 0)) if video_stream else 0,
            "height": int(video_stream.get('height', 0)) if video_stream else 0,
            "bitrate": int(format_info.get('bit_rate', 0)),
            "frame_rate": video_stream.get('r_frame_rate') if video_stream else None,
            "codec": video_stream.get('codec_name') if video_stream else None
        }

    async def generate_thumbnails(self, file_path: str, duration: float) -> List[str]:
        """Generate 3 variants of thumbnails at 10% mark."""
        target_time = duration * 0.1
        output_paths = []
        resolutions = ["320x180", "640x360", "1280x720"]
        base_name = os.path.splitext(os.path.basename(file_path))[0]
        
        for res in resolutions:
            out_path = os.path.join(self.work_dir, f"{base_name}_{res}.jpg")
            cmd = [
                "ffmpeg", "-y", "-ss", str(target_time), "-i", file_path,
                "-vframes", "1", "-s", res, out_path
            ]
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            await process.communicate()
            if process.returncode == 0:
                output_paths.append(out_path)
                
        return output_paths

    async def upload_thumbnail_to_telegram(self, app, file_path: str, channel_id: int) -> int:
        """Upload thumbnail to Telegram as a photo and return the message ID."""
        import logging
        logger = logging.getLogger("NexusEdu.VideoProcessor")
        try:
            msg = await app.send_photo(chat_id=channel_id, photo=file_path)
            return msg.id
        except Exception as e:
            logger.error(f"Failed to upload thumbnail: {e}")
            return 0

    async def generate_variants(self, file_path: str) -> Dict[str, str]:
        """Generate 360p, 720p, 1080p variants."""
        metadata = await self.get_metadata(file_path)
        orig_height = metadata.get('height', 0)
        
        variants = {
            "360p": {"scale": "640:360", "bitrate": "800k"},
            "720p": {"scale": "1280:720", "bitrate": "2500k"}
        }
        
        if orig_height > 1080:
            variants["1080p"] = {"scale": "1920:1080", "bitrate": "5000k"}
        elif orig_height > 720:
             variants["1080p"] = {"scale": "1920:1080", "bitrate": "5000k"} # Or copy
             
        generated_files = {}
        base_name = os.path.splitext(os.path.basename(file_path))[0]
        
        for name, config in variants.items():
            out_path = os.path.join(self.work_dir, f"{base_name}_{name}.mp4")
            cmd = [
                "ffmpeg", "-y", "-i", file_path,
                "-vf", f"scale={config['scale']}:force_original_aspect_ratio=decrease,pad={config['scale']}:(ow-iw)/2:(oh-ih)/2",
                "-c:v", "libx264", "-b:v", config['bitrate'], "-maxrate", config['bitrate'],
                "-bufsize", f"{int(config['bitrate'].replace('k', '')) * 2}k",
                "-c:a", "aac", "-b:a", "128k", out_path
            ]
            logger.info(f"Generating {name} variant...")
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            if process.returncode == 0:
                generated_files[name] = out_path
            else:
                logger.error(f"Error generating {name}: {stderr.decode()}")
                
        return generated_files

    def calculate_checksums(self, file_path: str) -> Dict[str, str]:
        md5_hash = hashlib.md5()
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                md5_hash.update(chunk)
                sha256_hash.update(chunk)
        return {
            "md5": md5_hash.hexdigest(),
            "sha256": sha256_hash.hexdigest()
        }

video_processor = VideoProcessor()
