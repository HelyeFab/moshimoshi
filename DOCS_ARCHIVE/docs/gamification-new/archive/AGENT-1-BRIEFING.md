# 📋 Agent 1 (Gamification Core) - Mission Briefing

**Agent**: Agent 1 - Backend Implementation Specialist
**Phase**: Phase 2 (Core Implementation)
**Status**: ⏸️ BLOCKED - Waiting for Agent 2 (Config)
**Duration**: 4-5 days
**Dependencies**: Agent 2 must complete configs first

---

## 🎯 Your Mission

Build the gamification core system:
1. **Event Listener** - Subscribe to URE events and calculate XP/streaks
2. **State Management** - Zustand store for gamification data
3. **IndexedDB Storage** - Local persistence for all users
4. **Firebase Sync** - Cloud sync for premium users only

**CRITICAL RULES**:
- ❌ **ZERO modifications** to Universal Review Engine (URE)
- ✅ **Event-driven only** - Listen to URE events, never call into URE
- ✅ **Config-driven** - Load all rules from JSON configs (no hardcoded values)
- ✅ **Feature flag first** - Check `ENABLE_GAMIFICATION` before any logic

---

## 📖 Required Reading (In Order)

### Step 1: Understand the System (60 minutes)
**Read**: `/docs/gamification-new/ARCHITECTURE-OVERVIEW.md`

**Focus on**:
- Section: "System Architecture Diagram" (full event flow)
- Section: "Component Breakdown" → All Agent 1 components
- Section: "Data Flow Scenarios" (3 complete scenarios)
- Section: "Data Persistence Strategy"

**Key Takeaways**:
- URE emits `SESSION_COMPLETED` and `ITEM_ANSWERED` events
- Your listener calculates XP → Updates state → Saves to IndexedDB
- No direct communication with URE code
- Feature flag controls everything

---

### Step 2: Review Your Deliverables (20 minutes)
**Read**: `/docs/gamification-new/QA-MATRIX.md`

**Focus on**:
- Section: "Agent 1: Gamification Core"
- All 4 deliverables (1.1 through 1.4)
- Acceptance criteria for each deliverable

**Key Takeaways**:
- You must deliver: Listener, State, IndexedDB, Tests
- Each has 10+ specific requirements
- Supervisor will review before approval

---

### Step 3: Get Implementation Details (90 minutes)
**Read**: `/docs/gamification-new/IMPLEMENTATION-ROADMAP.md`

**Focus on**:
- Section: "Phase 2: Core Implementation (Agent 1)"
- Steps 2.1 through 2.4 (complete code templates provided)

**Key Takeaways**:
- Exact TypeScript interfaces
- Class structures and method signatures
- Integration patterns with URE events

---

### Step 4: Review URE Events (30 minutes)
**Read**: `src/lib/review-engine/core/events.ts`

**Focus on**:
- `ReviewEventType` enum (lines 12-52)
- `SessionCompletedPayload` interface (lines 119-126)
- `ItemAnsweredPayload` interface (lines 152-171)

**Key Takeaways**:
- `SESSION_COMPLETED` gives you: sessionId, statistics, duration
- Statistics includes: totalItems, correctItems, accuracy, averageResponseTime, bestStreak
- Never modify this file

---

### Step 5: Review Config Files (15 minutes)
**Read**: All Agent 2 config files (wait for Agent 2 to complete)
- `/config/gamification/xp.json`
- `/config/gamification/streak.json`
- `/config/gamification/achievements.json`
- `/config/gamification/levels.json`

**Key Takeaways**:
- You'll import these in your listener
- Config structure determines your calculation logic
- If configs missing, you're blocked - notify Supervisor

---

### Step 6: Understand Collaboration (15 minutes)
**Read**: `/docs/gamification-new/AGENT-COORDINATION.md`

**Focus on**:
- Section: "Agent 1: Gamification Core"
- Section: "Phase 1 → Phase 2 Handoff"
- Section: "Best Practices → For Agent 1 (Core)"

**Key Takeaways**:
- Agent 2 provides configs, you implement logic
- Agent 3 will consume your state via hook
- You're the critical path - UI and QA blocked on you

