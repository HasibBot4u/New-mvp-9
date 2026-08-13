import { useEffect, useState } from "react";
import { telegramApi } from "@/features/admin-control-plane/api";
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
import { RefreshCw, Link2, Unlink, AlertTriangle } from "lucide-react";

type Tab = "overview" | "bot" | "videos";

export default function ControlPlaneTelegram() {
  const [tab, setTab] = useState<Tab>("overview");
  return (
    <ControlPlaneShell>
      <h1 className="text-2xl font-bold mb-1">Telegram &amp; Video Storage</h1>
      <p className="text-sm text-foreground-muted mb-4">
        Credentials are never shown — only configuration status. Diagnostics run server-side with timeouts.
      </p>
      <div className="flex gap-2 mb-4">
        <Button size="sm" variant={tab === "overview" ? "default" : "outline"} onClick={() => setTab("overview")}>Overview</Button>
        <Button size="sm" variant={tab === "bot" ? "default" : "outline"} onClick={() => setTab("bot")}>Bot &amp; Webhook</Button>
        <Button size="sm" variant={tab === "videos" ? "default" : "outline"} onClick={() => setTab("videos")}>Video Mappings</Button>
      </div>
      {tab === "overview" && <Overview />}
      {tab === "bot" && <BotWebhook />}
      {tab === "videos" && <VideoMappings />}
    </ControlPlaneShell>
  );
}

function StatusRow({ label, ok, hint }: { label: string; ok: boolean | null; hint?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-sm">{label}</span>
      {ok === null ? <Badge variant="secondary">unknown</Badge>
        : ok ? <Badge>configured</Badge> : <Badge variant="destructive">not configured</Badge>}
      {hint && <span className="text-xs text-foreground-muted ml-2">{hint}</span>}
    </div>
  );
}

