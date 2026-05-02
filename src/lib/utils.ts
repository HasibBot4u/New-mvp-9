import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getThumbnailUrl = (video: any): string => {
  if (video.thumbnail_url) return video.thumbnail_url;
  if (video.source_type === 'youtube' && video.youtube_video_id) {
    return `https://img.youtube.com/vi/${video.youtube_video_id}/mqdefault.jpg`;
  }
  if (video.source_type === 'youtube' && video.source_url) {
     let videoId = null;
     if (video.source_url.includes('youtube.com/watch?v=')) {
       videoId = video.source_url.split('v=')[1]?.substring(0, 11);
     } else if (video.source_url.includes('youtu.be/')) {
       videoId = video.source_url.split('youtu.be/')[1]?.substring(0, 11);
     }
     if (videoId) return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  }
  if (video.source_type === 'drive' && video.drive_file_id) {
    return `https://drive.google.com/thumbnail?id=${video.drive_file_id}&sz=w320`;
  }
  return '/placeholder-video.jpg';
};

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'অজানা';
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (diff < 60000) return 'এইমাত্র';
  if (mins < 60) return `${mins} মিনিট আগে`;
  if (hours < 24) return `${hours} ঘণ্টা আগে`;
  if (days < 30) return `${days} দিন আগে`;
  return date.toLocaleDateString('bn-BD');
}
