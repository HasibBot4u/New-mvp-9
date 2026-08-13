import { useEffect, useState } from "react";
import { enrollmentApi } from "@/features/admin-control-plane/api";
import { ControlPlaneShell } from "./ControlPlanePage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { KeyRound, CreditCard, CheckCircle2, XCircle } from "lucide-react";

type Row = Record<string, any>;
type Tab = "payments" | "codes" | "enrollments";

export default function ControlPlaneEnrollment() {
  const [tab, setTab] = useState<Tab>("payments");
  return (
    <ControlPlaneShell>
      <h1 className="text-2xl font-bold mb-1">Enrollment &amp; Payments</h1>
      <p className="text-sm text-foreground-muted mb-4">
        Manual bKash/Nagad payments, access codes, and chapter access. Online card payments are not implemented.
      </p>
      <div className="flex gap-2 mb-4">
        <Button size="sm" variant={tab === "payments" ? "default" : "outline"} onClick={() => setTab("payments")}><CreditCard className="w-4 h-4 mr-1" /> Payments</Button>
        <Button size="sm" variant={tab === "codes" ? "default" : "outline"} onClick={() => setTab("codes")}><KeyRound className="w-4 h-4 mr-1" /> Access Codes</Button>
        <Button size="sm" variant={tab === "enrollments" ? "default" : "outline"} onClick={() => setTab("enrollments")}>Enrollments</Button>
      </div>
      {tab === "payments" && <PaymentsPanel />}
      {tab === "codes" && <CodesPanel />}
      {tab === "enrollments" && <EnrollmentsPanel />}
    </ControlPlaneShell>
  );
}

function PaymentsPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState("pending");
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: "approve" | "reject"; row: Row } | null>(null);

  async function load() {
    setLoading(true);
    try { setRows((await enrollmentApi.listPayments(status)) as Row[]); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  async function act() {
    if (!confirm) return;
    try {
      if (confirm.kind === "approve") {
        await enrollmentApi.approvePayment(confirm.row.id);
        toast.success("Payment approved — access granted");
      } else {
        await enrollmentApi.rejectPayment(confirm.row.id);
        toast.success("Payment rejected");
      }
      setConfirm(null); await load();
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <>
      <Card className="mb-4">
        <CardContent className="pt-4 flex gap-2">
          {["pending", "approved", "rejected", "all"].map((s) => (
            <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(s)}>{s}</Button>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Manual payments {loading && "— loading…"}</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? <p className="text-sm text-foreground-muted">No payments.</p> : (
            <div className="divide-y divide-border">
              {rows.map((r) => (
                <div key={r.id} className="py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{r.profiles?.display_name || r.profiles?.email || r.user_id?.slice(0, 8)}</div>
                    <div className="text-xs text-foreground-muted">
                      {r.chapters?.name || r.chapter_id?.slice(0, 8)} · ৳{r.amount} · {r.payment_method} · Trx: <span className="font-mono">{r.transaction_id}</span>
                    </div>
                  </div>
                  <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>{r.status}</Badge>
                  {r.status === "pending" && (
                    <>
                      <Button size="sm" variant="ghost" className="text-emerald-600" onClick={() => setConfirm({ kind: "approve", row: r })}><CheckCircle2 className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setConfirm({ kind: "reject", row: r })}><XCircle className="w-4 h-4" /></Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog open={!!confirm} onOpenChange={() => setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm?.kind === "approve" ? "Approve payment" : "Reject payment"}</DialogTitle>
            <DialogDescription>
              {confirm?.kind === "approve"
                ? "This grants the user chapter access. The action is recorded in the audit log."
                : "The user will not be granted access."}
            </DialogDescription>
          </DialogHeader>
          {confirm && (
            <div className="text-sm space-y-1">
              <p>User: <strong>{confirm.row.profiles?.email || confirm.row.user_id?.slice(0, 8)}</strong></p>
              <p>Amount: ৳{confirm.row.amount} · {confirm.row.payment_method}</p>
              <p>Transaction: <span className="font-mono">{confirm.row.transaction_id}</span></p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant={confirm?.kind === "approve" ? "default" : "destructive"} onClick={act}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CodesPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ chapter_id: "", max_uses: "1", label: "", expires_at: "" });

  async function load() {
    try { setRows((await enrollmentApi.listCodes()) as Row[]); } catch (e: any) { toast.error(e.message); }
  }
  useEffect(() => { load(); }, []);

  async function create() {
    try {
      await enrollmentApi.createCode({
        chapter_id: form.chapter_id || undefined,
        max_uses: Number(form.max_uses),
        label: form.label || undefined,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : undefined,
      });
      toast.success("Code created");
      setCreating(false);
      setForm({ chapter_id: "", max_uses: "1", label: "", expires_at: "" });
      await load();
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <>
      <div className="flex justify-end mb-4"><Button onClick={() => setCreating(true)}>Generate code</Button></div>
      <Card>
        <CardHeader><CardTitle className="text-base">Access codes</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? <p className="text-sm text-foreground-muted">No codes yet.</p> : (
            <div className="divide-y divide-border">
              {rows.map((r) => (
                <div key={r.id} className="py-3 flex items-center gap-3">
                  <code className="font-mono text-sm bg-muted px-2 py-0.5 rounded">{r.code}</code>
                  <div className="flex-1 text-xs text-foreground-muted">
                    {r.label && <span>{r.label} · </span>}
                    {r.uses_count ?? 0}/{r.max_uses} used · {r.chapters?.name || r.chapter_id?.slice(0, 8)}
                    {r.expires_at && ` · expires ${new Date(r.expires_at).toLocaleDateString()}`}
                  </div>
                  <Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "active" : "inactive"}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate access code</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Chapter ID</Label><Input value={form.chapter_id} onChange={(e) => setForm({ ...form, chapter_id: e.target.value })} placeholder="UUID" /></div>
            <div><Label>Maximum uses</Label><Input type="number" min={1} value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} /></div>
            <div><Label>Label (optional)</Label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></div>
            <div><Label>Expires at (optional)</Label><Input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
            <Button onClick={create}>Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EnrollmentsPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    enrollmentApi.listEnrollments().then((r) => setRows(r as Row[])).catch(() => {});
  }, []);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Chapter access</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? <p className="text-sm text-foreground-muted">No enrollments.</p> : (
          <div className="divide-y divide-border">
            {rows.map((r) => (
              <div key={r.id} className="py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{r.profiles?.email || r.user_id?.slice(0, 8)}</div>
                  <div className="text-xs text-foreground-muted">{r.chapters?.name || r.chapter_id?.slice(0, 8)}</div>
                </div>
                <Badge variant={r.is_blocked ? "destructive" : "default"}>{r.is_blocked ? "blocked" : "active"}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
