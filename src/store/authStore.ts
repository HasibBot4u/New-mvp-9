import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  user: any | null;
  session: any | null;
  role: string | null;
  isAuthenticated: boolean;
  setUser: (user: any) => void;
  setSession: (session: any) => void;
  setRole: (role: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      session: null,
      role: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setSession: (session) => {
        set({ session });
        if (session?.access_token) {
          localStorage.setItem('supabase_token', session.access_token);
        }
      },
      setRole: (role) => set({ role }),
      logout: () => {
        localStorage.removeItem('supabase_token');
        set({ user: null, session: null, role: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
