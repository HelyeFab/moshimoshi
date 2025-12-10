# PWA Troubleshooting Guide

> Debugging techniques and solutions for common Moshimoshi PWA issues

**Last Updated**: 2025-01-26
**Applicable Version**: PWA 4.0+

---

## Quick Diagnostics

### Service Worker Status Check

```javascript
// Run in browser console
(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) {
    console.log('No SW registered');
    return;
  }

  console.log('SW Scope:', reg.scope);
  console.log('Active:', reg.active?.state);
  console.log('Waiting:', reg.waiting?.state || 'none');
  console.log('Installing:', reg.installing?.state || 'none');
})();
```

### Cache Status Check

```javascript
// List all caches
caches.keys().then(names => {
  console.log('Caches:', names);
  names.forEach(async (name) => {
    const cache = await caches.open(name);
    const keys = await cache.keys();
    console.log(`${name}: ${keys.length} entries`);
  });
});
```

### Storage Usage Check

```javascript
navigator.storage.estimate().then(({usage, quota}) => {
  console.log(`Storage: ${(usage/1024/1024).toFixed(2)}MB / ${(quota/1024/1024).toFixed(2)}MB`);
  console.log(`Usage: ${(usage/quota*100).toFixed(2)}%`);
});
```

### IndexedDB Check

```javascript
// Check if moshimoshi database exists
indexedDB.databases().then(dbs => {
  console.log('Databases:', dbs);
});
```

---

## Chrome DevTools Workflow

### Application Panel

1. **Open DevTools** (F12 or Cmd+Opt+I)
2. **Go to Application tab**
3. **Service Workers section**:
   - Check registration status
   - See active/waiting/installing workers
   - Use "Update" to force check
   - Use "Unregister" to remove

### Cache Storage

1. **Application > Cache Storage**
2. Click each cache to inspect contents
3. Right-click to delete individual entries
4. Use filter to find specific URLs

### IndexedDB

1. **Application > IndexedDB**
2. Expand `moshimoshi` database
3. Click object stores to view data
4. Right-click to clear store

### Network Panel

1. Filter by "SW" to see SW-handled requests
2. Check "Disable cache" for fresh requests
3. Use "Offline" to simulate offline mode

---

## Common Issues & Solutions

### Service Worker Issues

#### SW Not Registering

**Symptoms**:
- No SW in Application panel
- Console shows registration error
- Offline mode doesn't work

**Diagnosis**:
```javascript
navigator.serviceWorker.register('/service-worker.js')
  .then(reg => console.log('Success:', reg))
  .catch(err => console.error('Failed:', err));
```

**Solutions**:

| Cause | Solution |
|-------|----------|
| HTTPS required | Use localhost or deploy to HTTPS |
| SW file 404 | Verify `/public/service-worker.js` exists |
| Scope issue | Check SW file is at root level |
| Dev mode disabled | Set `NEXT_PUBLIC_ENABLE_SW_DEV=true` |
| Browser not supported | Check browser compatibility |

#### SW Not Updating

**Symptoms**:
- Old version still active after deploy
- Changes not reflected
- No update banner appearing

**Diagnosis**:
```javascript
const reg = await navigator.serviceWorker.getRegistration();
console.log('Active version:', reg?.active?.scriptURL);
console.log('Waiting:', !!reg?.waiting);
```

**Solutions**:

```javascript
// Force update check
const reg = await navigator.serviceWorker.ready;
await reg.update();

// Hard refresh
// Shift + Cmd/Ctrl + R

// Nuclear option: unregister and clear caches
const regs = await navigator.serviceWorker.getRegistrations();
for (const reg of regs) await reg.unregister();
const cacheNames = await caches.keys();
for (const name of cacheNames) await caches.delete(name);
location.reload();
```

#### SW Stuck in Waiting

**Symptoms**:
- Update banner shows but clicking refresh doesn't work
- `reg.waiting` is present but never activates

**Solution**:
```javascript
// Send skip waiting message
const reg = await navigator.serviceWorker.getRegistration();
if (reg?.waiting) {
  reg.waiting.postMessage({ type: 'SKIP_WAITING' });

  // Listen for controller change
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}
```

---

### Offline Issues

#### Offline Page Not Showing

**Symptoms**:
- Browser error page instead of `/offline.html`
- Network error in console

**Diagnosis**:
1. Check if `/offline.html` is in precache list
2. Verify file exists at `/public/offline.html`
3. Check cache contents:
```javascript
const cache = await caches.open('moshimoshi-v1429-dev-bypass-static');
const offlinePage = await cache.match('/offline.html');
console.log('Offline page cached:', !!offlinePage);
```

