# 📋 Agent 4 (QA & Observability) - Mission Briefing

**Agent**: Agent 4 - Quality Assurance Engineer
**Phase**: Phase 4 (QA & Observability)
**Status**: ⏸️ BLOCKED - Waiting for Agents 1, 2, 3
**Duration**: 3-4 days
**Dependencies**: Full system must exist (Config + Core + UI)

---

## 🎯 Your Mission

Ensure the gamification system is **production-ready** through comprehensive testing and observability. You are the **last line of defense** before launch.

**Critical**: Find bugs before users do. Verify the system works in all scenarios (flag ON/OFF, errors, edge cases).

---

## 📖 Required Reading (In Order)

### Step 1: Understand What You're Testing (60 minutes)
**Read**: `/docs/gamification-new/ARCHITECTURE-OVERVIEW.md`

**Focus on**:
- Section: "System Architecture Diagram" (end-to-end flow)
- Section: "Data Flow Scenarios" (all 3 scenarios)
- Section: "Performance Requirements" (your benchmarks)
- Section: "Testing Strategy"

**Key Takeaways**:
- Full flow: URE event → Listener → State → IndexedDB → UI
- 3 critical paths: Session completion, Streak reset, Achievement unlock
- Performance targets: XP calc <10ms, IndexedDB <2ms, etc.

---

### Step 2: Review Your Deliverables (20 minutes)
**Read**: `/docs/gamification-new/QA-MATRIX.md`

**Focus on**:
- Section: "Agent 4: QA & Observability"
- All 4 deliverables (4.1 through 4.4)
- All test case requirements

**Key Takeaways**:
- You must deliver: Telemetry + Unit tests + Integration tests + E2E tests
- Code coverage target: ≥80%
- All test types must pass 100%

---

### Step 3: Get Testing Requirements (90 minutes)
**Read**: `/docs/gamification-new/IMPLEMENTATION-ROADMAP.md`

**Focus on**:
- Section: "Phase 4: QA & Observability (Agent 4)"
- All test case specifications
- Performance benchmark requirements

**Key Takeaways**:
- Test categories: Unit, Integration, E2E
- Feature flag testing critical
- Performance regression prevention

---

### Step 4: Review All Previous Work (60 minutes)
**Read**: Completion reports from Agents 1, 2, 3

**Files**:
- Agent 2: `/docs/gamification-new/AGENT-2-COMPLETION-REPORT.md`
- Agent 1: Handoff document (when available)
- Agent 3: Handoff document (when available)

**Key Takeaways**:
- What each agent delivered
- Known limitations
- Areas needing extra testing

---

### Step 5: Understand Collaboration (15 minutes)
**Read**: `/docs/gamification-new/AGENT-COORDINATION.md`

**Focus on**:
- Section: "Agent 4: QA & Observability"
- Section: "Phase 4 → Phase 5 Handoff"
- Section: "Best Practices → For Agent 4 (QA)"

**Key Takeaways**:
- You find bugs, agents fix them
- You provide final quality sign-off
- Supervisor reviews your test results

---

## 📝 Your Deliverables

### Deliverable 4.1: Telemetry System
**File**: `src/lib/telemetry/gamificationMetrics.ts`

