import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

export interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  login: ({ email, password }: any) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      session: null,
      isAuthenticated: false,
      isLoading: false, 
      error: null,
      
      login: async ({ email, password }) => {
        set({ isLoading: true, error: null });
        let timeoutId: any;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error("Login timed out")), 10000);
        });

        try {
          const { data, error } = await Promise.race([
            supabase.auth.signInWithPassword({ email, password }),
            timeoutPromise
          ]) as { data: { session: Session | null, user: User | null }, error: any };
          
          if (error) throw error;
          
          if (data.session && data.user) {
            set({ 
              user: data.user, 
              session: data.session, 
              isAuthenticated: true 
            });
            localStorage.setItem('auth_indicator', 'true');
            if (data.session.access_token) {
              localStorage.setItem('supabase_token', data.session.access_token);
            }
          }
        } catch (err: any) {
          set({ error: err?.message || "Login failed" });
        } finally {
          clearTimeout(timeoutId);
          set({ isLoading: false });
        }
      },

      logout: async () => {
        set({ isLoading: true, error: null });
        try {
          await supabase.auth.signOut();
        } catch (err) {
          console.error("Error signing out:", err);
        } finally {
          localStorage.removeItem('auth_indicator');
          localStorage.removeItem('supabase_token');
          set({ user: null, session: null, isAuthenticated: false, isLoading: false });
        }
      },
      
      hydrate: async () => {
        const hasAuthIndicator = localStorage.getItem('auth_indicator') === 'true';
        set({ isLoading: true, isAuthenticated: hasAuthIndicator, error: null });
        
        let timeoutId: any;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error("Session check timed out")), 5000);
        });

        try {
          const { data: { session }, error } = await Promise.race([
            supabase.auth.getSession(),
            timeoutPromise
          ]) as { data: { session: Session | null }, error: any };
          
          if (error) throw error;
          
          if (session?.user) {
            set({ 
              user: session.user, 
              session, 
              isAuthenticated: true 
            });
            localStorage.setItem('auth_indicator', 'true');
            if (session.access_token) {
               localStorage.setItem('supabase_token', session.access_token);
            }
          } else {
            set({ user: null, session: null, isAuthenticated: false });
            localStorage.removeItem('auth_indicator');
            localStorage.removeItem('supabase_token');
          }
        } catch (error: any) {
          if (error?.message !== "Supabase is not configured" && error?.message !== "Session check timed out") {
            console.error("Hydration error:", error);
          }
          set({ user: null, session: null, isAuthenticated: false, error: null });
          localStorage.removeItem('auth_indicator');
        } finally {
          clearTimeout(timeoutId);
          set({ isLoading: false });
        }
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ isAuthenticated: state.isAuthenticated }),
    }
  )
);

