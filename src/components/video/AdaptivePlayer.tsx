import React, { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
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
  const internalRef = React.useRef<HTMLVideoElement>(null);
  const videoRef = (ref as React.RefObject<HTMLVideoElement>) || internalRef;
  
  const [showSettings, setShowSettings] = useState(false);
  const [quality, setQuality] = useState<string>("auto");
  const [isBuffering, setIsBuffering] = useState(true); // start buffering assuming it's loading

  // Since we removed HLS, this is now a simple MP4 player stream.
  // The backend could potentially support ?quality=720p 
  const getStreamUrl = useCallback(() => {
    try {
        const url = new URL(src);
        if (token) url.searchParams.set("token", token);
        if (quality !== "auto") url.searchParams.set("quality", quality);
        return url.toString();
    } catch {
        // Fallback for simple paths
        return `${src}?token=${token || ''}&quality=${quality}`;
    }
  }, [src, token, quality]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current && onTimeUpdate) {
      onTimeUpdate(videoRef.current.currentTime);
    }
  }, [onTimeUpdate, videoRef]);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current && onLoadedMetadata) {
      onLoadedMetadata(videoRef.current.duration);
    }
    setIsBuffering(false);
  }, [onLoadedMetadata, videoRef]);

  const qualities = ["auto", "360p", "480p", "720p", "1080p"];

  return (
    <div className="relative w-full h-full group bg-black">
      {isBuffering && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
        </div>
      )}
      <video
        ref={videoRef}
        src={getStreamUrl()}
        poster={poster}
        controls
        autoPlay
        playsInline
        className="w-full h-full"
        onTimeUpdate={handleTimeUpdate}
        onEnded={onEnded}
        onError={() => {
          setIsBuffering(false);
          if (onError) onError();
        }}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onCanPlay={() => setIsBuffering(false)}
        onPause={() => setIsBuffering(false)}
        aria-label="Video player"
      >
        <track kind="captions" srcLang="en" label="English" />
        <track kind="captions" srcLang="bn" label="Bengali" />
      </video>
      
      {/* Custom Quality Selector overlay over controls */}
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
              {qualities.map((q) => (
                <button
                  key={q}
                  role="menuitem"
                  aria-labelledby="quality-label"
                  onClick={() => { 
                    setQuality(q); 
                    setShowSettings(false); 
                  }}
                  className={`text-left px-2 py-1.5 text-sm rounded ${quality === q ? 'bg-primary text-white' : 'hover:bg-white/10'}`}
                >
                  {q === "auto" ? "Auto" : q}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
});

AdaptivePlayer.displayName = "AdaptivePlayer";