**Requirements**:
```typescript
import { gamificationListener } from '@/lib/gamification/gamificationListener'

export interface GamificationMetric {
  timestamp: Date
  event: string
  data: Record<string, any>
  userId?: string
}

export class GamificationMetrics {
  private metrics: GamificationMetric[] = []
  private isEnabled: boolean

  constructor() {
    this.isEnabled = process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION === 'true'
  }

  /**
   * Initialize telemetry and listen to gamification events
   */
  initialize(): void {
    if (!this.isEnabled) return

    // Listen to XP awarded events
    gamificationListener.on('xp.awarded', (data) => {
      this.logMetric('xp_awarded', {
        sessionId: data.sessionId,
        xp: data.xp,
        breakdown: data.breakdown
      })
    })

    // Listen to achievement unlocked events
    gamificationListener.on('achievement.unlocked', (data) => {
      this.logMetric('achievement_unlocked', {
        achievementId: data.id,
        achievementName: data.name,
        category: data.category,
        points: data.points
      })
    })

    console.log('[GamificationMetrics] Telemetry initialized')
  }

  /**
   * Log a gamification metric
   */
  logMetric(event: string, data: Record<string, any>): void {
    if (!this.isEnabled) return

    const metric: GamificationMetric = {
      timestamp: new Date(),
      event,
      data
    }

    this.metrics.push(metric)

    // Console log for debugging
    console.log(`[Gamification Metric] ${event}:`, data)

    // Could send to analytics service here
    // analytics.track(event, data)
  }

  /**
   * Get all metrics (for debugging/dashboard)
   */
  getMetrics(): GamificationMetric[] {
    return this.metrics
  }

  /**
   * Get metrics by event type
   */
  getMetricsByEvent(event: string): GamificationMetric[] {
    return this.metrics.filter(m => m.event === event)
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = []
  }

  /**
   * Export metrics to JSON (for dashboard mock)
   */
  exportMetrics(): string {
    return JSON.stringify({
      totalMetrics: this.metrics.length,
      events: this.getEventCounts(),
      metrics: this.metrics
    }, null, 2)
  }

  /**
   * Get count of each event type
   */
  private getEventCounts(): Record<string, number> {
    const counts: Record<string, number> = {}

    this.metrics.forEach(metric => {
      counts[metric.event] = (counts[metric.event] || 0) + 1
    })

    return counts
  }
}

export const gamificationMetrics = new GamificationMetrics()
```

**Mock Dashboard JSON** (`docs/gamification/metrics-dashboard.json`):
```json
{
  "totalMetrics": 150,
  "period": "last_24h",
  "events": {
    "xp_awarded": 120,
    "achievement_unlocked": 30
  },
  "summary": {
    "totalXPAwarded": 12450,
    "avgXPPerSession": 103.75,
    "achievementsUnlocked": 30,
    "uniqueUsers": 45
  },
  "topEvents": [
    {
      "event": "xp_awarded",
      "count": 120,
      "avgValue": 103.75
    },
    {
      "event": "achievement_unlocked",
      "count": 30,
      "mostCommon": "first_session"
    }
  ]
}
```

**Requirements Checklist**:
- [ ] Logs XP awarded events (amount, breakdown)
- [ ] Logs streak incremented events
- [ ] Logs streak reset events
- [ ] Logs achievement unlocked events (id, name, category)
- [ ] Metric: Total XP awarded per day
- [ ] Metric: Streak increments per day
- [ ] Metric: Achievement unlock rate
- [ ] Mock dashboard JSON created
- [ ] Feature flag disables logging when OFF

---

### Deliverable 4.2: Unit Tests
**File**: `tests/unit/gamification.test.ts`

**Test Categories**:

