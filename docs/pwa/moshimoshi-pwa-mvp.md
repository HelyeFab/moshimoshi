# moshimoshi — PWA MVP (Strict, Lean, Cutting‑Edge) 🥷

**Goal:** Ship an installable, cache‑disciplined, *blazingly fast* PWA with opt‑in advanced capabilities. Keep the service worker *simple and safe*: only pre‑cache hashed static assets, never cache dynamic API data, and aggressively purge on each release.

---

## 0) Principles & Non‑Negotiables

- **Strict cache policy:** SW only precaches versioned static assets (hashed filenames). No opaque or dynamic data caches.
- **Predictable upgrades:** Each deploy bumps a `CACHE_VERSION`; old caches are purged deterministically.
- **Opt‑in capabilities:** Push, Background Sync, Periodic Sync, FS Access behind explicit user consent + entitlements.
- **Tiered storage:** Guest (none), Free (IndexedDB), Premium (IndexedDB + Firebase Cloud Sync).
- **Accessibility & performance first:** a11y baseline, CWV budgets, offline fallback that is < 10KB.
- **Observability:** RUM (Core Web Vitals) + SW lifecycle logs (dev‑only).

---

## 1) MVP Scope (3 Stages)

### Stage 1 — Foundation (installability + safety) ✅
- Web App Manifest (install prompt readiness)
- Minimal Service Worker (App‑Shell + offline fallback page)
- Precaching only `static/*` hashed assets
- Offline fallback route for navigations (`/offline`)
- IndexedDB for lists, streaks, review items (free tier)
- Custom “Add to Home Screen” prompt (A2HS)

### Stage 2 — Advanced APIs (opt‑in) 🚀
- Web Share Target API (add words/sentences into app)
- Notifications (permission UI + graceful degradation)
- Badging API for review/streak counters
- Media Session API for TTS playback controls
- Background Sync for **pending writes only** (retry on reconnect)

### Stage 3 — Premium Layer 🌟
- Firebase sync (two‑way) with conflict policy
- Periodic Background Sync (daily reminder check; honor quiet hours)
- Export/Import via File System Access API
- RUM metrics stream + lightweight admin dashboard

---

## 2) Reference Architecture

```
/src
  /app                 # Next.js/Router app
  /components          # UI components
  /lib
    /pwa               # A2HS, badge, media-session helpers
    /idb               # IndexedDB wrapper
    /sync              # background sync + Firebase adapters
    /entitlements      # feature gates (guest/free/premium)
    /metrics           # RUM + SW lifecycle logs
/public
  /static              # hashed assets produced by build
  manifest.webmanifest
  offline.html
/service-worker.js     # generated from /src/lib/pwa/sw.ts (or hand-written)
```

- **App‑Shell**: minimal HTML + JS boot; data fetched at runtime (no SW caching).
- **Entitlements** enforce which APIs are available per tier.
- **SW** is **stateless** regarding app data; it only serves shell & fallback.

---

## 3) Service Worker — Strict Template (safe by default)

> **Key idea:** pre‑cache only hashed assets + `offline.html`. No runtime caching for API/data. Short TTL only for fonts (optional).

```js
// /service-worker.js (hand-written, tiny, auditable)
const CACHE_VERSION = 'moshimoshi-v1.0.0'; // bump on each deploy
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PRECACHE_URLS = [
  '/offline.html',
  // Injected by build: '/static/main.abc123.js', '/static/styles.abc123.css', etc.
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.addAll(PRECACHE_URLS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k.startsWith('moshimoshi-') && k !== STATIC_CACHE) ? caches.delete(k) : null));
    self.clients.claim();
  })());
});

// Navigation fallback only; do not handle same-origin API JSON.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const isNavigation = req.mode === 'navigate' || (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'));
  if (!isNavigation) return; // Let the network handle assets/API.

  event.respondWith((async () => {
    try {
      // Always prefer live network for navigations.
      const fresh = await fetch(req);
      return fresh;
    } catch {
      // Offline fallback (tiny HTML).
      const cache = await caches.open(STATIC_CACHE);
      const fallback = await cache.match('/offline.html');
      return fallback || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    }
  })());
});
```

