import { useEffect, useState } from "react";
import { streamingApi } from "@/features/admin-control-plane/api";
import { ControlPlaneShell } from "./ControlPlanePage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, Activity, Shield, Gauge } from "lucide-react";

type Tab = "overview" | "videos" | "settings";

export default function ControlPlaneStreaming() {
  const [tab, setTab] = useState<Tab>("overview");
  return (
    <ControlPlaneShell>
      <h1 className="text-2xl font-bold mb-1">Streaming &amp; Playback</h1>
      <p className="text-sm text-foreground-muted mb-4">
        Delivery health, video diagnostics, and safe streaming limits. Security checks (auth, tickets, enrollment) cannot be disabled.
      </p>
      <div className="flex gap-2 mb-4">
        <Button size="sm" variant={tab === "overview" ? "default" : "outline"} onClick={() => setTab("overview")}><Activity className="w-4 h-4 mr-1" /> Overview</Button>
        <Button size="sm" variant={tab === "videos" ? "default" : "outline"} onClick={() => setTab("videos")}>Video diagnostics</Button>
        <Button size="sm" variant={tab === "settings" ? "default" : "outline"} onClick={() => setTab("settings")}><Gauge className="w-4 h-4 mr-1" /> Limits</Button>
      </div>
      {tab === "overview" && <Overview />}
      {tab === "videos" && <Videos />}
      {tab === "settings" && <Settings />}
    </ControlPlaneShell>
  );
}

function Overview() {
  const [status, setStatus] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);
  async function load() {
    setLoading(true);
    try { setStatus(await streamingApi.status() as any); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  const c = status?.counts || {};
  return (
    <>
      <div className="grid gap-4 md:grid-cols-3 mb-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Videos</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{c.total ?? "—"}</div>
            <p className="text-xs text-foreground-muted">{c.mapped ?? 0} mapped · {c.missing_mapping ?? 0} missing</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Thumbnails</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{c.missing_thumbnail ?? "—"}</div>
            <p className="text-xs text-foreground-muted">videos missing thumbnail</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Inactive</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{c.inactive ?? "—"}</div>
            <p className="text-xs text-foreground-muted">videos unpublished</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Shield className="w-4 h-4" /> Security & limits</CardTitle>
          <Button size="sm" variant="outline" disabled={loading} onClick={load}><RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh</Button>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          {status ? (
            <>
              <div className="flex justify-between"><span>Concurrent streams per user</span><Badge>{status.limits?.max_concurrent_per_user}</Badge></div>
              <div className="flex justify-between"><span>Max range size</span><Badge>{status.limits?.range_max_mb} MB</Badge></div>
              <div className="flex justify-between"><span>Ticket lifetime</span><Badge>{Math.round((status.limits?.ticket_ttl_seconds || 0) / 60)} min</Badge></div>
              <div className="flex justify-between"><span>HMAC-signed tickets</span><Badge>always on</Badge></div>
              <div className="flex justify-between"><span>Enrollment enforcement</span><Badge>always on</Badge></div>
            </>
          ) : <p className="text-foreground-muted">Loading…</p>}
        </CardContent>
      </Card>
    </>
  );
}

function Videos() {
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState<string>("");
  async function load() {
    try { const d = await streamingApi.listVideos(status || undefined) as any; setRows(d.videos || []); }
    catch (e: any) { toast.error(e.message); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Video delivery diagnostics</CardTitle>
        <select className="text-sm rounded border bg-background px-2 py-1" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">all</option>
          <option value="healthy">healthy</option>
          <option value="missing_mapping">missing mapping</option>
          <option value="missing_thumbnail">missing thumbnail</option>
          <option value="inactive">inactive</option>
        </select>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? <p className="text-sm text-foreground-muted">No videos.</p> : (
          <div className="divide-y divide-border">
            {rows.map((v) => (
              <div key={v.id} className="py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{v.title || "(untitled)"}</div>
                  <div className="text-xs text-foreground-muted">{v.chapter || v.id?.slice(0, 8)}</div>
                </div>
                <Badge variant={v.status === "healthy" ? "default" : "destructive"}>{v.status.replace(/_/g, " ")}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Settings() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState<string | null>(null);
  async function load() { try { setSettings((await streamingApi.getSettings() as any)); } catch (e: any) { toast.error(e.message); } }
  useEffect(() => { load(); }, []);
  async function save(key: string, value: number) {
    setSaving(key);
    try { await streamingApi.updateSetting(key, value); toast.success("Saved"); await load(); }
    catch (e: any) { toast.error(e.message); }
    finally { setSaving(null); }
  }
  const fields: [string, string, number, number][] = [
    ["streaming.max_concurrent_per_user", "Concurrent streams / user (1–10)", 1, 10],
    ["streaming.range_max_mb", "Max range size, MB (1–200)", 1, 200],
    ["streaming.ticket_ttl_seconds", "Ticket lifetime, seconds (60–86400)", 60, 86400],
  ];
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Streaming limits</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {fields.map(([key, label, min, max]) => (
          <div key={key}>
            <Label htmlFor={key}>{label}</Label>
            <div className="flex gap-2 mt-1">
              <Input id={key} type="number" min={min} max={max} defaultValue={settings[key]}
                     onChange={(e) => setSettings({ ...settings, [key]: e.target.value })} />
              <Button variant="outline" disabled={saving === key}
                      onClick={() => save(key, Number(settings[key]))}>Save</Button>
            </div>
          </div>
        ))}
        <p className="text-xs text-amber-600">
          Changes are bounded for safety, audited, and take effect within ~30 seconds. Authorization and ticket validation can never be disabled.
        </p>
      </CardContent>
    </Card>
  );
}
