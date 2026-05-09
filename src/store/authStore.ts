import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

interface Profile {
  id: string;
  role?: string;
  [key: string]: any;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setRole: (role: string) => void; 
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      profile: null,
      isAuthenticated: false,
      isLoading: true, 
      error: null,
      
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      
      setSession: (session) => {
        set({ session });
        if (session) {
          localStorage.setItem('auth_indicator', 'true');
        } else {
          localStorage.removeItem('auth_indicator');
        }
      },
      
      setProfile: (profile) => set({ profile }),
      setRole: (role) => {
        const currentProfile = get().profile;
        set({ profile: currentProfile ? { ...currentProfile, role } : { id: get().user?.id || '', role } });
      },
      
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      
      logout: async () => {
        set({ isLoading: true, error: null });
        try {
          await supabase.auth.signOut();
        } catch (err) {
          console.error("Error signing out:", err);
        }
        localStorage.removeItem('auth_indicator');
        localStorage.removeItem('supabase_token');
        set({ user: null, session: null, profile: null, isAuthenticated: false, isLoading: false });
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
          
          clearTimeout(timeoutId);
          if (error) throw error;
          
          if (session?.user) {
            let profileData = null;
            try {
              const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
              profileData = data;
            } catch (err) {
              console.warn("Could not fetch profile during hydrate", err);
            }
            
            set({ 
              user: session.user, 
              session, 
              profile: profileData,
              isAuthenticated: true, 
              isLoading: false 
            });
            localStorage.setItem('auth_indicator', 'true');
            if (session.access_token) {
               localStorage.setItem('supabase_token', session.access_token);
            }
          } else {
            set({ user: null, session: null, profile: null, isAuthenticated: false, isLoading: false });
            localStorage.removeItem('auth_indicator');
            localStorage.removeItem('supabase_token');
          }
        } catch (error: any) {
          clearTimeout(timeoutId);
          console.error("Hydration error:", error);
          set({ user: null, session: null, profile: null, isAuthenticated: false, isLoading: false, error: error.message || "Hydration Error" });
          localStorage.removeItem('auth_indicator');
        }
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ isAuthenticated: state.isAuthenticated }),
    }
  )
);
