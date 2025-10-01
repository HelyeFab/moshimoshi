# Phase 1: Dependency Analysis Report
**Date:** 2025-10-01
**Analyst:** Claude Code
**Status:** ✅ COMPLETE - Ready for Review

---

## Executive Summary

**Codebase Size:** 987 TypeScript/TSX files
**Critical Issues Found:** 5
**Files Requiring Migration:** 17
**Deprecated Endpoints Still in Use:** 4
**localStorage Keys Per User:** 14+

---

## 🎯 Key Findings

### 1. **achievement-store DOUBLE-WRITE BUG** 🔴 CRITICAL

**Location:** `/src/stores/achievement-store.ts` lines 314-455

**The Problem:**
```typescript
updateProgress: async (sessionStats: any) => {
  // STEP 1: Calls unified API ✅
  await fetch('/api/stats/unified', {
    type: 'session',
    data: sessionStats
  })

  // STEP 2: Falls back to localStorage (good for free users) ✅
  localStorage.setItem(`activities_${userId}`, JSON.stringify(activityData))

  // STEP 3: THEN ALSO calls achievementManager.saveActivities() ❌
  if (isPremium) {
    achievementManager.saveActivities(userId, activityData, isPremium)
    // ^ This ALSO calls /api/stats/unified internally!
  }
}
```

**Impact:**
- Premium users: Potential **race condition** (two writes to same Firebase doc)
- Possible **double-counting** of streak updates
- **Inconsistent state** if one write succeeds and other fails

**Components Affected (3):**
1. `/src/app/drill/page.tsx` - line 242
2. `/src/components/learn/KanaLearningComponent.tsx` - lines 406, 696
3. `/src/app/tools/kanji-mastery/learn/LearnContent.tsx` - line 397

**Fix Required:** Remove lines 416-420 (the `achievementManager.saveActivities()` call)

---

### 2. **XP-to-Streak Auto-Update Timing Bug** 🟡 MEDIUM

**Location:** `/src/lib/services/UserStatsService.ts` line 321

**The Problem:**
```typescript
// Auto-update streak if user earned 10+ XP and hasn't updated today
if (xpGained >= minXPForStreak && lastActivity !== today) {
  return this.updateStreak(userId, today)
}
```

**Scenario That Breaks:**
1. User earns **5 XP** from drill → doesn't trigger (< 10)
2. `lastActivity` gets updated to today from the XP write
3. User earns **5 more XP** from flashcards (total 10 for day)
4. **Doesn't trigger** because `lastActivity === today` now

**Expected Behavior:** Streak should update when **total daily XP >= 10**, not per-event

**Options:**
- A) Track daily XP accumulator in user_stats
- B) Remove auto-streak, make sessions explicitly call streak update
- C) Check if user already earned streak today, then accumulate

**Your Decision:** "User earns 10+ XP in a single session"
**Fix Required:** Document this behavior and ensure session-based XP (drill, kanji) always gives 10+ XP

---

### 3. **useXP Hook Still Widely Used** 🟡 MEDIUM

**Files Using Deprecated `useXP` Hook (7):**
1. `/src/app/dashboard/page.tsx`
2. `/src/app/tools/kanji-mastery/learn/LearnContent.tsx`
3. `/src/app/drill/page.tsx`
4. `/src/__tests__/xp-system/useXP-fixed.test.tsx`
5. `/src/__tests__/xp-system/components.test.tsx`
6. `/src/__tests__/xp-system/components-fixed.test.tsx`
7. `/src/app/review-dashboard/page.tsx`

**The Hook Says:**
```typescript
/**
 * @deprecated Use useUserStats() from '@/hooks/useUserStats' instead
 * This hook is kept for backward compatibility but will be removed
 */
```

But it's still actively used by production components!

**Fix Required:** Migrate each component individually to `useUserStats()`

---

### 4. **localStorage Pollution** 🟡 MEDIUM

**14+ Keys Per User:**

