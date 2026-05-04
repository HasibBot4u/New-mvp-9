import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export function useScreenProtection() {
  const [isProtected, setIsProtected] = useState(true);

  useEffect(() => {
    // Basic protection against keyboard shortcuts often used for DevTools/Screenshotting
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent PrintScreen
      if (e.key === 'PrintScreen') {
        navigator.clipboard.writeText('');
        toast.error('Screenshots are not allowed.');
        e.preventDefault();
      }

      // Prevent Ctrl+Shift+I, F12, Ctrl+Shift+C etc. for DevTools
      if (
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        e.key === 'F12'
      ) {
        e.preventDefault();
      }
    };

    // Detect visibility change (sometimes indicative of switching to a screen recording app)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsProtected(false); // Pause if hidden
      } else {
        setIsProtected(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Context menu prevention
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  return { isProtected };
}
