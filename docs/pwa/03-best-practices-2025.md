# PWA Best Practices 2025

> Modern Progressive Web App patterns and recommendations for Moshimoshi

**Last Updated**: 2025-01-26
**Applicable Version**: PWA 4.0+

---

## Overview

This guide documents PWA best practices as of 2025, specifically tailored for the Moshimoshi Japanese learning platform. These patterns are based on:
- [web.dev Learn PWA](https://web.dev/learn/pwa)
- [MDN Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Next.js PWA Guide](https://nextjs.org/docs/app/guides/progressive-web-apps)
- Production learnings from Moshimoshi deployment

---

## Core Principles

### 1. Minimal Service Worker

**Philosophy**: Keep the service worker small, auditable, and predictable.

**DO**:
```javascript
// Clear, simple caching logic
if (isStaticAsset) {
  return caches.match(request) || fetch(request);
}
```

**DON'T**:
```javascript
// Overly complex with runtime generated rules
const strategy = new CacheFirst({
  plugins: [
    new ExpirationPlugin({ maxAgeSeconds: 86400 * 30 }),
    new CacheableResponsePlugin({ statuses: [0, 200] }),
    // ... 10 more plugins
  ]
});
```

**Rationale**:
- Easier debugging when issues arise
- Smaller bundle size
- Clear understanding of cached content
- Predictable behavior

### 2. Progressive Enhancement

**Philosophy**: Core features work everywhere; advanced features enhance when available.

```typescript
// Check before using advanced APIs
if (canCurrentUser('badging') && 'setAppBadge' in navigator) {
  await navigator.setAppBadge(count);
} else {
  // Fallback to in-app indicator
  showBadgeFallback(count);
}
```

### 3. Offline-First Design

**Philosophy**: Assume network is unreliable; design for offline from the start.

```
Primary Storage:    IndexedDB (user data, review items)
Sync Mechanism:     Network API calls
Cache API:          Static assets only
```

---

## Caching Best Practices

### What to Cache

| Content Type | Strategy | Rationale |
|--------------|----------|-----------|
| Hashed JS/CSS | Precache | Immutable, safe to cache forever |
| App shell HTML | Precache | Fast initial load |
| Icons & images | Precache | Offline branding |
| Fonts | Cache-first | Rarely change |
| Learning data (kanji JSON) | Precache | Core functionality |
| TTS audio | Cache-first + LRU | Expensive to re-fetch |

### What NOT to Cache

| Content Type | Reason |
|--------------|--------|
| API responses | Dynamic, user-specific |
| Authentication tokens | Security risk |
| User-generated content | Better in IndexedDB |
| Real-time data | Staleness issues |
| Large media files | Storage limits |

### Cache Versioning

```javascript
// Good: Version tied to deployment
const CACHE_VERSION = 'moshimoshi-v1429';

// Bad: Manual version that's easy to forget
const CACHE_VERSION = 'v1'; // Never gets updated
```

**Pattern**: Include version in build process, auto-increment on deploy.

### Cache Size Limits

```javascript
// Implement LRU for unbounded caches
const AUDIO_CACHE_CONFIG = {
  maxEntries: 250,    // Hard limit
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};
```

---

## Permission Request Patterns

### Timing Guidelines

| Event | Appropriate for Permission Request |
|-------|-----------------------------------|
| First page load | Never |
| After 3+ visits | Maybe (with context) |
| After user action | Yes (best) |
| After tutorial completion | Yes |
| Random popup | Never |

### Pre-Permission UI

```typescript
// Good: Explain value first
const requestNotificationPermission = async () => {
  // 1. Show custom dialog explaining benefits
  const userAccepted = await showPrePermissionDialog({
    title: 'Stay on track with reminders',
    benefits: [
      'Get notified when reviews are due',
      'Maintain your learning streak',
      'Choose quiet hours'
    ],
    preview: <NotificationPreview />
  });

  // 2. Only then request native permission
  if (userAccepted) {
    const result = await Notification.requestPermission();
    return result === 'granted';
  }
  return false;
};
```

### Respecting Dismissals

```typescript
// Good: Track and honor dismissals
const DISMISSAL_COOLDOWN = 7 * 24 * 60 * 60 * 1000; // 7 days

if (wasRecentlyDismissed('pwa_install_dismissed', DISMISSAL_COOLDOWN)) {
  return; // Don't show prompt
}
```

---

## Performance Optimization

### Service Worker Performance

| Metric | Target | How to Achieve |
|--------|--------|----------------|
| Install time | <100ms | Minimal precache list |
| Activate time | <50ms | Fast cache cleanup |
| Cache lookup | <10ms | Simple cache structure |
| First paint | <1.5s | Precache critical CSS |

### Core Web Vitals

| Metric | Target | PWA Impact |
|--------|--------|------------|
| LCP (Largest Contentful Paint) | <2.5s | Precache hero images |
| INP (Interaction to Next Paint) | <200ms | Don't block main thread |
| CLS (Cumulative Layout Shift) | <0.1 | Reserve space for offline banners |

### Lazy Loading

```typescript
// Good: Only load PWA utilities when needed
const loadBadging = async () => {
  if ('setAppBadge' in navigator) {
    const { badgeManager } = await import('@/lib/pwa/badging');
    return badgeManager;
  }
  return null;
};
```

---

## Security Considerations

### Cache Security Rules

1. **Never cache sensitive data**
```javascript
// Bad
if (url.includes('/api/user/')) {
  cache.put(request, response.clone()); // User data in cache!
}
```

2. **Filter cross-origin requests**
```javascript
// Good: Only allow known safe origins
const allowedOrigins = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
];

if (url.origin !== self.location.origin) {
  if (!allowedOrigins.includes(url.origin)) {
    return; // Don't intercept
  }
}
```

3. **HTTPS enforcement**
```javascript
// SW only works on HTTPS (or localhost)
// No additional code needed - browser enforces this
```

### Token Handling

```typescript
// Good: Tokens in memory only
class AuthService {
  private token: string | null = null; // Memory only

  setToken(token: string) {
    this.token = token; // Never localStorage
  }
}

// Bad: Tokens in storage accessible to SW
localStorage.setItem('authToken', token); // SW can read this!
```

### Content Security Policy

```html
<!-- Add to HTML head -->
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self';">
```

---

## Testing Strategies

### Lighthouse Audits

```bash
# Run Lighthouse PWA audit
npx lighthouse https://moshimoshi.app --view --preset=pwa

# CI integration
npx lighthouse https://moshimoshi.app \
  --output json \
  --output-path ./lighthouse-results.json \
  --budget-path ./lighthouse-budget.json
```

**Target Scores**:
| Category | Target |
|----------|--------|
| PWA | 100 |
| Performance | 95+ |
| Accessibility | 95+ |
| Best Practices | 95+ |

### Offline Testing

```javascript
// Manual offline test in DevTools
// 1. Network tab -> Offline checkbox
// 2. Refresh page
// 3. Verify offline page or cached content

// Automated test
test('offline page loads when network fails', async () => {
  await page.setOfflineMode(true);
  await page.goto('/learn/hiragana');
  expect(await page.textContent('h1')).toBe('You are offline');
});
```

### Service Worker Testing

```javascript
// Test SW update flow
test('shows update banner on new version', async () => {
  // Simulate SW update
  const reg = await navigator.serviceWorker.ready;
  await reg.update();

  // Verify banner appears
  await expect(page.locator('.update-banner')).toBeVisible();
});
```

---

## Common Anti-Patterns to Avoid

### 1. Caching Everything

```javascript
// Bad: Cache all responses
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.open('all-cache').then((cache) => {
      return fetch(event.request).then((response) => {
        cache.put(event.request, response.clone()); // Everything cached!
        return response;
      });
    })
  );
});
```

**Problem**: Stale data, storage exhaustion, security risks.

### 2. Ignoring Cache Size

```javascript
// Bad: No limits
cache.put(request, response); // Forever growing cache
```

**Solution**: Implement LRU or TTL cleanup.

### 3. Skip Waiting Without Consent

```javascript
// Bad: Auto-activate
self.addEventListener('install', () => {
  self.skipWaiting(); // User's page might break mid-session!
});
```

**Solution**: Use message-based activation after user consent.

### 4. Requesting Permissions Too Early

```javascript
// Bad: Immediate permission request
useEffect(() => {
  Notification.requestPermission(); // First visit!
}, []);
```

**Solution**: Wait for engagement, explain value first.

### 5. Not Testing Offline Mode

```javascript
// Bad: Only test online
if (navigator.onLine) {
  // All tests pass... but app is broken offline
}
```

**Solution**: Include offline tests in CI.

### 6. Ignoring Browser Differences

```javascript
// Bad: Assume all browsers support everything
await navigator.setAppBadge(5); // Crashes in Firefox!
```

**Solution**: Feature detection for all APIs.

---

## Future-Proofing

### Emerging APIs to Watch

| API | Status | Potential Use |
|-----|--------|---------------|
| Periodic Background Sync | Limited | Daily reminders |
| Content Indexing | Emerging | Offline content discovery |
| File Handling | Stable | Import Anki decks |
| Window Controls Overlay | Stable | Custom title bar |

### Feature Flags Pattern

```typescript
// Gate new features behind flags
const FEATURES = {
  periodicSync: process.env.NEXT_PUBLIC_ENABLE_PERIODIC_SYNC === 'true',
  contentIndexing: process.env.NEXT_PUBLIC_ENABLE_CONTENT_INDEX === 'true',
};

if (FEATURES.periodicSync && 'periodicSync' in reg) {
  await reg.periodicSync.register('daily-check', { minInterval: 86400000 });
}
```

### Migration Readiness

Keep code modular for potential migration:
```typescript
// Abstract caching strategy
interface CacheStrategy {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

// Current: hand-written
class ManualCacheStrategy implements CacheStrategy { ... }

// Future: could swap to Workbox
class WorkboxCacheStrategy implements CacheStrategy { ... }
```

---

## Quick Reference Checklist

### Before Deploy

- [ ] SW version bumped
- [ ] Precache list updated
- [ ] Lighthouse PWA = 100
- [ ] Offline mode tested
- [ ] Update flow tested
- [ ] Permissions respect dismissals
- [ ] No sensitive data in caches

### Monthly Review

- [ ] Check cache hit rates
- [ ] Review storage usage
- [ ] Test on new browser versions
- [ ] Update dependencies
- [ ] Review error logs

---

## Related Documents

- [Architecture Overview](./00-architecture-overview.md) - System design
- [Service Worker Deep Dive](./01-service-worker-deep-dive.md) - Implementation details
- [Troubleshooting Guide](./04-troubleshooting-guide.md) - When things go wrong
- [Permissions UX Patterns](./PERMISSIONS_UX_PATTERNS.md) - Permission request UX

---

## External Resources

- [web.dev Learn PWA](https://web.dev/learn/pwa)
- [MDN PWA Best Practices](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Best_practices)
- [Workbox Documentation](https://developer.chrome.com/docs/workbox)
- [What makes a good PWA](https://web.dev/articles/pwa-checklist)

---

## Changelog

| Date | Change |
|------|--------|
| 2025-01-26 | Initial best practices documentation |
