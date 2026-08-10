const isDev = import.meta.env.DEV;

const envApiBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (isDev && (!envApiBaseUrl || envApiBaseUrl.trim() === "")) {
  throw new Error("VITE_API_BASE_URL environment variable is required in development mode.");
}

export const API_BASE_URL = (envApiBaseUrl || "https://nexusedu-backend-0bjq.onrender.com").replace(/\/+$/, "");

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
