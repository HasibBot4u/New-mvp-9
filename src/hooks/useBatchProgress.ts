import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface ProgressUpdate {
  video_id: string;
  progress: number;
  duration: number;
}

export function useBatchProgress() {
  const pendingUpdates = useRef<Map<string, { progress: number, duration: number, timestamp: number }>>(new Map());
  const [pendingCount, setPendingCount] = useState(0);

  const flush = useCallback(async () => {
    if (pendingUpdates.current.size === 0) return;

    const updates: ProgressUpdate[] = Array.from(pendingUpdates.current.entries()).map(([video_id, data]) => ({
      video_id,
      progress: data.progress,
      duration: data.duration
    }));

    // Clear now to accumulate new ones during the API call
    pendingUpdates.current.clear();
    setPendingCount(0);

    toast('Saving progress...', { id: 'progress-save', duration: 1000 });

    const sendBatch = async (retry: boolean) => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
        const res = await fetch(`${API_BASE}/api/progress/batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ updates }),
          keepalive: true
        });

        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }
      } catch (err) {
        if (retry) {
          setTimeout(() => sendBatch(false), 2000);
        } else {
          console.error('Failed to save progress batch after retry:', err);
        }
      }
    };

    sendBatch(true);
  }, []);

  const updateProgress = useCallback((videoId: string, progress: number, duration: number) => {
    pendingUpdates.current.set(videoId, { progress, duration, timestamp: Date.now() });
    setPendingCount(pendingUpdates.current.size);
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      flush();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    const interval = setInterval(() => {
      flush();
    }, 10000);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(interval);
      flush();
    };
  }, [flush]);

  return { updateProgress, flush, pendingCount };
}
