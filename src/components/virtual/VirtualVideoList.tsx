import { CSSProperties, useRef, useState, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Card } from '@/components/ui/card';
import { PlayCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Video {
  id: string;
  title: string;
  thumbnail_url?: string;
  duration?: number;
  is_free: boolean;
}

interface VirtualVideoListProps {
  videos: Video[];
  onVideoSelect: (videoId: string) => void;
  height?: number;
  itemHeight?: number;
}

export default function VirtualVideoList({ 
  videos, 
  onVideoSelect, 
  height = 600, 
  itemHeight = 100 
}: VirtualVideoListProps) {
  
  const [listWidth, setListWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setListWidth(containerRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const Row = ({ index, style }: { index: number, style: CSSProperties }) => {
    const video = videos[index];
    
    // Add gap manually to the style since react-window doesn't support gaps natively
    const modifiedStyle = {
      ...style,
      height: (style.height as number) - 10, // 10px gap
      marginBottom: 10,
    };

    return (
      <div style={modifiedStyle} className="px-2">
        <Card 
          className="cursor-pointer hover:bg-white/5 transition-colors h-full overflow-hidden border-white/5 group bg-black/20"
          onClick={() => onVideoSelect(video.id)}
        >
          <div className="flex h-full items-center p-2">
            <div className="relative w-32 shrink-0 aspect-video rounded-md overflow-hidden bg-black/50 group-hover:ring-1 ring-primary/50 transition-all">
              {video.thumbnail_url ? (
                <img 
                  src={video.thumbnail_url} 
                  alt={video.title} 
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/20">
                  <PlayCircle className="w-8 h-8" />
                </div>
              )}
              {video.duration && (
                <div className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-medium text-white flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDuration(video.duration)}
                </div>
              )}
            </div>
            
            <div className="ml-4 flex-1 min-w-0 flex flex-col justify-center">
              <h4 className="font-medium text-foreground truncate">{video.title}</h4>
              <div className="flex items-center gap-2 mt-2">
                {video.is_free && (
                  <Badge variant="outline" className="text-[10px] py-0 h-4 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    Free
                  </Badge>
                )}
                <span className="text-xs text-foreground-muted truncate">
                  Video {index + 1}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  };

  return (
    <div ref={containerRef} className="w-full h-full">
      {listWidth > 0 && (
        <List
          height={height}
          itemCount={videos.length}
          itemSize={itemHeight}
          width={listWidth}
          className="scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent pr-2"
        >
          {Row}
        </List>
      )}
    </div>
  );
}
