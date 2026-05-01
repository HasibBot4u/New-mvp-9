import { useState, useEffect } from 'react';

// WARNING: This fingerprint relies on easily spoofable browser properties.
// It is strictly for analytics and rate-limiting hints, NOT for cryptographic security or hard access control.
let _cachedFingerprint: string | null = null;

export async function getDeviceFingerprint(): Promise<string> {
  if (_cachedFingerprint) return _cachedFingerprint;
  const data = [
    navigator.userAgent,
    `${screen.width}x${screen.height}`,
    String(screen.colorDepth),
    String(window.devicePixelRatio || 1),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.language,
    String(navigator.hardwareConcurrency || 0),
    navigator.platform || 'unknown',
  ].join('|||');
  try {
    const encoded = new TextEncoder().encode(data);
    const hash = await crypto.subtle.digest('SHA-256', encoded);
    _cachedFingerprint = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    _cachedFingerprint = btoa(unescape(encodeURIComponent(data))).replace(/[^a-z0-9]/gi, '').substring(0, 64);
  }
  return _cachedFingerprint!;
}

export async function getDeviceInfo(): Promise<Record<string, unknown>> {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform || 'unknown',
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screen: `${screen.width}x${screen.height}`,
    colorDepth: screen.colorDepth,
    pixelRatio: window.devicePixelRatio || 1,
    cores: navigator.hardwareConcurrency || 'unknown',
  };
}

export function useDeviceFingerprint(): string {
  const [fp, setFp] = useState('');
  useEffect(() => { getDeviceFingerprint().then(setFp); }, []);
  return fp;
}
