# 🚀 PWA Production Guide - Moshimoshi

## Overview
This guide documents the production-ready PWA implementation for Moshimoshi, featuring a **strict cache discipline**, minimal service worker, and complete offline capability.

## ✅ Production Checklist

### Pre-Deployment
- [ ] Run `npm run build` to generate production build
- [ ] Run `npm run build:sw` to inject precached assets
- [ ] Verify service worker size is under 10KB
- [ ] Test offline functionality locally
- [ ] Run Lighthouse audit (target: PWA 100, Performance ≥95)
- [ ] Verify all icons and manifest are in place
- [ ] Test on multiple browsers (Chrome, Safari, Firefox, Edge)

### Post-Deployment
- [ ] Monitor cache storage usage
- [ ] Check service worker registration success rate
- [ ] Verify offline page loads correctly
- [ ] Test update flow with new deployments
- [ ] Monitor console for any SW errors

## 🏗️ Architecture

### Service Worker (Minimal & Strict)
```
public/service-worker.js (128 lines)
- Cache-first for static assets only
- Network-first for all navigation
- No API or dynamic content caching
- Automatic old version cleanup
```

### Push Notifications (Separate)
```
public/push-sw.js (Optional)
- Handles push events only
- Minimal notification display logic
- Background sync for outbox
```

### Main Thread Handlers
```
src/lib/pwa/notificationHandler.ts
- All notification logic
- Scheduling and quiet hours
- Permission management
- Sync processing
```

## 📦 Build Process

### Production Build Command
```bash
npm run build:prod
```

This command:
1. Builds Next.js production bundle
2. Injects hashed assets into service worker
3. Updates cache version automatically

### Manual Steps
```bash
# Build Next.js
npm run build

# Inject precache URLs
npm run build:sw

# Deploy to production
npm run deploy
```

## 🔄 Cache Strategy

### What Gets Cached
- ✅ Hashed JavaScript bundles (`/_next/static/*.js`)
- ✅ Hashed CSS files (`/_next/static/*.css`)
- ✅ Offline fallback page (`/offline.html`)
- ✅ Manifest and icons
- ✅ Essential static assets

### What Does NOT Get Cached
- ❌ API responses
- ❌ User data
- ❌ Dynamic content
- ❌ Audio files (removed per strict discipline)
- ❌ Article content (removed per strict discipline)

### Cache Versioning
- Version format: `moshimoshi-v[8-char-hash]`
- Auto-generated on each build
- Old versions automatically purged on activation

## 🌐 Offline Behavior

### Available Offline
- App shell (HTML structure)
- Static JavaScript and CSS
- Offline fallback page
- Previously loaded IndexedDB data

### Requires Network
- User authentication
- Data synchronization
- New content fetching
- Payment processing

## 📱 PWA Features

### Core Features (Always Available)
- ✅ Installable (A2HS)
- ✅ Offline fallback
- ✅ App manifest
- ✅ Service Worker

### Progressive Features (Tier-Based)
```javascript
// Entitlement System
Guest: Basic PWA features
Free: + Notifications, Background Sync, Share Target
Premium: + Periodic Sync, File System Access
```

## 🔔 Notification System

### Architecture
- Push events handled by `push-sw.js`
- Logic processed in main thread
- Quiet hours respected
- Permission flow follows UX best practices

### Setup
```javascript
// In your app
import { notificationHandler } from '@/lib/pwa/notificationHandler'

// Request permission
await notificationHandler.requestPermission()

// Schedule notification
await notificationHandler.scheduleNotification(
  'Review Reminder',
  'You have 5 reviews due',
  30 * 60 * 1000 // 30 minutes
)
```

## 🚨 Troubleshooting

### Service Worker Not Registering
```javascript
// Check console for errors
navigator.serviceWorker.ready.then(reg => {
  console.log('SW registered:', reg.scope)
})
```