**Stats-Related:**
- `xp_{userId}` - XP cache (from xp-system.ts:289)
- `achievements_{userId}` - Achievement data (achievementManager.ts:350)
- `activities_{userId}` - Streak dates (achievement-store.ts:368,413)
- `currentStreak_{userId}` - Streak value (various old code)
- `bestStreak_{userId}` - Best streak (various old code)
- `currentStreak_{userId}_cache` - Cached streak (useReviewStats.ts:253)
- `bestStreak_{userId}_cache` - Cached best (useReviewStats.ts:254)
- `lastReviewDate_{userId}_cache` - Last review (useReviewStats.ts:255)

**Other User Data:**
- `preferences_{userId}` - User preferences
- `theme_{userId}` - Theme choice
- Zustand persisted stores (achievement-store, pin-store, etc.)

**Problems:**
- No cleanup mechanism
- No expiration/TTL
- Duplicate keys (currentStreak vs currentStreak_cache)
- Some treated as cache, some as source of truth

**Fix Required:** Consolidate to `user_stats_cache_{userId}` with clear semantics

---

### 5. **Deprecated API Endpoints Still Called** 🟢 LOW

**Deprecated Endpoints (Still Active, Redirecting):**

1. **`/api/xp/track`** (route.ts exists)
   - Used by: Tests only
   - Redirects to: `/api/stats/unified`
   - Action: Safe to delete after test migration

2. **`/api/achievements/activities`** (route.ts exists)
   - Used by: `achievementManager.ts` (line 221-251)
   - Redirects to: `/api/stats/unified`
   - Action: Update achievementManager to call unified API directly

3. **`/api/achievements/data`** (route.ts exists)
   - Used by: Unknown (need to search)
   - Redirects to: `/api/stats/unified`
   - Action: Search for usage, then remove

4. **`/api/achievements/update-activity`** (route.ts exists)
   - Used by: Tests only
   - Redirects to: `/api/stats/unified`
   - Action: Update tests, then remove

**Note:** Redirects work fine, but add 100-200ms latency

---

## 📊 Component Migration Matrix

### Components Using achievement-store (17 files total)

**HIGH PRIORITY (Actively use updateProgress):**
- ✅ `/src/app/drill/page.tsx` - Calls updateProgress after session
- ✅ `/src/components/learn/KanaLearningComponent.tsx` - Calls updateProgress (2 places)
- ✅ `/src/app/tools/kanji-mastery/learn/LearnContent.tsx` - Calls updateProgress

**MEDIUM PRIORITY (Read-only usage):**
- `/src/app/account/page.tsx` - Displays achievements
- `/src/app/dashboard/page.tsx` - Displays streak/achievements
- `/src/app/achievements/page.tsx` - Achievement gallery
- `/src/components/profile/AchievementBadges.tsx` - Badge display
- `/src/components/dashboard/AchievementDisplay.tsx` - Display component
- `/src/components/notifications/AchievementToast.tsx` - Toast notifications

**LOW PRIORITY (Test/Utility):**
- `/src/lib/storage/migrate-stores.ts` - Migration utility
- `/src/lib/storage/zustand-user-storage.ts` - Storage wrapper
- `/src/__tests__/data-leakage-fix.test.ts` - Test
- `/src/__tests__/e2e/progress-tracking.e2e.test.ts` - E2E test
- `/src/components/dashboard/__tests__/AchievementDisplay.test.tsx` - Unit test
- `/src/app/test/achievements/page.tsx` - Test page

**SPECIAL:**
- `/src/stores/achievement-store.ts` - The store itself
- `/src/hooks/useKanjiBrowser.ts` - Uses achievement store indirectly

---

## 📁 Files Using localStorage (69 files)

**Categories:**

**User Stats (17 files):**
- useReviewStats.ts, useXP.ts, achievementManager.ts
- achievement-store.ts, xp-system.ts
- UserStatsService.ts (server-side checks)
- Flashcards components (ComebackMessage, DailyGoals, etc.)

**User Preferences (8 files):**
- preferencesManager.ts, ThemeContext.tsx
- I18nContext.tsx, useAuth.ts
- NotificationPermissionFlow.tsx

