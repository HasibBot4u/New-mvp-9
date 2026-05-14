const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://nexusedu-backend-0bjq.onrender.com";
import { supabase } from "@/integrations/supabase/client";

export async function logActivity(action: string, details: object = {}) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    await fetch(`${API_BASE}/api/activity`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action, details })
    }).catch(() => {}); // Catch fetch errors silently
  } catch (e) {
    // Ignore error so it doesn't spam console
  }
}
