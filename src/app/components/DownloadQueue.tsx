import { useState, useCallback } from 'react';
import { X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DownloadItem {
  id: string;
  videoId: string;
  title: string;
  progress: number;
  status: 'pending' | 'downloading' | 'completed' | 'error';
}

export function useDownloadQueue() {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  
  const addDownload = useCallback((video: any) => {
    setDownloads(prev => [...prev, {
      id: crypto.randomUUID(),
      videoId: video.id,
      title: video.title,
      progress: 0,
      status: 'pending'
    }]);
  }, []);
  
  const cancelAll = useCallback(() => setDownloads([]), []);
  const cancelOne = useCallback((id: string) => {
    setDownloads(prev => prev.filter(d => d.id !== id));
  }, []);
  
  return { downloads, addDownload, cancelAll, cancelOne };
}

export function DownloadQueuePanel({ downloads, onCancelAll, onCancelOne }: any) {
  if (downloads.length === 0) return null;
  
  return (
    <div className="fixed bottom-20 right-4 w-80 bg-background border rounded-lg shadow-lg z-50">
      <div className="flex items-center justify-between p-3 border-b">
        <h4 className="font-semibold text-sm">Downloads ({downloads.length})</h4>
        <Button variant="ghost" size="sm" onClick={onCancelAll}>
          <X className="w-4 h-4" />
        </Button>
      </div>
      <div className="max-h-60 overflow-y-auto">
        {downloads.map((d: DownloadItem) => (
          <div key={d.id} className="p-3 border-b last:border-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm truncate flex-1">{d.title}</span>
              <Button variant="ghost" size="sm" onClick={() => onCancelOne(d.id)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${d.progress}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">{d.progress}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
