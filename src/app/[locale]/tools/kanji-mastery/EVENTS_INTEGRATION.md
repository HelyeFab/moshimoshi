# Kanji Mastery Events Integration Guide

This guide explains how to integrate with Kanji Mastery events for external services like gamification, analytics, or achievement tracking.

## Event System Overview

The Kanji Mastery feature emits events at key points during the learning flow:

1. **`round1:complete`** - When a user completes learning a kanji (Round 1)
2. **`round2:complete`** - When a user completes testing on a kanji (Round 2)
3. **`round3:complete`** - When a user completes self-assessment (Round 3)
4. **`session:complete`** - When an entire session is completed

## Quick Start

### Basic Event Listener

```typescript
import { kanjiMasteryEvents } from '@/app/[locale]/tools/kanji-mastery/events'

// Listen to session completion
kanjiMasteryEvents.on('session:complete', async (data) => {
  console.log(`Session ${data.sessionId} completed!`)
  console.log(`User ${data.userId} learned ${data.sessionStats.totalKanji} kanji`)
  console.log(`Average accuracy: ${(data.sessionStats.averageAccuracy * 100).toFixed(1)}%`)
})
```

### Gamification Integration Example

```typescript
import { kanjiMasteryEvents } from '@/app/[locale]/tools/kanji-mastery/events'
import { trackXP, updateStreak, checkAchievements } from '@/services/gamification'

// Round 1: Award XP for completing learning phase
kanjiMasteryEvents.on('round1:complete', async (data) => {
  await trackXP(data.userId, {
    action: 'kanji_learned',
    amount: 5,
    metadata: { kanji: data.kanji }
  })
})

// Round 2: Award XP based on test performance
kanjiMasteryEvents.on('round2:complete', async (data) => {
  const baseXP = 10
  const bonusXP = data.correctCount * 5

  await trackXP(data.userId, {
    action: 'kanji_test_complete',
    amount: baseXP + bonusXP,
    metadata: {
      kanji: data.kanji,
      accuracy: data.accuracy,
      correctCount: data.correctCount,
      totalTests: data.totalTests
    }
  })
})

// Round 3: Award XP based on self-assessment
kanjiMasteryEvents.on('round3:complete', async (data) => {
  const xp = data.rating * 3 // 3-15 XP based on rating (1-5)

  await trackXP(data.userId, {
    action: 'kanji_self_assessed',
    amount: xp,
    metadata: {
      kanji: data.kanji,
      rating: data.rating,
      accuracy: data.accuracy
    }
  })
})

// Session: Update streak and check for achievements
kanjiMasteryEvents.on('session:complete', async (data) => {
  // Update daily streak
  await updateStreak(data.userId, 'kanji_mastery')

  // Check for achievements
  await checkAchievements(data.userId, {
    type: 'kanji_mastery_session',
    totalKanji: data.sessionStats.totalKanji,
    perfectKanji: data.sessionStats.perfectKanji,
    averageAccuracy: data.sessionStats.averageAccuracy,
    isPerfectSession: data.sessionStats.averageAccuracy === 1,
    isSpeedSession: data.sessionStats.timeSpentSeconds < 600
  })
})
```

## Event Data Structures

### Round 1 Complete Event

```typescript
interface RoundCompleteEvent {
  userId: string        // User ID
  kanjiId: string      // Kanji character (same as kanji)
  kanji: string        // Kanji character
  round: 1             // Round number
  timestamp: number    // Unix timestamp
}
```

### Round 2 Complete Event

```typescript
interface Round2CompleteEvent {
  userId: string
  kanjiId: string
  kanji: string
  round: 2
  results: Array<{
    type: string       // 'meaning' | 'onyomi' | 'kunyomi' | 'recognition'
    correct: boolean
    userAnswer?: string
  }>
  correctCount: number // Number of correct answers
  totalTests: number   // Total number of tests (3-4)
  accuracy: number     // 0-1 decimal (e.g., 0.75 = 75%)
  timestamp: number
}
```

### Round 3 Complete Event

```typescript
interface Round3CompleteEvent {
  userId: string
  kanjiId: string
  kanji: string
  round: 3
  rating: number       // 1-5 self-assessment rating
  accuracy: number     // 0-1 decimal from Round 2
  timestamp: number
}
```

