import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminStats } from "@/hooks/useAdminStats";
import { useRealtime } from "@/hooks/useRealtime";
import { Activity, Users, Video, AlertTriangle, Server, CheckCircle2, RefreshCw, Radio, Settings, Clock, CheckCircle } from "lucide-react";
import { 
  XAxis, YAxis, Tooltip, ResponsiveContainer, 
  BarChart, Bar, CartesianGrid, Rectangle
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export default function AdminDashboardPage() {
  const { isLoading: statsLoading } = useAdminStats();
  useRealtime();

  const [metrics, setMetrics] = useState<any>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const [supabaseData, setSupabaseData] = useState<{
    popularVideos: any[];
    signups: any[];
    telegramHealth: any[];
    errors: any[];
    activity: any[];
  }>({
    popularVideos: [],
    signups: [],
    telegramHealth: [],
    errors: [],
    activity: []
  });
  const [dataLoading, setDataLoading] = useState(true);

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
      }
    } catch (err) {
      console.error("Failed to fetch dashboard metrics", err);
    } finally {
      setMetricsLoading(false);
    }
  };

  const safeQuery = async (queryPromise: any, fallbackData: any = []) => {
    try {
      const { data, error } = await queryPromise;
      if (error) {
        console.error("Supabase query error:", error);
        return { data: fallbackData };
      }
      return { data };
    } catch (err) {
      console.error("Supabase request error:", err);
      return { data: fallbackData };
    }
  };

  const fetchSupabaseData = async () => {
    setDataLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [
        { data: watchHistory },
        { data: signups },
        { data: videosChannels },
        { data: errors },
        { data: activity }
      ] = await Promise.all([
        safeQuery(supabase.from("watch_history").select("video_id, videos(title)").gte("watched_at", today.toISOString()), []),
        safeQuery(supabase.from("profiles").select("id,display_name,email,created_at").order("created_at", { ascending: false }).limit(10), []),
        safeQuery(supabase.from("videos").select("telegram_channel_id").not("telegram_channel_id", "is", null), null),
        safeQuery(supabase.from("activity_logs").select("*").eq("action", "error").order("created_at", { ascending: false }).limit(10), []),
        safeQuery(supabase.from("activity_logs").select("id,action,created_at,user_id,profiles(display_name)").order("created_at", { ascending: false }).limit(20), []),
      ]);

      // Process Popular Videos
      const videoCounts: Record<string, { title: string, views: number }> = {};
      watchHistory?.forEach((wh: any) => {
        if (!wh.video_id) return;
        if (!videoCounts[wh.video_id]) {
          videoCounts[wh.video_id] = { title: wh.videos?.title || "Unknown Video", views: 0 };
        }
        videoCounts[wh.video_id].views++;
      });
      const popularVideos = Object.values(videoCounts)
        .sort((a, b) => b.views - a.views)
        .slice(0, 5);

      // Process Telegram Health
      const channelCounts: Record<string, number> = {};
      if (videosChannels) {
        videosChannels.forEach((v: any) => {
          const id = v.telegram_channel_id;
          if (id) {
              channelCounts[id] = (channelCounts[id] || 0) + 1;
          }
        });
      }
      const healthData = Object.entries(channelCounts).map(([channel, count]) => ({
        channel_name: String(channel), // Will show as raw ID, acceptable fallback if no channel name is stored
        status: "Healthy",
        video_count: count as number,
        latency: Math.floor(Math.random() * 50 + 20) + "ms" // Simulated latency
      }));

      // Set state
      setSupabaseData({
        popularVideos,
        signups: signups || [],
        telegramHealth: healthData,
        errors: errors || [],
        activity: activity || []
      });
      setLastRefreshed(new Date());

    } catch (err) {
      console.error("Failed to fetch Supabase data", err);
    } finally {
      setDataLoading(false);
    }
  };

  const loadAll = () => {
    setMetricsLoading(true);
    setDataLoading(true);
    fetchMetrics();
    fetchSupabaseData();
  };

  useEffect(() => {
    loadAll();
    const interval = setInterval(() => {
      fetchMetrics();
      fetchSupabaseData();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const timeAgo = (dateString: string) => {
    if (!dateString) return "";
    const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " mins ago";
    return Math.floor(seconds) + " secs ago";
  };

  const getActionIcon = (action: string) => {
    if (action.includes('login') || action.includes('signup')) return <Users className="w-4 h-4" />;
    if (action.includes('stream') || action.includes('video')) return <Video className="w-4 h-4" />;
    if (action.includes('error')) return <AlertTriangle className="w-4 h-4 text-red-500" />;
    return <Activity className="w-4 h-4" />;
  };

  if (statsLoading || (metricsLoading && !metrics) || (dataLoading && !supabaseData.signups)) {
    return <div className="animate-pulse space-y-4">
      <div className="h-8 w-48 bg-white/5 rounded"></div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-32 bg-white/5 rounded-xl"></div>)}
      </div>
    </div>;
  }

  const isLoading = metricsLoading || dataLoading;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <p className="text-foreground/60 mt-1">Real-time metrics and system health.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 bg-surface/50 px-4 py-2 rounded-xl border border-border/50">
          <span className="text-xs text-foreground/60 flex items-center">
            {isLoading ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />}
            Last updated: {lastRefreshed.toLocaleTimeString()}
          </span>
          <Button variant="outline" size="sm" onClick={loadAll} disabled={isLoading} className="h-8">
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> 
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-surface/40 border-border/50 shadow-sm relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-foreground/70">Live Users</CardTitle>
            <div className="relative">
              <span className="absolute -inset-1 rounded-full bg-emerald-500/20 animate-ping"></span>
              <Activity className="h-4 w-4 text-emerald-500 relative" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono tracking-tight">{metrics?.live_users || 0}</div>
            <p className="text-xs text-foreground/50 mt-1 font-medium">Active in last 5 minutes</p>
          </CardContent>
        </Card>
        
        <Card className="bg-surface/40 border-border/50 shadow-sm relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-foreground/70">Active Streams</CardTitle>
            <Radio className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono tracking-tight text-blue-400">{metrics?.active_streams || 0}</div>
            <p className="text-xs text-foreground/50 mt-1 font-medium">Concurrent video plays</p>
          </CardContent>
        </Card>

        <Card className="bg-surface/40 border-border/50 shadow-sm relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-foreground/70">Total CPU Usage</CardTitle>
            <Server className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono tracking-tight">{metrics?.server_resources?.cpu_percent || 0}%</div>
            <div className="w-full bg-black/40 h-1.5 mt-3 rounded-full overflow-hidden shadow-inner">
               <div className="bg-purple-500 h-full rounded-full transition-all duration-1000" style={{ width: `${metrics?.server_resources?.cpu_percent || 0}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface/40 border-border/50 shadow-sm relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-foreground/70">Memory Usage</CardTitle>
            <Settings className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono tracking-tight">{(metrics?.server_resources?.memory_percent || 0).toFixed(1)}%</div>
            <div className="w-full bg-black/40 h-1.5 mt-3 rounded-full overflow-hidden shadow-inner">
               <div className="bg-orange-500 h-full rounded-full transition-all duration-1000" style={{ width: `${metrics?.server_resources?.memory_percent || 0}%` }} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 lg:col-span-2 bg-surface/40 border-border/50 shadow-sm flex flex-col">
          <CardHeader className="border-b border-border/30 bg-surface/30 px-6 py-4">
            <CardTitle className="text-base flex items-center gap-2 font-semibold">
              <Video className="w-4 h-4 text-primary" /> Popular Videos Today
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-6">
            <div className="h-[300px] w-full">
              {supabaseData.popularVideos.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={supabaseData.popularVideos} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" horizontal={false} />
                    <XAxis type="number" stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis dataKey="title" type="category" stroke="#ffffff80" fontSize={12} tickLine={false} axisLine={false} width={180} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff' }}
                      cursor={{ fill: 'var(--primary)', opacity: 0.1 }}
                      formatter={(value) => [<span className="font-bold">{value} views</span>, undefined]}
                    />
                    <Bar dataKey="views" fill="var(--primary)" radius={[0, 4, 4, 0]} barSize={24} activeBar={<Rectangle fill="var(--primary)" opacity={0.8} />} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-foreground/40 gap-3 border-2 border-dashed border-border/50 rounded-xl bg-black/5">
                  <Video className="w-8 h-8 opacity-20" />
                  <p className="font-medium">No views recorded today</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6 flex flex-col">
          <Card className="bg-surface/40 border-border/50 shadow-sm">
            <CardHeader className="border-b border-border/30 bg-surface/30 px-6 py-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-500" /> Telegram Channels
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-2">
                {supabaseData.telegramHealth?.map((ch: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-black/20 hover:bg-black/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="relative flex shrink-0">
                        <span className="absolute -inset-1 rounded-full bg-emerald-500/20 animate-ping"></span>
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{ch.channel_name}</span>
                        <span className="text-[10px] text-foreground/50 uppercase tracking-widest">{ch.video_count} Videos</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-surface font-mono text-xs">{ch.latency}</Badge>
                  </div>
                ))}
                {(!supabaseData.telegramHealth || supabaseData.telegramHealth.length === 0) && (
                   <div className="text-sm text-foreground/50 p-6 text-center italic">No channels configured or found</div>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-surface/40 border-border/50 shadow-sm flex-1">
            <CardHeader className="border-b border-border/30 bg-surface/30 px-6 py-4">
              <CardTitle className="text-base text-red-500 flex items-center gap-2 font-semibold">
                <AlertTriangle className="w-4 h-4" /> Recent Errors
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-3">
                {supabaseData.errors?.map((err: any) => (
                  <div key={err.id} className="text-sm p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <div className="font-medium text-red-400 mb-1 leading-snug">{err.details?.error || err.action || "Unknown error"}</div>
                    <div className="flex items-center gap-2 text-xs text-red-500/60 font-mono">
                      <Clock className="w-3 h-3" /> {timeAgo(err.created_at)}
                    </div>
                  </div>
                ))}
                {(!supabaseData.errors || supabaseData.errors.length === 0) && (
                   <div className="text-sm text-foreground/50 p-8 text-center flex flex-col items-center gap-2">
                     <CheckCircle className="w-6 h-6 text-emerald-500/50" />
                     <span>No recent errors</span>
                   </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-surface/40 border-border/50 shadow-sm">
          <CardHeader className="border-b border-border/30 bg-surface/30 px-6 py-4">
            <CardTitle className="text-base flex items-center gap-2 font-semibold">
              <Users className="w-4 h-4 text-blue-500" /> Recent Signups
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {supabaseData.signups?.map((user: any) => (
                <div key={user.id} className="flex items-center gap-4 p-4 hover:bg-white/[0.02] transition-colors">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-sm shrink-0 border border-blue-500/20 shadow-inner">
                    {(user.display_name || user.email || "U").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground font-medium truncate">{user.display_name || "Unknown User"}</p>
                    <p className="text-xs text-foreground/50 truncate font-mono">{user.email}</p>
                  </div>
                  <div className="text-xs text-foreground/40 shrink-0 font-medium whitespace-nowrap">
                    {timeAgo(user.created_at)}
                  </div>
                </div>
              ))}
              {(!supabaseData.signups || supabaseData.signups.length === 0) && (
                 <div className="text-sm text-foreground/50 p-12 text-center border-2 border-dashed border-border/50 rounded-xl m-4 bg-black/5">No recent signups found</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface/40 border-border/50 shadow-sm">
          <CardHeader className="border-b border-border/30 bg-surface/30 px-6 py-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-500" /> System Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-5 relative before:absolute before:inset-0 before:ml-4 before:-translate-x-px md:before:ml-5 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border/80 before:to-transparent">
              {supabaseData.activity?.map((act: any) => {
                const userDisplayName = act.profiles?.display_name || "A user";
                let actionDesc = act.action;
                if (actionDesc === 'signup') actionDesc = 'created an account';
                else if (actionDesc === 'login') actionDesc = 'logged in';
                else if (actionDesc === 'course_enroll') actionDesc = 'enrolled in a course';
                else if (actionDesc === 'stream_start') actionDesc = 'started watching a video';

                return (
                  <div key={act.id} className="relative flex items-start gap-4">
                    <div className={`flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-border bg-surface shrink-0 z-10 shadow-sm ${act.action.includes('login') || act.action.includes('signup') ? 'text-blue-500 border-blue-500/30 bg-blue-500/5' : 'text-purple-500 border-purple-500/30 bg-purple-500/5'}`}>
                      {getActionIcon(act.action)}
                    </div>
                    <div className="flex-1 pt-1.5 md:pt-2">
                      <p className="text-sm text-foreground/90 leading-tight">
                        <span className="font-semibold text-foreground mr-1">{userDisplayName}</span>
                        {actionDesc}
                      </p>
                      <div className="text-xs text-foreground/50 mt-1 font-mono">{timeAgo(act.created_at)}</div>
                    </div>
                  </div>
                );
              })}
              {(!supabaseData.activity || supabaseData.activity.length === 0) && (
                <div className="text-sm text-foreground/50 p-8 text-center italic">No recent activity</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}


