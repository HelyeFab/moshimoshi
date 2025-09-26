# 🧩 Agent 1 — PWA Foundation

**Owner:** `/service-worker.js`, manifest, offline, App-Shell

## Deliverables
- Manifest + icons + maskables
- Offline page (`/public/offline.html` < 10KB)
- Hand-written SW with strict precache + purge
- Build script injecting hashed assets into `PRECACHE_URLS`
- Lighthouse PWA 100 & Perf ≥ 95 on CI
- Docs: cache policy, release checklist

## Acceptance Tests
- Fresh install → SW activates, caches only hashed assets
- Deploy bump → old caches purged
- Offline nav → `offline.html`
- No API requests intercepted by SW (verify via devtools)
