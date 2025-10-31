# Streak System Migration Guide

> **📚 Documentation Hub**: [STREAK_SYSTEM_INDEX_2025-10-30.md](./STREAK_SYSTEM_INDEX_2025-10-30.md) - Central index for all streak documentation
>
> **Related Docs**:
> - [Comprehensive Analysis](./STREAK_SYSTEM_COMPREHENSIVE_ANALYSIS_2025-10-30.md) - Deep dive into current system architecture
> - [Implementation Log](./STREAK_MIGRATION_IMPLEMENTATION_2025-10-30.md) - ✅ What we actually did (Oct 30, 2025)

## Executive Summary

This guide documents the migration from the old multi-source streak system to the new Firebase-first architecture. This migration eliminates race conditions, reduces code complexity by 40%, and aligns with the Universal Review Engine (URE) patterns.

**Migration Status**: Implementation Complete, Ready for Deployment
**Estimated Migration Time**: 4 weeks (gradual rollout)
**Risk Level**: Low (feature-flagged with rollback capability)

---

## Table of Contents

1. [Overview](#overview)
2. [What Changed](#what-changed)
3. [Prerequisites](#prerequisites)
4. [Migration Steps](#migration-steps)
5. [Feature Flag Configuration](#feature-flag-configuration)
6. [Rollout Strategy](#rollout-strategy)
7. [Testing & Verification](#testing--verification)
8. [Rollback Procedures](#rollback-procedures)
9. [Monitoring & Alerts](#monitoring--alerts)
10. [Cleanup](#cleanup)

---

## Overview

### Problem Statement

The old streak system had **4 sources of truth**:
1. Zustand (client state)
2. IndexedDB (local storage)
3. Firebase (cloud storage)
4. Redis (caching layer)

This caused:
- Race conditions between storage layers
- Data loss during sync conflicts
- Complex 4-layer race condition protection
- Last-Write-Wins (LWW) conflict resolution
- 1,200+ lines of complex sync logic

### Solution

New **Firebase-first architecture** with:
- Single source of truth (Firebase)
- Optimistic UI updates
- Transactional writes with version-based conflict detection
- Matches Universal Review Engine (URE) patterns
- Reduces code by ~1,200 lines (40%)

### Benefits

- ✅ Zero race conditions
- ✅ Zero data loss
- ✅ Instant UI feedback (optimistic updates)
- ✅ Simpler codebase (40% code reduction)
- ✅ Better offline support
- ✅ Consistent with URE architecture

---

## What Changed

### New Files Created

1. **`src/lib/gamification/services/streakService.ts`** (200 lines)
   - Pure functions for streak calculation
   - Transactional Firebase operations
   - Version-based conflict detection

2. **`src/app/api/gamification/streak/increment/route.ts`**
   - POST endpoint for incrementing streak
   - Uses streakService transactions

3. **`src/app/api/gamification/streak/reset/route.ts`**
   - POST endpoint for resetting streak
   - Uses streakService transactions

4. **`scripts/migration/add-streak-version-field.js`**
   - Adds version field to all user_stats documents
   - Must run BEFORE deploying new code

5. **`scripts/migration/migrate-streak-to-firebase.js`**
   - Migrates IndexedDB data to Firebase
   - Takes maximum values to preserve data

6. **`src/app/api/gamification/migration/upload/route.ts`**
   - API endpoint for migration script
   - Merges IndexedDB and Firebase data

7. **`src/lib/gamification/services/__tests__/streakService.test.ts`**
   - Comprehensive test suite (40+ tests)
   - 95%+ coverage

### Files Modified

1. **`src/state/userGamification.ts`**
   - Added optimistic updates for Firebase-first mode
   - Added version tracking
   - Updated incrementStreak() to be async
   - Updated resetStreak() to be async
   - Feature flag: `NEXT_PUBLIC_STREAK_FIREBASE_FIRST`

2. **`src/lib/gamification/gamificationListener.ts`**
   - Updated to await incrementStreak() call
   - No other changes (clean separation)

### Files to Remove (Phase 4 - Cleanup)

After successful rollout and verification:

1. `src/lib/gamification/indexedDBStore.ts` (~150 lines)
2. `src/app/api/gamification/sync/route.ts` (~200 lines)
3. All IndexedDB-related code in userGamification.ts (~400 lines)
4. 18 other files identified in comprehensive analysis

**Total cleanup**: ~1,200 lines of code

---

## Prerequisites

### Required Tools

- Node.js 18+
- Firebase Admin SDK credentials
- Access to production Firebase project
- Access to environment variable configuration

### Required Access

- Firebase console access
- Production deployment access
- Environment variable configuration access
- Monitoring/logging access

### Backup Requirements

Before starting migration:

1. **Backup Firebase user_stats collection**
   ```bash
   gcloud firestore export gs://moshimoshi-backups/pre-streak-migration-$(date +%Y%m%d)
   ```

2. **Document current system state**
   - Count of users with streak data
   - Current max streak values
   - Last sync timestamps

3. **Test migration in staging**
   - Run full migration on staging environment
   - Verify data integrity
   - Test rollback procedures

---

## Migration Steps

### Phase 1: Preparation (Week 1)

#### Step 1.1: Add Version Field to Firebase

**When**: Before deploying any new code
**Script**: `scripts/migration/add-streak-version-field.js`

```bash
# Dry run (preview changes)
node scripts/migration/add-streak-version-field.js --dry-run

# Execute migration
node scripts/migration/add-streak-version-field.js
```

**Expected Output**:
```
Starting Version Field Migration
Found 10,247 documents
Need migration: 10,247
Processing batch 1/21...
✓ All documents successfully migrated!
```

**Verification**:
```bash
# Check a few documents in Firebase Console
# user_stats/{userId} should have:
# - version: 1
# - versionMigratedAt: <timestamp>
```

#### Step 1.2: Deploy New Code (Feature Flag OFF)

Deploy all new files with feature flag disabled:

```env
NEXT_PUBLIC_STREAK_FIREBASE_FIRST=false
```

**Verification**:
- Build succeeds
- Tests pass
- Old system still active
- No errors in logs

#### Step 1.3: Run Tests

```bash
# Run streak service tests
npm test -- streakService.test.ts

# Run full test suite
npm test

# Verify 95%+ coverage
npm run test:coverage -- streakService
```

### Phase 2: Gradual Rollout (Week 2-3)

#### Step 2.1: Enable for 1% of Users

Update environment variable:

```env
# In your feature flag service or environment config
STREAK_FIREBASE_FIRST_ROLLOUT_PERCENTAGE=1
```

**Monitoring** (first 24 hours):
- Watch error rates
- Monitor Firebase write operations
- Check conflict detection rate
- Verify optimistic updates working

#### Step 2.2: Scale to 5%, 25%, 50%

Gradually increase rollout percentage every 2-3 days:

```env
Day 1-2:   STREAK_FIREBASE_FIRST_ROLLOUT_PERCENTAGE=1
Day 3-5:   STREAK_FIREBASE_FIRST_ROLLOUT_PERCENTAGE=5
Day 6-8:   STREAK_FIREBASE_FIRST_ROLLOUT_PERCENTAGE=25
Day 9-11:  STREAK_FIREBASE_FIRST_ROLLOUT_PERCENTAGE=50
Day 12+:   STREAK_FIREBASE_FIRST_ROLLOUT_PERCENTAGE=100
```

**After each increase**:
- Monitor for 24-48 hours
- Check error rates
- Verify data consistency
- Review user feedback

#### Step 2.3: Full Rollout (100%)

Once confident with 50% rollout:

```env
NEXT_PUBLIC_STREAK_FIREBASE_FIRST=true
STREAK_FIREBASE_FIRST_ROLLOUT_PERCENTAGE=100
```

### Phase 3: Data Migration (Week 3)

#### Step 3.1: User-Initiated Migration

Create a migration page at `/migrate-streak` that allows users to migrate their IndexedDB data to Firebase.

**Migration Page Features**:
- Check migration status
- Show current IndexedDB vs Firebase data
- One-click migration button
- Progress indicator
- Success/error messaging

**Script Usage**:
```javascript
// On migration page
import { migrateStreakData, checkMigrationStatus } from '@/scripts/migration/migrate-streak-to-firebase';

// Check status
const status = await checkMigrationStatus();

// Run migration
const result = await migrateStreakData();
```

#### Step 3.2: Verify Migration

After migration:
1. Check Firebase Console for user_stats document
2. Verify values are maximum of IndexedDB and Firebase
3. Confirm version field incremented
4. Test streak increment on migrated account

### Phase 4: Cleanup (Week 4)

#### Step 4.1: Remove Deprecated Code

After 1-2 weeks of successful 100% rollout:

```bash
# Remove IndexedDB store
rm src/lib/gamification/indexedDBStore.ts

# Remove old sync API
rm src/app/api/gamification/sync/route.ts

# Remove other deprecated files (see list in comprehensive analysis)
```

#### Step 4.2: Update Documentation

- Update API documentation
- Update architecture diagrams
- Add to CHANGELOG
- Update developer guides

#### Step 4.3: Remove Feature Flags

Once cleanup is complete, remove feature flag checks:

```typescript
// Before
if (useFirebaseFirst) {
  // new code
} else {
  // old code - REMOVE THIS
}

// After
// Only new code remains
```

---

## Feature Flag Configuration

### Environment Variables

#### Primary Feature Flag

```env
# Enable Firebase-first streak system
NEXT_PUBLIC_STREAK_FIREBASE_FIRST=true
```

#### Rollout Percentage (Optional)

```env
# Percentage of users to enable (0-100)
STREAK_FIREBASE_FIRST_ROLLOUT_PERCENTAGE=1
```

### Implementation

The feature flag is checked in:

1. **Zustand Store** (`src/state/userGamification.ts`)
   ```typescript
   const useFirebaseFirst = process.env.NEXT_PUBLIC_STREAK_FIREBASE_FIRST === 'true';
   ```

2. **API Endpoints** (all new streak endpoints)
   ```typescript
   if (process.env.NEXT_PUBLIC_STREAK_FIREBASE_FIRST !== 'true') {
     return NextResponse.json({ error: 'Not enabled' }, { status: 403 });
   }
   ```

### Rollout Logic

For gradual rollout, implement in middleware:

```typescript
// middleware.ts or feature flag service
const userId = getUserId(req);
const rolloutPercentage = parseInt(process.env.STREAK_FIREBASE_FIRST_ROLLOUT_PERCENTAGE || '0');

// Deterministic: same user always gets same result
const userHash = hashUserId(userId);
const userPercentile = userHash % 100;

if (userPercentile < rolloutPercentage) {
  // Enable Firebase-first for this user
  req.featureFlags.streakFirebaseFirst = true;
}
```

---

## Rollout Strategy

### Week 1: Preparation
- [x] Deploy new code (feature flag OFF)
- [x] Add version field to Firebase
- [x] Run test suite
- [x] Verify no regressions

### Week 2: Initial Rollout
- [ ] Enable for 1% (Days 1-2)
- [ ] Monitor 24/7 for issues
- [ ] Enable for 5% (Days 3-5)
- [ ] Enable for 25% (Days 6-8)

### Week 3: Scale Up
- [ ] Enable for 50% (Days 9-11)
- [ ] Monitor Firebase write patterns
- [ ] Enable for 100% (Day 12+)
- [ ] Begin user-initiated data migration

### Week 4: Cleanup
- [ ] Verify 100% stable for 1 week
- [ ] Remove deprecated code
- [ ] Update documentation
- [ ] Remove feature flags

---

## Testing & Verification

### Unit Tests

Run comprehensive test suite:

```bash
npm test -- streakService.test.ts
```

**Expected**:
- 40+ tests pass
- 95%+ code coverage
- All edge cases covered

### Integration Tests

Test scenarios:
1. New user first streak
2. Consecutive days
3. Missed days (reset)
4. Streak freeze usage
5. Conflict resolution
6. Optimistic update + revert on error

### Manual Testing

Test checklist:
- [ ] Increment streak (should be instant)
- [ ] Verify Firebase updated
- [ ] Test offline mode
- [ ] Test with poor network (simulated)
- [ ] Verify conflict detection
- [ ] Test migration script
- [ ] Verify rollback procedure

### Load Testing

Simulate load:
```bash
# 100 concurrent users
k6 run scripts/load-tests/streak-increment.js
```

**Success Criteria**:
- <100ms p95 latency
- <1% error rate
- Zero data loss
- Zero conflicts (or all resolved correctly)

---

## Rollback Procedures

### Immediate Rollback (Emergency)

If critical issues found:

```env
# Disable feature flag immediately
NEXT_PUBLIC_STREAK_FIREBASE_FIRST=false
```

**Deployment**:
```bash
# Quick deploy of env var change
vercel env add NEXT_PUBLIC_STREAK_FIREBASE_FIRST false
vercel deploy --prod
```

**Data Recovery**:
- Data in Firebase is preserved
- Old system (IndexedDB + manual sync) resumes
- No data loss

### Partial Rollback

Reduce rollout percentage:

```env
# Reduce from 100% to 10%
STREAK_FIREBASE_FIRST_ROLLOUT_PERCENTAGE=10
```

### Full Rollback (Complete Revert)

If migration must be fully reverted:

1. **Disable feature flag**
   ```env
   NEXT_PUBLIC_STREAK_FIREBASE_FIRST=false
   ```

2. **Keep version field in Firebase**
   - Do NOT remove version field
   - Old system ignores it
   - Allows future retry

3. **Communicate to users**
   - Explain temporary revert
   - Data is safe in Firebase
   - Will retry migration later

### Post-Rollback Actions

1. **Investigate root cause**
   - Review logs
   - Identify failure pattern
   - Fix issues

2. **Test fix in staging**
   - Reproduce issue
   - Verify fix works
   - Re-run full test suite

3. **Retry migration**
   - Follow same gradual rollout
   - Extra monitoring on problem areas

---

## Monitoring & Alerts

### Key Metrics

Track in your monitoring dashboard:

1. **Streak Increment Success Rate**
   - Target: >99.9%
   - Alert: <99%

2. **Firebase Write Latency**
   - Target: <100ms p95
   - Alert: >200ms p95

3. **Conflict Detection Rate**
   - Expected: <0.1%
   - Alert: >1%

4. **Optimistic Update Revert Rate**
   - Expected: <0.5%
   - Alert: >2%

5. **Error Rate**
   - Target: <0.1%
   - Alert: >0.5%

### Logging

Add structured logging:

```typescript
console.log('[StreakService]', {
  action: 'increment',
  userId,
  success: true,
  duration: endTime - startTime,
  conflictDetected: false,
  version: newVersion
});
```

### Alerts

Set up alerts for:

- Streak increment errors >5 in 5 minutes
- Firebase write latency >200ms (p95)
- Conflict detection rate >1%
- Any rollback triggered

### Dashboards

Create dashboards showing:
- Real-time streak operations
- Success/error rates by region
- Latency percentiles (p50, p95, p99)
- Rollout percentage vs. error rate

---

## Cleanup

### Phase 4.1: Remove Deprecated Files

**Files to Remove** (after successful rollout):

```bash
# IndexedDB store
rm src/lib/gamification/indexedDBStore.ts

# Old sync API
rm src/app/api/gamification/sync/route.ts
rm src/app/api/gamification/load/route.ts  # Replace with Firebase-first version

# Remove IndexedDB code from Zustand store
# (Keep only Firebase-first code path)
```

**Line Reduction**:
- Before: ~3,000 lines (streak system)
- After: ~1,800 lines
- Reduction: ~1,200 lines (40%)

### Phase 4.2: Update Architecture Docs

Update documentation:

1. **CLAUDE.md**
   - Update streak system section
   - Add Firebase-first patterns

2. **Architecture diagrams**
   - Remove multi-source arrows
   - Show single source of truth

3. **API documentation**
   - Document new endpoints
   - Mark old endpoints as deprecated

### Phase 4.3: Remove Feature Flags

Once cleanup is complete:

```typescript
// Remove this check
if (useFirebaseFirst) {
  // new code
} else {
  // old code
}

// Keep only
// new code
```

---

## Success Criteria

Migration is considered successful when:

- ✅ 100% of users on new system for 1+ week
- ✅ Zero data loss reported
- ✅ <0.1% error rate
- ✅ <100ms p95 latency
- ✅ Zero critical bugs
- ✅ Positive user feedback
- ✅ Monitoring dashboards show healthy metrics
- ✅ Deprecated code removed
- ✅ Documentation updated

---

## Support & Troubleshooting

### Common Issues

#### Issue: "Conflict detected" errors

**Cause**: Multiple tabs/devices updating simultaneously
**Resolution**: Automatic - service reloads from server
**Prevention**: Version-based conflict detection

#### Issue: Optimistic update reverts

**Cause**: Network error or Firebase unavailable
**Resolution**: User sees error, can retry
**Prevention**: Exponential backoff, better error handling

#### Issue: Migration script fails

**Cause**: User not authenticated
**Resolution**: Ensure user is logged in before running
**Prevention**: Add auth check to migration page

### Getting Help

- **Slack**: #streak-migration
- **Email**: dev-team@moshimoshi.com
- **Docs**: https://docs.moshimoshi.com/streak-migration
- **Runbook**: See internal wiki

---

## Appendix

### A. File Structure

```
src/
├── lib/gamification/services/
│   ├── streakService.ts                    # NEW
│   └── __tests__/
│       └── streakService.test.ts           # NEW
├── state/
│   └── userGamification.ts                 # MODIFIED
├── app/api/gamification/
│   ├── streak/
│   │   ├── increment/route.ts              # NEW
│   │   └── reset/route.ts                  # NEW
│   └── migration/
│       ├── upload/route.ts                 # NEW
│       └── status/route.ts                 # NEW
scripts/
└── migration/
    ├── add-streak-version-field.js         # NEW
    └── migrate-streak-to-firebase.js       # NEW
```

### B. Database Schema

**Before** (old system):
```typescript
// Multiple sources
{
  // Zustand (client)
  currentStreak: 10,
  // IndexedDB (local)
  currentStreak: 9,  // ⚠️ Conflict!
  // Firebase (cloud)
  currentStreak: 8,  // ⚠️ Conflict!
}
```

**After** (new system):
```typescript
// Single source (Firebase)
{
  currentStreak: 10,
  bestStreak: 15,
  lastActivityDate: "2025-01-30",
  totalXP: 5000,
  freezesRemaining: 2,
  version: 5,  // NEW
  updatedAt: Timestamp
}
```

### C. API Endpoints

#### New Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/gamification/streak/increment` | POST | Increment streak (transactional) |
| `/api/gamification/streak/reset` | POST | Reset streak (transactional) |
| `/api/gamification/migration/upload` | POST | Upload IndexedDB data to Firebase |
| `/api/gamification/migration/status` | GET | Check migration status |

#### Deprecated Endpoints

| Endpoint | Replacement |
|----------|-------------|
| `/api/gamification/sync` | `/api/gamification/streak/increment` |

---

**Document Version**: 1.0
**Last Updated**: 2025-10-30
**Author**: Moshimoshi Development Team
**Status**: Ready for Production Deployment