**Build step** should inject actual hashed files into `PRECACHE_URLS`. Avoid Workbox if you want maximal control + minimal footprint.

---

## 4) Manifest (installability)

```json
{
  "name": "moshimoshi",
  "short_name": "moshimoshi",
  "display": "standalone",
  "start_url": "/",
  "background_color": "#ffffff",
  "theme_color": "#111111",
  "icons": [
    { "src": "/static/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/static/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/static/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable any" }
  ]
}
```

---

## 5) IndexedDB Schema (free tier)

**DB:** `moshimoshi`  
**Stores:**

- `lists` → `{ id, type: 'sentences'|'words'|'verbs'|'adjectives', title, createdAt, updatedAt }`
- `items` → `{ id, listId, payload, tags[], createdAt }`
- `reviewQueue` → `{ id, itemId, dueAt, fsrsState, history[] }`
- `streaks` → `{ id: 'global', current, best, lastActiveAt }`
- `settings` → `{ id: 'ui', a2hsDismissedAt, badgeEnabled, mediaSessionEnabled }`

**Indexes:** `items.byListId`, `reviewQueue.byDueAt`

**Wrapper:** Provide a thin async wrapper (`/lib/idb/client.ts`) with typed methods:  
`addList`, `addItemsBulk`, `getDueItems`, `updateStreak`, `tx(fn)`.

---

## 6) Sync Model (premium)

- **Triggers:** login, logout, explicit “Sync now”, successful background sync.
- **Conflict policy:** **LWW** (server time) for streaks/settings; **merge** for lists/items; **append** for review history.
- **Idempotency:** client generates `opId`; server ignores duplicates.
- **Failure handling:** queue writes in `sync_outbox` store; Background Sync retries when online.

**Outbox record:** `{ id: opId, type, payload, createdAt, attempts }`

---

## 7) Background Sync (pending writes only)

- Register `sync` event named `sync-outbox` when outbox isn’t empty.
- SW pulls from `sync_outbox` and POSTs to `/api/sync` with auth.
- Exponential backoff & max attempts; on permanent failure → surface non‑blocking toast when app opens.

```js
// In app code, when adding to outbox:
if ('serviceWorker' in navigator && 'SyncManager' in window) {
  const reg = await navigator.serviceWorker.ready;
  try { await reg.sync.register('sync-outbox'); } catch {}
}
```

> **No periodic sync here**. Only user‑initiated or outbox‑driven retries.

---

## 8) Periodic Background Sync (premium, opt‑in)

- Purpose: daily reminder check (due reviews, streak nudge).
- Honor **quiet hours** from settings.
- Guard behind `entitlements.can('periodicSync')`.

```js
// App-side request (on settings enable):
const reg = await navigator.serviceWorker.ready;
if ('periodicSync' in reg) {
  try { await reg.periodicSync.register('daily-review-check', { minInterval: 24 * 60 * 60 * 1000 }); } catch {}
}
```

**SW handler** queries IndexedDB (via `clients.openWindow` or MessageChannel pattern) or pings a lightweight endpoint that computes “hasPendingReviews” and schedules a push (preferred to keep SW lean).

---

## 9) Web Share Target API

**Manifest addition:**
```json
"share_target": {
  "action": "/share",
  "method": "GET",
  "params": { "title": "title", "text": "text", "url": "url" }
}
```

**Handler:** `/share` route parses inputs → opens “Add to list” dialog → saves to IndexedDB (or outbox).

---

## 10) Notifications (opt‑in)

- **Frontend:** clear consent UX, preview of what you’ll receive, “quiet hours” setting.
- **Backend:** enqueue web‑push only if user opted in + token valid + entitlement allows.
- **Categories:** reminders, streak milestones, review tips (user‑selectable).
- **Unsubscribe** UX always visible.

---

## 11) Badging & Media Session