---

## 📝 Your Deliverables

### Deliverable 1.1: Gamification Listener
**File**: `src/lib/gamification/gamificationListener.ts`

**Class Structure**:
```typescript
import { EventEmitter } from 'events'
import {
  ReviewEventType,
  SessionCompletedPayload,
  ItemAnsweredPayload
} from '@/lib/review-engine/core/events'
import { useGamificationStore } from '@/state/userGamification'
import xpConfig from '@/config/gamification/xp.json'
import streakConfig from '@/config/gamification/streak.json'
import achievementsConfig from '@/config/gamification/achievements.json'

export interface XPCalculationResult {
  baseXP: number
  bonuses: {
    accuracy?: number
    speed?: number
    streak?: number
  }
  totalXP: number
  cappedXP: number
}

export class GamificationListener extends EventEmitter {
  private userId: string | null = null
  private isEnabled: boolean = false

  /**
   * Initialize listener and subscribe to URE events
   */
  initialize(userId: string, reviewEngineEmitter: EventEmitter): void {
    // 1. Check feature flag
    this.isEnabled = process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION === 'true'
    if (!this.isEnabled) {
      console.log('[Gamification] Feature disabled via flag')
      return
    }

    this.userId = userId

    // 2. Subscribe to URE events
    reviewEngineEmitter.on(
      ReviewEventType.SESSION_COMPLETED,
      this.handleSessionCompleted.bind(this)
    )

    reviewEngineEmitter.on(
      ReviewEventType.ITEM_ANSWERED,
      this.handleItemAnswered.bind(this)
    )

    console.log('[Gamification] Listener initialized for user:', userId)
  }

  /**
   * Handle session completion - main XP calculation logic
   */
  private async handleSessionCompleted(event: any): Promise<void> {
    if (!this.isEnabled) return

    const payload = event.data as SessionCompletedPayload
    const { sessionId, statistics, duration } = payload

    console.log('[Gamification] Processing session:', sessionId, statistics)

    // 1. Calculate XP with bonuses
    const xpResult = this.calculateXP(statistics)

    // 2. Award XP to user
    const store = useGamificationStore.getState()
    store.awardXP(xpResult.cappedXP)

    // 3. Check streak eligibility
    if (xpResult.cappedXP >= streakConfig.minXPForStreak) {
      store.incrementStreak()
    }

    // 4. Check achievement conditions
    const unlockedAchievements = await this.checkAchievements(statistics)

    // 5. Emit gamification events for UI
    this.emit('xp.awarded', {
      sessionId,
      xp: xpResult.cappedXP,
      breakdown: xpResult.bonuses
    })

    if (unlockedAchievements.length > 0) {
      unlockedAchievements.forEach(achievement => {
        this.emit('achievement.unlocked', achievement)
      })
    }

    console.log('[Gamification] Session processed:', {
      sessionId,
      xp: xpResult.cappedXP,
      achievements: unlockedAchievements.length
    })
  }

  /**
   * Handle individual item answers (for real-time streak tracking)
   */
  private handleItemAnswered(event: any): void {
    if (!this.isEnabled) return
    // Optional: Track for real-time updates
  }

  /**
   * Calculate XP from session statistics
   * Applies config-driven bonuses
   */
  private calculateXP(statistics: any): XPCalculationResult {
    // Base XP: correct answers × base XP per answer
    const baseXP = statistics.correctItems * xpConfig.baseXP

    const bonuses: XPCalculationResult['bonuses'] = {}

    // Accuracy bonus (iterate tiers from highest to lowest)
    for (const tier of xpConfig.bonuses.accuracy) {
      if (statistics.accuracy >= tier.threshold) {
        bonuses.accuracy = Math.round(baseXP * (tier.multiplier - 1))
        break
      }
    }

    // Speed bonus (average response time)
    if (statistics.averageResponseTime < xpConfig.bonuses.speed.thresholdMs) {
      bonuses.speed = xpConfig.bonuses.speed.bonus
    }

    // Streak bonus (within-session streak)
    if (statistics.bestStreak >= xpConfig.bonuses.streak.minStreak) {
      const streakBonus = statistics.bestStreak * xpConfig.bonuses.streak.bonusPerItem
      bonuses.streak = Math.min(
        streakBonus,
        xpConfig.bonuses.streak.maxBonus || 999999
      )
    }

    // Calculate total
    const bonusTotal = Object.values(bonuses).reduce((sum, val) => sum + (val || 0), 0)
    const totalXP = baseXP + bonusTotal

    // Apply daily XP cap
    const cappedXP = Math.min(totalXP, xpConfig.dailyXPCap)

    return {
      baseXP,
      bonuses,
      totalXP,
      cappedXP
    }
  }

  /**
   * Check which achievements should be unlocked
   */
  private async checkAchievements(statistics: any): Promise<any[]> {
    const store = useGamificationStore.getState()
    const unlocked: any[] = []

    for (const achievement of achievementsConfig.achievements) {
      // Skip already unlocked
      if (store.unlockedAchievements.includes(achievement.id)) {
        continue
      }

      // Evaluate condition
      const isMet = this.evaluateCondition(achievement.condition, statistics, store)

      if (isMet) {
        store.unlockAchievement(achievement.id)
        unlocked.push(achievement)
      }
    }

    return unlocked
  }

  /**
   * Evaluate achievement condition
   */
  private evaluateCondition(condition: any, statistics: any, store: any): boolean {
    const { type, operator, value } = condition

    let currentValue: number

    // Get current value based on condition type
    switch (type) {
      case 'session_count':
        currentValue = store.sessionCount || 0
        break
      case 'streak':
        currentValue = store.currentStreak
        break
      case 'best_streak':
        currentValue = statistics.bestStreak
        break
      case 'level':
        currentValue = store.currentLevel
        break
      case 'kanji_learned':
        // TODO: Integrate with kanji progress tracker
        currentValue = 0
        break
      case 'speed_reviews':
        // TODO: Track count of fast reviews
        currentValue = 0
        break
      case 'time_of_day':
        currentValue = new Date().getHours()
        break
      default:
        return false
    }

    // Apply operator
    switch (operator) {
      case '>=':
        return currentValue >= value
      case '>':
        return currentValue > value
      case '<=':
        return currentValue <= value
      case '<':
        return currentValue < value
      case '==':
        return currentValue === value
      default:
        return false
    }
  }

  /**
   * Clean up and remove event listeners
   */
  destroy(): void {
    this.removeAllListeners()
    this.userId = null
    this.isEnabled = false
    console.log('[Gamification] Listener destroyed')
  }
}

// Singleton instance
export const gamificationListener = new GamificationListener()
```

