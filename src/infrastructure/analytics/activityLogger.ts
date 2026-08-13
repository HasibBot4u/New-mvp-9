import { API_BASE_URL as API_BASE } from "@/infrastructure/api/env";
import { supabase } from "@/infrastructure/supabase/client";

const lastWarnedMap: Record<string, number> = {};
const WARN_THROTTLE_MS = 60000;

export async function logActivity(action: string, details: object = {}) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    const res = await fetch(`${API_BASE}/api/activity`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action, details })
    });

    if (!res.ok) {
      const now = Date.now();
      if (!lastWarnedMap[action] || now - lastWarnedMap[action] > WARN_THROTTLE_MS) {
        lastWarnedMap[action] = now;
        console.warn(`[activityLogger] Failed to log activity '${action}' (HTTP ${res.status})`);
      }
    }
  } catch (e) {
    const now = Date.now();
    if (!lastWarnedMap[action] || now - lastWarnedMap[action] > WARN_THROTTLE_MS) {
      lastWarnedMap[action] = now;
      console.warn(`[activityLogger] Failed to log activity '${action}':`, e);
    }
  }
}