#### XP Calculation Tests
```typescript
import { gamificationListener } from '@/lib/gamification/gamificationListener'

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
    expect(result.totalXP).toBe(100) // No bonuses
  })

  it('should apply accuracy bonus at 90%', () => {
    const statistics = {
      correctItems: 10,
      accuracy: 90,
      averageResponseTime: 5000,
      bestStreak: 5
    }

    const result = gamificationListener['calculateXP'](statistics)
    expect(result.bonuses.accuracy).toBe(30) // 100 * (1.3 - 1)
    expect(result.totalXP).toBe(130) // 100 + 30
  })

  it('should apply accuracy bonus at 100%', () => {
    const statistics = {
      correctItems: 10,
      accuracy: 100,
      averageResponseTime: 5000,
      bestStreak: 5
    }

    const result = gamificationListener['calculateXP'](statistics)
    expect(result.bonuses.accuracy).toBe(50) // 100 * (1.5 - 1)
    expect(result.totalXP).toBe(150)
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
    expect(result.totalXP).toBe(105) // 100 + 5
  })

  it('should not apply speed bonus for >=3s average', () => {
    const statistics = {
      correctItems: 10,
      accuracy: 70,
      averageResponseTime: 3500,
      bestStreak: 5
    }

    const result = gamificationListener['calculateXP'](statistics)
    expect(result.bonuses.speed).toBeUndefined()
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
    expect(result.totalXP).toBe(124) // 100 + 24
  })

  it('should cap streak bonus at 50', () => {
    const statistics = {
      correctItems: 10,
      accuracy: 70,
      averageResponseTime: 5000,
      bestStreak: 50
    }

    const result = gamificationListener['calculateXP'](statistics)
    expect(result.bonuses.streak).toBe(50) // Capped at 50
  })

  it('should apply daily XP cap at 500', () => {
    const statistics = {
      correctItems: 100,
      accuracy: 100,
      averageResponseTime: 2000,
      bestStreak: 50
    }

    const result = gamificationListener['calculateXP'](statistics)
    expect(result.totalXP).toBeGreaterThan(500)
    expect(result.cappedXP).toBe(500) // Capped
  })

  it('should apply all bonuses together', () => {
    const statistics = {
      correctItems: 10,
      accuracy: 100,
      averageResponseTime: 2500,
      bestStreak: 12
    }

    const result = gamificationListener['calculateXP'](statistics)
    // Base: 100
    // Accuracy: 50 (100 * 0.5)
    // Speed: 5
    // Streak: 24 (12 * 2)
    // Total: 179
    expect(result.totalXP).toBe(179)
    expect(result.cappedXP).toBe(179) // Under cap
  })
})
```

#### Streak Logic Tests
```typescript
import { useGamificationStore } from '@/state/userGamification'

describe('Streak Logic', () => {
  beforeEach(() => {
    useGamificationStore.getState().reset()
  })

  it('should increment streak when XP >= 10', () => {
    const store = useGamificationStore.getState()

    store.awardXP(15)
    // Manually increment streak (listener would do this)
    store.incrementStreak()

    expect(store.currentStreak).toBe(1)
  })

  it('should not increment streak when XP < 10', () => {
    const store = useGamificationStore.getState()

    store.awardXP(5)
    // Listener would NOT increment streak

    expect(store.currentStreak).toBe(0)
  })

  it('should reset streak to 0', () => {
    const store = useGamificationStore.getState()

    store.incrementStreak()
    store.incrementStreak()
    store.incrementStreak()
    expect(store.currentStreak).toBe(3)

    store.resetStreak()
    expect(store.currentStreak).toBe(0)
  })

  it('should update best streak', () => {
    const store = useGamificationStore.getState()

    store.incrementStreak() // 1
    store.incrementStreak() // 2
    store.incrementStreak() // 3

    expect(store.bestStreak).toBe(3)

    store.resetStreak()
    store.incrementStreak() // 1
    store.incrementStreak() // 2

    expect(store.currentStreak).toBe(2)
    expect(store.bestStreak).toBe(3) // Still 3
  })
})
```

