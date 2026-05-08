import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

// Assume Profile type exists or create a basic one
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
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setRole: (role: string) => void; // Keep for backward compatibility
  setLoading: (isLoading: boolean) => void;
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
      isLoading: true, // Start true so it doesn't flash
      
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
      
      logout: async () => {
        set({ isLoading: true });
        try {
          await supabase.auth.signOut();
        } catch (error) {
          console.error("Error signing out:", error);
        }
        localStorage.removeItem('auth_indicator');
        localStorage.removeItem('supabase_token');
        set({ user: null, session: null, profile: null, isAuthenticated: false, isLoading: false });
      },
      
      hydrate: async () => {
        // Only run hydration if we haven't already hydrated recently or on mount
        const hasAuthIndicator = localStorage.getItem('auth_indicator') === 'true';
        set({ isLoading: true, isAuthenticated: hasAuthIndicator });
        
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) throw error;
          
          if (session?.user) {
            // Load profile if needed
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
        } catch (error) {
          console.error("Hydration error:", error);
          set({ user: null, session: null, profile: null, isAuthenticated: false, isLoading: false });
          localStorage.removeItem('auth_indicator');
        }
      }
    }),
    {
      name: 'auth-storage',
      // Persist only the bare minimum indicator
      partialize: (state) => ({ isAuthenticated: state.isAuthenticated }),
    }
  )
);
