# 🎮 Gamification System - Developer Integration Guide

**Last Updated**: 2025-10-02
**Status**: Production Ready ✅
**Architecture**: Event-Driven, Config-Based, Offline-First

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Architecture Overview](#architecture-overview)
3. [How to Use Gamification in Your Feature](#how-to-use-gamification-in-your-feature)
4. [Available Hooks & Components](#available-hooks--components)
5. [Configuration System](#configuration-system)
6. [Event System](#event-system)
7. [Common Integration Patterns](#common-integration-patterns)
8. [Testing Your Integration](#testing-your-integration)
9. [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start

### Enable Gamification

Set the feature flag in `.env.local`:
```bash
NEXT_PUBLIC_ENABLE_GAMIFICATION=true
```

### Display Gamification Data in Your Component

```tsx
import { useGamification } from '@/hooks/useGamification'

export default function MyComponent() {
  const {
    totalXP,
    currentLevel,
    currentStreak,
    bestStreak,
    unlockedAchievements,
    sessionCount,
    loading,
    isEnabled
  } = useGamification()

  // Don't render if gamification is disabled
  if (!isEnabled) return null

  // Show loading state
  if (loading) return <LoadingSpinner />

  return (
    <div>
      <p>Level: {currentLevel}</p>
      <p>XP: {totalXP}</p>
      <p>Streak: {currentStreak} days</p>
      <p>Achievements: {unlockedAchievements.length}</p>
      <p>Sessions: {sessionCount}</p>
    </div>
  )
}
```

### That's It! 🎉

The gamification system **automatically tracks** review sessions via the Universal Review Engine (URE). You don't need to manually award XP or track achievements - it's all handled for you!

---

## 🏗️ Architecture Overview

### How It Works

```
┌─────────────────────────────────────────────────────────┐
│  Your Feature (e.g., Kanji Review, Flashcards, Drill)  │
│                                                         │
│  Uses: Universal Review Engine (URE)                    │
└─────────────────────────────────────────────────────────┘
                          │
                          │ Emits SESSION_COMPLETED event
                          ↓
┌─────────────────────────────────────────────────────────┐
│  GamificationListener (Auto-subscribed to URE events)   │
│                                                         │
│  1. Calculates XP (config-driven)                       │
│  2. Checks achievement conditions                       │
│  3. Updates streak (if XP ≥ 10)                         │
│  4. Updates Zustand store                               │
└─────────────────────────────────────────────────────────┐
                          │
                          │ Auto-saves to IndexedDB
                          ↓
┌─────────────────────────────────────────────────────────┐
│  IndexedDB (Offline-First Storage)                      │
│                                                         │
│  Database: "moshimoshi_gamification" v1                 │
│  Store: "userGamification"                              │
│  - Multi-user support (by userId)                       │
│  - Persists across sessions                             │
│  - No network required                                  │
└─────────────────────────────────────────────────────────┘
                          │
                          │ UI reads from store
                          ↓
┌─────────────────────────────────────────────────────────┐
│  useGamification() Hook                                 │
│                                                         │
│  Provides: XP, Level, Streak, Achievements to UI        │
└─────────────────────────────────────────────────────────┘
```

### Key Principles

1. **Event-Driven**: No manual XP/achievement calls needed
2. **Config-Driven**: All rules in JSON files (no hardcoded values)
3. **Offline-First**: Works without network via IndexedDB
4. **Zero-Coupling**: Your feature doesn't need to know about gamification
5. **Feature Flag**: Entire system can be toggled on/off

---

## 🔌 How to Use Gamification in Your Feature

### Option 1: Use Universal Review Engine (Recommended)

**If your feature uses URE**, gamification is **automatic**:

```tsx
import { UniversalReviewEngine } from '@/lib/review-engine'

function MyReviewComponent() {
  const handleSessionComplete = (summary) => {
    // That's it! URE emits SESSION_COMPLETED event
    // GamificationListener automatically:
    // - Awards XP based on accuracy/speed/streak
    // - Checks achievements
    // - Updates streak (if XP ≥ 10)
    // - Increments sessionCount
  }

  return (
    <UniversalReviewEngine
      onSessionComplete={handleSessionComplete}
      // ... other props
    />
  )
}
```

### Option 2: Manually Emit Events (For Non-URE Features)

**If your feature doesn't use URE**, you need to emit events manually through the Universal Review Engine's event system:

```tsx
import { ReviewEventType } from '@/lib/review-engine/core/events'
// Get the global URE event emitter (initialized in your review component)
import { reviewEngineEventEmitter } from '@/lib/review-engine/core/eventEmitter'

// After session completion
reviewEngineEventEmitter.emit(ReviewEventType.SESSION_COMPLETED, {
  data: {
    sessionId: 'unique-session-id',
    statistics: {
      correctItems: 45,        // Number of correct answers
      accuracy: 90,            // Percentage (0-100)
      averageResponseTime: 2500, // Milliseconds
      bestStreak: 10           // Longest correct streak in session
    },
    duration: 120000  // Session duration in milliseconds
  }
})
```

**⚠️ Important**: The gamification listener is automatically subscribed to the URE event emitter during initialization. You don't need to manually subscribe or initialize the listener - it's handled by the system.

### Option 3: Display-Only (No Tracking)

**If you only want to show stats** without tracking:

```tsx
import { useGamification } from '@/hooks/useGamification'

export default function ProfilePage() {
  const { totalXP, currentLevel, currentStreak, isEnabled } = useGamification()

  if (!isEnabled) return <RegularProfile />

  return (
    <div>
      <h1>Your Progress</h1>
      <StatCard label="Level" value={currentLevel} />
      <StatCard label="XP" value={totalXP} />
      <StatCard label="Streak" value={currentStreak} />
    </div>
  )
}
```

---

## 🎣 Available Hooks & Components

### `useGamification()` Hook

**Primary hook for accessing gamification data**

```tsx
const {
  totalXP,              // number: Total XP earned
  currentLevel,         // number: Current level (1+, calculated from totalXP)
  currentStreak,        // number: Current daily streak
  bestStreak,          // number: Best streak ever
  unlockedAchievements, // string[]: Array of achievement IDs
  sessionCount,        // number: Total sessions completed (tracked)
  loading,             // boolean: Loading state
  error,               // Error | null: Error state
  isEnabled            // boolean: Feature flag status
} = useGamification()
```

**When to use**:
- Displaying user stats in UI
- Conditional rendering based on gamification state
- Checking if feature is enabled

**Example - Dashboard Stats**:
```tsx
export default function Dashboard() {
  const {
    totalXP,
    currentLevel,
    currentStreak,
    sessionCount,
    loading,
    isEnabled
  } = useGamification()

  if (!isEnabled) return null
  if (loading) return <LoadingSpinner />

  return (
    <div className="stats-grid">
      <StatCard icon="⚡" label="XP" value={totalXP} />
      <StatCard icon="🏆" label="Level" value={currentLevel} />
      <StatCard icon="🔥" label="Streak" value={currentStreak} />
      <StatCard icon="📚" label="Sessions" value={sessionCount} />
    </div>
  )
}
```

### Direct Store Access (Advanced)

**For advanced use cases**, access the Zustand store directly:

```tsx
import { useGamificationStore } from '@/state/userGamification'

// Inside component
const store = useGamificationStore()

// Available actions
store.awardXP(100)                    // Award XP manually
store.incrementStreak()               // Increment streak
store.unlockAchievement('first_win')  // Unlock achievement
store.incrementSessionCount()         // Increment session count
store.setUserId(userId)               // Set user ID for IndexedDB
store.loadFromIndexedDB(userId)       // Load user data (async)
store.saveToIndexedDB()               // Save to IndexedDB (async, no params)
```

**⚠️ Critical**: `saveToIndexedDB()` takes **no parameters**. It uses `store.userId` internally. You must call `setUserId(userId)` first, or use `loadFromIndexedDB(userId)` which sets it automatically.

**❌ Wrong**:
```tsx
store.saveToIndexedDB(userId)  // ERROR: No userId parameter!
```

**✅ Correct**:
```tsx
store.setUserId(userId)
store.saveToIndexedDB()  // Uses store.userId internally

// OR
await store.loadFromIndexedDB(userId)  // Sets userId automatically
// ... make changes ...
store.saveToIndexedDB()  // Uses the userId from loadFromIndexedDB
```

**⚠️ Warning**: Only use direct store access if you're NOT using URE. The gamification listener handles everything automatically for URE-based features.

---

## ⚙️ Configuration System

All gamification rules are **config-driven** - no hardcoded values!

### XP Configuration

**File**: `/config/gamification/xp.json`

```json
{
  "version": "1.0.0",
  "baseXP": 10,
  "bonuses": {
    "accuracy": [
      {
        "threshold": 100,
        "multiplier": 1.5,
        "description": "Perfect accuracy"
      },
      {
        "threshold": 90,
        "multiplier": 1.3,
        "description": "Excellent accuracy"
      },
      {
        "threshold": 80,
        "multiplier": 1.2,
        "description": "Good accuracy"
      }
    ],
    "speed": {
      "thresholdMs": 3000,
      "bonus": 5,
      "description": "Under 3 seconds average"
    },
    "streak": {
      "minStreak": 10,
      "bonusPerItem": 2,
      "maxBonus": 50,
      "description": "Correct answer streak bonus"
    }
  },
  "dailyXPCap": 500,
  "antiCheat": {
    "enabled": true,
    "maxPerSession": 200,
    "suspiciousThreshold": 1000,
    "logSuspiciousActivity": true
  }
}
```

**How XP is calculated**:
```
1. Base XP = correctItems × baseXP (e.g., 10 correct = 100 XP)
2. Accuracy multiplier applied (e.g., 90% = 1.3x = 130 XP)
3. Speed bonus added if fast (e.g., +5 XP = 135 XP)
4. Streak bonus added (e.g., 10 streak = +20 XP = 155 XP)
5. Daily cap applied (max 500 XP/day)
```

### Streak Configuration

**File**: `/config/gamification/streak.json`

```json
{
  "minXPForStreak": 10,      // Must earn ≥10 XP to count for streak
  "gracePeriodHours": 24,    // 24-hour grace period
  "resetTime": "00:00"       // UTC midnight reset
}
```

### Achievement Configuration

**File**: `/config/gamification/achievements.json`

```json
{
  "version": "1.0.0",
  "achievements": [
    {
      "id": "first_session",
      "name": "First Session",
      "description": "Complete your first review session",
      "icon": "🎯",
      "category": "progress",
      "points": 10,
      "rarity": "common",
      "condition": {
        "type": "session_count",
        "operator": ">=",
        "value": 1
      }
    },
    {
      "id": "week_warrior",
      "name": "Week Warrior",
      "description": "Maintain a 7-day streak",
      "icon": "🔥",
      "category": "streak",
      "points": 50,
      "rarity": "uncommon",
      "condition": {
        "type": "streak",
        "operator": ">=",
        "value": 7
      }
    },
    {
      "id": "early_bird",
      "name": "Early Bird",
      "description": "Study before 6 AM",
      "icon": "🌅",
      "category": "special",
      "points": 20,
      "rarity": "uncommon",
      "condition": {
        "type": "time_of_day",
        "operator": "<",
        "value": 6
      }
    }
  ]
}
```

**Available condition types**:
- `session_count`: Total sessions completed (tracked automatically)
- `streak`: Current streak value
- `best_streak`: Best streak achieved in a session
- `level`: Current level (calculated from totalXP)
- `time_of_day`: Hour of day (0-23) when session completed
- `kanji_learned`: Number of kanji learned (future - requires integration with kanji progress)
- `speed_reviews`: Number of reviews completed under threshold (future)

**Available operators**:
- `>=`: Greater than or equal
- `>`: Greater than
- `<=`: Less than or equal
- `<`: Less than
- `==`: Equals

### Level Configuration

**File**: `/config/gamification/levels.json`

```json
{
  "formula": "floor(totalXP / xpPerLevel)",
  "xpPerLevel": 1000,
  "maxLevel": 100
}
```

**Level calculation**: `currentLevel = Math.max(1, Math.floor(totalXP / 1000))`

**Example levels**:
- Level 1: 0-999 XP
- Level 2: 1000-1999 XP
- Level 3: 2000-2999 XP
- Level 10: 9000-9999 XP

---

## 📡 Event System

### URE Events the Gamification System Listens To

```tsx
// Session completed (main event)
ReviewEventType.SESSION_COMPLETED
// Payload:
{
  data: {
    sessionId: string,
    statistics: {
      correctItems: number,      // Number of correct answers
      accuracy: number,          // Percentage (0-100)
      averageResponseTime: number, // Milliseconds
      bestStreak: number         // Longest correct streak
    },
    duration: number             // Session duration in milliseconds
  }
}
```

### How to Emit Events in Your Feature

```tsx
import { ReviewEventType } from '@/lib/review-engine/core/events'
import { reviewEngineEventEmitter } from '@/lib/review-engine/core/eventEmitter'

// After session completion
reviewEngineEventEmitter.emit(ReviewEventType.SESSION_COMPLETED, {
  data: {
    sessionId: 'my-session-123',
    statistics: {
      correctItems: 15,
      accuracy: 88.5,
      averageResponseTime: 2200,
      bestStreak: 8
    },
    duration: 180000 // 3 minutes
  }
})
```

**Required fields**:
- `sessionId`: Unique session identifier (string)
- `statistics.correctItems`: Number of correct answers (number)
- `statistics.accuracy`: 0-100 percentage (number)
- `statistics.averageResponseTime`: Milliseconds (number)
- `statistics.bestStreak`: Longest correct streak (number)
- `duration`: Session duration in milliseconds (number)

---

## 🔄 Common Integration Patterns

### Pattern 1: Review Session with URE

**Use case**: Kanji review, vocabulary review, etc.

```tsx
import { useReviewEngine } from '@/hooks/useReviewEngine'

export default function KanjiReview() {
  const { startSession, completeSession } = useReviewEngine()

  const handleSessionComplete = async (results) => {
    // URE automatically emits SESSION_COMPLETED
    // Gamification listener catches it and:
    // - Awards XP
    // - Checks achievements
    // - Updates streak
    // - Increments sessionCount

    // Just show results to user
    showResults(results)
  }

  return (
    <ReviewEngine
      onSessionComplete={handleSessionComplete}
      items={kanjiToReview}
    />
  )
}
```

### Pattern 2: Custom Game/Quiz

**Use case**: Games, drills, custom quizzes

```tsx
import { ReviewEventType } from '@/lib/review-engine/core/events'
import { reviewEngineEventEmitter } from '@/lib/review-engine/core/eventEmitter'

export default function CustomQuiz() {
  const [score, setScore] = useState(0)
  const [startTime, setStartTime] = useState(Date.now())

  const handleQuizComplete = async () => {
    // Calculate stats
    const accuracy = (score / totalQuestions) * 100
    const duration = Date.now() - startTime

    // Emit event for gamification
    reviewEngineEventEmitter.emit(ReviewEventType.SESSION_COMPLETED, {
      data: {
        sessionId: `quiz-${Date.now()}`,
        statistics: {
          correctItems: score,
          accuracy: accuracy,
          averageResponseTime: avgTime,
          bestStreak: longestStreak
        },
        duration: duration
      }
    })

    // Show results
    showResults()
  }

  return (
    <QuizComponent
      onComplete={handleQuizComplete}
    />
  )
}
```

### Pattern 3: Display-Only Stats

**Use case**: Profile page, dashboard cards

```tsx
import { useGamification } from '@/hooks/useGamification'

export default function ProfileStats() {
  const {
    totalXP,
    currentLevel,
    currentStreak,
    bestStreak,
    unlockedAchievements,
    sessionCount,
    isEnabled,
    loading
  } = useGamification()

  if (!isEnabled) {
    return <p>Gamification is disabled</p>
  }

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <h3>Level {currentLevel}</h3>
        <p>{totalXP} XP</p>
      </div>
      <div className="stat-card">
        <h3>🔥 {currentStreak} day streak</h3>
        <p>Best: {bestStreak} days</p>
      </div>
      <div className="stat-card">
        <h3>🏆 {unlockedAchievements.length} Achievements</h3>
        <AchievementList ids={unlockedAchievements} />
      </div>
      <div className="stat-card">
        <h3>📚 {sessionCount} Sessions</h3>
        <p>Total completed</p>
      </div>
    </div>
  )
}
```

### Pattern 4: Conditional Rendering

**Use case**: Feature-flagged UI elements

```tsx
import { useGamification } from '@/hooks/useGamification'

export default function Dashboard() {
  const { currentStreak, isEnabled } = useGamification()

  return (
    <div>
      <h1>Dashboard</h1>

      {/* Only show streak badge if gamification enabled AND user has a streak */}
      {isEnabled && currentStreak > 0 && (
        <div className="streak-badge">
          🔥 {currentStreak} day streak!
        </div>
      )}

      {/* Rest of dashboard */}
    </div>
  )
}
```

---

## 🧪 Testing Your Integration

### Test Checklist

- [ ] Feature flag OFF: Gamification hook returns safe defaults
- [ ] Feature flag ON: Data loads from IndexedDB
- [ ] Session completion: XP is awarded correctly
- [ ] Session completion: sessionCount increments
- [ ] Achievement unlock: Conditions are checked properly
- [ ] Streak update: Only increments if XP ≥ 10
- [ ] Multi-user: Different users have separate data
- [ ] Offline: Works without network connection
- [ ] Level calculation: Correctly derived from totalXP

### Manual Testing Steps

1. **Enable gamification**:
   ```bash
   NEXT_PUBLIC_ENABLE_GAMIFICATION=true
   ```

2. **Complete a review session**:
   - Should see XP awarded
   - Should see sessionCount increment
   - Should see achievements unlock (if conditions met)
   - Should see streak increment (if XP ≥ 10)
   - Should see level increase (if totalXP crosses 1000 threshold)

3. **Check IndexedDB** (Chrome DevTools):
   - Application → IndexedDB → `moshimoshi_gamification`
   - Store: `userGamification`
   - Verify data saved with correct `userId`
   - Verify `sessionCount` is tracked

4. **Refresh page**:
   - Data should persist
   - No re-fetch needed (offline-first)

5. **Test feature flag OFF**:
   ```bash
   NEXT_PUBLIC_ENABLE_GAMIFICATION=false
   ```
   - UI should gracefully hide gamification elements
   - No errors in console

### Debug Mode

Enable debug logging:

```tsx
// In browser console
localStorage.setItem('debug:gamification', 'true')

// You'll see logs like:
// [Gamification] Session completed: {...}
// [Gamification] XP awarded: 120
// [Gamification] Achievement unlocked: first_session
// [Gamification] Streak incremented: 3 → 4
// [Gamification] Session count: 5
```

---

## 🐛 Troubleshooting

### Issue: "Hook returns all zeros"

**Cause**: Feature flag is OFF or data hasn't loaded yet

**Solution**:
```tsx
const { totalXP, loading, isEnabled } = useGamification()

if (!isEnabled) {
  console.log('Gamification is disabled')
  return null
}

if (loading) {
  console.log('Loading gamification data...')
  return <LoadingSpinner />
}

console.log('XP:', totalXP) // Should have value now
```

### Issue: "XP not awarded after session"

**Cause**: URE event not emitted or wrong payload format

**Solution**:
1. Check event is emitted:
   ```tsx
   console.log('Emitting SESSION_COMPLETED')
   reviewEngineEventEmitter.emit(ReviewEventType.SESSION_COMPLETED, payload)
   ```

2. Verify payload format:
   ```tsx
   {
     data: {
       sessionId: 'string',           // ✅ Required
       statistics: {
         correctItems: 10,             // ✅ Required (number)
         accuracy: 90,                 // ✅ Required (0-100)
         averageResponseTime: 2000,    // ✅ Required (milliseconds)
         bestStreak: 5                 // ✅ Required (number)
       },
       duration: 60000                 // ✅ Required (milliseconds)
     }
   }
   ```

### Issue: "Achievements not unlocking"

**Cause**: Condition not met or check happens before state update

**Solution**:
- Achievement listener checks state AFTER increments
- Verify condition in `/config/gamification/achievements.json`
- Example: `first_session` unlocks when `sessionCount >= 1`

**Debug**:
```tsx
const store = useGamificationStore.getState()
console.log('Session count:', store.sessionCount)
console.log('Current streak:', store.currentStreak)
console.log('Unlocked:', store.unlockedAchievements)
```

### Issue: "Streak not incrementing"

**Cause**: XP earned < 10 (minimum required)

**Solution**:
- Streak only increments if XP ≥ 10 (see `/config/gamification/streak.json`)
- Check XP calculation: `correctItems × baseXP × accuracyMultiplier`
- Minimum: 1 correct answer = 10 XP (before multipliers)

### Issue: "Data not persisting"

**Cause**: IndexedDB quota exceeded or permissions, or userId not set

**Solution**:
1. Verify userId is set:
   ```tsx
   const store = useGamificationStore.getState()
   console.log('Current userId:', store.userId)
   // If null, data won't save!
   ```

2. Check IndexedDB quota:
   ```tsx
   navigator.storage.estimate().then(estimate => {
     console.log('Used:', estimate.usage)
     console.log('Quota:', estimate.quota)
   })
   ```

3. Clear old data:
   ```tsx
   // In browser console
   indexedDB.deleteDatabase('moshimoshi_gamification')
   ```

4. Verify auto-save middleware is working:
   - Store automatically saves after every mutation
   - Check `indexedDBStore.ts` for errors

### Issue: "Multiple users share same data"

**Cause**: `userId` not set in store

**Solution**:
```tsx
// Hook automatically sets userId from auth
const { user } = useAuth()
const gamification = useGamification() // Uses user.uid automatically

// Manual check:
const store = useGamificationStore.getState()
console.log('Current userId:', store.userId)

// If using store directly:
store.setUserId(user.uid)  // Set userId first
store.saveToIndexedDB()    // Then save
```

### Issue: "sessionCount not incrementing"

**Cause**: Gamification listener not calling `incrementSessionCount()`

**Solution**:
- Check gamificationListener.ts handles SESSION_COMPLETED
- Verify `store.incrementSessionCount()` is called
- Debug: `console.log('Session count:', store.sessionCount)`

---

## 🔧 Real-World Implementation Guide

This section documents **actual integration work** done in the Moshimoshi codebase. Use these as reference examples when integrating gamification into other features.

### Case Study 1: Kana Learning Component Integration

**File**: `/src/components/learn/KanaLearningComponent.tsx`

**Problem**: Kana review sessions weren't emitting gamification events, so no XP was awarded.

**Solution**: Created local URE event emitter and initialized gamification listener.

#### Step 1: Add Imports (Lines 22-30)
```tsx
import { ReviewEventType } from '@/lib/review-engine/core/events'
import { EventEmitter } from 'events'
import { gamificationListener } from '@/lib/gamification/gamificationListener'

// Global URE event emitter for gamification integration
const ureEventEmitter = new EventEmitter()

// Flag to ensure listener is only initialized once
let listenerInitialized = false
```

#### Step 2: Initialize Listener on Mount (Lines 204-211)
```tsx
// Initialize gamification listener (once per user session)
useEffect(() => {
  if (user?.uid && !listenerInitialized) {
    console.log('[Kana Review] Initializing gamification listener for user:', user.uid)
    gamificationListener.initialize(user.uid, ureEventEmitter)
    listenerInitialized = true
  }
}, [user?.uid])
```

#### Step 3: Emit Event on Session Complete (Lines 402-425)
```tsx
const handleReviewComplete = useCallback(async (stats: SessionStatistics) => {
  // ... existing code ...

  // Emit URE SESSION_COMPLETED event for gamification system
  const sessionId = `kana_review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  ureEventEmitter.emit(ReviewEventType.SESSION_COMPLETED, {
    data: {
      sessionId,
      statistics: {
        correctItems: stats.correctItems,
        accuracy: stats.accuracy,
        averageResponseTime: stats.averageResponseTime || 0,
        bestStreak: stats.bestStreak || 0
      },
      duration: stats.duration || 0
    }
  })

  console.log('[Kana Review] Emitted SESSION_COMPLETED event for gamification:', {
    sessionId,
    correctItems: stats.correctItems,
    accuracy: stats.accuracy,
    averageResponseTime: stats.averageResponseTime,
    bestStreak: stats.bestStreak,
    duration: stats.duration
  })
}, [/* deps */])
```

**Key Takeaways**:
- ✅ Use a **global EventEmitter** for components that don't use full URE
- ✅ Initialize listener **once per user session** with flag
- ✅ Emit events with **proper payload structure** (see Event System section)
- ✅ Add **debug console logs** to verify emission

---

### Case Study 2: Dashboard Stats Display

**File**: `/src/app/dashboard/page.tsx`

**Problem**: Dashboard showed hardcoded zeros for XP, streak, and achievements despite gamification working.

**Solution**: Replace static values with data from `useGamification()` hook.

#### Before (Lines 160-166 - WRONG):
```tsx
// Dynamic learning stats (gamification removed - using static values)
const getLearningStats = () => {
  const xpPoints = 0                      // ❌ Hardcoded
  const completionPercentage = 0
  const streakValue = 0                   // ❌ Hardcoded
  const achievementCount = 0              // ❌ Hardcoded
  // ...
}
```

#### After (Lines 160-166 - CORRECT):
```tsx
// Dynamic learning stats from gamification system
const getLearningStats = () => {
  // Use real gamification data if enabled, otherwise use zeros
  const xpPoints = gamificationEnabled ? totalXP : 0                           // ✅ From hook
  const completionPercentage = 0 // TODO: Calculate from kanji/kana progress
  const streakValue = gamificationEnabled ? currentStreak : 0                  // ✅ From hook
  const achievementCount = gamificationEnabled ? unlockedAchievements.length : 0 // ✅ From hook
  // ...
}
```

**Key Takeaways**:
- ✅ Use `useGamification()` hook data (lines 47-56)
- ✅ Check `gamificationEnabled` before displaying
- ✅ Provide fallback zeros when disabled
- ✅ Use `.length` for achievement count

---

### Case Study 3: Firebase Sync Integration

**File**: `/src/components/sync/SyncStatusMenuItem.tsx`

**Problem**: Premium users' gamification data wasn't syncing to Firebase (stayed at 0 in Firestore).

**Solution**: Add gamification sync to unified sync system.

#### Implementation (Lines 193-205):
```tsx
// Sync gamification data (XP, achievements, streaks) - NEW GAMIFICATION SYSTEM
try {
  const { useGamificationStore } = await import('@/state/userGamification');
  const gamificationStore = useGamificationStore.getState();

  // Only sync if gamification is enabled
  if (process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION === 'true' && gamificationStore.userId) {
    await gamificationStore.syncToFirebase();
    logger.info('Synced gamification data to Firebase');
  }
} catch (error) {
  logger.error('Failed to sync gamification data', error);
}
```

#### API Endpoint Created: `/src/app/api/gamification/sync/route.ts`
```tsx
export async function POST(request: NextRequest) {
  const session = await getSession()
  const userId = session?.uid

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const {
    totalXP,
    currentStreak,
    bestStreak,
    lastActivityDate,
    unlockedAchievements,
    achievementProgress,
    sessionCount
  } = body

  // Update user's gamification document in Firestore
  const userRef = adminDb.collection('users').doc(userId)

  await userRef.set({
    xp: {
      total: totalXP || 0,
      level: Math.max(1, Math.floor((totalXP || 0) / 1000)),
      levelTitle: getLevelTitle(Math.max(1, Math.floor((totalXP || 0) / 1000))),
      xpToNextLevel: 1000 - ((totalXP || 0) % 1000)
    },
    streak: {
      current: currentStreak || 0,
      best: bestStreak || 0
    },
    dates: {
      lastActivityDate: lastActivityDate || null,
      isActiveToday: !!lastActivityDate && isToday(new Date(lastActivityDate))
    },
    achievements: {
      unlockedIds: unlockedAchievements || [],
      unlockedCount: (unlockedAchievements || []).length,
      completionPercentage: Math.round(((unlockedAchievements || []).length / 10) * 100)
    },
    sessions: {
      totalSessions: sessionCount || 0
    },
    metadata: {
      lastUpdated: new Date().toISOString(),
      syncStatus: 'synced',
      dataHealth: 'healthy',
      schemaVersion: 2
    }
  }, { merge: true })

  return NextResponse.json({ success: true, syncedAt: new Date().toISOString() })
}
```

#### Store Implementation: `/src/state/userGamification.ts` (Lines 195-238)
```tsx
syncToFirebase: async () => {
  try {
    if (typeof window === 'undefined') return

    const state = get()

    if (!state.userId) {
      console.warn('[Gamification State] No userId set, skipping Firebase sync')
      return
    }

    // Call sync API
    const response = await fetch('/api/gamification/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        totalXP: state.totalXP,
        currentStreak: state.currentStreak,
        bestStreak: state.bestStreak,
        lastActivityDate: state.lastActivityDate?.toISOString() || null,
        unlockedAchievements: state.unlockedAchievements,
        achievementProgress: state.achievementProgress,
        sessionCount: state.sessionCount
      })
    })

    if (!response.ok) {
      throw new Error(`Firebase sync failed: ${response.statusText}`)
    }

    const result = await response.json()
    console.log('[Gamification State] Synced to Firebase:', result)

    set({ lastSyncedAt: new Date(), isDirty: false })
  } catch (error) {
    console.error('[Gamification State] Failed to sync to Firebase:', error)
    // Don't throw - let it retry later
  }
}
```

**Firestore Document Structure**:
```
users/{userId}
  ├── xp
  │   ├── total: 20
  │   ├── level: 1
  │   ├── levelTitle: "Beginner"
  │   └── xpToNextLevel: 980
  ├── streak
  │   ├── current: 0
  │   └── best: 0
  ├── achievements
  │   ├── unlockedIds: ["first_session"]
  │   ├── unlockedCount: 1
  │   └── completionPercentage: 10
  ├── sessions
  │   └── totalSessions: 1
  └── metadata
      ├── lastUpdated: "2025-10-02T19:30:00Z"
      ├── syncStatus: "synced"
      └── schemaVersion: 2
```

**Key Takeaways**:
- ✅ Add to **existing unified sync system** (don't create separate sync)
- ✅ Create **dedicated API endpoint** for gamification sync
- ✅ Use **Firebase Admin SDK** on server-side
- ✅ Structure Firestore data to **match existing user schema**
- ✅ Handle errors gracefully (log but don't throw)
- ✅ Update `lastSyncedAt` on success

---

### Case Study 4: URE SessionManager Event Logging

**File**: `/src/lib/review-engine/session/manager.ts`

**Problem**: Hard to debug if gamification events are actually being emitted by URE.

**Solution**: Add console log right where SESSION_COMPLETED is emitted.

#### Implementation (Lines 354-371):
```tsx
// Emit completion event
const eventPayload = {
  sessionId: this.session.id,
  statistics: this.statistics!,
  duration: this.session.endedAt.getTime() - this.session.startedAt.getTime()
} as SessionCompletedPayload;

// Log for gamification debugging
console.log('[URE] SESSION_COMPLETED event emitted → Gamification system should award XP:', {
  sessionId: eventPayload.sessionId,
  correctItems: eventPayload.statistics.correctItems,
  accuracy: eventPayload.statistics.accuracy,
  averageResponseTime: eventPayload.statistics.averageResponseTime,
  bestStreak: eventPayload.statistics.bestStreak,
  duration: eventPayload.duration
});

this.emitEvent(ReviewEventType.SESSION_COMPLETED, eventPayload);
```

**Console Output Example**:
```
[URE] SESSION_COMPLETED event emitted → Gamification system should award XP: {
  sessionId: 'session-1759433368530-ogfju7d6v',
  correctItems: 2,
  accuracy: 66.67,
  averageResponseTime: 6514,
  bestStreak: 2,
  duration: 120000
}
```

**Key Takeaways**:
- ✅ Add debug logs at **event emission point**
- ✅ Use clear **arrow symbol** (→) to show causality
- ✅ Log **all relevant statistics** for debugging
- ✅ Keep logs in production (they're valuable for debugging)

---

### Integration Checklist for New Features

When adding gamification to a new feature, follow this checklist:

#### ✅ Step-by-Step Integration Guide

**Step 1: Import Required Modules**

Add these imports at the top of your component/page file:

```tsx
import { ReviewEventType } from '@/lib/review-engine/core/events'
import { EventEmitter } from 'events'
import { gamificationListener } from '@/lib/gamification/gamificationListener'
```

⚠️ **Critical**: You MUST import all three - missing any will cause errors!

---

**Step 2: Create Event Emitter & Initialization Flag**

Add these **OUTSIDE your component** (at module level):

```tsx
// Global URE event emitter for gamification integration
const ureEventEmitter = new EventEmitter()

// Flag to ensure listener is only initialized once
let gamificationListenerInitialized = false

export default function YourComponent() {
  // Component code here...
}
```

⚠️ **Critical**:
- EventEmitter MUST be created at module level (not inside component)
- Use a flag to prevent duplicate initialization
- These must be BEFORE your component definition

---

**Step 3: Initialize Gamification Listener**

Add this useEffect hook inside your component:

```tsx
export default function YourComponent() {
  const { user } = useAuth()

  // Initialize gamification listener (once per user)
  useEffect(() => {
    if (user?.uid && !gamificationListenerInitialized) {
      console.log('[YourFeature] Initializing gamification listener for user:', user.uid)
      gamificationListener.initialize(user.uid, ureEventEmitter)
      gamificationListenerInitialized = true
    }
  }, [user?.uid])

  // Rest of component...
}
```

⚠️ **Critical**:
- Must check BOTH `user?.uid` AND `!gamificationListenerInitialized`
- Only initialize once per user session
- Add console log for debugging

---

**Step 4: Emit SESSION_COMPLETED Event**

When your session/activity completes, emit the event:

```tsx
const handleSessionComplete = async () => {
  // Calculate session statistics
  const sessionDuration = Date.now() - sessionStartTime
  const averageResponseTime = sessionDuration / totalQuestions
  const accuracy = (correctAnswers / totalQuestions) * 100

  // Emit URE SESSION_COMPLETED event for gamification
  ureEventEmitter.emit(ReviewEventType.SESSION_COMPLETED, {
    data: {
      sessionId: `your-feature-${Date.now()}`,
      statistics: {
        correctItems: correctAnswers,      // REQUIRED: number
        accuracy: accuracy,                 // REQUIRED: 0-100
        averageResponseTime: averageResponseTime, // REQUIRED: milliseconds
        bestStreak: longestStreak          // REQUIRED: number
      },
      duration: sessionDuration            // REQUIRED: milliseconds
    }
  })

  console.log('[YourFeature] Emitted SESSION_COMPLETED event:', {
    sessionId,
    correctItems: correctAnswers,
    accuracy,
    duration: sessionDuration
  })
}
```

⚠️ **Critical**:
- ALL fields in `statistics` are REQUIRED (no optional fields!)
- `accuracy` must be 0-100 (percentage)
- `averageResponseTime` and `duration` must be in milliseconds
- Add debug console.log for troubleshooting

---

**Step 5: Common Mistakes to Avoid**

❌ **WRONG - EventEmitter inside component:**
```tsx
export default function MyComponent() {
  const emitter = new EventEmitter() // ❌ Will create new emitter on every render!
  // ...
}
```

✅ **CORRECT - EventEmitter at module level:**
```tsx
const ureEventEmitter = new EventEmitter() // ✅ Created once

export default function MyComponent() {
  // ...
}
```

---

❌ **WRONG - No initialization flag:**
```tsx
useEffect(() => {
  if (user?.uid) {
    gamificationListener.initialize(user.uid, emitter) // ❌ Will initialize multiple times!
  }
}, [user?.uid])
```

✅ **CORRECT - With initialization flag:**
```tsx
useEffect(() => {
  if (user?.uid && !gamificationListenerInitialized) { // ✅ Only once
    gamificationListener.initialize(user.uid, emitter)
    gamificationListenerInitialized = true
  }
}, [user?.uid])
```

---

❌ **WRONG - Missing required fields:**
```tsx
emitter.emit(ReviewEventType.SESSION_COMPLETED, {
  data: {
    sessionId: '123',
    statistics: {
      correctItems: 10,
      accuracy: 90
      // ❌ Missing averageResponseTime and bestStreak!
    }
  }
})
```

✅ **CORRECT - All required fields:**
```tsx
emitter.emit(ReviewEventType.SESSION_COMPLETED, {
  data: {
    sessionId: '123',
    statistics: {
      correctItems: 10,
      accuracy: 90,
      averageResponseTime: 2000, // ✅ All fields present
      bestStreak: 5
    },
    duration: 60000 // ✅ Duration required too
  }
})
```

---

❌ **WRONG - Trying to emit from UniversalProgressManager:**
```tsx
export class MyProgressManager extends UniversalProgressManager {
  async trackSession() {
    // ...
    this.emit('session.completed', data) // ❌ UniversalProgressManager doesn't have emit()!
  }
}
```

✅ **CORRECT - Emit from component/page, not manager:**
```tsx
// In your component/page file:
await progressManager.trackSession(data)
ureEventEmitter.emit(ReviewEventType.SESSION_COMPLETED, eventData) // ✅
```

---

**Step 6: Testing Checklist**

Test your integration with these steps:

- [ ] **Console Logs Appear**
  - [ ] `[YourFeature] Initializing gamification listener`
  - [ ] `[YourFeature] Emitted SESSION_COMPLETED event`
  - [ ] `[Gamification] Session completed`
  - [ ] `[Gamification] XP awarded: X`

- [ ] **IndexedDB Updated**
  - [ ] Open DevTools → Application → IndexedDB
  - [ ] Check `moshimoshi_gamification` database
  - [ ] Verify `userGamification` store has updated data

- [ ] **State Updated**
  - [ ] `totalXP` increased
  - [ ] `sessionCount` incremented
  - [ ] `currentStreak` updated (if XP ≥ 10)
  - [ ] Achievements unlocked (if conditions met)

- [ ] **UI Reflects Changes**
  - [ ] Dashboard shows updated XP
  - [ ] Session count increased
  - [ ] Achievements display (if any unlocked)

- [ ] **No Errors**
  - [ ] No console errors
  - [ ] No TypeScript errors
  - [ ] No runtime exceptions

---

**Step 7: Display Gamification Stats (Optional)**

If your feature has a UI, show gamification data:

```tsx
import { useGamification } from '@/hooks/useGamification'

export default function YourFeature() {
  const { totalXP, currentStreak, isEnabled, loading } = useGamification()

  // Don't render if disabled
  if (!isEnabled) return null

  // Show loading state
  if (loading) return <LoadingSpinner />

  return (
    <div>
      <p>XP: {totalXP}</p>
      <p>Streak: {currentStreak} days</p>
    </div>
  )
}
```

---

### Real-World Example: Conjugation Drills Integration

**File**: `/src/app/drill/page.tsx`

This is a complete, working example of gamification integration:

**Module-Level Setup (Lines 16-24):**
```tsx
import { ReviewEventType } from '@/lib/review-engine/core/events'
import { EventEmitter } from 'events'
import { gamificationListener } from '@/lib/gamification/gamificationListener'

// Global URE event emitter for gamification integration
const ureEventEmitter = new EventEmitter()

// Flag to ensure gamification listener is only initialized once
let gamificationListenerInitialized = false
```

**Initialization (Lines 48-55):**
```tsx
// Initialize gamification listener (once per user session)
useEffect(() => {
  if (user?.uid && !gamificationListenerInitialized) {
    console.log('[Drill Page] Initializing gamification listener for user:', user.uid)
    gamificationListener.initialize(user.uid, ureEventEmitter)
    gamificationListenerInitialized = true
  }
}, [user?.uid])
```

**Event Emission (Lines 223-247):**
```tsx
// Emit URE SESSION_COMPLETED event for gamification system
const sessionDuration = new Date().getTime() - new Date(session.startedAt).getTime()
const averageResponseTime = sessionDuration / session.questions.length

ureEventEmitter.emit(ReviewEventType.SESSION_COMPLETED, {
  data: {
    sessionId: session.id,
    statistics: {
      correctItems: score,
      accuracy: accuracy,
      averageResponseTime: averageResponseTime,
      bestStreak: score
    },
    duration: sessionDuration
  }
})

console.log('[Drill Page] Emitted SESSION_COMPLETED event for gamification:', {
  sessionId: session.id,
  correctItems: score,
  accuracy: accuracy,
  averageResponseTime: averageResponseTime,
  duration: sessionDuration
})
```

**Key Takeaways**:
- ✅ EventEmitter at module level (line 21)
- ✅ Initialization flag prevents duplicates (line 24)
- ✅ Check both user AND flag in useEffect (line 50)
- ✅ All required fields in event payload (lines 228-237)
- ✅ Debug console logs for troubleshooting (line 241)

---

### Quick Reference Checklist

Copy-paste this checklist when integrating a new feature:

```tsx
// ✅ 1. Imports (top of file)
import { ReviewEventType } from '@/lib/review-engine/core/events'
import { EventEmitter } from 'events'
import { gamificationListener } from '@/lib/gamification/gamificationListener'

// ✅ 2. Module-level setup (BEFORE component)
const ureEventEmitter = new EventEmitter()
let gamificationListenerInitialized = false

export default function MyFeature() {
  const { user } = useAuth()

  // ✅ 3. Initialize listener (inside component)
  useEffect(() => {
    if (user?.uid && !gamificationListenerInitialized) {
      gamificationListener.initialize(user.uid, ureEventEmitter)
      gamificationListenerInitialized = true
    }
  }, [user?.uid])

  // ✅ 4. Emit event on completion
  const handleComplete = () => {
    ureEventEmitter.emit(ReviewEventType.SESSION_COMPLETED, {
      data: {
        sessionId: 'unique-id',
        statistics: {
          correctItems: X,           // ✅ Required
          accuracy: Y,               // ✅ Required (0-100)
          averageResponseTime: Z,    // ✅ Required (ms)
          bestStreak: W              // ✅ Required
        },
        duration: D                  // ✅ Required (ms)
      }
    })
  }

  // ✅ 5. Display stats (optional)
  const { totalXP, isEnabled } = useGamification()
  if (!isEnabled) return null

  return <div>XP: {totalXP}</div>
}
```

---

## 📚 Additional Resources

### Core Files Reference

- **Hook**: `/src/hooks/useGamification.ts`
- **Store**: `/src/state/userGamification.ts` (line 42: `saveToIndexedDB()` signature)
- **Listener**: `/src/lib/gamification/gamificationListener.ts`
- **IndexedDB**: `/src/lib/gamification/indexedDBStore.ts` (line 9: DB name)
- **Config**: `/config/gamification/*.json`

### Architecture Documents

- **System Overview**: `/docs/gamification-new/ARCHITECTURE-OVERVIEW.md`
- **Implementation Report**: `/docs/gamification-new/AGENT-1-COMPLETION-REPORT.md`
- **UI Integration Guide**: `/docs/gamification-new/AGENT-3-COMPLETION-REPORT.md`
- **QA Report**: `/docs/gamification-new/AGENT-4-COMPLETION-REPORT.md`
- **Final Approval**: `/docs/gamification-new/SUPERVISOR-FINAL-APPROVAL.md`

### Test Files

- **Listener Tests**: `/src/lib/gamification/__tests__/gamificationListener.test.ts`
- **Integration Tests**: `/tests/integration/gamification.test.ts`

---

## ✅ Best Practices

### DO ✅

- Always check `isEnabled` before rendering gamification UI
- Use `useGamification()` hook for all UI data needs
- Let URE emit events (don't manually award XP if using URE)
- Handle loading states gracefully
- Test with feature flag ON and OFF
- Call `setUserId()` before using `saveToIndexedDB()`
- Remember `saveToIndexedDB()` takes NO parameters

### DON'T ❌

- Don't hardcode XP values (use config)
- Don't manually call `awardXP()` if using URE (duplicate XP!)
- Don't assume gamification is always enabled
- Don't forget to handle `loading` state
- Don't emit events with incorrect payload format
- Don't call `saveToIndexedDB(userId)` - it takes no parameters!
- Don't modify config files without testing

---

## 🎯 Quick Reference

### Enable Gamification
```bash
NEXT_PUBLIC_ENABLE_GAMIFICATION=true
```

### Import Hook
```tsx
import { useGamification } from '@/hooks/useGamification'
```

### Check if Enabled
```tsx
const { isEnabled } = useGamification()
if (!isEnabled) return null
```

### Display Stats
```tsx
const {
  totalXP,
  currentLevel,
  currentStreak,
  sessionCount
} = useGamification()
```

### Emit Event (Non-URE Features Only)
```tsx
import { ReviewEventType } from '@/lib/review-engine/core/events'
import { reviewEngineEventEmitter } from '@/lib/review-engine/core/eventEmitter'

reviewEngineEventEmitter.emit(ReviewEventType.SESSION_COMPLETED, {
  data: {
    sessionId: 'unique-id',
    statistics: {
      correctItems: 10,
      accuracy: 90,
      averageResponseTime: 2000,
      bestStreak: 5
    },
    duration: 60000
  }
})
```

### Direct Store Usage
```tsx
import { useGamificationStore } from '@/state/userGamification'

const store = useGamificationStore()

// Set userId first
store.setUserId(userId)

// Make changes
store.awardXP(100)

// Save (no parameters!)
store.saveToIndexedDB()
```

---

## 📊 Progress Tracking Pattern (Learned Item Highlighting)

### Overview
This pattern enables visual progress tracking for learning features (Kana, Kanji, Vocabulary, Custom Lists). When items are marked as "learned", they:
- ✅ Display with green background/border in the UI
- ✅ Update the total learned count (e.g., "13/106 learned")
- ✅ Persist progress across sessions (IndexedDB + Firebase for premium)

### The Core Pattern (from Kana Implementation)

**Key Components:**
1. **Progress State** with status tracking
2. **Prefixed ID System** for multi-script support
3. **Visual Styling** based on learning status
4. **Progress Statistics** calculation

### Implementation Checklist

#### 1. **Set Up Progress State**
```typescript
interface ItemProgress {
  [itemId: string]: {
    status: 'not-started' | 'learning' | 'learned'
    reviewCount: number
    correctCount: number
    lastReviewed?: Date
    pinned?: boolean
    updatedAt?: Date
  }
}

const [progress, setProgress] = useState<ItemProgress>({})
```

#### 2. **Create ID Formatting Helper**
```typescript
// For features with multiple scripts/variants (like Kana: hiragana/katakana)
const getItemId = useCallback((rawId: string) => {
  if (rawId.startsWith('hiragana-') || rawId.startsWith('katakana-')) {
    return rawId // Already prefixed
  }
  return `${currentScript}-${rawId}` // Add prefix
}, [currentScript])

// For single-type features (Kanji, Vocabulary)
const getItemId = useCallback((rawId: string) => {
  if (rawId.startsWith('kanji-')) return rawId
  return `kanji-${rawId}`
}, [])
```

#### 3. **Load Progress from Storage**
```typescript
useEffect(() => {
  const loadProgress = async () => {
    if (!user) {
      setProgress({})
      return
    }

    // Load from appropriate manager (KanaProgressManager, KanjiProgressManager, etc.)
    const savedProgress = await progressManager.getProgress(
      contentType, // 'hiragana', 'kanji', 'vocabulary', etc.
      user,
      isPremium
    )

    const formattedProgress: ItemProgress = {}
    for (const [itemId, data] of Object.entries(savedProgress)) {
      formattedProgress[itemId] = {
        status: data.status,
        reviewCount: data.reviewCount,
        correctCount: data.correctCount,
        lastReviewed: data.lastReviewed,
        pinned: data.pinned,
        updatedAt: data.updatedAt
      }
    }
    setProgress(formattedProgress)
  }

  loadProgress()
}, [user, isPremium, contentType])
```

#### 4. **Update Progress During Study**
```typescript
const handleUpdateProgress = async (itemId: string, updates: Partial<ItemProgress[string]>) => {
  if (!user) return

  const prefixedId = getItemId(itemId)

  // Update local state immediately (optimistic update)
  setProgress(prev => ({
    ...prev,
    [prefixedId]: { ...prev[prefixedId], ...updates }
  }))

  // Save to storage (IndexedDB + Firebase for premium)
  await progressManager.saveProgress(
    contentType,
    prefixedId,
    updates,
    user,
    isPremium
  )
}
```

#### 5. **Apply Visual Styling in Grid/List Component**
```typescript
// In your grid/list component
const GridItem = ({ item, progress, getItemId }) => {
  const itemProgress = progress[getItemId(item.id)]
  const isLearned = itemProgress?.status === 'learned'
  const isLearning = itemProgress?.status === 'learning'

  const borderStyle = isLearned
    ? 'border-2 border-green-500 dark:border-green-400'
    : isLearning
    ? 'border-2 border-yellow-500 dark:border-yellow-400'
    : 'border-2 border-gray-200 dark:border-dark-700'

  const bgStyle = isLearned
    ? 'bg-green-50 dark:bg-green-900/20'
    : 'bg-white dark:bg-dark-800'

  return (
    <div className={`${borderStyle} ${bgStyle} ...other-classes`}>
      {/* Item content */}
    </div>
  )
}
```

#### 6. **Pass ID Helper to Child Components**
```typescript
// CRITICAL: Pass the getItemId helper to avoid ID mismatch bugs
<ItemGrid
  items={items}
  progress={progress}
  getItemId={getItemId}  // ← Essential!
  onUpdateProgress={handleUpdateProgress}
