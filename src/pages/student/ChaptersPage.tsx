import { Link, useParams, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Lock, ChevronRight, BookOpen } from "lucide-react";
import { useCatalog } from "@/contexts/CatalogContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

export default function ChaptersPage() {
  const { cycleId } = useParams();
  const { catalog, isLoading } = useCatalog();
  const { user } = useAuth();
  const [historyStats, setHistoryStats] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user) return;
    supabase.from("watch_history").select("video_id, completed").eq("user_id", user.id).eq("completed", true)
      .then(({ data }) => {
        if (!data) return;
        const stats: Record<string, boolean> = {};
        data.forEach(h => { stats[h.video_id] = true; });
        setHistoryStats(stats);
      });
  }, [user]);

  if (isLoading) return (
    <div className="container py-20 space-y-4">
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-8 w-1/3" />
      <div className="space-y-2 mt-8">
        {[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
      </div>
    </div>
  );

  let cycle: any, subject: any;
  catalog?.subjects.forEach(s => s.cycles.forEach(cy => { if (cy.id === cycleId) { cycle = cy; subject = s; } }));
  if (!cycle) return <Navigate to="/dashboard" replace />;

  return (
    <div>
      <div className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 opacity-25 blur-3xl" style={{ background: `radial-gradient(ellipse at top, ${subject.color}, transparent 60%)` }} />
        <div className="container relative py-12">
          {/* Breadcrumb */}
          <div className="flex flex-wrap items-center gap-2 text-sm text-foreground-muted mb-6">
             <Link to="/dashboard" className="hover:text-foreground transition-colors">Home</Link>
             <span>/</span>
             <Link to={`/subject/${subject.slug}`} className="hover:text-foreground transition-colors">{subject.name}</Link>
             <span>/</span>
             <span className="text-foreground">{cycle.name}</span>
          </div>

          <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">Cycle</p>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tighter">{cycle.name}</h1>
          {cycle.description && <p className="text-foreground-dim mt-3 max-w-2xl">{cycle.description}</p>}
        </div>
      </div>

      <div className="container py-10 space-y-4">
        <h2 className="font-display text-xl font-semibold flex items-center gap-2"><BookOpen className="w-5 h-5 text-primary" /> Chapters</h2>
        {cycle.chapters.length === 0 ? (
          <p className="text-foreground-muted">No chapters yet.</p>
        ) : (
          <div className="space-y-4">
            {cycle.chapters.map((ch: any, i: number) => {
              const totalVids = ch.videos?.length || 0;
              const completedVids = ch.videos?.filter((v: any) => historyStats[v.id]).length || 0;
              const progressPct = totalVids > 0 ? (completedVids / totalVids) * 100 : 0;

              return (
                <motion.div key={ch.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.03 }}
                >
                  <Link to={`/chapter/${ch.id}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl bg-background-elevated border border-border hover:border-primary/40 transition-colors group gap-4"
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center font-mono text-foreground-muted text-sm shrink-0">
                        {String(i + 1).padStart(2, "0")}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold flex items-center gap-2 truncate">
                          {ch.name}
                          {ch.requires_enrollment && <Lock className="w-3.5 h-3.5 text-warning shrink-0" />}
                        </p>
                        {ch.name_bn && <p className="font-bangla text-xs text-foreground-muted truncate">{ch.name_bn}</p>}
                        
                        {totalVids > 0 && (
                          <div className="mt-2 flex items-center gap-3">
                            <div className="h-1.5 flex-1 max-w-[200px] bg-background rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${progressPct}%` }} />
                            </div>
                            <span className="text-[10px] tabular-nums text-foreground-muted">{completedVids}/{totalVids} video{totalVids !== 1 ? "s" : ""}</span>
                          </div>
                        )}
                        {totalVids === 0 && <p className="text-xs text-foreground-muted mt-0.5">0 videos</p>}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-foreground-muted group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0 self-end sm:self-auto" />
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
