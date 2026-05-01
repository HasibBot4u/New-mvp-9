import { Link, NavLink, useNavigate } from "react-router-dom";
import { Bell, Search, LogOut, ShieldCheck, User as UserIcon, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { NexusLogo } from "@/components/brand/NexusLogo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const links = [
  { to: "/dashboard", label: "ড্যাশবোর্ড" },
  { to: "/subject/physics", label: "পদার্থবিজ্ঞান" },
  { to: "/subject/chemistry", label: "রসায়ন" },
  { to: "/subject/math", label: "উচ্চতর গণিত" },
];

export function StudentTopbar() {
  const { profile, isAdmin, signOut } = useAuth();
  const nav = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!profile) return;
    supabase.from("notifications").select("*", { count: "exact", head: true })
      .eq("user_id", profile.id).eq("is_read", false)
      .then(({ count }) => setUnread(count ?? 0));
  }, [profile]);

  const handleSignOut = async () => { await signOut(); nav("/", { replace: true }); };
  const initial = profile?.display_name?.charAt(0).toUpperCase() ?? "U";

  return (
    <header className={cn(
      "sticky top-0 z-40 transition-all duration-300",
      scrolled ? "glass-strong border-b border-border/50" : "bg-background/80 backdrop-blur"
    )}>
      <div className="container flex items-center justify-between h-16">
        <div className="flex items-center gap-4 md:gap-8">
          <div className="scale-90 md:scale-100 origin-left">
            <NexusLogo />
          </div>
          <nav className="hidden md:flex items-center gap-1">
            {links.map(l => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => cn(
                "px-3.5 py-1.5 text-sm font-medium rounded-full transition-colors bangla",
                isActive ? "text-foreground bg-background-overlay" : "text-foreground-muted hover:text-foreground"
              )}>{l.label}</NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" asChild className="rounded-full hover:bg-background-overlay">
            <Link to="/search" aria-label="Search"><Search className="w-5 h-5" /></Link>
          </Button>
          <Button variant="ghost" size="icon" asChild className="rounded-full hover:bg-background-overlay relative">
            <Link to="/notifications" aria-label="Notifications">
              <Bell className="w-5 h-5" />
              {unread > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary animate-pulse-glow" />}
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button aria-label="User account menu" className="ml-1 w-9 h-9 rounded-full bg-gradient-primary text-primary-foreground flex items-center justify-center font-semibold text-sm hover:shadow-glow transition-shadow">
                {initial}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 glass-strong">
              <DropdownMenuLabel>
                <p className="text-sm font-semibold truncate">{profile?.display_name ?? "Account"}</p>
                <p className="text-xs text-foreground-muted truncate font-normal">{profile?.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link to="/profile"><UserIcon className="w-4 h-4 mr-2" /> Profile</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/notes"><Settings className="w-4 h-4 mr-2" /> My notes</Link></DropdownMenuItem>
              {isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/admin/dashboard">
                      <ShieldCheck className="w-4 h-4 mr-2 text-accent" />
                      <span className="bangla">অ্যাডমিন প্যানেল</span>
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                <LogOut className="w-4 h-4 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
