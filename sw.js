// PregnaCare service worker — minimal, mainly for installability.
// PHP pages need the live server + database, so we only cache static assets
// (CSS, icon). Everything else is fetched normally from the network.
const CACHE_NAME = 'pregnacare-static-v1';
const STATIC_ASSETS = [
  'css/style.css',
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Only serve cached copies for our known static assets; let PHP pages always hit the network.
  if (STATIC_ASSETS.some((a) => url.pathname.endsWith(a))) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  }
});
