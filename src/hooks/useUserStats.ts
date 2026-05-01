import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '../contexts/AuthContext';

export interface UserStats {
  hoursWatched: number;
  completedCount: number;
  completedVideoIds: string[];
  inProgressVideos: { videoId: string; progress: number; lastWatched: number }[];
}

export function useUserStats() {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats>({
    hoursWatched: 0,
    completedCount: 0,
    completedVideoIds: [],
    inProgressVideos: []
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const fetchStats = async () => {
      try {
        const { data, error } = await supabase
          .from('watch_history')
          .select('*')
          .eq('user_id', user.id);

        if (error) throw error;

        let totalSeconds = 0;
        let completed = 0;
        const completedIds: string[] = [];
        const inProgress: any[] = [];

        data?.forEach(row => {
          totalSeconds += row.progress_seconds || 0;
          if (row.completed) {
            completed++;
            completedIds.push(row.video_id);
          } else if ((row.progress_percent || 0) > 0) {
            inProgress.push({
              videoId: row.video_id,
              progress: row.progress_seconds || 0,
              lastWatched: new Date(row.updated_at || row.watched_at).getTime()
            });
          }
        });

        setStats({
          hoursWatched: Math.round((totalSeconds / 3600) * 10) / 10,
          completedCount: completed,
          completedVideoIds: completedIds,
          inProgressVideos: inProgress
        });
      } catch (e) {
        console.error('Error fetching stats:', e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  return { stats, isLoading };
}
