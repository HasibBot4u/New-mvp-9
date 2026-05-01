import { motion } from "framer-motion";
import { Star } from "lucide-react";

const stories = [
  { name: "Tahmid Rahman", board: "Dhaka Board", quote: "I went from struggling in Physics to GPA 5. The cycle structure made everything click.", grade: "A+" },
  { name: "Sumaiya Akter",  board: "Chittagong Board", quote: "The cinematic player keeps me focused. I actually want to study now.", grade: "A+" },
  { name: "Rakib Hasan",    board: "Rajshahi Board", quote: "Higher Math finally made sense after watching the calculus cycle twice.", grade: "A" },
  { name: "Nusrat Jahan",   board: "Sylhet Board",   quote: "Live classes are the difference. Real teachers, real-time doubts cleared.", grade: "A+" },
  { name: "Faruk Ahmed",    board: "Barishal Board", quote: "Notes feature is a lifesaver. I revise from my own annotations every night.", grade: "A+" },
  { name: "Anika Tasnim",   board: "Khulna Board",   quote: "I tried three platforms — only NexusEdu felt premium without being expensive.", grade: "A" },
];

export default function SuccessStoriesPage() {
  return (
    <>
      <section className="container max-w-6xl py-20">
        <p className="text-xs uppercase tracking-widest text-accent font-semibold mb-3">Stories</p>
        <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tighter mb-3 text-gradient">
          Real students. Real results.
        </h1>
        <p className="text-foreground-dim max-w-2xl mb-14">A few of the thousands of HSC students who chose NexusEdu.</p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stories.map((s, i) => (
            <motion.div key={s.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="rounded-2xl p-6 bg-gradient-card border border-border hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center gap-1 text-accent mb-4">
                {Array.from({ length: 5 }).map((_, k) => <Star key={k} className="w-3.5 h-3.5 fill-current" />)}
              </div>
              <p className="text-foreground-dim leading-relaxed mb-6">"{s.quote}"</p>
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div>
                  <p className="font-semibold text-sm">{s.name}</p>
                  <p className="text-xs text-foreground-muted">{s.board}</p>
                </div>
                <span className="font-display font-bold text-2xl text-gradient-primary">{s.grade}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </>
  );
}
