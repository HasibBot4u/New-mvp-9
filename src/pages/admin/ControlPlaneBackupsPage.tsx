import { useEffect, useState } from "react";
import { readinessApi } from "@/features/admin-control-plane/api";
import { ControlPlaneShell } from "./ControlPlanePage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type D = Record<string, any>;

export default function ControlPlaneBackups() {
  const [d, setD] = useState<D | null>(null);
  useEffect(() => { readinessApi.backups().then(setD as any).catch(() => {}); }, []);
  return (
    <ControlPlaneShell>
      <h1 className="text-2xl font-bold mb-4">Backups</h1>
      <Card>
        <CardHeader><CardTitle className="text-base">Database backup readiness</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          <Row label="Backup workflow" ok={d?.workflow_present} />
          <Row label="SUPABASE_DB_URI GitHub secret" ok={d?.github_secret_configured} />
          <Row label="Schedule" value={d?.schedule || "—"} />
          <div>Status: <Badge variant={d?.status === "ready" ? "default" : "secondary"}>{d?.status || "—"}</Badge></div>
          {d?.owner_action_required && (
            <p className="text-amber-600 text-xs">
              Add the SUPABASE_DB_URI secret in GitHub and copy docs/operations/db-backup.workflow.yml to .github/workflows/ to activate weekly backups.
            </p>
          )}
          <p className="text-xs text-foreground-muted">
            Live backup artifacts cannot be inspected from here without GitHub credentials — run a workflow and check its artifacts in GitHub Actions.
          </p>
        </CardContent>
      </Card>
    </ControlPlaneShell>
  );
}

function Row({ label, ok, value }: { label: string; ok?: boolean; value?: string }) {
  return (
    <div className="flex justify-between py-1 border-b border-border last:border-0">
      <span>{label}</span>
      {ok !== undefined ? <Badge variant={ok ? "default" : "destructive"}>{ok ? "present" : "missing"}</Badge>
        : <span>{value}</span>}
    </div>
  );
}
