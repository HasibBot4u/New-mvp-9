import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  email: string;
  display_name?: string | null;
  role: 'user' | 'admin';
  is_blocked?: boolean;
  avatar_url?: string | null;
  phone?: string | null;
  created_at?: string;
  is_enrolled?: boolean;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  forgotPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  refresh: () => Promise<void>;
}

import { logActivity } from "@/lib/activityLogger";

const AuthCtx = createContext<AuthState | undefined>(undefined);

const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number, operationName = "Operation"): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)), timeoutMs))
  ]);
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async (u: User): Promise<Profile | null> => {
    try {
      const sb = supabase as any;
      const result: any = await withTimeout(
        sb.from("profiles").select("*").eq("id", u.id).maybeSingle(),
        10000,
        "fetchProfile DB query"
      );
      const data = result?.data;
      const base: Profile = data
        ? { ...(data as any) }
        : {
            id: u.id,
            email: u.email ?? "",
            display_name: u.user_metadata?.display_name || u.email?.split("@")[0] || "Student",
            role: 'user',
            is_blocked: false,
          };

      if (!base.role) base.role = 'user';

      return base;
    } catch (e) {
      console.error("fetchProfile error:", e);
      return null;
    }
  }, []);

  useEffect(() => {
    let sub: any = null;
    try {
      const { data } = supabase.auth.onAuthStateChange((_event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          (async () => {
            try {
              const p = await fetchProfile(s.user);
              setProfile(p);
              if (p?.is_blocked) {
                await supabase.auth.signOut();
                setProfile(null);
              }
            } catch (e) {
              console.error("onAuthStateChange profile fetch error:", e);
            }
          })();
        } else {
          setProfile(null);
        }
      });
      sub = data;
    } catch (e) {
      console.error("onAuthStateChange setup error:", e);
    }

    withTimeout(supabase.auth.getSession(), 10000, "getSession")
      .then(async (result: any) => {
        const s = result?.data?.session;
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          try {
            const p = await fetchProfile(s.user);
            setProfile(p);
            if (p?.is_blocked) {
              await supabase.auth.signOut();
              setProfile(null);
            }
          } catch (e) {
            console.error("getSession profile fetch error:", e);
          }
        }
        setIsLoading(false);
      })
      .catch((e) => {
        console.error("getSession error:", e);
        setIsLoading(false);
      });

    return () => {
      if (sub && sub.subscription) {
        sub.subscription.unsubscribe();
      }
    };
  }, [fetchProfile]);

  const signIn: AuthState["signIn"] = async (email, password) => {
    try {
      const result: any = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        10000,
        "signInWithPassword"
      );
      const { data, error } = result;
      if (error) return { error: error.message };
      if (data?.user) {
        const p = await fetchProfile(data.user);
        setProfile(p);
        if (p?.is_blocked) {
          await supabase.auth.signOut();
          setProfile(null);
          return { error: "Your account has been blocked. Contact support." };
        }
        await logActivity("login", { email: data.user.email, device: navigator.userAgent });
      }
      return { error: null };
    } catch (e: any) {
      console.error("signIn error:", e);
      return { error: e?.message || "Sign in failed due to timeout or network error" };
    }
  };

  const signUp: AuthState["signUp"] = async (email, password, displayName) => {
    const redirectUrl = `${window.location.origin}/dashboard`;
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: redirectUrl, data: { display_name: displayName } },
    });
    if (error) return { error: error.message };
    if (data.user) {
      const p = await fetchProfile(data.user);
      setProfile(p);
    }
    return { error: null };
  };

  const signOut: AuthState["signOut"] = async () => {
    await logActivity("logout", {});
    await supabase.auth.signOut();
    setProfile(null);
  };

  const forgotPassword: AuthState["forgotPassword"] = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error?.message ?? null };
  };

  const updatePassword: AuthState["updatePassword"] = async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message ?? null };
  };

  const refresh = useCallback(async () => {
    if (user) {
      const p = await fetchProfile(user);
      setProfile(p);
    }
  }, [user, fetchProfile]);

  const isAdmin = profile?.role === "admin";

  const value: AuthState = {
    user, session, profile, isAdmin, isLoading,
    signIn, signUp, signOut, forgotPassword, updatePassword, refresh,
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}
