const CACHE_STATIC = 'nexusedu-static-v1';
const CACHE_CATALOG = 'nexusedu-catalog-v1';
const CACHE_THUMBNAILS = 'nexusedu-thumbnails-v1';

const STATIC_EXPIRY = 365 * 24 * 60 * 60 * 1000; // 1 year
const CATALOG_EXPIRY = 60 * 60 * 1000; // 1 hour
const THUMBNAILS_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => {
      return cache.addAll([
        '/manifest.json'
      ]);
    })
  );
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

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Stamping custom header 'sw-cached-at' when caching responses because CDN or API responses might omit the HTTP Date header or have inaccurate Date values due to proxying, causing isValid() to miscalculate cache freshness.
function createCachedResponse(response) {
  const headers = new Headers(response.headers);
  headers.set('sw-cached-at', new Date().toUTCString());
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers
  });
}

function isValid(response, maxAge) {
  if (!response) return false;
  const fetched = response.headers.get('sw-cached-at') || response.headers.get('date');
  if (!fetched) return false; // Without date/timestamp header, do not assume fresh
  const time = new Date(fetched).getTime();
  if (isNaN(time)) return false;
  return (Date.now() - time) < maxAge;
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Exclude non-GET and authenticated requests from SW cache
  if (event.request.method !== 'GET' || event.request.headers.has('Authorization')) {
    return;
  }

  // Navigation requests (HTML shell) -> Network First, fallback to cache
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = createCachedResponse(networkResponse.clone());
          caches.open(CACHE_STATIC).then((cache) => {
            cache.put('/index.html', responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        return caches.match('/index.html').then((cached) => {
          return cached || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/html' } });
        });
      })
    );
    return;
  }

  // 1. Thumbnails (Cache First with 7 day expiry)
  if (url.pathname.match(/\.(png|jpg|jpeg|webp|gif|svg)$/)) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (isValid(cachedResponse, THUMBNAILS_EXPIRY)) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = createCachedResponse(networkResponse.clone());
            caches.open(CACHE_THUMBNAILS).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => cachedResponse || new Response('Image unavailable offline', { status: 503 }));
      })
    );
    return;
  }

  // 2. /api/catalog (Stale-While-Revalidate with 1 hour expiry)
  if (url.pathname.startsWith('/api/catalog')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = createCachedResponse(networkResponse.clone());
            caches.open(CACHE_CATALOG).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => {
          return cachedResponse || new Response(JSON.stringify({ error: "Offline" }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        });

        if (isValid(cachedResponse, CATALOG_EXPIRY)) {
          return cachedResponse;
        }
        return fetchPromise;
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
            const responseToCache = createCachedResponse(networkResponse.clone());
            caches.open(CACHE_STATIC).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => cachedResponse || new Response('Asset unavailable offline', { status: 503 }));
      })
    );
    return;
  }

  // 4. All other API endpoints -> Network only (never cached)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/rest/v1/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Default: Network First
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'New Notification';
  const options = {
    body: data.body || 'You have a new message.',
    icon: '/nexusedu-icon.svg',
    badge: '/nexusedu-icon.svg',
    data: data.data || {}
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
