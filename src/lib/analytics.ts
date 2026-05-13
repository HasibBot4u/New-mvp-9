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

class Analytics {
  private isInitialized = false;

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    console.log('[Analytics] Initialized');
  }

  identify(userId: string, traits?: Record<string, string>) {
    console.log('[Analytics] Identified user', userId, traits);
  }

  async track(eventName: EventName | string, properties?: EventProperties) {
    if (!this.isInitialized) this.init();
    
    // GA4 tracking
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag('event', eventName, properties);
    }
    
    console.log(`[Analytics] Tracked: ${eventName}`, properties);

    // Backend tracking
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (token) {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
        await fetch(`${baseUrl}/api/activity`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ action: eventName, details: properties || {} })
        });
      }
    } catch (e) {
      // Ignore background errors
    }
  }
}

export const analytics = new Analytics();

export const trackEvent = (name: string, params?: object) => {
  analytics.track(name, params);
};

