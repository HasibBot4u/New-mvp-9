import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { RefreshCw } from 'lucide-react';

export const UpdateToast = () => {
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    const handleUpdate = () => {
      setShowUpdate(true);
    };

    window.addEventListener('sw-update-available', handleUpdate);

    return () => {
      window.removeEventListener('sw-update-available', handleUpdate);
    };
  }, []);

  const handleRefresh = () => {
    // Optionally signal to the new SW to skip waiting, although our sw.js does this automatically.
    // So we just reload the page to get the new assets.
    window.location.reload();
  };

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-primary/95 text-primary-foreground p-4 rounded-xl shadow-xl flex flex-col gap-3 font-bangla border border-primary/20 backdrop-blur-sm max-w-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="font-semibold text-lg mb-1">Update Available</h4>
          <p className="text-sm opacity-90">A new version of the application is available. Refresh to apply the update.</p>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-1">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setShowUpdate(false)}
          className="bg-transparent border-primary-foreground/20 hover:bg-primary-foreground/10 text-primary-foreground"
        >
          Dismiss
        </Button>
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={handleRefresh}
          className="shadow-glow flex items-center gap-2"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh Now
        </Button>
      </div>
    </div>
  );
};