#### Achievement Condition Tests
```typescript
import { gamificationListener } from '@/lib/gamification/gamificationListener'
import achievementsConfig from '@/config/gamification/achievements.json'

describe('Achievement Conditions', () => {
  it('should evaluate session_count condition', () => {
    const condition = { type: 'session_count', operator: '>=', value: 1 }
    const statistics = {}
    const store = { sessionCount: 1 }

    const result = gamificationListener['evaluateCondition'](condition, statistics, store)
    expect(result).toBe(true)
  })

  it('should evaluate streak condition', () => {
    const condition = { type: 'streak', operator: '>=', value: 7 }
    const statistics = {}
    const store = { currentStreak: 7 }

    const result = gamificationListener['evaluateCondition'](condition, statistics, store)
    expect(result).toBe(true)
  })

  it('should evaluate best_streak condition', () => {
    const condition = { type: 'best_streak', operator: '>=', value: 10 }
    const statistics = { bestStreak: 12 }
    const store = {}

    const result = gamificationListener['evaluateCondition'](condition, statistics, store)
    expect(result).toBe(true)
  })

  it('should evaluate level condition', () => {
    const condition = { type: 'level', operator: '>=', value: 10 }
    const statistics = {}
    const store = { currentLevel: 10 }

    const result = gamificationListener['evaluateCondition'](condition, statistics, store)
    expect(result).toBe(true)
  })

  it('should evaluate time_of_day condition (early bird)', () => {
    const condition = { type: 'time_of_day', operator: '<', value: 6 }
    const statistics = {}
    const store = {}

    // Mock current hour to 5 AM
    jest.spyOn(Date.prototype, 'getHours').mockReturnValue(5)

    const result = gamificationListener['evaluateCondition'](condition, statistics, store)
    expect(result).toBe(true)
  })

  it('should evaluate time_of_day condition (night owl)', () => {
    const condition = { type: 'time_of_day', operator: '>=', value: 22 }
    const statistics = {}
    const store = {}

    // Mock current hour to 11 PM (23:00)
    jest.spyOn(Date.prototype, 'getHours').mockReturnValue(23)

    const result = gamificationListener['evaluateCondition'](condition, statistics, store)
    expect(result).toBe(true)
  })

  it('should test all 10 achievement conditions from config', () => {
    achievementsConfig.achievements.forEach(achievement => {
      const condition = achievement.condition

      // Verify condition has required fields
      expect(condition.type).toBeDefined()
      expect(condition.operator).toBeDefined()
      expect(condition.value).toBeDefined()

      // Verify operator is valid
      expect(['>=', '>', '<=', '<', '==']).toContain(condition.operator)
    })
  })
})
```

#### Level Calculation Tests
```typescript
import levelsConfig from '@/config/gamification/levels.json'

describe('Level Calculation', () => {
  it('should calculate level correctly', () => {
    const testCases = [
      { xp: 0, expectedLevel: 1 }, // Min level is 1
      { xp: 500, expectedLevel: 1 },
      { xp: 1000, expectedLevel: 1 },
      { xp: 1001, expectedLevel: 2 },
      { xp: 2000, expectedLevel: 2 },
      { xp: 2001, expectedLevel: 3 },
      { xp: 10000, expectedLevel: 10 },
      { xp: 25000, expectedLevel: 25 },
      { xp: 99000, expectedLevel: 99 },
      { xp: 100000, expectedLevel: 100 }, // Max level
      { xp: 150000, expectedLevel: 100 }, // Capped
    ]

    testCases.forEach(({ xp, expectedLevel }) => {
      const calculatedLevel = Math.max(1, Math.floor(xp / levelsConfig.xpPerLevel))
      const cappedLevel = Math.min(calculatedLevel, levelsConfig.maxLevel)
      expect(cappedLevel).toBe(expectedLevel)
    })
  })
})
```

#### Feature Flag Tests
```typescript
import { gamificationListener } from '@/lib/gamification/gamificationListener'
import { useGamificationStore } from '@/state/userGamification'

describe('Feature Flag', () => {
  it('should block listener when flag is OFF', () => {
    process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION = 'false'

    const listener = new gamificationListener()
    // Should not initialize
  })

  it('should block state mutations when flag is OFF', () => {
    process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION = 'false'

    const store = useGamificationStore.getState()
    const initialXP = store.totalXP

    store.awardXP(100)

    expect(store.totalXP).toBe(initialXP) // Unchanged
  })

  it('should return defaults in hook when flag is OFF', () => {
    process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION = 'false'

    const { result } = renderHook(() => useGamification())

    expect(result.current.totalXP).toBe(0)
    expect(result.current.currentLevel).toBe(1)
    expect(result.current.isEnabled).toBe(false)
  })
})
```

**Requirements**: All unit tests must pass (≥90% coverage on gamification code)

---

### Deliverable 4.3: Integration Tests
**File**: `tests/integration/gamification.test.ts`

**Test Scenarios**:

