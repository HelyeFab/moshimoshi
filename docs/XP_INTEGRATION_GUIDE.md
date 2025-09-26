# XP Integration Guide for Moshimoshi Features

> ⚠️ **UPDATE (2025-01-26)**: This document has been updated to use the new unified stats system. For details, see [User Stats Migration Documentation](/docs/user-stats-migration/README.md).

## Overview
This document provides the definitive guide for integrating XP (Experience Points) into new and existing features. All XP awards MUST go through the unified stats system to maintain a single source of truth.

## Core Principles
1. **Single Source of Truth**: All XP flows through `/api/stats/unified` endpoint
2. **Idempotency**: Each XP award must have a unique identifier
3. **Source Tracking**: Every XP award must identify its origin
4. **User Context**: XP can only be awarded to authenticated users

## XP Award Types

### Standard Event Types
```typescript
type XPEventType =
  | 'review_completed'      // Review session finished
  | 'drill_completed'        // Drill session finished
  | 'achievement_unlocked'   // Achievement earned
  | 'streak_bonus'          // Streak milestone reached
  | 'perfect_session'       // 100% accuracy session
  | 'speed_bonus'           // Fast completion bonus
  | 'daily_bonus'           // Daily activity bonus
  | 'lesson_completed'      // Lesson finished
  | 'quiz_completed'        // Quiz finished
  | 'milestone_reached'     // Learning milestone
```

## Integration Guide

### 1. Basic XP Award (Client-Side)

**Use the `useUserStats` hook for all client-side XP awards:**

```typescript
import { useUserStats } from '@/hooks/useUserStats'

export function YourFeatureComponent() {
  const { addXP } = useUserStats()

  const handleFeatureComplete = async () => {
    // Award XP through unified stats
    await addXP(50, {
      source: 'Japanese Basics Lesson',
      eventType: 'lesson_completed',
      metadata: {
        // Required: Idempotency key (use session/activity ID)
        idempotencyKey: `lesson_${lessonId}_${timestamp}`,

        // Required: Feature that awarded XP
        feature: 'lessons',

        // Optional: Additional metadata
        lessonId: lessonId,
        duration: completionTime,
        accuracy: accuracyPercentage
      }
    })
  }
}
```

### 2. Session-Based XP (Review/Drill/Quiz)

**For session-based activities, include session context:**

```typescript
const completeSession = async () => {
  const sessionId = session.id // Your session ID
  const accuracy = calculateAccuracy()

  // Calculate XP based on performance
  let xpAmount = 25 // Base XP

  if (accuracy === 100) {
    xpAmount += 50 // Perfect bonus
  } else if (accuracy >= 90) {
    xpAmount += 30
  } else if (accuracy >= 80) {
    xpAmount += 20
  } else if (accuracy >= 70) {
    xpAmount += 10
  }

  // Award with session context using unified stats
  const { addXP } = useUserStats()

  await addXP(xpAmount, {
    source: 'Kanji Review Session',
    eventType: 'review_completed',
    metadata: {
      idempotencyKey: `session_${sessionId}`,
      feature: 'review',
      sessionId: sessionId,
      contentType: 'kanji',
      itemsReviewed: 20,
      correctAnswers: 18,
      accuracy: accuracy,
      duration: sessionDuration
    }
  })
}
```

### 3. Achievement XP

**When unlocking achievements:**

```typescript
const unlockAchievement = async (achievement: Achievement) => {
  const { addXP } = useUserStats()

  // Use achievement ID as idempotency key
  await addXP(achievement.xpReward, {
    source: achievement.name,
    eventType: 'achievement_unlocked',
    metadata: {
      idempotencyKey: `achievement_${achievement.id}_${userId}`,
      feature: 'achievements',
      achievementId: achievement.id,
      achievementCategory: achievement.category,
      rarity: achievement.rarity
    }
  })
}
```

### 4. Streak Bonus XP

```typescript
const awardStreakBonus = async (streakDays: number) => {
  const { addXP } = useUserStats()
  const xpAmount = calculateStreakBonus(streakDays)

  await addXP(xpAmount, {
    source: `${streakDays} Day Streak`,
    eventType: 'streak_bonus',
    metadata: {
      idempotencyKey: `streak_${streakDays}_${dateString}`,
      feature: 'streaks',
      streakDays: streakDays,
      milestone: getStreakMilestone(streakDays)
    }
  })
}

function calculateStreakBonus(days: number): number {
  if (days < 3) return 0
  if (days < 7) return 10
  if (days < 14) return 25
  if (days < 30) return 50
  if (days < 60) return 75
  if (days < 100) return 100
  return 150
}
```

### 5. Server-Side XP Award

**For server-side features, use the unified API or UserStatsService:**

```typescript
// Option 1: Call unified API endpoint
async function awardXPServerSide(
  userId: string,
  xpData: {
    eventType: string
    amount: number
    source: string
    metadata: any
  }
) {
  const response = await fetch(`${baseUrl}/api/stats/unified`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Include auth headers as needed
    },
    body: JSON.stringify({
      type: 'xp',
      data: {
        add: xpData.amount,
        source: xpData.source,
        metadata: xpData.metadata
      }
    })
  })

  if (!response.ok) {
    throw new Error('Failed to award XP')
  }

  return await response.json()
}

// Option 2: Use UserStatsService directly (server-side only)
import { UserStatsService } from '@/lib/services/UserStatsService'

async function awardXPDirectly(userId: string, amount: number, metadata: any) {
  const service = UserStatsService.getInstance()

  // Check idempotency if needed
  const stats = await service.getUserStats(userId)

  // Add XP through the service
  await service.addXP(userId, amount, metadata)

  return { success: true, xpAwarded: amount }
}
```

