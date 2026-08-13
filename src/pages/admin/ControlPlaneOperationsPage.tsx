import { useEffect, useState } from "react";
import { operationsApi } from "@/features/admin-control-plane/api";
import { ControlPlaneShell } from "./ControlPlanePage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, Activity, Database, Send, Shield } from "lucide-react";

type Comp = { status: string; label: string; detail?: string; [k: string]: unknown };
type Diag = { overall_status: string; checked_at: number; components: Record<string, Comp> };

const STATUS_STYLES: Record<string, string> = {
  healthy: "default",
  warning: "secondary",
  critical: "destructive",
  not_configured: "outline",
  unreachable: "destructive",
  unknown: "outline",
};

function StatusBadge({ status }: { status: string }) {
  return <Badge variant={(STATUS_STYLES[status] as any) || "outline"}>{status.replace(/_/g, " ")}</Badge>;
}

export default function ControlPlaneOperations() {
  const [diag, setDiag] = useState<Diag | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    try { setDiag((await operationsApi.diagnostics()) as Diag); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { run(); /* eslint-disable-next-line */ }, []);

  async function maintenance(enabled: boolean) {
    setBusy("maintenance");
    try { await operationsApi.setMaintenance(enabled); toast.success(enabled ? "Maintenance enabled" : "Maintenance disabled"); await run(); }
    catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  }
  async function reinitTelegram() {
    setBusy("telegram");
    try { await operationsApi.reinitTelegram(); toast.success("Telegram webhook re-initialized"); await run(); }
    catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  }

  const overall = diag?.overall_status || "unknown";
  const components = diag?.components || {};

  return (
    <ControlPlaneShell>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Operations</h1>
        <Button size="sm" variant="outline" onClick={run} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Run diagnostics
        </Button>
      </div>

      <Card className="mb-4">
        <CardContent className="pt-4 flex items-center gap-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            overall === "healthy" ? "bg-emerald-500/15 text-emerald-600" :
            overall === "critical" ? "bg-red-500/15 text-red-600" : "bg-amber-500/15 text-amber-600"}`}>
            <Activity className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="text-sm text-foreground-muted">Overall system status</div>
            <div className="text-2xl font-bold capitalize"><StatusBadge status={overall} /></div>
          </div>
          <div className="text-right text-xs text-foreground-muted">
            {diag && <>checked<br />{new Date(diag.checked_at * 1000).toLocaleString()}</>}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 mb-4">
        {Object.entries(components).map(([key, c]) => (
          <Card key={key}>
            <CardHeader className="flex-row items-center justify-between pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                {key === "database" && <Database className="w-4 h-4" />}
                {key === "telegram" && <Send className="w-4 h-4" />}
                {key === "auth" && <Shield className="w-4 h-4" />}
                {c.label}
              </CardTitle>
              <StatusBadge status={c.status} />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground-muted">{String(c.detail || "—")}</p>
              {key === "backend" && c.uptime_seconds != null && (
                <p className="text-xs text-foreground-muted mt-1">uptime {Math.round(Number(c.uptime_seconds) / 60)}m · {String(c.routes)} routes</p>
              )}
              {key === "streaming" && Boolean(c.counts) && (
                <p className="text-xs text-foreground-muted mt-1">
                  {String((c.counts as any).mapped)} mapped · {String((c.counts as any).missing_mapping)} missing
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Safe operational controls</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Maintenance mode</div>
              <div className="text-xs text-foreground-muted">Marks the site as under maintenance. This is audited.</div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={busy === "maintenance"} onClick={() => maintenance(true)}>Enable</Button>
              <Button size="sm" variant="outline" disabled={busy === "maintenance"} onClick={() => maintenance(false)}>Disable</Button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Telegram webhook</div>
              <div className="text-xs text-foreground-muted">Re-register the bot webhook from the configured URL.</div>
            </div>
            <Button size="sm" variant="outline" disabled={busy === "telegram"} onClick={reinitTelegram}>Reinitialize</Button>
          </div>
        </CardContent>
      </Card>
    </ControlPlaneShell>
  );
}
