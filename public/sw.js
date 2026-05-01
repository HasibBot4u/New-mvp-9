const CACHE_NAME = 'nexusedu-v3';
// Only cache files that ACTUALLY EXIST in public/
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json', '/nexusedu-icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Network-first for API calls
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() => new Response('{"error":"offline"}', { status: 503, headers: { 'Content-Type': 'application/json' } }))
    );
    return;
  }
  // Network-first for HTML (prevents stale index.html after deploy — Bug N-055)
  if (url.pathname === '/' || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(e.request)
        .then(res => { caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone())); return res; })
        .catch(() => caches.match(e.request))
    );
    return;
  }
  // Cache-first for hashed assets (JS/CSS have content hashes so safe to cache forever)
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