/>
```

#### 7. **Calculate Progress Statistics**
```typescript
const progressStats = useMemo(() => {
  const total = items.length
  const learned = items.filter(item =>
    progress[getItemId(item.id)]?.status === 'learned'
  ).length
  const learning = items.filter(item =>
    progress[getItemId(item.id)]?.status === 'learning'
  ).length

  return {
    total,
    learned,
    learning,
    notStarted: total - learned - learning,
    learnedPercentage: total > 0 ? Math.round((learned / total) * 100) : 0
  }
}, [items, progress, getItemId])
```

### Feature-Specific Examples

#### 🔤 Kanji Browser
```typescript
// ID Format: 'kanji-愛', 'kanji-日'
const getItemId = (rawId: string) => {
  if (rawId.startsWith('kanji-')) return rawId
  return `kanji-${rawId}`
}

// Progress Manager
import { KanjiProgressManager } from '@/lib/progress/KanjiProgressManager'
const kanjiProgress = await KanjiProgressManager.getProgress(user, isPremium)
```

#### 📚 Textbook Vocabulary
```typescript
// ID Format: 'vocab-textbook1-chapter1-word1'
const getItemId = (textbook: string, chapter: number, wordId: string) => {
  return `vocab-${textbook}-chapter${chapter}-${wordId}`
}

