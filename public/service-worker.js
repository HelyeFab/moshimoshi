/**
 * Moshimoshi PWA Service Worker - Production Ready
 * Version: 4.0.0
 *
 * STRICT CACHE DISCIPLINE:
 * - Only precaches hashed static assets
 * - No runtime caching of API/dynamic data
 * - Minimal, auditable, and safe
 */

const CACHE_VERSION = 'moshimoshi-v1423bbe7';
const STATIC_CACHE = `${CACHE_VERSION}-static`;

// Precache URLs - will be injected by build script
// Build script will replace this with actual hashed assets
const PRECACHE_URLS = [
  '/static/chunks/webpack-6883c85f8afc74d0.js',
  '/static/chunks/framework-0907bc41f77e1d3c.js',
  '/static/chunks/main-911004091fe3e3d1.js',
  '/static/chunks/7682-caa357324673ab6a.js',
  '/static/chunks/6366-8a91e47862a0e5a6.js',
  '/static/chunks/pages/403-b2c8f393c7ed8fdb.js',
  '/static/chunks/pages/500-bd96021f83d925e7.js',
  '/static/chunks/pages/_app-4b3fb5e477a0267f.js',
  '/static/chunks/pages/_error-c970d8b55ace1b48.js',
  '/_next/static/css/7a590166771372f1.css',
  '/_next/static/css/7e7d96b1e6991756.css',
  '/offline.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon-192x192.png',
  '/favicon-512x512.png',
  '/_next/static/chunks/framework-0907bc41f77e1d3c.js',
  '/_next/static/chunks/main-911004091fe3e3d1.js',
  '/_next/static/chunks/main-app-897129e07df0fca6.js',
  '/_next/static/chunks/polyfills-42372ed130431b0a.js',
  '/_next/static/chunks/webpack-6883c85f8afc74d0.js'
];

// Install event - cache essential files only
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.addAll(PRECACHE_URLS);
    self.skipWaiting();
  })());
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Get all cache names
    const cacheNames = await caches.keys();

    // Delete all caches that don't match current version
    await Promise.all(
      cacheNames.map((cacheName) => {
        if (cacheName.startsWith('moshimoshi-') && cacheName !== STATIC_CACHE) {
          return caches.delete(cacheName);
        }
      })
    );

    // Take control of all clients
    await self.clients.claim();
  })());
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests except for allowed CDNs
  if (url.origin !== self.location.origin) {
    // Allow specific CDNs if needed (e.g., fonts, analytics)
    const allowedOrigins = [
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
    ];

    if (!allowedOrigins.some(origin => url.origin === origin)) {
      return;
    }
  }

  // Check if this is a navigation request
  const isNavigationRequest = request.mode === 'navigate' ||
    (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));

  if (isNavigationRequest) {
    // Navigation requests - network first, fallback to offline page
    event.respondWith(
      fetch(request)
        .catch(async () => {
          const cache = await caches.open(STATIC_CACHE);
          return cache.match('/offline.html') ||
            new Response('Offline', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' }
            });
        })
    );
    return;
  }

  // Static assets - check if it's a hashed asset
  const isStaticAsset =
    url.pathname.includes('/_next/static/') ||
    url.pathname.match(/\.[a-f0-9]{8,}\.(js|css)$/) ||
    url.pathname.match(/\.(woff|woff2|ttf|eot)$/);

  if (isStaticAsset) {
    // Serve from cache first, fallback to network
    event.respondWith(
      caches.match(request).then((response) => {
        return response || fetch(request).then((fetchResponse) => {
          // Only cache successful responses
          if (fetchResponse.ok) {
            return caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, fetchResponse.clone());
              return fetchResponse;
            });
          }
          return fetchResponse;
        });
      })
    );
    return;
  }

  // All other requests - network only (no caching)
  // This includes API calls, data fetches, etc.
  return;
});

// Message event for skip waiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});