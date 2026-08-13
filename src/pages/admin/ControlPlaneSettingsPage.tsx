import { useEffect, useState } from "react";
import { controlPlaneApi } from "@/features/admin-control-plane/api";
import { ControlPlaneShell } from "./ControlPlanePage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

type Def = { key: string; type: string; category: string; description: string; sensitive: boolean };
type SettingsResp = { definitions: Def[]; values: Record<string, unknown> };

function asInput(v: unknown): string {
  if (typeof v === "boolean") return v ? "true" : "false";
  return v == null ? "" : String(v);
}

export default function ControlPlaneSettings() {
  const [data, setData] = useState<SettingsResp | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  

  async function load() {
    const d = (await controlPlaneApi.getSettings()) as SettingsResp;
    setData(d);
    setDraft({});
  }
  useEffect(() => { load().catch(() => {}); }, []);

  async function save(key: string) {
    setSaving(key);
    try {
      const def = data?.definitions.find((d) => d.key === key);
      let value: unknown = draft[key];
      if (def?.type === "bool") value = value === true || value === "true";
      else if (def?.type === "int") value = Number(value);
      await controlPlaneApi.updateSetting(key, value);
      toast.success("Setting saved");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(null);
    }
  }

  if (!data) return <ControlPlaneShell><p className="text-foreground-muted">Loading…</p></ControlPlaneShell>;

  const byCat = data.definitions.reduce<Record<string, Def[]>>((acc, d) => {
    (acc[d.category] ||= []).push(d);
    return acc;
  }, {});

  return (
    <ControlPlaneShell>
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <p className="text-sm text-foreground-muted mb-6">
        Changes are versioned and audited. Sensitive values cannot be viewed or edited here.
      </p>
      {Object.entries(byCat).map(([cat, defs]) => (
        <Card key={cat} className="mb-4">
          <CardHeader><CardTitle className="text-base capitalize">{cat}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {defs.map((d) => {
              const current = data.values[d.key];
              const val = draft[d.key] !== undefined ? draft[d.key] : asInput(current);
              return (
                <div key={d.key} className="grid gap-2">
                  <Label htmlFor={d.key} className="flex items-center gap-2">
                    <code className="text-xs">{d.key}</code>
                    {d.sensitive && <span className="text-[10px] text-red-500">sensitive — hidden</span>}
                  </Label>
                  {d.description && <p className="text-xs text-foreground-muted">{d.description}</p>}
                  <div className="flex items-center gap-3">
                    {d.type === "bool" ? (
                      <Switch
                        id={d.key}
                        checked={val === true || val === "true"}
                        onCheckedChange={(c) => setDraft((p) => ({ ...p, [d.key]: c }))}
                      />
                    ) : (
                      <Input
                        id={d.key}
                        type={d.type === "int" ? "number" : "text"}
                        value={d.sensitive ? "********" : asString(val)}
                        disabled={d.sensitive}
                        onChange={(e) => setDraft((p) => ({ ...p, [d.key]: e.target.value }))}
                      />
                    )}
                    <Button
                      size="sm"
                      disabled={d.sensitive || saving === d.key || draft[d.key] === undefined}
                      onClick={() => save(d.key)}
                    >
                      {saving === d.key ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </ControlPlaneShell>
  );
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
