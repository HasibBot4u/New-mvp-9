import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useCatalog } from "@/contexts/CatalogContext";
import { ChevronRight } from "lucide-react";

export default function CoursesPage() {
  const { catalog, isLoading } = useCatalog();

  return (
    <div className="container py-8 space-y-10">
      <div>
        <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">Catalog</p>
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tighter">All courses</h1>
        <p className="mt-2 text-foreground-dim">Pick a subject. Dive into a cycle.</p>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0,1,2,3,4,5].map(i => <div key={i} className="h-64 rounded-2xl bg-background-elevated animate-pulse" />)}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {catalog?.subjects.map((s, i) => (
            <motion.div key={s.id}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
            >
              <Link to={`/subject/${s.slug}`}
                className="poster-card group block h-full p-7 bg-gradient-card border border-border hover:border-primary/40 relative overflow-hidden min-h-[260px]"
              >
                <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full opacity-20 blur-2xl"
                  style={{ background: s.color ?? "hsl(var(--primary))" }} />
                <div className="relative flex flex-col h-full justify-between">
                  <div>
                    <span className="text-4xl">{s.icon ?? "📚"}</span>
                    <h2 className="font-display text-2xl font-bold mt-4">{s.name}</h2>
                    {s.name_bn && <p className="font-bangla text-sm text-foreground-muted mt-0.5">{s.name_bn}</p>}
                  </div>
                  <div className="flex items-center justify-between mt-6 text-sm">
                    <span className="text-foreground-muted">
                      {s.cycles.length} cycles · {s.cycles.reduce((n, c) => n + c.chapters.length, 0)} chapters
                    </span>
                    <ChevronRight className="w-5 h-5 text-foreground-muted group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
