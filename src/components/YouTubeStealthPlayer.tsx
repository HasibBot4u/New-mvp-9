import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';

export interface YouTubeStealthPlayerRef {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  setVolume: (v: number) => void; // 0 to 1
  setMuted: (m: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

interface Props {
  videoId: string;
  onReady?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onTimeUpdate?: (time: number) => void;
  onError?: () => void;
  onBuffering?: (isBuffering: boolean) => void;
  className?: string; // Add className prop
}

export const YouTubeStealthPlayer = forwardRef<YouTubeStealthPlayerRef, Props>(
  ({ videoId, onReady, onPlay, onPause, onEnded, onTimeUpdate, onError, onBuffering, className }, ref) => {
    const playerRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isApiReady, setIsApiReady] = useState(false);
    const timeUpdateInterval = useRef<ReturnType<typeof setInterval>>();

    // 1. Load YouTube IFrame API
    useEffect(() => {
      if (!(window as any).YT) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
        
        (window as any).onYouTubeIframeAPIReady = () => {
          setIsApiReady(true);
        };
      } else {
        setIsApiReady(true);
      }
    }, []);

    // 2. Initialize Player
    useEffect(() => {
      if (!isApiReady || !videoId || !containerRef.current) return;

      playerRef.current = new (window as any).YT.Player(containerRef.current, {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
          controls: 0,           // Hide default controls
          disablekb: 1,          // Disable keyboard shortcuts
          fs: 0,                 // Hide fullscreen button
          iv_load_policy: 3,     // Hide annotations
          modestbranding: 1,     // Minimal branding
          rel: 0,                // Don't show related videos
          showinfo: 0,
          origin: window.location.origin,
          playsinline: 1,        // iOS inline playback
        },
        events: {
          onReady: () => {
            onReady?.();
          },
          onStateChange: (event: any) => {
            const state = event.data;
            const YT = (window as any).YT;
            
            if (state === YT.PlayerState.PLAYING) {
              onBuffering?.(false);
              onPlay?.();
              timeUpdateInterval.current = setInterval(() => {
                const time = playerRef.current?.getCurrentTime() || 0;
                onTimeUpdate?.(time);
              }, 1000);
            } else if (state === YT.PlayerState.PAUSED) {
              onPause?.();
              if (timeUpdateInterval.current) clearInterval(timeUpdateInterval.current);
            } else if (state === YT.PlayerState.ENDED) {
              onEnded?.();
              if (timeUpdateInterval.current) clearInterval(timeUpdateInterval.current);
            } else if (state === YT.PlayerState.BUFFERING) {
              onBuffering?.(true);
            }
          },
          onError: () => {
            onError?.();
          }
        },
      });

      return () => {
        if (timeUpdateInterval.current) clearInterval(timeUpdateInterval.current);
        if (playerRef.current) {
          playerRef.current.destroy();
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isApiReady, videoId]);

    // 3. Expose Methods
    useImperativeHandle(ref, () => ({
      play: () => playerRef.current?.playVideo(),
      pause: () => playerRef.current?.pauseVideo(),
      seekTo: (seconds) => playerRef.current?.seekTo(seconds, true),
      setVolume: (v) => playerRef.current?.setVolume(v * 100),
      setMuted: (m) => m ? playerRef.current?.mute() : playerRef.current?.unMute(),
      setPlaybackRate: (rate) => playerRef.current?.setPlaybackRate(rate),
      getCurrentTime: () => playerRef.current?.getCurrentTime() || 0,
      getDuration: () => playerRef.current?.getDuration() || 0,
    }));

    return (
      <div className={`relative w-full h-full ${className || ''}`}>
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />
      </div>
    );
  }
);

YouTubeStealthPlayer.displayName = 'YouTubeStealthPlayer';
