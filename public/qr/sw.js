const CACHE = 'qr-master-v1';
const ASSETS = [
  '/qr/',
  '/qr/index.html',
  '/common/hero-theme.css',
  '/common/theme.js',
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
  // CDN 리소스(html5-qrcode, qrcodejs)는 캐시 우선, 실패 시 네트워크
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        // 성공한 GET 응답은 캐시에 저장
        if (e.request.method === 'GET' && res.status === 200) {
          const resClone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, resClone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
