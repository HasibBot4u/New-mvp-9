import React from 'react';
import { Play, CheckCircle2 } from 'lucide-react';
import { Video } from '../../types';

interface VideoCardProps {
  video: Video;
  isWatched?: boolean;
  watchPercent?: number;
  onClick: () => void;
}

export const VideoCard: React.FC<VideoCardProps> = ({ 
  video, 
  isWatched = false, 
  watchPercent = 0, 
  onClick 
}) => {
  // Format duration
  const formatDuration = (durationStr?: string) => {
    if (!durationStr) return '00:00';
    // If it's already in HH:MM:SS format, just return it
    if (durationStr.includes(':')) return durationStr;
    
    // Otherwise try to parse as seconds
    const seconds = parseInt(durationStr, 10);
    if (isNaN(seconds)) return durationStr;
    
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Determine gradient based on subject or random if not available
  // We'll use a default indigo gradient
  const gradientClass = "bg-gradient-to-br from-indigo-500 to-purple-600";

  return (
    <div 
      className="group cursor-pointer bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-200 flex flex-col"
      onClick={onClick}
    >
      <div className={`relative aspect-video ${gradientClass} flex items-center justify-center overflow-hidden`}>
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
        
        <div className="w-12 h-12 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
          <Play className="w-6 h-6 text-white ml-1" fill="currentColor" />
        </div>

        {/* Duration Badge */}
        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded font-mono">
          {formatDuration(video.duration)}
        </div>

        {/* Watched Badge */}
        {isWatched && (
          <div className="absolute top-2 right-2 bg-emerald-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 bangla font-medium shadow-sm">
            <CheckCircle2 className="w-3 h-3" />
            দেখা হয়েছে
          </div>
        )}

        {/* Progress Bar overlay if partially watched */}
        {!isWatched && watchPercent > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200/30">
            <div 
              className="h-full bg-indigo-500" 
              style={{ width: `${watchPercent}%` }}
            />
          </div>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <h3 className="font-semibold text-gray-900 line-clamp-2 bangla mb-2 group-hover:text-indigo-600 transition-colors">
          {(video as any).title_bn || video.title}
        </h3>
        
        {watchPercent > 0 && !isWatched && (
          <div className="mt-auto pt-2">
            <div className="flex justify-between text-xs text-gray-500 bangla mb-1">
              <span>অগ্রগতি</span>
              <span>{Math.round(watchPercent)}%</span>
            </div>
            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-500 rounded-full" 
                style={{ width: `${watchPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
