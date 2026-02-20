// Service Worker for VECTR Blog
const CACHE_NAME = 'vectr-v3';
const STATIC_ASSETS = ['/', '/index.html'];

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
  const isSupabase = url.hostname.includes('supabase');
  const isApi = url.pathname.startsWith('/api');

  // Ensure newest app shell: navigation requests use network first.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cachedIndex = await caches.match('/index.html');
        if (cachedIndex) return cachedIndex;
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      })
    );
    return;
  }

  // Skip unrelated cross-origin requests.
  if (url.origin !== location.origin && !isSupabase) {
    return;
  }

  // Network first for API / Supabase with safe fallback response.
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

  // Cache first for static assets; update in background.
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
        const cachedIndex = await caches.match('/index.html');
        if (cachedIndex) return cachedIndex;
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      });
    })
  );
});
