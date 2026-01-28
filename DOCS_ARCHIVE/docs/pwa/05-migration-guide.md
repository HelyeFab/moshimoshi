# PWA Migration Guide

> Future migration paths and evolution strategies for the Moshimoshi PWA

**Last Updated**: 2025-01-26
**Current Architecture**: Hand-written Service Worker (v4.0.0)

---

## Current Implementation Summary

### Architecture Overview

| Component | Implementation | Lines |
|-----------|----------------|-------|
| Main Service Worker | Hand-written vanilla JS | 487 |
| FCM Service Worker | Firebase compat SDK | 346 |
| PWA Utilities | TypeScript modules | ~1,200 |
| Build Process | Manual precache injection | N/A |

### Strengths of Current Approach

- **Full control**: Every line of caching logic is visible
- **Minimal bundle**: No external SW dependencies
- **Auditability**: Easy to understand and debug
- **Custom strategies**: Tailored to Moshimoshi needs

### Limitations

- **Manual maintenance**: No auto-precache injection
- **No built-in strategies**: Must implement patterns manually
- **Testing complexity**: Custom test infrastructure needed
- **Update burden**: Must track best practices manually

---

## Potential Migration Paths

### Option 1: Workbox Migration

**Workbox** is Google's official library for PWA service workers.

#### When to Consider

- Team scaling (multiple developers working on PWA)
- Need for complex caching strategies
- Desire for battle-tested solutions
- Maintenance burden becoming significant

#### Workbox Equivalents for Current Code

| Current Feature | Workbox Equivalent |
|-----------------|-------------------|
| Precaching static assets | `workbox-precaching` |
| Cache-first for static | `workbox-strategies.CacheFirst` |
| Network-first for pages | `workbox-strategies.NetworkFirst` |
| Audio LRU cache | `workbox-expiration.ExpirationPlugin` |
| Navigation handler | `workbox-routing.NavigationRoute` |
| Skip waiting | `workbox-core.skipWaiting()` |

#### Migration Steps

1. **Install dependencies**
```bash
npm install workbox-webpack-plugin workbox-window
```

2. **Create workbox config**
```javascript
// workbox-config.js
module.exports = {
  globDirectory: '.next/static/',
  globPatterns: ['**/*.{js,css,woff2}'],
  swDest: 'public/service-worker.js',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/moshimoshi\.app\/audio\//,
      handler: 'CacheFirst',
      options: {
        cacheName: 'audio-cache',
        expiration: {
          maxEntries: 250,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
      },
    },
  ],
};
```

3. **Update Next.js config**
```javascript
// next.config.js
const { InjectManifest } = require('workbox-webpack-plugin');

module.exports = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.plugins.push(
        new InjectManifest({
          swSrc: './src/service-worker.js',
          swDest: '../public/service-worker.js',
        })
      );
    }
    return config;
  },
};
```

4. **Rewrite service worker using Workbox**
```javascript
// src/service-worker.js
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// Precache
precacheAndRoute(self.__WB_MANIFEST);

// Audio caching
registerRoute(
  ({url}) => url.pathname.startsWith('/audio/'),
  new CacheFirst({
    cacheName: 'audio-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 250,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  })
);

// Navigation
registerRoute(
  ({request}) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'pages-cache',
    networkTimeoutSeconds: 5,
  })
);
```

5. **Test parity with current behavior**
6. **Gradual rollout with feature flag**

#### Considerations

| Aspect | Impact |
|--------|--------|
| Bundle size | +40KB compressed |
| Learning curve | Team needs Workbox knowledge |
| Debugging | Different error messages |
| Flexibility | Some patterns harder to customize |

---

### Option 2: Serwist (Next.js Native)

**Serwist** is a modern fork of next-pwa with TypeScript support.

#### When to Consider

- Want tighter Next.js integration
- TypeScript-first approach
- Need App Router support

#### Migration Steps

1. **Install Serwist**
```bash
npm install @serwist/next
```

