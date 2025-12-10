# Development vs Production Service Worker Guide

> How to switch between development (no caching) and production (full caching) service workers

**Last Updated**: 2025-01-26
**Applicable Version**: PWA 4.0+

---

## Overview

Moshimoshi uses **two different service workers** to optimize for different environments:

| Service Worker | File | Caching | Use Case |
|----------------|------|---------|----------|
| **Development** | `/public/service-worker.dev.js` | None (pass-through) | Local development |
| **Production** | `/public/service-worker.js` | Full caching | Production deployment |

---

## Quick Reference

### Default Behavior

| Environment | SW Enabled | Which SW | Caching |
|-------------|------------|----------|---------|
| `npm run dev` | No | None | No SW |
| `npm run dev` + `NEXT_PUBLIC_ENABLE_SW_DEV=true` | Yes | Development | Pass-through |
| `npm run dev` + `NEXT_PUBLIC_ENABLE_SW_DEV=true` + `NEXT_PUBLIC_FORCE_PROD_SW=true` | Yes | Production | Full |
| `npm run build && npm start` | Yes | Production | Full |
| Production deployment | Yes | Production | Full |

---

## Environment Variables

### `NEXT_PUBLIC_ENABLE_SW_DEV`

Controls whether **any** service worker is registered in development mode.

```bash
# .env.local

# Disable SW in development (default)
NEXT_PUBLIC_ENABLE_SW_DEV=false

# Enable SW in development (uses dev SW)
NEXT_PUBLIC_ENABLE_SW_DEV=true
```

### `NEXT_PUBLIC_FORCE_PROD_SW`

Forces the **production** service worker even in development mode. Requires `NEXT_PUBLIC_ENABLE_SW_DEV=true`.

```bash
# .env.local

# Use production SW in development (for testing caching)
NEXT_PUBLIC_FORCE_PROD_SW=true
```

---

## Common Scenarios

### Scenario 1: Normal Development (Recommended)

**Goal**: Fast iteration, no caching issues

```bash
# .env.local
NEXT_PUBLIC_ENABLE_SW_DEV=false
```

**Result**:
- No service worker registered
- No caching
- Changes reflect immediately
- Console shows: `[SW] Service Worker registration disabled in development`

---

### Scenario 2: Test Offline Features

**Goal**: Test offline behavior during development

```bash
# .env.local
NEXT_PUBLIC_ENABLE_SW_DEV=true
# NEXT_PUBLIC_FORCE_PROD_SW is NOT set (or false)
```

**Result**:
- Development SW registered
- No caching (pass-through mode)
- Can test SW lifecycle events
- Can test offline detection UI
- Console shows:
  ```
  [SW] Using DEVELOPMENT Service Worker
  [SW] Path: /service-worker.dev.js
  [SW] Mode: Pass-through (no caching)
  ```

---

### Scenario 3: Test Production Caching

**Goal**: Test full production caching behavior locally

```bash
# .env.local
NEXT_PUBLIC_ENABLE_SW_DEV=true
NEXT_PUBLIC_FORCE_PROD_SW=true
```

**Result**:
- Production SW registered
- Full caching enabled
- Assets cached in Cache Storage
- Console shows:
  ```
  [SW] Using PRODUCTION Service Worker
  [SW] Path: /service-worker.js
  [SW] Mode: Full caching enabled
  ```

**Important**: After testing, clear caches before returning to normal development:
```javascript
// Run in browser console
(await caches.keys()).forEach(name => caches.delete(name));
(await navigator.serviceWorker.getRegistrations()).forEach(r => r.unregister());
location.reload();
```

---

### Scenario 4: Production Build Testing

**Goal**: Test the production build locally

```bash
npm run build
npm start
```

**Result**:
- Production SW automatically used
- Full caching enabled
- Mimics production behavior

---

## Console Log Identification

The service worker mode is clearly logged in the browser console:

### Development Mode
```
[SW] Using DEVELOPMENT Service Worker     (yellow badge)
[SW] Path: /service-worker.dev.js
[SW] Mode: Pass-through (no caching)
[SW] To use production SW, set NEXT_PUBLIC_FORCE_PROD_SW=true
```

### Production Mode
```
[SW] Using PRODUCTION Service Worker      (green badge)
[SW] Path: /service-worker.js
[SW] Mode: Full caching enabled
```

### Disabled (Default Dev)
```
[SW] Service Worker registration disabled in development
[SW] To enable, set NEXT_PUBLIC_ENABLE_SW_DEV=true in .env.local
```

