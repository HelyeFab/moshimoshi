# User Stats - Firebase Collections

## Overview
Top-level collection storing aggregated user statistics for gamification, leaderboards, and analytics.

## Collections

### `user_stats` (Top-Level)

**Description:** Centralized user statistics for gamification system, XP, achievements, and streaks.

**Access:**
- ✅ All authenticated users (read own only)
- 📍 Location: Top-level collection
- 🔄 Synced from: Gamification system events

**Document Structure:**

```typescript
{
  // Document ID is userId

  // XP System
  xp: {
    total: number                     // Total XP earned
    level: number                     // Current level (calculated from total XP)
    levelTitle: string                // "Beginner" | "Novice" | "Intermediate" | "Advanced" | "Expert" | "Master"
    xpToNextLevel: number             // XP needed for next level
  }

  // Streak System
  streak: {
    current: number                   // Current consecutive days streak
    best: number                      // Best streak ever achieved
  }

  // Activity Dates
  dates: {
    lastActivityDate: string | null   // ISO timestamp of last activity
    isActiveToday: boolean            // Whether user was active today
  }

  // Achievements
  achievements: {
    unlockedIds: string[]             // Array of unlocked achievement IDs
    unlockedCount: number             // Total achievements unlocked
    completionPercentage: number      // Percentage of all achievements unlocked
  }

  // Session Tracking
  sessions: {
    totalSessions: number             // Total learning sessions completed
  }

  // Metadata
  metadata: {
    lastUpdated: string               // ISO timestamp of last update
    syncStatus: 'synced' | 'pending' | 'error'
    dataHealth: 'healthy' | 'degraded' | 'corrupted'
    schemaVersion: number             // Current schema version (2)
  }
}
```

**Example Document:**

```json
{
  "xp": {
    "total": 15680,
    "level": 15,
    "levelTitle": "Intermediate",
    "xpToNextLevel": 320
  },
  "streak": {
    "current": 7,
    "best": 14
  },
  "dates": {
    "lastActivityDate": "2025-10-03T14:30:00.000Z",
    "isActiveToday": true
  },
  "achievements": {
    "unlockedIds": [
      "first_session",
      "daily_streak_3",
      "daily_streak_7",
      "perfect_drill",
      "kanji_learner"
    ],
    "unlockedCount": 5,
    "completionPercentage": 12
  },
  "sessions": {
    "totalSessions": 128
  },
  "metadata": {
    "lastUpdated": "2025-10-03T14:30:15.234Z",
    "syncStatus": "synced",
    "dataHealth": "healthy",
    "schemaVersion": 2
  }
}
```

**Firestore Path Example:**
```
user_stats/8onZzlQg3tQxkw8pinSF9ow4Q6j2
```

## XP Level Calculation

**Formula:** `level = Math.floor(totalXP / 1000)`
**XP per level:** 1000 XP

**Level Titles:**
- Level 1-4: "Beginner"
- Level 5-9: "Novice"
- Level 10-24: "Intermediate"
- Level 25-49: "Advanced"
- Level 50-74: "Expert"
- Level 75+: "Master"

## Streak Calculation

**Rules:**
- Activity must occur on consecutive calendar days (UTC timezone)
- Streak increments when user completes any learning session
- Streak resets to 0 if more than 24 hours pass without activity
- `bestStreak` tracks the highest streak ever achieved

**Streak Updates Triggered By:**
- Review session completion
- Study session completion
- Drill completion
- Any learning activity tracked by gamification system

## API Endpoints

### POST `/api/gamification/sync`
Sync gamification data from client to Firebase

**Request:**
```json
{
  "totalXP": 15680,
  "currentStreak": 7,
  "bestStreak": 14,
  "lastActivityDate": "2025-10-03T14:30:00.000Z",
  "unlockedAchievements": ["first_session", "daily_streak_3"],
  "achievementProgress": {},
  "sessionCount": 128
}
```

**Response:**
```json
{
  "success": true,
  "syncedAt": "2025-10-03T14:30:15.234Z"
}
```

**File:** `/src/app/api/gamification/sync/route.ts`

### GET `/api/review/stats`
Get user review statistics (reads from user_stats)

**File:** `/src/app/api/review/stats/route.ts`

## Queries & Indexes

### Required Indexes
```
Collection: user_stats
- xp.total (desc) - For leaderboards
- streak.current (desc) - For streak leaderboards
- sessions.totalSessions (desc) - For session rankings
- metadata.lastUpdated (desc) - For activity tracking
```

### Query Examples

**Get user stats:**
```javascript
const userStats = await adminDb
  .collection('user_stats')
  .doc(userId)
  .get();

const data = userStats.data();
```

**Top XP earners (leaderboard):**
```javascript
const topUsers = await adminDb
  .collection('user_stats')
  .orderBy('xp.total', 'desc')
  .limit(100)
  .get();
```

**Current streak leaderboard:**
```javascript
const streakLeaders = await adminDb
  .collection('user_stats')
  .where('streak.current', '>', 0)
  .orderBy('streak.current', 'desc')
  .limit(50)
  .get();
```

**Recently active users:**
```javascript
const activeUsers = await adminDb
  .collection('user_stats')
  .where('dates.isActiveToday', '==', true)
  .orderBy('metadata.lastUpdated', 'desc')
  .get();
```

## Related Collections

- **users/{userId}/progress**: Individual content progress
- **users/{userId}/review_history**: Review events that award XP
- **drill_sessions**: Drill completions that award XP
- **users/{userId}/review_sessions**: Sessions that count toward stats

## Related Files

- API Route: `/src/app/api/gamification/sync/route.ts`
- Gamification Hook: `/src/hooks/useGamification.ts`
- State Management: `/src/state/userGamification.ts`
- Config: `/src/config/gamification/`

## Update Triggers

Stats are updated when:
1. **User completes a session** → Update XP, session count
2. **Achievement unlocked** → Update achievement arrays
3. **Daily activity** → Update streak, last activity date
4. **Client syncs** → Full stats sync from IndexedDB

## Storage Strategy

1. **Client-side (Zustand + IndexedDB)**
   - Primary source of truth for active sessions
   - Real-time updates during gameplay
   - Offline support

2. **Firebase (Cloud)**
   - Authoritative source for cross-device sync
   - Leaderboard queries
   - Historical data
   - Premium users get priority sync

## Data Integrity

**Health Checks:**
- `dataHealth` field tracks corruption status
- Automatic repair on schema version mismatch
- Streak validation against activity dates
- XP recalculation when discrepancies detected

**Schema Versioning:**
- Current version: 2
- Migration path documented in gamification system
- Backward compatibility maintained

## Analytics Use Cases

1. **User Engagement:** Track active users via `isActiveToday`
2. **Retention:** Monitor streaks and drop-off patterns
3. **Progression:** Analyze XP gain rates and level distribution
4. **Feature Adoption:** Achievement unlock rates
5. **Leaderboards:** Real-time rankings by XP, streak, sessions

## Privacy & Retention

- Stats are user-specific and private
- Aggregated anonymous data used for analytics
- Retained indefinitely (core engagement data)
- Included in user data export
- Can be reset on user request

## Performance Optimization

- **Indexed fields** for fast leaderboard queries
- **Batch updates** during sync operations
- **Client-side caching** reduces read operations
- **Debounced syncing** prevents excessive writes (1-second debounce)

## Migration Notes

**From Schema v1 to v2:**
- Added `metadata` field
- Restructured achievements as nested object
- Added `dataHealth` tracking
- Split sessions into separate tracking
