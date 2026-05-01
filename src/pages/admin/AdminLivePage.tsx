import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Radio, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { LiveClass } from "@/types";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

const sb = supabase;

export default function AdminLivePage() {
  const [list, setList] = useState<LiveClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [url, setUrl] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data } = await sb.from("live_classes").select("*").order("scheduled_at", { ascending: false });
    setList((data ?? []) as unknown as LiveClass[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date) return;
    setLoading(true);
    const { error } = await sb.from("live_classes").insert({ 
      title, 
      scheduled_at: new Date(date).toISOString(), 
      meeting_url: url || null, 
      is_active: true 
    });
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      setLoading(false);
    } else { 
      toast({ title: "Scheduled" }); 
      setTitle(""); setDate(""); setUrl(""); setShowForm(false);
      load(); 
    }
  };
  
  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    await sb.from("live_classes").delete().eq("id", deleteId);
    setDeleteId(null);
    load();
  };

  if (loading && list.length === 0) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  
  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Live Classes</h1>
          <p className="text-foreground-dim text-sm mt-1">Schedule streams and meetings.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-2 px-4 h-10 rounded-full bg-primary text-primary-foreground hover:bg-primary-glow text-sm font-medium">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? "Cancel" : "Schedule"}
        </button>
      </header>

      {showForm && (
        <form onSubmit={create} className="p-6 rounded-2xl bg-surface border border-white/10 space-y-4">
          <div>
            <label htmlFor="l-title" className="block text-xs font-semibold uppercase text-foreground-muted mb-1">Title</label>
            <input id="l-title" required type="text" value={title} onChange={e => setTitle(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-background border border-white/10 focus:border-primary/50 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="l-date" className="block text-xs font-semibold uppercase text-foreground-muted mb-1">Start Time</label>
              <input id="l-date" required type="datetime-local" value={date} onChange={e => setDate(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-background border border-white/10 focus:border-primary/50 text-sm" />
            </div>
            <div>
              <label htmlFor="l-url" className="block text-xs font-semibold uppercase text-foreground-muted mb-1">Meeting URL</label>
              <input id="l-url" type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..."
                className="w-full h-10 px-3 rounded-xl bg-background border border-white/10 focus:border-primary/50 text-sm" />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" disabled={loading} className="px-6 h-10 rounded-xl bg-primary text-primary-foreground font-medium text-sm flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />} Create
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-3">
        {list.map(l => (
          <div key={l.id} className="rounded-2xl border border-white/5 bg-surface p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center"><Radio className="w-5 h-5" /></div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-semibold">{l.title}</p>
              <p className="text-xs text-foreground-muted mt-1">{new Date(l.scheduled_at).toLocaleString()}</p>
              {l.meeting_url && <a href={l.meeting_url} target="_blank" className="text-xs text-primary hover:underline mt-1 inline-block">Join Link</a>}
            </div>
            <button onClick={() => setDeleteId(l.id)} className="px-3 py-1.5 rounded-full text-xs bg-white/5 text-destructive hover:bg-destructive/15 transition-colors">
              <Trash2 className="w-3 h-3 inline mr-1" /> Cancel
            </button>
          </div>
        ))}
        {list.length === 0 && !showForm && <p className="text-center text-foreground-muted py-10">Nothing scheduled</p>}
      </div>

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleConfirmDelete}
        title="Cancel this class?"
        description="Are you sure you want to delete this live class?"
      />
    </div>
  );
}