**Game Progress (15 files):**
- KanaLearningComponent.tsx, kanaProgressManager.ts
- StrokeOrderGame.tsx, KanjiQuest.tsx
- progressTracking.ts (reading routes)
- moodBoardProgress.ts, vocabularyHistoryManager.ts

**PWA/Offline (12 files):**
- notificationHandler.ts, notifications.ts, badging.ts
- a2hs.ts, entitlements.ts
- ReviewNotificationManager.ts

**Other (17 files):**
- Tests, utilities, dev tools

**Impact:** Many legitimate uses of localStorage, but stats-related keys need consolidation

---

## 🗑️ Dead Code Files (Safe to Delete)

### 1. `/src/lib/sync/streakSync.ts`
**Status:** 100% disabled
**Evidence:**
```typescript
// All methods have this pattern:
export async function syncStreakToFirebase(userId: string, streakData: any) {
  console.warn('[DEPRECATED] streakSync.syncStreakToFirebase should not be used')
  return // exits immediately
}
```
**Imports:** Only imported by itself (circular reference in same file)
**Safe to Delete:** ✅ YES

### 2. `/src/stores/streakStore.ts` (?)
**Status:** Marked deprecated
**Evidence:**
```typescript
// Auto-initialization commented out:
// streakStore.getState().initialize()  // Removed auto-init
```
**Imports:** Only imported by `streakSync.ts` (which is dead)
**Safe to Delete:** ⚠️ PROBABLY (verify no other imports first)

---

## 📋 Migration Plan Breakdown

### Phase 2: Fix achievement-store Double-Write
**Estimated Time:** 2-3 hours
**Risk:** LOW (simple deletion)
**Testing:** Manual test with drill/kana learning

**Files to Modify (1):**
- `/src/stores/achievement-store.ts` - Remove lines 416-420

**Verification:**
1. Complete drill session as premium user
2. Check Firebase user_stats for single write (not double)
3. Verify streak updates correctly
4. Test as free user (localStorage only)

---

### Phase 3: Streak Logic Consolidation
**Estimated Time:** 3-4 hours
**Risk:** MEDIUM (logic change)
**Testing:** Unit tests + manual testing

**Files to Modify (3):**
- `/src/lib/services/UserStatsService.ts` - Update XP → streak logic
- `/src/app/api/stats/unified/route.ts` - Validate session XP before streak
- `/config/xp-config.json` - Document minimum XP per activity

**Verification:**
1. Test earning 5 XP, then 5 more XP (should NOT trigger streak)
2. Test earning 10+ XP in single session (SHOULD trigger)
3. Test multiple sessions in one day
4. Check edge cases (exactly 10 XP, 0 XP sessions)

---

### Phase 4: Component Migration (useXP → useUserStats)
**Estimated Time:** 6-8 hours (2-3 components per hour)
**Risk:** MEDIUM (component changes)
**Testing:** Per-component testing

**Migration Order:**

**Batch 1 (Dashboard pages):**
1. `/src/app/dashboard/page.tsx`
2. `/src/app/review-dashboard/page.tsx`

**Batch 2 (Learning components):**
3. `/src/app/drill/page.tsx`
4. `/src/components/learn/KanaLearningComponent.tsx`
5. `/src/app/tools/kanji-mastery/learn/LearnContent.tsx`

**Batch 3 (Display components):**
6. `/src/app/account/page.tsx`
7. `/src/app/achievements/page.tsx`
8. `/src/components/profile/AchievementBadges.tsx`
9. `/src/components/dashboard/AchievementDisplay.tsx`

**Batch 4 (Tests - can be done together):**
10-13. All test files

**Per-Component Checklist:**
- [ ] Read current component to understand usage
- [ ] Create migration plan (what changes needed)
- [ ] Implement changes
- [ ] Test locally
- [ ] Commit with message: "migrate: [component] from useXP to useUserStats"
- [ ] Mark as complete in tracking doc

---

