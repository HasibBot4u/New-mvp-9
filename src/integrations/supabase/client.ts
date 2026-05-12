import { createClient } from '@supabase/supabase-js';

// These must be set in Netlify environment variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || SUPABASE_URL.trim() === '') {
  throw new Error("Missing VITE_SUPABASE_URL environment variable. Please set it in Netlify environment variables.");
}

if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.trim() === '') {
  throw new Error("Missing VITE_SUPABASE_ANON_KEY environment variable. Please set it in Netlify environment variables.");
}

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);
