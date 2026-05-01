import { Wrench } from "lucide-react";
import { NexusLogo } from "@/components/brand/NexusLogo";
import { useSystemSettings } from "@/contexts/SystemSettingsContext";
import { useEffect } from "react";

export default function MaintenancePage() {
  const { settings } = useSystemSettings();

  useEffect(() => {
    document.title = `${settings.platform_name} — রক্ষণাবেক্ষণ`;
  }, [settings.platform_name]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center max-w-md">
        <NexusLogo size="lg" href="" />
        <div className="my-10 inline-flex w-20 h-20 rounded-2xl bg-warning/10 border border-warning/30 items-center justify-center">
          <Wrench className="w-9 h-9 text-warning" />
        </div>
        <h1 className="font-bangla text-3xl font-bold mb-3">সাইট রক্ষণাবেক্ষণে আছে</h1>
        <p className="font-bangla text-foreground-dim mb-4">
          আমরা সাইটটি আপডেট করছি। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন।
        </p>
        <p className="text-foreground-muted text-sm">
          {settings.platform_name} is under maintenance. Please check back soon.
        </p>
      </div>
    </div>
  );
}