### Cache Not Updating
```javascript
// Force update
navigator.serviceWorker.ready.then(reg => {
  reg.update()
})

// Clear all caches (nuclear option)
caches.keys().then(names => {
  names.forEach(name => caches.delete(name))
})
```

### Offline Page Not Loading
1. Check if `/offline.html` exists in public directory
2. Verify it's included in PRECACHE_URLS
3. Check Network tab for 503 responses

## 📊 Performance Targets

### Required Metrics
- **Lighthouse PWA Score:** 100
- **Lighthouse Performance:** ≥95
- **First Contentful Paint:** <1.5s
- **Time to Interactive:** <3.0s
- **Service Worker Install:** <100ms
- **Cache Size:** <50MB total

### Monitoring
```javascript
// Check cache storage usage
navigator.storage.estimate().then(estimate => {
  console.log(`Using ${estimate.usage} of ${estimate.quota} bytes`)
})

// Monitor SW lifecycle
navigator.serviceWorker.ready.then(reg => {
  reg.addEventListener('updatefound', () => {
    console.log('New SW version available')
  })
})
```

## 🔐 Security Considerations

### Headers Required
```
Service-Worker-Allowed: /
Content-Security-Policy: ...
X-Content-Type-Options: nosniff
```

### HTTPS Required
- Service Workers only work on HTTPS
- Exception: localhost for development

### Token Handling
- Never cache authentication tokens
- Don't store sensitive data in caches
- Use IndexedDB for user data (encrypted)

## 📈 Update Strategy

### Deployment Flow
1. Build new version: `npm run build:prod`
2. Deploy to staging
3. Test update flow
4. Deploy to production
5. Monitor update adoption

### User Experience
- New version detected → Show update prompt
- User accepts → Skip waiting and reload
- User declines → Update on next visit

## 🎯 Best Practices

### DO ✅
- Keep service worker under 200 lines
- Version all caches
- Test offline mode before deploying
- Monitor cache storage usage
- Use build process for precache injection
- Follow strict cache discipline

### DON'T ❌
- Cache API responses in service worker
- Store sensitive data in caches
- Use complex logic in service worker
- Ignore browser differences
- Skip Lighthouse audits
- Cache dynamic content

## 🛠️ Maintenance

### Weekly Tasks
- [ ] Check cache hit rates
- [ ] Monitor SW errors in production
- [ ] Review storage usage trends
- [ ] Test offline functionality

### Monthly Tasks
- [ ] Run full Lighthouse audit
- [ ] Review and optimize precached files
- [ ] Update dependencies
- [ ] Test on new browser versions

### Per Release
- [ ] Update this documentation
- [ ] Test migration from old SW version
- [ ] Verify all PWA features work
- [ ] Check performance metrics

## 📞 Support

### Common Issues & Solutions

**Issue:** Users stuck on old version
**Solution:** Implement aggressive update strategy with skip waiting

**Issue:** Cache storage full
**Solution:** Reduce precached files, implement cleanup

**Issue:** Notifications not working
**Solution:** Check entitlements, permission state, quiet hours

**Issue:** Poor offline experience
**Solution:** Enhance offline.html, add more static content

## 🎉 Success Metrics

### Target Goals
- 90%+ SW registration success rate
- <1% cache-related errors
- 100% offline page load success
- <500ms SW install time
- 95%+ Lighthouse scores maintained

### Monitoring Dashboard
Track these metrics in your analytics:
- SW registration events
- Cache hit/miss ratios
- Offline page views
- Update adoption rates
- Permission grant rates

---

**Last Updated:** 2025-01-26
**Version:** 4.0.0
**Author:** Agent 1 - PWA Foundation

## Appendix: Quick Commands

```bash
# Development
npm run dev              # Start dev server
npm run build           # Build Next.js

# Production
npm run build:prod      # Full production build
npm run build:sw        # Update SW precache only

# Testing
npm run test            # Run all tests
npx lighthouse <URL>    # Run Lighthouse audit

# Debugging
localStorage.setItem('debug:sw', 'true')  # Enable SW logging
```