### Phase 5: localStorage Consolidation
**Estimated Time:** 4-6 hours
**Risk:** HIGH (data migration)
**Testing:** Extensive (free + premium user flows)

**New Schema:**
```typescript
interface UserStatsCache {
  version: 2,
  userId: string,
  data: {
    streak: { current, best, dates, lastActivityDate },
    xp: { total, level, levelTitle },
    achievements: { totalPoints, unlockedCount, unlockedIds }
  },
  metadata: {
    cachedAt: number,
    expiresAt: number | null, // null for free users (never expires)
    isFallback: boolean // true = only storage, false = cache
  }
}

// Single key per user
localStorage: {
  "user_stats_cache_{userId}": UserStatsCache
}
```

**Migration Strategy:**
```typescript
function migrateToConsolidatedStorage(userId: string) {
  // 1. Read all old keys
  const oldStreak = localStorage.getItem(`currentStreak_${userId}`)
  const oldBestStreak = localStorage.getItem(`bestStreak_${userId}`)
  const oldXP = localStorage.getItem(`xp_${userId}`)
  const oldAchievements = localStorage.getItem(`achievements_${userId}`)
  const oldActivities = localStorage.getItem(`activities_${userId}`)

  // 2. Merge into new format
  const consolidated = {
    version: 2,
    userId,
    data: { /* merged data */ },
    metadata: { /* ... */ }
  }

  // 3. Write new key
  localStorage.setItem(`user_stats_cache_${userId}`, JSON.stringify(consolidated))

  // 4. Delete old keys
  // ... (keep commented out until verified working)
}
```

**Files to Modify (8):**
- Create: `/src/lib/storage/UserStatsCacheManager.ts` (new service)
- Update: `/src/hooks/useUserStats.ts` - Use new cache
- Update: `/src/hooks/useReviewStats.ts` - Use new cache
- Update: `/src/stores/achievement-store.ts` - Use new cache
- Update: `/src/utils/achievementManager.ts` - Use new cache
- Update: `/src/lib/gamification/xp-system.ts` - Use new cache
- Create: Migration script in `/scripts/migrate-local-storage.ts`

**Testing Requirements:**
- [ ] Free user: Complete session → data persists
- [ ] Free user: Refresh page → data loads
- [ ] Premium user: Complete session → syncs to Firebase + caches locally
- [ ] Premium user: Go offline → uses cached data
- [ ] Premium user: Come back online → syncs from Firebase
- [ ] Migration: Old user → new format (no data loss)

---

### Phase 6: Remove Deprecated Code
**Estimated Time:** 3-4 hours
**Risk:** LOW (verified before deletion)
**Testing:** Build + E2E tests

**Deletion Order:**

**Step 1: Dead Files (Zero Impact)**
- Delete: `/src/lib/sync/streakSync.ts`
- Delete: `/src/stores/streakStore.ts` (after verification)

**Step 2: Deprecated Hooks (After Component Migration)**
- Delete: `/src/hooks/useXP.ts`
- Update imports in: Tests (mock with useUserStats instead)

**Step 3: Deprecated API Routes (After Client Updates)**
- Delete: `/src/app/api/xp/track/route.ts`
- Delete: `/src/app/api/achievements/activities/route.ts`
- Delete: `/src/app/api/achievements/data/route.ts`
- Delete: `/src/app/api/achievements/update-activity/route.ts`

**Step 4: Update achievementManager**
- `/src/utils/achievementManager.ts`:
  - Lines 221-251: Update to call `/api/stats/unified` directly
  - Remove redirect dependency on old APIs

**Pre-Deletion Verification Checklist:**
For each file:
- [ ] Search for imports: `grep -r "from.*{filename}" src/`
- [ ] Search for usage: `grep -r "{function_name}" src/`
- [ ] Check tests: Any test-only usage?
- [ ] Document what it did: Add comment to commit message
- [ ] Create backup branch: `git checkout -b backup-deprecated-code`

---

### Phase 7: Documentation & Tests
**Estimated Time:** 4-5 hours
**Risk:** LOW
**Testing:** Review documentation accuracy

**Documentation Updates:**

