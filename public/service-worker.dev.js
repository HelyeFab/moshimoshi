/**
 * Moshimoshi PWA Service Worker - DEVELOPMENT MODE
 *
 * This is a minimal service worker for development that:
 * - Passes through ALL requests without caching
 * - Clears any existing caches on activation
 * - Activates immediately (skipWaiting)
 * - Provides clear console logging
 *
 * Use this to avoid caching issues during development.
 * Production uses service-worker.js with full caching.
 */

const SW_TYPE = 'DEVELOPMENT';
const CACHE_VERSION = `moshimoshi-dev-${Date.now()}`;

// Log banner on load
console.log('%c[SW-DEV] Development Service Worker Loaded', 'background: #fbbf24; color: #000; padding: 4px 8px; border-radius: 4px; font-weight: bold;');
console.log('[SW-DEV] Cache version:', CACHE_VERSION);
console.log('[SW-DEV] Mode: Pass-through (no caching)');

// Install event - activate immediately
self.addEventListener('install', (event) => {
  console.log('%c[SW-DEV] Installing...', 'color: #fbbf24; font-weight: bold;');

  // Skip waiting to activate immediately
  self.skipWaiting();

  console.log('[SW-DEV] Installation complete - skipping waiting phase');
});

// Activate event - clear ALL caches and take control
self.addEventListener('activate', (event) => {
  console.log('%c[SW-DEV] Activating...', 'color: #fbbf24; font-weight: bold;');

  event.waitUntil((async () => {
    // Clear ALL existing caches
    const cacheNames = await caches.keys();

    if (cacheNames.length > 0) {
      console.log('[SW-DEV] Clearing', cacheNames.length, 'existing cache(s):', cacheNames);
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.log('[SW-DEV] All caches cleared');
    } else {
      console.log('[SW-DEV] No existing caches to clear');
    }

    // Take control of all clients immediately
    await self.clients.claim();

    console.log('%c[SW-DEV] Activated and controlling all clients', 'color: #22c55e; font-weight: bold;');
    console.log('[SW-DEV] All requests will pass through to network (no caching)');
  })());
});

// Fetch event - pass through ALL requests without caching
self.addEventListener('fetch', (event) => {
  // Log only navigation and API requests to reduce noise
  const url = new URL(event.request.url);
  const isNavigation = event.request.mode === 'navigate';
  const isAPI = url.pathname.startsWith('/api/');

  if (isNavigation || isAPI) {
    console.log('[SW-DEV] Pass-through:', event.request.method, url.pathname);
  }

  // Do nothing - let the browser handle the request naturally
  // This is equivalent to having no service worker at all
  return;
});

// Message handler for debugging
self.addEventListener('message', (event) => {
  if (event.data?.type === 'GET_SW_INFO') {
    event.ports[0]?.postMessage({
      type: 'SW_INFO',
      data: {
        mode: SW_TYPE,
        cacheVersion: CACHE_VERSION,
        timestamp: new Date().toISOString()
      }
    });
  }

  if (event.data?.type === 'SKIP_WAITING') {
    console.log('[SW-DEV] Received SKIP_WAITING message');
    self.skipWaiting();
  }
});

// Log when SW is about to be replaced
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});

console.log('%c[SW-DEV] Service Worker script evaluation complete', 'color: #94a3b8;');
