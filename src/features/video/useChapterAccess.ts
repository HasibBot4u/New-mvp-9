import { useState, useCallback } from 'react';
import { supabase } from '@/infrastructure/supabase/client';
import { getDeviceFingerprint } from '@/shared/hooks/useDeviceFingerprint';
import { normalizeEnrollmentCode } from '@/features/auth/enrollmentCode';

export function useChapterAccess() {
  const [accessMap, setAccessMap] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem('nexus_access_map');
      if (stored) return JSON.parse(stored);
    } catch (e) { console.debug(e); }
    return {};
  });
  const [isLoading, setIsLoading] = useState(false);

  const checkAccess = useCallback(async (chapterId: string) => {
    try {
      const fingerprint = await getDeviceFingerprint();
      const { data, error } = await (supabase as any).rpc('check_chapter_access', {
        p_chapter_id: chapterId,
        p_device_fingerprint: fingerprint
      });

      if (error) throw error;

      // Stage 3 fix: the RPC returns a json OBJECT {success, error?};
      // `!!data` was therefore always true, marking locked chapters as
      // unlocked in the UI.
      setAccessMap(prev => {
        const next = { ...prev, [chapterId]: !!data?.success };
        try { localStorage.setItem('nexus_access_map', JSON.stringify(next)); } catch (e) { console.debug(e); }
        return next;
      });
      return !!data?.success;
    } catch (error) {
      console.error('Error checking chapter access:', error);
      return false;
    }
  }, []);

  const checkBatchAccess = useCallback(async (chapterIds: string[]) => {
    setIsLoading(true);
    try {
    const results = await Promise.allSettled(chapterIds.map(id => checkAccess(id)));
    return results;
    } finally {
      setIsLoading(false);
    }
  }, [checkAccess]);

  const submitCode = useCallback(async (chapterId: string, code: string) => {
    try {
      const fingerprint = await getDeviceFingerprint();
      const userAgent = navigator.userAgent;
      
      // Privacy fix: ipify leaks client IP to third party. Make it opt-in via VITE_ENABLE_IP_FETCH
      // Default disabled to avoid external IP leak. Backend already logs IP from request.
      let deviceIp = '';
      const enableIpFetch = (import.meta.env.VITE_ENABLE_IP_FETCH === 'true');
      if (enableIpFetch) {
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 3000);
          const ipRes = await fetch('https://api.ipify.org?format=json', { signal: ctrl.signal });
          clearTimeout(timer);
          const { ip } = await ipRes.json();
          deviceIp = ip;
        } catch {
          deviceIp = '';
        }
      }

      const deviceInfo = {
        userAgent,
        language: navigator.language,
        platform: navigator.platform,
        screen: `${window.screen.width}x${window.screen.height}`
      };

      // Stage 4: extracted to lib/enrollmentCode.ts with unit tests.
      const normalizedCode = normalizeEnrollmentCode(code);

      const { data, error }: { data: any, error: any } = await (supabase as any).rpc('use_chapter_enrollment_code', {
        p_code: normalizedCode,
        p_chapter_id: chapterId,
        p_device_fingerprint: fingerprint,
        p_device_ip: deviceIp,
        p_device_user_agent: userAgent,
        p_device_info: deviceInfo
      });

      if (error) throw error;

      if (data && data.success) {
        setAccessMap(prev => {
          const next = { ...prev, [chapterId]: true };
          try { localStorage.setItem('nexus_access_map', JSON.stringify(next)); } catch (e) { console.debug(e); }
          return next;
        });
      }

      return {
        success: data?.success || false,
        message_bn: data?.message_bn || 'অজানা ত্রুটি হয়েছে'
      };
    } catch (error: any) {
      console.error('Error submitting enrollment code:', error);
      return {
        success: false,
        message_bn: error.message || 'সার্ভার ত্রুটি হয়েছে। আবার চেষ্টা করুন।'
      };
    }
  }, []);

  const hasAccess = useCallback((chapterId: string) => {
    return accessMap[chapterId] ?? false;
  }, [accessMap]);

  return {
    accessMap,
    isLoading,
    checkAccess,
    checkBatchAccess,
    submitCode,
    hasAccess
  };
}