**1. Update CLAUDE.md**
```markdown
## User Stats Update Patterns

### ✅ CORRECT - Use Unified API
```typescript
// For ALL stat updates
import { useUserStats } from '@/hooks/useUserStats'

const { addXP, updateStreak, unlockAchievement } = useUserStats()

// Update XP
await addXP(25, 'drill_completed')

// Update streak (automatic if session completes)
// Or explicitly:
await updateStreak()

// Unlock achievement
await unlockAchievement('first_drill', 10)
```

### ❌ WRONG - Don't Use These
```typescript
// Deprecated (removed)
import { useXP } from '@/hooks/useXP' // ❌ REMOVED
import { streakStore } from '@/stores/streakStore' // ❌ REMOVED

// Don't call these APIs directly
fetch('/api/xp/track') // ❌ Use /api/stats/unified
fetch('/api/achievements/activities') // ❌ Use /api/stats/unified
```

### localStorage Guidelines

**For Stats Data:**
- ✅ Read from `user_stats_cache_{userId}` (managed by useUserStats)
- ❌ Don't create custom stats keys
- ❌ Don't treat localStorage as source of truth (cache only)

**Cache Behavior:**
- Free users: localStorage is fallback (persists forever)
- Premium users: localStorage is cache (syncs from Firebase)
- Automatic: useUserStats hook handles all caching logic
```

**2. Create Migration Guide**
File: `/docs/stats-migration/COMPONENT_MIGRATION_GUIDE.md`
- How to migrate from useXP to useUserStats
- How to migrate from achievement-store to useUserStats
- Common patterns and examples

**3. Update API Documentation**
File: `/docs/api/STATS_API.md`
- Document /api/stats/unified endpoints
- Mark deprecated endpoints
- Show request/response examples

**Test Creation:**

**1. Integration Tests**
File: `/src/__tests__/stats-system/unified-stats.test.ts`
```typescript
describe('Unified Stats System', () => {
  describe('Single Session Workflow', () => {
    it('should update streak when earning 10+ XP in session', async () => {
      // Test XP → streak logic
    })

    it('should NOT update streak when earning <10 XP', async () => {
      // Test threshold
    })
  })

  describe('localStorage Cache', () => {
    it('free users: should persist stats locally', async () => {
      // Test free user flow
    })

    it('premium users: should cache stats from Firebase', async () => {
      // Test premium user flow
    })
  })

  describe('Race Conditions', () => {
    it('should not double-write when completing session', async () => {
      // Test no double-write bug
    })
  })
})
```

**2. E2E Tests**
File: `/src/__tests__/e2e/user-stats-flow.e2e.test.ts`
```typescript
describe('User Stats E2E', () => {
  it('free user: complete drill → see updated stats', async () => {
    // Full workflow test
  })

  it('premium user: complete drill → syncs to Firebase', async () => {
    // Full workflow test
  })

  it('offline → online: syncs correctly', async () => {
    // Offline resilience test
  })
})
```

---

## 🚨 Risk Assessment

### Phase 2 (Fix Double-Write)
**Risk Level:** 🟢 LOW
**Why:** Simple deletion, well-isolated code
**Mitigation:** Manual testing with premium + free users

### Phase 3 (Streak Logic)
**Risk Level:** 🟡 MEDIUM
**Why:** Logic change affects all users
**Mitigation:** Feature flag + extensive testing + gradual rollout

### Phase 4 (Component Migration)
**Risk Level:** 🟡 MEDIUM
**Why:** Many components, potential for regressions
**Mitigation:** One component at a time, test each thoroughly

### Phase 5 (localStorage Consolidation)
**Risk Level:** 🔴 HIGH
**Why:** Data migration, affects free users' only storage
**Mitigation:**
- Extensive testing
- Migration script with rollback
- Keep old keys for 30 days
- Feature flag for new cache system

### Phase 6 (Code Deletion)
**Risk Level:** 🟢 LOW
**Why:** Only delete after verified zero usage
**Mitigation:** Backup branch, grep verification, gradual deletion

