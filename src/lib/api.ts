async function fetchWithTimeout(url: string, ms: number, options?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

export async function getWorkingBackend(): Promise<string> {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (!envUrl) throw new Error('VITE_API_BASE_URL is required');
  return envUrl.replace(/\/$/, '');
}

export function clearBackendCache(): void {
  try { localStorage.removeItem('nexusedu_working_backend'); } catch { /* ignore */ }
}

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('nexusedu_sync') : null;

let _lastRefresh = 0;
if (typeof localStorage !== 'undefined') {
  const cached = localStorage.getItem('nexusedu_last_refresh');
  if (cached) _lastRefresh = parseInt(cached, 10);
  
  if (!channel) {
    window.addEventListener('storage', (e) => {
      if (e.key === 'nexusedu_last_refresh' && e.newValue) {
        _lastRefresh = parseInt(e.newValue, 10);
      }
    });
  }
}

if (channel) {
  channel.onmessage = (event) => {
    if (event.data.type === 'refresh_sync') {
      _lastRefresh = event.data.timestamp;
    }
  };
}

export async function refreshCatalog(): Promise<void> {
  if (Date.now() - _lastRefresh < 60000) return;
  _lastRefresh = Date.now();
  
  if (channel) {
    channel.postMessage({ type: 'refresh_sync', timestamp: _lastRefresh });
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('nexusedu_last_refresh', _lastRefresh.toString());
  }

  const backend = await getWorkingBackend().catch(() => null);
  if (!backend) return;
  try { await fetchWithTimeout(`${backend}/api/refresh`, 15000); } catch { /* ignore */ }
}

export const getStreamUrl = (video: any): string => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  if (!baseUrl) return '';

  const workerUrl = import.meta.env.VITE_CLOUDFLARE_WORKER_URL;
  
  // Default to telegram if source_type is missing or empty
  const sourceType = video.source_type || 'telegram';
  
  if (sourceType === 'telegram') {
    // Use backend MTProto streamer (bypasses 20MB limit)
    const url = `${baseUrl}/api/stream/${video.id}`;
    return url;
  } else if (sourceType === 'drive') {
    if (!workerUrl) return ''; // Cannot stream drive without worker
    // Use Cloudflare Worker for Drive
    return `${workerUrl}/drive/${video.drive_file_id}`;
  } else if (sourceType === 'youtube') {
    return `https://www.youtube.com/embed/${video.youtube_video_id}?autoplay=1&controls=0&modestbranding=1&rel=0&disablekb=1`;
  }
  
  // Fallback to empty if missing
  return '';
};

export async function prefetchVideo(videoId: string): Promise<void> {
  const backend = await getWorkingBackend().catch(() => null);
  if (!backend) return;
  try { await fetchWithTimeout(`${backend}/api/prefetch/${videoId}`, 10000); } catch { /* ignore */ }
}

export async function fetchBackendHealth(): Promise<Record<string, unknown>> {
  const backend = await getWorkingBackend().catch(() => null);
  if (!backend) return { status: 'offline', telegram: 'disconnected' };
  const r = await fetchWithTimeout(`${backend}/api/health`, 8000); // 8 seconds timeout
  return r.json();
}

export const api = {
  getWorkingBackend,
  clearBackendCache,
  getStreamUrl,
  prefetchVideo,
  refreshCatalog,
  fetchBackendHealth,
  getCatalogWithCache: async () => {
    const backend = await getWorkingBackend();
    const r = await fetchWithTimeout(`${backend}/api/catalog`, 15000); // 15 seconds timeout
    if (!r.ok) throw new Error('Failed to fetch catalog');
    return r.json();
  },
  warmup: async () => {
    const backend = await getWorkingBackend();
    try { await fetchWithTimeout(`${backend}/api/warmup`, 5000); } catch { /* ignore */ }
  }
};