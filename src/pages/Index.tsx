import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Play, Atom, Sparkles, ShieldCheck, Smartphone, Users } from "lucide-react";
// import { HeroCanvas } from "@/components/three/HeroCanvas";
import { Button } from "@/components/ui/button";
import { useCatalog } from "@/contexts/CatalogContext";

const HeroCanvas = lazy(() => import("@/components/three/HeroCanvas").then(m => ({ default: m.HeroCanvas })));

const features = [
  { icon: Sparkles, title: "Curated cycles", desc: "Lessons grouped into focused cycles & chapters — no overwhelm." },
  { icon: ShieldCheck, title: "Enrollment-protected", desc: "Single-device chapter access with secure codes." },
  { icon: Smartphone, title: "Watch anywhere", desc: "Phone-first cinematic player. Resume where you left off." },
  { icon: Users, title: "Live classes", desc: "Scheduled sessions with top HSC educators." },
];

const Index = () => {
  const { catalog } = useCatalog();
  const displaySubjects = catalog?.subjects || [];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
        {/* HERO ============================================================= */}
      <section className="relative min-h-screen flex items-center pt-24">
        <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
        <div className="absolute inset-0">
          <Suspense fallback={<div className="h-[400px]" />}>
            <HeroCanvas />
          </Suspense>
        </div>
        {/* fade scene into page */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-fade-bottom pointer-events-none" />

        <div className="container relative z-10 grid lg:grid-cols-2 gap-12 items-center py-20">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="text-center lg:text-left"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs font-medium text-foreground-dim mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-glow" />
              HSC {new Date().getFullYear()} — Admissions open
            </div>

            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.02] tracking-tighter mb-6">
              <span className="text-gradient">Cinematic learning</span>
              <br />
              <span className="text-gradient-primary">for HSC.</span>
            </h1>

            <p className="text-lg text-foreground-dim max-w-xl mx-auto lg:mx-0 mb-3">
              Physics. Chemistry. Higher Math. Taught by the country's best — designed like the streaming app you actually want to open.
            </p>
            <p className="font-bangla text-base text-foreground-muted mb-10">
              পদার্থবিজ্ঞান, রসায়ন ও উচ্চতর গণিত — সেরা শিক্ষকদের সাথে।
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
              <Button asChild size="lg" data-variant="primary-cta" className="h-12 w-full sm:w-auto">
                <Link to="/signup">
                  Start watching <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="magnetic-btn h-12 w-full sm:w-auto glass text-foreground hover:bg-background-overlay">
                <Link to="/about">
                  <Play className="mr-2 h-4 w-4 fill-current" /> How it works
                </Link>
              </Button>
            </div>

            <div className="mt-10 flex items-center justify-center lg:justify-start gap-6 text-xs text-foreground-muted">
              <div><span className="text-foreground font-semibold text-base">1,400+</span> lessons</div>
              <div className="w-px h-4 bg-border" />
              <div><span className="text-foreground font-semibold text-base">3</span> subjects</div>
              <div className="w-px h-4 bg-border" />
              <div><span className="text-foreground font-semibold text-base">Live</span> classes</div>
            </div>
          </motion.div>

          {/* spacer — Canvas occupies the right visually */}
          <div className="hidden lg:block" />
        </div>
      </section>

      {/* SUBJECTS RAIL ==================================================== */}
      <section className="relative py-24">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7 }}
            className="max-w-2xl mb-12"
          >
            <p className="text-xs font-semibold tracking-widest text-primary uppercase mb-3">The Catalog</p>
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-gradient">
              Three subjects. Zero filler.
            </h2>
            <p className="mt-4 text-foreground-dim">
              Every chapter is structured into cycles so you always know what's next.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-5">
            {displaySubjects.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.7, delay: i * 0.1 }}
                className="poster-card group bg-gradient-card border border-border hover:border-primary/40 p-7 aspect-[4/5] flex flex-col justify-between"
              >
                <div>
                  <div className={`inline-flex w-12 h-12 rounded-xl bg-gradient-to-br ${s.color || 'from-zinc-500 to-zinc-400'} items-center justify-center mb-6 shadow-card`}>
                    <Atom className="w-6 h-6 text-background" strokeWidth={2.5} />
                  </div>
                  <h3 className="font-display text-2xl font-bold mb-1">{s.name}</h3>
                  <p className="font-bangla text-sm text-foreground-muted mb-4">{s.name_bn}</p>
                </div>
                <div className="flex items-center text-sm font-semibold text-foreground-dim group-hover:text-primary transition-colors">
                  Explore <ArrowRight className="ml-1.5 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES ========================================================= */}
      <section className="relative py-24 border-t border-border/50">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7 }}
            className="max-w-2xl mb-14"
          >
            <p className="text-xs font-semibold tracking-widest text-accent uppercase mb-3">Why NexusEdu</p>
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
              Built like a <span className="text-gradient-primary">streaming app</span>.
              <br />Engineered for HSC.
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.07 }}
                className="rounded-2xl p-6 bg-background-elevated border border-border hover:border-border-strong transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-display text-lg font-semibold mb-1.5">{f.title}</h3>
                <p className="text-sm text-foreground-muted leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA ============================================================== */}
      <section className="relative py-32">
        <div className="container">
          <div className="relative rounded-3xl overflow-hidden border border-border bg-gradient-card p-10 md:p-16 text-center">
            <div className="absolute -top-1/2 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/20 blur-3xl pointer-events-none" />
            <div className="relative">
              <h2 className="font-display text-4xl md:text-6xl font-bold tracking-tighter mb-5 text-gradient">
                Your seat is waiting.
              </h2>
              <p className="text-foreground-dim max-w-xl mx-auto mb-8">
                Create your free account and start your first lesson in under a minute.
              </p>
              <Button asChild size="lg" data-variant="primary-cta" className="h-12 w-full sm:w-auto">
                <Link to="/signup">Create free account <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
