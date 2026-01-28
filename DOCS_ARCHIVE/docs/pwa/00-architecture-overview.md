# PWA Architecture Overview

> Comprehensive system design documentation for the Moshimoshi PWA

**Last Updated**: 2025-01-26
**Version**: 4.0.0
**Owner**: PWA Foundation Team (Agent 1)

---

## System Philosophy

The Moshimoshi PWA follows these core principles:

### 1. Strict Cache Discipline
- Only precache versioned static assets (hashed filenames)
- No runtime caching of API or dynamic data
- Deterministic cache versioning with automatic cleanup
- Minimal, auditable service worker code

### 2. Offline-First Design
- IndexedDB as primary storage for app data
- Network as synchronization mechanism
- Graceful degradation when offline
- Progressive enhancement for advanced features

### 3. Tiered Entitlements
- **Guest**: Basic PWA features only
- **Free**: Push, Background Sync, Share Target, Badging, Media Session
- **Premium**: Periodic Sync, File System Access

### 4. Event-Driven Updates
- Service worker lifecycle events
- Custom events for UI coordination
- Message passing between SW and main thread

---

## High-Level Architecture

```
+------------------------------------------------------------------+
|                        MAIN THREAD                                |
|                                                                  |
|  +----------------+  +----------------+  +----------------+      |
|  | React App      |  | PWA Components |  | PWA Utilities  |      |
|  | (Next.js)      |  | - InstallPrompt|  | - a2hsManager  |      |
|  |                |  | - UpdateBanner |  | - badgeManager |      |
|  |                |  | - OfflineBanner|  | - entitlements |      |
|  +-------+--------+  +-------+--------+  +-------+--------+      |
|          |                   |                   |               |
|          +-------------------+-------------------+               |
|                              |                                   |
|                    +---------v----------+                        |
|                    | registerServiceWorker                       |
|                    | (SW Lifecycle Mgmt) |                       |
|                    +---------+-----------+                       |
+------------------------------|-----------------------------------+
                               |
                    postMessage / Events
                               |
+------------------------------|-----------------------------------+
|                    SERVICE WORKER THREAD                         |
|                              |                                   |
|  +-----------+    +----------v-----------+    +---------------+  |
|  | Cache API |<-->| service-worker.js    |<-->| Network       |  |
|  | - static  |    | (487 lines)          |    | Requests      |  |
|  | - audio   |    | - Install/Activate   |    |               |  |
|  | - pages   |    | - Fetch handler      |    |               |  |
|  +-----------+    | - Message handler    |    +---------------+  |
|                   +----------------------+                       |
|                                                                  |
|  +--------------------------------------------------------+     |
|  | firebase-messaging-sw.js (346 lines)                    |     |
|  | - Push notifications                                    |     |
|  | - Background message handling                           |     |
|  | - Notification click actions                            |     |
|  +--------------------------------------------------------+     |
+------------------------------------------------------------------+
                               |
                          IndexedDB
                               |
+------------------------------|-----------------------------------+
|                    DATA LAYER                                    |
|                              |                                   |
|  +------------------+  +-----v------+  +-------------------+     |
|  | idbClient        |  | outbox     |  | firebase-sync     |     |
|  | - Lists API      |  | - Queue ops|  | - Two-way sync    |     |
|  | - Review items   |  | - Retry    |  | - Conflict resolve|     |
|  | - Streaks        |  | - Status   |  | - Account cleanup |     |
|  +------------------+  +------------+  +-------------------+     |
+------------------------------------------------------------------+
```

---

## Component Inventory

### Service Workers

| File | Lines | Purpose |
|------|-------|---------|
| `/public/service-worker.js` | 487 | Main PWA service worker |
| `/public/firebase-messaging-sw.js` | 346 | FCM push notification handler |
| `/public/push-sw.js` | ~50 | Optional push-only SW |
| `/public/review-sw.js` | ~100 | Review engine offline support |

### Client-Side PWA Utilities (`/src/lib/pwa/`)

