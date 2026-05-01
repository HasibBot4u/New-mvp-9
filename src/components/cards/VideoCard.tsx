import { Lock, Play } from "lucide-react";
import { Link } from "react-router-dom";
import { LazyImage } from "@/components/ui/LazyImage";

interface VideoCardProps {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  duration?: string | null;
  progressPercent?: number; // 0 to 100
  isLocked?: boolean;
  className?: string;
  chapterName?: string;
}

export function VideoCard({ id, title, thumbnailUrl, duration, progressPercent, isLocked, className = "", chapterName }: VideoCardProps) {
  const inner = (
    <>
      <div className="aspect-video bg-background-overlay relative overflow-hidden">
        {thumbnailUrl ? (
          <LazyImage src={thumbnailUrl} alt={title} className="w-full h-full group-hover:scale-105 transition-transform" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-foreground-muted">
            <Play className="w-12 h-12" />
          </div>
        )}
        
        {isLocked && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-background/80 flex items-center justify-center">
              <Lock className="w-5 h-5 text-foreground-muted" />
            </div>
          </div>
        )}

        {duration && !isLocked && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-white backdrop-blur-md">
            {duration}
          </div>
        )}

        {progressPercent !== undefined && progressPercent > 0 && !isLocked && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
            <div className="h-full bg-primary" style={{ width: `${progressPercent}%` }} />
          </div>
        )}
      </div>

      <div className="p-4">
        <p className="font-medium truncate">{title}</p>
        <p className="text-xs text-foreground-muted truncate">
          {chapterName || '—'} {progressPercent !== undefined && progressPercent > 0 ? `· ${progressPercent}%` : ''}
        </p>
      </div>
    </>
  );

  const baseClasses = `group rounded-2xl border border-white/5 bg-surface overflow-hidden hover:border-primary/30 transition-all block ${className}`;

  if (isLocked) {
    return <div className={baseClasses}>{inner}</div>;
  }

  return (
    <Link to={`/watch/${id}`} className={baseClasses}>
      {inner}
    </Link>
  );
}
