const isDev = import.meta.env.DEV;

const envApiBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (isDev && (!envApiBaseUrl || envApiBaseUrl.trim() === "")) {
  throw new Error("VITE_API_BASE_URL environment variable is required in development mode.");
}

export const API_BASE_URL = (envApiBaseUrl || "https://nexusedu-backend-0bjq.onrender.com").replace(/\/+$/, "");

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string || "").trim();
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string || "").trim();

if (!SUPABASE_URL) {
  throw new Error("Missing VITE_SUPABASE_URL environment variable. Please set it in environment variables.");
}

if (!SUPABASE_ANON_KEY) {
  throw new Error("Missing VITE_SUPABASE_ANON_KEY environment variable. Please set it in environment variables.");
}

export const SUPABASE_CONFIG = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
};