function Overview() {
  const [status, setStatus] = useState<Record<string, any> | null>(null);
  const [diag, setDiag] = useState<Record<string, any> | null>(null);
  const [running, setRunning] = useState(false);

  async function load() {
    try { setStatus(await telegramApi.status() as any); } catch (e: any) { toast.error(e.message); }
  }
  async function runDiag() {
    setRunning(true);
    try { setDiag(await telegramApi.diagnostics() as any); }
    catch (e: any) { toast.error(e.message); }
    finally { setRunning(false); }
  }
  useEffect(() => { load(); }, []);

  return (
    <>
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Configuration status</CardTitle></CardHeader>
        <CardContent>
          {status ? (
            <>
              <StatusRow label="Pyrogram session" ok={!!status.pyrogram_configured} />
              <StatusRow label="Bot token" ok={!!status.bot_configured} />
              <StatusRow label="Webhook URL" ok={!!status.webhook_configured} />
              <StatusRow label="Thumbnail channel" ok={!!status.thumbnail_channel_configured} />
              <div className="flex items-center justify-between py-2">
                <span className="text-sm">Storage channels</span>
                <span className="text-sm font-mono">{status.storage_channel_count ?? 0}</span>
              </div>
            </>
          ) : <p className="text-sm text-foreground-muted">Loading…</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Diagnostics</CardTitle>
          <Button size="sm" variant="outline" disabled={running} onClick={runDiag}>
            <RefreshCw className={`w-4 h-4 mr-1 ${running ? "animate-spin" : ""}`} /> Run checks
          </Button>
        </CardHeader>
        <CardContent>
          {diag ? (
            <div className="text-sm space-y-2">
              <div>Pyrogram: <Badge variant="secondary">{diag.pyrogram}</Badge></div>
              <div>Bot: <Badge variant="secondary">{diag.bot}</Badge></div>
              {Array.isArray(diag.channels) && diag.channels.map((c: any) => (
                <div key={c.name} className="flex justify-between">
                  <span>channel: {c.name}</span>
                  <Badge variant={c.status === "accessible" ? "default" : "destructive"}>{c.status}</Badge>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-foreground-muted">Click "Run checks" to test connectivity. This does not modify any data.</p>}
        </CardContent>
      </Card>
    </>
  );
}

function BotWebhook() {
  const [wh, setWh] = useState<Record<string, any> | null>(null);
  const [busy, setBusy] = useState(false);
  async function load() { try { setWh(await telegramApi.webhook() as any); } catch (e: any) { toast.error(e.message); } }
  async function reinit() {
    setBusy(true);
    try { await telegramApi.reinitWebhook(); toast.success("Webhook re-initialized"); await load(); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }
  useEffect(() => { load(); }, []);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Bot &amp; webhook</CardTitle>
        <Button size="sm" onClick={reinit} disabled={busy}>Re-register webhook</Button>
      </CardHeader>
      <CardContent className="text-sm">
        {wh ? (
          <>
            <StatusRow label="Webhook configured" ok={!!wh.configured} />
            <StatusRow label="Bot initialized" ok={!!wh.initialized} />
          </>
        ) : <p className="text-foreground-muted">Loading…</p>}
      </CardContent>
    </Card>
  );
}

function VideoMappings() {
  const [videos, setVideos] = useState<any[]>([]);
  const [missingOnly, setMissingOnly] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [confirmClear, setConfirmClear] = useState<any | null>(null);

  async function load() {
    try { const d = await telegramApi.listVideos(missingOnly || undefined) as any; setVideos(d.videos || []); }
    catch (e: any) { toast.error(e.message); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [missingOnly]);

  return (
    <>
      <Card className="mb-4">
        <CardContent className="pt-4 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} />
            Show only missing Telegram mappings
          </label>
          <Button size="sm" variant="outline" onClick={load}><RefreshCw className="w-4 h-4 mr-1" /> Refresh</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Videos</CardTitle></CardHeader>
        <CardContent>
          {videos.length === 0 ? <p className="text-sm text-foreground-muted">No videos.</p> : (
            <div className="divide-y divide-border">
              {videos.map((v) => (
                <div key={v.id} className="py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{v.title || "(untitled)"}</div>
                    <div className="text-xs text-foreground-muted font-mono">
                      ch: {v.telegram_channel_id || "—"} · msg: {v.telegram_message_id || "—"} · {v.source_type}
                    </div>
                  </div>
                  <Badge variant={v.telegram_message_id ? "default" : "destructive"}>
                    {v.telegram_message_id ? "mapped" : "missing"}
                  </Badge>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(v)}><Link2 className="w-4 h-4" /></Button>
                  {v.telegram_message_id && (
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setConfirmClear(v)}>
                      <Unlink className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {editing && <MappingDialog video={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      <Dialog open={!!confirmClear} onOpenChange={() => setConfirmClear(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Clear mapping</DialogTitle>
            <DialogDescription>This removes the Telegram channel/message association. It does not delete the video or the Telegram message.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClear(null)}>Cancel</Button>
            <Button variant="destructive" onClick={async () => {
              try { await telegramApi.clearMapping(confirmClear.id); toast.success("Mapping cleared"); setConfirmClear(null); await load(); }
              catch (e: any) { toast.error(e.message); }
            }}>Clear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MappingDialog({ video, onClose, onSaved }: { video: any; onClose: () => void; onSaved: () => void }) {
  const [channel, setChannel] = useState(video.telegram_channel_id || "");
  const [message, setMessage] = useState(video.telegram_message_id ?? "");
  const [thumb, setThumb] = useState(video.thumbnail_url || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await telegramApi.setMapping(video.id, {
        channel_id: channel || undefined,
        message_id: message ? Number(message) : undefined,
        thumbnail_url: thumb || undefined,
      });
      toast.success("Mapping saved"); onSaved();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit video mapping</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm font-medium">{video.title || "(untitled)"}</p>
          <div><Label>Telegram channel ID (numeric)</Label><Input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="-1001234567890" /></div>
          <div><Label>Telegram message ID</Label><Input type="number" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="123" /></div>
          <div><Label>Thumbnail URL</Label><Input value={thumb} onChange={(e) => setThumb(e.target.value)} /></div>
          <p className="text-xs text-amber-600">Identifiers are validated server-side. The backend must be able to resolve the channel for streaming to work.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