**Solutions**:
1. Add `/offline.html` to `PRECACHE_URLS` array
2. Force SW update and reinstall
3. Clear caches and reload

#### Pages Not Working Offline

**Symptoms**:
- Specific pages fail offline
- Network error for page that should be cached

**Diagnosis**:
```javascript
// Check if page is in offline-enabled list
const OFFLINE_ENABLED_PAGES = [
  '/dashboard', '/learn/hiragana', '/learn/katakana', // ...
];
console.log('Is page offline-enabled:', OFFLINE_ENABLED_PAGES.includes(location.pathname));

// Check if page is cached
const cache = await caches.open('moshimoshi-v1429-dev-bypass-pages');
const keys = await cache.keys();
console.log('Cached pages:', keys.map(r => new URL(r.url).pathname));
```

**Solutions**:

| Cause | Solution |
|-------|----------|
| Page not in offline list | Add to `OFFLINE_ENABLED_PAGES` |
| Never visited while online | Visit page once while online |
| RSC not cached | Enable RSC caching for route |
| Data not in IndexedDB | Check IndexedDB has required data |

---

### Notification Issues

#### Notifications Not Appearing

**Symptoms**:
- Permission granted but no notifications
- Console shows notification sent

**Diagnosis**:
```javascript
// Check permission
console.log('Permission:', Notification.permission);

// Check entitlements
import { canCurrentUser } from '@/lib/pwa/entitlements';
console.log('Entitlement:', canCurrentUser('push'));

// Check quiet hours
const quietStart = localStorage.getItem('quietHoursStart');
const quietEnd = localStorage.getItem('quietHoursEnd');
console.log('Quiet hours:', quietStart, '-', quietEnd);
```

**Solutions**:

| Cause | Solution |
|-------|----------|
| Permission denied | Request permission again (user must grant) |
| Quiet hours active | Wait or adjust quiet hours settings |
| Browser DND mode | Check system notification settings |
| Entitlement denied | Upgrade user tier or check tier logic |
| FCM token expired | Re-register FCM token |

#### FCM Not Working

**Symptoms**:
- No background notifications
- FCM SW errors in console

**Diagnosis**:
```javascript
// Check FCM SW status
const channel = new MessageChannel();
channel.port1.onmessage = (e) => console.log('FCM Status:', e.data);
navigator.serviceWorker.controller?.postMessage(
  { type: 'CHECK_FCM_STATUS' },
  [channel.port2]
);
```

**Solutions**:

| Cause | Solution |
|-------|----------|
| Firebase config mismatch | Verify config in `firebase-messaging-sw.js` |
| Token not registered | Re-call `messaging.getToken()` |
| App in foreground | FCM SW skips if app is visible |
| Certificate issue | Check Firebase console for errors |

---

### Installation Issues

#### Install Prompt Not Appearing

**Symptoms**:
- No `beforeinstallprompt` event
- Custom install UI never shows

**Diagnosis**:
```javascript
// Check if already installed
const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
console.log('Already installed:', isStandalone);

// Check visit count
const visits = parseInt(localStorage.getItem('pwa_visit_count') || '0');
console.log('Visit count:', visits, '(need 3+)');

// Check dismissal
const dismissed = localStorage.getItem('pwa_install_dismissed');
console.log('Dismissed at:', dismissed);
```

**Solutions**:

| Cause | Solution |
|-------|----------|
| Already installed | Check `(display-mode: standalone)` |
| Not enough visits | Visit 3+ times |
| Recently dismissed | Wait 7 days or clear storage |
| Manifest invalid | Check DevTools > Application > Manifest |
| HTTPS required | Deploy to HTTPS |
| Browser doesn't support | Use fallback instructions |

#### iOS Installation Issues

**Symptoms**:
- No Share > Add to Home Screen option
- App looks different when installed

**Solutions**:
1. Must be Safari (not Chrome/Firefox on iOS)
2. Must be HTTPS
3. Check manifest has `apple-touch-icon`
4. Check `apple-mobile-web-app-capable` meta tag

---

### Audio Cache Issues

#### Audio Not Playing Offline

**Symptoms**:
- Audio worked online but fails offline
- Console shows fetch error for audio

**Diagnosis**:
```javascript
// Check audio cache
const cache = await caches.open('moshimoshi-v1429-dev-bypass-audio');
const keys = await cache.keys();
console.log('Cached audio files:', keys.length);

// Check specific audio
const audioUrl = '/audio/kana/a.mp3';
const cached = await cache.match(audioUrl);
console.log('Audio cached:', !!cached);
```

**Solutions**:

| Cause | Solution |
|-------|----------|
| Never played while online | Play audio once while online |
| Range header issue | SW should strip Range headers |
| Cache full (250 limit) | LRU cleanup should handle this |
| Wrong URL pattern | Check `/audio/` prefix in fetch handler |

