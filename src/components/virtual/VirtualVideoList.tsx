import { useRef, useLayoutEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { PlayCircle, Clock } from 'lucide-react';
import { LazyImage } from '@/components/ui/LazyImage';
import { getThumbnailUrl } from '@/lib/thumbnails';
import { Video } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';

interface VirtualVideoListProps {
  videos: Video[];
  isLoading?: boolean;
}

export function VirtualVideoList({ videos, isLoading }: VirtualVideoListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  // Try to restore scroll position
  useLayoutEffect(() => {
    const savedScroll = sessionStorage.getItem('videoListScroll');
    if (savedScroll && parentRef.current) {
      parentRef.current.scrollTop = parseInt(savedScroll, 10);
    }
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    sessionStorage.setItem('videoListScroll', target.scrollTop.toString());
  };

  const virtualizer = useVirtualizer({
    count: isLoading ? 10 : videos.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // 80px tall requested
    overscan: 5,
  });

  return (
    <div 
      ref={parentRef} 
      onScroll={handleScroll}
      className="scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent pr-2"
      style={{
        height: '600px',
        width: '100%',
        overflow: 'auto',
        scrollBehavior: 'smooth',
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          if (isLoading) {
             return (
               <div
                  key={virtualItem.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                    padding: '4px 0' // gap
                  }}
               >
                  <Skeleton className="w-full h-full rounded-2xl" />
               </div>
             );
          }

          const video = videos[virtualItem.index];
          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
                padding: '4px 0' // 8px total gap essentially, between items
              }}
            >
              <Link to={`/watch/${video.id}`} className="block h-full cursor-pointer hover:bg-white/5 transition-colors overflow-hidden group bg-background-elevated border border-border rounded-2xl hover:border-primary/40">
                <div className="flex items-center h-full gap-4 px-4">
                  <div className="relative h-[56px] w-[99px] shrink-0 rounded-lg overflow-hidden bg-black/50 group-hover:ring-1 ring-primary/50 transition-all flex items-center justify-center">
                    <LazyImage 
                      src={getThumbnailUrl(video)} 
                      alt={video.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      fallbackSrc="/placeholder-video.jpg" 
                    />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <PlayCircle className="w-6 h-6 text-white/80 group-hover:text-white transition-colors drop-shadow-md" />
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h4 className="font-medium text-foreground truncate text-sm">{video.title}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-foreground-muted truncate">
                        Lesson {String(virtualItem.index + 1).padStart(2, "0")}
                      </span>
                      {video.duration && (
                        <div className="text-[10px] text-foreground-muted flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {video.duration}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