2. **Configure Next.js**
```javascript
// next.config.js
const withSerwist = require('@serwist/next').default({
  swSrc: 'src/sw.ts',
  swDest: 'public/sw.js',
});

module.exports = withSerwist({
  // Your Next.js config
});
```

3. **Create TypeScript service worker**
```typescript
// src/sw.ts
import { defaultCache } from '@serwist/next/worker';
import { Serwist } from 'serwist';

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
```

#### Benefits

- TypeScript support
- Automatic manifest injection
- Next.js App Router compatible
- Active maintenance

---

### Option 3: Stay Hand-Written (Enhanced)

If choosing to stay with hand-written SW, here are recommended enhancements:

#### 1. Add Build-Time Precache Injection

```javascript
// scripts/inject-precache.js
const fs = require('fs');
const glob = require('glob');
const crypto = require('crypto');

const staticFiles = glob.sync('.next/static/**/*.{js,css}');
const precacheUrls = staticFiles.map(file => {
  const hash = crypto.createHash('md5')
    .update(fs.readFileSync(file))
    .digest('hex')
    .slice(0, 8);
  return `'/_next/static/${file.replace('.next/static/', '')}?v=${hash}'`;
});

const swContent = fs.readFileSync('public/service-worker.js', 'utf8');
const updatedSw = swContent.replace(
  /const PRECACHE_URLS = \[[\s\S]*?\];/,
  `const PRECACHE_URLS = [\n  ${precacheUrls.join(',\n  ')}\n];`
);

fs.writeFileSync('public/service-worker.js', updatedSw);
console.log(`Injected ${precacheUrls.length} URLs into service-worker.js`);
```

#### 2. Add Comprehensive Testing

```typescript
// tests/service-worker.test.ts
import { describe, it, expect, beforeAll } from 'vitest';

describe('Service Worker', () => {
  it('registers successfully', async () => {
    const reg = await navigator.serviceWorker.register('/service-worker.js');
    expect(reg.active).toBeDefined();
  });

  it('caches static assets', async () => {
    const cache = await caches.open('moshimoshi-v1-static');
    const keys = await cache.keys();
    expect(keys.length).toBeGreaterThan(0);
  });

  it('serves offline page when offline', async () => {
    // Simulate offline
    await page.setOfflineMode(true);
    await page.goto('/some-page');
    expect(await page.content()).toContain('offline');
  });
});
```

#### 3. Add Monitoring

```javascript
// Add to service-worker.js
self.addEventListener('error', (event) => {
  // Report to error tracking
  fetch('/api/sw-error', {
    method: 'POST',
    body: JSON.stringify({
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
    }),
  });
});
```

---

### Option 4: Background Sync API Evolution

#### Current State
- Custom outbox pattern in IndexedDB
- Manual retry logic on reconnection

#### Future State
- Native Background Sync API
- Periodic Background Sync for premium users

#### Migration Path

1. **Keep outbox as fallback**
```typescript
async function queueOperation(op: Operation) {
  // Add to IndexedDB outbox
  await outbox.add(op);

  // Try to register sync (if supported)
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    const reg = await navigator.serviceWorker.ready;
    try {
      await reg.sync.register('sync-outbox');
    } catch {
      // Sync not available, will use manual sync
    }
  }
}
```

2. **Add SW sync handler**
```javascript
// In service-worker.js
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-outbox') {
    event.waitUntil(processOutbox());
  }
});

async function processOutbox() {
  // Get pending operations from IndexedDB
  // POST each to server
  // Remove on success
}
```

3. **Implement periodic sync (premium)**
```typescript
// Only for premium users
if (canCurrentUser('periodicSync')) {
  const reg = await navigator.serviceWorker.ready;
  if ('periodicSync' in reg) {
    await reg.periodicSync.register('daily-review-check', {
      minInterval: 24 * 60 * 60 * 1000, // 24 hours
    });
  }
}
```

---

### Option 5: Storage API Evolution

#### IndexedDB to OPFS (Origin Private File System)

For large files (audio, data), OPFS offers better performance.

#### When to Consider
- Audio cache exceeds 100MB
- Need faster file access
- Better storage management