#### Get Audio Cache Stats

```javascript
// Send message to SW
const channel = new MessageChannel();
channel.port1.onmessage = (e) => {
  console.log('Audio cache:', e.data);
  console.log('Entries:', e.data.data.entryCount);
  console.log('Size:', e.data.data.totalSizeMB, 'MB');
};
navigator.serviceWorker.controller?.postMessage(
  { type: 'GET_AUDIO_CACHE_STATS' },
  [channel.port2]
);
```

---

### Sync Issues

#### Offline Changes Not Syncing

**Symptoms**:
- Changes made offline not appearing after reconnect
- Outbox stuck with pending operations

**Diagnosis**:
```javascript
// Check outbox (in IndexedDB)
// Open DevTools > Application > IndexedDB > moshimoshi > sync_outbox

// Check sync status
import { outboxManager } from '@/lib/idb';
console.log('Outbox status:', await outboxManager.getStatus());
```

**Solutions**:

| Cause | Solution |
|-------|----------|
| Background sync not supported | Manual sync on reconnect |
| Auth expired | Re-authenticate |
| Server error | Check API logs |
| Conflict | Check conflict resolution policy |

---

## Debugging Tools & Commands

### Console Commands Reference

```javascript
// Enable debug mode
localStorage.setItem('debug:sw', 'true');
localStorage.setItem('debug:queue', 'true');
localStorage.setItem('debug:sync', 'true');

// Force SW update
(await navigator.serviceWorker.ready).update();

// Skip waiting SW
(await navigator.serviceWorker.getRegistration())?.waiting?.postMessage({ type: 'SKIP_WAITING' });

// Clear all caches
(await caches.keys()).forEach(name => caches.delete(name));

// Clear specific cache
caches.delete('moshimoshi-v1429-dev-bypass-audio');

// Unregister all SWs
(await navigator.serviceWorker.getRegistrations()).forEach(r => r.unregister());

// Full reset
localStorage.clear();
sessionStorage.clear();
indexedDB.deleteDatabase('moshimoshi');
(await caches.keys()).forEach(name => caches.delete(name));
(await navigator.serviceWorker.getRegistrations()).forEach(r => r.unregister());
location.reload();
```

### localStorage Debug Flags

| Key | Effect |
|-----|--------|
| `debug:sw` | Verbose SW console logs |
| `debug:queue` | Queue operation logs |
| `debug:sync` | Sync process logs |

---

## Error Messages Reference

| Error | Cause | Solution |
|-------|-------|----------|
| `ServiceWorker is not supported` | Old browser or HTTP | Use modern browser on HTTPS |
| `Registration failed: security error` | Mixed content or scope | Ensure HTTPS, check scope |
| `Cache.put failed` | Storage quota exceeded | Clear old caches |
| `Failed to fetch` (offline) | Resource not cached | Add to precache or visit first |
| `Notification permission denied` | User blocked | Guide user to browser settings |
| `IndexedDB unavailable` | Private browsing | Inform user, disable offline features |

---

## Browser-Specific Issues

### Chrome/Edge

- **Issue**: SW update takes multiple page loads
- **Solution**: Use skip waiting with user confirmation

### Safari/iOS

- **Issue**: No `beforeinstallprompt` event
- **Solution**: Show manual "Add to Home Screen" instructions

- **Issue**: No Background Sync API
- **Solution**: Sync on app focus/visibility change

- **Issue**: Aggressive cache eviction
- **Solution**: Re-cache on app launch

### Firefox

- **Issue**: No Badging API
- **Solution**: Use `BadgeFallback` component

- **Issue**: Different SW update behavior
- **Solution**: Force update check more frequently

### Samsung Internet

- **Issue**: Different install prompt UI
- **Solution**: Test and customize messaging

---

## Escalation Path

1. **Check this guide** - Most issues are covered here
2. **Review console logs** - Look for [SW] prefixed messages
3. **Inspect DevTools** - Application panel for PWA state
4. **Check GitHub issues** - Search existing issues
5. **File new issue** with:
   - Browser and version
   - Steps to reproduce
   - Console output
   - Screenshot of Application panel

---

## Related Documents

- [Service Worker Deep Dive](./01-service-worker-deep-dive.md) - SW internals
- [API Reference](./02-api-reference.md) - API documentation
- [Best Practices 2025](./03-best-practices-2025.md) - Prevention tips
- [Production Guide](./PWA_PRODUCTION_GUIDE.md) - Deployment checklist

---

## Changelog

| Date | Change |
|------|--------|
| 2025-01-26 | Initial troubleshooting guide |
