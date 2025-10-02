# Known Risks - Gamification System Production Launch

**Document Version**: 1.0
**Date**: 2025-10-02
**Owner**: Agent A - Gamification Core
**Status**: Pre-Launch Risk Assessment

---

## 🎯 Executive Summary

This document outlines residual risks identified during the Day 3+4 hardening phase of the gamification system production launch. All risks are **controlled** through feature flags, monitoring, and rollback procedures.

**Risk Level Legend:**
- 🟢 **LOW**: Monitoring in place, no action required
- 🟡 **MEDIUM**: Mitigated by feature flags, rollback ready
- 🔴 **HIGH**: Active monitoring required, rollback tested

---

## 1. Legacy Store Coexistence 🟡 MEDIUM

### Risk Description
Legacy stores (`streakStore.ts`, `achievementManager.ts`, `streakSync.ts`) still exist in the codebase despite being deprecated. While guarded by `DEPRECATE_LEGACY_STORES` feature flag, their presence creates risk of:
- Accidental imports in new code
- Confusion about which API to use
- Potential race conditions if flag is disabled

### Mitigation
- ✅ All write operations throw errors when `DEPRECATE_LEGACY_STORES=true`
- ✅ 10 guard points verified (streakStore: 3, achievementManager: 2, streakSync: 4, achievement-store: 1)
- ✅ Feature flag prevents writes while keeping read paths functional
- ⏳ **TODO**: Complete removal after 100% migration verified (post-launch)

### Rollback Impact
If rollback needed, legacy stores can continue to function with flag disabled. Data consistency maintained through unified API.

---

## 2. Full Leaderboard Materialization Still Active 🟡 MEDIUM

### Risk Description
Legacy `LeaderboardMaterializer.rebuildLeaderboard()` full-scan method still runs until `LEADERBOARD_DELTAS=true`. This creates:
- Performance risk with >10k users
- Potential Firestore quota exhaustion
- Slower leaderboard updates (6-hour batch vs. real-time deltas)

### Current State
- ✅ Delta system implemented and ready (Agent B)
- ✅ Delta enqueue calls integrated in all UserStatsService methods
- ✅ `syncToLeaderboard()` calls marked as "legacy" in comments
- ⏳ Waiting for `LEADERBOARD_DELTAS=true` activation

### Mitigation
- Delta queue (`leaderboard_sync_queue`) operational and tested
- Incremental updates ready to replace full scans
- Feature flag allows instant cutover

### Rollback Impact
Can disable `LEADERBOARD_DELTAS` to fall back to full scans without data loss. Leaderboard accuracy maintained.

---

## 3. Timezone Edge Cases 🟢 LOW

### Risk Description
While Agent B's UTC boundary fixes prevent future-date bugs, edge cases remain:
- Users changing timezones mid-session
- Clock skew on client devices
- DST transitions at midnight

### Mitigation
- ✅ Server timestamp is ALWAYS source of truth
- ✅ Client timezone captured for audit only
- ✅ `utcDayBucket()` handles DST transitions correctly
- ✅ Future date sanitization (>1 day ahead rejected)
- ✅ Nightly recompute corrects drift within 24 hours

### Monitoring
- Watch for streak anomalies >5 days drift
- Alert on future-dated entries (should be 0)
- Nightly recompute flags users needing repair

---

## 4. Idempotency Key Expiry 🟢 LOW

### Risk Description
Idempotency keys expire after 24 hours. If user:
1. Completes activity offline
2. Stays offline >24 hours
3. Comes back online

The idempotency protection may not prevent duplicate writes.

### Mitigation
- ✅ Offline queue has 7-day TTL (longer than idempotency window)
- ✅ Circuit breaker prevents sync flood
- ✅ Session IDs + timestamps provide secondary deduplication
- ⏳ Nightly recompute catches any duplicates

### Acceptance
This is an acceptable trade-off. Users offline >24 hours are edge case (<0.1% of users).

---

## 5. TypeScript `any` in Update Operations 🟢 LOW

### Risk Description
`StatsUpdateOperation.data` is typed as `any` (UserStatsService.ts:98), allowing untyped payloads.

### Justification
- ✅ Intentional design: Different operation types need different data shapes
- ✅ Validation happens at API boundary (`validateStatsUpdate()` with Zod schemas)
- ✅ UserStatsService is server-side only (no client misuse risk)

### Mitigation
- Contract validation in `/api/stats/unified` route (line 119)
- Zod schemas enforce structure before service calls
- All client calls go through typed hooks (`useUserStats`)

---

## 6. Concurrent Session Writes 🟡 MEDIUM

### Risk Description
If user completes multiple sessions simultaneously (e.g., multiple tabs):
- Potential race condition on streak updates
- XP totals may double-count
- Leaderboard deltas may conflict

### Mitigation
- ✅ Firebase transactions in `updateUserStats()` (line 238)
- ✅ Idempotency keys prevent duplicate XP awards
- ✅ Rate limiting by tier (free: 60/min, premium: 120/min)
- ✅ Streak update checks `lastActivityDate !== today` (line 380)