## XP Calculation Guidelines

### Base XP Values
```typescript
const XP_VALUES = {
  // Session completion
  SESSION_BASE: 25,

  // Accuracy bonuses
  PERFECT_BONUS: 50,    // 100% accuracy
  EXCELLENT_BONUS: 30,  // 90-99% accuracy
  GOOD_BONUS: 20,       // 80-89% accuracy
  FAIR_BONUS: 10,       // 70-79% accuracy

  // Speed bonuses
  LIGHTNING_SPEED: 30,  // <2s avg response
  FAST_SPEED: 20,       // 2-3s avg response
  NORMAL_SPEED: 10,     // 3-5s avg response

  // Achievement XP (by rarity)
  COMMON_ACHIEVEMENT: 25,
  UNCOMMON_ACHIEVEMENT: 50,
  RARE_ACHIEVEMENT: 100,
  EPIC_ACHIEVEMENT: 200,
  LEGENDARY_ACHIEVEMENT: 500,

  // Special bonuses
  DAILY_LOGIN: 10,
  WEEKLY_GOAL: 100,
  MONTHLY_CHALLENGE: 500
}
```

### XP Multipliers (Premium Users)
```typescript
function getXPMultiplier(userLevel: number, isPremium: boolean): number {
  let multiplier = 1.0

  // Premium base bonus
  if (isPremium) {
    multiplier = 1.1 // 10% bonus for premium
  }

  // Level-based multipliers (stacks with premium)
  if (userLevel >= 20) multiplier *= 1.1
  if (userLevel >= 40) multiplier *= 1.1  // Total 1.2x
  if (userLevel >= 70) multiplier *= 1.1  // Total 1.3x

  return multiplier
}
```

## Required Metadata Fields

Every XP award MUST include:

```typescript
interface RequiredXPMetadata {
  idempotencyKey: string  // Unique identifier for this XP award
  feature: string         // Feature that awarded XP (e.g., 'drill', 'review', 'lessons')
  timestamp?: number      // When the XP was earned (auto-added if not provided)
}
```

## Testing XP Integration

```typescript
// Test helper for XP integration
export async function testXPAward() {
  const { addXP } = useUserStats()

  // Test idempotency
  const testKey = `test_${Date.now()}`

  // First award should succeed
  const result1 = await addXP(100, {
    source: 'Test Review',
    eventType: 'review_completed',
    metadata: {
      idempotencyKey: testKey,
      feature: 'test'
    }
  })

  // Second award with same key should be ignored
  const result2 = await addXP(100, {
    source: 'Test Review',
    eventType: 'review_completed',
    metadata: {
      idempotencyKey: testKey,
      feature: 'test'
    }
  })

  // Verify only one award was processed
  console.assert(result1.xpAwarded === 100)
  console.assert(result2.xpAwarded === 0) // Should be 0 or undefined
}
```

## Common Mistakes to Avoid

### ❌ DON'T: Award XP without idempotency key
```typescript
// BAD - Can result in duplicate XP
await addXP(50, { source: 'Review' })
```

### ✅ DO: Always include idempotency key
```typescript
// GOOD - Prevents duplicates
await addXP(50, {
  source: 'Review',
  eventType: 'review_completed',
  metadata: {
    idempotencyKey: `review_${sessionId}`,
    feature: 'review'
  }
})
```

### ❌ DON'T: Calculate XP in multiple places
```typescript
// BAD - Inconsistent XP calculations
const xp = accuracy > 90 ? 100 : 50 // Don't do this everywhere
```

### ✅ DO: Use centralized calculation
```typescript
// GOOD - Use the XPSystem class
import { xpSystem } from '@/lib/gamification/xp-system'
const xp = xpSystem.calculateSessionXP(session)
```

### ❌ DON'T: Store XP in multiple locations
```typescript
// BAD - Multiple sources of truth
localStorage.setItem('userXP', totalXP)
updateDatabase('xp', totalXP)
setState(totalXP)
```

### ✅ DO: Use unified stats system
```typescript
// GOOD - Single source of truth
await addXP(...) // This goes through unified stats
```

## Debugging XP Issues

### Check XP History
```typescript
// Get user's XP from unified stats
import { UserStatsService } from '@/lib/services/UserStatsService'

const service = UserStatsService.getInstance()
const stats = await service.getUserStats(userId)

console.log({
  totalXP: stats.xp.total,
  currentLevel: stats.xp.level,
  weeklyXP: stats.xp.weeklyXP,
  monthlyXP: stats.xp.monthlyXP,
  lastUpdated: stats.metadata.lastUpdated
})

// For detailed history, check the XP events in your app logs
// or implement a separate audit log if needed
```

### Monitor XP Events
```typescript
// Listen for XP events in development
if (process.env.NODE_ENV === 'development') {
  window.addEventListener('xpGained', (event: CustomEvent) => {
    console.log('XP Gained:', {
      amount: event.detail.xpGained,
      total: event.detail.totalXP,
      source: event.detail.source,
      feature: event.detail.metadata?.feature
    })
  })
}
```

## Summary

1. **Always use `useUserStats().addXP()`** for client-side XP awards
2. **Always include `idempotencyKey`** in metadata to prevent duplicates
3. **Always specify `feature`** in metadata for tracking and debugging
4. **Never store XP** outside the unified stats system
5. **Never calculate XP** without using the standard formulas
6. **Use `/api/stats/unified`** for all server-side XP operations

By following this guide, all new features will properly integrate with the XP system while maintaining data integrity and preventing duplicate awards.