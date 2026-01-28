# Service Worker Deep Dive

> Technical reference for the Moshimoshi service worker implementation

**Last Updated**: 2025-01-26
**Version**: 4.0.0 (v1429-dev-bypass)
**Location**: `/public/service-worker.js` (487 lines)
**Architecture**: Hand-written (no Workbox)

---

## Overview

The Moshimoshi service worker follows a **strict cache discipline** philosophy:
- Only precache versioned static assets (hashed filenames)
- No runtime caching of API or dynamic data
- Minimal, auditable code (~500 lines total)
- Deterministic versioning with automatic cleanup

### Why Hand-Written (Not Workbox)?
1. **Auditability**: Every line of caching logic is visible and controllable
2. **Minimal Footprint**: No external dependencies, smaller bundle
3. **Full Control**: Custom strategies tailored to app needs
4. **Transparency**: Clear understanding of what's cached and when

---

## Cache Architecture

### Cache Names

```javascript
const CACHE_VERSION = 'moshimoshi-v1429-dev-bypass';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const AUDIO_CACHE = `${CACHE_VERSION}-audio`;
const PAGES_CACHE = `${CACHE_VERSION}-pages`;
```

| Cache Name | Purpose | Strategy | TTL |
|------------|---------|----------|-----|
| `STATIC_CACHE` | Hashed JS/CSS, icons, fonts | Cache-first | Deploy cycle |
| `AUDIO_CACHE` | TTS & kana audio files | Cache-first, LRU | 30 days |
| `PAGES_CACHE` | Offline-enabled HTML pages | Network-first | Visit-based |

### Cache Versioning Strategy
- Version format: `moshimoshi-v[build-number]-[variant]`
- Bump version on each production deploy
- Old caches automatically purged on activation
- Valid caches preserved during cleanup

---

## Cache Strategies by Content Type

| Content Type | Pattern | Strategy | Cache | Notes |
|--------------|---------|----------|-------|-------|
| Static JS | `/_next/static/*.js` | Cache-first | STATIC | Hashed filenames |
| Static CSS | `/_next/static/*.css` | Cache-first | STATIC | Hashed filenames |
| Fonts | `*.woff`, `*.woff2` | Cache-first | STATIC | - |
| App Icons | `/favicon-*.png` | Cache-first | STATIC | Precached |
| Kanji Data | `/data/kanji/*.json` | Cache-first | STATIC | Precached |
| Stall Images | `/ui/flat-icons/stalls/*` | Cache-first | STATIC | Precached |
| Audio Files | `/audio/*.mp3` | Cache-first | AUDIO | LRU cleanup |
| HTML Pages | Offline-enabled routes | Network-first | PAGES | On-visit caching |
| RSC Payloads | `?_rsc` requests | Network-first | PAGES | For client nav |
| API Requests | `/api/*` | Network-only | - | No caching |
| External | Cross-origin | Pass-through | - | Except fonts |

---

## Offline-Enabled Pages

These pages are cached when visited and served offline:

```javascript
const OFFLINE_ENABLED_PAGES = [
  '/dashboard',           // Learning Village main page
  '/learn/hiragana',      // Hiragana learning
  '/learn/katakana',      // Katakana learning
  '/kanji-browser',       // Kanji browser (uses precached JSON)
  '/drill',               // Kana drill
  '/learn/conjugation',   // Verb conjugation
  '/vocabulary',          // Vocabulary (Jisho has embedded data)
  '/news',                // News page (articles cached in IndexedDB)
  '/library',             // Library page (books cached in IndexedDB)
  '/stories',             // Stories page (stories cached in IndexedDB)
  '/kanji-moods',         // Kanji moodboards
  '/kanji-connection',    // Kanji connections (families/radicals/SKIP)
  '/flashcards',          // Flashcards (dedicated SyncManager)
  '/lists',               // User lists (IndexedDB primary storage)
  '/textbook-vocabulary', // Textbook vocabulary (bundled JSON)
];
```

**Note**: Actual content data is stored in IndexedDB, not Cache API.

---

## Lifecycle Events

### Install Phase (Lines 92-122)

```javascript
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);

    // Cache with timeout for dev mode compatibility
    const cacheWithTimeout = async (url, timeout = 3000) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      // ... fetch and cache logic
    };

    await Promise.all(PRECACHE_URLS.map(url => cacheWithTimeout(url)));

    // Note: skipWaiting() NOT called automatically
    // Controlled via SKIP_WAITING message from app
  })());
});
```

**Key Points**:
- Precaches all URLs in `PRECACHE_URLS` array
- Uses timeout (3s) to handle dev server slowness
- Does NOT auto-skip waiting (user controls update)
- Logs installation progress

### Activate Phase (Lines 124-148)

