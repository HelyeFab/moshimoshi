# moshimoshi — 4‑Day Production Readiness Orchestration Plan
**Main architect:** You (with ChatGPT as orchestrator)  
**Window:** Thu 02 Oct 2025 → Sun 05 Oct 2025 (4 days)  
**Goal:** Ship **production‑ready** gamification (streaks, XP, achievements, leaderboards, bonus points) with **one canonical write path**, **reliable sync**, **observability**, and **release safety nets**.

---

## 🔭 Scope (what “production‑ready” means)
- **Canonical pipeline**: All XP/streak/achievement writes go through **/api/stats/unified** → server services → data stores. No client‑side writes.
- **Streak rule**: An **active day** is any day with **≥ 10 XP** earned via valid activities.
- **No legacy drift**: `useReviewStats` and local legacy stores do **not** write truth. Migrate or remove.
- **Sync on**: Premium sync enabled, with timezone‑safe, idempotent, and replayable operations.
- **Observability**: Logging, metrics, alerts, dashboards, and release toggles (feature flags).
- **Safety**: Rollback plan, dark‑launch/percentage rollout, E2E happy‑path and edge‑case tests, and data repair scripts.
- **Docs**: Single, current source of docs; QA matrix; runbooks.

---

## 👥 Team Setup (3 agents + 1 supervisor)
- **Agent A – Gamification Core (Code Surgeon/Refactor Lead)**  
  Unify hooks/endpoints/stores. Remove legacy paths. Fix correctness issues. Own **/api/stats/unified** + `UserStatsService` + client adapters.
- **Agent B – Data & Sync (Storage/Timezone/Offline/Migration)**  
  Re‑enable sync with UTC‑safe boundaries, offline queue, repair & migration scripts, nightly recompute, leaderboard deltas.
- **Agent C – Observability & Release (CI/CD/Flags/Security/Perf)**  
  Feature flags, CI gates, telemetry, SLOs, load tests, rate limits, security checks, release automation, rollback.
- **Supervisor – System QA & Merge Gate**  
  Runs the checklists, owns the **QA Matrix**, blocks merges if acceptance criteria aren’t met.

---

## 🗺️ Work Breakdown Structure (WBS)
### Epic 1 — Canonical Pipeline & API (Agent A)
1. **Unify write path**
   - Confirm `/api/stats/unified` covers: activity→XP, ≥10XP→streak day, achievement unlocks, leaderboard enqueue.
   - Delete/redirect `/api/xp/track` and any direct store mutations.
2. **Hook migration**
   - Replace consumers of `useReviewStats` with `useUserStats` (or single consolidated hook).
   - Remove legacy local/zustand stores that write to localStorage.
3. **Bug fixes & invariants**
   - Fix undefined references in achievement/streak stores.
   - Define invariants: non‑negative XP, single increment per activity idempotency key, server time = source of truth.

### Epic 2 — Sync, Timezones, Offline, Data Quality (Agent B)
1. **Timezone safety**
   - Normalize to **UTC** on server; client sends local time + tz offset for audit only.
   - Day boundary calc: `day = floor((server_ts_utc + user_tz_offset_snapshot) / 86400)` snapshots per event.
2. **Re‑enable premium sync**
   - Remove early‑return; add replayable, idempotent upserts.
   - Offline queue with dedupe (`activityId`, `idempotencyKey`).
3. **Repair & migration**
   - Script to migrate legacy localStorage/Zustand → IndexedDB → server for premium users.
   - Nightly server recompute for streak correctness (source of truth guardrail).
4. **Leaderboards**
   - Incremental delta updates; avoid full scans; server function to materialize daily/weekly all‑time boards.

### Epic 3 — Observability, Release, Security (Agent C)
1. **Feature flags**
   - `GAMIFICATION_UNIFIED_ONLY`, `SYNC_ENABLED`, `DEPRECATE_LEGACY_STORES`, `LEADERBOARD_DELTAS`.
2. **CI/CD**
   - Lint/format/type checks; unit/integration/E2E suites; branch protections; PR template & labels.
3. **Telemetry**
   - Structured logs (JSON), counters (XP events, streak increments), error rates, latency SLIs; dashboards + alerts.
4. **Security & Perf**
   - Server‑only writes; JWT session validation; entitlement checks; rate limiting; load tests to target QPS.

---

## 📅 Day‑by‑Day Plan

### Day 1 — Thu 02 Oct 2025 — **Consolidate & Cut Drift**
- **Agent A**
  - Inventory endpoints & hooks; create **Routing Plan**: who calls what, and which legacy paths get removed.  
  - Implement **single hook** for stats (`useUserStats` or `useStats`) and deprecate `useReviewStats`.  
  - Add guardrails to `/api/stats/unified`: validate input schema, attach `idempotencyKey`, server timestamps.
- **Agent B**
  - Implement UTC boundary util + tests (DST, leap, edge at 23:59:59.999).  
  - Replace client day‑boundary logic with server‑side.  
  - Draft migration spec for legacy stores → canonical.
- **Agent C**
  - Add feature flags to config; wire into code paths.  
  - Create CI gates: fail build if any direct client writes detected (AST rule or grep set).  
  - Stand up dashboards (logs + metrics) and basic alerts.
- **Supervisor**
  - Start **QA Matrix** and verify Epics → tasks mapped; open tracking issues and assign owners.  
  - Block merges missing flags or tests.

