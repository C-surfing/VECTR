// Service Worker for VECTR Blog
const CACHE_NAME = 'vectr-v4';
const BASE_PATH = (() => {
  const scopePath = new URL(self.registration.scope).pathname;
  return scopePath.endsWith('/') ? scopePath : `${scopePath}/`;
})();
const INDEX_PATH = `${BASE_PATH}index.html`;
const STATIC_ASSETS = [BASE_PATH, INDEX_PATH];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isSupabase = url.hostname.includes('supabase');
  const isApi = isSameOrigin && (url.pathname.startsWith('/api') || url.pathname.startsWith(`${BASE_PATH}api`));

  // Always keep navigation up to date; fallback to cached app shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cachedIndex = await caches.match(INDEX_PATH);
        if (cachedIndex) return cachedIndex;
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      })
    );
    return;
  }

  if (!isSameOrigin && !isSupabase) {
    return;
  }

  // Network-first for dynamic data.
  if (isApi || isSupabase) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return new Response('Network error', { status: 504, statusText: 'Gateway Timeout' });
        })
    );
    return;
  }

  // Cache-first for static assets, refresh in background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkPromise = fetch(request).then((response) => {
        if (response.ok) {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
        }
        return response;
      });

      if (cached) {
        networkPromise.catch(() => {});
        return cached;
      }

      return networkPromise.catch(async () => {
        const cachedIndex = await caches.match(INDEX_PATH);
        if (cachedIndex) return cachedIndex;
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      });
    })
  );
});
