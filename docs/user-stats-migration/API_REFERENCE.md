# User Stats API Reference

## Unified Stats API - `/api/stats/unified`

The single endpoint for all user statistics operations.

### GET `/api/stats/unified`
Retrieves all user statistics from the unified `user_stats` collection.

**Response:**
```json
{
  "stats": {
    "userId": "string",
    "streak": {
      "current": 1,
      "best": 5,
      "dates": { "2025-01-26": true },
      "lastActivityDate": "2025-01-26",
      "isActiveToday": true
    },
    "xp": {
      "total": 1500,
      "level": 5,
      "levelProgress": 50,
      "levelTitle": "Intermediate"
    },
    "achievements": {
      "unlockedIds": ["first_lesson", "streak_3"],
      "totalPoints": 150,
      "unlockedCount": 3
    },
    "sessions": {
      "totalSessions": 42,
      "averageAccuracy": 0.85
    },
    "metadata": {
      "schemaVersion": 2,
      "dataHealth": "healthy",
      "lastUpdated": "2025-01-26T10:00:00Z"
    }
  },
  "storage": {
    "location": "firebase",
    "syncEnabled": true
  }
}
```

### POST `/api/stats/unified`
Updates specific statistics. Supports multiple update types.

#### Update Types

##### 1. Session Update
```json
{
  "type": "session",
  "data": {
    "type": "review",
    "itemsReviewed": 20,
    "accuracy": 0.85,
    "duration": 300
  }
}
```

##### 2. Streak Update
```json
{
  "type": "streak",
  "data": {
    "current": 5,
    "dates": { "2025-01-26": true }
  }
}
```

##### 3. XP Update
```json
{
  "type": "xp",
  "data": {
    "total": 1500,
    "level": 5,
    "add": 100  // Optional: add to existing
  }
}
```

##### 4. Achievement Update
```json
{
  "type": "achievement",
  "data": {
    "unlockedIds": ["new_achievement"],
    "totalPoints": 50
  }
}
```

##### 5. Profile Update
```json
{
  "type": "profile",
  "data": {
    "displayName": "User Name",
    "photoURL": "https://example.com/photo.jpg"
  }
}
```

## Deprecated Endpoints (Redirected)

These endpoints are maintained for backward compatibility but redirect to the unified API:

### `/api/achievements/update-activity`
- **Status:** DEPRECATED
- **Redirects to:** `/api/stats/unified`
- **Purpose:** Previously updated streak/activity data

### `/api/achievements/data`
- **Status:** DEPRECATED
- **Redirects to:** `/api/stats/unified`
- **Purpose:** Previously managed achievement data

### `/api/achievements/activities`
- **Status:** DEPRECATED
- **Redirects to:** `/api/stats/unified`
- **Purpose:** Previously managed activity dates

### `/api/leaderboard/update-stats`
- **Status:** DEPRECATED
- **Redirects to:** `/api/stats/unified`
- **Purpose:** Previously updated leaderboard statistics

## Service Classes

### UserStatsService
Location: `/src/lib/services/UserStatsService.ts`

```typescript
// Get user stats
const stats = await UserStatsService.getUserStats(userId)

// Update streak
await UserStatsService.updateStreak(userId, streakData)

// Add XP
await UserStatsService.addXP(userId, points)

// Update achievement
await UserStatsService.updateAchievements(userId, achievementData)

// Record session
await UserStatsService.recordSession(userId, sessionData)
```

## React Hooks

### useUserStats
Location: `/src/hooks/useUserStats.ts`

```typescript
const {
  stats,        // Full stats object
  streak,       // Current streak number
  xp,          // Total XP
  level,       // Current level
  achievements, // Achievement data
  loading,     // Loading state
  error,       // Error state

  // Methods
  updateStreak,
  addXP,
  recordSession,
  refresh
} = useUserStats()
```

## Data Schema

### user_stats Collection
```typescript
interface UserStats {
  userId: string
  displayName?: string
  photoURL?: string
  tier?: 'free' | 'premium'

  streak: {
    current: number
    best: number
    dates: Record<string, boolean>
    lastActivityDate: string
    lastActivityTimestamp: number
    isActiveToday: boolean
  }

  xp: {
    total: number
    level: number
    levelProgress: number
    levelTitle: string
    weeklyXP?: number
    monthlyXP?: number
  }

  achievements: {
    unlockedIds: string[]
    totalPoints: number
    unlockedCount: number
    statistics?: Record<string, any>
  }

  sessions: {
    totalSessions: number
    totalItems: number
    totalDuration: number
    averageAccuracy: number
    lastSessionDate?: string
  }

  metadata: {
    createdAt: string
    lastUpdated: string
    schemaVersion: number
    dataHealth: 'healthy' | 'needs_repair' | 'corrupted'
    migrationHistory?: string[]
  }
}
```

## Error Codes

- `401` - Unauthorized (no session)
- `404` - User stats not found
- `422` - Invalid data format
- `429` - Rate limit exceeded
- `500` - Server error

## Rate Limiting

- XP updates: Batched with 5-second debounce
- Streak updates: Once per day
- Session updates: No limit (each session)
- Profile updates: Max 1 per minute