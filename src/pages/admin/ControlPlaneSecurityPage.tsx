import { useEffect, useState } from "react";
import { securityApi } from "@/features/admin-control-plane/api";
import { ControlPlaneShell } from "./ControlPlanePage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Check } from "lucide-react";

export default function ControlPlaneSecurity() {
  const [data, setData] = useState<Record<string, any> | null>(null);
  useEffect(() => { securityApi.posture().then(setData as any).catch(() => {}); }, []);
  const secrets = data?.secrets_configured || {};
  return (
    <ControlPlaneShell>
      <h1 className="text-2xl font-bold mb-1 flex items-center gap-2"><Shield className="w-5 h-5" /> Security</h1>
      <p className="text-sm text-foreground-muted mb-4">
        Fundamental protections (authentication, RLS, ticket signing, enrollment, owner recovery) are always on and cannot be disabled.
      </p>
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Always-on protections</CardTitle></CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm md:grid-cols-2">
            {(data?.always_on_protections || []).map((p: string) => (
              <li key={p} className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600" /> {p}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Secret configuration</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {Object.entries(secrets).map(([k, v]) => (
              <div key={k} className="flex justify-between py-1 border-b border-border last:border-0">
                <span className="font-mono text-xs">{k}</span>
                <Badge variant={v ? "default" : "destructive"}>{v ? "configured" : "missing"}</Badge>
              </div>
            ))}
            <p className="text-xs text-foreground-muted mt-2">Only presence is shown — values are never exposed.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Streaming limits</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div>Concurrent per user: <strong>{data?.streaming_limits?.max_concurrent_per_user ?? "—"}</strong></div>
            <div>Range max: <strong>{data?.streaming_limits?.range_max_mb ?? "—"} MB</strong></div>
            <div>Ticket TTL: <strong>{Math.round((data?.streaming_limits?.ticket_ttl_seconds || 0)/60)} min</strong></div>
            <div>Maintenance: <Badge variant={data?.maintenance ? "secondary" : "outline"}>{data?.maintenance ? "on" : "off"}</Badge></div>
          </CardContent>
        </Card>
      </div>
    </ControlPlaneShell>
  );
}
