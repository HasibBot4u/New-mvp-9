import { useEffect, useMemo, useState } from "react";
import { Loader2, Download, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface LogRow {
  id: string;
  created_at: string;
  user_id: string | null;
  action: string;
  details: any;
  ip_address: string | null;
  profiles?: { display_name: string | null; email: string | null } | null;
}

const actionColors: Record<string, string> = {
  login: "bg-info/15 text-info",
  signup: "bg-success/15 text-success",
  code_used: "bg-warning/15 text-warning",
  video_watch: "bg-white/10 text-foreground-dim",
  admin_action: "bg-destructive/15 text-destructive",
};

export default function AdminLogsPage() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [days, setDays] = useState<number>(7);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const { data } = await supabase
      .from("activity_logs")
      .select("*, profiles(display_name, email)")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200);
    setRows((data ?? []) as unknown as LogRow[]);
    setLoading(false);
  };
  useEffect(() => { 
    load(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const filtered = useMemo(() => rows.filter(r => {
    if (actionFilter !== "all" && r.action !== actionFilter) return false;
    if (search && !(r.profiles?.email ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [rows, actionFilter, search]);

  const exportCsv = () => {
    const header = "timestamp,user_email,user_name,action,details\n";
    const body = filtered.map(r =>
      [r.created_at, r.profiles?.email ?? "", r.profiles?.display_name ?? "", r.action, JSON.stringify(r.details ?? {}).replace(/"/g, '""')]
        .map(v => `"${v}"`).join(",")
    ).join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `nexus-logs-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Activity logs</h1>
          <p className="text-foreground-dim text-sm mt-1">{filtered.length} ইভেন্ট</p>
        </div>
        <button onClick={exportCsv} className="inline-flex items-center gap-2 px-4 h-10 rounded-full bg-primary text-primary-foreground hover:bg-primary-glow text-sm font-medium">
          <Download className="w-4 h-4" /> CSV ডাউনলোড
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ইমেইল দিয়ে খুঁজুন…"
            className="pl-9 h-10 px-4 rounded-full bg-surface border border-white/10 text-sm w-64 focus:outline-none focus:border-primary/50" />
        </div>
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
          className="h-10 px-4 rounded-full bg-surface border border-white/10 text-sm focus:outline-none focus:border-primary/50">
          <option value="all">সব অ্যাকশন</option>
          <option value="login">login</option>
          <option value="signup">signup</option>
          <option value="code_used">code_used</option>
          <option value="video_watch">video_watch</option>
          <option value="admin_action">admin_action</option>
        </select>
        <div className="inline-flex rounded-full bg-surface border border-white/10 p-1 text-xs">
          {[{l:"আজ",v:1},{l:"৭ দিন",v:7},{l:"৩০ দিন",v:30}].map(b => (
            <button key={b.v} onClick={() => setDays(b.v)}
              className={`px-3 h-8 rounded-full ${days===b.v ? "bg-primary text-primary-foreground" : "text-foreground-dim hover:text-foreground"}`}>
              {b.l}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <div className="rounded-2xl border border-white/5 bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-wider text-foreground-muted">
                <tr>
                  <th className="text-left p-4">সময়</th>
                  <th className="text-left p-4">ব্যবহারকারী</th>
                  <th className="text-left p-4">অ্যাকশন</th>
                  <th className="text-left p-4">বিবরণ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-t border-white/5 hover:bg-white/5 align-top">
                    <td className="p-4 text-xs text-foreground-dim whitespace-nowrap">{format(new Date(r.created_at), "dd MMM, HH:mm:ss")}</td>
                    <td className="p-4">
                      <p className="font-medium">{r.profiles?.display_name ?? "—"}</p>
                      <p className="text-xs text-foreground-muted">{r.profiles?.email ?? r.user_id ?? "system"}</p>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs ${actionColors[r.action] ?? "bg-white/10 text-foreground-dim"}`}>{r.action}</span>
                    </td>
                    <td className="p-4">
                      <pre className="text-xs text-foreground-muted bg-background/40 p-2 rounded-lg max-w-md overflow-x-auto">{JSON.stringify(r.details ?? {}, null, 2)}</pre>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={4} className="p-10 text-center text-foreground-muted">কোনো লগ পাওয়া যায়নি</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
