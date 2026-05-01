import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Notification } from "@/types";
import { Button } from "@/components/ui/button";

const sb = supabase as any;

export default function NotificationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await sb.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setItems((data ?? []) as unknown as Notification[]);
  };
  useEffect(() => { 
    load(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const markAll = async () => {
    if (!user) return;
    await sb.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    load();
  };

  return (
    <div className="container max-w-3xl py-10 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">Inbox</p>
          <h1 className="font-display text-4xl font-bold tracking-tighter">Notifications</h1>
        </div>
        {items.some(i => !i.is_read) && (
          <Button onClick={markAll} variant="outline" className="rounded-full"><Check className="w-4 h-4 mr-2" /> Mark all read</Button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl p-10 bg-background-elevated border border-border text-center">
          <Bell className="w-8 h-8 text-foreground-muted mx-auto mb-3" />
          <p className="text-foreground-muted">No notifications yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(n => (
            <Link key={n.id} to={n.action_url ?? "#"}
              className={`block p-5 rounded-2xl border transition-colors ${n.is_read ? "bg-background-elevated border-border" : "bg-primary/5 border-primary/30"}`}
            >
              <div className="flex items-start gap-3">
                {!n.is_read && <span className="w-2 h-2 mt-2 rounded-full bg-primary shrink-0" />}
                <div className="flex-1">
                  <p className="font-medium">{n.title}</p>
                  {n.body && <p className="text-sm text-foreground-dim mt-1">{n.body}</p>}
                  <p className="text-xs text-foreground-muted mt-2">{new Date(n.created_at).toLocaleString()}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
