import React from 'react';
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import { onLCP, onINP, onCLS, onTTFB, onFCP, Metric } from 'web-vitals';
import { supabase } from './integrations/supabase/client';
import { API_BASE_URL as API_BASE } from './config/env';

let vitalsQueue: any[] = [];
let vitalsTimeout: any = null;

const sendWebVitals = async () => {
  if (vitalsQueue.length === 0) return;
  
  const metricsToSend = [...vitalsQueue];
  vitalsQueue = [];

  const payload = JSON.stringify({
    action: "web_vital",
    details: { metrics: metricsToSend }
  });

  // Stage 2 fix: the old path preferred navigator.sendBeacon, which cannot
  // carry an Authorization header — the backend requires a JWT on
  // /api/activity, so every beacon was rejected (401) and all web-vitals
  // telemetry was silently lost. Resolve the session FIRST and use a
  // keepalive fetch; only fall back to a beacon for logged-in flushes.
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return; // unauthenticated vitals would be rejected anyway
    await fetch(`${API_BASE}/api/activity`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: payload,
      keepalive: true
    }).catch(() => {
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon(`${API_BASE}/api/activity`, blob);
      }
    });
  } catch {
    // ignore
  }
};

function reportWebVitals(metric: Metric) {
  if (import.meta.env.DEV) {
    console.log(`[Web Vital] ${metric.name}: ${metric.value} (Rating: ${metric.rating})`);
  }
  
  vitalsQueue.push({
    metric_name: metric.name,
    value: metric.value,
    rating: metric.rating,
    page_path: window.location.pathname
  });

  if (!vitalsTimeout) {
    vitalsTimeout = setTimeout(() => {
      sendWebVitals();
      vitalsTimeout = null;
    }, 5000);
  }
}

if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      sendWebVitals();
    }
  });
}

try {
  onLCP(reportWebVitals);
  onINP(reportWebVitals);
  onCLS(reportWebVitals);
  onTTFB(reportWebVitals);
  onFCP(reportWebVitals);
} catch (e) {
  console.error("Failed to initialize web vitals", e);
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              window.dispatchEvent(new Event('sw-update-available'));
            }
          });
        }
      });
    }).catch((err) => {
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}

export let deferredPrompt: any;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  window.dispatchEvent(new CustomEvent('pwa-prompt-available', { detail: e }));
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HelmetProvider>
        <App />
      </HelmetProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