---

## Troubleshooting

### Problem: Old Production SW Stuck After Switching to Dev

**Symptom**: Still seeing cached content despite setting `NEXT_PUBLIC_ENABLE_SW_DEV=false`

**Solution**: The old SW persists until manually unregistered:

```javascript
// Run in browser console
(async () => {
  // Unregister all service workers
  const regs = await navigator.serviceWorker.getRegistrations();
  for (const reg of regs) {
    await reg.unregister();
    console.log('Unregistered:', reg.scope);
  }

  // Clear all caches
  const cacheNames = await caches.keys();
  for (const name of cacheNames) {
    await caches.delete(name);
    console.log('Deleted cache:', name);
  }

  console.log('Done! Reload the page.');
  location.reload();
})();
```

---

### Problem: Changes Not Reflecting

**Symptom**: Code changes not appearing after refresh

**Checklist**:
1. Check which SW is active:
   ```javascript
   navigator.serviceWorker.getRegistration().then(r => console.log(r?.active?.scriptURL));
   ```

2. If production SW is active, either:
   - Set `NEXT_PUBLIC_ENABLE_SW_DEV=false` and run cleanup script above
   - Or enable DevTools bypass: Application > Service Workers > "Bypass for network"

3. Hard refresh: `Shift + Cmd/Ctrl + R`

---

### Problem: Testing Production SW but Getting Dev SW

**Symptom**: Console shows "DEVELOPMENT Service Worker" despite setting `NEXT_PUBLIC_FORCE_PROD_SW=true`

**Solution**: Both flags must be set:

```bash
# .env.local - BOTH required
NEXT_PUBLIC_ENABLE_SW_DEV=true
NEXT_PUBLIC_FORCE_PROD_SW=true
```

Restart the dev server after changing `.env.local`.

---

## Chrome DevTools Tips

### Useful Options (Application > Service Workers)

| Option | Purpose |
|--------|---------|
| **Update on reload** | Forces SW update check on every page load |
| **Bypass for network** | Skips SW fetch handler entirely |
| **Offline** | Simulates offline mode |

### Inspect SW State

```javascript
// Quick status check
navigator.serviceWorker.getRegistration().then(reg => {
  console.log({
    scope: reg?.scope,
    active: reg?.active?.state,
    waiting: reg?.waiting?.state,
    installing: reg?.installing?.state
  });
});
```

### Get SW Info (Dev SW Only)

```javascript
// Request info from dev service worker
const channel = new MessageChannel();
channel.port1.onmessage = (e) => console.log('SW Info:', e.data);
navigator.serviceWorker.controller?.postMessage(
  { type: 'GET_SW_INFO' },
  [channel.port2]
);
```

---

## File Locations

| File | Purpose |
|------|---------|
| `/public/service-worker.js` | Production SW (full caching) |
| `/public/service-worker.dev.js` | Development SW (pass-through) |
| `/src/lib/pwa/registerServiceWorker.ts` | Registration logic |
| `/src/components/pwa/ServiceWorkerProvider.tsx` | React integration |

---

## Switching Checklist

### From Production Testing Back to Normal Development

1. Update `.env.local`:
   ```bash
   NEXT_PUBLIC_ENABLE_SW_DEV=false
   # Remove or comment out NEXT_PUBLIC_FORCE_PROD_SW
   ```

2. Run cleanup in browser console:
   ```javascript
   (await caches.keys()).forEach(name => caches.delete(name));
   (await navigator.serviceWorker.getRegistrations()).forEach(r => r.unregister());
   ```

3. Restart dev server: `npm run dev`

4. Hard refresh the browser

5. Verify console shows: `[SW] Service Worker registration disabled in development`

### Before Production Deployment

1. Ensure `.env.local` settings don't affect production:
   - `NEXT_PUBLIC_ENABLE_SW_DEV` is ignored in production
   - `NEXT_PUBLIC_FORCE_PROD_SW` is ignored in production

2. Production always uses `/public/service-worker.js`

3. Update `CACHE_VERSION` in service-worker.js if needed

4. Update version in `/public/version.json` and `ServiceWorkerProvider.tsx`

---

## Related Documents

- [Service Worker Deep Dive](./01-service-worker-deep-dive.md) - Technical SW reference
- [Troubleshooting Guide](./04-troubleshooting-guide.md) - Common issues
- [Best Practices 2025](./03-best-practices-2025.md) - PWA patterns

---

## Changelog

| Date | Change |
|------|--------|
| 2025-01-26 | Initial guide created |
