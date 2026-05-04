import React, { useCallback, useState } from "react";
import { useHlsPlayer } from "@/hooks/useHlsPlayer";
import { Button } from "@/components/ui/button";
import { Settings, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface AdaptivePlayerProps {
  src: string;
  token: string | null;
  poster?: string;
  onTimeUpdate?: (time: number) => void;
  onEnded?: () => void;
  onError?: () => void;
  onLoadedMetadata?: (duration: number) => void;
}

export const AdaptivePlayer = React.forwardRef<HTMLVideoElement, AdaptivePlayerProps>(({
  src,
  token,
  poster,
  onTimeUpdate,
  onEnded,
  onError,
  onLoadedMetadata
}, ref) => {
  const { videoRef, currentLevel, levels, setQuality, isBuffering } = useHlsPlayer(src, token, ref as React.RefObject<HTMLVideoElement>);
  const [showSettings, setShowSettings] = useState(false);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current && onTimeUpdate) {
      onTimeUpdate(videoRef.current.currentTime);
    }
  }, [onTimeUpdate, videoRef]);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current && onLoadedMetadata) {
      onLoadedMetadata(videoRef.current.duration);
    }
  }, [onLoadedMetadata, videoRef]);

  return (
    <div className="relative w-full h-full group bg-black">
      {isBuffering && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 pointer-events-none">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      )}
      
      <video
        ref={videoRef}
        poster={poster}
        controls
        autoPlay
        playsInline
        className="w-full h-full"
        onTimeUpdate={handleTimeUpdate}
        onEnded={onEnded}
        onError={onError}
        onLoadedMetadata={handleLoadedMetadata}
        aria-label="Video player"
      >
        <track kind="captions" srcLang="en" label="English" />
        <track kind="captions" srcLang="bn" label="Bengali" />
      </video>
      
      {/* Custom Quality Selector overlay over controls */}
      {levels.length > 0 && (
        <div className="absolute bottom-4 right-20 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
          <Popover open={showSettings} onOpenChange={setShowSettings}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" aria-label="Video Quality Settings">
                <Settings className="w-5 h-5" aria-hidden="true" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-40 p-2 bg-black/90 border-zinc-800 text-white" side="top">
              <div className="flex flex-col gap-1" role="menu" aria-label="Quality options">
                <span className="text-xs text-zinc-400 px-2 py-1 uppercase" id="quality-label">Quality</span>
                <button
                  role="menuitem"
                  aria-labelledby="quality-label"
                  onClick={() => { setQuality(-1); setShowSettings(false); }}
                  className={`text-left px-2 py-1.5 text-sm rounded ${currentLevel === -1 ? 'bg-primary text-white' : 'hover:bg-white/10'}`}
                >
                  Auto {currentLevel !== -1 && levels[currentLevel] ? `(${levels[currentLevel].height}p)` : ''}
                </button>
                {levels.map((level, idx) => (
                  <button
                    key={idx}
                    role="menuitem"
                    aria-labelledby="quality-label"
                    onClick={() => { setQuality(idx); setShowSettings(false); }}
                    className={`text-left px-2 py-1.5 text-sm rounded ${currentLevel === idx ? 'bg-primary text-white' : 'hover:bg-white/10'}`}
                  >
                    {level.height}p
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
});

AdaptivePlayer.displayName = "AdaptivePlayer";