**Requirements Checklist**:
- [ ] Subscribes to `SESSION_COMPLETED` event
- [ ] Subscribes to `ITEM_ANSWERED` event
- [ ] Calculates XP with all bonuses (accuracy, speed, streak)
- [ ] Applies daily XP cap
- [ ] Checks streak eligibility (≥10 XP)
- [ ] Evaluates achievement conditions
- [ ] Emits `xp.awarded` event
- [ ] Emits `achievement.unlocked` event
- [ ] Feature flag check at initialization
- [ ] No modifications to URE files

---

### Deliverable 1.2: Gamification State
**File**: `src/state/userGamification.ts`

**Implementation** (full template in IMPLEMENTATION-ROADMAP.md Step 2.2):
```typescript
import { create } from 'zustand'
import { indexedDBStore } from '@/lib/gamification/indexedDBStore'

interface GamificationState {
  // State
  totalXP: number
  currentLevel: number // Calculated: floor(totalXP / 1000)
  currentStreak: number
  bestStreak: number
  lastActivityDate: Date | null
  unlockedAchievements: string[]
  achievementProgress: Record<string, number>
  sessionCount: number // NEW: Track for achievements
  lastSyncedAt: Date | null
  isDirty: boolean

  // Actions
  awardXP: (amount: number) => void
  incrementStreak: () => void
  resetStreak: () => void
  unlockAchievement: (id: string) => void
  updateAchievementProgress: (id: string, progress: number) => void
  incrementSessionCount: () => void // NEW
  syncToFirebase: () => Promise<void>
  loadFromIndexedDB: () => Promise<void>
  saveToIndexedDB: () => Promise<void>
  reset: () => void
}

export const useGamificationStore = create<GamificationState>((set, get) => ({
  // Initial state
  totalXP: 0,
  currentLevel: 1,
  currentStreak: 0,
  bestStreak: 0,
  lastActivityDate: null,
  unlockedAchievements: [],
  achievementProgress: {},
  sessionCount: 0,
  lastSyncedAt: null,
  isDirty: false,

  // Actions
  awardXP: (amount) => {
    if (!process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION) return

    set((state) => {
      const newTotalXP = state.totalXP + amount
      const newLevel = Math.max(1, Math.floor(newTotalXP / 1000))

      return {
        totalXP: newTotalXP,
        currentLevel: newLevel,
        lastActivityDate: new Date(),
        isDirty: true
      }
    })

    // Auto-save to IndexedDB
    get().saveToIndexedDB()
  },

  incrementStreak: () => {
    if (!process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION) return

    set((state) => {
      const newStreak = state.currentStreak + 1
      return {
        currentStreak: newStreak,
        bestStreak: Math.max(newStreak, state.bestStreak),
        lastActivityDate: new Date(),
        isDirty: true
      }
    })

    get().saveToIndexedDB()
  },

  resetStreak: () => {
    if (!process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION) return

    set({
      currentStreak: 0,
      isDirty: true
    })

    get().saveToIndexedDB()
  },

  unlockAchievement: (id) => {
    if (!process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION) return

    set((state) => ({
      unlockedAchievements: [...state.unlockedAchievements, id],
      isDirty: true
    }))

    get().saveToIndexedDB()
  },

  updateAchievementProgress: (id, progress) => {
    if (!process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION) return

    set((state) => ({
      achievementProgress: {
        ...state.achievementProgress,
        [id]: progress
      },
      isDirty: true
    }))

    get().saveToIndexedDB()
  },

  incrementSessionCount: () => {
    if (!process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION) return

    set((state) => ({
      sessionCount: state.sessionCount + 1,
      isDirty: true
    }))

    get().saveToIndexedDB()
  },

  syncToFirebase: async () => {
    // TODO: Implement Firebase sync (premium only)
    // For now, just mark as synced
    set({ lastSyncedAt: new Date(), isDirty: false })
  },

  loadFromIndexedDB: async () => {
    const userId = 'current-user' // TODO: Get from auth context
    const data = await indexedDBStore.load(userId)

    if (data) {
      set({
        totalXP: data.totalXP,
        currentLevel: Math.max(1, Math.floor(data.totalXP / 1000)),
        currentStreak: data.currentStreak,
        bestStreak: data.bestStreak,
        lastActivityDate: data.lastActivityDate ? new Date(data.lastActivityDate) : null,
        unlockedAchievements: data.unlockedAchievements,
        achievementProgress: data.achievementProgress,
        sessionCount: data.sessionCount || 0,
        isDirty: false
      })
    }
  },

  saveToIndexedDB: async () => {
    const state = get()
    const userId = 'current-user' // TODO: Get from auth context

    await indexedDBStore.save(userId, {
      userId,
      totalXP: state.totalXP,
      currentStreak: state.currentStreak,
      bestStreak: state.bestStreak,
      lastActivityDate: state.lastActivityDate?.toISOString() || null,
      unlockedAchievements: state.unlockedAchievements,
      achievementProgress: state.achievementProgress,
      sessionCount: state.sessionCount,
      lastSyncedAt: state.lastSyncedAt?.toISOString() || null,
      version: 1
    })
  },

  reset: () => {
    set({
      totalXP: 0,
      currentLevel: 1,
      currentStreak: 0,
      bestStreak: 0,
      lastActivityDate: null,
      unlockedAchievements: [],
      achievementProgress: {},
      sessionCount: 0,
      lastSyncedAt: null,
      isDirty: false
    })
  }
}))
```

