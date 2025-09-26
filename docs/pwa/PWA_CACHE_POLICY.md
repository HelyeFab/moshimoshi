# PWA Cache Policy - Moshimoshi

## Overview
The Moshimoshi PWA implements a **strict cache discipline** to ensure predictable behavior, fast performance, and safe updates while preserving essential functionality for audio and article caching.

## Cache Strategy

### 1. Static Assets (Cache-First)
**Cache Name:** `moshimoshi-v[hash]-static`

**What's Cached:**
- Hashed JavaScript bundles (`/_next/static/*.js`)
- Hashed CSS files (`/_next/static/*.css`)
- Offline fallback page (`/offline.html`)
- Manifest and icons

**Strategy:** Cache-first with network fallback
- Serves from cache immediately for performance
- Updates cache on successful network fetch
- Version-controlled through build process

### 2. Audio Content (Cache-First)
**Cache Name:** `moshimoshi-audio-v1` (Persistent)

**What's Cached:**
- Audio files (`/audio/**`)
- TTS API responses (`/api/tts/**`)
- MP3/WAV files

**Strategy:** Cache-first for offline learning
- Essential for offline study sessions
- Persists across app updates
- No automatic expiration

### 3. Articles (Network-First)
**Cache Name:** `moshimoshi-articles-v1` (Persistent)

**What's Cached:**
- Article API responses (`/api/articles/**`)
- Content articles (`/api/content/article/**`)

**Strategy:** Network-first with cache fallback
- Always attempts fresh content first
- Falls back to cache when offline
- Enables offline reading

### 4. Navigation (Network-Only)
**What Happens:**
- HTML pages always fetched from network
- Falls back to `/offline.html` when offline
- No page caching (ensures fresh content)

## Cache Lifecycle

### Installation
1. Service worker installs
2. Precaches essential static assets
3. Skips waiting to activate immediately

### Activation
1. Claims all clients
2. Deletes old versioned caches (except persistent ones)
3. Restores scheduled notifications
4. Ready to serve

### Updates
1. New deployment creates new `CACHE_VERSION`
2. Old static caches are purged
3. Audio and article caches preserved
4. Smooth transition with zero downtime

## Version Management

### Build Process
```bash
npm run build:prod
```
This command:
1. Builds Next.js production bundle
2. Scans for hashed static assets
3. Injects asset URLs into service worker
4. Generates unique cache version

### Cache Version Format
```
moshimoshi-v[8-char-hash]
```
Example: `moshimoshi-vab12cd34`

## What's NOT Cached

The following are explicitly NOT cached to ensure data freshness:
- User data and authentication
- API responses (except audio/articles)
- Dynamic content
- Real-time features
- Review session data
- Progress tracking

## Offline Behavior

### Available Offline
✅ Previously cached audio files
✅ Downloaded articles
✅ Static app shell
✅ Offline fallback page
✅ Existing notification system

### Requires Network
❌ User authentication
❌ New content fetching
❌ Progress syncing
❌ Real-time features
❌ Payment processing

## Release Checklist

Before each deployment:

- [ ] Run `npm run build:prod` to generate production build
- [ ] Verify service worker has updated `CACHE_VERSION`
- [ ] Test offline functionality locally
- [ ] Check that audio/article caches persist
- [ ] Verify notification system still works
- [ ] Run Lighthouse audit (target: PWA 100, Performance ≥95)
- [ ] Deploy to staging first
- [ ] Monitor console for cache errors
- [ ] Verify smooth update process

## Performance Targets

- **Cache hit rate:** >90% for static assets
- **Service worker install:** <100ms
- **Cache lookup:** <10ms
- **Offline page load:** <500ms
- **Audio cache size limit:** 100MB
- **Article cache size limit:** 50MB

## Security Considerations

- Service worker served with proper headers
- HTTPS required for installation
- No sensitive data in caches
- Authentication tokens never cached
- Cross-origin requests filtered

## Monitoring

Watch for these in production:
- Cache storage quota warnings
- Failed cache operations
- Service worker registration errors
- Update notification delivery
- Cache hit/miss ratios

## Troubleshooting

### Force Update Service Worker
```javascript
navigator.serviceWorker.ready.then(reg => {
  reg.update();
});
```

### Clear All Caches
```javascript
caches.keys().then(names => {
  names.forEach(name => caches.delete(name));
});
```

### Check Cache Storage
```javascript
navigator.storage.estimate().then(estimate => {
  console.log(`Using ${estimate.usage} of ${estimate.quota} bytes`);
});
```

## Best Practices

1. **Never cache user data** - Always fetch fresh
2. **Version all caches** - Except persistent audio/articles
3. **Test offline mode** - Before each release
4. **Monitor cache size** - Implement cleanup if needed
5. **Update notifications** - Keep users informed
6. **Preserve critical caches** - Audio and articles for learning

---

Last Updated: 2025-09-26
Version: 1.0.0