# Rollout Playbook - MyLists Reliability Features

**Feature**: Staged Rollout Strategy for Multi-Tab, Sync, and Quota Features
**Priority**: CRITICAL - Risk Mitigation
**Status**: PLANNED

---

## Table of Contents

1. [Rollout Strategy](#rollout-strategy)
2. [Feature Flags](#feature-flags)
3. [Rollout Phases](#rollout-phases)
4. [Monitoring & Metrics](#monitoring--metrics)
5. [Rollback Procedures](#rollback-procedures)
6. [Communication Plan](#communication-plan)
7. [Success Criteria](#success-criteria)
8. [Post-Rollout Validation](#post-rollout-validation)

---

## Rollout Strategy

### Philosophy

**Staged Rollout**: Release features gradually to minimize risk and gather feedback

```
Week 1: Internal (10%)  →  Week 2: Beta (50%)  →  Week 3: General (100%)
   ↓                         ↓                        ↓
Monitor metrics         Collect feedback        Full deployment
Fix critical bugs       Tune performance        Monitor stability
```

### Risk Mitigation

1. **Feature Flags**: All changes behind toggles, instant rollback
2. **Staged Deployment**: 10% → 50% → 100% over 3 weeks
3. **Real-Time Monitoring**: Error rates, performance metrics, user feedback
4. **Automated Rollback**: Trigger on error rate >1% or crash rate >0.1%
5. **Gradual Cutover**: Free users first (lower risk), then premium users

---

## Feature Flags

### Flag Structure

```typescript
// /src/config/featureFlags.ts

export interface MyListsFeatureFlags {
  enableMultiTabCoordination: boolean      // TabCoordinator
  enableSyncStatusUI: boolean              // ListSyncStatusIndicator
  enableQuotaGuard: boolean                // QuotaGuard protection
  enableCircuitBreaker: boolean            // Sync queue circuit breaker
  enableStorageWarning: boolean            // StorageWarning component
}

// Default flags (all disabled initially)
const DEFAULT_FLAGS: MyListsFeatureFlags = {
  enableMultiTabCoordination: false,
  enableSyncStatusUI: false,
  enableQuotaGuard: false,
  enableCircuitBreaker: false,
  enableStorageWarning: false
}

// Load flags from environment or remote config
export function getMyListsFeatureFlags(): MyListsFeatureFlags {
  // Option 1: Environment variables (for dev/staging)
  if (process.env.NODE_ENV === 'development') {
    return {
      enableMultiTabCoordination: process.env.NEXT_PUBLIC_ENABLE_MULTI_TAB === 'true',
      enableSyncStatusUI: process.env.NEXT_PUBLIC_ENABLE_SYNC_UI === 'true',
      enableQuotaGuard: process.env.NEXT_PUBLIC_ENABLE_QUOTA_GUARD === 'true',
      enableCircuitBreaker: process.env.NEXT_PUBLIC_ENABLE_CIRCUIT_BREAKER === 'true',
      enableStorageWarning: process.env.NEXT_PUBLIC_ENABLE_STORAGE_WARNING === 'true'
    }
  }

  // Option 2: Remote config (for production)
  // Fetch from Firebase Remote Config, LaunchDarkly, etc.
  return getRemoteFeatureFlags()
}

// Remote config with percentage rollout
async function getRemoteFeatureFlags(): Promise<MyListsFeatureFlags> {
  try {
    const remoteConfig = await fetchRemoteConfig()

    // Percentage rollout logic
    const userBucket = getUserBucket()  // 0-99

    return {
      enableMultiTabCoordination: userBucket < remoteConfig.multiTabRolloutPercent,
      enableSyncStatusUI: userBucket < remoteConfig.syncUIRolloutPercent,
      enableQuotaGuard: userBucket < remoteConfig.quotaGuardRolloutPercent,
      enableCircuitBreaker: userBucket < remoteConfig.circuitBreakerRolloutPercent,
      enableStorageWarning: userBucket < remoteConfig.storageWarningRolloutPercent
    }
  } catch (error) {
    console.error('[FeatureFlags] Failed to fetch remote config:', error)
    return DEFAULT_FLAGS  // Fail safe
  }
}

// Deterministic user bucketing (0-99)
function getUserBucket(): number {
  const userId = auth.currentUser?.uid || 'anonymous'

  // Hash user ID to 0-99 bucket (stable across sessions)
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i)
    hash = hash & hash  // Convert to 32bit integer
  }

  return Math.abs(hash) % 100
}
```

### Flag Usage

```typescript
// /src/lib/lists/ListManager.ts

import { getMyListsFeatureFlags } from '@/config/featureFlags'

class ListManager {
  private featureFlags: MyListsFeatureFlags

  constructor() {
    this.featureFlags = getMyListsFeatureFlags()
  }

  private async initDB(): Promise<IDBPDatabase<ListsDB>> {
    // ... existing code ...

    // === CONDITIONAL: Initialize TabCoordinator ===
    if (this.featureFlags.enableMultiTabCoordination) {
      this.tabCoordinator = new TabCoordinator('lists-coordination')
      await this.tabCoordinator.initialize()
    }

    return this.db
  }

  async createList(data: CreateListRequest): Promise<UserList> {
    // ... existing code ...

    // === CONDITIONAL: QuotaGuard protection ===
    if (this.featureFlags.enableQuotaGuard) {
      await QuotaGuard.guardedWrite(
        () => db.put('lists', list),
        'createList'
      )
    } else {
      await db.put('lists', list)
    }

    // ... existing code ...
  }
}
```

### Remote Config (Firebase)

```json
{
  "myListsRollout": {
    "multiTabRolloutPercent": 10,
    "syncUIRolloutPercent": 10,
    "quotaGuardRolloutPercent": 10,
    "circuitBreakerRolloutPercent": 10,
    "storageWarningRolloutPercent": 10
  }
}
```

Update percentages remotely without redeployment:
```bash
firebase remoteconfig:set myListsRollout.multiTabRolloutPercent=50
```

---

## Rollout Phases

### Phase 1: Internal Testing (Week 1)

**Target**: 10% of users (internal team + beta testers)

**Actions**:
1. **Day 1 (Monday)**: Deploy with flags at 10%
2. **Day 2-3**: Monitor error logs, collect feedback
3. **Day 4-5**: Fix critical bugs, deploy hotfixes
4. **Day 5 (Friday)**: Go/No-Go decision for Phase 2

**Success Criteria**:
- ✅ Error rate <0.5%
- ✅ No critical bugs reported
- ✅ Performance impact <5%
- ✅ Positive feedback from beta testers

**Monitoring**:
```typescript
// Track feature usage
analytics.track('mylists_feature_enabled', {
  feature: 'multi_tab_coordination',
  userId: user.id,
  rolloutPercent: 10
})

// Track errors
Sentry.captureException(error, {
  tags: {
    feature: 'mylists_reliability',
    rolloutPhase: 'phase1'
  }
})
```

**Rollback Trigger**:
- Error rate >1% for any feature
- Critical bug (data loss, app crash)
- Negative performance impact >10%

### Phase 2: Beta Rollout (Week 2)

**Target**: 50% of users (broader beta)

**Actions**:
1. **Day 8 (Monday)**: Increase flags to 50%
2. **Day 9-12**: Monitor at scale, collect usage data
3. **Day 13-14**: Optimize based on real-world usage
4. **Day 14 (Friday)**: Go/No-Go decision for Phase 3

**Success Criteria**:
- ✅ Error rate <0.3%
- ✅ No new bugs discovered
- ✅ Sync success rate >99%
- ✅ Multi-tab coordination works across browsers
- ✅ User satisfaction score >4/5

**A/B Testing**:
```typescript
// Compare metrics between control (old) and treatment (new)
const metrics = {
  control: {
    dataLossRate: 0.05,    // 5% of users report data loss
    syncFailureRate: 0.10,  // 10% sync failures
    supportTickets: 30      // 30 tickets/week
  },
  treatment: {
    dataLossRate: 0.00,    // 0% data loss ✅
    syncFailureRate: 0.01,  // 1% sync failures ✅
    supportTickets: 10      // 10 tickets/week ✅
  }
}
```

### Phase 3: General Availability (Week 3)

**Target**: 100% of users (full rollout)

**Actions**:
1. **Day 15 (Monday)**: Increase flags to 100%
2. **Day 16-21**: Monitor stability at full scale
3. **Day 22-30**: Collect feedback, iterate on UX

**Success Criteria**:
- ✅ Error rate <0.2%
- ✅ Zero data loss incidents
- ✅ Support ticket reduction >50%
- ✅ Performance baseline maintained
- ✅ NPS increase >10 points

**Post-Rollout**:
- Remove feature flags (code cleanup)
- Update documentation
- Write post-mortem
- Plan next iteration

---

## Monitoring & Metrics

### Key Metrics

#### Reliability Metrics

| Metric | Threshold | Alert |
|--------|-----------|-------|
| Error Rate (overall) | <0.2% | >1% |
| Data Loss Events | 0 | >0 |
| Sync Success Rate | >99% | <95% |
| Circuit Breaker Opens | <10/hr | >50/hr |
| QuotaExceededError Rate | <0.1% | >0.5% |

#### Performance Metrics

| Metric | Baseline | Threshold | Alert |
|--------|----------|-----------|-------|
| List Create Time | 12ms | <50ms | >100ms |
| List Update Time | 8ms | <30ms | >80ms |
| Sync Queue Processing | 50ms | <200ms | >500ms |
| Page Load Time | 1.2s | <2s | >3s |

#### User Experience Metrics

| Metric | Target | Alert |
|--------|--------|-------|
| Multi-Tab Data Consistency | 100% | <95% |
| Sync Status Visibility | 100% (premium) | <90% |
| Storage Warning Shown | When >90% full | Never shown incorrectly |
| User Satisfaction (CSAT) | >4.5/5 | <4/5 |

### Monitoring Tools

#### Sentry (Error Tracking)

```typescript
// Track MyLists-specific errors
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  beforeSend(event, hint) {
    // Tag MyLists errors
    if (event.exception?.values?.[0]?.stacktrace?.frames?.some(f =>
      f.filename?.includes('lists/') || f.filename?.includes('storage/')
    )) {
      event.tags = {
        ...event.tags,
        feature: 'mylists_reliability',
        rolloutPhase: getCurrentRolloutPhase()
      }
    }
    return event
  }
})

// Custom error tracking
function trackMyListsError(error: Error, context: string) {
  Sentry.captureException(error, {
    tags: {
      feature: 'mylists',
      context
    },
    extra: {
      featureFlags: getMyListsFeatureFlags(),
      userBucket: getUserBucket()
    }
  })
}
```

#### Google Analytics (Usage Tracking)

```typescript
// Track feature adoption
analytics.track('mylists_multi_tab_enabled', {
  userId: user.id,
  isLeader: tabCoordinator.isLeader(),
  tabCount: getOpenTabCount()
})

// Track sync operations
analytics.track('mylists_sync_completed', {
  itemCount: syncedItems.length,
  duration: syncDuration,
  circuitBreakerState: circuitBreaker.state
})

// Track quota warnings
analytics.track('mylists_quota_warning_shown', {
  usagePercent: quotaStatus.percentage * 100,
  usedMB: quotaStatus.usage / (1024 * 1024),
  quotaMB: quotaStatus.quota / (1024 * 1024)
})
```

#### Firebase Performance Monitoring

```typescript
import { trace } from '@firebase/performance'

// Track sync performance
const syncTrace = trace(performance, 'mylists_sync_queue')
syncTrace.start()

await processSyncQueue()

syncTrace.putMetric('items_synced', itemCount)
syncTrace.stop()

// Track list operations
const createListTrace = trace(performance, 'mylists_create_list')
createListTrace.start()

await listManager.createList(data)

createListTrace.putMetric('quota_check_ms', quotaCheckDuration)
createListTrace.stop()
```

#### Custom Dashboard

```typescript
// Real-time metrics dashboard
const MyListsMetricsDashboard = {
  // Error rates
  errorRate: 0.15,  // 0.15%
  dataLossEvents: 0,

  // Sync metrics
  syncSuccessRate: 99.2,  // 99.2%
  avgSyncDuration: 850,   // 850ms
  circuitBreakerOpens: 3, // per hour

  // Performance
  avgCreateTime: 14,      // 14ms
  avgUpdateTime: 9,       // 9ms
  p95CreateTime: 32,      // 32ms

  // Quota
  quotaWarningsShown: 120,  // per day
  quotaExceededErrors: 2,   // per day

  // User experience
  userSatisfaction: 4.6,    // out of 5
  supportTickets: 12        // per week (down from 30)
}
```

### Alerts Configuration

#### PagerDuty Integration

```yaml
# alerts.yml
alerts:
  - name: MyLists High Error Rate
    condition: error_rate > 1%
    severity: critical
    notify: on-call-engineer
    runbook: https://docs.internal/mylists-high-errors

  - name: MyLists Data Loss Detected
    condition: data_loss_events > 0
    severity: critical
    notify: engineering-leads
    runbook: https://docs.internal/mylists-data-loss

  - name: MyLists Sync Failures
    condition: sync_success_rate < 95%
    severity: warning
    notify: mylists-team
    runbook: https://docs.internal/mylists-sync-failures

  - name: MyLists Performance Degradation
    condition: avg_create_time > 100ms
    severity: warning
    notify: mylists-team
    runbook: https://docs.internal/mylists-performance
```

---

## Rollback Procedures

### Instant Rollback (Feature Flags)

```bash
# Rollback multi-tab coordination immediately
firebase remoteconfig:set myListsRollout.multiTabRolloutPercent=0

# Rollback all features
firebase remoteconfig:set myListsRollout.multiTabRolloutPercent=0
firebase remoteconfig:set myListsRollout.syncUIRolloutPercent=0
firebase remoteconfig:set myListsRollout.quotaGuardRolloutPercent=0
```

**Propagation Time**: 1-5 minutes (Remote Config refresh interval)

### Partial Rollback (Reduce Percentage)

```bash
# Roll back from 50% to 10%
firebase remoteconfig:set myListsRollout.multiTabRolloutPercent=10
```

### Full Deployment Rollback

```bash
# Revert to previous deployment
git revert HEAD~1  # Revert last commit
git push origin main

# Or redeploy previous version
git checkout v1.2.3
npm run build
npm run deploy
```

### Emergency Rollback Checklist

```
[ ] 1. Identify issue (error logs, user reports)
[ ] 2. Set feature flags to 0% (instant rollback)
[ ] 3. Verify error rate drops within 5 minutes
[ ] 4. Post incident update to status page
[ ] 5. Notify affected users (if needed)
[ ] 6. Root cause analysis
[ ] 7. Fix issue in development
[ ] 8. Plan re-rollout
```

### Rollback Impact

| Rollback Type | User Impact | Data Loss Risk | Recovery Time |
|---------------|-------------|----------------|---------------|
| Feature Flag (0%) | Reverts to old behavior | None (data preserved) | 1-5 minutes |
| Partial (50% → 10%) | 40% of users revert | None | 1-5 minutes |
| Full Deployment | All users revert | None (if tested) | 10-30 minutes |

---

## Communication Plan

### Internal Communication

**Slack Channels**:
- `#mylists-rollout` - Real-time rollout updates
- `#engineering-alerts` - Critical issues
- `#product-updates` - Feature announcements

**Daily Standups** (During Rollout):
```
Attendees: Engineering, Product, Support
Duration: 15 minutes
Agenda:
1. Metrics review (error rate, performance)
2. User feedback summary
3. Blockers / issues
4. Go/No-Go decision for next phase
```

### User Communication

**Phase 1 (10%)**: No user-facing announcement (internal only)

**Phase 2 (50%)**: In-app notification
```
📢 New: Enhanced List Sync

We've improved list syncing across devices and tabs!
Your lists now stay in sync automatically.

[Learn More]  [Dismiss]
```

**Phase 3 (100%)**: Full announcement
- Blog post: "Introducing Reliable List Syncing"
- Email to all users
- Social media announcement
- Updated help docs

**Status Page** (during rollout):
```
https://status.moshimoshi.app

✅ All Systems Operational

Recent Updates:
- [Jan 15] MyLists: Rolling out enhanced sync (50% of users)
- [Jan 8] MyLists: Testing new reliability features (10% of users)
```

### Support Team Enablement

**Training Materials**:
1. Feature overview deck (15 slides)
2. FAQ document (20 common questions)
3. Troubleshooting guide (this doc)
4. Demo video (5 minutes)

**Support Scripts**:
```
User: "My lists aren't syncing across tabs"

Response:
"We recently rolled out improved multi-tab syncing!
Here's what to try:
1. Refresh both tabs
2. Check if you're premium (syncing requires Premium)
3. Look for the sync status indicator (bottom right)
4. If still not working, clear browser cache and try again"
```

---

## Success Criteria

### Phase 1 (Week 1) - 10% Rollout

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Error Rate | <0.5% | ___% | [ ] Pass [ ] Fail |
| Data Loss Events | 0 | ___ | [ ] Pass [ ] Fail |
| Performance Impact | <5% | ___% | [ ] Pass [ ] Fail |
| Critical Bugs | 0 | ___ | [ ] Pass [ ] Fail |
| Beta Tester Satisfaction | >4/5 | ___/5 | [ ] Pass [ ] Fail |

**Go/No-Go Decision**: Proceed to Phase 2 if ALL criteria pass

### Phase 2 (Week 2) - 50% Rollout

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Error Rate | <0.3% | ___% | [ ] Pass [ ] Fail |
| Sync Success Rate | >99% | ___% | [ ] Pass [ ] Fail |
| Multi-Tab Consistency | >98% | ___% | [ ] Pass [ ] Fail |
| Support Ticket Reduction | >30% | ___% | [ ] Pass [ ] Fail |
| User Satisfaction | >4/5 | ___/5 | [ ] Pass [ ] Fail |

**Go/No-Go Decision**: Proceed to Phase 3 if ALL criteria pass

### Phase 3 (Week 3) - 100% Rollout

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Error Rate | <0.2% | ___% | [ ] Pass [ ] Fail |
| Data Loss Events | 0 | ___ | [ ] Pass [ ] Fail |
| Support Ticket Reduction | >50% | ___% | [ ] Pass [ ] Fail |
| NPS Increase | >10 points | ___ | [ ] Pass [ ] Fail |
| Performance Baseline | Maintained | [ ] Yes [ ] No | [ ] Pass [ ] Fail |

**Decision**: Remove feature flags and declare success if ALL criteria pass

---

## Post-Rollout Validation

### Week 4: Stability Monitoring

**Actions**:
1. Monitor metrics for stability (no degradation)
2. Collect user feedback via in-app survey
3. Analyze support tickets for patterns
4. Review Sentry errors for edge cases

**Survey Questions**:
```
1. Have you noticed improvements in list syncing? (Yes/No)
2. How satisfied are you with list reliability? (1-5)
3. Have you experienced any data loss? (Yes/No)
4. Any feedback or issues to report? (Free text)
```

### Week 5: Code Cleanup

**Actions**:
1. Remove feature flags from codebase
2. Update documentation with final implementation
3. Archive rollout-specific code (monitoring, A/B tests)
4. Optimize based on production learnings

```typescript
// BEFORE (with flags)
if (this.featureFlags.enableMultiTabCoordination) {
  this.tabCoordinator = new TabCoordinator('lists-coordination')
}

// AFTER (flags removed)
this.tabCoordinator = new TabCoordinator('lists-coordination')
```

### Week 6: Retrospective

**Agenda**:
1. What went well?
2. What could be improved?
3. Lessons learned
4. Action items for next rollout

**Post-Mortem Document**:
```markdown
# MyLists Reliability Rollout - Post-Mortem

## Summary
Successfully rolled out multi-tab coordination, sync status visibility,
and quota handling to 100% of users over 3 weeks.

## Metrics
- Error Rate: 0.12% (target: <0.2%) ✅
- Data Loss Events: 0 (target: 0) ✅
- Support Tickets: Reduced by 65% (target: >50%) ✅
- User Satisfaction: +12 NPS points (target: >10) ✅

## What Went Well
- Staged rollout caught 2 bugs in Phase 1
- Feature flags enabled instant rollback
- Real-time monitoring prevented incidents

## What Could Be Improved
- Phase 1 took 6 days instead of 5 (bug fixes)
- Documentation needed more examples
- Support team wanted more notice

## Action Items
1. Improve unit test coverage to 95%+
2. Add more E2E tests for multi-tab scenarios
3. Create runbooks for common issues
4. Automate rollout process (CI/CD)
```

---

## Runbooks

### Runbook 1: High Error Rate

**Symptom**: Error rate >1%

**Investigation**:
1. Check Sentry for error patterns
2. Identify which feature is causing errors
3. Check if errors are user-specific or global

**Resolution**:
- If specific feature: Rollback that feature flag to 0%
- If global: Full rollback all flags
- Fix issue, redeploy, re-rollout

### Runbook 2: Data Loss Report

**Symptom**: User reports lost lists

**Investigation**:
1. Check user's IndexedDB in browser
2. Check Firebase for cloud backup (premium users)
3. Review sync queue logs
4. Check for QuotaExceededError in user's session

**Resolution**:
- If in IndexedDB: User deleted browser data (educate)
- If in Firebase: Restore from cloud backup
- If quota exceeded: Guide user to free space
- If sync failed: Manually trigger sync

### Runbook 3: Sync Failures

**Symptom**: Sync success rate <95%

**Investigation**:
1. Check circuit breaker state (is it open?)
2. Check Firebase status (is it down?)
3. Review retry queue (are items backing up?)
4. Check network connectivity (user-side issues?)

**Resolution**:
- If circuit breaker open: Wait for cooldown, or reset manually
- If Firebase down: Wait for recovery
- If retry queue backing up: Increase retry timeout
- If user-side: Educate users on connectivity

---

**Document Version**: 1.0
**Last Updated**: 2026-01-05
**Author**: Claude (Sonnet 4.5)
**Status**: READY FOR IMPLEMENTATION
