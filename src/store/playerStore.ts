import { create } from 'zustand';

interface PlayerState {
  currentVideoId: string | null;
  isPlaying: boolean;
  quality: number;
  buffered: number;
  setCurrentVideoId: (id: string | null) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setQuality: (quality: number) => void;
  setBuffered: (buffered: number) => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  currentVideoId: null,
  isPlaying: false,
  quality: -1, // -1 means auto
  buffered: 0,
  setCurrentVideoId: (id) => set({ currentVideoId: id }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setQuality: (quality) => set({ quality }),
  setBuffered: (buffered) => set({ buffered }),
}));
