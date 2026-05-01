import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, BookOpen, Megaphone, Radio, ArrowLeft, LogOut, ScrollText, ServerCog, Ticket } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { NexusLogo } from "@/components/brand/NexusLogo";

const items = [
  { to: "/admin", end: true, icon: LayoutDashboard, label: "Overview" },
  { to: "/admin/users", icon: Users, label: "Users" },
  { to: "/admin/content", icon: BookOpen, label: "Content" },
  { to: "/admin/enrollment", icon: Ticket, label: "এনরোলমেন্ট কোড" },
  { to: "/admin/announcements", icon: Megaphone, label: "Announcements" },
  { to: "/admin/live", icon: Radio, label: "Live classes" },
  { to: "/admin/logs", icon: ScrollText, label: "লগ" },
  { to: "/admin/system", icon: ServerCog, label: "সিস্টেম সেটিংস" },
];

export function AdminLayout() {
  const { signOut } = useAuth();
  const nav = useNavigate();
  return (
    <div data-layout="app-shell" className="min-h-screen bg-background grid grid-cols-1 md:grid-cols-[260px_1fr]">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-[999] bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium">
        Skip to main content / মূল কন্টেন্টে যান
      </a>
      <aside className="hidden md:flex flex-col border-r border-white/5 bg-surface/40 backdrop-blur-xl p-5 gap-2 sticky top-0 h-screen">
        <div className="flex items-center gap-2 px-2 mb-4">
          <NexusLogo size="sm" href="/admin" />
          <span className="text-[10px] uppercase tracking-widest text-foreground-muted px-1.5 py-0.5 rounded bg-primary/15 text-primary ml-1">Admin</span>
        </div>
        <nav className="flex-1 flex flex-col gap-1">
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end as any}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                  isActive ? "bg-primary/15 text-primary shadow-glow" : "text-foreground-dim hover:text-foreground hover:bg-white/5"
                }`}>
              <it.icon className="w-4 h-4" />
              <span>{it.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="flex flex-col gap-1">
          <button onClick={() => nav("/dashboard")} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-foreground-dim hover:text-foreground hover:bg-white/5">
            <ArrowLeft className="w-4 h-4" /> Back to app
          </button>
          <button onClick={async () => { await signOut(); nav("/"); }} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-destructive hover:bg-destructive/10">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>
      <main id="main-content" className="min-h-screen">
        <div className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 border-b border-white/5 bg-background/80 backdrop-blur-xl">
          <NexusLogo size="sm" href="/admin" />
          <button onClick={() => nav("/dashboard")} className="text-xs text-foreground-dim hover:text-foreground">Exit</button>
        </div>
        <div className="md:hidden border-b border-white/5 overflow-x-auto">
          <div className="flex gap-1 p-2 min-w-max">
            {items.map((it) => (
              <NavLink key={it.to} to={it.to} end={it.end as any}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded-full text-xs whitespace-nowrap ${
                    isActive ? "bg-primary text-primary-foreground" : "bg-white/5 text-foreground-dim"
                  }`}>
                <it.icon className="w-3.5 h-3.5" /> {it.label}
              </NavLink>
            ))}
          </div>
        </div>
        <div className="p-5 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
