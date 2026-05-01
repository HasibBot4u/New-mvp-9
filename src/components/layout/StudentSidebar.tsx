import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Atom,
  FlaskConical,
  Sigma,
  Bell,
  UserCircle2,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { NexusLogo } from "@/components/brand/NexusLogo";
import { cn } from "@/lib/utils";

// STRICT: only these six items, in this order, with exact Bangla labels and routes.
const items = [
  { to: "/dashboard",          label: "ড্যাশবোর্ড",      icon: LayoutDashboard },
  { to: "/subject/physics",    label: "পদার্থবিজ্ঞান",   icon: Atom },
  { to: "/subject/chemistry",  label: "রসায়ন",           icon: FlaskConical },
  { to: "/subject/math",       label: "উচ্চতর গণিত",     icon: Sigma },
  { to: "/notifications",      label: "নোটিফিকেশন",      icon: Bell },
  { to: "/profile",            label: "আমার প্রোফাইল",   icon: UserCircle2 },
];

export function StudentSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50">
      <SidebarHeader className="h-16 flex items-center px-3 border-b border-border/40">
        {!collapsed ? <NexusLogo /> : <div className="w-8 h-8 rounded-lg bg-gradient-primary" />}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="bangla">মেনু</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = pathname === item.to || pathname.startsWith(item.to + "/");
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={active}>
                      <NavLink
                        to={item.to}
                        className={cn(
                          "group flex items-center gap-3 rounded-lg",
                          active
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-foreground-muted hover:text-foreground",
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="bangla truncate">{item.label}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
