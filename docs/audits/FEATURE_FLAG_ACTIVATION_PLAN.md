# Feature Flag Activation Plan - Gamification System

**Document Version**: 1.0
**Date**: 2025-10-02
**Owner**: Agent C - Observability & Release (with Agent A support)
**Status**: Pre-Production - Awaiting Final Gate Approval

---

## 🎯 Activation Sequence Overview

This document defines the **exact order** and **criteria** for activating gamification system feature flags during production dark-launch.

**Total Flags**: 4
**Estimated Total Duration**: 4-6 hours (with monitoring pauses)
**Rollout Strategy**: Gradual percentage-based with SLO gates

---

## 📊 Flag Dependency Map

```
SYNC_ENABLED (Foundation)
    ↓
GAMIFICATION_UNIFIED_ONLY (Core System)
    ↓
DEPRECATE_LEGACY_STORES (Cleanup - Optional)
    ↓
LEADERBOARD_DELTAS (Performance Optimization)
```

**Key Rule**: Each flag depends on the previous flag being **stable for ≥30 minutes** before activation.

---

## Phase 1: Enable Premium Sync ✅ COMPLETED

### Flag: `SYNC_ENABLED`

**Status**: ✅ Already enabled by Agent B (Day 2)
**Current Value**: `true`
**Prerequisites Met**:
- ✅ UTC boundary util tested (60+ test cases)
- ✅ DataSyncProvider fixed (timezone handling)
- ✅ Offline queue operational
- ✅ Circuit breaker tested

**Validation**:
- ✅ No future-date entries in staging
- ✅ Sync success rate >99.5%
- ✅ Offline replay working correctly

**No action needed** - proceed to Phase 2.

---

## Phase 2: Dark-Launch Unified API (CRITICAL PATH)

### Flag: `GAMIFICATION_UNIFIED_ONLY`

**Objective**: Make `/api/stats/unified` the ONLY write path for gamification stats

**Prerequisites** (verify before starting):
- [x] SYNC_ENABLED stable for 24+ hours
- [x] All delta enqueue calls verified (XP, Streak, Achievement)
- [x] Staging migration complete (Agent B)
- [x] Load testing passed (Agent C)
- [x] Security audit complete (Agent C)
- [ ] QA Matrix signed off by Supervisor ⏳ PENDING

### Rollout Schedule

#### Phase 2.1: Staging Validation (Day 4 Morning)
```bash
# In staging environment
export GAMIFICATION_UNIFIED_ONLY=true

# Duration: 2 hours
# Success Criteria:
# - Error rate < 1%
# - All activity types functional (drill, flashcards, kana, kanji)
# - Streaks increment correctly on 10+ XP
# - Achievements unlock via unified API
```

**Staging Acceptance**:
- [ ] 10 test users complete activities across all types
- [ ] 0 errors in unified API logs
- [ ] Streak updates confirmed in Firebase console
- [ ] Leaderboard deltas enqueued

#### Phase 2.2: Production Canary - 10% (Day 4 Afternoon)
```bash
# Production environment
# Method: Hash-based user sampling (if implemented)
# Fallback: Enable globally but monitor closely

export GAMIFICATION_UNIFIED_ONLY=true
# If percentage rollout available:
export GAMIFICATION_UNIFIED_ROLLOUT_PERCENT=10

# Duration: 1 hour minimum
# Success Criteria:
# - Error rate < 2% for canary cohort
# - No P0/P1 incidents
# - Dashboard metrics green
```

**Monitor**:
- Error rate per endpoint
- Response time p95
- User complaints channel
- Stripe webhook success rate (if activity triggers subscription events)

**Go/No-Go Decision Point**:
- ✅ **GO**: Error rate <2%, proceed to 50%
- ❌ **NO-GO**: Error rate >2%, rollback per Procedure B

#### Phase 2.3: Production Majority - 50% (Day 4 Late Afternoon)
```bash
export GAMIFICATION_UNIFIED_ROLLOUT_PERCENT=50

# Duration: 1 hour minimum
# Success Criteria:
# - Error rate < 1.5%
# - Response time stable
# - No increase in support tickets
```

