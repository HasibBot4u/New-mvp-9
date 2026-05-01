import { motion } from "framer-motion";
import { Sparkles, Target, HeartHandshake, Trophy } from "lucide-react";
import { useSystemSettings } from "@/contexts/SystemSettingsContext";

const values = [
  { icon: Target, title: "Focus", desc: "Three subjects, deep coverage. No filler, no clickbait." },
  { icon: Sparkles, title: "Craft", desc: "Every lesson, page, and pixel is treated like a feature film." },
  { icon: HeartHandshake, title: "Access", desc: "Affordable, mobile-first, works on the slowest networks." },
  { icon: Trophy, title: "Outcomes", desc: "Built for HSC results — not vanity metrics." },
];

export default function AboutPage() {
  const { settings } = useSystemSettings();

  return (
    <>
      <section className="container max-w-4xl py-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-3">About</p>
          <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tighter mb-6 text-gradient">
            HSC, reimagined for the streaming era.
          </h1>
          <p className="text-lg text-foreground-dim max-w-2xl leading-relaxed">
            {settings.platform_name} is built by a small team that thinks education software should feel as good as the apps you actually want to open. Cinematic dark UI, lessons grouped into focused cycles, a player that respects your time.
          </p>
        </motion.div>
      </section>

      <section className="container max-w-4xl pb-24">
        <div className="grid md:grid-cols-2 gap-4">
          {values.map((v, i) => (
            <motion.div key={v.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
              className="rounded-2xl p-7 bg-background-elevated border border-border hover:border-border-strong transition-colors"
            >
              <v.icon className="w-7 h-7 text-primary mb-4" strokeWidth={1.7} />
              <h3 className="font-display text-xl font-semibold mb-2">{v.title}</h3>
              <p className="text-sm text-foreground-muted leading-relaxed">{v.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </>
  );
}
