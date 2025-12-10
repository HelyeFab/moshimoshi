# PWA Documentation Index

> Central navigation hub for all Moshimoshi PWA documentation

**Last Updated**: 2025-01-26
**PWA Version**: 4.0.0
**Status**: Production Ready

---

## Quick Navigation

| Document | Purpose | Status |
|----------|---------|--------|
| [Architecture Overview](./00-architecture-overview.md) | System design & data flow | Completed |
| [Service Worker Deep Dive](./01-service-worker-deep-dive.md) | SW technical reference | Completed |
| [API Reference](./02-api-reference.md) | All PWA APIs & utilities | Completed |
| [Best Practices 2025](./03-best-practices-2025.md) | Modern PWA patterns | Completed |
| [Troubleshooting Guide](./04-troubleshooting-guide.md) | Debug & common issues | Completed |
| [Migration Guide](./05-migration-guide.md) | Future migration paths | Completed |
| [Dev vs Prod SW Guide](./06-dev-vs-prod-service-worker.md) | Switch between dev/prod SW | Completed |

---

## Document Categories

### Foundation
Core architecture and design documents

- [Architecture Overview](./00-architecture-overview.md) - System design, component inventory, data flows
- [PWA MVP Blueprint](./moshimoshi-pwa-mvp.md) - Original MVP specification and principles
- [Shared Interfaces](./moshimoshi-shared-interfaces.md) - Agent contracts and type definitions

### Implementation
Technical implementation details

- [Service Worker Deep Dive](./01-service-worker-deep-dive.md) - Cache strategies, lifecycle, code annotations
- [API Reference](./02-api-reference.md) - Complete API documentation with examples
- [Cache Policy](./PWA_CACHE_POLICY.md) - Cache discipline and strategies

### Operations
Production deployment and maintenance

- [Production Guide](./PWA_PRODUCTION_GUIDE.md) - Deployment checklist and monitoring
- [Troubleshooting Guide](./04-troubleshooting-guide.md) - Debug techniques and issue resolution
- [Dev vs Prod SW Guide](./06-dev-vs-prod-service-worker.md) - Switch between development and production service workers

### Best Practices
Guidelines and recommendations

- [Best Practices 2025](./03-best-practices-2025.md) - Modern PWA patterns
- [Permissions UX Patterns](./PERMISSIONS_UX_PATTERNS.md) - Permission request UX guidelines
- [Migration Guide](./05-migration-guide.md) - Future evolution paths

### Agent Specifications
Multi-agent development briefs

- [Agent 1 - Foundation](./moshimoshi-agent1-foundation.md) - SW, manifest, offline, app-shell
- [Agent 2 - UX & APIs](./moshimoshi-agent2-ux-apis.md) - A2HS, notifications, share target, badging
- [Agent 3 - Data & Sync](./moshimoshi-agent3-data-sync.md) - IndexedDB, outbox, Firebase sync

---

## Document Relationships

```
                    +------------------+
                    |    INDEX.md      |
                    |   (this file)    |
                    +--------+---------+
                             |
         +-------------------+-------------------+
         |                   |                   |
         v                   v                   v
+--------+-------+  +--------+-------+  +--------+-------+
| 00-architecture|  | 01-sw-deep-dive|  | 02-api-reference|
| (System Design)|  | (SW Technical) |  | (All APIs)     |
+--------+-------+  +--------+-------+  +--------+-------+
         |                   |                   |
         |                   v                   |
         |          +--------+-------+           |
         +--------->| 03-best-prac   |<----------+
                    | (Guidelines)   |
                    +--------+-------+
                             |
         +-------------------+-------------------+
         |                                       |
         v                                       v
+--------+-------+                      +--------+-------+
| 04-troubleshoot|                      | 05-migration   |
| (Debug Guide)  |                      | (Future Paths) |
+----------------+                      +----------------+
```

---

## Quick Reference Commands

### Check Service Worker Status
```javascript
// In browser console
navigator.serviceWorker.getRegistration().then(reg => {
  console.log('SW State:', reg?.active?.state);
  console.log('Waiting:', !!reg?.waiting);
  console.log('Installing:', !!reg?.installing);
});
```

### Check Cache Storage
```javascript
caches.keys().then(names => console.log('Caches:', names));
```

### Force Update
```javascript
navigator.serviceWorker.ready.then(reg => reg.update());
```

### Check Storage Usage
```javascript
navigator.storage.estimate().then(({usage, quota}) => {
  console.log(`Using ${(usage/1024/1024).toFixed(2)}MB of ${(quota/1024/1024).toFixed(2)}MB`);
});
```

### Enable Debug Mode
```javascript
localStorage.setItem('debug:sw', 'true');
localStorage.setItem('debug:queue', 'true');
```

---

## Key Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Lighthouse PWA Score | 100 | 100 |
| Lighthouse Performance | 95+ | 96 |
| SW Install Time | <100ms | ~50ms |
| Offline Page Load | <500ms | ~200ms |
| Cache Lookup | <10ms | <5ms |

---

## Related Resources

### External Documentation
- [MDN: Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [web.dev: Learn PWA](https://web.dev/learn/pwa)
- [Next.js PWA Guide](https://nextjs.org/docs/app/guides/progressive-web-apps)

### Source Code Locations
- Service Workers: `/public/service-worker.js`, `/public/firebase-messaging-sw.js`
- PWA Utilities: `/src/lib/pwa/`
- IndexedDB Layer: `/src/lib/idb/`
- PWA Components: `/src/components/pwa/`

---

## Changelog

### 2025-01-26
- Initial documentation index created
- Added 7 new documentation files
- Comprehensive API reference added
- 2025 best practices documented

### 2025-01-10
- PWA v4.0.0 released
- Strict cache discipline implemented
- Audio caching added
