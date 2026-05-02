import { useEffect, useState } from "react";
import { Users, BookOpen, PlayCircle, KeyRound, Activity, RefreshCw, Zap, Calendar, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCatalog } from "@/contexts/CatalogContext";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { useQuery } from "@tanstack/react-query";

interface Stats {
  total_users: number; total_videos: number; total_subjects: number; total_chapters: number;
  active_users_today: number; new_signups_this_week: number;
  total_watch_seconds: number; enrollment_codes_used: number;
}
interface ActivityRow {
  id: string; action: string; created_at: string; user_id: string | null;
  profiles?: { display_name: string | null } | null;
}

interface PendingEnrollment {
  id: string; user_id: string; chapter_id: string; transaction_id: string; amount: number; payment_method: string; status: string; created_at: string;
  profiles?: { display_name: string | null } | null;
  chapters?: { name: string; name_bn: string | null } | null;
}

const fetchDashboardData = async () => {
  const since = startOfDay(subDays(new Date(), 6)).toISOString();
  
  const [s, w, a, enr, allActivities] = await Promise.all([
    supabase.rpc("get_admin_stats"),
    supabase.from("watch_history").select("watched_at").gte("watched_at", since),
    supabase.from("activity_logs")
      .select("id, action, created_at, user_id, profiles(display_name)")
      .order("created_at", { ascending: false }).limit(10),
    supabase.from("pending_enrollments" as any)
      .select("*, profiles(display_name), chapters(name, name_bn)")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase.from("activity_logs")
      .select("created_at, user_id, action")
      .gte("created_at", since)
  ]);

  const buckets: Record<string, { dau: Set<string>; watches: number; enrollments: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const d = format(subDays(new Date(), i), "MM/dd");
    buckets[d] = { dau: new Set(), watches: 0, enrollments: 0 };
  }

  for (const r of (w.data ?? []) as { watched_at: string }[]) {
    const d = format(new Date(r.watched_at), "MM/dd");
    if (d in buckets) buckets[d].watches++;
  }

  for (const log of (allActivities.data ?? []) as any[]) {
    const d = format(new Date(log.created_at), "MM/dd");
    if (d in buckets) {
      if (log.user_id) buckets[d].dau.add(log.user_id);
      if (log.action === "enrolled_chapter") buckets[d].enrollments++;
    }
  }

  const chart = Object.entries(buckets).map(([day, val]) => ({
    day,
    watchViews: val.watches,
    dau: val.dau.size,
    enrollments: val.enrollments,
  }));

  return {
    stats: (s.data as unknown as Stats) || null,
    chart,
    activity: (a.data ?? []) as unknown as ActivityRow[],
    pending: (enr.data ?? []) as unknown as PendingEnrollment[],
  };
};

