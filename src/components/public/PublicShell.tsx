import { ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { PublicNavbar } from "@/components/public/PublicNavbar";
import { PublicFooter } from "@/components/public/PublicFooter";

export function PublicShell({ children }: { children?: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PublicNavbar />
      <main className="flex-1 pt-24">{children ?? <Outlet />}</main>
      <PublicFooter />
    </div>
  );
}

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <article className="container max-w-3xl py-16">
      <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-3">Legal</p>
      <h1 className="font-display text-5xl font-bold tracking-tighter mb-3">{title}</h1>
      <p className="text-sm text-foreground-muted mb-12">Last updated: {updated}</p>
      <div className="prose prose-invert max-w-none [&_h2]:font-display [&_h2]:text-2xl [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:font-bold [&_p]:text-foreground-dim [&_p]:leading-relaxed [&_li]:text-foreground-dim [&_a]:text-primary">
        {children}
      </div>
    </article>
  );
}
