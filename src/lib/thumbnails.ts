export const getThumbnailUrl = (video: any): string => {
  if (video.thumbnail_url) return video.thumbnail_url;
  if (video.source_type === 'youtube' && video.youtube_video_id) {
    return `https://img.youtube.com/vi/${video.youtube_video_id}/mqdefault.jpg`;
  }
  if (video.source_type === 'drive' && video.drive_file_id) {
    return `https://drive.google.com/thumbnail?id=${video.drive_file_id}&sz=w320`;
  }
  if (video.source_type === 'telegram') {
    return `${import.meta.env.VITE_API_BASE_URL}/api/thumbnail/${video.id}`;
  }
  return '/placeholder-video.jpg';
};