**Requirements Checklist**:
- [ ] State includes all required fields
- [ ] `awardXP()` updates totalXP and level
- [ ] `incrementStreak()` updates streak
- [ ] `resetStreak()` sets streak to 0
- [ ] `unlockAchievement()` adds to array
- [ ] `incrementSessionCount()` tracks sessions
- [ ] Feature flag checked in all actions
- [ ] Auto-save to IndexedDB on state change
- [ ] `loadFromIndexedDB()` restores state
- [ ] Level calculated correctly: `floor(totalXP / 1000)`

---

### Deliverable 1.3: IndexedDB Store
**File**: `src/lib/gamification/indexedDBStore.ts`

**Implementation** (full template in IMPLEMENTATION-ROADMAP.md Step 2.1):
```typescript
const DB_NAME = 'moshimoshi_gamification'
const DB_VERSION = 1
const STORE_NAME = 'userGamification'

export interface GamificationData {
  userId: string
  totalXP: number
  currentStreak: number
  bestStreak: number
  lastActivityDate: string | null
  unlockedAchievements: string[]
  achievementProgress: Record<string, number>
  sessionCount: number
  lastSyncedAt: string | null
  version: number
}

export class IndexedDBStore {
  private db: IDBDatabase | null = null

  async open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve(this.db)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'userId' })
          objectStore.createIndex('userId', 'userId', { unique: true })
        }
      }
    })
  }

  async save(userId: string, data: GamificationData): Promise<void> {
    try {
      if (!this.db) await this.open()

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
        const objectStore = transaction.objectStore(STORE_NAME)
        const request = objectStore.put(data)

        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        this.handleQuotaExceeded()
      }
      throw error
    }
  }

  async load(userId: string): Promise<GamificationData | null> {
    if (!this.db) await this.open()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const objectStore = transaction.objectStore(STORE_NAME)
      const request = objectStore.get(userId)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  async clear(userId: string): Promise<void> {
    if (!this.db) await this.open()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const objectStore = transaction.objectStore(STORE_NAME)
      const request = objectStore.delete(userId)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async clearAll(): Promise<void> {
    if (!this.db) await this.open()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const objectStore = transaction.objectStore(STORE_NAME)
      const request = objectStore.clear()

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  private handleQuotaExceeded(): void {
    console.error('[IndexedDB] Quota exceeded. Clearing old data...')
    // Could implement LRU eviction here
  }
}

export const indexedDBStore = new IndexedDBStore()
```

