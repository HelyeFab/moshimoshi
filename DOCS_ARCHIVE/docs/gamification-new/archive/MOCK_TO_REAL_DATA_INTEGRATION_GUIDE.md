# Mock to Real Data Integration Guide

**Date**: 2025-10-02
**Project**: Moshimoshi - Japanese Learning Platform
**Purpose**: Document all connection points where mock data needs to be replaced with real user data

---

## Overview

This document outlines all the connection points where mock data is currently being used and how to integrate real user data when ready. The mock data approach was used to maintain route functionality (`/achievements` and `/leaderboard`) while removing the gamification infrastructure.

---

## Current Mock Implementation

### Mock Data Files

1. **`src/mocks/achievements.mock.ts`**
   - 20 hardcoded achievements
   - Mock helper functions
   - No user-specific data

2. **`src/mocks/leaderboard.mock.ts`**
   - 50 fake leaderboard entries
   - Mock current user stats
   - No real ranking logic

---

## Integration Points

### 1. Achievements Page (`/achievements`)

**File**: `src/app/achievements/page.tsx`

#### Current Mock Implementation
```typescript
import {
  MOCK_ACHIEVEMENTS,
  getMockAchievementStats,
  getMockAchievementsByCategory,
  getMockUnlockedAchievements
} from '@/mocks/achievements.mock'

// Static data
const allAchievements = MOCK_ACHIEVEMENTS
const stats = getMockAchievementStats()
const achievementsByCategory = getMockAchievementsByCategory()
const unlockedAchievements = getMockUnlockedAchievements()
```

#### Real Data Integration Steps

**Step 1: Create User Achievement API Route**
```typescript
// src/app/api/user/achievements/route.ts
import { getSession } from '@/lib/auth/session'
import { adminFirestore } from '@/lib/firebase/admin'

export async function GET(request: Request) {
  const session = await getSession()
  const userId = session?.uid

  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch user's unlocked achievements
  const userAchievementsRef = adminFirestore
    .collection('users')
    .doc(userId)
    .collection('achievements')

  const snapshot = await userAchievementsRef.get()
  const unlockedAchievements = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    unlockedAt: doc.data().unlockedAt?.toDate()
  }))

  // Fetch all available achievements (from static config or Firestore)
  const allAchievementsRef = adminFirestore.collection('achievementDefinitions')
  const allSnapshot = await allAchievementsRef.get()
  const allAchievements = allSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))

  // Calculate stats
  const stats = {
    totalAchievements: allAchievements.length,
    unlockedCount: unlockedAchievements.length,
    totalPoints: unlockedAchievements.reduce((sum, a) => sum + (a.points || 0), 0),
    completionPercentage: (unlockedAchievements.length / allAchievements.length) * 100
  }

  return Response.json({
    success: true,
    data: {
      allAchievements,
      unlockedAchievements,
      stats
    }
  })
}
```

**Step 2: Update Achievements Page Component**
```typescript
// src/app/achievements/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  points: number
  category: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  unlocked: boolean
  unlockedAt?: Date
}

export default function AchievementsPage() {
  const { user } = useAuth()
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [stats, setStats] = useState({ totalPoints: 0, unlockedCount: 0, totalAchievements: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAchievements() {
      if (!user) return

      try {
        const response = await fetch('/api/user/achievements')
        const data = await response.json()

        if (data.success) {
          setAchievements(data.data.allAchievements)
          setStats(data.data.stats)
        }
      } catch (error) {
        console.error('Failed to fetch achievements:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAchievements()
  }, [user])

  // ... rest of component
}
```

**Step 3: Firestore Schema**
```
users/{userId}/achievements/{achievementId}
  - unlockedAt: timestamp
  - points: number
  - progress?: number (for multi-step achievements)

achievementDefinitions/{achievementId}
  - name: string
  - description: string
  - icon: string
  - points: number
  - category: string
  - rarity: string
  - requirements: {
      type: string (e.g., 'review_count', 'streak_days', 'kanji_learned')
      target: number
    }
```

---

### 2. Leaderboard Page (`/leaderboard`)

**File**: `src/app/leaderboard/page.tsx`

#### Current Mock Implementation
```typescript
import {
  MOCK_LEADERBOARD,
  MOCK_CURRENT_USER_STATS,
  getMockLeaderboard
} from '@/mocks/leaderboard.mock'

// Static data
const leaderboardData = getMockLeaderboard(50)
const userStats = MOCK_CURRENT_USER_STATS
```