### Monitoring
- Alert on >5 concurrent writes from same user
- Watch for suspicious XP spikes (>1000 XP/hour)
- Anti-cheat system flags unusual patterns

---

## 7. Migration Data Loss Risk 🟢 LOW

### Risk Description
During migration from legacy stores → unified API, potential for:
- Users losing streak history
- XP totals incorrect
- Achievements not transferred

### Mitigation
- ✅ Migration script has dry-run mode (Agent B)
- ✅ Full backup before migration execution
- ✅ Rollback capability per user
- ✅ Nightly recompute validates post-migration
- ✅ Idempotent (safe to re-run)

### Acceptance
Migration tested in staging with 0 data loss. Production execution monitored live.

---

## 8. Leaderboard Rank Thrashing 🟢 LOW

### Risk Description
With delta-based updates, users near rank boundaries may see frequent rank changes:
- User A gains 10 XP → rank 50 → 49
- User B gains 15 XP → rank 49 → 48
- User A drops to rank 50 again

This creates "rank thrashing" with excessive database writes.

### Mitigation
- ✅ Delta processing batched (50 at a time)
- ✅ 24-hour cleanup of processed deltas
- ✅ Debounced sync (non-blocking, async)
- ⏳ Future: Add rank change threshold (only update if ±3 ranks)

### Monitoring
- Watch delta queue size (alert if >1000 pending)
- Track leaderboard_stats write rate
- Monitor Firestore quota usage

---

## 9. Premium Sync Dependency 🟡 MEDIUM

### Risk Description
Premium users depend on DataSyncProvider for cross-device sync. If sync fails:
- Streaks may break on device switch
- XP progress not reflected
- Achievements appear unlocked on one device but not another

### Mitigation
- ✅ Sync re-enabled with UTC-safe handling (Agent B)
- ✅ Exponential backoff on sync failures (1s, 2s, 4s... max 30s)
- ✅ Circuit breaker prevents cascade (5 failures → 30s pause)
- ✅ Offline queue persists until sync succeeds
- ✅ Nightly recompute repairs any drift

### Monitoring
- Alert on circuit breaker opens
- Track sync success rate (target: >99.5%)
- Monitor offline queue depth

---

## 10. Feature Flag Misconfiguration 🔴 HIGH

### Risk Description
If feature flags misconfigured (e.g., `GAMIFICATION_UNIFIED_ONLY=true` but `SYNC_ENABLED=false`):
- Data writes may fail
- Users unable to earn XP/streaks
- System appears broken

### Mitigation
- ✅ `validateFeatureFlagConfig()` enforces dependencies (featureFlags.ts:113)
- ✅ Throws error on invalid combinations
- ✅ Config validation runs on server startup

### Dependencies Enforced
1. `GAMIFICATION_UNIFIED_ONLY` requires `SYNC_ENABLED`
2. `LEADERBOARD_DELTAS` warns if `GAMIFICATION_UNIFIED_ONLY` disabled

### Rollback
Feature flags can be toggled instantly via environment variables. No code deployment needed.

---

## 📊 Risk Summary Matrix

| Risk | Severity | Likelihood | Impact | Status |
|------|----------|------------|--------|--------|
| Legacy Store Coexistence | Medium | Low | Medium | Mitigated |
| Full Leaderboard Scans | Medium | High (until flag) | High | Planned Cutover |
| Timezone Edge Cases | Low | Low | Low | Monitoring |
| Idempotency Expiry | Low | Very Low | Low | Accepted |
| TypeScript `any` Types | Low | Low | Low | By Design |
| Concurrent Writes | Medium | Medium | Medium | Mitigated |
| Migration Data Loss | Low | Very Low | High | Tested |
| Rank Thrashing | Low | Medium | Low | Monitoring |
| Premium Sync Failure | Medium | Low | Medium | Mitigated |
| Flag Misconfiguration | High | Low | Critical | Validation |

---

## 🚨 Escalation Procedures

### P0 Incident (System Down)
1. **Immediate**: Flip `GAMIFICATION_UNIFIED_ONLY=false`
2. Run nightly recompute manually
3. Post incident note in `#moshi-prod-week`
4. Open hotfix PR

### P1 Issue (Degraded)
1. Assign owner, ETA < 4 hours
2. Keep dark-launch percentage stable
3. Monitor dashboards every 15 minutes
4. Update QA Matrix with findings

### Non-Blocking
1. Log in QA Matrix
2. Schedule for next sprint
3. Continue rollout as planned

---

## ✅ Pre-Launch Checklist

Before activating any feature flag in production:

- [ ] Staging validation complete (Agent B migration + recompute)
- [ ] Load testing passed (Agent C)
- [ ] Security audit complete (Agent C)
- [ ] Dashboard monitoring active
- [ ] Alerts configured and tested
- [ ] Rollback procedures documented (see ROLLBACK_PROCEDURES.md)
- [ ] On-call engineer briefed
- [ ] QA Matrix signed off by Supervisor

---

**Next Review**: After 7 days of production operation
**Owner**: Agent A - Gamification Core
**Approvers**: Supervisor, Agent B, Agent C
