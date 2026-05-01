import { useEffect, useState } from "react";
import { Loader2, Save, Zap, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSystemSettings } from "@/contexts/SystemSettingsContext";

export default function AdminSystemPage() {
  const { toast } = useToast();
  const { refreshSettings } = useSystemSettings();

  const [maintenance, setMaintenance] = useState(false);
  const [allowReg, setAllowReg] = useState(true);
  const [platformName, setPlatformName] = useState("NexusEdu");
  const [color, setColor] = useState("#e50914");
  const [backendUrl, setBackendUrl] = useState(import.meta.env.VITE_API_BASE_URL as string || "");
  const [loading, setLoading] = useState(true);

  const [healthLoading, setHealthLoading] = useState(false);
  const [health, setHealth] = useState<{ ok: boolean; data: any } | null>(null);

  const checkHealth = async (urlOverride?: string) => {
    setHealthLoading(true);
    const envBackendUrl = import.meta.env.VITE_API_BASE_URL as string;
    const healthCheckUrl = envBackendUrl || urlOverride || backendUrl;
    if (!healthCheckUrl) {
      setHealth({ ok: false, data: { error: "VITE_API_BASE_URL or backendUrl is not set." } });
      setHealthLoading(false);
      return;
    }
    try {
      const res = await fetch(healthCheckUrl.replace(/\/+$/, "") + "/api/health", { method: "GET" });
      const data = await res.json().catch(() => ({}));
      setHealth({ ok: res.ok, data });
    } catch (e: any) {
      setHealth({ ok: false, data: { error: e.message } });
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("system_settings").select("key, value");
      const map: Record<string, any> = {};
      for (const r of data ?? []) map[r.key] = r.value;
      if (map.maintenance_mode) setMaintenance(!!map.maintenance_mode.enabled);
      if (map.allow_registrations) setAllowReg(map.allow_registrations.enabled !== false);
      if (map.platform_name?.text) setPlatformName(map.platform_name.text);
      if (map.platform_color?.color) setColor(map.platform_color.color);
      let foundUrl = undefined;
      if (map.backend_url?.url) {
        setBackendUrl(map.backend_url.url);
        foundUrl = map.backend_url.url;
      }
      setLoading(false);
      checkHealth(foundUrl);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upsert = async (key: string, value: any) => {
    const { error } = await supabase.from("system_settings")
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) toast({ title: "ব্যর্থ", description: error.message, variant: "destructive" });
    else { toast({ title: "সংরক্ষিত হয়েছে" }); refreshSettings(); }
  };

  const warmup = async () => {
    const base = import.meta.env.VITE_API_BASE_URL as string;
    if (!base) {
      toast({ title: "VITE_API_BASE_URL is not set.", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch(base.replace(/\/+$/, "") + "/api/warmup", { method: "POST" });
      if (res.ok) toast({ title: "ব্যাকএন্ড ওয়ার্ম করা হয়েছে" });
      else toast({ title: "ব্যর্থ", description: `HTTP ${res.status}`, variant: "destructive" });
    } catch (e: any) {
      toast({ title: "ব্যর্থ", description: e.message, variant: "destructive" });
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="font-display text-3xl font-bold">সিস্টেম সেটিংস</h1>
        <p className="text-foreground-dim text-sm mt-1">প্ল্যাটফর্ম-ব্যাপী কনফিগারেশন।</p>
      </header>

      {/* Maintenance */}
      <div className="rounded-2xl border border-white/5 bg-surface p-5 space-y-4">
        <Toggle label="রক্ষণাবেক্ষণ মোড" desc="সক্রিয় থাকলে অ-অ্যাডমিন ব্যবহারকারীরা অ্যাক্সেস করতে পারবে না।"
          value={maintenance} onChange={(v) => { setMaintenance(v); upsert("maintenance_mode", { enabled: v }); }} />
        <Toggle label="নিবন্ধন সক্রিয়" desc="নতুন ব্যবহারকারী সাইন আপ করতে পারবে কিনা।"
          value={allowReg} onChange={(v) => { setAllowReg(v); upsert("allow_registrations", { enabled: v }); }} />
      </div>

      {/* Branding */}
      <div className="rounded-2xl border border-white/5 bg-surface p-5 space-y-4">
        <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-foreground-muted">ব্র্যান্ডিং</h2>
        <Field label="প্ল্যাটফর্মের নাম" htmlFor="sys-name">
          <div className="flex gap-2">
            <input id="sys-name" value={platformName} onChange={e => setPlatformName(e.target.value)}
              className="flex-1 h-10 px-3 rounded-lg bg-background border border-white/10 text-sm focus:outline-none focus:border-primary/50" />
            <button onClick={() => upsert("platform_name", { text: platformName })}
              className="px-4 h-10 rounded-lg bg-primary text-primary-foreground hover:bg-primary-glow text-sm inline-flex items-center gap-2">
              <Save className="w-4 h-4" /> সংরক্ষণ
            </button>
          </div>
        </Field>
        <Field label="ব্র্যান্ড রঙ" htmlFor="sys-color-text">
          <div className="flex gap-2 items-center">
            <input aria-label="Choose color visually" type="color" value={color} onChange={e => setColor(e.target.value)} className="w-12 h-10 rounded-lg bg-transparent border border-white/10 cursor-pointer" />
            <input id="sys-color-text" value={color} onChange={e => setColor(e.target.value)} className="flex-1 h-10 px-3 rounded-lg bg-background border border-white/10 text-sm font-mono focus:outline-none focus:border-primary/50" />
            <button onClick={() => upsert("platform_color", { color })}
              className="px-4 h-10 rounded-lg bg-primary text-primary-foreground hover:bg-primary-glow text-sm inline-flex items-center gap-2">
              <Save className="w-4 h-4" /> সংরক্ষণ
            </button>
          </div>
        </Field>
      </div>

      {/* Backend */}
      <div className="rounded-2xl border border-white/5 bg-surface p-5 space-y-4">
        <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-foreground-muted">ব্যাকএন্ড</h2>
        <Field label="ব্যাকএন্ড URL (For reference only - Health uses VITE env var)" htmlFor="sys-backend">
          <div className="flex gap-2">
            <input id="sys-backend" value={backendUrl} onChange={e => setBackendUrl(e.target.value)}
              className="flex-1 h-10 px-3 rounded-lg bg-background border border-white/10 text-sm font-mono focus:outline-none focus:border-primary/50" />
            <button onClick={() => upsert("backend_url", { url: backendUrl })}
              className="px-4 h-10 rounded-lg bg-primary text-primary-foreground hover:bg-primary-glow text-sm inline-flex items-center gap-2">
              <Save className="w-4 h-4" /> সংরক্ষণ
            </button>
          </div>
        </Field>

        <div className={`rounded-xl border p-4 ${health?.ok ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"}`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Activity className={`w-4 h-4 ${health?.ok ? "text-success" : "text-destructive"}`} />
              <span className="font-semibold text-sm">{healthLoading ? "চেক করা হচ্ছে…" : health?.ok ? "✅ অনলাইন" : "❌ অফলাইন"}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => checkHealth()} className="text-xs px-3 h-8 rounded-full bg-white/5 hover:bg-white/10">পুনরায় চেক</button>
              <button onClick={warmup} className="text-xs px-3 h-8 rounded-full bg-warning/20 text-warning hover:bg-warning/30 inline-flex items-center gap-1">
                <Zap className="w-3 h-3" /> Warmup
              </button>
            </div>
          </div>
          {health && (
            <pre className="text-[11px] text-foreground-muted bg-background/40 p-2 rounded-lg mt-3 overflow-x-auto">{JSON.stringify(health.data, null, 2)}</pre>
          )}
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="font-display font-semibold" id={`label-${label.replace(/\s+/g, '-')}`}>{label}</p>
        <p className="text-sm text-foreground-dim mt-0.5">{desc}</p>
      </div>
      <button 
        role="switch" 
        aria-checked={value} 
        aria-labelledby={`label-${label.replace(/\s+/g, '-')}`} 
        onClick={() => onChange(!value)} 
        className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${value ? "bg-primary" : "bg-white/10"}`}
      >
        <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}
function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-xs uppercase tracking-wider text-foreground-muted">{label}</label>
      {children}
    </div>
  );
}
