import { useEffect, useState } from "react";
import { auditApi } from "@/features/admin-control-plane/api";
import { ControlPlaneShell } from "./ControlPlanePage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Row = Record<string, any>;

export default function ControlPlaneAudit() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [resource, setResource] = useState("");
  const [detail, setDetail] = useState<Row | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, any> = { limit: 100 };
      if (resource) params.resource = resource;
      setRows((await auditApi.list(params) as Row[]) || []);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [resource]);

  return (
    <ControlPlaneShell>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Audit log</h1>
        <div className="flex gap-2 items-center">
          <input className="text-sm rounded border bg-background px-2 py-1" placeholder="filter by resource"
                 value={resource} onChange={(e) => setResource(e.target.value)} />
          <Button size="sm" variant="outline" onClick={load}>Refresh</Button>
          <a href={auditApi.exportUrl}><Button size="sm" variant="outline">Export JSON</Button></a>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Events {loading && "— loading…"}</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? <p className="text-sm text-foreground-muted">No events.</p> : (
            <div className="divide-y divide-border">
              {rows.map((r) => (
                <div key={r.id} className="py-2 flex items-center gap-3">
                  <Badge variant="outline">{r.action}</Badge>
                  <span className="text-xs text-foreground-muted">{r.resource}{r.resource_id ? `/${String(r.resource_id).slice(0,8)}` : ""}</span>
                  <span className="flex-1" />
                  <span className="text-xs text-foreground-muted">{new Date(r.created_at).toLocaleString()}</span>
                  <Button size="sm" variant="ghost" onClick={() => setDetail(r)}>View</Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetail(null)}>
          <div className="bg-card rounded-lg max-w-2xl w-full p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-3">Event detail</h3>
            <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-96">{JSON.stringify(detail, null, 2)}</pre>
            <div className="text-right mt-3"><Button variant="outline" onClick={() => setDetail(null)}>Close</Button></div>
          </div>
        </div>
      )}
    </ControlPlaneShell>
  );
}
