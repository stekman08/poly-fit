// Version: 4c31bfb • 2025-12-26 13:40
// PolyFit Service Worker
// Cache name will be set dynamically based on version
let CACHE_NAME = 'polyfit-v1'; // fallback

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
    fetch('./version.json')
      .then(response => response.json())
      .then(versionInfo => {
        CACHE_NAME = `polyfit-${versionInfo.hash}`;
        console.log(`[Service Worker] Using cache: ${CACHE_NAME}`);
        return caches.open(CACHE_NAME);
      })
      .catch(() => {
        // Fallback if version.json doesn't exist
        console.log('[Service Worker] Using fallback cache name');
        return caches.open(CACHE_NAME);
      })
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
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete all caches except current one (starts with 'polyfit-')
          if (cacheName.startsWith('polyfit-') && cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Clone the request
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then((response) => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          // Cache the fetched resource
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });

          return response;
        }).catch(() => {
          // Network failed, return cached fallback if available
          return caches.match('./index.html');
        });
      })
  );
});
