import { createContext, useContext, ReactNode, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SystemSettings {
  maintenance_mode: boolean;
  allow_registrations: boolean;
  platform_name: string;
  platform_color: string;
}

interface Ctx {
  settings: SystemSettings;
  isLoading: boolean;
  refreshSettings: () => Promise<void>;
}

const DEFAULTS: SystemSettings = {
  maintenance_mode: false,
  allow_registrations: true,
  platform_name: "NexusEdu",
  platform_color: "#e50914",
};

const SettingsCtx = createContext<Ctx | undefined>(undefined);

const fetchSettings = async (): Promise<SystemSettings> => {
  const { data } = await (supabase as any).from("system_settings").select("key, value");
  const next: SystemSettings = { ...DEFAULTS };
  if (Array.isArray(data)) {
    for (const row of data as { key: string; value: any }[]) {
      const v = row.value ?? {};
      switch (row.key) {
        case "maintenance_mode": next.maintenance_mode = !!v.enabled; break;
        case "allow_registrations": next.allow_registrations = v.enabled !== false; break;
        case "platform_name": if (typeof v.text === "string" && v.text) next.platform_name = v.text; break;
        case "platform_color": if (typeof v.color === "string" && v.color) next.platform_color = v.color; break;
      }
    }
  }
  return next;
};

export function SystemSettingsProvider({ children }: { children: ReactNode }) {
  const { data: settings = DEFAULTS, isLoading, refetch } = useQuery({
    queryKey: ['systemSettings'],
    queryFn: fetchSettings,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    document.title = `${settings.platform_name} — তোমার শিক্ষার নতুন দিগন্ত`;
  }, [settings.platform_name]);

  const refreshSettings = async () => {
    await refetch();
  };

  return (
    <SettingsCtx.Provider value={{ settings, isLoading, refreshSettings }}>
      {children}
    </SettingsCtx.Provider>
  );
}

export function useSystemSettings() {
  const v = useContext(SettingsCtx);
  if (!v) throw new Error("useSystemSettings must be used inside <SystemSettingsProvider>");
  return v;
}
