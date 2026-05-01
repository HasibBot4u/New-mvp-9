import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { StickyNote, Loader2, Video, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCatalog } from "@/contexts/CatalogContext";
import { format } from "date-fns";

interface NoteRow {
  video_id: string;
  content: string;
  updated_at: string;
}

export default function NotesPage() {
  const { user } = useAuth();
  const { catalog } = useCatalog();
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("video_notes").select("video_id, content, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .then(({ data }) => { setNotes((data ?? []) as unknown as NoteRow[]); setLoading(false); });
  }, [user]);

  const videoMap = new Map<string, { title: string; subjectName: string; chapterName: string }>();
  catalog?.subjects.forEach(s => s.cycles.forEach(c => c.chapters.forEach(ch =>
    ch.videos.forEach(v => videoMap.set(v.id, {
      title: v.title, subjectName: s.name, chapterName: ch.name,
    }))
  )));

  return (
    <div className="container max-w-4xl py-10 space-y-8">
      <div>
        <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">Private Workspace</p>
        <h1 className="font-display text-4xl font-bold tracking-tighter flex items-center gap-3">
          <StickyNote className="w-8 h-8 text-primary" /> আমার নোটস
        </h1>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : notes.length === 0 ? (
        <div className="rounded-2xl p-12 bg-surface border border-white/5 text-center">
          <StickyNote className="w-10 h-10 text-foreground-muted mx-auto mb-4" />
          <p className="text-foreground-dim font-bangla">আপনি এখনও কোনো নোট সংরক্ষণ করেননি। ভিডিও দেখার সময় নোট লিখতে পারবেন।</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {notes.map(n => {
            const vid = videoMap.get(n.video_id);
            return (
              <div key={n.video_id} className="rounded-2xl bg-surface border border-white/5 p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Video className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="font-display font-semibold text-lg">{vid?.title || "অজানা ভিডিও"}</h2>
                      <p className="text-xs text-foreground-muted mt-1">{vid?.subjectName} • {vid?.chapterName}</p>
                    </div>
                  </div>
                  <Link to={`/watch/${n.video_id}`} className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-primary/20 hover:text-primary transition-colors text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap">
                    ভিডিও দেখুন <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="pl-[52px]">
                  <p className="text-sm text-foreground-dim whitespace-pre-wrap leading-relaxed">{n.content}</p>
                  <p className="text-xs text-foreground-muted mt-4">শেষ আপডেট: {format(new Date(n.updated_at), "dd MMM, hh:mm a")}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