**Requirements Checklist**:
- [ ] Database opens successfully
- [ ] `save()` stores data
- [ ] `load()` retrieves data
- [ ] `clear()` removes data
- [ ] `clearAll()` removes all data
- [ ] Handles quota exceeded errors
- [ ] Supports multiple users (keyPath: userId)

---

### Deliverable 1.4: Unit Tests
**File**: `src/lib/gamification/__tests__/gamificationListener.test.ts`

**Test Cases** (see QA-MATRIX.md for complete list):
```typescript
import { gamificationListener, XPCalculationResult } from '../gamificationListener'
import { useGamificationStore } from '@/state/userGamification'
import { EventEmitter } from 'events'
import { ReviewEventType } from '@/lib/review-engine/core/events'

describe('GamificationListener', () => {
  let mockEmitter: EventEmitter

  beforeEach(() => {
    mockEmitter = new EventEmitter()
    process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION = 'true'
    useGamificationStore.getState().reset()
  })

  describe('Initialization', () => {
    it('should initialize with feature flag ON', () => {
      gamificationListener.initialize('user123', mockEmitter)
      // Assert listeners attached
    })

    it('should not initialize with feature flag OFF', () => {
      process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION = 'false'
      gamificationListener.initialize('user123', mockEmitter)
      // Assert no listeners attached
    })
  })

  describe('XP Calculation', () => {
    it('should calculate base XP correctly', () => {
      const statistics = {
        correctItems: 10,
        accuracy: 70,
        averageResponseTime: 5000,
        bestStreak: 5
      }

      const result = gamificationListener['calculateXP'](statistics)
      expect(result.baseXP).toBe(100) // 10 * 10
    })

    it('should apply accuracy bonus for 90%+', () => {
      const statistics = {
        correctItems: 10,
        accuracy: 95,
        averageResponseTime: 5000,
        bestStreak: 5
      }

      const result = gamificationListener['calculateXP'](statistics)
      expect(result.bonuses.accuracy).toBe(30) // 100 * (1.3 - 1)
    })

    it('should apply speed bonus for <3s average', () => {
      const statistics = {
        correctItems: 10,
        accuracy: 70,
        averageResponseTime: 2500,
        bestStreak: 5
      }

      const result = gamificationListener['calculateXP'](statistics)
      expect(result.bonuses.speed).toBe(5)
    })

    it('should apply streak bonus for 10+ streak', () => {
      const statistics = {
        correctItems: 10,
        accuracy: 70,
        averageResponseTime: 5000,
        bestStreak: 12
      }

      const result = gamificationListener['calculateXP'](statistics)
      expect(result.bonuses.streak).toBe(24) // 12 * 2
    })

    it('should cap daily XP at 500', () => {
      const statistics = {
        correctItems: 100,
        accuracy: 100,
        averageResponseTime: 2000,
        bestStreak: 50
      }

      const result = gamificationListener['calculateXP'](statistics)
      expect(result.cappedXP).toBe(500) // Capped
    })
  })

  describe('Streak Logic', () => {
    it('should increment streak when XP ≥ 10', () => {
      // Test implementation
    })

    it('should not increment streak when XP < 10', () => {
      // Test implementation
    })

    it('should reset streak on missed day', () => {
      // Test implementation
    })
  })

  describe('Achievement Conditions', () => {
    it('should evaluate session_count condition', () => {
      // Test implementation
    })

    it('should evaluate streak condition', () => {
      // Test implementation
    })

    it('should evaluate best_streak condition', () => {
      // Test implementation
    })

    it('should evaluate level condition', () => {
      // Test implementation
    })

    it('should evaluate time_of_day condition', () => {
      // Test implementation
    })
  })

  describe('Feature Flag', () => {
    it('should block all logic when flag is OFF', () => {
      process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION = 'false'
      // Test that no XP awarded, no events emitted
    })
  })
})
```