```javascript
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    const validCaches = [STATIC_CACHE, AUDIO_CACHE, PAGES_CACHE];

    // Delete old version caches
    await Promise.all(
      cacheNames.map((cacheName) => {
        if (cacheName.startsWith('moshimoshi-') &&
            !validCaches.includes(cacheName)) {
          return caches.delete(cacheName);
        }
      })
    );

    // Take control of all clients
    await self.clients.claim();
  })());
});
```

**Key Points**:
- Deletes all caches from previous versions
- Preserves only current version caches
- Claims all clients immediately
- Ensures clean upgrade path

### Fetch Handler (Lines 150-409)

The fetch handler implements multiple strategies based on request type:

#### 1. Navigation Requests (Lines 174-278)

```javascript
// Development mode detection
const isDevelopment = url.hostname === 'localhost' ||
                      url.hostname === '127.0.0.1' ||
                      url.port === '3000';

// Dev mode + online: bypass SW completely
if (isDevelopment && isOnline) {
  return; // Let request go through naturally
}

// Offline-enabled pages: network-first with cache fallback
if (isOfflineEnabledPage) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      pagesCache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cachedPage = await pagesCache.match(request);
    if (cachedPage) return cachedPage;
    // Fall through to offline page
  }
}
```

**Timeout Handling**:
- Development: 30 second timeout
- Production: 5 second timeout

#### 2. RSC (React Server Components) Requests (Lines 280-312)

```javascript
const isRSCRequest = url.searchParams.has('_rsc') ||
                     url.pathname.includes('/_next/data/');

if (isRSCRequest) {
  // Cache RSC payloads for offline-enabled pages
  if (response.ok && isOfflinePageRSC) {
    pagesCache.put(request, response.clone());
  }
}
```

**Note**: RSC caching enables client-side navigation when offline.

#### 3. Static Assets (Lines 314-341)

```javascript
const isStaticAsset =
  url.pathname.includes('/_next/static/') ||
  url.pathname.match(/\.[a-f0-9]{8,}\.(js|css)$/) ||
  url.pathname.match(/\.(woff|woff2|ttf|eot)$/) ||
  url.pathname.startsWith('/ui/flat-icons/stalls/') ||
  url.pathname.startsWith('/data/kanji/');

if (isStaticAsset) {
  // Cache-first strategy
  return caches.match(request).then((response) => {
    return response || fetch(request).then((fetchResponse) => {
      if (fetchResponse.ok) {
        caches.open(STATIC_CACHE).then((cache) => {
          cache.put(request, fetchResponse.clone());
        });
      }
      return fetchResponse;
    });
  });
}
```

#### 4. Audio Assets (Lines 343-404)

```javascript
const isAudioAsset = url.pathname.startsWith('/audio/') &&
  url.pathname.match(/\.(mp3|wav|ogg|m4a)$/i);

if (isAudioAsset) {
  // Cache-first with LRU cleanup
  const cacheKey = new Request(request.url); // Strip Range headers
  const cachedResponse = await cache.match(cacheKey);

  if (cachedResponse) return cachedResponse;

  // Fetch without Range header to get full response (200, not 206)
  const fetchRequest = new Request(request.url, {
    method: 'GET',
    headers: {}, // No Range header
  });

  const networkResponse = await fetch(fetchRequest);

  // Only cache full responses (200 OK)
  if (networkResponse.ok && networkResponse.status === 200) {
    await cache.put(cacheKey, responseToCache);
    cleanupAudioCache(cache); // Async LRU cleanup
  }

  return networkResponse;
}
```

**Audio Cache Configuration**:
```javascript
const AUDIO_CACHE_CONFIG = {
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  maxEntries: 250, // ~200 kana + buffer
};
```

---

## Message API

### Supported Messages

| Message Type | Direction | Purpose |
|--------------|-----------|---------|
| `SKIP_WAITING` | App -> SW | Activate waiting SW |
| `GET_AUDIO_CACHE_STATS` | App -> SW | Debug: get cache info |
| `CLEAR_AUDIO_CACHE` | App -> SW | Debug: clear audio cache |

### Message Handler (Lines 428-448)

```javascript
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data?.type === 'GET_AUDIO_CACHE_STATS') {
    getAudioCacheStats().then(stats => {
      event.ports[0].postMessage({ type: 'AUDIO_CACHE_STATS', data: stats });
    });
  }

  if (event.data?.type === 'CLEAR_AUDIO_CACHE') {
    caches.delete(AUDIO_CACHE).then(() => {
      event.ports[0].postMessage({ type: 'AUDIO_CACHE_CLEARED' });
    });
  }
});
```

### Usage Example

