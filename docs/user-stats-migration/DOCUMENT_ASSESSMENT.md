# Assessment of Existing Documentation

## Document 1: LEADERBOARD_IMPLEMENTATION.md

### ❌ OUTDATED - Requires Major Updates

#### Invalid Sections:

1. **Data Sources (Lines 9-35)** - COMPLETELY OUTDATED
   - Still references old scattered collections:
     - `users/{uid}/achievements/activities`
     - `users/{uid}/stats/xp`
     - `users/{uid}/achievements/data`
   - **Should reference**: Single `user_stats` collection

2. **LeaderboardService Path (Line 38)** - OUTDATED
   - Shows aggregation from multiple collections
   - **Reality**: Now reads from single `user_stats` collection (see LeaderboardService.ts lines 50, 103)

3. **Cloud Functions (Lines 43-46)** - NEEDS VERIFICATION
   - References `leaderboard_stats` collection
   - **Should use**: `user_stats` collection

4. **Scoring Algorithm (Lines 61-81)** - NEEDS UPDATE
   - Still valid logic but data sources are wrong
   - Should reference fields from `user_stats` structure

### Required Updates:
```markdown
# Replace Section "Data Sources" with:

### Data Source (Single Source of Truth)

**All user statistics come from the unified `user_stats` collection:**

- **Collection**: `user_stats/{userId}`
  - streak.current, streak.best, streak.dates
  - xp.total, xp.level, xp.weeklyXP, xp.monthlyXP
  - achievements.totalPoints, achievements.unlockedIds
  - sessions.totalSessions, sessions.averageAccuracy
  - displayName, photoURL, tier (premium/free)
```

---

## Document 2: XP_INTEGRATION_GUIDE.md

### ⚠️ PARTIALLY OUTDATED - Requires Updates

#### Invalid Sections:

1. **API Endpoint Reference (Line 7)** - OUTDATED
   - References `/api/xp/track`
   - **Should reference**: `/api/stats/unified` with `type: 'xp'`

2. **Server-Side Implementation (Lines 161-217)** - OUTDATED
   - Shows direct Firebase writes to scattered collections
   - References `users/{userId}/xp_history` subcollection
   - **Should use**: UserStatsService or unified API

3. **XP History Location (Lines 371-388)** - OUTDATED
   - References `xp_history` subcollection
   - **Should reference**: `user_stats` collection's XP field

#### Still Valid Sections:
- ✅ XP Award Types (Lines 12-27)
- ✅ XP Calculation Guidelines (Lines 221-270)
- ✅ Required Metadata Fields (Lines 272-282)
- ✅ Common Mistakes to Avoid (Lines 323-364)

### Required Updates:

```markdown
# Replace integration examples with:

### 1. Basic XP Award (Using Unified Stats)

import { useUserStats } from '@/hooks/useUserStats'

export function YourFeatureComponent() {
  const { addXP } = useUserStats()

  const handleFeatureComplete = async () => {
    await addXP(50, {
      source: 'Japanese Basics Lesson',
      eventType: 'lesson_completed',
      metadata: {
        lessonId: lessonId,
        duration: completionTime
      }
    })
  }
}

### Server-Side XP Award

// Use the unified API
const response = await fetch(`${baseUrl}/api/stats/unified`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Cookie': request.headers.get('cookie') || ''
  },
  body: JSON.stringify({
    type: 'xp',
    data: {
      add: 50,
      source: 'lesson_completed',
      metadata: { lessonId, timestamp }
    }
  })
})
```

---

## Summary of Required Actions

### LEADERBOARD_IMPLEMENTATION.md
- **Status**: ❌ SEVERELY OUTDATED
- **Priority**: HIGH
- **Action**: Update all data source references to `user_stats` collection
- **Affected Lines**: 9-35, 38-46, 61-81

### XP_INTEGRATION_GUIDE.md
- **Status**: ⚠️ PARTIALLY OUTDATED
- **Priority**: MEDIUM
- **Action**: Update API endpoints and server implementation
- **Affected Lines**: 7, 39-62, 161-217, 371-388
- **Keep**: Calculation guidelines and best practices

### Recommendation
1. Update both documents to reflect the unified stats system
2. Add cross-references to the new `docs/user-stats-migration/` documentation
3. Consider deprecating overlapping sections and linking to the canonical docs