#### Migration Strategy

```typescript
// Check OPFS support
if ('storage' in navigator && 'getDirectory' in navigator.storage) {
  // Use OPFS for large files
  const root = await navigator.storage.getDirectory();
  const audioDir = await root.getDirectoryHandle('audio', { create: true });

  // Write file
  const fileHandle = await audioDir.getFileHandle('a.mp3', { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(audioBlob);
  await writable.close();
}
```

---

## Version Control Strategy

### Deprecation Process

1. **Announce deprecation** (2 weeks notice)
2. **Dual-support period** (1 month)
3. **Provide migration utilities**
4. **Sunset old code**

### Feature Flags

```typescript
// Environment variables for gradual rollout
const FEATURES = {
  useWorkbox: process.env.NEXT_PUBLIC_USE_WORKBOX === 'true',
  usePeriodicSync: process.env.NEXT_PUBLIC_PERIODIC_SYNC === 'true',
  useOPFS: process.env.NEXT_PUBLIC_USE_OPFS === 'true',
};
```

### Canary Deployment

```typescript
// Canary config
const isCanary = Math.random() < 0.05; // 5% of users
const swPath = isCanary ? '/service-worker-canary.js' : '/service-worker.js';
navigator.serviceWorker.register(swPath);
```

---

## Testing Migration

### Parity Testing Checklist

- [ ] Precache same files
- [ ] Same cache strategies per content type
- [ ] Same offline behavior
- [ ] Same update notification flow
- [ ] Same audio caching behavior
- [ ] Same development mode bypass
- [ ] Same error handling

### A/B Testing Setup

```typescript
// Feature flag for migration testing
const useMigratedSW = localStorage.getItem('use_migrated_sw') === 'true';
const swPath = useMigratedSW ? '/service-worker-v2.js' : '/service-worker.js';
```

### Rollback Procedures

```javascript
// Immediate rollback
async function rollbackSW() {
  // Unregister current
  const regs = await navigator.serviceWorker.getRegistrations();
  for (const reg of regs) await reg.unregister();

  // Clear problematic caches
  const cacheNames = await caches.keys();
  for (const name of cacheNames) {
    if (name.includes('v2')) await caches.delete(name);
  }

  // Register old SW
  await navigator.serviceWorker.register('/service-worker-v1.js');

  // Reload
  location.reload();
}
```

---

## Decision Framework

### Migration Checklist

Before migrating, ensure:

- [ ] Clear benefit identified (performance, maintenance, features)
- [ ] Migration path documented
- [ ] Rollback plan ready
- [ ] Testing strategy defined
- [ ] Team trained on new approach
- [ ] User communication plan
- [ ] Monitoring in place
- [ ] Performance baselines captured

### Decision Matrix

| Factor | Stay Hand-Written | Workbox | Serwist |
|--------|:-----------------:|:-------:|:-------:|
| Bundle size | Best | Good | Good |
| Flexibility | Best | Good | Medium |
| Maintenance | High | Low | Low |
| Team learning | None | Medium | Medium |
| Next.js integration | Manual | Manual | Native |
| TypeScript | No | Partial | Full |

### Recommendation

**For Moshimoshi's current stage**: Stay hand-written with enhanced tooling.

**Triggers for migration**:
1. Team grows beyond 3 developers working on PWA
2. Maintenance burden exceeds 4 hours/month
3. Complex caching requirements emerge
4. Critical bug that Workbox handles better

---

## Related Documents

- [Architecture Overview](./00-architecture-overview.md) - Current system design
- [Service Worker Deep Dive](./01-service-worker-deep-dive.md) - Current implementation
- [Best Practices 2025](./03-best-practices-2025.md) - Current patterns

---

## External Resources

- [Workbox Documentation](https://developer.chrome.com/docs/workbox)
- [Serwist Documentation](https://serwist.pages.dev/)
- [Background Sync API](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API)
- [OPFS Documentation](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system)

---

## Changelog

| Date | Change |
|------|--------|
| 2025-01-26 | Initial migration guide |
