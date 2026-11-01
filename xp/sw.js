/* CanvasXP's service worker: network first, the last copy when offline, so
 * the installed app opens without a connection (t-66914c8b0f). make.js puts
 * the build's version in CACHE_NAME. */
const CACHE_NAME = 'canvasxp-__VERSION__';
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './icon-180.png', './favicon.svg'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(CORE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin && !url.hostname.includes('cdnjs.cloudflare.com') && !url.hostname.includes('cdn.jsdelivr.net') && !url.hostname.includes('unpkg.com')) return;
  event.respondWith(
    fetch(event.request).then((res) => {
      if (res && res.status === 200) { const copy = res.clone(); caches.open(CACHE_NAME).then((c) => c.put(event.request, copy)); }
      return res;
    }).catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});
