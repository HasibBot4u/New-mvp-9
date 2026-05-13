import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider } from './components/ThemeProvider';
import './index.css';

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
  <ErrorBoundary>
    <HelmetProvider>
      <ThemeProvider defaultTheme="system" storageKey="nexusedu-theme">
        <App />
      </ThemeProvider>
    </HelmetProvider>
  </ErrorBoundary>
);