```typescript
import { EventEmitter } from 'events'
import { ReviewEventType } from '@/lib/review-engine/core/events'
import { gamificationListener } from '@/lib/gamification/gamificationListener'
import { useGamificationStore } from '@/state/userGamification'
import { indexedDBStore } from '@/lib/gamification/indexedDBStore'

describe('Gamification Integration', () => {
  let mockURE: EventEmitter

  beforeEach(async () => {
    // Reset state
    useGamificationStore.getState().reset()
    await indexedDBStore.clearAll()

    // Create mock URE emitter
    mockURE = new EventEmitter()

    // Initialize listener
    gamificationListener.initialize('test-user', mockURE)
  })

  afterEach(() => {
    gamificationListener.destroy()
  })

  describe('URE → Listener → State Flow', () => {
    it('should award XP when URE emits SESSION_COMPLETED', async () => {
      const store = useGamificationStore.getState()
      const initialXP = store.totalXP

      // Mock URE event
      mockURE.emit(ReviewEventType.SESSION_COMPLETED, {
        data: {
          sessionId: 'test-session',
          statistics: {
            correctItems: 10,
            accuracy: 90,
            averageResponseTime: 4000,
            bestStreak: 5
          },
          duration: 60000
        }
      })

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify XP awarded
      expect(store.totalXP).toBeGreaterThan(initialXP)
      expect(store.totalXP).toBe(130) // 100 + 30 accuracy bonus
    })

    it('should increment streak when XP >= 10', async () => {
      const store = useGamificationStore.getState()

      mockURE.emit(ReviewEventType.SESSION_COMPLETED, {
        data: {
          sessionId: 'test-session',
          statistics: {
            correctItems: 5,
            accuracy: 70,
            averageResponseTime: 5000,
            bestStreak: 3
          },
          duration: 30000
        }
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(store.currentStreak).toBe(1)
    })

    it('should not increment streak when XP < 10', async () => {
      const store = useGamificationStore.getState()

      mockURE.emit(ReviewEventType.SESSION_COMPLETED, {
        data: {
          sessionId: 'test-session',
          statistics: {
            correctItems: 0,
            accuracy: 0,
            averageResponseTime: 5000,
            bestStreak: 0
          },
          duration: 10000
        }
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(store.currentStreak).toBe(0) // Not incremented
    })
  })

  describe('State → IndexedDB Persistence', () => {
    it('should save to IndexedDB when XP awarded', async () => {
      const store = useGamificationStore.getState()

      store.awardXP(500)

      // Wait for auto-save
      await new Promise(resolve => setTimeout(resolve, 100))

      // Load from IndexedDB
      const savedData = await indexedDBStore.load('test-user')

      expect(savedData).toBeDefined()
      expect(savedData!.totalXP).toBe(500)
    })

    it('should load from IndexedDB on mount', async () => {
      // Save data
      await indexedDBStore.save('test-user', {
        userId: 'test-user',
        totalXP: 1234,
        currentStreak: 5,
        bestStreak: 10,
        lastActivityDate: new Date().toISOString(),
        unlockedAchievements: ['first_session'],
        achievementProgress: {},
        sessionCount: 15,
        lastSyncedAt: null,
        version: 1
      })

      // Load into store
      const store = useGamificationStore.getState()
      await store.loadFromIndexedDB()

      expect(store.totalXP).toBe(1234)
      expect(store.currentStreak).toBe(5)
      expect(store.unlockedAchievements).toContain('first_session')
    })
  })

  describe('Achievement Unlock Flow', () => {
    it('should unlock achievement when condition met', async () => {
      const store = useGamificationStore.getState()

      // Mock first session
      mockURE.emit(ReviewEventType.SESSION_COMPLETED, {
        data: {
          sessionId: 'first-session',
          statistics: {
            correctItems: 5,
            accuracy: 80,
            averageResponseTime: 4000,
            bestStreak: 3
          },
          duration: 30000
        }
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      // "first_session" achievement should unlock
      expect(store.unlockedAchievements).toContain('first_session')
    })

    it('should not unlock achievement twice', async () => {
      const store = useGamificationStore.getState()

      // Complete two sessions
      mockURE.emit(ReviewEventType.SESSION_COMPLETED, {
        data: {
          sessionId: 'session-1',
          statistics: { correctItems: 5, accuracy: 80, averageResponseTime: 4000, bestStreak: 3 },
          duration: 30000
        }
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      const unlockCount1 = store.unlockedAchievements.filter(id => id === 'first_session').length

      mockURE.emit(ReviewEventType.SESSION_COMPLETED, {
        data: {
          sessionId: 'session-2',
          statistics: { correctItems: 5, accuracy: 80, averageResponseTime: 4000, bestStreak: 3 },
          duration: 30000
        }
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      const unlockCount2 = store.unlockedAchievements.filter(id => id === 'first_session').length

      expect(unlockCount2).toBe(unlockCount1) // Still only 1
    })
  })

  describe('Feature Flag Toggle', () => {
    it('should disable system when flag is OFF', () => {
      process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION = 'false'

      const mockURE2 = new EventEmitter()
      gamificationListener.initialize('test-user-2', mockURE2)

      const store = useGamificationStore.getState()
      const initialXP = store.totalXP

      // Emit event
      mockURE2.emit(ReviewEventType.SESSION_COMPLETED, {
        data: {
          sessionId: 'test',
          statistics: { correctItems: 10, accuracy: 90, averageResponseTime: 4000, bestStreak: 5 },
          duration: 60000
        }
      })

      // XP should NOT change
      expect(store.totalXP).toBe(initialXP)
    })
  })
})
```

