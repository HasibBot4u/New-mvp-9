import { useEffect, useState } from "react";
import { Radio, Calendar, ExternalLink, Bell, BellRing } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { LiveClass } from "@/types";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { isSubscribed, subscribeUser, showNotification } from "@/lib/pushNotifications";

const sb = supabase as any;

export default function LivePage() {
  const { session } = useAuth();
  const [items, setItems] = useState<LiveClass[]>([]);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    sb.from("live_classes").select("*").eq("is_active", true).order("scheduled_at")
      .then(({ data }: any) => setItems((data ?? []) as unknown as LiveClass[]));
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      isSubscribed(session.user.id).then(setSubscribed);
    }
  }, [session]);

  const handleSubscribe = async () => {
    if (!session?.user?.id) return;
    if ("Notification" in window && Notification.permission === 'denied') {
      alert("Please enable notifications in your browser settings to receive live class reminders.");
      return;
    }
    const success = await subscribeUser(session.user.id);
    if (success) {
      setSubscribed(true);
      alert("Notifications enabled!");
    }
  };

  const now = Date.now();
  const upcoming = items.filter(i => new Date(i.scheduled_at).getTime() >= now);
  const past = items.filter(i => new Date(i.scheduled_at).getTime() < now);

  useEffect(() => {
    if (!session?.user?.id || !subscribed || ("Notification" in window && Notification.permission !== 'granted')) return;
    
    const checkUpcoming = () => {
      const currentTime = new Date();
      upcoming.forEach(cls => {
        const startTime = new Date(cls.scheduled_at);
        const diffMs = startTime.getTime() - currentTime.getTime();
        const diffMins = diffMs / 60000;
        
        if (diffMins > 0 && diffMins <= 5) {
          const notifiedKey = `notified_live_${cls.id}`;
          if (!sessionStorage.getItem(notifiedKey)) {
            showNotification(`Live Class Starting: ${cls.title}`, {
              body: `Starts in ${Math.ceil(diffMins)} minutes!`,
            });
            sessionStorage.setItem(notifiedKey, 'true');
          }
        }
      });
    };
    
    const interval = setInterval(checkUpcoming, 60000);
    checkUpcoming(); // check immediately
    
    return () => clearInterval(interval);
  }, [upcoming, session, subscribed]);

  return (
    <div className="container max-w-4xl py-10 space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">Streaming</p>
          <h1 className="font-display text-4xl font-bold tracking-tighter flex items-center gap-3">
            Live classes <Radio className="w-6 h-6 text-primary animate-pulse-glow" />
          </h1>
        </div>
        <div>
          {!subscribed ? (
            <Button onClick={handleSubscribe} variant="outline" className="gap-2">
              <Bell className="w-4 h-4" /> Notify Me
            </Button>
          ) : (
            <Button variant="secondary" className="gap-2 text-primary" disabled>
              <BellRing className="w-4 h-4" /> Notifications enabled
            </Button>
          )}
        </div>
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
              <div key={l.id} className="rounded-2xl p-5 bg-gradient-card border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div>
                  <p className="font-semibold">{l.title}</p>
                  <p className="text-xs text-foreground-muted mt-1">{new Date(l.scheduled_at).toLocaleString()}</p>
                </div>
                {l.meeting_url && (
                  <Button asChild className="rounded-full bg-primary hover:bg-primary-glow shadow-glow shrink-0">
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
