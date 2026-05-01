import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '../contexts/AuthContext';

export function useVideoProgress(videoId: string, duration: number) {
  const { user } = useAuth();
  const [progress, setProgress] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const progressRef = useRef({ currentTime: 0, duration: 0 });
  const saveInterval = useRef<NodeJS.Timeout>();

  useEffect(() => {
    progressRef.current.duration = duration;
  }, [duration]);

  const loadProgressFromSupabase = useCallback(async () => {
    if (!user || !videoId) return 0;
    try {
      const { data, error } = await supabase
        .from('watch_history')
        .select('progress_seconds, completed, watch_count, watched_at')
        .eq('user_id', user.id)
        .eq('video_id', videoId)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error loading progress:', error);
        return 0;
      }
      
      if (data) {
        setIsCompleted(data.completed);
        return data.progress_seconds || 0;
      }
    } catch (e) {
      console.error('Exception loading progress:', e);
    }
    return 0;
  }, [user, videoId]);

  const hasIncrementedRef = useRef(false);

  useEffect(() => {
    hasIncrementedRef.current = false;
  }, [videoId]);

  const saveProgressToSupabase = useCallback(async (currentTime: number, currentDuration: number) => {
    if (!user || !videoId || currentDuration <= 0) return;
    
    try {
      const progressPercent = Math.round((currentTime / currentDuration) * 100);
      const completed = (currentTime / currentDuration) >= 0.95;
      
      const { error } = await supabase.from('watch_history').upsert({
        user_id: user.id,
        video_id: videoId,
        progress_percent: progressPercent,
        progress_seconds: Math.floor(currentTime),
        completed: completed,
        watched_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,video_id' });
      
      if (!error && !hasIncrementedRef.current && currentTime > 0) {
        hasIncrementedRef.current = true;
        try {
          await (supabase as any).rpc('increment_watch_count', {
            p_user_id: user.id,
            p_video_id: videoId
          });
        } catch {
          // ignore
        }
      }
      
      if (completed && !isCompleted) {
        setIsCompleted(true);
      }
    } catch (e) {
      console.error('Error saving progress:', e);
    }
  }, [user, videoId, isCompleted]);

  useEffect(() => {
    saveInterval.current = setInterval(() => {
      const { currentTime, duration } = progressRef.current;
      if (currentTime > 0 && duration > 0) {
        saveProgressToSupabase(currentTime, duration);
      }
    }, 10000);

    return () => {
      if (saveInterval.current) {
        clearInterval(saveInterval.current);
      }
    };
  }, [saveProgressToSupabase]);

  const handleTimeUpdate = useCallback((currentTime: number) => {
    setProgress(currentTime);
    progressRef.current.currentTime = currentTime;
  }, []);

  return {
    progress,
    isCompleted,
    handleTimeUpdate,
    loadProgressFromSupabase,
    saveProgressToSupabase
  };
}
