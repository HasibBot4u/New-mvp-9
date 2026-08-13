import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { controlPlaneApi } from "@/features/admin-control-plane/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Settings as SettingsIcon, Flag, Users, BookOpen, GraduationCap, CreditCard, Send, Radio, Activity, ScrollText, Database, Rocket, CheckCircle2, ShieldCheck } from "lucide-react";

type Status = {
  status: string;
  maintenance: boolean;
  active_flags: Record<string, boolean>;
  site: string;
};

const NAV = [
  { to: "/admin/control-plane", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/control-plane/settings", label: "Settings", icon: SettingsIcon },
  { to: "/admin/control-plane/flags", label: "Feature Flags", icon: Flag },
  { to: "/admin/control-plane/users", label: "Users & Roles", icon: Users },
  { to: "/admin/control-plane/content", label: "Content", icon: BookOpen },
  { to: "/admin/control-plane/enrollment", label: "Enrollment", icon: GraduationCap },
  { to: "/admin/control-plane/payments", label: "Payments", icon: CreditCard, enabled: false },
  { to: "/admin/control-plane/telegram", label: "Telegram", icon: Send },
  { to: "/admin/control-plane/streaming", label: "Streaming", icon: Radio },
  { to: "/admin/control-plane/operations", label: "Operations", icon: Activity },
  { to: "/admin/control-plane/backups", label: "Backups", icon: Database },
  { to: "/admin/control-plane/deployment", label: "Deployment", icon: Rocket },
  { to: "/admin/control-plane/approvals", label: "Approvals", icon: CheckCircle2 },
  { to: "/admin/control-plane/audit", label: "Audit", icon: ScrollText },
  { to: "/admin/control-plane/security", label: "Security", icon: ShieldCheck },
];

export function ControlPlaneShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div className="grid gap-6 md:grid-cols-[240px_1fr]">
      <aside className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground-muted px-2 mb-2">Control Plane</h2>
        {NAV.map((item) => {
          const active = item.end ? pathname === item.to : pathname.startsWith(item.to);
          const disabled = "enabled" in item && item.enabled === false;
          return (
            <Button
              key={item.to}
              asChild={!disabled}
              variant={active ? "secondary" : "ghost"}
              className="w-full justify-start"
              disabled={disabled}
            >
              {disabled ? (
                <span className="flex items-center gap-2 opacity-50">
                  <item.icon className="w-4 h-4" />
                  {item.label}
                  <Badge variant="outline" className="ml-auto text-[10px]">soon</Badge>
                </span>
              ) : (
                <Link to={item.to} className="flex items-center gap-2">
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              )}
            </Button>
          );
        })}
      </aside>
      <section>{children}</section>
    </div>
  );
}

export default function ControlPlaneDashboard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audit, setAudit] = useState<unknown[]>([]);

  useEffect(() => {
    Promise.allSettled([controlPlaneApi.status(), controlPlaneApi.getAudit(10)])
      .then(([s, a]) => {
        if (s.status === "fulfilled") setStatus(s.value);
        else setError(s.reason?.message || "Unable to load status");
        if (a.status === "fulfilled") setAudit(a.value);
      });
  }, []);

  return (
    <ControlPlaneShell>
      <h1 className="text-2xl font-bold mb-4">Control Plane Dashboard</h1>
      {error && <div className="mb-4 rounded-md bg-red-500/10 text-red-600 p-3 text-sm">{error}</div>}

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">System</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize flex items-center gap-2">
              {status ? (
                <>
                  <span className={`w-2.5 h-2.5 rounded-full ${status.maintenance ? "bg-amber-500" : "bg-emerald-500"}`} />
                  {status.status}
                </>
              ) : "—"}
            </div>
            {status?.maintenance && <p className="text-xs text-amber-600 mt-1">Maintenance mode active</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Site</CardTitle></CardHeader>
          <CardContent className="text-lg font-semibold">{status?.site ?? "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Active Flags</CardTitle></CardHeader>
          <CardContent>
            {status ? (
              status.active_flags && Object.keys(status.active_flags).length ? (
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(status.active_flags).map(([k]) => (
                    <Badge key={k}>{k}</Badge>
                  ))}
                </div>
              ) : <span className="text-foreground-muted text-sm">None enabled</span>
            ) : "—"}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent admin activity</CardTitle></CardHeader>
        <CardContent>
          {Array.isArray(audit) && audit.length ? (
            <ul className="divide-y divide-border text-sm">
              {audit.map((e: any) => (
                <li key={e.id} className="py-2 flex items-center justify-between gap-3">
                  <span>
                    <strong>{e.action}</strong>{" "}
                    <span className="text-foreground-muted">{e.resource}</span>
                  </span>
                  <span className="text-xs text-foreground-muted">
                    {new Date(e.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-foreground-muted">No audit events yet.</p>}
        </CardContent>
      </Card>
    </ControlPlaneShell>
  );
}
