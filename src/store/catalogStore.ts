import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';

// IndexedDB storage adapter for Zustand
const idbStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

interface CatalogState {
  subjects: any[];
  cycles: any[];
  chapters: any[];
  videos: any[];
  lastFetched: number | null;
  setCatalog: (data: any) => void;
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
}

export const useCatalogStore = create<CatalogState>()(
  persist(
    (set) => ({
      subjects: [],
      cycles: [],
      chapters: [],
      videos: [],
      lastFetched: null,
      isLoading: false,
      setLoading: (isLoading) => set({ isLoading }),
      setCatalog: (data) => set({ ...data, lastFetched: Date.now() }),
    }),
    {
      name: 'catalog-storage',
      storage: createJSONStorage(() => idbStorage as any),
    }
  )
);