| File | Lines | Purpose |
|------|-------|---------|
| `a2hs.ts` | 244 | Add to Home Screen manager |
| `badging.ts` | 180 | App badge API integration |
| `entitlements.ts` | 77 | Feature gates per user tier |
| `registerServiceWorker.ts` | 217 | SW registration & lifecycle |
| `mediaSession.ts` | ~150 | Media controls for TTS |
| `notifications.ts` | ~200 | Notification display |
| `notificationHandler.ts` | ~250 | Notification scheduling |
| `translations-pwa.ts` | ~50 | PWA-specific i18n |

### React Components (`/src/components/pwa/`)

| Component | Purpose |
|-----------|---------|
| `ServiceWorkerProvider.tsx` | SW lifecycle context provider |
| `PWAInstallPrompt.tsx` | A2HS custom prompt with iOS support |
| `UpdateBanner.tsx` | SW update notification (critical/normal) |
| `OfflineBanner.tsx` | Offline status indicator |
| `BadgeFallback.tsx` | Badge UI when API not supported |
| `NotificationPermissionFlow.tsx` | Permission request UX |
| `AppVersionSection.tsx` | Version display in settings |

### Data Layer (`/src/lib/idb/`)

| File | Purpose |
|------|---------|
| `client.ts` | IndexedDB wrapper (Lists API) |
| `types.ts` | TypeScript type definitions |
| `outbox.ts` | Sync queue management |
| `firebase-sync.ts` | Firebase cloud sync |
| `sync-worker.ts` | Background sync handlers |
| `account-cleanup.ts` | Account deletion cleanup |

---

## Data Flow Diagrams

### Cache Flow

```
[Browser Request]
       |
       v
+------+------+
| Service     |
| Worker      |
+------+------+
       |
       +-- Is Static Asset? (/_next/static/*, /data/kanji/*)
       |         |
       |         v YES
       |   +-----+-----+
       |   | Check     |
       |   | STATIC    |
       |   | CACHE     |
       |   +-----+-----+
       |         |
       |    +----+----+
       |    |         |
       |   HIT       MISS
       |    |         |
       |    v         v
       |  Return   Fetch -> Cache -> Return
       |
       +-- Is Audio? (/audio/*.mp3)
       |         |
       |         v YES
       |   +-----+-----+
       |   | Check     |
       |   | AUDIO     |
       |   | CACHE     |
       |   +-----+-----+
       |         |
       |    +----+----+
       |    |         |
       |   HIT       MISS
       |    |         |
       |    v         v
       |  Return   Fetch -> Cache (LRU 250) -> Return
       |
       +-- Is Navigation? (text/html)
       |         |
       |         v YES
       |   +-----+-----+
       |   | Network   |
       |   | First     |
       |   +-----+-----+
       |         |
       |    +----+----+
       |    |         |
       |  SUCCESS   FAIL
       |    |         |
       |    v         v
       |  Cache    Check PAGES_CACHE
       |  + Return     |
       |          +----+----+
       |          |         |
       |         HIT       MISS
       |          |         |
       |          v         v
       |       Return   Return /offline.html
       |
       +-- Is API/Other?
                 |
                 v
           Network Only (no caching)
```

### Offline Sync Flow

```
[User Action (offline)]
       |
       v
+------+------+
| IndexedDB   |
| Write       |
+------+------+
       |
       v
+------+------+
| Add to      |
| Outbox      |
+------+------+
       |
       +-- Register 'sync-outbox' event
       |
       v
[Network Restored]
       |
       v
+------+------+
| sync event  |
| fires       |
+------+------+
       |
       v
+------+------+
| Process     |
| Outbox      |
+------+------+
       |
       +-- For each operation:
       |         |
       |         v
       |   +-----+-----+
       |   | POST to   |
       |   | /api/sync |
       |   +-----+-----+
       |         |
       |    +----+----+
       |    |         |
       |  SUCCESS    FAIL
       |    |         |
       |    v         v
       |  Remove   Retry with
       |  from     exponential
       |  outbox   backoff
       |
       v
[Sync Complete]
       |
       v
+------+------+
| Dispatch    |
| 'syncComplete'|
+------+------+
```

