# 🎛️ Moshimoshi Gamification — Run of Show (Step‑by‑Step Orchestration)
**Owner:** You (acting Program Lead) — with ChatGPT orchestrating  
**Window:** Thu 02 Oct 2025 → Sun 05 Oct 2025 (Europe/London)  
**Goal:** Ship production‑ready gamification in 4 days with one canonical write path, reliable sync, observability, and safe rollout.

> Use with: 00-Production-Plan.md, Command-Center-Checklist.md, QA-Matrix.md

---

## 0) Pre‑flight (Right Now — ~60–90 min)
1. **Create branches**
   ```bash
   git checkout -b feat/gamification-unified
   git checkout -b feat/sync-utc
   git checkout -b feat/leaderboard-deltas
   git checkout -b ops/observability-release
   ```
2. **Add feature flags to env**
   - `GAMIFICATION_UNIFIED_ONLY=false`
   - `SYNC_ENABLED=false`
   - `DEPRECATE_LEGACY_STORES=false`
   - `LEADERBOARD_DELTAS=false`
   - Commit a typed flag helper (TS) and wire all guarded code paths behind it.
3. **Stand‑up comms**
   - Create a Slack/Discord channel `#moshi‑prod‑week`. Pin links to the plan, command center, QA matrix.
   - Post kickoff (template below).
4. **Freeze policy**
   - Only P0/P1 merges allowed; PRs must use **PR‑TEMPLATE.md** and be approved by Supervisor.
5. **CI additions**
   - Add a write‑ban CI step:
     ```bash
     git grep -nE "localStorage|streakStore|achievement-store|dispatch\(.*ADD_XP|setState\(.*streak" src/ && echo "POTENTIAL CLIENT WRITE — FAIL" && exit 1 || true
     ```
   - Ensure unit/integration/E2E jobs are required checks.

