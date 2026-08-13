import { useEffect, useState } from "react";
import { controlPlaneApi } from "@/features/admin-control-plane/api";
import { ControlPlaneShell } from "./ControlPlanePage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Flag = { key: string; name: string; category: string; enabled: boolean };

export default function ControlPlaneFlags() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  

  useEffect(() => { controlPlaneApi.getFlags().then(setFlags).catch(() => {}); }, []);

  async function toggle(key: string, enabled: boolean) {
    setBusy(key);
    try {
      await controlPlaneApi.setFlag(key, enabled);
      setFlags((p) => p.map((f) => (f.key === key ? { ...f, enabled } : f)));
      toast.success(`${key} ${enabled ? "enabled" : "disabled"}`);
    } catch (e: any) {
      toast.error(e.message || "Update failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <ControlPlaneShell>
      <h1 className="text-2xl font-bold mb-1">Feature Flags</h1>
      <p className="text-sm text-foreground-muted mb-6">
        Flags default to off; the application falls back safely when a flag is missing. Changes are audited.
      </p>
      <Card>
        <CardHeader><CardTitle className="text-base">Flags</CardTitle></CardHeader>
        <CardContent className="divide-y divide-border">
          {flags.length === 0 && <p className="text-sm text-foreground-muted py-2">No flags found.</p>}
          {flags.map((f) => (
            <div key={f.key} className="py-3 flex items-center justify-between gap-4">
              <div>
                <div className="font-medium">{f.name}</div>
                <div className="text-xs text-foreground-muted">
                  <code>{f.key}</code> · {f.category}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id={f.key}
                  checked={f.enabled}
                  disabled={busy === f.key}
                  onCheckedChange={(c) => toggle(f.key, c)}
                />
                <Label htmlFor={f.key} className="text-xs">{f.enabled ? "On" : "Off"}</Label>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </ControlPlaneShell>
  );
}