#### Real Data Integration Steps

**Step 1: Create Leaderboard API Route**
```typescript
// src/app/api/leaderboard/route.ts
import { getSession } from '@/lib/auth/session'
import { adminFirestore } from '@/lib/firebase/admin'

export async function GET(request: Request) {
  const session = await getSession()
  const userId = session?.uid

  const { searchParams } = new URL(request.url)
  const timeframe = searchParams.get('timeframe') || 'all' // all, weekly, monthly
  const limit = parseInt(searchParams.get('limit') || '50')

  // Fetch leaderboard data
  let query = adminFirestore.collection('leaderboard')

  if (timeframe !== 'all') {
    query = query.where('period', '==', timeframe)
  }

  const snapshot = await query
    .orderBy('score', 'desc')
    .limit(limit)
    .get()

  const leaderboard = snapshot.docs.map((doc, index) => ({
    rank: index + 1,
    userId: doc.id,
    displayName: doc.data().displayName,
    photoURL: doc.data().photoURL,
    score: doc.data().score,
    streak: doc.data().streak,
    level: doc.data().level
  }))

  // Fetch current user's stats if logged in
  let userStats = null
  if (userId) {
    const userDoc = await adminFirestore
      .collection('leaderboard')
      .doc(userId)
      .get()

    if (userDoc.exists) {
      const userData = userDoc.data()

      // Find user's rank
      const userRankQuery = await adminFirestore
        .collection('leaderboard')
        .where('score', '>', userData.score)
        .get()

      userStats = {
        rank: userRankQuery.size + 1,
        score: userData.score,
        streak: userData.streak,
        level: userData.level
      }
    }
  }

  return Response.json({
    success: true,
    data: {
      leaderboard,
      userStats,
      timeframe,
      lastUpdated: new Date().toISOString()
    }
  })
}
```

**Step 2: Update Leaderboard Page Component**
```typescript
// src/app/leaderboard/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

interface LeaderboardEntry {
  rank: number
  userId: string
  displayName: string
  photoURL?: string
  score: number
  streak: number
  level: number
}

export default function LeaderboardPage() {
  const { user } = useAuth()
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [userStats, setUserStats] = useState(null)
  const [timeframe, setTimeframe] = useState<'all' | 'weekly' | 'monthly'>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const response = await fetch(`/api/leaderboard?timeframe=${timeframe}&limit=50`)
        const data = await response.json()

        if (data.success) {
          setLeaderboard(data.data.leaderboard)
          setUserStats(data.data.userStats)
        }
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchLeaderboard()
  }, [timeframe])

  // ... rest of component
}
```

**Step 3: Firestore Schema**
```
leaderboard/{userId}
  - displayName: string
  - photoURL: string
  - score: number (calculated from XP, reviews, etc.)
  - streak: number
  - level: number
  - lastUpdated: timestamp
  - period: string ('all', 'weekly', 'monthly')

leaderboardArchive/{period}/{userId}
  - [same as above, for historical data]
```

**Step 4: Create Leaderboard Update Function**
```typescript
// src/lib/leaderboard/updateLeaderboard.ts
import { adminFirestore } from '@/lib/firebase/admin'

export async function updateUserLeaderboard(userId: string) {
  // Fetch user's current stats
  const userDoc = await adminFirestore
    .collection('users')
    .doc(userId)
    .get()

  const userData = userDoc.data()
  if (!userData) return

  // Calculate score (customize this formula)
  const score =
    (userData.totalXP || 0) +
    (userData.totalReviews || 0) * 10 +
    (userData.currentStreak || 0) * 50 +
    (userData.kanjiLearned || 0) * 5

  // Update leaderboard entry
  await adminFirestore
    .collection('leaderboard')
    .doc(userId)
    .set({
      displayName: userData.displayName || 'Anonymous',
      photoURL: userData.photoURL || null,
      score,
      streak: userData.currentStreak || 0,
      level: userData.level || 1,
      lastUpdated: new Date(),
      period: 'all'
    }, { merge: true })
}
```

---

## Data Source Mapping

### Where to Get Real User Data

#### 1. **User Profile Data**
- **Current Location**: `users/{userId}` in Firestore
- **Fields Needed**:
  - `displayName`: string
  - `photoURL`: string
  - `email`: string