**Run Tests**:
```bash
npm test src/lib/gamification/__tests__/
```

All tests must pass before handoff.

---

## 🚀 Step-by-Step Execution

### Day 1: IndexedDB + State (3-4 hours)
1. Create `indexedDBStore.ts`
2. Test IndexedDB operations manually
3. Create `userGamification.ts` (Zustand store)
4. Test state mutations
5. Integrate: State calls IndexedDB on changes

---

### Day 2: Gamification Listener (6-7 hours)
1. Create `gamificationListener.ts` skeleton
2. Implement `initialize()` with feature flag check
3. Implement `calculateXP()` with all bonuses
4. Implement `checkAchievements()` with condition evaluation
5. Implement `handleSessionCompleted()`
6. Test with mock URE events

---

### Day 3: Integration + Testing (4-5 hours)
1. Wire up listener to actual URE (find where URE emits events)
2. Test end-to-end: URE event → XP awarded → State updated → IndexedDB saved
3. Write unit tests for XP calculation
4. Write unit tests for achievement conditions
5. Write unit tests for feature flag behavior

---

### Day 4: Firebase Sync (Optional, 3-4 hours)
1. Implement `syncToFirebase()` in state
2. Create Firestore collection: `users/{uid}/gamification`
3. Test sync for premium users
4. Handle sync failures gracefully

---

### Day 5: Polish + Documentation (2-3 hours)
1. Add console logging for debugging
2. Handle edge cases (negative XP, invalid data)
3. Add TypeScript JSDoc comments
4. Update README in `/lib/gamification/`
5. Self-review against checklist

---

## ❓ Common Questions

**Q: Where does URE emit events?**
**A**: Look in `src/lib/review-engine/session/manager.ts` - search for `.emit(ReviewEventType.SESSION_COMPLETED`