### Push Notification Flow

```
[Server sends push]
       |
       v
+------+------+
| FCM Service |
+------+------+
       |
       v
+------+------+
| firebase-   |
| messaging-  |
| sw.js       |
+------+------+
       |
       +-- Is App in Foreground?
       |         |
       |    +----+----+
       |    |         |
       |   YES        NO
       |    |         |
       |    v         v
       |  Skip     Show
       |  (handled notification
       |  by app)     |
       |              v
       |        +-----+-----+
       |        | User      |
       |        | clicks    |
       |        +-----+-----+
       |              |
       |              v
       |        +-----+-----+
       |        | Open/Focus|
       |        | app window|
       |        +-----+-----+
       |              |
       |              v
       |        Navigate to
       |        targetUrl
```

---

## Entitlements Matrix

| Feature | Guest | Free | Premium | API Used |
|---------|:-----:|:----:|:-------:|----------|
| `push` | - | Yes | Yes | Push API, FCM |
| `bgSync` | - | Yes | Yes | Background Sync API |
| `periodicSync` | - | - | Yes | Periodic Background Sync |
| `shareTarget` | - | Yes | Yes | Web Share Target API |
| `fsAccess` | - | - | Yes | File System Access API |
| `badging` | - | Yes | Yes | Badging API |
| `mediaSession` | - | Yes | Yes | Media Session API |

**Legend**: Yes = Enabled, - = Disabled

---

## Integration Points

### Review Engine Integration
- Offline review session storage via IndexedDB
- Queue synchronization with SRS state
- Badge updates from due review count
- Push notifications for review reminders

### Firebase Cloud Messaging
- Push subscription management
- Background message handling
- Notification action routing
- Token refresh handling

### TTS (Text-to-Speech) Integration
- Audio file caching (kana, kanji readings)
- Media Session API for playback controls
- Cache-first strategy for pronunciations
- LRU cache with 250 entry limit

### Learning Village (Dashboard)
- Stall images precached for offline
- Streak data synced via IndexedDB
- XP counters updated offline-first

---

## Security Model

### Cache Security
- No sensitive data in Cache API
- Authentication tokens never cached
- Cross-origin requests filtered
- Only same-origin assets cached

### Token Handling
- HTTP-only cookies for sessions
- JWT stored in memory only
- No localStorage for auth tokens
- IndexedDB for non-sensitive user data

### HTTPS Enforcement
- Service workers require HTTPS
- Exception: localhost for development
- Mixed content blocked

### Content Security
- Cross-origin filtering in fetch handler
- Allowed origins whitelist (fonts, CDNs)
- No opaque responses cached

---

## Performance Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| SW Install Time | <100ms | Fast initial experience |
| SW Activate Time | <50ms | Quick takeover |
| Cache Lookup | <10ms | Fast offline responses |
| Offline Page Load | <500ms | Responsive offline UX |
| Precache Size | <5MB | Reasonable storage |
| Audio Cache | <50MB | Max 250 files @ ~200KB |
| Pages Cache | <10MB | Dynamic page caching |

### Core Web Vitals Targets
| Metric | Target | Status |
|--------|--------|--------|
| LCP | <2.0s | Met |
| INP | <200ms | Met |
| CLS | <0.05 | Met |

---

## Related Documents

- [Service Worker Deep Dive](./01-service-worker-deep-dive.md) - Technical SW reference
- [API Reference](./02-api-reference.md) - Complete API documentation
- [PWA MVP Blueprint](./moshimoshi-pwa-mvp.md) - Original specification
- [Cache Policy](./PWA_CACHE_POLICY.md) - Cache strategy details

---

## Changelog

| Date | Change |
|------|--------|
| 2025-01-26 | Initial architecture documentation |
| 2025-01-10 | PWA v4.0.0 architecture finalized |
