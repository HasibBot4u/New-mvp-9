import { useEffect, useState } from 'react';
import { AdaptivePlayer } from './AdaptivePlayer';
import { useScreenProtection } from '../../hooks/useScreenProtection';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedPlayerProps {
  src: string;
  token: string;
  title?: string;
  onTimeUpdate?: (time: number) => void;
  onLoadedMetadata?: (duration: number) => void;
  onEnded?: () => void;
  onError?: () => void;
}

export function ProtectedPlayer({ src, token, ...props }: ProtectedPlayerProps) {
  const { isProtected } = useScreenProtection();
  const { user } = useAuth();
  
  // Dynamic watermark state
  const [watermarkPos, setWatermarkPos] = useState({ top: '10%', left: '10%' });

  // Move watermark periodically
  useEffect(() => {
    const min = 10;
    const max = 80; // Keep within visible bounds
    
    const interval = setInterval(() => {
      const top = Math.floor(Math.random() * (max - min + 1) + min) + '%';
      const left = Math.floor(Math.random() * (max - min + 1) + min) + '%';
      setWatermarkPos({ top, left });
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, []);

  if (!isProtected) {
    return (
      <div className="w-full aspect-video bg-black flex items-center justify-center border border-destructive/20 rounded-lg">
        <p className="text-destructive font-medium flex flex-col items-center">
           <span>Playback paused.</span>
           <span className="text-sm font-normal opacity-80">Background apps or tools detected. Please close them to continue.</span>
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden group select-none">
      <AdaptivePlayer src={src} token={token} {...props} />
      
      {/* Dynamic Watermark Overlay */}
      {user && (
        <div 
          className="absolute z-50 pointer-events-none transition-all duration-[20s] ease-linear whitespace-nowrap opacity-30 mix-blend-overlay text-white font-mono text-sm sm:text-base md:text-lg select-none"
          style={{
            top: watermarkPos.top,
            left: watermarkPos.left,
            textShadow: '0 0 4px rgba(0,0,0,0.8)'
          }}
          aria-hidden="true"
        >
          {user.email} <br/> 
          ID: {user.id.substring(0, 8)} <br/>
          {new Date().toISOString()}
        </div>
      )}
      
      {/* Invisible overlay to block right click on the video itself */}
      <div 
        className="absolute inset-0 z-40" 
        onContextMenu={(e) => e.preventDefault()} 
        style={{ pointerEvents: 'none' }} /* keep player interactive, but we disabled context menu globally */
      />
    </div>
  );
}