#### 2. **Learning Progress Data**
- **Kana Progress**: `users/{userId}/kanaProgress/{script}`
  - Use existing `kanaProgressManager`
  - Fields: `learned`, `mastered`, `accuracy`

- **Kanji Progress**: `users/{userId}/kanjiProgress/{kanjiId}`
  - Fields: `learned`, `reviews`, `nextReview`, `accuracy`

- **Review History**: `users/{userId}/reviewSessions/{sessionId}`
  - Fields: `itemsReviewed`, `accuracy`, `duration`, `completedAt`

#### 3. **Activity Tracking**
- **Daily Activity**: `users/{userId}/activityLog/{date}`
  - Fields: `reviewsCompleted`, `itemsLearned`, `studyTime`, `date`

- **Streak Data**: `users/{userId}/streaks/current`
  - Fields: `currentStreak`, `bestStreak`, `lastActivity`

#### 4. **Achievement Progress**
- **Current Progress**: `users/{userId}/achievementProgress/{achievementId}`
  - Fields: `current`, `target`, `percentage`, `lastUpdated`

---

## Integration Checklist

### Phase 1: Data Collection Infrastructure
- [ ] Create API route for user achievements (`/api/user/achievements`)
- [ ] Create API route for leaderboard (`/api/leaderboard`)
- [ ] Create API route for user stats aggregation (`/api/user/stats`)
- [ ] Set up Firestore collections for achievements
- [ ] Set up Firestore collection for leaderboard

### Phase 2: Background Processing
- [ ] Create Cloud Function to calculate leaderboard scores
- [ ] Schedule daily leaderboard updates (00:00 UTC)
- [ ] Create achievement check system (triggers on user activity)
- [ ] Set up streak validation (daily check)

### Phase 3: Frontend Integration
- [ ] Replace mock data in `/achievements` page with API calls
- [ ] Replace mock data in `/leaderboard` page with API calls
- [ ] Add loading states
- [ ] Add error handling
- [ ] Add real-time updates (optional: Firestore listeners)

### Phase 4: Testing & Validation
- [ ] Test achievements unlock flow
- [ ] Test leaderboard ranking accuracy
- [ ] Verify user stats aggregation
- [ ] Load testing (handle 1000+ users)
- [ ] Edge case testing (new users, data migration)

### Phase 5: Migration (If Re-enabling Gamification)
- [ ] Migrate any historical data if available
- [ ] Initialize achievement definitions in Firestore
- [ ] Run initial leaderboard calculation for all users
- [ ] Validate data integrity

---

## API Endpoint Summary

### Achievements
```
GET  /api/user/achievements          - Get user's achievements
POST /api/user/achievements/unlock   - Unlock an achievement (internal)
GET  /api/achievements/definitions   - Get all achievement definitions
```

### Leaderboard
```
GET  /api/leaderboard                - Get leaderboard (with timeframe param)
GET  /api/leaderboard/user/:userId   - Get specific user's rank
POST /api/leaderboard/update         - Update user's leaderboard entry (internal)
```

### User Stats
```
GET  /api/user/stats                 - Get aggregated user statistics
GET  /api/user/stats/achievements    - Get achievement-specific stats
GET  /api/user/stats/activity        - Get activity history
```

---

## Real-Time Updates (Optional Enhancement)

### Using Firestore Listeners

```typescript
// In achievements page
useEffect(() => {
  if (!user?.uid) return

  const unsubscribe = onSnapshot(
    collection(db, 'users', user.uid, 'achievements'),
    (snapshot) => {
      const achievements = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setUnlockedAchievements(achievements)
    }
  )

  return () => unsubscribe()
}, [user])
```

---

## Performance Considerations

### 1. **Caching Strategy**
```typescript
// Cache leaderboard for 5 minutes
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// In API route
const cacheKey = `leaderboard:${timeframe}`
const cached = await redis.get(cacheKey)

if (cached) {
  return Response.json(JSON.parse(cached))
}

// Fetch from Firestore...
await redis.set(cacheKey, JSON.stringify(data), 'EX', CACHE_TTL / 1000)
```

### 2. **Pagination**
```typescript
// Leaderboard pagination
const PAGE_SIZE = 50

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const offset = (page - 1) * PAGE_SIZE

  const query = adminFirestore
    .collection('leaderboard')
    .orderBy('score', 'desc')
    .limit(PAGE_SIZE)
    .offset(offset)

  // ...
}
```