```javascript
// Tell SW to skip waiting and activate
const reg = await navigator.serviceWorker.getRegistration();
if (reg?.waiting) {
  reg.waiting.postMessage({ type: 'SKIP_WAITING' });
}

// Get audio cache stats
const channel = new MessageChannel();
channel.port1.onmessage = (event) => {
  console.log('Audio cache stats:', event.data);
};
navigator.serviceWorker.controller?.postMessage(
  { type: 'GET_AUDIO_CACHE_STATS' },
  [channel.port2]
);
```

---

## Development vs Production

| Aspect | Development | Production |
|--------|-------------|------------|
| SW Registration | Disabled by default | Always enabled |
| Fetch timeout | 30 seconds | 5 seconds |
| Dev mode bypass | Yes (when online) | No |
| Console logging | Verbose | Minimal |
| Cache version | `-dev-bypass` suffix | Build hash |

### Enable SW in Development

```bash
# Set environment variable
NEXT_PUBLIC_ENABLE_SW_DEV=true npm run dev
```

### Dev Mode Detection

```javascript
const isDevelopment = url.hostname === 'localhost' ||
                      url.hostname === '127.0.0.1' ||
                      url.port === '3000' ||
                      url.port === '3001';
```

---

## Firebase Messaging Service Worker

**Location**: `/public/firebase-messaging-sw.js` (346 lines)

### Initialization

```javascript
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();
```

### Background Message Handling (Lines 27-91)

```javascript
messaging.onBackgroundMessage((payload) => {
  const notificationType = payload.data?.type || 'review_reminder';

  // Customize based on type
  switch (notificationType) {
    case 'review_due':
      title = '⏰ Time to Review!';
      break;
    case 'achievement':
      title = '🏆 Achievement Unlocked!';
      break;
    case 'streak_reminder':
      title = '🔥 Keep Your Streak!';
      break;
    case 'summary':
      title = '📊 Daily Summary';
      break;
  }

  return self.registration.showNotification(title, options);
});
```

### Notification Types

| Type | Title | Actions | requireInteraction |
|------|-------|---------|-------------------|
| `review_due` | Time to Review! | Start Review, Snooze | Yes |
| `achievement` | Achievement Unlocked! | View Progress | No |
| `streak_reminder` | Keep Your Streak! | Keep Streak | No |
| `summary` | Daily Summary | Open App, Dismiss | No |

### Click Handling (Lines 94-161)

```javascript
self.addEventListener('notificationclick', (event) => {
  notification.close();

  switch (action) {
    case 'start_review':
      targetUrl = '/review';
      break;
    case 'snooze':
      scheduleLocalNotification(30 * 60 * 1000, {...});
      return; // Don't open app
    case 'dismiss':
      return; // Just close
  }

  // Open or focus app window
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Focus existing window or open new one
    })
  );
});
```

---

## Build Process Integration

### Precache Injection

The `PRECACHE_URLS` array should be updated on each build:

```javascript
const PRECACHE_URLS = [
  // Build script injects hashed assets here
  '/static/chunks/webpack-[hash].js',
  '/static/chunks/framework-[hash].js',
  '/_next/static/css/[hash].css',
  // ...

  // Static assets
  '/offline.html',
  '/manifest.json',
  '/favicon.ico',
  '/doshi.png',

  // Learning Village stalls
  '/ui/flat-icons/stalls/*.png',

  // Kanji data
  '/data/kanji/jlpt_*.json',
];
```

### Build Script (Recommended)

```bash
# package.json scripts
{
  "build:sw": "node scripts/inject-precache.js",
  "build:prod": "npm run build && npm run build:sw"
}
```

---

## Code Annotations

### Key Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `cacheWithTimeout()` | Line 98 | Timeout wrapper for dev mode |
| `cleanupAudioCache()` | Line 414 | LRU cache cleanup |
| `getAudioCacheStats()` | Line 453 | Debug info retrieval |

### Important Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `CACHE_VERSION` | `moshimoshi-v1429-dev-bypass` | Cache namespace |
| `AUDIO_CACHE_CONFIG.maxAge` | 30 days | Audio expiry |
| `AUDIO_CACHE_CONFIG.maxEntries` | 250 | LRU limit |
| Navigation timeout (dev) | 30000ms | Dev server allowance |
| Navigation timeout (prod) | 5000ms | Fast fail for prod |

---

## Related Documents

- [Architecture Overview](./00-architecture-overview.md) - System design
- [API Reference](./02-api-reference.md) - Client-side APIs
- [Troubleshooting Guide](./04-troubleshooting-guide.md) - Debug techniques
- [Cache Policy](./PWA_CACHE_POLICY.md) - Cache strategy details

---

## Changelog

| Date | Change |
|------|--------|
| 2025-01-26 | Initial deep dive documentation |
| 2025-01-10 | Audio caching with LRU added |
| 2025-01-05 | Development mode bypass added |
