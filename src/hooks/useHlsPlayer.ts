import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

export function useHlsPlayer(src: string, token: string | null, externalRef?: React.RefObject<HTMLVideoElement>) {
  const internalRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalRef || internalRef;

  const [hls, setHls] = useState<Hls | null>(null);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [levels, setLevels] = useState<{height: number, name: string}[]>([]);
  const [isBuffering, setIsBuffering] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src || !token) return;

    // Use HLS.js if supported
    if (Hls.isSupported() && src.includes(".m3u8")) {
      const hlsInstance = new Hls({
        maxBufferLength: 30, // preload next 30 seconds
        maxMaxBufferLength: 60,
        enableWorker: true,
        xhrSetup: (xhr) => {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          // Telegram DC selection could go here theoretically via headers
        }
      });

      hlsInstance.loadSource(src);
      hlsInstance.attachMedia(video);

      hlsInstance.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        setLevels(data.levels.map((l) => ({ height: l.height, name: `${l.height}p` })));
        setIsBuffering(false);
      });

      hlsInstance.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        setCurrentLevel(data.level);
      });
      
      hlsInstance.on(Hls.Events.BUFFER_APPENDING, () => setIsBuffering(true));
      hlsInstance.on(Hls.Events.BUFFER_APPENDED, () => setIsBuffering(false));

      setHls(hlsInstance);

      return () => {
        hlsInstance.destroy();
        setHls(null);
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Apple HLS (Safari)
      const url = new URL(src);
      url.searchParams.set("token", token);
      video.src = url.toString();
      setIsBuffering(false);
    } else {
      // Fallback
      if (!src.includes(".m3u8")) {
        const url = new URL(src);
        url.searchParams.set("token", token);
        video.src = url.toString();
      }
    }
  }, [src, token, videoRef]);

  const setQuality = (levelIndex: number) => {
    if (hls) {
      // -1 is AUTO
      // eslint-disable-next-line react-hooks/immutability
      hls.currentLevel = levelIndex;
    }
  };

  return { videoRef, hls, currentLevel, levels, setQuality, isBuffering };
}