### 3. **Aggregation**
```typescript
// Pre-calculate user stats in a scheduled function
// Instead of calculating on every request

// functions/src/scheduled/aggregateUserStats.ts
export const aggregateUserStats = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async () => {
    const usersSnapshot = await admin.firestore().collection('users').get()

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id

      // Aggregate from various collections
      const stats = await calculateUserStats(userId)

      // Store in aggregated stats collection
      await admin.firestore()
        .collection('userStats')
        .doc(userId)
        .set(stats, { merge: true })
    }
  })
```

---

## Data Flow Diagrams

### Achievement Unlock Flow
```
User Activity → Achievement Check →
  ↓
  Is Requirement Met? →
    Yes → Unlock Achievement →
      ↓
      Update Firestore →
      Update Leaderboard Score →
      Show Notification
    No → Continue
```

### Leaderboard Update Flow
```
User Completes Action →
  ↓
  Calculate Score Impact →
  Update User Stats →
  Trigger Leaderboard Recalculation →
    ↓
    Update leaderboard/{userId} →
    Invalidate Cache →
    Broadcast Update (if real-time)
```

---

## Testing Strategy

### Unit Tests
```typescript
// __tests__/api/achievements.test.ts
describe('GET /api/user/achievements', () => {
  it('should return user achievements', async () => {
    const response = await fetch('/api/user/achievements', {
      headers: { cookie: mockUserSession }
    })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data.allAchievements).toHaveLength(20)
  })

  it('should return 401 for unauthenticated users', async () => {
    const response = await fetch('/api/user/achievements')
    expect(response.status).toBe(401)
  })
})
```

### Integration Tests
```typescript
// __tests__/integration/leaderboard.test.ts
describe('Leaderboard Integration', () => {
  it('should update leaderboard when user completes review', async () => {
    // Complete a review session
    await completeReviewSession(testUserId, { accuracy: 95, itemsReviewed: 50 })

    // Check leaderboard was updated
    const leaderboard = await fetchLeaderboard()
    const userEntry = leaderboard.find(e => e.userId === testUserId)

    expect(userEntry.score).toBeGreaterThan(initialScore)
  })
})
```

---

## Migration Script (If Needed)

If you need to migrate from mock data to real data for existing users:

```typescript
// scripts/migrate-to-real-achievements.ts
import { adminFirestore } from '@/lib/firebase/admin'

async function migrateAchievements() {
  // 1. Load achievement definitions
  const achievementDefs = await loadAchievementDefinitions()

  // 2. Create achievementDefinitions collection
  for (const achievement of achievementDefs) {
    await adminFirestore
      .collection('achievementDefinitions')
      .doc(achievement.id)
      .set(achievement)
  }

  // 3. For each user, check which achievements they should have
  const users = await adminFirestore.collection('users').get()

  for (const userDoc of users.docs) {
    const userId = userDoc.id
    const userData = userDoc.data()

    // Check achievements based on user's actual progress
    const unlockedAchievements = await checkAchievementsForUser(userId, userData)

    // Store unlocked achievements
    for (const achievement of unlockedAchievements) {
      await adminFirestore
        .collection('users')
        .doc(userId)
        .collection('achievements')
        .doc(achievement.id)
        .set({
          unlockedAt: achievement.unlockedAt,
          points: achievement.points
        })
    }
  }

  console.log('Migration complete!')
}

migrateAchievements()
```

---

## Summary

### Quick Start Guide

1. **To enable real achievements**:
   - Create `/api/user/achievements` route
   - Update `src/app/achievements/page.tsx` to fetch from API
   - Set up Firestore schema
   - Test with your user account

2. **To enable real leaderboard**:
   - Create `/api/leaderboard` route
   - Update `src/app/leaderboard/page.tsx` to fetch from API
   - Set up Firestore schema
   - Create Cloud Function for score calculation
   - Test with multiple users

3. **Recommended Order**:
   - Start with achievements (simpler, user-specific)
   - Then implement leaderboard (requires aggregation)
   - Add real-time updates last (enhancement)

### Key Files to Modify

- `src/app/achievements/page.tsx` - Remove mock imports, add API calls
- `src/app/leaderboard/page.tsx` - Remove mock imports, add API calls
- Create new API routes in `src/app/api/`
- Optional: Delete mock files after migration

---

**End of Integration Guide**
