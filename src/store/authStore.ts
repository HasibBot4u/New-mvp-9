import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/integrations/supabase/client';

interface AuthState {
  user: any | null;
  session: any | null;
  role: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: any) => void;
  setSession: (session: any) => void;
  setRole: (role: string) => void;
  setLoading: (isLoading: boolean) => void;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      role: null,
      isAuthenticated: false,
      isLoading: true,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setSession: (session) => {
        set({ session });
        if (session?.access_token) {
          localStorage.setItem('supabase_token', session.access_token);
        }
      },
      setRole: (role) => set({ role }),
      setLoading: (isLoading) => set({ isLoading }),
      logout: async () => {
        const { session } = get();
        if (session) {
          try {
            await supabase.auth.signOut();
          } catch (error) {
            console.error("Error signing out:", error);
          }
        }
        localStorage.removeItem('supabase_token');
        set({ user: null, session: null, role: null, isAuthenticated: false });
      },
      hydrate: async () => {
        set({ isLoading: true });
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error("Hydration error:", error);
          set({ isLoading: false });
          return;
        }
        if (session?.user) {
          set({ user: session.user, session, isAuthenticated: true, isLoading: false });
        } else {
          set({ user: null, session: null, role: null, isAuthenticated: false, isLoading: false });
        }
      }
    }),
    {
      name: 'auth-storage',
    }
  )
);