### Session Complete Event

```typescript
interface SessionCompleteEvent {
  sessionId: string
  userId: string
  kanji: Array<{
    id: string
    character: string
    finalScore: number  // 0-1 weighted score
  }>
  sessionStats: {
    totalKanji: number
    perfectKanji: number        // Kanji with 100% accuracy and 4+ rating
    reviewAgainCount: number    // Kanji with <70% accuracy
    averageAccuracy: number     // 0-1 decimal
    timeSpentSeconds: number
  }
  isPremium: boolean
  timestamp: number
}
```

## Advanced Usage

### Unsubscribing from Events

```typescript
const unsubscribe = kanjiMasteryEvents.on('session:complete', handler)

// Later, when you want to stop listening:
unsubscribe()
```

### Error Handling

Event listeners should handle their own errors. The event system will catch and log errors to prevent one listener from breaking others:

```typescript
kanjiMasteryEvents.on('session:complete', async (data) => {
  try {
    await sendAnalytics(data)
  } catch (error) {
    console.error('Failed to send analytics:', error)
    // Error is caught, other listeners will still execute
  }
})
```

### Multiple Listeners

You can register multiple listeners for the same event:

```typescript
// Listener 1: Track XP
kanjiMasteryEvents.on('session:complete', trackXPHandler)

// Listener 2: Send analytics
kanjiMasteryEvents.on('session:complete', analyticsHandler)

// Listener 3: Update achievements
kanjiMasteryEvents.on('session:complete', achievementsHandler)

// All three will execute in parallel
```

## Integration Patterns

### External Gamification Service

For a completely decoupled gamification service:

```typescript
// services/gamification/kanjiMasteryIntegration.ts

import { kanjiMasteryEvents } from '@/app/[locale]/tools/kanji-mastery/events'
import { GamificationService } from './gamificationService'

export function initializeKanjiMasteryGamification() {
  const gamification = new GamificationService()

  kanjiMasteryEvents.on('round1:complete', async (data) => {
    await gamification.recordActivity({
      userId: data.userId,
      activity: 'kanji_mastery_round',
      timestamp: data.timestamp
    })
  })

  kanjiMasteryEvents.on('session:complete', async (data) => {
    await gamification.recordActivity({
      userId: data.userId,
      activity: 'kanji_mastery_session',
      timestamp: data.timestamp,
      metadata: data.sessionStats
    })
  })
}

// Call this in your app initialization
// app/layout.tsx or similar
initializeKanjiMasteryGamification()
```

### Server-Side Event Processing

You can forward events to a server endpoint:

```typescript
kanjiMasteryEvents.on('session:complete', async (data) => {
  await fetch('/api/gamification/kanji-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
})
```

## Best Practices

1. **Keep listeners fast**: Listeners run during the user flow, so avoid blocking operations
2. **Use async/await**: Event handlers can be async for API calls
3. **Handle errors gracefully**: Don't let one service failure break the learning flow
4. **Avoid side effects in listeners**: Keep them focused on external integration only
5. **Clean up listeners**: Unsubscribe when components unmount if using in React components

## Migration from Old Gamification Code

If you're migrating from the old inline gamification:

```typescript
// OLD (removed):
// await trackXP('kanji_round_2', xp, 'Kanji Round 2', {...})

// NEW:
kanjiMasteryEvents.on('round2:complete', async (data) => {
  const xp = 10 + (data.correctCount * 5)
  await trackXP(data.userId, {
    action: 'kanji_round_2',
    amount: xp,
    description: 'Kanji Round 2',
    metadata: {
      correct: data.correctCount,
      total: data.totalTests
    }
  })
})
```

## Testing

You can test event emissions using the event system directly:

```typescript
import { kanjiMasteryEvents } from '@/app/[locale]/tools/kanji-mastery/events'

// In your test
const received: any[] = []
kanjiMasteryEvents.on('session:complete', (data) => {
  received.push(data)
})

// Trigger your session completion
// ...

expect(received).toHaveLength(1)
expect(received[0].sessionStats.totalKanji).toBe(5)
```
