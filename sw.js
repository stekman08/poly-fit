// Version: b5338f8 • 2026-01-06 23:32
// PolyFit Service Worker

// Cache name resolved once and reused (prevents race conditions)
const CACHE_NAME_FALLBACK = 'polyfit-v1';
let resolvedCacheName = null;

async function getCacheName() {
    if (resolvedCacheName) return resolvedCacheName;

    try {
        const response = await fetch('./version.json');
        const versionInfo = await response.json();
        resolvedCacheName = `polyfit-${versionInfo.hash}`;
    } catch {
        resolvedCacheName = CACHE_NAME_FALLBACK;
    }
    console.log(`[Service Worker] Using cache: ${resolvedCacheName}`);
    return resolvedCacheName;
}

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/style.css',
  './js/main.js',
  './js/game.js',
  './js/puzzle.js',
  './js/renderer.js',
  './js/input.js',
  './js/shapes.js',
  './js/worker.js',
  './js/solver.js',
  './js/validation.js',
  './js/sounds.js',
  './js/haptics.js',
  './js/utils.js',
  './js/config/difficulty.js',
  './js/config/constants.js',
  './js/effects/Confetti.js',
  './icons/icon-144.png',
  './icons/icon-192.png',
  './icons/icon-256.png',
  './icons/icon-384.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './manifest.json',
  './version.json'
];

// Install event - cache assets with version-based cache name
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    getCacheName()
      .then(cacheName => caches.open(cacheName))
      .then((cache) => {
        console.log('[Service Worker] Caching assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    getCacheName().then(currentCacheName =>
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete all caches except current one (starts with 'polyfit-')
            if (cacheName.startsWith('polyfit-') && cacheName !== currentCacheName) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
    ).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }

        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          const responseToCache = response.clone();

          // Cache the fetched resource (fire-and-forget)
          getCacheName().then(cacheName => {
            caches.open(cacheName).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          });

          return response;
        }).catch(() => {
          // Network failed, return cached fallback if available
          return caches.match('./index.html');
        });
      })
  );
});
