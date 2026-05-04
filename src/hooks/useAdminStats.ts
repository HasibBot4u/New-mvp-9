import { useState, useEffect } from "react";

export interface AdminStats {
  totalUsers: number;
  activeUsersToday: number;
  totalVideos: number;
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
    // In a real implementation this would fetch from a consolidated stats endpoint.
    // We are mocking this structure based on the prompt requirements.
    const fetchStats = async () => {
      setIsLoading(true);
      try {
        // Mock data logic. In reality, we'd query Supabase tables:
        // const { count: totalUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        // const { count: totalVideos } = await supabase.from('videos').select('*', { count: 'exact', head: true });
        
        await new Promise(r => setTimeout(r, 600)); // fake delay
        
        setStats({
          totalUsers: 1450,
          activeUsersToday: 342,
          totalVideos: 430,
          revenueToday: 12500, // BDT
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
