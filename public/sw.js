const CACHE_NAME = 'nexusedu-cache-v1';
const DYNAMIC_CACHE = 'nexusedu-dynamic-v1';
const ASSET_CACHE = 'nexusedu-assets-v1';
const THUMBNAIL_CACHE = 'nexusedu-thumbnails-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => ![CACHE_NAME, DYNAMIC_CACHE, ASSET_CACHE, THUMBNAIL_CACHE].includes(key))
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

function isAsset(url) {
  return url.match(/\.(js|css|woff2?|ttf|eot|svg)$/i);
}

function isThumbnail(url) {
  return url.match(/\.(jpg|jpeg|png|webp|gif)$/i) || url.includes('thumbnail');
}

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Navigation requests for SPA
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((response) => {
        return response || fetch(event.request);
      })
    );
    return;
  }

  // 1. Static Assets (JS/CSS) - Cache First for 1 year
  if (isAsset(url)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          const resClone = response.clone();
          caches.open(ASSET_CACHE).then((cache) => cache.put(event.request, resClone));
          return response;
        });
      })
    );
    return;
  }

  // 2. Thumbnails - Cache First for 7 days
  if (isThumbnail(url)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached; // Expiration checks could be implemented with DB/headers, keep simple Cache First for now
        return fetch(event.request).then((response) => {
          const resClone = response.clone();
          caches.open(THUMBNAIL_CACHE).then((cache) => cache.put(event.request, resClone));
          return response;
        });
      })
    );
    return;
  }

  // 3. API Catalog - Stale-while-revalidate for 1 hour
  if (url.includes('/api/catalog') || url.includes('/api/v1/catalog')) {
    event.respondWith(
      caches.open(DYNAMIC_CACHE).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          }).catch(() => null);

          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // Default Network First
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

// Handle Background Sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-progress') {
    event.waitUntil(syncVideoProgress());
  }
});

async function syncVideoProgress() {
  // Mock background sync logic for offline progress updates
  console.log('[SW] Syncing video progress to server...');
  return Promise.resolve();
}

// Push Notifications
self.addEventListener('push', (event) => {
  if (event.data) {
    let data = {};
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'New Notification', body: event.data.text() };
    }
    
    const options = {
      body: data.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: '2'
      }
    };
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
