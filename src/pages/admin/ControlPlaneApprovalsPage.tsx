import { useEffect, useState } from "react";
import { approvalsApi } from "@/features/admin-control-plane/api";
import { ControlPlaneShell } from "./ControlPlanePage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Row = Record<string, any>;

export default function ControlPlaneApprovals() {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState("pending");
  const [detail, setDetail] = useState<Row | null>(null);

  async function load() {
    try { setRows((await approvalsApi.list({ status: filter }) as Row[]) || []); }
    catch (e: any) { toast.error(e.message); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  async function act(id: string, fn: (id: string) => Promise<unknown>, label: string) {
    try { await fn(id); toast.success(`${label} done`); await load(); }
    catch (e: any) { toast.error(e.message); }
  }

  return (
    <ControlPlaneShell>
      <h1 className="text-2xl font-bold mb-4">Approvals</h1>
      <Card className="mb-4">
        <CardContent className="pt-4 flex gap-2">
          {["pending","approved","rejected","executed","all"].map((s) => (
            <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)}>{s}</Button>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Change requests</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? <p className="text-sm text-foreground-muted">No requests.</p> : (
            <div className="divide-y divide-border">
              {rows.map((r) => (
                <div key={r.id} className="py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{r.action} <span className="text-foreground-muted text-xs">({r.resource_type})</span></div>
                    <div className="text-xs text-foreground-muted font-mono">{r.id?.slice(0,8)} · by {r.requester_id?.slice(0,8)}</div>
                  </div>
                  <Badge>{r.status}</Badge>
                  <Button size="sm" variant="ghost" onClick={() => setDetail(r)}>Details</Button>
                  {r.status === "pending" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => act(r.id, approvalsApi.approve, "Approved")}>Approve</Button>
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => act(r.id, approvalsApi.reject, "Rejected")}>Reject</Button>
                    </>
                  )}
                  {r.status === "approved" && (
                    <Button size="sm" onClick={() => act(r.id, approvalsApi.execute, "Executed")}>Execute</Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {detail && (
        <DialogOpen title="Request details" onClose={() => setDetail(null)}>
          <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-80">{JSON.stringify(detail, null, 2)}</pre>
        </DialogOpen>
      )}
    </ControlPlaneShell>
  );
}

function DialogOpen({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-card rounded-lg max-w-2xl w-full p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-3">{title}</h3>
        {children}
        <div className="text-right mt-3"><Button variant="outline" onClick={onClose}>Close</Button></div>
      </div>
    </div>
  );
}
