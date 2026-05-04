import asyncio
import logging
import os

logger = logging.getLogger("NexusEdu.HLSGenerator")

class HLSGenerator:
    def __init__(self):
        self.work_dir = "/tmp/hls_cache"
        os.makedirs(self.work_dir, exist_ok=True)
        
    def generate_master_playlist(self, video_id: str) -> str:
        return f"""#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360
/api/stream/{video_id}/360p/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720
/api/stream/{video_id}/720p/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
/api/stream/{video_id}/1080p/playlist.m3u8
"""

    def generate_variant_playlist(self, video_id: str, quality: str, duration: float) -> str:
        segment_duration = 6
        total = int(duration // segment_duration) + (1 if duration % segment_duration else 0)
        
        m3u8 = ["#EXTM3U", "#EXT-X-VERSION:3", f"#EXT-X-TARGETDURATION:{segment_duration}", "#EXT-X-MEDIA-SEQUENCE:0"]
        
        for i in range(total):
            dur = segment_duration if i < total - 1 else duration % segment_duration
            if dur <= 0: continue
            m3u8.append(f"#EXTINF:{dur:.3f},")
            m3u8.append(f"/api/stream/{video_id}/{quality}/{i}.ts")
            
        m3u8.append("#EXT-X-ENDLIST")
        return "\n".join(m3u8)

hls_generator = HLSGenerator()
