import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SubjectModal, CycleModal, ChapterModal, VideoModal } from "./AdminContentModals";
import { EntityCard } from "@/components/ui/EntityCard";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

interface SubjectRow { id: string; name: string; name_bn: string | null; slug: string; icon: string | null; color: string | null; display_order: number; is_active: boolean; }
interface CycleRow { id: string; subject_id: string; name: string; name_bn: string | null; display_order: number; is_active: boolean; }
interface ChapterRow { id: string; cycle_id: string; name: string; name_bn: string | null; description: string | null; requires_enrollment: boolean; display_order: number; is_active: boolean; }
interface VideoRow {
  id: string; chapter_id: string; title: string; title_bn: string | null;
  source_type: string; telegram_channel_id: string | null; telegram_message_id: number | null;
  youtube_video_id: string | null; drive_file_id: string | null;
  duration: string | null; thumbnail_url: string | null; size_mb: number | null;
  display_order: number; is_active: boolean;
}

const sb = supabase;

const warmupBackend = () => {
  const url = (import.meta.env.VITE_API_BASE_URL as string).replace(/\/+$/, "");
  fetch(url + "/api/warmup", { method: "POST" }).catch(() => {});
};

export default function AdminContentPage() {
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [cycles, setCycles] = useState<CycleRow[]>([]);
  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [activeCycle, setActiveCycle] = useState<string | null>(null);
  const [activeChapter, setActiveChapter] = useState<string | null>(null);
  const { toast } = useToast();

  const [modalState, setModalState] = useState<{type: string, data?: any} | null>(null);
  const [deleteData, setDeleteData] = useState<{ table: "subjects" | "cycles" | "chapters" | "videos", id: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const [s, c, ch, v] = await Promise.all([
      sb.from("subjects").select("*").order("display_order"),
      sb.from("cycles").select("*").order("display_order"),
      sb.from("chapters").select("*").order("display_order"),
      sb.from("videos").select("*").order("display_order"),
    ]);
    setSubjects((s.data ?? []) as SubjectRow[]);
    setCycles((c.data ?? []) as CycleRow[]);
    setChapters((ch.data ?? []) as ChapterRow[]);
    setVideos((v.data ?? []) as VideoRow[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const ok = (msg: string) => { toast({ title: msg }); load(); };
  const fail = (e: any) => toast({ title: "Failed", description: e?.message ?? String(e), variant: "destructive" });

  const handleSaveSubject = async (payload: any) => {
    if (modalState?.data?.id) {
      const { error } = await sb.from("subjects").update(payload).eq("id", modalState.data.id);
      if (error) return fail(error); ok("Subject updated");
    } else {
      const { error } = await sb.from("subjects").insert({ ...payload, display_order: subjects.length, is_active: true });
      if (error) return fail(error); ok("Subject added");
    }
  };

  const handleSaveCycle = async (payload: any) => {
    if (modalState?.data?.id) {
      const { error } = await sb.from("cycles").update(payload).eq("id", modalState.data.id);
      if (error) return fail(error); ok("Cycle updated");
    } else {
      if (!activeSubject) return;
      const list = cycles.filter(c => c.subject_id === activeSubject);
      const { error } = await sb.from("cycles").insert({ ...payload, subject_id: activeSubject, display_order: list.length, is_active: true });
      if (error) return fail(error); ok("Cycle added");
    }
  };

  const handleSaveChapter = async (payload: any) => {
    if (modalState?.data?.id) {
      const { error } = await sb.from("chapters").update(payload).eq("id", modalState.data.id);
      if (error) return fail(error); warmupBackend(); ok("Chapter updated");
    } else {
      if (!activeCycle) return;
      const list = chapters.filter(c => c.cycle_id === activeCycle);
      const { error } = await sb.from("chapters").insert({ ...payload, cycle_id: activeCycle, display_order: list.length, is_active: true });
      if (error) return fail(error);
      warmupBackend(); ok("Chapter added");
    }
  };

  const handleSaveVideo = async (payload: any) => {
    if (modalState?.data?.id) {
      const { error } = await sb.from("videos").update(payload).eq("id", modalState.data.id);
      if (error) return fail(error); warmupBackend(); ok("Video updated");
    } else {
      if (!activeChapter) return;
      const list = videos.filter(v => v.chapter_id === activeChapter);
      const { error } = await sb.from("videos").insert({ ...payload, chapter_id: activeChapter, display_order: list.length, is_active: true });
      if (error) return fail(error);
      warmupBackend(); ok("Video added");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteData) return;
    const { table, id } = deleteData;
    const { error } = await sb.from(table).delete().eq("id", id);
    if (error) return fail(error);
    if (table === "videos" || table === "chapters") warmupBackend();
    ok("Deleted");
    setDeleteData(null);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const Col = ({ title, onAdd, children }: any) => (
    <div className="rounded-2xl border border-white/5 bg-surface flex flex-col min-h-[60vh]">
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-foreground-muted">{title}</h2>
        {onAdd && <button aria-label={`Add new ${title} / নতুন যোগ করুন`} onClick={onAdd} className="p-1.5 rounded-full bg-primary/15 text-primary hover:bg-primary/25"><Plus className="w-3.5 h-3.5" /></button>}
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">{children}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Content library</h1>
        <p className="text-foreground-dim text-sm mt-1">Subject → Cycle → Chapter → Video</p>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Col title="Subjects" onAdd={() => setModalState({ type: 'subject' })}>
          {subjects.map(s => (
            <EntityCard
              key={s.id}
              title={`${s.icon ?? "📚"} ${s.name}`}
              className={activeSubject === s.id ? "border-primary/50 ring-1 ring-primary" : ""}
              onClick={() => { setActiveSubject(s.id); setActiveCycle(null); setActiveChapter(null); }}
              onEdit={() => setModalState({ type: 'subject', data: { id: s.id, defaultValues: s } })}
              onDelete={() => setDeleteData({ table: "subjects", id: s.id })}
            />
          ))}
        </Col>
        <Col title="Cycles" onAdd={activeSubject ? () => setModalState({ type: 'cycle' }) : undefined}>
          {cycles.filter(c => c.subject_id === activeSubject).map(c => (
            <EntityCard
              key={c.id}
              title={c.name}
              className={activeCycle === c.id ? "border-primary/50 ring-1 ring-primary" : ""}
              onClick={() => { setActiveCycle(c.id); setActiveChapter(null); }}
              onEdit={() => setModalState({ type: 'cycle', data: { id: c.id, defaultValues: c } })}
              onDelete={() => setDeleteData({ table: "cycles", id: c.id })}
            />
          ))}
          {!activeSubject && <p className="text-xs text-foreground-muted p-3">Select a subject</p>}
        </Col>
        <Col title="Chapters" onAdd={activeCycle ? () => setModalState({ type: 'chapter' }) : undefined}>
          {chapters.filter(c => c.cycle_id === activeCycle).map(c => (
            <EntityCard
              key={c.id}
              title={c.name}
              badge={c.requires_enrollment ? <span className="text-xs ml-1">🔒</span> : null}
              className={activeChapter === c.id ? "border-primary/50 ring-1 ring-primary" : ""}
              onClick={() => setActiveChapter(c.id)}
              onEdit={() => setModalState({ type: 'chapter', data: { id: c.id, defaultValues: c } })}
              onDelete={() => setDeleteData({ table: "chapters", id: c.id })}
            />
          ))}
          {!activeCycle && <p className="text-xs text-foreground-muted p-3">Select a cycle</p>}
        </Col>
        <Col title="Videos" onAdd={activeChapter ? () => setModalState({ type: 'video' }) : undefined}>
          {videos.filter(v => v.chapter_id === activeChapter).map(v => (
            <EntityCard
              key={v.id}
              title={v.title}
              subtitle={v.source_type}
              onEdit={() => setModalState({ type: 'video', data: { id: v.id, defaultValues: v } })}
              onDelete={() => setDeleteData({ table: "videos", id: v.id })}
            />
          ))}
          {!activeChapter && <p className="text-xs text-foreground-muted p-3">Select a chapter</p>}
        </Col>
      </div>

      {modalState?.type === 'subject' && <SubjectModal isOpen={true} onClose={() => setModalState(null)} onSave={handleSaveSubject} defaultValues={modalState.data?.defaultValues} />}
      {modalState?.type === 'cycle' && <CycleModal isOpen={true} onClose={() => setModalState(null)} onSave={handleSaveCycle} defaultValues={modalState.data?.defaultValues} />}
      {modalState?.type === 'chapter' && <ChapterModal isOpen={true} onClose={() => setModalState(null)} onSave={handleSaveChapter} defaultValues={modalState.data?.defaultValues} />}
      {modalState?.type === 'video' && <VideoModal isOpen={true} onClose={() => setModalState(null)} onSave={handleSaveVideo} defaultValues={modalState.data?.defaultValues} />}

      <ConfirmModal
        isOpen={!!deleteData}
        onClose={() => setDeleteData(null)}
        onConfirm={handleConfirmDelete}
        title="Delete permanently?"
        description="Are you sure you want to delete this item? This action cannot be undone."
      />
    </div>
  );
}