- **Badging:** show count of due reviews or streak day. Fallback to in‑app chip if API unsupported.
- **Media Session:** set metadata for TTS audio; prev/next mapped to sentence navigation.

```js
if ('setAppBadge' in navigator) {
  const count = await getDueCount();
  try { await navigator.setAppBadge(count > 0 ? count : 0); } catch {}
}
```

---

## 12) Entitlements (feature gates)

- `can(featureId)` → boolean per tier (guest/free/premium)
- Features: `push`, `bgSync`, `periodicSync`, `shareTarget`, `fsAccess`, `badging`, `mediaSession`
- UI reads entitlements to show/hide toggles and guard registration.

---

## 13) Performance, a11y, and Budgets

- **Budgets:** JS < 170KB gz (initial), CSS < 45KB gz, image LCP < 200KB.
- **Targets:** LCP < 2.0s (fast 3G), TTI < 3.0s, CLS < 0.05, INP < 200ms.
- **a11y:** semantic landmarks, focus traps on dialogs, ARIA for toasts, reduced‑motion support.
- **Fonts:** system‑UI by default; optional variable font with `font-display: swap` (short TTL cache).

---

## 14) RUM + Observability

- Minimal RUM sender (`/lib/metrics/rum.ts`) posts CWV + key UX events (consented) to `/api/rum`.
- Add SW lifecycle logs behind `NODE_ENV==='development'` (install/activate/purge).

---

## 15) Testing & CI

- **Lighthouse CI**: PWA + Performance must stay ≥ 95 locally and in PR checks.
- **Playwright**: offline navigation → shows `offline.html`; share target → adds item; background sync → retries.
- **Web Platform Tests**: permissions fallback paths.
- **Bundlewatch/Size Limit**: enforce budgets on CI.
- **Type Tests**: strict TS + API contracts between agents.

---

## 16) Security & Privacy

- HTTP‑only session cookies; CSRF for state‑changing endpoints.
- Permissions policy headers to limit unused APIs.
- Push payloads minimal; store push keys securely; auto‑revoke on 410 Gone.
- Data minimization: only collect RUM if consented; opt‑out switch in settings.

---

## 17) Deliverables & Acceptance Criteria (Per Agent)

### 🧩 Agent 1 — PWA Foundation (Owner: `/service-worker.js`, manifest, offline, App‑Shell)

**Deliverables**
- Manifest + icons + maskables
- Offline page (`/public/offline.html` < 10KB)
- Hand‑written SW with strict precache + purge
- Build script injecting hashed assets into `PRECACHE_URLS`
- Lighthouse PWA 100 & Perf ≥ 95 on CI
- Docs: cache policy, release checklist

**Acceptance Tests**
- Fresh install → SW activates, caches only hashed assets
- Deploy bump → old caches purged
- Offline nav → `offline.html`
- No API requests intercepted by SW (verify via devtools)

---

### 🧩 Agent 2 — UX & Web APIs (Owner: A2HS, Notifications, Share Target, Badging, Media Session)

**Deliverables**
- A2HS custom prompt + UX copy
- Notification permission flow + quiet hours UI
- Share Target route `/share`
- Badging + graceful fallback
- Media Session hooks for TTS
- Docs: permissions UX patterns

**Acceptance Tests**
- User can install via custom prompt
- Sharing text/url → opens “Add to list” modal
- Badging reflects due count, hides when zero
- Notifications can be enabled/disabled; respects quiet hours

---

### 🧩 Agent 3 — Data & Sync (Owner: IndexedDB, Outbox, Background/Periodic Sync, Firebase)

**Deliverables**
- Typed IndexedDB wrapper + stores
- Outbox queue + Background Sync handler (pending writes only)
- Firebase sync (login/logout triggers, explicit “Sync now”)
- Periodic Sync (premium only) for daily reminder checks
- Conflict policy docs (LWW/merge/append)

**Acceptance Tests**
- Network loss → writes queued; reconnect → syncs
- Login with existing cloud data → merges correctly
- Periodic sync does not run without explicit user opt‑in
- Deleting account clears local stores

---

