import { supabase } from '@/integrations/supabase/client';

export interface ProgressUpdate {
  userId: string;
  videoId: string;
  progressSeconds: number;
  progressPercent: number;
  completed: boolean;
}

const pending = new Map<string, ProgressUpdate>();
let flushTimer: any = null;

export function queueProgressUpdate(update: ProgressUpdate) {
  pending.set(update.videoId, update);
  
  if (!flushTimer) {
    flushTimer = setTimeout(flushProgressUpdates, 10000);
  }
}

async function flushProgressUpdates() {
  if (pending.size === 0) return;
  
  const updatesArray = Array.from(pending.values()).map(up => ({
    user_id: up.userId,
    video_id: up.videoId,
    progress_seconds: up.progressSeconds,
    progress_percent: up.progressPercent,
    completed: up.completed,
    watched_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));
  
  pending.clear();
  flushTimer = null;
  
  try {
    const { error } = await supabase.from('watch_history').upsert(updatesArray, {
      onConflict: 'user_id,video_id'
    });
    if (error) console.error("Batch progress upsert error:", error);
  } catch (err) {
    console.error("Batch progress error:", err);
  }
}

// Handle beforeunload to flush immediately
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (pending.size > 0) {
      // In beforeunload, fetch with keepalive is better if using raw requests,
      // but Supabase synchronous code might not finish. 
      // We will attempt it anyway.
      flushProgressUpdates();
    }
  });
}
