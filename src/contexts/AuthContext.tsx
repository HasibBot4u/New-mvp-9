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

const AuthCtx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async (u: User): Promise<Profile | null> => {
    const sb = supabase as any;
    const { data } = await sb.from("profiles").select("*").eq("id", u.id).maybeSingle();
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
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        (async () => {
          const p = await fetchProfile(s.user);
          setProfile(p);
          if (p?.is_blocked) {
            await supabase.auth.signOut();
            setProfile(null);
          }
        })();
      } else {
        setProfile(null);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        const p = await fetchProfile(s.user);
        setProfile(p);
        if (p?.is_blocked) {
          await supabase.auth.signOut();
          setProfile(null);
        }
      }
      setIsLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn: AuthState["signIn"] = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    if (data.user) {
      const p = await fetchProfile(data.user);
      setProfile(p);
      if (p?.is_blocked) {
        await supabase.auth.signOut();
        setProfile(null);
        return { error: "Your account has been blocked. Contact support." };
      }
      (supabase as any).from("activity_logs").insert({
        user_id: data.user.id,
        action: "login",
        details: { email: data.user.email },
      }).then(() => {}, () => {});
    }
    return { error: null };
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