## 18) Interfaces / Contracts (between agents)

**A. Entitlements API (read‑only for Agents 1 & 2)**
```ts
type FeatureId = 'push'|'bgSync'|'periodicSync'|'shareTarget'|'fsAccess'|'badging'|'mediaSession';
export function can(feature: FeatureId): boolean;
```

**B. IDB Wrapper (Agent 3 provides; 1 & 2 consume)**
```ts
export interface ListsApi {
  addList(input: {title: string, type: 'words'|'sentences'|'verbs'|'adjectives'}): Promise<string>;
  addItems(listId: string, items: Array<{payload: any, tags?: string[]}>): Promise<void>;
  getDueItems(limit?: number): Promise<Array<any>>;
  getDueCount(): Promise<number>;
}
```

**C. Sync Outbox (Agent 3)**
```ts
export function queueOp(op: {type: string, payload: any}): Promise<void>;
```

**D. Events for Badging (Agent 3 emits; Agent 2 consumes)**
```ts
// EventTarget-based or simple pub/sub
document.dispatchEvent(new CustomEvent('dueCountChanged', { detail: { count } }));
```

---

## 19) Release Checklist ✅

- [ ] Bump `CACHE_VERSION`
- [ ] Inject fresh hashed assets into `PRECACHE_URLS`
- [ ] Lighthouse CI ≥ 95 Perf & 100 PWA
- [ ] Bundle size within budgets
- [ ] All permissions behind toggles + entitlements
- [ ] Old caches purged on canary test
- [ ] RUM opt‑in verified

---

## 20) Risks & Mitigations

- **Permission fatigue:** Use contextual, just‑in‑time prompts; preview value.
- **Background APIs unsupported:** Provide graceful fallbacks (manual sync button).
- **Cache drift:** Single SW source + CI “cache manifest” diff check.
- **Conflict merges:** Start with LWW + append‑only history; add CRDTs later if needed.

---

## 21) Timeline (3 weeks)

- **Week 1:** Agent 1 (SW+manifest+offline), Agent 2 (A2HS), Agent 3 (IDB)
- **Week 2:** Agent 1 (purge/versioning), Agent 2 (share/badge/media), Agent 3 (outbox+bg sync)
- **Week 3:** Agent 2 (notifications UX), Agent 3 (Firebase + periodic sync), Agent 1 (RUM hooks)

---

## 22) Appendix — Env & Config Templates

`.env.example` (frontend)
```
NEXT_PUBLIC_RUM_ENDPOINT=/api/rum
NEXT_PUBLIC_FEATURE_PUSH=true
NEXT_PUBLIC_FEATURE_PERIODIC_SYNC=false
```

`firebase.example.json` (server)
```json
{
  "projectId": "your-project-id",
  "clientEmail": "firebase-admin@your-project-id.iam.gserviceaccount.com",
  "privateKey": "-----BEGIN PRIVATE KEY-----\n..."
}
```

---

## 23) Appendix — Developer Scripts

- `pnpm build` → emits hashed assets to `/public/static`
- `pnpm inject:precaches` → writes file list into `/service-worker.js`
- `pnpm test:e2e` → Playwright offline/share/sync tests
- `pnpm ci:budgets` → bundlewatch/size-limit report

---

## 24) Tiny Offline Page (example)

```html
<!doctype html>
<html lang="en">
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Offline — moshimoshi</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Arial,sans-serif;padding:2rem;max-width:40rem;margin:auto;line-height:1.5}
    .card{border:1px solid #e5e7eb;border-radius:12px;padding:1rem}
  </style>
  <body>
    <h1>🛰️ You’re offline</h1>
    <div class="card">
      <p>The app shell is available, but live data needs a connection.</p>
      <ul>
        <li>Try again once you’re online</li>
        <li>Your pending changes will sync automatically</li>
      </ul>
    </div>
  </body>
</html>
```

---

**That’s it.** This plan keeps the SW *minimal and auditable*, the app *fast and resilient*, and the team *decoupled* with crisp interfaces. 🐱‍👤