**Requirements**: All integration tests must pass

---

### Deliverable 4.4: E2E Tests
**File**: `tests/e2e/gamification.spec.ts`

**Test Scenarios** (using Playwright or Cypress):

```typescript
import { test, expect } from '@playwright/test'

test.describe('Gamification E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Enable feature flag
    await page.addInitScript(() => {
      localStorage.setItem('ENABLE_GAMIFICATION', 'true')
    })

    // Clear gamification data
    await page.addInitScript(() => {
      indexedDB.deleteDatabase('moshimoshi_gamification')
    })
  })

  test('Complete review session → XP awarded', async ({ page }) => {
    // Navigate to review page
    await page.goto('/review')

    // Complete 10 review items (mock interaction)
    // This depends on your review UI implementation
    for (let i = 0; i < 10; i++) {
      await page.click('[data-testid="answer-correct"]')
      await page.click('[data-testid="next-item"]')
    }

    // Complete session
    await page.click('[data-testid="finish-session"]')

    // Navigate to profile
    await page.goto('/account')

    // Verify XP displayed
    await expect(page.locator('[data-testid="xp-display"]')).toContainText('100')
  })

  test('Earn ≥10 XP → Streak increments', async ({ page }) => {
    // Complete session earning 15 XP
    await page.goto('/review')
    // ... complete session ...

    // Check profile
    await page.goto('/account')

    await expect(page.locator('[data-testid="streak-display"]')).toContainText('1')
  })

  test('7-day streak → Week Warrior unlocks', async ({ page }) => {
    // Simulate 7 consecutive days of practice
    for (let day = 0; day < 7; day++) {
      // Mock date
      await page.addInitScript((dayOffset) => {
        Date.now = () => new Date(2025, 0, 1 + dayOffset).getTime()
      }, day)

      // Complete session
      await page.goto('/review')
      // ... complete session earning ≥10 XP ...
    }

    // Check achievements page
    await page.goto('/achievements')

    // Verify "Week Warrior" is unlocked
    await expect(page.locator('[data-achievement-id="week_warrior"]')).toHaveClass(/unlocked/)
  })

  test('Feature flag OFF → No gamification UI', async ({ page }) => {
    // Disable feature flag
    await page.addInitScript(() => {
      localStorage.setItem('ENABLE_GAMIFICATION', 'false')
    })

    // Navigate to profile
    await page.goto('/account')

    // Gamification section should not be visible
    await expect(page.locator('[data-testid="gamification-section"]')).not.toBeVisible()
  })

  test('Profile page displays correct XP/level/streak', async ({ page }) => {
    // Set up data (1500 XP, 5 streak)
    await page.addInitScript(() => {
      localStorage.setItem('gamification_data', JSON.stringify({
        totalXP: 1500,
        currentStreak: 5,
        bestStreak: 10
      }))
    })

    await page.goto('/account')

    await expect(page.locator('[data-testid="xp-display"]')).toContainText('1500')
    await expect(page.locator('[data-testid="level-display"]')).toContainText('Level 1')
    await expect(page.locator('[data-testid="streak-display"]')).toContainText('5')
  })

  test('Achievements page shows unlocked badges', async ({ page }) => {
    // Set up unlocked achievements
    await page.addInitScript(() => {
      localStorage.setItem('unlocked_achievements', JSON.stringify([
        'first_session',
        'week_warrior'
      ]))
    })

    await page.goto('/achievements')

    // Verify unlocked
    await expect(page.locator('[data-achievement-id="first_session"]')).toHaveClass(/unlocked/)
    await expect(page.locator('[data-achievement-id="week_warrior"]')).toHaveClass(/unlocked/)

    // Verify locked
    await expect(page.locator('[data-achievement-id="centurion"]')).toHaveClass(/locked/)
  })

  test('Leaderboard displays mock data banner', async ({ page }) => {
    await page.goto('/leaderboard')

    // Verify banner is visible
    await expect(page.locator('[data-testid="mock-data-banner"]')).toBeVisible()
    await expect(page.locator('[data-testid="mock-data-banner"]')).toContainText('mock data')
  })
})
```

