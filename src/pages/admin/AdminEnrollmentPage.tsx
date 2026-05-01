import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, Copy, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

interface CodeRow {
  id: string; code: string; chapter_id: string | null;
  max_uses: number; uses_count: number; is_active: boolean;
  expires_at: string | null; created_at: string; generated_at?: string;
  chapters?: { name: string; cycles?: { subjects?: { name: string } } } | null;
}
interface ChapterOpt { id: string; name: string; cycle_id: string; }

const sb = supabase;

function formatCode(raw: string): string {
  // Group into 4-char blocks
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return clean.match(/.{1,4}/g)?.join("-") ?? clean;
}
function generateCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 24; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export default function AdminEnrollmentPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<CodeRow[]>([]);
  const [chapters, setChapters] = useState<ChapterOpt[]>([]);
  const [loading, setLoading] = useState(true);

  const [chapterId, setChapterId] = useState<string>("");
  const [maxUses, setMaxUses] = useState<number>(1);
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [c, ch] = await Promise.all([
      sb.from("enrollment_codes").select("*, chapters(name, cycles(subjects(name)))").order("generated_at", { ascending: false }),
      sb.from("chapters").select("id, name, cycle_id").eq("is_active", true).order("display_order"),
    ]);
    setRows((c.data ?? []) as unknown as CodeRow[]);
    setChapters((ch.data ?? []) as unknown as ChapterOpt[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    const code = generateCode();
    const payload: any = {
      code, max_uses: maxUses, uses_count: 0, is_active: true,
      chapter_id: chapterId || null,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      generated_by: user?.id ?? null,
      created_by: user?.id ?? null,
    };
    const { error } = await sb.from("enrollment_codes").insert(payload);
    if (error) toast({ title: "ব্যর্থ", description: error.message, variant: "destructive" });
    else {
      toast({ title: "কোড তৈরি হয়েছে", description: formatCode(code) });
      setMaxUses(1); setExpiresAt(""); setChapterId("");
      load();
    }
  };

  const toggleActive = async (r: CodeRow) => {
    await sb.from("enrollment_codes").update({ is_active: !r.is_active }).eq("id", r.id);
    load();
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    await sb.from("enrollment_codes").delete().eq("id", deleteId);
    setDeleteId(null);
    load();
  };

  const copy = (code: string) => {
    navigator.clipboard.writeText(formatCode(code));
    toast({ title: "কপি করা হয়েছে" });
  };

  const sortedRows = useMemo(() => [...rows].sort((a, b) =>
    new Date(b.generated_at ?? b.created_at).getTime() - new Date(a.generated_at ?? a.created_at).getTime()
  ), [rows]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">এনরোলমেন্ট কোড</h1>
        <p className="text-foreground-dim text-sm mt-1">শিক্ষার্থীদের লক্ড অধ্যায়ে অ্যাক্সেস দিন।</p>
      </header>

      {/* Create form */}
      <div className="rounded-2xl border border-white/5 bg-surface p-5">
        <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-foreground-muted mb-4">নতুন কোড তৈরি</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select value={chapterId} onChange={e => setChapterId(e.target.value)}
            className="h-10 px-3 rounded-lg bg-background border border-white/10 text-sm focus:outline-none focus:border-primary/50">
            <option value="">সকল অধ্যায় (গ্লোবাল)</option>
            {chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input type="number" min={1} value={maxUses} onChange={e => setMaxUses(parseInt(e.target.value) || 1)}
            placeholder="সর্বোচ্চ ব্যবহার"
            className="h-10 px-3 rounded-lg bg-background border border-white/10 text-sm focus:outline-none focus:border-primary/50" />
          <input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
            className="h-10 px-3 rounded-lg bg-background border border-white/10 text-sm focus:outline-none focus:border-primary/50" />
          <button onClick={create} className="h-10 rounded-lg bg-primary text-primary-foreground hover:bg-primary-glow text-sm font-medium inline-flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> জেনারেট
          </button>
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
                  <th className="text-left p-4">কোড</th>
                  <th className="text-left p-4">অধ্যায়</th>
                  <th className="text-left p-4">ব্যবহার</th>
                  <th className="text-left p-4">মেয়াদ</th>
                  <th className="text-left p-4">তৈরি</th>
                  <th className="text-left p-4">সক্রিয়</th>
                  <th className="text-right p-4"></th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map(r => (
                  <tr key={r.id} className="border-t border-white/5 hover:bg-white/5">
                    <td className="p-4 font-mono text-primary text-xs">{formatCode(r.code)}</td>
                    <td className="p-4">{r.chapters?.name ?? <span className="text-foreground-muted">সকল অধ্যায়</span>}</td>
                    <td className="p-4">{r.uses_count} / {r.max_uses}</td>
                    <td className="p-4 text-xs text-foreground-dim whitespace-nowrap">
                      {r.expires_at ? <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> {format(new Date(r.expires_at), "dd MMM yyyy")}</span> : "—"}
                    </td>
                    <td className="p-4 text-xs text-foreground-dim whitespace-nowrap">{format(new Date(r.generated_at ?? r.created_at), "dd MMM, HH:mm")}</td>
                    <td className="p-4">
                      <button onClick={() => toggleActive(r)} className={`relative w-10 h-6 rounded-full transition-colors ${r.is_active ? "bg-primary" : "bg-white/10"}`}>
                        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${r.is_active ? "translate-x-4" : "translate-x-0.5"}`} />
                      </button>
                    </td>
                    <td className="p-4 text-right space-x-2 whitespace-nowrap">
                      <button onClick={() => copy(r.code)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-xs">
                        <Copy className="w-3 h-3" /> কপি
                      </button>
                      <button onClick={() => setDeleteId(r.id)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/5 hover:bg-destructive/20 text-xs text-destructive">
                        <Trash2 className="w-3 h-3" /> মুছুন
                      </button>
                    </td>
                  </tr>
                ))}
                {sortedRows.length === 0 && (
                  <tr><td colSpan={7} className="p-10 text-center text-foreground-muted">কোনো কোড নেই</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleConfirmDelete}
        title="কোডটি মুছে ফেলতে চান?"
        description="Are you sure you want to delete this code?"
      />
    </div>
  );
}
