import { create } from 'zustand';

interface DownloadQueueItem {
  id: string;
  videoId: string;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  progress: number;
}

interface DownloadState {
  queue: DownloadQueueItem[];
  enqueue: (videoId: string) => void;
  updateProgress: (id: string, progress: number) => void;
  setStatus: (id: string, status: DownloadQueueItem['status']) => void;
}

export const useDownloadStore = create<DownloadState>((set) => ({
  queue: [],
  enqueue: (videoId) =>
    set((state) => ({
      queue: [
        ...state.queue,
        { id: Math.random().toString(), videoId, status: 'pending', progress: 0 },
      ],
    })),
  updateProgress: (id, progress) =>
    set((state) => ({
      queue: state.queue.map((item) =>
        item.id === id ? { ...item, progress } : item
      ),
    })),
  setStatus: (id, status) =>
    set((state) => ({
      queue: state.queue.map((item) =>
        item.id === id ? { ...item, status } : item
      ),
    })),
}));