**Kickoff message (paste in #moshi‑prod‑week):**
```
🎬 Production Week kickoff
Scope: unify gamification writes → /api/stats/unified; enable UTC-safe sync; leaderboards delta; flags, CI, E2E; dark-launch + rollback.
Agents: A (Core), B (Sync/Timezone/Migration), C (Observability/Release). Supervisor: QA gate.
Links: Plan, Command Center, QA Matrix, PR template.
PR rules: template required + Supervisor approval. Only P0/P1.
Check in: stand-ups 09:30 & 17:30 London. 
```

---

## Day 1 — Thu 02 Oct 2025 — Consolidate & Cut Drift
**09:30 Stand‑up (15 min)**  
- Supervisor opens **QA‑Matrix.md**, assigns owners, confirms deliverables for the day.
- Agents commit to EoD targets (below).

**Agent A — Targets**
- Inventory & **Routing Plan** (who calls what, what dies).  
  ```bash
  git grep -n "useReviewStats\|useUserStats\|/api/xp/track\|streakStore\|achievement-store"
  ```
- Create single client hook `useStats` (or standardize `useUserStats`) that **never writes**; send all writes to `/api/stats/unified` (zod‑validated, `idempotencyKey`, server timestamps).
- Remove `/api/xp/track` or proxy to unified; update tests.

**Agent B — Targets**
- Implement `utcDayBucket(serverUtcNow, userTzOffsetSnapshot)` util and tests (DST ±, near‑midnight, leap).  
- Draft **Migration v1 spec** (legacy local → IndexedDB → server).

**Agent C — Targets**
- Wire feature flags + typed helper.  
- Add CI **write‑ban** job; ensure unit/integration/E2E jobs required.  
- Set up dashboards (XP events/min, streak increments/day, error/latency).

**17:30 Status Gate (15 min)**  
- Run **Command‑Center** checks for Day 1.  
- Supervisor marks QA‑Matrix rows.  
- **Go/Block** decision for Day 2 based on Day‑1 acceptance.

---

## Day 2 — Fri 03 Oct 2025 — Enable Sync & Migrate
**09:30 Stand‑up (10 min)**  
- Confirm Agent A’s unified hook live in staging (behind flags).  
- Agent B presents UTC tests passing; Migration v1 plan accepted.

**Agent A — Targets**
- Finish consumers migration; delete legacy store writes; remove dead code/diagrams.  
- Ensure achievement decisions are **server‑only**.

**Agent B — Targets**
- Re‑enable sync (remove early return), implement **idempotent upserts** with `activityId`/`idempotencyKey` dedupe.  
- Build **Offline Queue** (IndexedDB): batch, retry with backoff, dedupe.  
- Implement **Nightly Recompute** (Cloud Function/cron).  
- Run **Migration v1 dry‑run** on staging dataset; attach report.

**Agent C — Targets**
- E2E (Playwright/Cypress): XP→streak edge cases incl. DST; offline→online replay; duplicate prevention.  
- Rate‑limit + authz checks on `/api/stats/unified`; add audit logs.

**17:30 Status Gate**  
- Review E2E & migration dry‑run. **No P0/P1** to proceed.

---

## Day 3 — Sat 04 Oct 2025 — Leaderboards & Hardening
**09:30 Stand‑up**  
- Confirm deltas design and queue points.

**Agent A — Targets**
- Enqueue leaderboard delta **after** XP commit in unified handler.  
- Remove any remaining legacy endpoints/docs.

**Agent B — Targets**
- Implement **delta materialization**; verify no full scans (index/cursor).  
- Data repair script for pre‑launch anomalies (one‑time run).

**Agent C — Targets**
- Load test: p50/p95, error rates; tune if needed.  
- Security pass: JWT/session tier, rate‑limit, PII audit.  

**17:30 Status Gate**  
- SLOs green → proceed to Day 4.  
- If not green, identify P1 fixes for morning.

---

## Day 4 — Sun 05 Oct 2025 — Dry‑Run, Dark‑Launch, Release
**09:30 Stand‑up**  
- Confirm: flags wired, rollback tested in staging, runbooks ready.

**Agent A — Targets**
- Final pass on invariants & types; assert single write path in code search.

**Agent B — Targets**
- Execute migration on staging; run nightly recompute (manual trigger); spot‑check users.

**Agent C — Targets**
- **Dark‑launch**: set `GAMIFICATION_UNIFIED_ONLY=true` staged rollout 10% → 50% → 100% (staging, then prod).  
- Monitor dashboards; adjust alert thresholds.

**Supervisor — Final Gate**
- Validate **Acceptance Criteria** from the plan.  
- Tag release, lock merges, and publish decision log.

---

## Go/No‑Go Criteria (condensed)
- ✅ Only `/api/stats/unified` writes; client write‑ban CI clean.  
- ✅ Streak increments only on days with **≥ 10 XP**, UTC‑safe.  
- ✅ Sync ON with offline replay idempotent; Migration v1 report green.  
- ✅ Leaderboards use deltas; load/perf SLOs met; security checks pass.  
- ✅ Dashboards & alerts green through dark‑launch.  
- ✅ Rollback works by flipping flag; recompute restores consistency.

---

## Decision Log (template)
| Date | Decision | Context | Owner | Reversible? | Follow‑ups |
|---|---|---|---|---|---|
| Thu 02 Oct 2025 | Unify on `useUserStats` | Simplify adoption | A | Yes | Update docs |
| Fri 03 Oct 2025 | Enable SYNC in staging | UTC tests pass | B | Yes | Monitor |
| Sat 04 Oct 2025 | Delta leaderboards | Perf risk | B | Yes | Add alerts |
| Sun 05 Oct 2025 | Dark‑launch 10→50→100 | SLOs green | C | Yes | Post‑mortem |

---

## Stand‑up Script (Supervisor)
1. Open **QA‑Matrix.md**.  
2. Ask each Agent: blockers? ETA? evidence links?  
3. Update status → ✅/❌/⬜.  
4. Announce day’s gate decision.  
5. Post decision log entry in `#moshi‑prod‑week`.

---

## Handy Commands
```bash
# Find any client writes / legacy stores (fail if found)
git grep -nE "localStorage|streakStore|achievement-store|dispatch\(.*ADD_XP|setState\(.*streak" src/

# Run time boundary tests
npm run test:time

# Run all E2E (adjust to your runner)
npm run e2e

# Dark‑launch flags (staging)
export GAMIFICATION_UNIFIED_ONLY=true SYNC_ENABLED=true LEADERBOARD_DELTAS=true

# Rollback
export GAMIFICATION_UNIFIED_ONLY=false
```
---

## Escalation
- P0 incidents: immediately flip `GAMIFICATION_UNIFIED_ONLY=false`, run recompute, post incident note in channel, open hotfix PR.
- P1: assign owner, ETA < 4h; keep dark‑launch at current percentage until green.
- Non‑blocking: log in QA Matrix, schedule next sprint.

Keep the Command Center open during every gate.
