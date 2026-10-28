const CACHE_NAME = 'file-fabric-v1063';
const urlsToCache = [
  './',
  './index.html',
  './script.js?v=1063',
  './style.css?v=1030',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js'
];

// Install event: cache core assets
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force the waiting service worker to become the active service worker
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim(); // Claim control immediately
});

// Fetch event: Network-First strategy
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip cross-origin requests unless they are our known CDNs
  const url = new URL(event.request.url);
  if (url.origin !== location.origin && 
      !url.hostname.includes('cdnjs.cloudflare.com') && 
      !url.hostname.includes('cdn.jsdelivr.net')) {
      return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // If we got a valid response from the network, clone it and put it in the cache
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
        }
        return networkResponse;
      })
      .catch(() => {
        // If the network fails (offline), fall back to the cache
        return caches.match(event.request, { ignoreSearch: true });
      })
  );
});