**Deliverables:** Endpoint/Hook Inventory, Routing Plan, UTC util + tests, flags live in dev, initial dashboards, QA Matrix v1.

---

### Day 2 — Fri 03 Oct 2025 — **Enable Sync & Migrate**
- **Agent A**
  - Remove `/api/xp/track` or make it a thin proxy to unified; update tests & clients.  
  - Finish hook consolidation; delete legacy store writes.
- **Agent B**
  - Re‑enable sync with idempotent upserts; implement offline queue with dedupe.  
  - Write **Migration Script v1**; dry‑run on dev datasets; create **Nightly Recompute** job.
- **Agent C**
  - Add E2E tests: XP→streak increments with timezone edges; offline→online replay; duplicate prevention.  
  - Add rate limiting and authz assertions on `/api/stats/unified`.
- **Supervisor**
  - Review E2E recordings; check logs show canonical flow; accept Migration v1 only if dry‑run clean.

**Deliverables:** Unified‑only write path running behind flags; Sync ON in staging; Migration v1; E2E suite green in CI.

---

### Day 3 — Sat 04 Oct 2025 — **Leaderboards & Hardening**
- **Agent A**
  - Wire leaderboard enqueue at the canonical point (after XP commit).  
  - Remove remaining dead code & diagrams that mislead.
- **Agent B**
  - Implement **delta materialization** for leaderboards; verify no full scans.  
  - Data repair script for users with streak anomalies (prelaunch one‑time run).  
- **Agent C**
  - Load test: target peak QPS with 2× burst; watch latency/error SLOs.  
  - Security pass: JWT/session/tier checks; audit logs for PII; ensure no client write endpoints exist.
- **Supervisor**
  - Gate on SLOs; require zero P0/P1 issues before launch approval.

**Deliverables:** Leaderboard deltas, repair scripts, load test report, security audit notes, QA Matrix v2.

---

### Day 4 — Sun 05 Oct 2025 — **Dry‑Run, Dark‑Launch, Release**
- **Agent A**
  - Final pass on invariants & type safety; ensure all writes path through unified API.  
- **Agent B**
  - Run migration on staging; execute nightly recompute; verify deltas in leaderboards.  
- **Agent C**
  - Dark‑launch `GAMIFICATION_UNIFIED_ONLY=on` to 10% → 50% → 100% (staging then prod).  
  - Release playbook: rollback steps; alerts tuned; on‑call handoff doc.
- **Supervisor**
  - Sign‑off checklist; lock merges; tag release; post‑mortem template opened for learnings.

**Deliverables:** Production release, rollback plan, runbook, QA Matrix v3 (final).

---

## ✅ Acceptance Criteria (must be true to ship)
1. No code path performs client‑side writes to truth stores.  
2. `/api/stats/unified` is the **only** write surface; requests carry **idempotencyKey**; server time used for day calc.  
3. Streak increments only when **≥ 10 XP** earned in the UTC‑safe daily window.  
4. Premium sync enabled; offline replay is idempotent; duplicates prevented.  
5. Leaderboards update via **deltas**; no full scans in hot paths.  
6. E2E tests cover: day boundary edges (including DST), offline→online replay, duplicates, multi‑tab, slow clock skew.  
7. Dashboards/alerts show XP events rate, streak increments, error rates, and latency within SLOs.  
8. Feature flags allow instant rollback to legacy read paths without corrupting data.  
9. Security checks pass: server‑only writes, JWT/session verified, entitlement gating enforced.  
10. Supervisor QA Matrix shows all P0/P1 items resolved and signed off.

---

## 🔧 Branching, PRs, and DevEx
- **Branches:** `feat/gamification-unified`, `feat/sync-utc`, `feat/leaderboard-deltas`, `ops/observability-release`  
- **PR Template:** include “Scope, Risk, Tests, Flags touched, Migration steps, Rollback”.  
- **Labels:** `P0`, `P1`, `breaking`, `needs-migration`, `flagged`, `security`, `observability`.  
- **Checks:** Codegen/types, unit+integration+E2E, lint/format, AST rule forbidding client writes, bundle size budgets.

---

## 🧪 Test Matrix (selected)
- **Day boundary:** 23:59:59.999 local → 00:00:00.000 UTC crossing; DST forward/back; different tz users.  
- **Offline replay:** multiple activities same minute; replay with/without idempotencyKey; ensure single increment.  
- **Concurrency:** two clients same account; race on XP; verify atomicity.  
- **Negatives:** 0/negative XP; malformed payload; unauthorized tier; replay within 24h window.  
- **Leaderboards:** spike writes; verify deltas only; pagination and tie‑breakers deterministic.

---

## 🚨 Rollback & Runbooks
- **Flags:** flip `GAMIFICATION_UNIFIED_ONLY=off` to fall back to read‑only legacy while keeping server pipeline alive.  
- **Data repair:** re‑run nightly recompute; recompute streaks for users impacted during window.  
- **Release:** keep canary at 10% until SLOs stable 30 minutes; auto‑rollback on alert thresholds.

---

## 📚 Documentation To Produce
- `docs/gamification/architecture.md` (updated diagrams)  
- `docs/gamification/runbooks/release.md` (playbook + rollback)  
- `docs/gamification/qa-matrix.md` (living doc owned by Supervisor)  
- `docs/gamification/migrations/2025-10-<date>-unified.yaml` (exact mappings)

