import React from 'react';
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import { onLCP, onFID, onCLS, onTTFB, onFCP, Metric } from 'web-vitals';
import { supabase } from './integrations/supabase/client';

/*
  SQL to create web_vitals table:
  
  CREATE TABLE web_vitals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    metric_name TEXT NOT NULL,
    value FLOAT NOT NULL,
    rating TEXT NOT NULL,
    page_path TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
*/

let vitalsQueue: any[] = [];
let vitalsTimeout: any = null;

const sendWebVitals = async () => {
  if (vitalsQueue.length === 0) return;
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    vitalsQueue = []; // clear if not authenticated
    return;
  }

  const metricsToSend = [...vitalsQueue];
  vitalsQueue = [];

  const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://nexusedu-backend-0bjq.onrender.com";
  
  try {
    await fetch(`${API_BASE}/api/activity`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: "web_vital",
        details: { metrics: metricsToSend }
      })
    }).catch(() => {});
  } catch (err) {
    // ignore
  }
};

function reportWebVitals(metric: Metric) {
  console.log(`[Web Vital] ${metric.name}: ${metric.value} (Rating: ${metric.rating})`);
  
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

try {
  onLCP(reportWebVitals);
  onFID(reportWebVitals);
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