**Requirements**: All E2E tests must pass

---

## 🚀 Step-by-Step Execution

### Day 1: Telemetry & Unit Tests (6-7 hours)

**Morning (3-4 hours): Telemetry**
1. Create `src/lib/telemetry/gamificationMetrics.ts`
2. Implement metric logging
3. Hook up to gamification listener events
4. Test metrics collection
5. Create mock dashboard JSON

**Afternoon (3-4 hours): Unit Tests Setup**
1. Create `tests/unit/gamification.test.ts`
2. Write XP calculation tests (8 test cases)
3. Write streak logic tests (4 test cases)
4. Run tests: `npm test tests/unit/gamification`
5. Fix any failures

---

### Day 2: More Unit Tests + Integration Tests (7-8 hours)

**Morning (3-4 hours): Complete Unit Tests**
1. Write achievement condition tests (6 test cases)
2. Write level calculation tests (1 comprehensive test)
3. Write feature flag tests (3 test cases)
4. Ensure ≥90% coverage on gamification code
5. Run full unit test suite

**Afternoon (4 hours): Integration Tests**
1. Create `tests/integration/gamification.test.ts`
2. Write URE → Listener → State tests (3 scenarios)
3. Write State → IndexedDB tests (2 scenarios)
4. Write achievement unlock flow tests (2 scenarios)
5. Write feature flag toggle test (1 scenario)
6. Run integration tests

---

### Day 3: E2E Tests + Performance (6-7 hours)

**Morning (4 hours): E2E Tests**
1. Create `tests/e2e/gamification.spec.ts`
2. Set up Playwright/Cypress if not already configured
3. Write 7 E2E test scenarios
4. Run E2E tests locally
5. Fix any failures

**Afternoon (2-3 hours): Performance Testing**
1. Benchmark XP calculation (<10ms target)
2. Benchmark IndexedDB operations (<2ms target)
3. Benchmark achievement checks (<20ms target)
4. Document results in completion report
5. Identify any performance regressions

---

### Day 4: Polish + Final Review (4-5 hours)

**Morning (2-3 hours): Bug Fixes**
1. Review all test failures
2. Work with Agents 1-3 to fix issues
3. Re-run all tests until 100% pass
4. Verify code coverage ≥80%

**Afternoon (2 hours): Documentation**
1. Create completion report
2. Document all bugs found/fixed
3. Document test coverage results
4. Document performance benchmarks
5. Create handoff for Supervisor

---

## 🎯 Success Criteria