**Monitor**:
- Same metrics as Phase 2.2
- Compare 10% cohort vs 50% cohort performance
- Check for any cohort-specific issues

**Go/No-Go Decision Point**:
- ✅ **GO**: All metrics stable, proceed to 100%
- ❌ **NO-GO**: Any degradation, hold at 50% and investigate

#### Phase 2.4: Production Full - 100% (Day 4 Evening)
```bash
export GAMIFICATION_UNIFIED_ONLY=true
# Remove percentage rollout if it was used
unset GAMIFICATION_UNIFIED_ROLLOUT_PERCENT

# Duration: Monitor for 2+ hours
# Success Criteria:
# - Error rate < 1%
# - No P0/P1 incidents for 2 hours
# - All activity types working
```

**Final Validation**:
- Run end-to-end test suite
- Manual smoke test of all activity types
- Check nightly recompute runs successfully
- Verify leaderboard updates

**Success Criteria for Phase 2 Completion**:
- [ ] 100% rollout active for 2+ hours
- [ ] Error rate <1%
- [ ] Response time p95 <500ms
- [ ] Zero P0/P1 incidents
- [ ] Dashboard all green
- [ ] Supervisor sign-off obtained

---

## Phase 3: Deprecate Legacy Stores (OPTIONAL - Post-Launch)

### Flag: `DEPRECATE_LEGACY_STORES`

**Objective**: Throw errors on legacy store write attempts to prevent accidental usage

**Prerequisites**:
- [ ] GAMIFICATION_UNIFIED_ONLY stable for 7+ days
- [ ] Migration confirmed 100% complete
- [ ] All components verified using useUserStats
- [ ] Legacy code removal PR prepared

### Activation

**Not urgent** - Can be done in phases post-launch:

1. **Week 1**: Enable in staging, monitor for any legacy store usage
2. **Week 2**: Enable in production with monitoring
3. **Week 3**: Remove legacy store files entirely (if no usage detected)

```bash
# Week 2 - Production activation
export DEPRECATE_LEGACY_STORES=true

# Monitor for:
# - Error logs showing "[StreakStore] DEPRECATED"
# - Error logs showing "[AchievementManager] DEPRECATED"
# - Any runtime errors in client applications
```

**If errors occur**:
- Identify calling code
- Migrate to useUserStats
- Test and redeploy
- Re-enable flag

---

## Phase 4: Enable Leaderboard Deltas (PERFORMANCE OPTIMIZATION)

### Flag: `LEADERBOARD_DELTAS`

**Objective**: Switch from full-scan leaderboard materialization to incremental delta updates

**Prerequisites**:
- [ ] GAMIFICATION_UNIFIED_ONLY stable for 3+ days
- [ ] Delta queue processing tested in staging
- [ ] Delta processor Cloud Function deployed
- [ ] Monitoring for delta queue depth active

### Activation Schedule

#### Phase 4.1: Staging Validation
```bash
# Staging
export LEADERBOARD_DELTAS=true

# Test:
# - Complete activities → verify deltas enqueued
# - Run delta processor → verify leaderboard updates
# - Check delta queue depth doesn't grow unbounded
```

**Acceptance**:
- [ ] Delta enqueue working for XP, Streak, Achievement
- [ ] Delta processor completes successfully
- [ ] Leaderboard rankings match full-scan results
- [ ] Queue depth stays <100 pending items

#### Phase 4.2: Production Activation
```bash
# Production
export LEADERBOARD_DELTAS=true

# Monitor for 24 hours:
# - Delta queue depth (alert if >500)
# - Leaderboard materialization time (should be <5s vs 30s+)
# - Firestore quota usage (should decrease)
```

**Success Criteria**:
- [ ] Leaderboard update latency <5s (down from 6-hour batch)
- [ ] Delta queue stays <200 pending items
- [ ] Firestore read quota usage decreases by >80%
- [ ] Leaderboard rankings accurate

---

## 🔧 Per-Phase Validation Checklist

### Before Activating ANY Flag

