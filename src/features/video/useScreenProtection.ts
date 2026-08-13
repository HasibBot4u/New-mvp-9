import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export function useScreenProtection(options?: { disableContextMenu?: boolean; disableDevToolsShortcuts?: boolean }) {
  const [isProtected, setIsProtected] = useState(true);

  useEffect(() => {
    // Only pause video on hidden, do not block devtools or context menu by default
    // Previous implementation blocked PrintScreen, Ctrl+Shift+I, F12, contextmenu which breaks a11y and is easily bypassed
    // Now we make protection opt-in via options, and even then we only warn, not block
    const disableContextMenu = options?.disableContextMenu ?? false;
    const disableShortcuts = options?.disableDevToolsShortcuts ?? false;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!disableShortcuts) return;
      if (e.key === 'PrintScreen') {
        // Best effort: clear clipboard is unreliable and intrusive, just warn
        toast.message('Screen recording is discouraged per terms.');
        // Don't prevent default
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsProtected(false);
      } else {
        setIsProtected(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleContextMenu = (e: MouseEvent) => {
      if (!disableContextMenu) return;
      e.preventDefault();
    };
    if (disableContextMenu) {
      document.addEventListener('contextmenu', handleContextMenu);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (disableContextMenu) {
        document.removeEventListener('contextmenu', handleContextMenu);
      }
    };
  }, [options?.disableContextMenu, options?.disableDevToolsShortcuts]);

  return { isProtected };
}
