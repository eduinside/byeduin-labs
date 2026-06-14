const CACHE = 'qr-master-v2';

const ASSETS = [
  '/qr/',
  '/qr/index.html',
  '/qr/manifest.json',
  '/qr/icons/qr-icon.svg',
  '/common/hero-theme.css',
  '/common/theme.js',
  '/common/init.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const { request } = e;

  // Only intercept GET requests
  if (request.method !== 'GET') return;

  e.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).then(res => {
        // Cache successful same-origin and CDN responses
        if (res.status === 200) {
          const resClone = res.clone();
          caches.open(CACHE).then(c => c.put(request, resClone));
        }
        return res;
      }).catch(() => {
        // Network failed. For navigation requests, serve the cached shell.
        if (request.mode === 'navigate') {
          return caches.match('/qr/index.html');
        }
        // For other asset requests, return a minimal error response
        // rather than returning undefined (which breaks the fetch pipeline).
        return new Response('Offline', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' },
        });
      });
    })
  );
});