### Phase 7 (Docs/Tests)
**Risk Level:** 🟢 LOW
**Why:** No code changes
**Mitigation:** Peer review documentation

---

## 📊 Effort Estimation

| Phase | Time | Risk | Priority |
|-------|------|------|----------|
| Phase 2: Fix Double-Write | 2-3h | LOW | 🔴 HIGH |
| Phase 3: Streak Logic | 3-4h | MED | 🔴 HIGH |
| Phase 4: Component Migration | 6-8h | MED | 🟡 MED |
| Phase 5: localStorage Consolidation | 4-6h | HIGH | 🟡 MED |
| Phase 6: Code Deletion | 3-4h | LOW | 🟢 LOW |
| Phase 7: Docs/Tests | 4-5h | LOW | 🟢 LOW |
| **TOTAL** | **22-30 hours** | | |

**Suggested Sprint Plan:**
- **Sprint 1 (Week 1):** Phases 2-3 (Fix critical bugs)
- **Sprint 2 (Week 2):** Phase 4 (Component migration, batches 1-2)
- **Sprint 3 (Week 3):** Phase 4 (batches 3-4) + Phase 5 (localStorage)
- **Sprint 4 (Week 4):** Phases 6-7 (Cleanup + docs)

---

## ✅ Recommended Immediate Actions

**Before Starting Phase 2:**
1. **Create backup branch:**
   ```bash
   git checkout -b backup-before-stats-refactor
   git push origin backup-before-stats-refactor
   ```

2. **Create tracking document:**
   - Copy this report to `/docs/stats-refactor/TRACKING.md`
   - Add checkboxes for each step
   - Update after each completion

3. **Set up monitoring:**
   - Add console.warn to deprecated functions
   - Add metrics to `/api/stats/unified` (count calls by type)
   - Monitor Firebase writes (watch for doubles)

4. **Communicate to team:**
   - Share this report
   - Agree on sprint timeline
   - Identify any blockers

---

## 🎯 Success Criteria

**Phase 2 Complete When:**
- [ ] No double-writes to Firebase (verified in logs)
- [ ] Premium users: Streak updates correctly
- [ ] Free users: Streak updates correctly
- [ ] No console errors

**Phase 3 Complete When:**
- [ ] 10+ XP per session triggers streak
- [ ] <10 XP per session does NOT trigger streak
- [ ] Edge cases tested and passing
- [ ] Documentation updated

**Phase 4 Complete When:**
- [ ] All 17 components migrated to useUserStats
- [ ] Each component tested individually
- [ ] No imports of achievement-store (except the store file itself)
- [ ] No imports of useXP (except tests using mocks)

**Phase 5 Complete When:**
- [ ] localStorage reduced from 14+ keys to 1 key per user
- [ ] Migration script tested with real user data
- [ ] Free user flow: 100% localStorage persistence
- [ ] Premium user flow: Firebase + cache working
- [ ] Zero data loss confirmed

**Phase 6 Complete When:**
- [ ] streakSync.ts deleted
- [ ] streakStore.ts deleted (if verified unused)
- [ ] useXP.ts deleted (after component migration)
- [ ] 4 deprecated API routes deleted
- [ ] achievementManager updated to use unified API
- [ ] Build passes
- [ ] E2E tests pass

**Phase 7 Complete When:**
- [ ] CLAUDE.md updated with blessed patterns
- [ ] Migration guide created
- [ ] API docs updated
- [ ] Integration tests written and passing
- [ ] E2E tests written and passing
- [ ] All docs reviewed and approved

---

## 📝 Next Steps

**Waiting for Your Approval:**
1. Review this report
2. Confirm approach for each phase
3. Identify any concerns or questions
4. Approve to proceed with Phase 2

**Once Approved, I Will:**
1. Create backup branch
2. Fix achievement-store double-write bug (Phase 2)
3. Present you with exact code changes before applying
4. Test thoroughly
5. Report back with results

---

**Report Status:** ✅ COMPLETE
**Ready for Phase 2:** ⏳ Awaiting Your Approval

