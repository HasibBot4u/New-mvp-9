import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AdminStats {
  total_users: number;
  active_users_today: number;
  videos_watched_today: number;
  errors_today: number;
  total_videos: number;
  revenueToday: number;
  usersOverTime: { date: string; signups: number }[];
  viewsBySubject: { name: string; value: number }[];
  watchTimeBin: { timeString: string; count: number }[];
  enrollmentUsage: { name: string; value: number }[];
  recentActivity: { id: string; type: string; title: string; time: string }[];
  telegramHealth: { channelsAllOk: boolean; totalChannels: number; okChannels: number };
}

export function useAdminStats() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      try {
        const { data } = await supabase.rpc('get_admin_stats');
        const dbStats = (data as any) || {};
        
        setStats({
          // Maps from get_admin_stats RPC
          total_users: dbStats?.total_users || 0,
          active_users_today: dbStats?.active_users_today || 0,
          videos_watched_today: dbStats?.videos_watched_today || 0,
          errors_today: dbStats?.errors_today || 0,
          total_videos: dbStats?.total_videos || 0,
          
          revenueToday: 0, // Mocked for now until payment tracking is added
          usersOverTime: [
            { date: "May 1", signups: 10 },
            { date: "May 2", signups: 25 },
            { date: "May 3", signups: 15 },
            { date: "May 4", signups: 30 },
            { date: "May 5", signups: 42 },
            { date: "May 6", signups: 28 },
            { date: "May 7", signups: 55 }
          ],
          viewsBySubject: [
            { name: "Physics", value: 400 },
            { name: "Chemistry", value: 300 },
            { name: "Math", value: 300 },
            { name: "Biology", value: 200 }
          ],
          watchTimeBin: [
            { timeString: "0-5m", count: 120 },
            { timeString: "5-15m", count: 300 },
            { timeString: "15-30m", count: 450 },
            { timeString: "30-60m", count: 200 },
            { timeString: "60m+", count: 80 }
          ],
          enrollmentUsage: [
            { name: "Batch23", value: 150 },
            { name: "Promo50", value: 80 },
            { name: "EidSpl", value: 120 }
          ],
          recentActivity: [
            { id: "1", type: "signup", title: "New user: mhasibul@edu", time: "2m ago" },
            { id: "2", type: "video", title: "Completed: Vectors Lec 1", time: "5m ago" },
            { id: "3", type: "payment", title: "Payment: BDT 500 (bkash)", time: "15m ago" },
            { id: "4", type: "alert", title: "Error: Drive rate limit", time: "1h ago" }
          ],
          telegramHealth: { channelsAllOk: true, totalChannels: 18, okChannels: 18 }
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchStats();
  }, []);

  return { stats, isLoading };
}
