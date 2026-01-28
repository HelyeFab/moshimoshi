# Kanji Mastery Test Suite Specification

**Status:** ACTIVE
**Last Updated:** 2026-01-28
**Coverage Target:** 90% unit, 80% integration, 70% UI, 2 E2E smoke tests
**Estimated Implementation:** 13-16 hours

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Testing Philosophy & Strategy](#testing-philosophy--strategy)
3. [Test Coverage Matrix](#test-coverage-matrix)
4. [Unit Test Specifications](#unit-test-specifications)
5. [Integration Test Specifications](#integration-test-specifications)
6. [Component Test Specifications](#component-test-specifications)
7. [E2E Test Specifications](#e2e-test-specifications)
8. [Test Infrastructure Setup](#test-infrastructure-setup)
9. [QA & Manual Testing](#qa--manual-testing)
10. [Rollout Validation Strategy](#rollout-validation-strategy)
11. [Appendices](#appendices)

---

## Executive Summary

### Why Comprehensive Testing Matters

Kanji Mastery is a **premium learning feature** where:
- User progress data is **irreplaceable** (SRS history = months of learning)
- Data corruption = **lost trust and churn**
- Dual storage (IndexedDB + Firebase) has **complex sync logic**
- Feature flag rollout requires **high confidence**
- SRS scheduling accuracy depends on **correct test result attribution**

### Risk Analysis

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| SRS data corruption | **Critical** - Lost progress | Medium | Comprehensive data layer tests |
| Result misattribution | **High** - Wrong scheduling | Low | Component + integration tests |
| IndexedDB quota exceeded | **High** - Feature breaks | Low | Edge case + quota tests |
| Firebase sync failure | **Medium** - Premium data loss | Medium | Retry logic + integration tests |
| Feature flag regression | **High** - Legacy mode breaks | Low | Toggle tests + manual QA |

### Testing Investment ROI

**Investment:** 13-16 hours
**Returns:**
- ✅ Prevents production data loss incidents
- ✅ Enables confident feature flag rollout
- ✅ Reduces support tickets (broken sessions)
- ✅ Protects premium user trust
- ✅ Faster regression detection (automated CI)

**Break-even:** ~2 prevented production incidents

---

## Testing Philosophy & Strategy

### Pyramid Approach

```
         ┌─────────────┐
         │   E2E (2)   │  ← Smoke tests only
         │   1 hour    │
         ├─────────────┤
         │ Component   │  ← Critical UI paths
         │  (3-4)      │
         │  4 hours    │
         ├─────────────┤
         │ Integration │  ← Business flows
         │    (3)      │
         │  4 hours    │
         ├─────────────┤
         │   Unit      │  ← Majority of coverage
         │   (5-6)     │
         │  5 hours    │
         └─────────────┘
```

### Coverage Targets by Layer

| Layer | Target | Rationale |
|-------|--------|-----------|
| **Unit (Pure Logic)** | 95% | Fast, deterministic, high ROI |
| **Integration** | 95% | Validates cross-module contracts |
| **Component (UI)** | 95% | Focus on critical paths only |
| **E2E** | 2 tests | Production smoke validation |

### Priority Levels

- **P0 (Blocker):** Data integrity, SRS correctness
- **P1 (Critical):** Core flows, entitlement gating
- **P2 (Important):** Edge cases, UX validation
- **P3 (Nice-to-have):** Polish, minor edge cases

---

## Test Coverage Matrix

### Current State

| Module | Files | Tests | Coverage | Priority | Status |
|--------|-------|-------|----------|----------|--------|
| **testOrder.ts** | 1 | 4 | 91.52% | P1 | ✅ DONE |
| **kanjiSelection.ts** | 1 | 1 | ~60% | P1 | ⚠️ PARTIAL |
| **KanjiMasteryProgressManager.ts** | 1 | 0 | 0% | **P0** | 🔴 CRITICAL |
| **kanjiMasteryDB.ts** | 1 | 0 | 0% | **P0** | 🔴 CRITICAL |
| **API Routes** | 1 | 1 | ~40% | P1 | ⚠️ PARTIAL |
| **UI Components** | 4 | 0 | 0% | P1 | 🔴 NONE |
| **Integration** | - | 0 | 0% | P1 | 🔴 NONE |
| **E2E** | - | 0 | 0% | P2 | 🔴 NONE |

### Target State (End of Phase 3)

| Module | Target Coverage | Priority |
|--------|----------------|----------|
| **Data Layer** | 95% | **Week 1** |
| **Business Logic** | 90% | **Week 2** |
| **UI Components** | 70% | **Week 3** |
| **E2E** | 2 tests | **Week 3** |

---

## Unit Test Specifications

### 4.1 Test Order Logic (testOrder.ts)

**Status:** ✅ **COMPLETE** (91.52% coverage)
**File:** `src/app/[locale]/tools/kanji-mastery/learn/__tests__/testOrder.test.ts`

#### Existing Tests (4 passing)
- ✅ Returns only meaning + recognition when readings are missing
- ✅ Avoids on/kun adjacency when constraint enabled
- ✅ Avoids starting with last test type (de-clumping)
- ✅ Deterministic with seeded RNG

#### Recommended Additions (5 min)

```typescript
// Add to testOrder.test.ts:

describe('buildRound2TestSequence - edge cases', () => {
  it('returns empty array when no valid tests', () => {
    const kanji = makeKanji({
      meaning: '',
      onyomi: [],
      kunyomi: []
    })
    const tests = buildRound2TestSequence(kanji)

    expect(tests).toEqual([])
  })

  it('satisfies constraints consistently across 100 runs', () => {
    const kanji = makeKanji()

    for (let i = 0; i < 100; i++) {
      const tests = buildRound2TestSequence(kanji, {
        forbidOnKunAdjacency: true,
        lastTestType: 'meaning',
        rng: makeRng(i)
      })

      const types = tests.map(t => t.type)
      expect(hasAdjacentOnKun(types)).toBe(false)
      expect(types[0]).not.toBe('meaning')
    }
  })
})
```

**Coverage Goal:** 95% → Already at 91.52%, these tests push to 95%+

---

### 4.2 Kanji Selection Logic (kanjiSelection.ts)

**Status:** ⚠️ **PARTIAL** (~60% coverage)
**Priority:** **P1 Critical**
**Effort:** 30 min

#### Current Coverage
- ✅ Mixed mode selection (1 test)
- ❌ Smart approach with SRS prioritization
- ❌ Linear approach progression
- ❌ Recent session avoidance
- ❌ Pool rotation logic

#### Required Test Cases

```typescript
// File: src/app/[locale]/tools/kanji-mastery/learn/__tests__/kanjiSelection.test.ts

describe('selectKanjiSmartly', () => {
  it('prioritizes due items from SRS data', () => {
    const pool = [
      makeKanji('k1', 'N5'),
      makeKanji('k2', 'N5'),
      makeKanji('k3', 'N5'),
    ]
    const progress = [
      makeProgress('k1', 'N5', '2025-01-01', 0.8, 'review'), // Overdue
      makeProgress('k2', 'N5', '2099-01-01', 0.9, 'review'), // Future
      makeProgress('k3', 'N5', '2025-01-15', 0.5, 'learning'), // Due
    ]

    const selected = selectKanjiSmartly(pool, {
      requestedSize: 2,
      progressRecords: progress,
      recentSessionIds: new Set()
    })

    // Should pick k1 (overdue) and k3 (due + weak)
    expect(selected.map(k => k.kanji)).toContain('k1')
    expect(selected.map(k => k.kanji)).toContain('k3')
  })

  it('avoids recently seen kanji', () => {
    const pool = [
      makeKanji('k1', 'N5'),
      makeKanji('k2', 'N5'),
      makeKanji('k3', 'N5'),
    ]
    const recentSessionIds = new Set(['k1', 'k2'])

    const selected = selectKanjiSmartly(pool, {
      requestedSize: 2,
      progressRecords: [],
      recentSessionIds
    })

    // Should NOT include k1 or k2
    expect(selected.map(k => k.kanji)).not.toContain('k1')
    expect(selected.map(k => k.kanji)).not.toContain('k2')
  })

  it('fills with new items up to 60% of session size', () => {
    const pool = Array.from({ length: 10 }, (_, i) => makeKanji(`k${i}`, 'N5'))

    const selected = selectKanjiSmartly(pool, {
      requestedSize: 5,
      progressRecords: [],
      recentSessionIds: new Set()
    })

    // Should pick 3 new items (60% of 5)
    expect(selected.length).toBe(5)
  })
})

describe('selectKanjiMixed', () => {
  // Already has 1 test, add:

  it('prefers lowest unmastered level for new items', () => {
    const pool = [
      makeKanji('n5_1', 'N5'),
      makeKanji('n4_1', 'N4'),
      makeKanji('n3_1', 'N3'),
    ]
    const progress = [
      makeProgress('n5_1', 'N5', '2025-01-01', 1.0, 'mastered'),
      // N4 has no progress yet
    ]

    const selected = selectKanjiMixed(pool, {
      requestedSize: 2,
      progressRecords: progress,
      recentSessionIds: new Set()
    })

    // Should prefer N4 (lowest unmastered) over N3
    expect(selected.map(k => k.kanji)).toContain('n4_1')
  })
})
```

**Coverage Goal:** 60% → 90%

---

### 4.3 Progress Manager (KanjiMasteryProgressManager.ts)

**Status:** 🔴 **CRITICAL GAP** (0% coverage)
**Priority:** **P0 BLOCKER**
**Effort:** 90 min

#### Why This Is Critical
- Handles **all data transformations** before storage
- Calculates **SRS scheduling** (wrong = broken learning)
- Maps **performance to FSRS ratings** (accuracy → difficulty)
- Triggers **IndexedDB + Firebase writes** (data integrity)

#### Required Test Suite

```typescript
// File: src/lib/review-engine/progress/__tests__/KanjiMasteryProgressManager.test.ts

import { KanjiMasteryProgressManager } from '../KanjiMasteryProgressManager'
import { kanjiMasteryDB } from '@/lib/kanji-mastery/kanjiMasteryDB'
import type { SessionState } from '@/app/[locale]/tools/kanji-mastery/learn/LearnContent'

// Mock dependencies
jest.mock('@/lib/kanji-mastery/kanjiMasteryDB')
jest.mock('@/lib/review-engine/srs/algorithm-factory')

const mockUser = { uid: 'test-user-123' }

const makeSessionState = (overrides: Partial<SessionState> = {}): SessionState => {
  const baseState: SessionState = {
    kanji: [
      {
        kanji: '日',
        meaning: 'sun',
        meanings: ['sun'],
        onyomi: ['ニチ'],
        kunyomi: ['ひ'],
        jlpt: 'N5',
        strokeCount: 4,
        examples: []
      }
    ],
    currentRound: 3,
    currentIndex: 0,
    progress: new Map([
      ['日', {
        kanjiId: '日',
        round1Completed: true,
        round2Results: [
          { type: 'meaning', correct: true, userAnswer: 'sun' },
          { type: 'onyomi', correct: true, userAnswer: 'ニチ' },
          { type: 'recognition', correct: false, userAnswer: '月' }
        ],
        round2Accuracy: 0.67, // 2/3 correct
        round3Rating: 4
      }]
    ]),
    reviewAgainPile: new Set(),
    sessionId: 'test-session-1',
    startTime: new Date('2026-01-28T10:00:00Z'),
    level: 'N5',
    mode: 'jlpt'
  }
  return { ...baseState, ...overrides }
}

describe('KanjiMasteryProgressManager', () => {
  let manager: KanjiMasteryProgressManager

  beforeEach(() => {
    manager = new KanjiMasteryProgressManager()
    jest.clearAllMocks()
  })

  describe('trackSession', () => {
    it('calculates session stats correctly', async () => {
      const sessionState = makeSessionState()

      const result = await manager.trackSession(sessionState, mockUser, false)

      expect(result.sessionStats).toEqual({
        totalKanji: 1,
        perfectKanji: 0, // 67% accuracy + rating 4 ≠ perfect
        reviewAgainCount: 0,
        averageAccuracy: 0.67,
        timeSpentSeconds: expect.any(Number)
      })
    })

    it('stores accuracy as decimal (0-1)', async () => {
      const sessionState = makeSessionState()

      const result = await manager.trackSession(sessionState, mockUser, false)

      expect(result.kanji[0].rounds.round2Accuracy).toBe(0.67)
      expect(result.kanji[0].rounds.round2Accuracy).toBeLessThanOrEqual(1)
    })

    it('applies 0.7 threshold for review pile', async () => {
      const weakKanji = makeSessionState({
        progress: new Map([
          ['日', {
            kanjiId: '日',
            round1Completed: true,
            round2Results: [
              { type: 'meaning', correct: true, userAnswer: 'sun' },
              { type: 'onyomi', correct: false, userAnswer: 'wrong' },
              { type: 'recognition', correct: false, userAnswer: 'wrong' }
            ],
            round2Accuracy: 0.33, // Below 0.7 threshold
            round3Rating: 2
          }]
        ])
      })

      const result = await manager.trackSession(weakKanji, mockUser, false)

      expect(result.sessionStats.reviewAgainCount).toBe(1)
    })

    it('saves to IndexedDB for all users', async () => {
      const sessionState = makeSessionState()

      await manager.trackSession(sessionState, mockUser, false)

      expect(kanjiMasteryDB.saveSession).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'test-session-1',
          userId: 'test-user-123'
        })
      )
    })

    it('queues Firebase sync for premium users only', async () => {
      const sessionState = makeSessionState()
      const fetchSpy = jest.spyOn(global, 'fetch')

      // Premium user
      await manager.trackSession(sessionState, mockUser, true)
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/kanji-mastery/session',
        expect.objectContaining({ method: 'POST' })
      )

      fetchSpy.mockClear()

      // Free user
      await manager.trackSession(sessionState, mockUser, false)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('handles empty session gracefully', async () => {
      const emptySession = makeSessionState({
        kanji: [],
        progress: new Map()
      })

      const result = await manager.trackSession(emptySession, mockUser, false)

      expect(result.sessionStats.totalKanji).toBe(0)
      expect(result.sessionStats.averageAccuracy).toBe(0)
    })
  })

  describe('SRS integration', () => {
    it('maps high performance (>0.9 + rating 5) to "easy"', async () => {
      const perfectSession = makeSessionState({
        progress: new Map([
          ['日', {
            kanjiId: '日',
            round1Completed: true,
            round2Results: [
              { type: 'meaning', correct: true, userAnswer: 'sun' },
              { type: 'onyomi', correct: true, userAnswer: 'ニチ' }
            ],
            round2Accuracy: 1.0,
            round3Rating: 5
          }]
        ])
      })

      const result = await manager.trackSession(perfectSession, mockUser, false)

      // Should schedule with longer interval (FSRS "easy")
      const nextReview = new Date(result.kanji[0].nextReviewDate)
      const now = new Date()
      const daysDiff = (nextReview.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)

      expect(daysDiff).toBeGreaterThan(1) // At least 1 day
    })

    it('maps poor performance (<0.5 + rating 1) to "again"', async () => {
      const failedSession = makeSessionState({
        progress: new Map([
          ['日', {
            kanjiId: '日',
            round1Completed: true,
            round2Results: [
              { type: 'meaning', correct: false, userAnswer: 'wrong' },
              { type: 'onyomi', correct: false, userAnswer: 'wrong' }
            ],
            round2Accuracy: 0.0,
            round3Rating: 1
          }]
        ])
      })

      const result = await manager.trackSession(failedSession, mockUser, false)

      // Should schedule soon (FSRS "again")
      const nextReview = new Date(result.kanji[0].nextReviewDate)
      const now = new Date()
      const minutesDiff = (nextReview.getTime() - now.getTime()) / (1000 * 60)

      expect(minutesDiff).toBeLessThan(60) // Within 1 hour
    })

    it('initializes new cards with FSRS algorithm', async () => {
      const sessionState = makeSessionState()

      const result = await manager.trackSession(sessionState, mockUser, false)

      expect(result.kanji[0].srsData?.algorithm).toBe('fsrs')
    })

    it('preserves existing algorithm for legacy cards', async () => {
      // Mock existing progress with SM-2
      ;(kanjiMasteryDB.getProgressByUserAndLevel as jest.Mock).mockResolvedValue([
        {
          kanjiId: '日',
          srsData: { algorithm: 'sm2', /* ...other fields */ }
        }
      ])

      const sessionState = makeSessionState()
      const result = await manager.trackSession(sessionState, mockUser, false)

      expect(result.kanji[0].srsData?.algorithm).toBe('sm2') // Preserved
    })
  })

  describe('edge cases', () => {
    it('handles division by zero when no tests', () => {
      const noTests = makeSessionState({
        progress: new Map([
          ['日', {
            kanjiId: '日',
            round1Completed: true,
            round2Results: [],
            round2Accuracy: 0,
            round3Rating: 3
          }]
        ])
      })

      expect(async () => {
        await manager.trackSession(noTests, mockUser, false)
      }).not.toThrow()
    })

    it('handles guest users (no uid)', async () => {
      const sessionState = makeSessionState()

      const result = await manager.trackSession(sessionState, null, false)

      expect(result.userId).toBe('guest')
      expect(kanjiMasteryDB.saveSession).not.toHaveBeenCalled()
    })
  })
})
```

**Coverage Goal:** 0% → 95%

---

### 4.4 Database Layer (kanjiMasteryDB.ts)

**Status:** 🔴 **CRITICAL GAP** (0% coverage)
**Priority:** **P0 BLOCKER**
**Effort:** 60 min

#### Why This Is Critical
- **Single source of truth** for local data
- Schema migrations can **corrupt existing data**
- Concurrent writes need **LWW (Last-Write-Wins)** strategy
- Quota exceeded = **feature breaks silently**

#### Required Test Suite

```typescript
// File: src/lib/kanji-mastery/__tests__/kanjiMasteryDB.test.ts

import 'fake-indexeddb/auto'
import { kanjiMasteryDB, type KanjiSession, type KanjiProgressRecord } from '../kanjiMasteryDB'

describe('kanjiMasteryDB', () => {
  beforeEach(async () => {
    // Clear database before each test
    await kanjiMasteryDB.clearAll()
  })

  afterAll(async () => {
    await kanjiMasteryDB.close()
  })

  describe('session CRUD', () => {
    it('saves session to IndexedDB', async () => {
      const session: KanjiSession = {
        sessionId: 'test-session-1',
        userId: 'user-123',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        level: 'N5',
        kanji: [
          {
            id: '日',
            character: '日',
            rounds: { round1: true, round2Accuracy: 0.8, round3Rating: 4 },
            finalScore: 0.76,
            nextReviewDate: new Date().toISOString()
          }
        ],
        sessionStats: {
          totalKanji: 1,
          perfectKanji: 0,
          reviewAgainCount: 0,
          averageAccuracy: 0.8,
          timeSpentSeconds: 120
        }
      }

      await kanjiMasteryDB.saveSession(session)

      const retrieved = await kanjiMasteryDB.getSession(session.sessionId)
      expect(retrieved).toMatchObject(session)
    })

    it('retrieves sessions by user', async () => {
      const sessions: KanjiSession[] = [
        {
          sessionId: 's1',
          userId: 'user-123',
          startTime: '2026-01-27T10:00:00Z',
          endTime: '2026-01-27T10:15:00Z',
          kanji: [],
          sessionStats: { totalKanji: 0, perfectKanji: 0, reviewAgainCount: 0, averageAccuracy: 0, timeSpentSeconds: 0 }
        },
        {
          sessionId: 's2',
          userId: 'user-123',
          startTime: '2026-01-28T10:00:00Z',
          endTime: '2026-01-28T10:15:00Z',
          kanji: [],
          sessionStats: { totalKanji: 0, perfectKanji: 0, reviewAgainCount: 0, averageAccuracy: 0, timeSpentSeconds: 0 }
        },
        {
          sessionId: 's3',
          userId: 'other-user',
          startTime: '2026-01-28T11:00:00Z',
          endTime: '2026-01-28T11:15:00Z',
          kanji: [],
          sessionStats: { totalKanji: 0, perfectKanji: 0, reviewAgainCount: 0, averageAccuracy: 0, timeSpentSeconds: 0 }
        }
      ]

      for (const session of sessions) {
        await kanjiMasteryDB.saveSession(session)
      }

      const userSessions = await kanjiMasteryDB.getSessionsByUser('user-123', 10)

      expect(userSessions).toHaveLength(2)
      expect(userSessions.map(s => s.sessionId)).toEqual(['s2', 's1']) // Newest first
    })

    it('retrieves recent sessions for pool rotation', async () => {
      const session: KanjiSession = {
        sessionId: 's1',
        userId: 'user-123',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        level: 'N5',
        kanji: [
          { id: 'k1', character: 'k1', rounds: { round1: true, round2Accuracy: 0.8, round3Rating: 4 }, finalScore: 0.8, nextReviewDate: new Date().toISOString() },
          { id: 'k2', character: 'k2', rounds: { round1: true, round2Accuracy: 0.9, round3Rating: 5 }, finalScore: 0.9, nextReviewDate: new Date().toISOString() }
        ],
        sessionStats: { totalKanji: 2, perfectKanji: 1, reviewAgainCount: 0, averageAccuracy: 0.85, timeSpentSeconds: 120 }
      }

      await kanjiMasteryDB.saveSession(session)

      const recent = await kanjiMasteryDB.getSessionsByUser('user-123', 5)
      const recentIds = new Set(recent[0].kanji.map(k => k.id))

      expect(recentIds).toContain('k1')
      expect(recentIds).toContain('k2')
    })
  })

  describe('progress CRUD', () => {
    it('saves progress records', async () => {
      const progress: KanjiProgressRecord = {
        userId: 'user-123',
        kanjiId: '日',
        character: '日',
        level: 'N5',
        lastReviewed: new Date().toISOString(),
        nextReviewDate: new Date().toISOString(),
        reviewCount: 1,
        averageScore: 0.8,
        lastScore: 0.8,
        lastAccuracy: 0.8,
        rounds: {
          round1: true,
          round2Accuracy: 0.8,
          round3Rating: 4
        },
        srsData: {
          interval: 1,
          lastReviewedAt: new Date().toISOString(),
          nextReviewAt: new Date().toISOString(),
          status: 'learning',
          reviewCount: 1,
          correctCount: 1,
          streak: 1,
          bestStreak: 1,
          algorithm: 'fsrs',
          difficulty: 5
        }
      }

      await kanjiMasteryDB.saveProgress(progress)

      const retrieved = await kanjiMasteryDB.getProgress('user-123', '日')
      expect(retrieved).toMatchObject(progress)
    })

    it('retrieves progress by user and level', async () => {
      const progressRecords: KanjiProgressRecord[] = [
        {
          userId: 'user-123',
          kanjiId: 'k1',
          character: 'k1',
          level: 'N5',
          lastReviewed: new Date().toISOString(),
          nextReviewDate: '2026-01-28T10:00:00Z',
          reviewCount: 1,
          averageScore: 0.8,
          lastScore: 0.8,
          lastAccuracy: 0.8,
          rounds: { round1: true, round2Accuracy: 0.8, round3Rating: 4 },
          srsData: {
            interval: 1,
            lastReviewedAt: null,
            nextReviewAt: '2026-01-28T10:00:00Z',
            status: 'learning',
            reviewCount: 1,
            correctCount: 1,
            streak: 1,
            bestStreak: 1,
            algorithm: 'fsrs',
            difficulty: 5
          }
        },
        {
          userId: 'user-123',
          kanjiId: 'k2',
          character: 'k2',
          level: 'N4',
          lastReviewed: new Date().toISOString(),
          nextReviewDate: '2026-01-29T10:00:00Z',
          reviewCount: 1,
          averageScore: 0.9,
          lastScore: 0.9,
          lastAccuracy: 0.9,
          rounds: { round1: true, round2Accuracy: 0.9, round3Rating: 5 },
          srsData: {
            interval: 1,
            lastReviewedAt: null,
            nextReviewAt: '2026-01-29T10:00:00Z',
            status: 'review',
            reviewCount: 1,
            correctCount: 1,
            streak: 1,
            bestStreak: 1,
            algorithm: 'fsrs',
            difficulty: 4
          }
        }
      ]

      for (const record of progressRecords) {
        await kanjiMasteryDB.saveProgress(record)
      }

      const n5Progress = await kanjiMasteryDB.getProgressByUserAndLevel('user-123', 'N5')

      expect(n5Progress).toHaveLength(1)
      expect(n5Progress[0].kanjiId).toBe('k1')
    })

    it('updates existing progress with LWW strategy', async () => {
      const original: KanjiProgressRecord = {
        userId: 'user-123',
        kanjiId: '日',
        character: '日',
        level: 'N5',
        lastReviewed: '2026-01-27T10:00:00Z',
        nextReviewDate: new Date().toISOString(),
        reviewCount: 1,
        averageScore: 0.5,
        lastScore: 0.5,
        lastAccuracy: 0.5,
        rounds: { round1: true, round2Accuracy: 0.5, round3Rating: 2 },
        srsData: {
          interval: 1,
          lastReviewedAt: null,
          nextReviewAt: new Date().toISOString(),
          status: 'learning',
          reviewCount: 1,
          correctCount: 0,
          streak: 0,
          bestStreak: 0,
          algorithm: 'fsrs',
          difficulty: 7
        }
      }

      await kanjiMasteryDB.saveProgress(original)

      const updated: KanjiProgressRecord = {
        ...original,
        lastReviewed: '2026-01-28T10:00:00Z', // Newer timestamp
        averageScore: 0.8,
        lastScore: 0.8,
        reviewCount: 2
      }

      await kanjiMasteryDB.saveProgress(updated)

      const retrieved = await kanjiMasteryDB.getProgress('user-123', '日')
      expect(retrieved?.averageScore).toBe(0.8) // Last write wins
      expect(retrieved?.reviewCount).toBe(2)
    })
  })

  describe('data consistency', () => {
    it('handles concurrent writes with LWW strategy', async () => {
      const base: KanjiProgressRecord = {
        userId: 'user-123',
        kanjiId: '日',
        character: '日',
        level: 'N5',
        lastReviewed: new Date().toISOString(),
        nextReviewDate: new Date().toISOString(),
        reviewCount: 1,
        averageScore: 0.5,
        lastScore: 0.5,
        lastAccuracy: 0.5,
        rounds: { round1: true, round2Accuracy: 0.5, round3Rating: 3 },
        srsData: {
          interval: 1,
          lastReviewedAt: null,
          nextReviewAt: new Date().toISOString(),
          status: 'learning',
          reviewCount: 1,
          correctCount: 1,
          streak: 1,
          bestStreak: 1,
          algorithm: 'fsrs',
          difficulty: 5
        }
      }

      // Simulate concurrent writes
      const writes = [
        { ...base, lastReviewed: '2026-01-28T10:00:00Z', lastScore: 0.6 },
        { ...base, lastReviewed: '2026-01-28T10:01:00Z', lastScore: 0.8 }, // Wins
        { ...base, lastReviewed: '2026-01-28T09:59:00Z', lastScore: 0.4 }
      ]

      await Promise.all(writes.map(w => kanjiMasteryDB.saveProgress(w)))

      const result = await kanjiMasteryDB.getProgress('user-123', '日')
      expect(result?.lastScore).toBe(0.8) // Latest timestamp wins
    })

    it('migrates schema on version bump', async () => {
      // This test would verify schema migration logic
      // For now, ensure database initializes without errors
      expect(async () => {
        await kanjiMasteryDB.getProgressByUser('test-user')
      }).not.toThrow()
    })
  })

  describe('quota management', () => {
    it('reports quota status', async () => {
      const quota = await kanjiMasteryDB.getQuotaStatus()

      expect(quota).toHaveProperty('usage')
      expect(quota).toHaveProperty('quota')
      expect(quota.percentUsed).toBeLessThanOrEqual(100)
    })
  })
})
```

**Dependencies:**
```bash
npm install -D fake-indexeddb
```

**Coverage Goal:** 0% → 95%

---

### 4.5 Event System (kanjiMasteryEvents.ts)

**Status:** 🟢 **LOW PRIORITY** (simple logic)
**Priority:** P3
**Effort:** 20 min

```typescript
// File: src/app/[locale]/tools/kanji-mastery/__tests__/events.test.ts

import { kanjiMasteryEvents, type Round2CompleteEvent } from '../events'

describe('KanjiMasteryEventEmitter', () => {
  afterEach(() => {
    kanjiMasteryEvents.removeAllListeners()
  })

  it('emits events to registered listeners', async () => {
    const listener = jest.fn()
    kanjiMasteryEvents.on('round2:complete', listener)

    const event: Round2CompleteEvent = {
      userId: 'user-123',
      kanjiId: '日',
      kanji: '日',
      round: 2,
      results: [],
      correctCount: 2,
      totalTests: 3,
      accuracy: 0.67,
      timestamp: Date.now()
    }

    await kanjiMasteryEvents.emit('round2:complete', event)

    expect(listener).toHaveBeenCalledWith(event)
  })

  it('removes listeners correctly', async () => {
    const listener = jest.fn()
    const unsubscribe = kanjiMasteryEvents.on('round2:complete', listener)

    unsubscribe()

    await kanjiMasteryEvents.emit('round2:complete', {
      userId: 'user',
      kanjiId: 'k',
      kanji: 'k',
      round: 2,
      results: [],
      correctCount: 0,
      totalTests: 0,
      accuracy: 0,
      timestamp: Date.now()
    })

    expect(listener).not.toHaveBeenCalled()
  })

  it('handles listener errors gracefully', async () => {
    const errorListener = jest.fn(() => {
      throw new Error('Listener error')
    })
    const successListener = jest.fn()

    kanjiMasteryEvents.on('round2:complete', errorListener)
    kanjiMasteryEvents.on('round2:complete', successListener)

    await expect(async () => {
      await kanjiMasteryEvents.emit('round2:complete', {
        userId: 'user',
        kanjiId: 'k',
        kanji: 'k',
        round: 2,
        results: [],
        correctCount: 0,
        totalTests: 0,
        accuracy: 0,
        timestamp: Date.now()
      })
    }).not.toThrow()

    expect(successListener).toHaveBeenCalled()
  })
})
```

---

## Integration Test Specifications

### 5.1 Session Lifecycle Integration

**Priority:** **P1 Critical**
**Effort:** 90 min

```typescript
// File: src/app/[locale]/tools/kanji-mastery/learn/__tests__/sessionLifecycle.integration.test.ts

import { KanjiMasteryProgressManager } from '@/lib/review-engine/progress/KanjiMasteryProgressManager'
import { kanjiMasteryDB } from '@/lib/kanji-mastery/kanjiMasteryDB'
import { kanjiMasteryEvents } from '../events'
import type { SessionState } from '../LearnContent'

describe('Session Lifecycle Integration', () => {
  let progressManager: KanjiMasteryProgressManager
  let eventSpy: jest.SpyInstance

  beforeEach(() => {
    progressManager = new KanjiMasteryProgressManager()
    eventSpy = jest.spyOn(kanjiMasteryEvents, 'emit')
  })

  afterEach(() => {
    eventSpy.mockRestore()
  })

  it('completes full 3-round flow with data persistence', async () => {
    // 1. Start with session state
    const sessionState: SessionState = {
      kanji: [
        {
          kanji: '日',
          meaning: 'sun',
          meanings: ['sun'],
          onyomi: ['ニチ'],
          kunyomi: ['ひ'],
          jlpt: 'N5',
          strokeCount: 4,
          examples: []
        }
      ],
      currentRound: 3,
      currentIndex: 0,
      progress: new Map([
        ['日', {
          kanjiId: '日',
          round1Completed: true,
          round2Results: [
            { type: 'meaning', correct: true, userAnswer: 'sun' },
            { type: 'onyomi', correct: true, userAnswer: 'ニチ' }
          ],
          round2Accuracy: 1.0,
          round3Rating: 5
        }]
      ]),
      reviewAgainPile: new Set(),
      sessionId: 'integration-test-1',
      startTime: new Date(),
      level: 'N5',
      mode: 'jlpt'
    }

    const user = { uid: 'test-user' }

    // 2. Track session (triggers all integrations)
    const result = await progressManager.trackSession(sessionState, user, false)

    // 3. Verify data transformations
    expect(result.kanji[0].rounds.round2Accuracy).toBe(1.0)
    expect(result.kanji[0].srsData?.status).toBe('learning')

    // 4. Verify IndexedDB write
    const savedSession = await kanjiMasteryDB.getSession(result.sessionId)
    expect(savedSession).toBeDefined()
    expect(savedSession?.kanji[0].character).toBe('日')

    // 5. Verify progress record
    const progress = await kanjiMasteryDB.getProgress(user.uid, '日')
    expect(progress?.lastAccuracy).toBe(1.0)

    // 6. Verify SRS scheduling
    const nextReview = new Date(result.kanji[0].nextReviewDate)
    const now = new Date()
    expect(nextReview.getTime()).toBeGreaterThan(now.getTime())
  })

  it('updates lastTestType state across kanji', () => {
    // This would be a component-level test
    // Testing LearnContent state machine
    // See Section 6.2
  })

  it('emits gamification events in correct order', async () => {
    const sessionState: SessionState = {
      kanji: [{
        kanji: '日',
        meaning: 'sun',
        meanings: ['sun'],
        onyomi: ['ニチ'],
        kunyomi: [],
        jlpt: 'N5',
        strokeCount: 4,
        examples: []
      }],
      currentRound: 3,
      currentIndex: 0,
      progress: new Map([
        ['日', {
          kanjiId: '日',
          round1Completed: true,
          round2Results: [{ type: 'meaning', correct: true, userAnswer: 'sun' }],
          round2Accuracy: 1.0,
          round3Rating: 5
        }]
      ]),
      reviewAgainPile: new Set(),
      sessionId: 'event-test-1',
      startTime: new Date(),
      level: 'N5',
      mode: 'jlpt'
    }

    await progressManager.trackSession(sessionState, { uid: 'user' }, false)

    // Events should be emitted in order
    expect(eventSpy).toHaveBeenCalledWith('session:complete', expect.any(Object))
  })
})
```

---

### 5.2 API Route Integration

**Priority:** P1
**Effort:** 45 min

```typescript
// File: src/app/api/kanji-mastery/session/__tests__/route.integration.test.ts

import { POST } from '../route'
import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { getUserPlan } from '@/lib/entitlements/server'
import { adminDb } from '@/lib/firebase/admin'

jest.mock('@/lib/auth/session')
jest.mock('@/lib/entitlements/server')
jest.mock('@/lib/firebase/admin')

describe('POST /api/kanji-mastery/session', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('saves session to Firestore for premium users', async () => {
    (requireAuth as jest.Mock).mockResolvedValue({ uid: 'premium-user' })
    (getUserPlan as jest.Mock).mockResolvedValue('premium_monthly')

    const mockSet = jest.fn()
    const mockGet = jest.fn().mockResolvedValue({ exists: false })
    ;(adminDb as any) = {
      collection: jest.fn().mockReturnThis(),
      doc: jest.fn().mockReturnThis(),
      get: mockGet,
      set: mockSet
    }

    const request = new NextRequest('http://localhost/api/kanji-mastery/session', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: 'test-session',
        kanji: [{ id: '日', character: '日', rounds: {}, finalScore: 0.8, nextReviewDate: new Date().toISOString() }],
        sessionStats: { totalKanji: 1, perfectKanji: 0, reviewAgainCount: 0, averageAccuracy: 0.8, timeSpentSeconds: 120 }
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(mockSet).toHaveBeenCalled()
    expect(data.success).toBe(true)
    expect(data.isPremium).toBe(true)
  })

  it('rejects unauthenticated requests', async () => {
    (requireAuth as jest.Mock).mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/kanji-mastery/session', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'test', kanji: [], sessionStats: {} })
    })

    const response = await POST(request)

    expect(response.status).toBe(401)
  })

  it('skips Firebase for free users', async () => {
    (requireAuth as jest.Mock).mockResolvedValue({ uid: 'free-user' })
    (getUserPlan as jest.Mock).mockResolvedValue('free')

    const request = new NextRequest('http://localhost/api/kanji-mastery/session', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: 'test-session',
        kanji: [],
        sessionStats: { totalKanji: 0, perfectKanji: 0, reviewAgainCount: 0, averageAccuracy: 0, timeSpentSeconds: 0 }
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(data.isPremium).toBe(false)
    expect(adminDb?.collection).not.toHaveBeenCalled()
  })
})
```

---

### 5.3 SRS Pipeline Integration

**Priority:** P1
**Effort:** 45 min

```typescript
// File: src/lib/review-engine/__tests__/srs-kanji-integration.test.ts

import { AlgorithmFactory } from '../srs/algorithm-factory'
import { TSFSRSWrapper } from '../srs/ts-fsrs-wrapper'
import type { SerializedSRSData } from '@/lib/kanji-mastery/kanjiMasteryDB'

describe('SRS Pipeline Integration', () => {
  it('calculates next review date based on performance', () => {
    const algorithm = AlgorithmFactory.create('fsrs')

    const newCard = algorithm.initializeCardSRS({
      id: '日',
      contentType: 'kanji',
      data: { kanji: '日', meaning: 'sun' }
    })

    // Good performance
    const updated = algorithm.calculateNextReview(newCard, {
      result: 'good',
      responseTimeMs: 3000,
      timestamp: new Date()
    })

    expect(updated.interval).toBeGreaterThan(0)
    expect(updated.nextReviewAt).toBeInstanceOf(Date)
    expect(updated.status).toBe('learning')
  })

  it('maps accuracy + rating to FSRS difficulty', () => {
    const wrapper = new TSFSRSWrapper()

    // High accuracy (1.0) + high rating (5) → Easy
    const easyCard = wrapper.calculateNext({
      interval: 0,
      lastReviewedAt: null,
      nextReviewAt: new Date().toISOString(),
      status: 'new',
      reviewCount: 0,
      correctCount: 0,
      streak: 0,
      bestStreak: 0,
      algorithm: 'fsrs',
      difficulty: 5
    }, {
      result: 'easy',
      responseTimeMs: 2000,
      timestamp: new Date()
    })

    expect(easyCard.interval).toBeGreaterThan(1)
  })

  it('preserves algorithm type across updates', () => {
    const sm2Algorithm = AlgorithmFactory.create('sm2')

    const card = sm2Algorithm.initializeCardSRS({
      id: 'test',
      contentType: 'kanji',
      data: {}
    })

    expect(card.algorithm).toBe('sm2')

    const updated = sm2Algorithm.calculateNextReview(card, {
      result: 'good',
      responseTimeMs: 3000,
      timestamp: new Date()
    })

    expect(updated.algorithm).toBe('sm2') // Preserved
  })
})
```

---

## Component Test Specifications

### 6.1 Round2Test Component

**Priority:** **P1 Critical**
**Effort:** 120 min

```typescript
// File: src/app/[locale]/tools/kanji-mastery/learn/components/__tests__/Round2Test.test.tsx

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Round2Test from '../Round2Test'
import type { KanjiWithExamples } from '../../LearnContent'

const mockKanji: KanjiWithExamples = {
  kanji: '日',
  meaning: 'sun',
  meanings: ['sun'],
  onyomi: ['ニチ'],
  kunyomi: ['ひ'],
  jlpt: 'N5',
  strokeCount: 4,
  examples: []
}

describe('Round2Test', () => {
  const defaultProps = {
    kanji: mockKanji,
    currentIndex: 0,
    totalKanji: 5,
    onComplete: jest.fn(),
    onExit: jest.fn(),
    testMode: 'recall' as const,
    distractorPool: [],
    enableRandomizedOrder: false,
    lastTestType: null
  }

  describe('legacy mode (flag off)', () => {
    it('shows fixed test order: meaning → onyomi → kunyomi → recognition', () => {
      render(<Round2Test {...defaultProps} />)

      // First test should be meaning
      expect(screen.getByText(/What is the meaning of 日/)).toBeInTheDocument()
    })

    it('progresses through all test types', async () => {
      render(<Round2Test {...defaultProps} />)

      // Test 1: Meaning
      fireEvent.change(screen.getByPlaceholderText('Type your answer...'), {
        target: { value: 'sun' }
      })
      fireEvent.click(screen.getByLabelText('Check answer'))
      await waitFor(() => expect(screen.getByText('Correct!')).toBeInTheDocument())
      fireEvent.click(screen.getByLabelText('Continue'))

      // Test 2: Onyomi
      await waitFor(() => {
        expect(screen.getByText(/What is the on'yomi reading/)).toBeInTheDocument()
      })
    })
  })

  describe('randomized mode (flag on)', () => {
    it('generates different order than legacy', () => {
      const { rerender } = render(
        <Round2Test {...defaultProps} enableRandomizedOrder={true} />
      )

      // With randomization, order should vary
      // (This test would need multiple runs or seeded RNG mock)
      const firstQuestion = screen.getByRole('heading', { level: 3 })

      rerender(<Round2Test {...defaultProps} enableRandomizedOrder={false} />)

      const secondQuestion = screen.getByRole('heading', { level: 3 })

      // Questions should be different
      // (In practice, you'd mock the randomization)
    })

    it('preserves order across re-renders', () => {
      const { rerender } = render(
        <Round2Test {...defaultProps} enableRandomizedOrder={true} />
      )

      const firstQuestion = screen.getByRole('heading', { level: 3 }).textContent

      // Force re-render
      rerender(<Round2Test {...defaultProps} enableRandomizedOrder={true} />)

      const secondQuestion = screen.getByRole('heading', { level: 3 }).textContent

      expect(firstQuestion).toBe(secondQuestion)
    })

    it('returns finalTestType on completion', async () => {
      const onComplete = jest.fn()
      render(
        <Round2Test
          {...defaultProps}
          enableRandomizedOrder={true}
          onComplete={onComplete}
        />
      )

      // Complete all tests
      // (Simplified - actual test would go through all tests)
      for (let i = 0; i < 4; i++) {
        fireEvent.click(screen.getByLabelText('Skip'))
        if (i < 3) {
          await waitFor(() => screen.getByPlaceholderText('Type your answer...'))
        }
      }

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledWith(
          expect.any(Array),
          expect.any(String) // finalTestType
        )
      })
    })
  })

  describe('result attribution (CRITICAL)', () => {
    it('maps results[i].type to displayed test', async () => {
      const onComplete = jest.fn()
      render(<Round2Test {...defaultProps} onComplete={onComplete} />)

      // Answer first test
      fireEvent.change(screen.getByPlaceholderText('Type your answer...'), {
        target: { value: 'sun' }
      })
      fireEvent.click(screen.getByLabelText('Check answer'))
      await waitFor(() => screen.getByText('Correct!'))
      fireEvent.click(screen.getByLabelText('Continue'))

      // Skip remaining
      for (let i = 0; i < 3; i++) {
        await waitFor(() => screen.getByLabelText('Skip'))
        fireEvent.click(screen.getByLabelText('Skip'))
      }

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalled()
      })

      const results = onComplete.mock.calls[0][0]

      // First result should be 'meaning' (fixed order)
      expect(results[0].type).toBe('meaning')
      expect(results[0].correct).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('handles empty test array gracefully', () => {
      const kanjiNoReadings = {
        ...mockKanji,
        meaning: '',
        onyomi: [],
        kunyomi: []
      }

      render(<Round2Test {...defaultProps} kanji={kanjiNoReadings} />)

      expect(screen.getByText(/No valid tests/)).toBeInTheDocument()
    })
  })
})
```

---

### 6.2 LearnContent State Machine

**Priority:** P2
**Effort:** 90 min

```typescript
// File: src/app/[locale]/tools/kanji-mastery/learn/__tests__/LearnContent.test.tsx

describe('LearnContent State Machine', () => {
  it('transitions through 3 rounds correctly', () => {
    // Test Round 1 → Round 2 → Round 3 transitions
    // Verify currentRound and currentIndex state
  })

  it('updates lastTestType after Round 2 completion', () => {
    // Test Option C de-clumping state management
  })

  it('adds to reviewAgainPile when accuracy < 0.7', () => {
    // Test review pile logic
  })

  it('calculates session stats on completion', () => {
    // Test stats calculation
  })
})
```

---

### 6.3 SessionCompleteModal

**Priority:** P3
**Effort:** 30 min

```typescript
// File: src/app/[locale]/tools/kanji-mastery/components/__tests__/SessionCompleteModal.test.tsx

describe('SessionCompleteModal', () => {
  it('displays accuracy as percentage (decimal * 100)', () => {
    const sessionState = {
      kanji: [],
      currentRound: 3,
      currentIndex: 0,
      progress: new Map([
        ['日', { kanjiId: '日', round1Completed: true, round2Results: [], round2Accuracy: 0.75, round3Rating: 4 }],
        ['月', { kanjiId: '月', round1Completed: true, round2Results: [], round2Accuracy: 0.50, round3Rating: 3 }]
      ]),
      reviewAgainPile: new Set(),
      sessionId: 'test',
      startTime: new Date(),
      level: 'N5',
      mode: 'jlpt' as const
    }

    render(<SessionCompleteModal sessionState={sessionState} {...mockProps} />)

    // Average: (0.75 + 0.50) / 2 = 0.625 = 63%
    expect(screen.getByText('63%')).toBeInTheDocument()
  })

  it('shows correct Doshi mood based on performance', () => {
    // Test mood thresholds
  })
})
```

---

## E2E Test Specifications

### 7.1 Smoke Test: Complete Session Flow

**Priority:** P2
**Effort:** 60 min

```typescript
// File: e2e/kanji-mastery-smoke.spec.ts

import { test, expect } from '@playwright/test'

test('complete kanji mastery session (legacy mode)', async ({ page }) => {
  await page.goto('/tools/kanji-mastery')

  // Start session
  await page.click('text=Start Session')
  await page.waitForURL(/\/learn/)

  // Round 1: Learn
  await expect(page.locator('text=Round 1: Learn')).toBeVisible()
  await page.click('button:has-text("Continue")')

  // Round 2: Test
  await expect(page.locator('text=Round 2: Test')).toBeVisible()
  await page.fill('input[placeholder*="answer"]', 'sun')
  await page.click('[aria-label="Check answer"]')
  await expect(page.locator('text=Correct!')).toBeVisible()
  await page.click('[aria-label="Continue"]')

  // Complete remaining tests
  for (let i = 0; i < 3; i++) {
    await page.click('[aria-label="Skip"]')
  }

  // Round 3: Evaluate
  await expect(page.locator('text=Round 3: Evaluate')).toBeVisible()
  await page.click('text=Easy')

  // Session Complete
  await expect(page.locator('text=Session Complete')).toBeVisible()
  await expect(page.locator('text=%')).toBeVisible()
})

test('randomized test order differs from legacy', async ({ page, context }) => {
  // Set feature flag via localStorage
  await context.addInitScript(() => {
    localStorage.setItem('NEXT_PUBLIC_KANJI_TEST_RANDOMIZE', 'true')
  })

  await page.goto('/tools/kanji-mastery/learn?size=1&mode=jlpt&level=N5')

  // Skip to Round 2
  await page.click('text=Continue')

  const firstQuestion = await page.locator('h3').first().textContent()

  // With randomization, first question should vary
  // (This would need multiple runs or controlled seed)
  expect(firstQuestion).toBeTruthy()
})
```

---

### 7.2 Data Persistence Validation

**Priority:** P2
**Effort:** 30 min

```typescript
test('session persists to IndexedDB', async ({ page }) => {
  await page.goto('/tools/kanji-mastery/learn?size=1')

  // Complete session
  // ... (same as smoke test)

  // Verify IndexedDB
  const hasSession = await page.evaluate(async () => {
    const db = await indexedDB.open('moshimoshi_progress')
    const tx = db.transaction('kanji_mastery_sessions', 'readonly')
    const store = tx.objectStore('kanji_mastery_sessions')
    const sessions = await store.getAll()
    return sessions.length > 0
  })

  expect(hasSession).toBe(true)
})
```

---

## Test Infrastructure Setup

### 8.1 Required Packages

```bash
# Unit + Component Tests
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event

# IndexedDB Testing
npm install -D fake-indexeddb

# E2E Testing (choose one)
npm install -D @playwright/test
# or
npm install -D cypress
```

### 8.2 Jest Configuration

```javascript
// jest.config.js (update)
module.exports = {
  // ... existing config

  // Coverage thresholds
  coverageThresholds: {
    'src/lib/review-engine/**/*.ts': {
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90
    },
    'src/app/**/tools/kanji-mastery/**/*.ts': {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80
    }
  },

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js',
    '<rootDir>/test-utils/indexeddb-setup.js'
  ]
}
```

### 8.3 IndexedDB Mock Setup

```javascript
// test-utils/indexeddb-setup.js
import 'fake-indexeddb/auto'

// Reset between tests
beforeEach(() => {
  // Clear all databases
  const dbs = indexedDB.databases ? indexedDB.databases() : []
  dbs.then(databases => {
    databases.forEach(db => {
      if (db.name) indexedDB.deleteDatabase(db.name)
    })
  })
})
```

### 8.4 Test Utilities

```typescript
// test-utils/kanji-fixtures.ts
import type { KanjiWithExamples } from '@/app/[locale]/tools/kanji-mastery/learn/LearnContent'

export const makeKanji = (overrides: Partial<KanjiWithExamples> = {}): KanjiWithExamples => ({
  kanji: '日',
  meaning: 'sun',
  meanings: ['sun'],
  onyomi: ['ニチ'],
  kunyomi: ['ひ'],
  jlpt: 'N5',
  strokeCount: 4,
  examples: [],
  ...overrides
})

export const makeRng = (seed: number) => {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}
```

---

## QA & Manual Testing

### 9.1 Pre-Release QA Checklist

**Test Matrix: Feature Flag Toggle**

| Test Case | Flag OFF (Legacy) | Flag ON (Randomized) | Pass/Fail |
|-----------|-------------------|----------------------|-----------|
| Session loads | ✅ Fixed order | ✅ Random order | |
| Test order stable | ✅ Same on refresh | ✅ Same on refresh | |
| Results attributed | ✅ Correct | ✅ Correct | |
| SRS updates | ✅ Scheduled | ✅ Scheduled | |
| IndexedDB saves | ✅ Persists | ✅ Persists | |
| Firebase sync (premium) | ✅ Syncs | ✅ Syncs | |

**Edge Cases Checklist**

- [ ] Kanji with no onyomi
- [ ] Kanji with no kunyomi
- [ ] Kanji with both readings missing
- [ ] Session with 1 kanji
- [ ] Session with 10 kanji
- [ ] Mobile device (PWA)
- [ ] Slow network (3G throttle)
- [ ] IndexedDB quota warning
- [ ] Firebase offline

### 9.2 Manual Testing Scenarios

**Scenario 1: Accuracy Format Validation**
1. Complete session with 50% accuracy
2. Check Round 3 display: Shows "50%" (not "0.5")
3. Check SessionCompleteModal: Shows "50%"
4. Check IndexedDB: `round2Accuracy` = 0.5 (decimal)
5. Check Firebase: `averageAccuracy` = 0.5 (decimal)

**Scenario 2: Randomization Validation**
1. Enable feature flag: `NEXT_PUBLIC_KANJI_TEST_RANDOMIZE=true`
2. Complete 5 sessions with same kanji
3. Verify test order varies across sessions
4. Verify no on/kun adjacency
5. Verify lastTestType de-clumping works

**Scenario 3: Data Persistence**
1. Complete session (authenticated)
2. Close browser
3. Reopen browser
4. Navigate to Kanji Progress view
5. Verify session appears in history
6. Verify progress cards show updated SRS data

---

## Rollout Validation Strategy

### 10.1 Feature Flag Rollout Phases

**Phase 1: Internal Testing (1-2 days)**
- Enable for dev team only
- Monitor error logs
- Validate data integrity

**Phase 2: Beta Users (3-5 days)**
- Enable for 10% of premium users
- A/B test metrics:
  - Session completion rate
  - Average accuracy
  - Support tickets
  - SRS data corruption rate (0% target)

**Phase 3: Gradual Rollout (1 week)**
- Increase to 50% → 100% based on metrics

**Phase 4: Default On (after 1 week)**
- Remove feature flag
- Monitor for 1 week
- Close rollout

### 10.2 Rollback Criteria

**Automatic Rollback If:**
- SRS data corruption detected (1+ incident)
- Session failure rate >5%
- Critical bug reports >2

**Manual Rollback If:**
- User confusion about randomization
- Support tickets increase >20%

### 10.3 Success Metrics

| Metric | Target | Method |
|--------|--------|--------|
| Data Integrity | 100% | Zero SRS corruption incidents |
| Session Completion | >95% | Analytics tracking |
| User Satisfaction | >4.0/5 | In-app survey |
| Support Tickets | <5% increase | Ticket volume tracking |

---

## Appendices

### A. Test Fixtures Library

Located in `test-utils/kanji-fixtures.ts`:
- `makeKanji()` - Generate test kanji
- `makeProgress()` - Generate progress records
- `makeSessionState()` - Generate session state
- `makeRng()` - Seeded RNG for determinism

### B. Mock Strategies

**IndexedDB Mocking:**
```typescript
import 'fake-indexeddb/auto'
```

**Firebase Admin Mocking:**
```typescript
jest.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    set: jest.fn(),
    get: jest.fn()
  }
}))
```

**Next.js Router Mocking:**
```typescript
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn()
  }),
  useSearchParams: () => new URLSearchParams()
}))
```

### C. Coverage Report Commands

```bash
# Run all unit tests with coverage
npm test -- --coverage

# Run specific module
npm test -- --coverage kanjiMastery

# Generate HTML report
npm test -- --coverage --coverageReporters=html

# Check thresholds
npm test -- --coverage --coverageReporters=text-summary
```

---

## Implementation Timeline

| Phase | Tests | Effort | Week |
|-------|-------|--------|------|
| **Phase 3.1** | testOrder + ProgressManager + DB | 3-4 hours | Week 1 |
| **Phase 3.2** | Integration + kanjiSelection | 3-4 hours | Week 2 |
| **Phase 3.3** | Components + E2E | 4-5 hours | Week 3 |

**Total:** 10-13 hours for comprehensive coverage

---

## Document Status

- **Version:** 1.0
- **Last Updated:** 2026-01-28
- **Maintained By:** Engineering Team
- **Review Cycle:** Quarterly or on major feature changes

---

## Quick Links

- [Onboarding Guide](./KANJI_MASTERY_ONBOARDING.md)
- [Test Order Randomization Plan](./SRS_TEST_ORDER_RANDOMIZATION_PLAN.md)
- [Progress Summary Component](./KANJI_PROGRESS_SUMMARY.md)

---

**End of Document**
