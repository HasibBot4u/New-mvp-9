import { useState, useEffect, useCallback, useRef } from 'react';
import { getWorkingBackend } from '../lib/api';

export interface HealthStatus {
  isLoading: boolean;
  isOnline: boolean;
  telegramConnected: boolean;
  videosLoaded: number;
  uptime: string;
  lastChecked: Date | null;
  error: string | null;
  fetchError?: boolean;
  consecutiveFailures?: number;
}

const defaultStatus: HealthStatus = {
  isLoading: true,
  isOnline: false,
  telegramConnected: false,
  videosLoaded: 0,
  uptime: '—',
  lastChecked: null,
  error: null,
};

export function useBackendHealth(autoRefreshSeconds = 30) {
  const [status, setStatus] = useState<HealthStatus>(defaultStatus);
  const failureCountRef = useRef(0);

  const check = useCallback(async () => {
    setStatus(prev => ({ ...prev, isLoading: true, error: null }));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const backend = await getWorkingBackend();
      const res = await fetch(`${backend}/api/health`, {
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      failureCountRef.current = 0;

      // Handle BOTH response formats from the backend:
      // Format A: { status: 'ok', telegram: 'connected', catalog_size: 5 }
      // Format B: { telegram_connected: true, videos_loaded: 5, uptime: '2h' }
      const tgStr = String(data.telegram || data.telegram_connected || '').toLowerCase();
      const isReconnecting = tgStr.includes('reconnect');
      const telegramConnected = !isReconnecting && (
        data.telegram === 'connected' ||
        data.telegram_connected === true ||
        data.telegram?.status === 'connected' ||
        tgStr.includes('connect')
      );

      const videosLoaded =
        data.catalog_size ??
        data.videos_loaded ??
        data.video_count ??
        0;

      const uptime =
        data.uptime ??
        data.server_uptime ??
        'Running';

      setStatus({
        isLoading: false,
        isOnline: true,
        telegramConnected,
        videosLoaded: Number(videosLoaded),
        uptime: String(uptime),
        lastChecked: new Date(),
        error: null,
        fetchError: false,
        consecutiveFailures: 0,
      });
    } catch (e: unknown) {
      failureCountRef.current++;
      setStatus(prev => ({
        ...prev,
        isLoading: false,
        isOnline: false,
        telegramConnected: false,
        videosLoaded: 0,
        uptime: '—',
        lastChecked: new Date(),
        error: e instanceof Error ? e.message : 'Connection failed',
        fetchError: true,
        consecutiveFailures: failureCountRef.current,
      }));
    } finally {
      clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    check();
    const interval = setInterval(check, autoRefreshSeconds * 1000);
    return () => clearInterval(interval);
  }, [check, autoRefreshSeconds]);

  return { ...status, refresh: check };
}
