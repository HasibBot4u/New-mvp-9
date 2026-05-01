import { NavLink } from "react-router-dom";
import { LayoutDashboard, Search, Bell, UserCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Mobile quick nav — mirrors a subset of the strict sidebar.
const items = [
  { to: "/dashboard",       icon: LayoutDashboard, label: "ড্যাশবোর্ড" },
  { to: "/search",          icon: Search,          label: "সার্চ" },
  { to: "/notifications",   icon: Bell,            label: "নোটিফিকেশন" },
  { to: "/profile",         icon: UserCircle2,     label: "প্রোফাইল" },
];

export function StudentBottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden glass-strong border-t border-border/50">
      <div className="grid grid-cols-4 h-16">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-0.5 transition-colors",
                isActive ? "text-primary" : "text-foreground-muted",
              )
            }
          >
            <Icon className="w-5 h-5" />
            <span className="bangla text-[10px] font-medium">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
