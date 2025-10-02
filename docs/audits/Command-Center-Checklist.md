# 🚀 Moshimoshi Gamification Command Center — Daily Stand‑up Checklist

**Goal:** Fast visual on readiness status. Copy/paste friendly.  
**Use:** Each day (Day 1–4), Supervisor runs this checklist with Agents A–C.  
**Format:** ✅ (pass), ❌ (fail), ⬜ (pending).

---

## 🔄 Core Pipeline (Agent A)
- [ ] `/api/stats/unified` is the **only write path** (check logs, grep for legacy writes).  
  ```bash
  git grep -E "localStorage|streakStore|achievement-store" src/
  ```
- [ ] `useReviewStats` references removed or read-only.  
- [ ] `/api/xp/track` removed or proxied.  
- [ ] IdempotencyKey attached to all XP events.  

## 🌍 Sync & Timezones (Agent B)
- [ ] UTC boundary util passes DST + edge tests.  
  ```bash
  npm run test:time
  ```
- [ ] Premium sync **enabled** (no early return).  
- [ ] Offline queue writes replay once only (check dedupe).  
- [ ] Migration dry-run report clean (0 data loss).  
- [ ] Nightly recompute job deployed (staging).  

## 📊 Leaderboards (Agent B)
- [ ] Delta materialization used (no full scans).  
- [ ] Daily/weekly/all-time boards populate with correct ties.  

## 🛡️ Observability & Release (Agent C)
- [ ] Feature flags active: GAMIFICATION_UNIFIED_ONLY, SYNC_ENABLED, etc.  
  ```bash
  cat .env | grep GAMIFICATION
  ```
- [ ] CI gates green: lint, type, unit, integration, E2E.  
  ```bash
  npm run ci
  ```
- [ ] E2E XP→streak edge cases pass (DST, offline replay).  
- [ ] Dashboards live: XP events/min, streak increments/day, error rates.  
- [ ] Load test SLOs met (p95 latency, <1% error).  
- [ ] Security checks pass: JWT/session enforced, entitlement checks, rate limits.  

## ✅ Release/Runbooks (Supervisor)
- [ ] QA Matrix up-to-date; P0/P1 = 0.  
- [ ] Rollback tested (flag flip to legacy read path works).  
- [ ] Release playbook documented.  
- [ ] Post-mortem template opened.  

---

## 🗓️ Stand‑up Flow
1. Supervisor reviews QA Matrix.  
2. Each Agent reports ✅/❌/⬜ for their checklist items.  
3. Blockers escalated immediately.  
4. End of stand‑up: Supervisor signs daily status in QA Matrix.

---

## 📌 Reminders
- Ship dark-launch → 10% → 50% → 100%.  
- Rollback = flip feature flag, rerun nightly recompute.  
- Keep logs + dashboards open during migration/dry-run windows.
