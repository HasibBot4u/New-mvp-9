import { useEffect, useState } from "react";
import { Loader2, Shield, ShieldOff, Ban, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UserRow {
  id: string;
  email: string | null;
  display_name: string | null;
  is_blocked: boolean;
  created_at: string;
  avatar_url?: string | null;
  isAdmin?: boolean;
}

const PAGE_SIZE = 20;
const sb = supabase;

export default function AdminUsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let query = sb.from("profiles").select("*", { count: "exact" }).order("created_at", { ascending: false });
    if (q.trim()) {
      const term = `%${q.trim()}%`;
      query = query.or(`email.ilike.${term},display_name.ilike.${term}`);
    }
    const { data, count } = await query.range(from, to);
    const list = (data ?? []) as any[];

    setRows(list.map(u => ({ ...u, isAdmin: u.role === "admin" })));
    setTotal(count ?? 0);
    setLoading(false);
  };

  useEffect(() => { 
    load(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, q]);

  const toggleBlock = async (r: UserRow) => {
    await sb.from("profiles").update({ is_blocked: !r.is_blocked }).eq("id", r.id);
    toast({ title: r.is_blocked ? "Unblocked" : "Blocked" });
    load();
  };
  const toggleAdmin = async (r: UserRow) => {
    if (r.isAdmin) {
      await sb.from("profiles").update({ role: "student" } as any).eq("id", r.id);
      toast({ title: "Admin removed" });
    } else {
      await sb.from("profiles").update({ role: "admin" } as any).eq("id", r.id);
      toast({ title: "Admin granted" });
    }
    load();
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Users</h1>
          <p className="text-foreground-dim mt-1 text-sm">{total} total accounts</p>
        </div>
        <input value={q} onChange={e => { setPage(0); setQ(e.target.value); }} placeholder="Search by name or email…"
          className="h-10 px-4 rounded-full bg-surface border border-white/10 text-sm w-72 max-w-full focus:outline-none focus:border-primary/50" />
      </header>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="rounded-2xl border border-white/5 bg-surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-foreground-muted text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left p-4">User</th>
                    <th className="text-left p-4">Role</th>
                    <th className="text-left p-4">Status</th>
                    <th className="text-right p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} className="border-t border-white/5 hover:bg-white/5">
                      <td className="p-4">
                        <p className="font-medium">{r.display_name ?? "—"}</p>
                        <p className="text-xs text-foreground-muted">{r.email}</p>
                      </td>
                      <td className="p-4">
                        {r.isAdmin
                          ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/15 text-primary">Admin</span>
                          : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-white/5 text-foreground-dim">User</span>}
                      </td>
                      <td className="p-4">
                        {r.is_blocked
                          ? <span className="inline-flex items-center gap-1 text-xs text-destructive"><Ban className="w-3 h-3" /> Blocked</span>
                          : <span className="inline-flex items-center gap-1 text-xs text-success"><CheckCircle2 className="w-3 h-3" /> Active</span>}
                      </td>
                      <td className="p-4 text-right space-x-2 whitespace-nowrap">
                        <button onClick={() => toggleAdmin(r)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-xs">
                          {r.isAdmin ? <><ShieldOff className="w-3 h-3" /> Demote</> : <><Shield className="w-3 h-3" /> Promote</>}
                        </button>
                        <button onClick={() => toggleBlock(r)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/5 hover:bg-destructive/20 text-xs">
                          {r.is_blocked ? "Unblock" : "Block"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr><td colSpan={4} className="p-10 text-center text-foreground-muted text-sm">No users found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground-muted">Page {page + 1} / {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="inline-flex items-center gap-1 px-3 h-9 rounded-full bg-white/5 hover:bg-white/10 disabled:opacity-30">
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <button onClick={() => setPage(p => p + 1 < totalPages ? p + 1 : p)} disabled={page + 1 >= totalPages}
                className="inline-flex items-center gap-1 px-3 h-9 rounded-full bg-white/5 hover:bg-white/10 disabled:opacity-30">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
