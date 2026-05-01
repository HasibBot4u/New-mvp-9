import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { NexusLogo } from "@/components/brand/NexusLogo";

export function AuthShell({ title, subtitle, children, footer }: {
  title: string; subtitle?: string; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Left — cinematic panel */}
      <aside className="relative hidden md:flex md:w-1/2 lg:w-2/5 overflow-hidden bg-gradient-card border-r border-border">
        <div className="absolute inset-0">
          <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-primary/30 blur-3xl animate-pulse-glow" />
          <div className="absolute -bottom-40 -right-20 w-[400px] h-[400px] rounded-full bg-accent/20 blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-between p-10 lg:p-14 w-full">
          <NexusLogo size="lg" />
          <div>
            <h2 className="font-display text-4xl lg:text-5xl font-bold tracking-tighter mb-4 text-gradient">
              Cinematic learning, every day.
            </h2>
            <p className="text-foreground-dim max-w-md">
              Curated HSC lessons, premium player, no distractions.
            </p>
            <p className="font-bangla text-sm text-foreground-muted mt-3">তোমার শিক্ষার নতুন দিগন্ত</p>
          </div>
          <div className="text-xs text-foreground-muted">© {new Date().getFullYear()} NexusEdu</div>
        </div>
      </aside>

      {/* Right — form */}
      <main className="flex-1 flex flex-col">
        <div className="md:hidden p-5 border-b border-border"><NexusLogo /></div>
        <div className="flex-1 flex items-center justify-center px-5 py-10">
          <div className="w-full max-w-sm">
            <h1 className="font-display text-3xl font-bold tracking-tight mb-2">{title}</h1>
            {subtitle && <p className="text-sm text-foreground-dim mb-8">{subtitle}</p>}
            {children}
            {footer && <div className="mt-6 text-center text-sm text-foreground-muted">{footer}</div>}
          </div>
        </div>
        <div className="px-5 pb-6 flex justify-center gap-4 text-xs text-foreground-muted">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <span>·</span>
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <span>·</span>
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
        </div>
      </main>
    </div>
  );
}
