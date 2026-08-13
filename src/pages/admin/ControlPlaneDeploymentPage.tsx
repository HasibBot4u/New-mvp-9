import { useEffect, useState } from "react";
import { readinessApi } from "@/features/admin-control-plane/api";
import { ControlPlaneShell } from "./ControlPlanePage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type D = Record<string, any>;

export default function ControlPlaneDeployment() {
  const [d, setD] = useState<D | null>(null);
  useEffect(() => { readinessApi.deployment().then(setD as any).catch(() => {}); }, []);
  const checks = d?.checks || {};
  const metrics = d?.runtime_metrics || {};
  return (
    <ControlPlaneShell>
      <h1 className="text-2xl font-bold mb-4">Deployment</h1>
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Readiness score</CardTitle></CardHeader>
        <CardContent>
          <div className="text-2xl font-bold mb-2">{d?.readiness_score ?? "—"}/5</div>
          <div className="grid gap-1 text-sm">
            {Object.entries(checks).map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-border py-1">
                <span className="font-mono text-xs">{k}</span>
                {typeof v === "number" ? <span>{v} SQL files</span> : <Badge variant={v ? "default" : "destructive"}>{v ? "ok" : "missing"}</Badge>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Runtime metrics</CardTitle></CardHeader>
        <CardContent className="text-sm grid grid-cols-2 gap-2">
          <div>Uptime: <strong>{Math.round((metrics.uptime_seconds || 0)/60)}m</strong></div>
          <div>Requests: <strong>{metrics.request_count ?? 0}</strong></div>
          <div>Errors: <strong>{metrics.error_count ?? 0}</strong></div>
          <div>Telegram: <Badge variant={metrics.telegram_connected ? "default" : "secondary"}>{metrics.telegram_connected ? "connected" : "down"}</Badge></div>
        </CardContent>
      </Card>
    </ControlPlaneShell>
  );
}
