import { API_BASE_URL } from '@/infrastructure/api/env';

type EventName = 
  | 'page_view'
  | 'video_played'
  | 'video_completed'
  | 'video_paused'
  | 'signup_completed'
  | 'enrollment_success'
  | 'subscription_upgraded';

interface EventProperties {
  [key: string]: any;
}

const lastWarnedMap: Record<string, number> = {};
const WARN_THROTTLE_MS = 60000;

class Analytics {
  private isInitialized = false;

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    if (import.meta.env.DEV) {
      console.log('[Analytics] Initialized (Backend-only)');
    }
  }

  identify(userId: string, traits?: Record<string, string>) {
    if (import.meta.env.DEV) {
      console.log('[Analytics] Identified user', userId, traits);
    }
  }

  async track(eventName: EventName | string, properties?: EventProperties) {
    if (!this.isInitialized) this.init();

    if (import.meta.env.DEV) {
      console.log(`[Analytics] Tracked: ${eventName}`, properties);
    }

    // Backend tracking
    try {
      const { supabase } = await import('@/infrastructure/supabase/client');
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (token) {
        const res = await fetch(`${API_BASE_URL}/api/activity`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ action: eventName, details: properties || {} })
        });
        if (!res.ok) {
          const now = Date.now();
          if (!lastWarnedMap[eventName] || now - lastWarnedMap[eventName] > WARN_THROTTLE_MS) {
            lastWarnedMap[eventName] = now;
            console.warn(`[Analytics] Track request failed for '${eventName}' (HTTP ${res.status})`);
          }
        }
      }
    } catch (e) {
      const now = Date.now();
      if (!lastWarnedMap[eventName] || now - lastWarnedMap[eventName] > WARN_THROTTLE_MS) {
        lastWarnedMap[eventName] = now;
        console.warn(`[Analytics] Track error for '${eventName}':`, e);
      }
    }
  }
}

export const analytics = new Analytics();

export const trackEvent = (name: string, params?: object) => {
  analytics.track(name, params);
};

