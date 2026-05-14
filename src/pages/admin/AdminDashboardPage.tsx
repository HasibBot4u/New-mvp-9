import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminStats } from "@/hooks/useAdminStats";
import { useRealtime } from "@/hooks/useRealtime";
import { Activity, Users, Video, AlertTriangle, Server, CheckCircle2, RefreshCw, Radio } from "lucide-react";
import { 
  XAxis, YAxis, Tooltip, ResponsiveContainer, 
  BarChart, Bar, CartesianGrid, Rectangle
} from "recharts";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export default function AdminDashboardPage() {
  const { stats, isLoading: statsLoading } = useAdminStats();
  useRealtime();

  const [metrics, setMetrics] = useState<any>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchMetrics = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) return;

      const baseUrl = import.meta.env.VITE_API_BASE_URL || "https://nexusedu-backend-0bjq.onrender.com";
      const res = await fetch(`${baseUrl}/api/admin/dashboard/metrics`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setMetrics(await res.json());
        setLastRefreshed(new Date());
      }
    } catch (err) {
      console.error("Failed to fetch dashboard metrics", err);
    } finally {
      setMetricsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  if (statsLoading || metricsLoading && !metrics) {
    return <div className="animate-pulse space-y-4">
      <div className="h-8 w-48 bg-white/5 rounded"></div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-32 bg-white/5 rounded-xl"></div>)}
      </div>
    </div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
          <p className="text-foreground-muted text-sm mt-1">Real-time metrics and system health.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-foreground-muted flex items-center mr-2">
            {metricsLoading ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-500" />}
            Last updated: {lastRefreshed.toLocaleTimeString()}
          </span>
          <Button variant="outline" size="sm" onClick={() => { setMetricsLoading(true); fetchMetrics(); }}>
            <RefreshCw className={`w-4 h-4 mr-2 ${metricsLoading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-surface/40 border-white/5 backdrop-blur-xl relative overflow-hidden group dark:bg-gray-800 dark:border-gray-700">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-foreground-muted dark:text-white">Live Users</CardTitle>
            <div className="relative">
              <span className="absolute -inset-1 rounded-full bg-emerald-500/20 animate-ping"></span>
              <Activity className="h-4 w-4 text-emerald-400 relative" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono dark:text-white">{metrics?.live_users || 0}</div>
            <p className="text-xs text-foreground-dim mt-1 dark:text-gray-300">Users currently online</p>
          </CardContent>
        </Card>
        
        <Card className="bg-surface/40 border-white/5 backdrop-blur-xl dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-foreground-muted dark:text-white">Active Streams</CardTitle>
            <Radio className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-blue-400 dark:text-white">{metrics?.active_streams || 0}</div>
            <p className="text-xs text-foreground-dim mt-1 dark:text-gray-300">Concurrent video plays</p>
          </CardContent>
        </Card>

        <Card className="bg-surface/40 border-white/5 backdrop-blur-xl dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-foreground-muted dark:text-white">Total CPU Usage</CardTitle>
            <Server className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono dark:text-white">{metrics?.server_resources?.cpu_percent || 0}%</div>
            <div className="w-full bg-white/10 h-1.5 mt-2 rounded-full overflow-hidden dark:bg-gray-700">
               <div className="bg-purple-500 h-full rounded-full transition-all duration-500" style={{ width: `${metrics?.server_resources?.cpu_percent || 0}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface/40 border-white/5 backdrop-blur-xl dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-foreground-muted dark:text-white">Memory Usage</CardTitle>
            <Server className="h-4 w-4 text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono dark:text-white">{(metrics?.server_resources?.memory_percent || 0).toFixed(1)}%</div>
            <div className="w-full bg-white/10 h-1.5 mt-2 rounded-full overflow-hidden dark:bg-gray-700">
               <div className="bg-orange-500 h-full rounded-full transition-all duration-500" style={{ width: `${metrics?.server_resources?.memory_percent || 0}%` }} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 lg:col-span-2 bg-surface/40 border-white/5 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Video className="w-4 h-4 text-primary" /> Popular Videos Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {metrics?.popular_videos?.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.popular_videos} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" horizontal={false} />
                    <XAxis type="number" stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis dataKey="title" type="category" stroke="#ffffff80" fontSize={11} tickLine={false} axisLine={false} width={150} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px' }}
                      cursor={{ fill: '#ffffff05' }}
                    />
                    <Bar dataKey="views" fill="#a855f7" radius={[0, 4, 4, 0]} barSize={24} activeBar={<Rectangle fill="#c084fc" />} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-foreground-muted">No data available</div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-surface/40 border-white/5 backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Telegram Channel Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {metrics?.telegram_health?.map((ch: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-black/20">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-sm font-medium">{ch.channel_name}</span>
                    </div>
                    <div className="text-xs text-foreground-muted">{ch.latency}</div>
                  </div>
                ))}
                {(!metrics?.telegram_health || metrics.telegram_health.length === 0) && (
                   <div className="text-sm text-foreground-muted p-4 text-center">No channels configured</div>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-surface/40 border-white/5 backdrop-blur-xl flex-1">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Recent Errors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {metrics?.recent_errors?.map((err: any) => (
                  <div key={err.id} className="text-sm p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <div className="font-medium text-red-200 mb-1">{err.message}</div>
                    <div className="text-xs text-red-400/70">{err.time}</div>
                  </div>
                ))}
                {(!metrics?.recent_errors || metrics.recent_errors.length === 0) && (
                   <div className="text-sm text-foreground-muted p-4 text-center">No errors reported</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-surface/40 border-white/5 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Recent Signups</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics?.recent_signups?.map((user: any) => (
                <div key={user.id} className="flex items-center gap-4 pb-4 border-b border-white/5 last:border-0 last:pb-0">
                  <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                    {(user.display_name || user.email || "U").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground font-medium truncate">{user.display_name || "Unknown User"}</p>
                    <p className="text-xs text-foreground-dim truncate">{user.email}</p>
                  </div>
                  <div className="text-xs text-foreground-muted shrink-0">
                    {new Date(user.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
              {(!metrics?.recent_signups || metrics.recent_signups.length === 0) && (
                 <div className="text-sm text-foreground-muted p-8 text-center border border-dashed border-white/10 rounded-lg">No recent signups found</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface/40 border-white/5 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-base">System Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
              {stats?.recentActivity?.slice(0, 5).map((act: any) => (
                <div key={act.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-surface shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow sm:shadow-md ${act.type === 'signup' ? 'text-blue-400' : 'text-purple-400'}`}>
                    <Activity className="w-4 h-4" />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-white/5 bg-surface/50 shadow">
                    <div className="font-bold text-sm text-foreground">{act.title}</div>
                    <div className="text-xs text-foreground-muted mt-1">{act.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}

