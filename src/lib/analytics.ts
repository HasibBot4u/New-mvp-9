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

  track(eventName: EventName | string, properties?: EventProperties) {
    if (!this.isInitialized) this.init();
    
    // Custom backend tracking (mock for now)
    
    // GA4 tracking
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag('event', eventName, properties);
    }
    
    console.log(`[Analytics] Tracked: ${eventName}`, properties);
  }
}

export const analytics = new Analytics();

export const trackEvent = (name: string, params?: object) => {
  analytics.track(name, params);
};

