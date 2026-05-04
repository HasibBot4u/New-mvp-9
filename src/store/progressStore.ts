import { create } from 'zustand';

interface ProgressState {
  progressMap: Record<string, number>; // videoId -> currentTime in seconds
  completedVideos: Record<string, boolean>;
  setProgress: (videoId: string, progress: number) => void;
  markCompleted: (videoId: string) => void;
  // TODO: Sync to backend logic (e.g., using apiClient inside a thunk or effect)
}

export const useProgressStore = create<ProgressState>((set) => ({
  progressMap: {},
  completedVideos: {},
  setProgress: (videoId, progress) =>
    set((state) => ({
      progressMap: { ...state.progressMap, [videoId]: progress },
    })),
  markCompleted: (videoId) =>
    set((state) => ({
      completedVideos: { ...state.completedVideos, [videoId]: true },
    })),
}));
