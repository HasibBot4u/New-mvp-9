import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Announcement } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

const sb = supabase;

function AnnouncementModal({ isOpen, onClose, onSave }: any) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);

  const handleSubmit = (e: any) => {
    e.preventDefault();
    if (!title) return;
    onSave({ title, body, is_pinned: pinned, is_active: true });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>New Announcement</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><Label htmlFor="a-title">Title</Label><Input id="a-title" value={title} onChange={e => setTitle(e.target.value)} required /></div>
          <div><Label htmlFor="a-content">Content</Label><textarea id="a-content" className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={body} onChange={e => setBody(e.target.value)} /></div>
          <div className="flex items-center space-x-2">
            <input type="checkbox" id="pin" checked={pinned} onChange={e => setPinned(e.target.checked)} />
            <Label htmlFor="pin">Pin this announcement</Label>
          </div>
          <DialogFooter><Button type="submit">Post</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminAnnouncementsPage() {
  const [list, setList] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data } = await sb.from("announcements").select("*").order("created_at", { ascending: false });
    setList((data ?? []) as unknown as Announcement[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleSave = async (payload: any) => {
    const { error } = await sb.from("announcements").insert(payload);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Posted" }); load(); }
  };
  const toggle = async (a: Announcement) => { await sb.from("announcements").update({ is_active: !a.is_active }).eq("id", a.id); load(); };
  
  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    await sb.from("announcements").delete().eq("id", deleteId);
    setDeleteId(null);
    load();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Announcements</h1>
          <p className="text-foreground-dim text-sm mt-1">Broadcast messages to all users.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 px-4 h-10 rounded-full bg-primary text-primary-foreground hover:bg-primary-glow text-sm font-medium">
          <Plus className="w-4 h-4" /> New
        </button>
      </header>
      <div className="grid gap-3">
        {list.map(a => (
          <div key={a.id} className="rounded-2xl border border-white/5 bg-surface p-5 flex items-start gap-4">
            <span className={`mt-1 w-2 h-2 rounded-full ${a.is_pinned ? "bg-warning" : "bg-primary"}`} />
            <div className="flex-1 min-w-0">
              <p className="font-display font-semibold">{a.title}</p>
              {a.body && <p className="text-sm text-foreground-dim mt-1">{a.body}</p>}
              <p className="text-xs text-foreground-muted mt-2">{new Date(a.created_at).toLocaleString()}{a.is_pinned ? " · Pinned" : ""}</p>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => toggle(a)} className={`px-3 py-1.5 rounded-full text-xs ${a.is_active ? "bg-success/15 text-success" : "bg-white/5 text-foreground-dim"}`}>
                {a.is_active ? "Active" : "Hidden"}
              </button>
              <button aria-label="Delete announcement / ঘোষণা মুছুন" onClick={() => setDeleteId(a.id)} className="px-3 py-1.5 rounded-full text-xs bg-white/5 text-destructive hover:bg-destructive/15"><Trash2 className="w-3 h-3 inline" /></button>
            </div>
          </div>
        ))}
        {list.length === 0 && <p className="text-center text-foreground-muted py-10">No announcements</p>}
      </div>
      {showModal && <AnnouncementModal isOpen={showModal} onClose={() => setShowModal(false)} onSave={handleSave} />}
      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleConfirmDelete}
        title="Delete announcement?"
      />
    </div>
  );
}
