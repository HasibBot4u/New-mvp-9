import React, { useEffect, useRef } from 'react';

interface VideoPlayerProps {
  src: string;
  isBlob?: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, isBlob = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.src = src;

    return () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
      if (isBlob) {
        URL.revokeObjectURL(src);
      }
    };
  }, [src, isBlob]);

  return (
    <div className="w-full bg-black rounded overflow-hidden">
      <video
        ref={videoRef}
        controls
        className="w-full h-auto max-h-screen"
        controlsList="nodownload"
      />
    </div>
  );
};