// Progress Manager
import { VocabularyProgressManager } from '@/lib/progress/VocabularyProgressManager'
const vocabProgress = await VocabularyProgressManager.getProgress(
  textbook,
  chapter,
  user,
  isPremium
)
```

#### 📝 Custom Lists
```typescript
// ID Format: 'list-{listId}-item-{itemId}'
const getItemId = (listId: string, itemId: string) => {
  return `list-${listId}-item-${itemId}`
}

// Progress Manager
import { CustomListProgressManager } from '@/lib/progress/CustomListProgressManager'
const listProgress = await CustomListProgressManager.getProgress(
  listId,
  user,
  isPremium
)
```

### Common Pitfalls & Solutions

#### ❌ **Pitfall 1: ID Mismatch (Progress Never Shows)**
**Problem**: Grid looks up `progress[item.id]` but progress is stored with prefixed ID
```typescript
// BAD: ID mismatch
const itemData = kanaData.find(k => k.id === 'a') // Returns { id: 'a', ... }
const itemProgress = progress['a'] // undefined! (stored as 'hiragana-a')
```

**Solution**: Always use the ID helper
```typescript
// GOOD: Consistent ID lookup
const itemProgress = progress[getItemId(item.id)] // Works!
```

#### ❌ **Pitfall 2: Progress Updates Don't Persist**
**Problem**: Updating local state but not saving to storage
```typescript
// BAD: Only updates UI, lost on refresh
setProgress(prev => ({ ...prev, [id]: updates }))
```

**Solution**: Always save to storage after state update
```typescript
// GOOD: Persists across sessions
setProgress(prev => ({ ...prev, [id]: updates }))
await progressManager.saveProgress(contentType, id, updates, user, isPremium)
```

#### ❌ **Pitfall 3: Premium Users Lose Progress on Refresh**
**Problem**: Progress saved to IndexedDB but not synced to Firebase
```typescript
// BAD: Only saves locally
await progressManager.saveToIndexedDB(progress)
```

**Solution**: Use manager methods that handle Firebase sync for premium users
```typescript
// GOOD: Automatically syncs to Firebase for premium users
await progressManager.saveProgress(contentType, id, updates, user, isPremium)
```

### Testing Checklist
- [ ] Item shows green background/border when marked as learned
- [ ] Progress count updates correctly (e.g., "14/106" after marking one more)
- [ ] Progress persists after page refresh
- [ ] Progress persists after logout/login (premium users)
- [ ] Multiple scripts/variants use separate progress (e.g., hiragana vs katakana)
- [ ] No console errors about undefined progress
- [ ] Works for both free (IndexedDB) and premium (Firebase) users

---

## 🔍 Troubleshooting: Firebase Sync for Premium Users

### Issue: XP Not Persisting After Refresh (Premium Users Only)

**Symptoms**:
- XP is awarded during session (console shows increase: 116 → 126)
- After page refresh, XP reverts to old value (back to 116)
- Only affects premium users (free users work fine with IndexedDB)

**Root Cause**:
Premium users load gamification data from Firebase on page load (`useGamification` hook), but XP changes are only saved to IndexedDB, not synced back to Firebase. This creates a one-way data flow:

```
1. Page loads → Reads from Firebase (116 XP)
2. Complete session → Saves to IndexedDB only (126 XP)
3. Page refreshes → Reads from Firebase again (116 XP) ❌
```

**Current Architecture**:
- `useGamification` hook (lines 76-98):
  - Premium users: Load from Firebase first, fallback to IndexedDB
  - Free users: Load from IndexedDB only
- `gamificationListener` (line 98):
  - Awards XP → calls `store.saveToIndexedDB()` only
  - Does NOT call `store.syncToFirebase()`
- `/api/gamification/sync` endpoint:
  - Currently has NO premium user check
  - Allows any authenticated user to sync to Firebase

**Solution Required**:

1. **Add premium check to sync API** (`/src/app/api/gamification/sync/route.ts`):
   ```typescript
   // Add after line 12:
   if (!isPremiumUser(session?.tier)) {
     return NextResponse.json(
       { error: 'Firebase sync only available for premium users' },
       { status: 403 }
     )
   }
   ```

2. **Add Firebase sync after session completion** (`gamificationListener.ts` line ~150):
   ```typescript
   // After session processed:
   const finalStore = useGamificationStore.getState()
   finalStore.syncToFirebase().catch(err => {
     console.error('[Gamification] Firebase sync failed:', err)
   })
   ```

**Verified Integrations** (as of 2025-10-05):
- ✅ Kana Study Mode: Emits SESSION_COMPLETED correctly
- ✅ Kana Review Mode: Emits SESSION_COMPLETED correctly
- ✅ Drill Sessions: Emits SESSION_COMPLETED correctly
- ✅ Event listener: Receives events and awards XP
- ✅ IndexedDB: Saves successfully
- ❌ Firebase sync: Missing for premium users

**Console Logs to Verify Issue**:
```
[Gamification] Before XP award - Total XP: 116
[Gamification] After XP award - Total XP: 126  ← XP awarded!
[IndexedDB] Saved data for user: 8onZzlQg... ← Saved to IndexedDB
[Gamification State] Loaded from Firebase: {totalXP: 116, ...} ← Old data after refresh!
```

**Pattern to Follow**:
The app uses `isPremiumUser(session?.tier)` helper function from `/src/app/api/review/_middleware/auth.ts` (line 102) to check premium status in API routes:

```typescript
function isPremiumUser(tier?: string): boolean {
  return tier === 'premium_monthly' || tier === 'premium_yearly'
}
```

---

## 📞 Support

**Questions?** Check:
1. This guide (you're reading it!)
2. `/docs/gamification-new/SUPERVISOR-FINAL-APPROVAL.md` (system overview)
3. `/src/hooks/useGamification.ts` (hook source code)
4. `/src/lib/gamification/gamificationListener.ts` (event handling)
5. `/src/state/userGamification.ts` (store implementation)

**Found a bug?**
- Check `/docs/gamification-new/AGENT-4-COMPLETION-REPORT.md` for known issues
- File a new bug report with steps to reproduce

---

**Happy Coding! 🚀**
