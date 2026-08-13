const isDev = import.meta.env.DEV;

const envApiBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (isDev && (!envApiBaseUrl || envApiBaseUrl.trim() === "")) {
  throw new Error("VITE_API_BASE_URL environment variable is required in development mode.");
}

// API base URL. In production VITE_API_BASE_URL MUST be set at build time
// (Netlify). There is no hardcoded fallback: a missing/empty value in a
// production build would otherwise silently point at a deleted or foreign
// host. In development we require it and throw a clear error.
if (!isDev && (!envApiBaseUrl || envApiBaseUrl.trim() === "")) {
  console.error(
    "[env] VITE_API_BASE_URL is not set. API calls will fail. Set it in Netlify → Site settings → Environment variables."
  );
}

export const API_BASE_URL = (envApiBaseUrl || "").replace(/\/+$/, "");

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string || "").trim();
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string || "").trim();

// Stage 4 CI fix: hard-throwing at BUILD time when VITE_SUPABASE_* are
// absent broke the CI test-frontend job (it builds without deploy
// secrets). Keep the hard failure in development; at build time warn and
// continue — CI validates compilability, while real deploys (Netlify)
// always inject the variables. Runtime supabase calls will fail loudly in
// the browser console if a deploy ever ships without them.
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  if (isDev) {
    throw new Error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY environment variables.");
  } else {
    console.warn("[env] VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY not set at build time — Supabase features will fail at runtime.");
  }
}

export const SUPABASE_CONFIG = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
};
