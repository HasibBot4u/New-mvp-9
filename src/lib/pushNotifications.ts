import { supabase } from "@/integrations/supabase/client";

/*
  SQL to create push_subscriptions table:
  
  CREATE TABLE push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    subscription JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
  );
*/

export async function requestPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    console.warn("This browser does not support desktop notification");
    return false;
  }
  
  if (Notification.permission === "granted") {
    return true;
  }
  
  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }
  
  return false;
}

export async function isSubscribed(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
      
    if (error && error.code !== 'PGRST116') {
      console.warn("Error checking subscription:", error);
    }
    return !!data;
  } catch (error) {
    console.warn("Error checking subscription:", error);
    return localStorage.getItem('push_subscribed') === 'true'; // Fallback
  }
}

export async function subscribeUser(userId: string): Promise<boolean> {
  const granted = await requestPermission();
  if (!granted) return false;
  
  try {
    const dummySubscription = { endpoint: 'dummy', keys: { p256dh: '', auth: '' } };
    
    // Check if subscription exists manually
    const { data: existing } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
       await supabase.from('push_subscriptions').update({ subscription: dummySubscription }).eq('user_id', userId);
    } else {
       await supabase.from('push_subscriptions').insert({ user_id: userId, subscription: dummySubscription });
    }
    
    localStorage.setItem('push_subscribed', 'true');
    return true;
  } catch (error) {
    console.warn("Error subscribing:", error);
    localStorage.setItem('push_subscribed', 'true');
    return true;
  }
}

export async function unsubscribeUser(userId: string): Promise<boolean> {
  try {
    await supabase.from('push_subscriptions').delete().eq('user_id', userId);
    localStorage.setItem('push_subscribed', 'false');
    return true;
  } catch (error) {
    console.warn("Error unsubscribing:", error);
    localStorage.setItem('push_subscribed', 'false');
    return true;
  }
}

export function showNotification(title: string, options?: NotificationOptions) {
  if (!("Notification" in window)) return;
  
  if (Notification.permission === "granted") {
    const notification = new Notification(title, options);
    notification.onclick = function() {
      window.focus();
      this.close();
    };
  }
}