- [ ] Dashboard monitoring active
- [ ] Alerts configured for error rate, latency, queue depth
- [ ] Rollback procedure tested in staging
- [ ] On-call engineer notified
- [ ] Incident response channel open (`#moshi-prod-week`)
- [ ] Supervisor approval obtained

### During Activation

- [ ] Monitor dashboards every 5 minutes (first hour)
- [ ] Check error logs for new patterns
- [ ] Watch user complaint channels
- [ ] Track key metrics (error rate, p95 latency, success rate)

### After Activation

- [ ] Hold for minimum duration before next phase
- [ ] Verify SLOs met
- [ ] Document any issues encountered
- [ ] Update QA Matrix with results
- [ ] Get Supervisor sign-off to proceed

---

## 📊 Success Metrics Dashboard

Monitor these metrics at each phase:

| Metric | Target | Alert Threshold | Rollback Threshold |
|--------|--------|-----------------|-------------------|
| **Error Rate** | <1% | >2% | >5% |
| **Response Time (p95)** | <500ms | >1s | >2s |
| **Sync Success Rate** | >99% | <95% | <90% |
| **Delta Queue Depth** | <100 | >500 | >1000 |
| **User Complaints** | 0 | >2 in 10min | >5 in 10min |
| **Nightly Recompute** | <5min | >10min | Fails |

---

## 🚨 Rollback Decision Tree

```
Activate Flag
    ↓
Monitor for Minimum Duration
    ↓
Metrics OK? ────NO───→ Error Rate >5%? ──YES──→ PROCEDURE A: Full Rollback
    │                          │
    │                          NO
    │                          ↓
    │                    PROCEDURE B: Gradual Rollback
    │                          ↓
    │                    Hold at Lower %
    │                          ↓
    │                    Investigate & Fix
    │                          ↓
    │                    Retry Activation
    │
   YES
    ↓
Hold for Stability Window
    ↓
Supervisor Sign-Off
    ↓
Proceed to Next Phase
```

---

## 📝 Activation Execution Log

### Phase 2: GAMIFICATION_UNIFIED_ONLY

| Step | Timestamp | Status | Notes | Approver |
|------|-----------|--------|-------|----------|
| 2.1: Staging | TBD | ⏳ Pending | Awaiting QA Matrix sign-off | Supervisor |
| 2.2: 10% Canary | TBD | ⏳ Pending | - | - |
| 2.3: 50% Majority | TBD | ⏳ Pending | - | - |
| 2.4: 100% Full | TBD | ⏳ Pending | - | - |

### Phase 3: DEPRECATE_LEGACY_STORES

| Step | Timestamp | Status | Notes | Approver |
|------|-----------|--------|-------|----------|
| Staging | TBD | ⏳ Scheduled Week 1 | Post-launch | Agent A |
| Production | TBD | ⏳ Scheduled Week 2 | Post-launch | Supervisor |

### Phase 4: LEADERBOARD_DELTAS

| Step | Timestamp | Status | Notes | Approver |
|------|-----------|--------|-------|----------|
| Staging | TBD | ⏳ Scheduled Day 5+ | After unified API stable | Agent A + B |
| Production | TBD | ⏳ Scheduled Day 6+ | After delta testing | Supervisor |

---

## ✅ Final Pre-Launch Checklist

Before activating **any** production flag:

- [ ] All Day 3+4 tasks complete (Agent A)
- [ ] Staging migration successful (Agent B)
- [ ] Load testing passed (Agent C)
- [ ] Security audit complete (Agent C)
- [ ] Rollback procedures tested in staging
- [ ] Monitoring dashboards configured
- [ ] Alerts tested and verified
- [ ] On-call rotation scheduled
- [ ] Incident response plan reviewed
- [ ] QA Matrix all items signed off
- [ ] **Supervisor final approval obtained** ⭐

---

**Document Status**: ✅ Ready for Execution
**Next Action**: Await Supervisor QA Matrix sign-off to begin Phase 2.1 (Staging)
**Owner**: Agent C (with Agent A support)
**Estimated Start**: Day 4 Morning (after Agent B staging migration complete)