**Q: How do I get the current user ID?**
**A**: Import from `@/hooks/useAuth` - `const { user } = useAuth()` - `user.uid`

**Q: What if feature flag is undefined?**
**A**: Treat as OFF (false). Safe default.

**Q: What if configs are missing?**
**A**: Your build will fail. This means Agent 2 hasn't finished. Notify Supervisor.

**Q: Can I modify URE event payloads?**
**A**: NO. Never touch URE code. Only read events.

**Q: What if I need to track additional data for achievements?**
**A**: Add it to state schema. Update IndexedDB interface. Document in handoff.

---

## 🎯 Success Criteria

You're done when:
- [ ] All 3 core files created and compile successfully
- [ ] Feature flag enforced in all logic
- [ ] No URE modifications (verified by Supervisor)
- [ ] Unit tests written and passing (≥90% coverage)
- [ ] XP calculation matches config exactly
- [ ] Streak logic works (≥10 XP/day threshold)
- [ ] Achievement conditions evaluate correctly
- [ ] IndexedDB saves/loads work
- [ ] Manual testing complete (see below)
- [ ] Handoff document created for Agent 3

---

## 🧪 Manual Testing Checklist

Before calling yourself done:

```typescript
// Test 1: Feature flag OFF
process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION = 'false'
// Complete a review session
// Verify: No XP awarded, no events emitted

// Test 2: Feature flag ON
process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION = 'true'
// Complete a review session with 10 correct answers, 90% accuracy
// Verify:
// - Base XP = 100 (10 * 10)
// - Accuracy bonus applied
// - Total XP > 100
// - State updated
// - IndexedDB saved

// Test 3: Streak increment
// Complete session with 15 XP
// Verify: Streak increments by 1

// Test 4: Streak unchanged
// Complete session with 5 XP
// Verify: Streak stays same

// Test 5: Achievement unlock
// Complete first session
// Verify: "first_session" achievement unlocked

// Test 6: IndexedDB persistence
// Award 500 XP
// Refresh page
// Load from IndexedDB
// Verify: 500 XP still there

// Test 7: Level calculation
// Award 2500 XP total
// Verify: Level = 2 (floor(2500/1000))
```

---

## 📤 Handoff to Agent 3 (UI)

### When You're Done
1. All tests passing
2. Manual testing complete
3. Update QA-MATRIX.md with your sign-off
4. Create handoff document

### Handoff Document Template
**File**: `/docs/gamification-new/AGENT-3-BRIEFING.md`

```markdown
# Agent 3 Handoff: Core Complete

## Status
Agent 1 (Core) has completed all deliverables.

## What I Delivered
1. Gamification Listener (`src/lib/gamification/gamificationListener.ts`)
2. Gamification State (`src/state/userGamification.ts`)
3. IndexedDB Store (`src/lib/gamification/indexedDBStore.ts`)
4. Unit tests (100% passing)

## How to Use the State

Import the hook:
\`\`\`typescript
import { useGamificationStore } from '@/state/userGamification'
\`\`\`

Access state:
\`\`\`typescript
const store = useGamificationStore()
console.log(store.totalXP) // Current XP
console.log(store.currentLevel) // Current level
console.log(store.currentStreak) // Current streak
\`\`\`

## Important Notes
1. State auto-saves to IndexedDB on every change
2. Call `loadFromIndexedDB()` once on app mount
3. Feature flag returns defaults when OFF
4. Level is calculated automatically: `floor(totalXP / 1000)`
5. Streak increments only when session earns ≥10 XP

## Questions?
Ask me or Supervisor.

Signed: Agent 1
Date: [Today's date]
\`\`\`

---

## 📞 Need Help?

**Supervisor**: Available for architecture questions, code review
**Agent 2**: Available for config clarifications
**Agent 3**: Can start asking integration questions now

---

## 🎉 You're the Critical Path!

UI and QA are blocked on you. Your work enables the entire system.

**Estimated Time**: 4-5 days
**Your Focus**: Event-driven, config-driven, feature-flagged, tested

Good luck! 🚀

**Signed**: Agent 5 (Supervisor)
**Date**: 2025-10-02