You're done when:
- [ ] Telemetry system logs all events
- [ ] Mock dashboard JSON created
- [ ] All unit tests pass (≥90% coverage)
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] Code coverage ≥80% overall
- [ ] Performance benchmarks met
- [ ] Feature flag tested (ON and OFF)
- [ ] No console errors in tests
- [ ] Test suite completes in <5 minutes
- [ ] Completion report created

---

## 📤 Handoff to Agent 5 (Supervisor)

### When You're Done
1. All tests passing (unit + integration + E2E)
2. Coverage report generated
3. Performance benchmarks documented
4. Bug list (found and fixed)
5. Update QA-MATRIX.md with sign-off
6. Create completion report

### Completion Report Template
**File**: `/docs/gamification-new/AGENT-4-COMPLETION-REPORT.md`

```markdown
# Agent 4 Completion Report

## Test Results Summary
- Unit Tests: X/X passing (100%)
- Integration Tests: X/X passing (100%)
- E2E Tests: X/X passing (100%)
- Code Coverage: X% (target ≥80%)

## Performance Benchmarks
- XP Calculation: Xms (target <10ms) ✓/✗
- IndexedDB Save: Xms (target <2ms) ✓/✗
- IndexedDB Load: Xms (target <2ms) ✓/✗
- Achievement Check: Xms (target <20ms) ✓/✗

## Bugs Found
1. [Bug description] - Status: FIXED by Agent X
2. [Bug description] - Status: FIXED by Agent X

## Known Issues
- [Issue description] - Workaround: [...]

## Recommendations
- [Recommendation for future improvements]

Signed: Agent 4
Date: [Date]
```

---

## 🐛 Bug Reporting Protocol

When you find a bug:

1. **Document It**:
   ```markdown
   ## Bug: [Short description]

   **Severity**: Critical / High / Medium / Low
   **Found in**: [Component/file]
   **Test**: [Which test found it]

   **Steps to Reproduce**:
   1. ...
   2. ...

   **Expected**: [What should happen]
   **Actual**: [What actually happens]

   **Assigned to**: Agent X
   ```

2. **Report to Agent**:
   - Tag responsible agent
   - Provide test case that demonstrates bug
   - Wait for fix

3. **Verify Fix**:
   - Re-run failing test
   - Confirm test passes
   - Mark bug as RESOLVED

---

## ❓ Common Questions

**Q: What if tests fail?**
**A**: Work with agents to fix. Don't approve handoff until 100% pass.

**Q: What's the minimum coverage?**
**A**: 80% overall, 90% on gamification code specifically.

**Q: Should I test browser compatibility?**
**A**: Focus on Chrome. Other browsers are bonus (not required).

**Q: What if performance benchmarks miss targets?**
**A**: Document it. Discuss with Supervisor. May need optimization.

**Q: Can I add more tests than required?**
**A**: Yes! More coverage is better. Focus on critical paths first.

**Q: What if IndexedDB is unavailable?**
**A**: Test this scenario. System should gracefully degrade.

---

## 🎓 Best Practices for Agent 4

1. **Test Pyramid**
   - Many unit tests (fast, isolated)
   - Fewer integration tests (medium)
   - Few E2E tests (slow, comprehensive)

2. **Test Independence**
   - Each test runs in isolation
   - Clean state before each test
   - No dependencies between tests

3. **Meaningful Assertions**
   - Test behavior, not implementation
   - Clear, specific expectations
   - Good error messages

4. **Performance Testing**
   - Measure, don't guess
   - Compare against targets
   - Watch for regressions

5. **Feature Flag Testing**
   - Test both ON and OFF states
   - No errors when disabled
   - Graceful degradation

---

## 📞 Need Help?

**Supervisor (Agent 5)**: Test strategy, coverage requirements
**Agent 1 (Core)**: Core logic questions, debugging
**Agent 3 (UI)**: UI testing questions, E2E setup

---

## 🎉 Your Critical Role

You are the **final gate** before production. Find bugs now so users don't find them later.

**Estimated Time**: 3-4 days
**Your Focus**: Quality, coverage, performance, reliability

Good luck! 🧪

**Signed**: Agent 5 (Supervisor)
**Date**: 2025-10-02
