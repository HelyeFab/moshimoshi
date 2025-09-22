// Service Worker for Review Engine Offline Support

const CACHE_NAME = 'moshimoshi-review-v1';
const STATIC_CACHE = 'moshimoshi-static-v1';
const API_CACHE = 'moshimoshi-api-v1';

// URLs to cache on install
const urlsToCache = [
  '/',
  '/review',
  '/offline.html',
  '/manifest.json',
  '/favicon.ico'
];

// Static asset patterns
const staticAssetPatterns = [
  /\.js$/,
  /\.css$/,
  /\.woff2?$/,
  /\.ttf$/,
  /\.eot$/,
  /\.svg$/,
  /\.png$/,
  /\.jpg$/,
  /\.jpeg$/,
  /\.gif$/,
  /\.webp$/
];

// API endpoint patterns
const apiPatterns = [
  /\/api\/review\//,
  /\/api\/content\//,
  /\/api\/progress\//,
  /\/api\/statistics\//
];

// Install event - cache essential files
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[ServiceWorker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[ServiceWorker] Skip waiting');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && 
              cacheName !== STATIC_CACHE && 
              cacheName !== API_CACHE) {
            console.log('[ServiceWorker] Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[ServiceWorker] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch event - handle requests with appropriate strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }
  
  // Determine caching strategy based on request type
  if (isStaticAsset(url.pathname)) {
    // Cache-first strategy for static assets
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  } else if (isApiRequest(url.pathname)) {
    // Network-first strategy for API calls
    event.respondWith(networkFirst(request, API_CACHE));
  } else {
    // Stale-while-revalidate for HTML pages
    event.respondWith(staleWhileRevalidate(request, CACHE_NAME));
  }
});

// Background sync for review data
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Background sync:', event.tag);
  
  if (event.tag === 'review-sync') {
    event.waitUntil(syncReviewData());
  } else if (event.tag === 'progress-sync') {
    event.waitUntil(syncProgressData());
  } else if (event.tag === 'statistics-sync') {
    event.waitUntil(syncStatistics());
  }
});

// Message handling for manual cache updates
self.addEventListener('message', (event) => {
  console.log('[ServiceWorker] Message received:', event.data);
  
  if (event.data.type === 'CACHE_CONTENT') {
    cacheContent(event.data.urls);
  } else if (event.data.type === 'CLEAR_CACHE') {
    clearCache(event.data.cacheName);
  } else if (event.data.type === 'GET_CACHE_STATUS') {
    getCacheStatus().then(status => {
      event.ports[0].postMessage({ type: 'CACHE_STATUS', data: status });
    });
  }
});

// Caching strategies

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.error('[ServiceWorker] Fetch failed:', error);
    // Return offline page if available
    const offlineResponse = await caches.match('/offline.html');
    return offlineResponse || new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('[ServiceWorker] Network request failed, falling back to cache');
    const cached = await cache.match(request);
    
    if (cached) {
      return cached;
    }
    
    // Return error response for API requests
    return new Response(
      JSON.stringify({ error: 'Offline', cached: false }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(error => {
    console.error('[ServiceWorker] Revalidation failed:', error);
    return cached || new Response('Offline', { status: 503 });
  });
  
  return cached || fetchPromise;
}

// Sync functions

async function syncReviewData() {
  console.log('[ServiceWorker] Syncing review data');
  
  try {
    // Open IndexedDB
    const db = await openDB();
    const tx = db.transaction('syncQueue', 'readonly');
    const store = tx.objectStore('syncQueue');
    const index = store.index('status');
    const pending = await index.getAll('pending');
    
    console.log(`[ServiceWorker] Found ${pending.length} pending items to sync`);
    
    // Process each pending item
    for (const item of pending) {
      try {
        const response = await fetch('/api/review/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.data)
        });
        
        if (response.ok) {
          // Mark as synced in IndexedDB
          const updateTx = db.transaction('syncQueue', 'readwrite');
          const updateStore = updateTx.objectStore('syncQueue');
          item.status = 'completed';
          await updateStore.put(item);
          
          console.log('[ServiceWorker] Successfully synced item:', item.id);
        } else {
          console.error('[ServiceWorker] Sync failed with status:', response.status);
        }
      } catch (error) {
        console.error('[ServiceWorker] Failed to sync item:', error);
      }
    }
    
    return true;
  } catch (error) {
    console.error('[ServiceWorker] Sync failed:', error);
    return false;
  }
}

async function syncProgressData() {
  console.log('[ServiceWorker] Syncing progress data');
  // Similar implementation to syncReviewData
  return true;
}

async function syncStatistics() {
  console.log('[ServiceWorker] Syncing statistics');
  // Similar implementation to syncReviewData
  return true;
}

// Helper functions

function isStaticAsset(pathname) {
  return staticAssetPatterns.some(pattern => pattern.test(pathname));
}

function isApiRequest(pathname) {
  return apiPatterns.some(pattern => pattern.test(pathname));
}

async function cacheContent(urls) {
  const cache = await caches.open(CACHE_NAME);
  
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        await cache.put(url, response);
        console.log('[ServiceWorker] Cached:', url);
      }
    } catch (error) {
      console.error('[ServiceWorker] Failed to cache:', url, error);
    }
  }
}

async function clearCache(cacheName) {
  if (cacheName) {
    await caches.delete(cacheName);
    console.log('[ServiceWorker] Cleared cache:', cacheName);
  } else {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log('[ServiceWorker] Cleared all caches');
  }
}

async function getCacheStatus() {
  const cacheNames = await caches.keys();
  const status = {};
  
  for (const name of cacheNames) {
    const cache = await caches.open(name);
    const keys = await cache.keys();
    status[name] = {
      count: keys.length,
      urls: keys.map(req => req.url)
    };
  }
  
  return status;
}

async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MoshimoshiReviewDB', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Periodic background sync registration
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'review-periodic-sync') {
    console.log('[ServiceWorker] Periodic sync triggered');
    event.waitUntil(syncReviewData());
  }
});

console.log('[ServiceWorker] Loaded');