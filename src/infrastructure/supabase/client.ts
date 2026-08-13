import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '@/infrastructure/api/env';

export const supabase = createClient(
  SUPABASE_CONFIG.url,
  SUPABASE_CONFIG.anonKey,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);
