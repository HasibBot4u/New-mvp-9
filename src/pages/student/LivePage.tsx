import { useEffect, useState } from "react";
import { Radio, Calendar, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { LiveClass } from "@/types";
import { Button } from "@/components/ui/button";

const sb = supabase as any;

export default function LivePage() {
  const [items, setItems] = useState<LiveClass[]>([]);
  useEffect(() => {
    sb.from("live_classes").select("*").eq("is_active", true).order("scheduled_at")
      .then(({ data }: any) => setItems((data ?? []) as unknown as LiveClass[]));
  }, []);

  const now = Date.now();
  const upcoming = items.filter(i => new Date(i.scheduled_at).getTime() >= now);
  const past = items.filter(i => new Date(i.scheduled_at).getTime() < now);

  return (
    <div className="container max-w-4xl py-10 space-y-10">
      <div>
        <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">Streaming</p>
        <h1 className="font-display text-4xl font-bold tracking-tighter flex items-center gap-3">
          Live classes <Radio className="w-6 h-6 text-primary animate-pulse-glow" />
        </h1>
      </div>

      <section>
        <h2 className="font-display text-lg font-semibold mb-3">Upcoming</h2>
        {upcoming.length === 0 ? (
          <div className="rounded-2xl p-10 text-center bg-background-elevated border border-border">
            <Calendar className="w-8 h-8 text-foreground-muted mx-auto mb-3" />
            <p className="text-foreground-muted">No upcoming live classes scheduled.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.map(l => (
              <div key={l.id} className="rounded-2xl p-5 bg-gradient-card border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{l.title}</p>
                  <p className="text-xs text-foreground-muted mt-1">{new Date(l.scheduled_at).toLocaleString()}</p>
                </div>
                {l.meeting_url && (
                  <Button asChild className="rounded-full bg-primary hover:bg-primary-glow shadow-glow">
                    <a href={l.meeting_url} target="_blank" rel="noreferrer">Join <ExternalLink className="w-4 h-4 ml-2" /></a>
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-semibold mb-3">Past</h2>
          <div className="space-y-2">
            {past.map(l => (
              <div key={l.id} className="rounded-xl p-4 bg-background-elevated border border-border opacity-70">
                <p className="font-medium text-sm">{l.title}</p>
                <p className="text-xs text-foreground-muted mt-1">{new Date(l.scheduled_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
