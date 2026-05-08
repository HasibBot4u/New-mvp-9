const CACHE_STATIC = 'nexusedu-static-v1';
const CACHE_CATALOG = 'nexusedu-catalog-v1';
const CACHE_THUMBNAILS = 'nexusedu-thumbnails-v1';

const STATIC_EXPIRY = 365 * 24 * 60 * 60 * 1000; // 1 year
const CATALOG_EXPIRY = 60 * 60 * 1000; // 1 hour
const THUMBNAILS_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const currentCaches = [CACHE_STATIC, CACHE_CATALOG, CACHE_THUMBNAILS];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!currentCaches.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

function isValid(response, maxAge) {
  if (!response) return false;
  const fetched = response.headers.get('date');
  if (!fetched) return true; // without date, assume valid
  return (new Date().getTime() - new Date(fetched).getTime()) < maxAge;
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Thumbnails (Cache First with 7 day expiry)
  if (url.pathname.match(/\.(png|jpg|jpeg|webp|gif|svg)$/)) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (isValid(cachedResponse, THUMBNAILS_EXPIRY)) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_THUMBNAILS).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => cachedResponse); // fallback to expired if offline
      })
    );
    return;
  }

  // 2. /api/catalog (Stale-While-Revalidate with 1 hour expiry)
  if (url.pathname.includes('/api/catalog')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_CATALOG).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => {
            // Ignore network errors for stale-while-revalidate
        });
        
        // If valid, return cache while fetching in background. 
        // If missing or expired, wait for fetchPromise
        return (isValid(cachedResponse, CATALOG_EXPIRY) ? cachedResponse : null) || fetchPromise || cachedResponse;
      })
    );
    return;
  }

  // 3. Static Assets (JS, CSS, Fonts) - Cache First with 1 year expiry
  if (url.pathname.startsWith('/assets/') || url.pathname.match(/\.(js|css|woff2?|ttf|eot)$/)) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (isValid(cachedResponse, STATIC_EXPIRY)) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_STATIC).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => cachedResponse); // fallback if offline
      })
    );
    return;
  }

  // 4. API: Auth, Progress, etc. (Network First)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/rest/v1/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // Default: Network First
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
