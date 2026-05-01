import { Link, useParams, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, ArrowLeft, Layers, Atom, FlaskConical, Sigma } from "lucide-react";
import { useCatalog } from "@/contexts/CatalogContext";

const IconMap: Record<string, React.ElementType> = {
  Atom: Atom,
  FlaskConical: FlaskConical,
  Calculator: Sigma, // Map Calculator to Sigma
  Sigma: Sigma
};

export default function SubjectPage() {
  const { subjectSlug } = useParams();
  const { catalog, isLoading } = useCatalog();
  if (isLoading) return <div className="container py-20 text-center text-foreground-muted">Loading…</div>;
  const subject = catalog?.subjects.find(s => s.slug === subjectSlug);
  if (!subject) return <Navigate to="/dashboard" replace />; // Redirect to dashboard instead of courses

  const IconComp = subject.icon && IconMap[subject.icon] ? IconMap[subject.icon] : null;

  return (
    <div>
      {/* Hero banner with subject color glow */}
      <div className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 opacity-30 blur-3xl" style={{ background: `radial-gradient(ellipse at top, ${subject.color}, transparent 60%)` }} />
        <div className="container relative py-14">
          <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground mb-6">
            <ArrowLeft className="w-4 h-4" /> ড্যাশবোর্ড
          </Link>
          <div className="flex items-start gap-5">
            <span className="text-primary">
               {IconComp ? <IconComp className="w-16 h-16" /> : "📚"}
            </span>
            <div>
              <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tighter">{subject.name_bn || subject.name}</h1>
              {subject.name_bn && <p className="text-lg text-foreground-dim mt-1">{subject.name}</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="container py-10 space-y-4">
        <h2 className="font-display text-xl font-semibold flex items-center gap-2"><Layers className="w-5 h-5 text-primary" /> Cycles</h2>
        {subject.cycles.length === 0 ? (
          <p className="text-foreground-muted">No cycles yet for this subject.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {subject.cycles.map((cy, i) => (
              <motion.div key={cy.id}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.04 }}
              >
                <Link to={`/cycle/${cy.id}`}
                  className="block p-5 rounded-2xl bg-background-elevated border border-border hover:border-primary/40 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{cy.name}</p>
                      {cy.name_bn && <p className="font-bangla text-xs text-foreground-muted mt-0.5">{cy.name_bn}</p>}
                      <p className="text-xs text-foreground-muted mt-1">
                        {cy.chapters.length} chapter{cy.chapters.length !== 1 ? "s" : ""} · {cy.chapters.reduce((n, c) => n + c.videos.length, 0)} videos
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-foreground-muted group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