export default function AdminDashboardPage() {
  const { toast } = useToast();
  const { refresh: refreshCatalog } = useCatalog();
  const [health, setHealth] = useState<boolean | null>(null);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['adminDashboard'],
    queryFn: fetchDashboardData,
  });

  const checkBackend = async () => {
    try {
      const url = (import.meta.env.VITE_API_BASE_URL as string).replace(/\/+$/, "");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000); // 10 seconds
      const res = await fetch(url + "/api/health", { signal: controller.signal });
      clearTimeout(timer);
      setHealth(res.ok);
    } catch { setHealth(false); }
  };

  const warmup = async () => {
    try {
      const url = (import.meta.env.VITE_API_BASE_URL as string).replace(/\/+$/, "");
      const res = await fetch(url + "/api/warmup", { method: "POST" });
      if (res.ok) { toast({ title: "ক্যাটালগ রিফ্রেশ হয়েছে" }); refreshCatalog(); }
      else toast({ title: "ব্যর্থ", variant: "destructive" });
    } catch (e: any) { toast({ title: "ব্যর্থ", description: e.message, variant: "destructive" }); }
  };

  useEffect(() => { 
    checkBackend();
  }, []);

  const stats = data?.stats;
  const chart = data?.chart ?? [];
  const activity = data?.activity ?? [];
  const pending = data?.pending ?? [];
  const watchHours = stats ? Math.round(stats.total_watch_seconds / 360) / 10 : 0;
  const isRefreshing = isLoading || isRefetching;

  const handleApprove = async (e: PendingEnrollment) => {
    const { error: err1 } = await supabase.from("pending_enrollments" as any).update({ status: "approved" }).eq("id", e.id);
    if (!err1) {
      const { error: err2 } = await supabase.from("chapter_access" as any).insert({ user_id: e.user_id, chapter_id: e.chapter_id, granted_at: new Date().toISOString() });
      if (!err2) {
        await supabase.from("notifications" as any).insert({
          user_id: e.user_id,
          title: "Enrollment Approved",
          title_bn: "এনরোলমেন্ট অ্যাপ্রুভ হয়েছে",
          body: `Your payment of ৳${e.amount} has been verified and access granted to the chapter.`,
          body_bn: `আপনার ৳${e.amount} পেমেন্ট ভেরিফাই হয়েছে এবং আপনার কোর্সের অ্যাক্সেস দেয়া হয়েছে।`,
          type: "system"
        });
        toast({ title: "Approved" });
        refetch();
      }
    }
  };

  const handleReject = async (id: string) => {
    const { error } = await supabase.from("pending_enrollments" as any).update({ status: "rejected" }).eq("id", id);
    if (!error) { toast({ title: "Rejected" }); refetch(); }
  };

  const tiles = [
    { label: "মোট ব্যবহারকারী", value: stats?.total_users ?? 0, icon: Users, color: "from-primary to-primary-glow" },
    { label: "ভিডিও", value: stats?.total_videos ?? 0, icon: PlayCircle, color: "from-accent to-accent/70" },
    { label: "বিষয়", value: stats?.total_subjects ?? 0, icon: BookOpen, color: "from-info to-info/70" },
    { label: "অধ্যায়", value: stats?.total_chapters ?? 0, icon: BookOpen, color: "from-success to-success/70" },
    { label: "আজ সক্রিয়", value: stats?.active_users_today ?? 0, icon: Activity, color: "from-success to-success/60" },
    { label: "এ সপ্তাহে নতুন", value: stats?.new_signups_this_week ?? 0, icon: Calendar, color: "from-warning to-warning/60" },
    { label: "মোট দেখার সময়", value: `${watchHours} ঘ`, icon: Clock, color: "from-primary to-accent" },
    { label: "কোড ব্যবহার", value: stats?.enrollment_codes_used ?? 0, icon: KeyRound, color: "from-warning to-warning/70" },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-primary mb-2">Admin Console</p>
          <h1 className="font-display text-3xl md:text-4xl font-bold">Mission control</h1>
          <p className="text-foreground-dim mt-1">প্ল্যাটফর্মের লাইভ স্ন্যাপশট।</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => refetch()} disabled={isRefreshing} className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-white/5 hover:bg-white/10 text-sm">
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} /> পরিসংখ্যান রিফ্রেশ করুন
          </button>
          <button onClick={warmup} className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-warning/20 text-warning hover:bg-warning/30 text-sm">
            <Zap className="w-4 h-4" /> ক্যাটালগ রিফ্রেশ করুন
          </button>
          <div className={`inline-flex items-center gap-2 h-10 px-4 rounded-full text-sm ${health ? "bg-success/15 text-success" : health === false ? "bg-destructive/15 text-destructive" : "bg-white/5 text-foreground-muted"}`}>
            <Activity className="w-4 h-4" /> {health === null ? "চেক করা হচ্ছে…" : health ? "✅ ব্যাকএন্ড অনলাইন" : "❌ ব্যাকএন্ড অফলাইন"}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map(t => (
          <div key={t.label} className="relative overflow-hidden rounded-2xl border border-white/5 bg-surface p-5 group hover:border-primary/30 transition-all">
            <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full bg-gradient-to-br ${t.color} opacity-20 blur-2xl group-hover:opacity-40 transition-opacity`} />
            <t.icon className="w-5 h-5 text-foreground-dim relative" />
            <p className="text-3xl font-display font-bold mt-3 relative">{t.value}</p>
            <p className="text-xs text-foreground-muted mt-1 relative">{t.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-white/5 bg-surface p-5 text-sm">
          <h2 className="font-display font-semibold mb-4 text-base">বিশ্লেষণ (গত ৭ দিন)</h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height={256}>
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--foreground-muted))" fontSize={11} />
                <YAxis stroke="hsl(var(--foreground-muted))" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--background-elevated))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Bar dataKey="watchViews" name="Video Views" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="dau" name="Daily Active Users" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="enrollments" name="New Enrollments" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-surface p-5">
          <h2 className="font-display font-semibold mb-4">সাম্প্রতিক কার্যকলাপ</h2>
          <ul className="space-y-2 text-sm max-h-64 overflow-y-auto">
            {activity.map(a => (
              <li key={a.id} className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-white/5">
                <div className="min-w-0">
                  <p className="truncate">{a.profiles?.display_name ?? "—"}</p>
                  <p className="text-xs text-foreground-muted">{a.action}</p>
                </div>
                <span className="text-[10px] text-foreground-muted whitespace-nowrap">{format(new Date(a.created_at), "HH:mm")}</span>
              </li>
            ))}
            {activity.length === 0 && <li className="text-foreground-muted text-sm py-6 text-center">কোনো কার্যকলাপ নেই</li>}
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border border-white/5 bg-surface p-5">
        <h2 className="font-display font-semibold mb-4 flex items-center justify-between">
          <span>Pending Enrollments</span>
          <span className="text-sm font-normal text-foreground-muted border border-white/10 px-2 py-1 rounded-md">{pending.length} Pending</span>
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-white/5 text-foreground-muted">
                <th className="pb-3 pr-4 font-medium">Student</th>
                <th className="pb-3 pr-4 font-medium">Chapter</th>
                <th className="pb-3 pr-4 font-medium">Payment</th>
                <th className="pb-3 pr-4 font-medium">Method</th>
                <th className="pb-3 pr-4 font-medium">Date</th>
                <th className="pb-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {pending.map(p => (
                <tr key={p.id} className="border-b border-white/5 last:border-0">
                  <td className="py-3 pr-4">{p.profiles?.display_name || "Unknown"}</td>
                  <td className="py-3 pr-4 bangla">{p.chapters?.name_bn || p.chapters?.name}</td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-col">
                      <span>৳{p.amount}</span>
                      <span className="text-xs text-foreground-muted">{p.transaction_id}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4 uppercase">{p.payment_method}</td>
                  <td className="py-3 pr-4">{format(new Date(p.created_at), "MMM d, HH:mm")}</td>
                  <td className="py-3 flex gap-2">
                    <button onClick={() => handleApprove(p)} className="px-3 py-1 bg-success/20 text-success hover:bg-success/30 rounded-md text-xs transition-colors">Approve</button>
                    <button onClick={() => handleReject(p.id)} className="px-3 py-1 bg-destructive/20 text-destructive hover:bg-destructive/30 rounded-md text-xs transition-colors">Reject</button>
                  </td>
                </tr>
              ))}
              {pending.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-foreground-muted">No pending enrollments</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
