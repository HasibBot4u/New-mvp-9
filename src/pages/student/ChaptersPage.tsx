import { Link, useParams, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Lock, ChevronRight, BookOpen } from "lucide-react";
import { useCatalog } from "@/contexts/CatalogContext";

export default function ChaptersPage() {
  const { cycleId } = useParams();
  const { catalog, isLoading } = useCatalog();
  if (isLoading) return <div className="container py-20 text-center text-foreground-muted">Loading…</div>;

  let cycle: any, subject: any;
  catalog?.subjects.forEach(s => s.cycles.forEach(cy => { if (cy.id === cycleId) { cycle = cy; subject = s; } }));
  if (!cycle) return <Navigate to="/dashboard" replace />;

  return (
    <div>
      <div className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 opacity-25 blur-3xl" style={{ background: `radial-gradient(ellipse at top, ${subject.color}, transparent 60%)` }} />
        <div className="container relative py-12">
          <Link to={`/subject/${subject.slug}`} className="inline-flex items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground mb-5">
            <ArrowLeft className="w-4 h-4" /> {subject.name}
          </Link>
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
          <div className="space-y-2">
            {cycle.chapters.map((ch: any, i: number) => (
              <motion.div key={ch.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.03 }}
              >
                <Link to={`/chapter/${ch.id}`}
                  className="flex items-center justify-between p-5 rounded-2xl bg-background-elevated border border-border hover:border-primary/40 transition-colors group"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center font-mono text-foreground-muted text-sm shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold flex items-center gap-2 truncate">
                        {ch.name}
                        {ch.requires_enrollment && <Lock className="w-3.5 h-3.5 text-warning shrink-0" />}
                      </p>
                      {ch.name_bn && <p className="font-bangla text-xs text-foreground-muted truncate">{ch.name_bn}</p>}
                      <p className="text-xs text-foreground-muted mt-0.5">{ch.videos.length} video{ch.videos.length !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-foreground-muted group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
