import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { NexusLogo } from "@/components/brand/NexusLogo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const links = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/success-stories", label: "Stories" },
  { to: "/contact", label: "Contact" },
];

export function PublicNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-500",
        scrolled ? "glass-strong border-b border-border/50" : "bg-transparent"
      )}
    >
      <div className="container flex items-center justify-between h-16 md:h-20">
        <NexusLogo />

        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-full transition-colors",
                pathname === l.to
                  ? "text-foreground bg-background-overlay"
                  : "text-foreground-dim hover:text-foreground"
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          {isLoading ? (
            <div className="w-32 h-10 animate-pulse bg-white/5 rounded-full" />
          ) : user ? (
            <Button asChild className="rounded-full bg-primary hover:bg-primary-glow text-primary-foreground font-semibold px-5 shadow-glow/40 hover:shadow-glow transition-shadow">
              <Link to="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" asChild className="rounded-full text-foreground-dim hover:text-foreground hover:bg-background-overlay">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild className="rounded-full bg-primary hover:bg-primary-glow text-primary-foreground font-semibold px-5 shadow-glow/40 hover:shadow-glow transition-shadow">
                <Link to="/signup">Start free</Link>
              </Button>
            </>
          )}
        </div>

        <button
          className="md:hidden p-2 rounded-full hover:bg-background-overlay"
          onClick={() => setOpen(o => !o)}
          aria-label="Menu / মেনু"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden glass-strong border-t border-border/50 animate-fade-in">
          <div className="container py-4 flex flex-col gap-1">
            {links.map((l) => (
              <Link key={l.to} to={l.to} className="px-3 py-3 rounded-lg text-foreground-dim hover:text-foreground hover:bg-background-overlay">
                {l.label}
              </Link>
            ))}
            <div className="flex gap-2 pt-2">
              {isLoading ? null : user ? (
                <Button asChild className="flex-1 rounded-full bg-primary hover:bg-primary-glow"><Link to="/dashboard">Dashboard</Link></Button>
              ) : (
                <>
                  <Button variant="outline" asChild className="flex-1 rounded-full"><Link to="/login">Sign in</Link></Button>
                  <Button asChild className="flex-1 rounded-full bg-primary hover:bg-primary-glow"><Link to="/signup">Start free</Link></Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
