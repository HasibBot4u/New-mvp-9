import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, PlayCircle, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useCatalog } from "@/contexts/CatalogContext";
import { Progress } from "@/components/ui/progress";

interface Row {
  video_id: string;
  progress_seconds: number;
  progress_percent: number;
  completed: boolean;
  updated_at: string;
  watched_at: string;
}

export default function ProgressPage() {
  const { user } = useAuth();
  const { catalog } = useCatalog();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("watch_history")
      .select("video_id, progress_seconds, progress_percent, completed, updated_at, watched_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .then(({ data }) => { setRows((data ?? []) as unknown as Row[]); setLoading(false); });
  }, [user]);

  // Resolve video metadata from catalog
  const videoMap = new Map<string, { title: string; subjectName: string; subjectColor: string | null | undefined; chapterName: string }>();
  catalog?.subjects.forEach(s => s.cycles.forEach(c => c.chapters.forEach(ch =>
    ch.videos.forEach(v => videoMap.set(v.id, {
      title: v.title, subjectName: s.name, subjectColor: s.color, chapterName: ch.name,
    }))
  )));

  const totalSeconds = rows.reduce((sum, r) => sum + (r.progress_seconds || 0), 0);
  const completed = rows.filter(r => r.completed).length;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  return (
    <div className="container max-w-4xl py-10 space-y-10">
      <div>
        <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">Analytics</p>
        <h1 className="font-display text-4xl font-bold tracking-tighter flex items-center gap-3">
          আপনার অগ্রগতি <TrendingUp className="w-6 h-6 text-primary" />
        </h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile icon={PlayCircle} label="শুরু করেছেন" value={rows.length} />
        <Tile icon={CheckCircle2} label="সম্পন্ন" value={completed} />
        <Tile icon={Clock} label="ঘণ্টা" value={hours} />
        <Tile icon={Clock} label="মিনিট" value={minutes} />
      </div>

      <section>
        <h2 className="font-display text-lg font-semibold mb-3 font-bangla">সাম্প্রতিক কার্যকলাপ</h2>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : rows.length === 0 ? (
          <p className="text-foreground-muted text-sm font-bangla">এখনো কোনো কার্যকলাপ নেই। ভিডিও দেখা শুরু করুন।</p>
        ) : (
          <div className="space-y-2">
            {rows.slice(0, 20).map((r, i) => {
              const meta = videoMap.get(r.video_id);
              return (
                <Link
                  key={i}
                  to={`/watch/${r.video_id}`}
                  className="block rounded-xl p-4 bg-background-elevated border border-border hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{meta?.title ?? "Video"}</p>
                      <p className="text-xs text-foreground-muted mt-0.5">
                        {meta ? `${meta.subjectName} · ${meta.chapterName}` : ""}
                      </p>
                    </div>
                    {r.completed && <CheckCircle2 className="w-5 h-5 text-success shrink-0" />}
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <Progress value={r.progress_percent || 0} className="h-1.5" />
                    <span className="text-xs text-foreground-muted shrink-0 tabular-nums">{r.progress_percent || 0}%</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Tile({ icon: Icon, label, value }: any) {
  return (
    <div className="rounded-2xl p-5 bg-background-elevated border border-border">
      <Icon className="w-5 h-5 text-primary mb-3" />
      <p className="font-display text-3xl font-bold">{value}</p>
      <p className="text-xs text-foreground-muted mt-1 font-bangla">{label}</p>
    </div>
  );
}
