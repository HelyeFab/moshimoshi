# URE Architecture Deep Dive & Legacy ReviewEngine Migration Plan

**Project**: Moshimoshi Japanese Learning Platform
**Document Version**: 2.0 (Updated 2025-12-18)
**Date**: Originally 2025-01-XX, Status Updated 2025-12-18
**Status**: Phase 1 COMPLETE ✅ | Testing REQUIRED ❌ | Feature Migration IN PROGRESS 🟡

---

## 🚨 CURRENT MIGRATION STATUS (Updated 2025-12-18)

**Branch**: `ure-migration` | **Last Commit**: `9212fc59` (Dec 18, 2025)

### Quick Status Overview

| Phase | Target | Status | Progress |
|-------|--------|--------|----------|
| **Phase 1: Infrastructure** | Week 1-2 | ✅ COMPLETE | 100% (Committed Dec 17) |
| **Phase 1.5: Testing** | Week 2 | ✅ COMPLETE | 100% (74 tests, Dec 18) |
| **Phase 2: Feature Migration** | Week 3-8 | 🟡 IN PROGRESS | ~35% (Task 1 done, 2-6 pending) |
| **Phase 3: Cleanup** | Week 9 | 🔴 PENDING | 0% |

### Critical Blockers 🚨

1. **RESOLVED: Test Coverage** ✅
   - ClientEventEmitter: 29 tests, ~95% coverage
   - useSessionManager: 25 tests, ~85% coverage
   - Integration: 20 tests, ~80% coverage
   - **Status**: Infrastructure is production-ready
   - **See**: `01_PRODUCTION_DOCS/TESTING_SUMMARY.md`

2. **RESOLVED: ReviewSessionUI Component** ✅
   - ✅ Component created (265 lines, commit 9212fc59)
   - ✅ TypeScript passes
   - ✅ Uses useSessionManager hook correctly
   - ✅ Initializes Event Hub automatically
   - Ready for feature migration

3. **BLOCKER: Incomplete Feature Migration** 🟡
   - Kana Learning: 50% migrated (has new hook but still uses legacy component)
   - Kanji Browser: ~75% migrated (needs verification)
   - Others: Not started
   - **Action Required**: Complete migrations (see section 7.3-7.4)

### What's Complete ✅

**Infrastructure (All Committed c2029b6c)**:
- ✅ `ClientEventEmitter` (150 lines) - Browser-compatible EventEmitter
- ✅ `Event Hub` (160 lines) - Global event singleton for gamification
- ✅ `useSessionManager` hook (374 lines) - React wrapper for SessionManager
- ✅ SessionManager modifications - Now extends ClientEventEmitter, dual event emission
- ✅ Storage classes - LocalSessionStorage & IndexedDBSessionStorage exist

### What's Missing ❌

**Testing Infrastructure** ✅ COMPLETE (Dec 18):
- ✅ `src/lib/review-engine/__tests__/client-event-emitter.test.ts` (29 tests)
- ✅ `src/hooks/__tests__/useSessionManager.test.tsx` (25 tests)
- ✅ `src/lib/review-engine/__tests__/session-manager-integration.test.ts` (20 tests)

**UI Components** ✅ COMPLETE:
- ✅ `ReviewSessionUI` component (265 lines, commit 9212fc59)
- ⚠️ Features still using legacy `<ReviewEngine>` (migration in progress)

**Feature Migrations**:
- 🟡 Kana Learning - Partially migrated (still uses legacy ReviewEngine)
- 🟡 Kanji Browser - Status unclear (needs verification)
- ❌ Textbook Vocabulary - Not started
- ❌ Anki Study - Not started
- ❌ User Lists - Not started

### Immediate Next Steps (This Week)

**Priority 1**: Create Tests (2-3 days)
```bash
# Create test files - these are critical blockers
touch src/lib/review-engine/__tests__/client-event-emitter.test.ts
touch src/hooks/__tests__/useSessionManager.test.tsx
touch src/lib/review-engine/__tests__/session-manager-integration.test.ts
```

**Priority 2**: Build ReviewSessionUI (2-3 days)
- Component that wraps existing pieces (AnswerInput, ProgressBar, ReviewCard)
- Uses useSessionManager hook internally
- Provides clean interface for features

**Priority 3**: Complete Kana Learning (1-2 days)
- Remove legacy `<ReviewEngine>` usage
- Replace with `<ReviewSessionUI>`
- Test gamification flow

**See sections 9.2 for detailed milestone checklist and section 10 for file references**

---

## Executive Summary

This document provides a comprehensive guide to the Universal Review Engine (URE) architecture and a detailed migration plan to eliminate technical debt from the legacy ReviewEngine component. The migration will affect 5 priority features and reduce duplicate code by ~3,000 lines while improving reliability, performance, and maintainability.

**Critical Finding**: The ReviewEngine component bypasses proper URE SessionManager architecture, creating ~500 lines of duplicate session logic per feature. This plan establishes the proper implementation pattern and migrates 5 priority features.

**Migration Progress**: Phase 1 infrastructure is complete and committed (Dec 17, 2025). Testing and feature migration are the next critical steps.

**Scope**: Features 1, 2, 4, 5, and 6 as specified:
1. Kana Learning (🟡 50% migrated)
2. Kanji Browser (🟡 75% migrated)
4. Anki Study (🔴 Not started)
5. Textbook Vocabulary (🔴 Not started)
6. User Lists (🔴 Not started)

---

## Table of Contents

1. [What is URE?](#1-what-is-ure)
2. [URE Architecture Deep Dive](#2-ure-architecture-deep-dive)
3. [Where is URE Properly Implemented?](#3-where-is-ure-properly-implemented)
4. [Current Architecture Problems](#4-current-architecture-problems)
5. [How to Implement URE Correctly](#5-how-to-implement-ure-correctly)
6. [How to Extend URE](#6-how-to-extend-ure)
7. [Migration Plan: ReviewEngine → SessionManager](#7-migration-plan)
8. [Testing Strategy](#8-testing-strategy)
9. [Rollout Timeline](#9-rollout-timeline)
10. [Critical Files Reference](#10-critical-files-reference)

---

## 1. What is URE?

### 1.1 Definition

The **Universal Review Engine (URE)** is a sophisticated, event-driven spaced repetition system designed to handle multiple content types (kana, kanji, vocabulary, sentences, custom) through a unified interface. It implements the SM-2+ algorithm with enhancements for optimal learning.

**Core Location**: `/src/lib/review-engine/`

### 1.2 Key Capabilities

- **Event-Driven Architecture**: Built on EventEmitter pattern for loose coupling between components
- **Content Agnostic**: Adapters transform any content type into unified `ReviewableContent` interface
- **Advanced SRS**: SM-2+ algorithm with:
  - Interval randomization (±5%) to prevent batch review syndrome
  - Overdue bonuses (+20-50% interval for 7+ days overdue)
  - Leech detection (visual indicators after 8 failures)
  - Performance: <1ms per calculation (target: <10ms)
- **Offline-First**: IndexedDB storage with circuit breaker sync patterns
- **Multi-Strategy Validation**: Exact, fuzzy (Levenshtein distance ≥0.8), and custom validators with Japanese language support (hiragana/katakana variants, okurigana flexibility)
- **Smart Queue Prioritization**: Algorithm considering overdue time (+100 max), priority levels (+50), success rates (+40), and recency penalties (-60)

### 1.3 Design Principles

1. **Single Responsibility**: Each component has one clear purpose
2. **Event-Driven**: Components communicate via events, not direct calls
3. **Adapter Pattern**: Content transformation is abstracted and extensible
4. **Offline-First**: All operations work offline with background sync
5. **Type Safety**: Full TypeScript coverage with strict typing
6. **Testability**: 80%+ coverage requirement, 95% for critical paths

---

## 2. URE Architecture Deep Dive

### 2.1 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  Page Component (Kanji Browser, Anki Study, etc.)               │
│         ↓                                                        │
│  useSessionManager hook (PLANNED - doesn't exist yet)           │
│         ↓                                                        │
│  SessionManager (Event-Driven Core)                             │
│    Lines 48-857 of src/lib/review-engine/session/manager.ts    │
│         ↓                                                        │
│  ┌──────────────────┬──────────────────┬──────────────────┐    │
│  │   Adapters       │   SRS Algorithm  │   Validation     │    │
│  │   (Transform)    │   (Calculate)    │   (Verify)       │    │
│  └──────────────────┴──────────────────┴──────────────────┘    │
│         ↓                      ↓                     ↓          │
│  ┌──────────────────┬──────────────────┬──────────────────┐    │
│  │   Storage        │   Queue Gen      │   Pin Manager    │    │
│  │   (IndexedDB)    │   (Prioritize)   │   (Track Items)  │    │
│  └──────────────────┴──────────────────┴──────────────────┘    │
│         ↓                                                        │
│  Event Bus (EventEmitter)                                       │
│         ↓                                                        │
│  Listeners (Gamification, Analytics, Progress)                  │
├─────────────────────────────────────────────────────────────────┤
│                        SERVER LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  API Routes                                                      │
│  ├─ POST /api/review/session/start    (✓ Uses SessionManager)  │
│  ├─ POST /api/review/session/answer                             │
│  └─ POST /api/review/session/complete                           │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Core Components

#### 2.2.1 SessionManager

**File**: `src/lib/review-engine/session/manager.ts` (Lines 48-857)
**Role**: The heart of URE - manages complete review session lifecycle

**Key Responsibilities**:
- Session lifecycle management (start → active → paused/resumed → completed/abandoned)
- Item presentation and answer validation
- Statistics tracking (accuracy, streaks, response times)
- SRS interval calculations
- Event emission for all session activities

**Critical Methods**:

```typescript
// Start new session
async startSession(options: CreateSessionOptions): Promise<ReviewSession>
  // Lines 66-114
  // Creates session ID, shuffles items if requested, initializes statistics
  // Persists to storage, starts activity timer
  // Emits SESSION_STARTED event

// Get current item to display
getCurrentItem(): ReviewSessionItem | null
  // Lines 119-138
  // Returns item at currentIndex
  // Marks presentedAt timestamp
  // Emits ITEM_PRESENTED event

// Submit user answer
async submitAnswer(answer: string, confidence?: 1|2|3|4|5): Promise<ValidationResult>
  // Lines 143-222
  // Validates answer via validator
  // Calculates score with modifiers (hints, attempts, confidence)
  // Updates statistics (accuracy, streaks)
  // Calculates SRS intervals
  // Emits ITEM_ANSWERED event (includes SRS data!)

// Move to next item or complete session
async nextItem(): Promise<ReviewSessionItem | null>
  // Lines 227-257
  // Increments currentIndex
  // Returns next item or calls completeSession()
  // Emits PROGRESS_UPDATED event

// Complete session
async completeSession(): Promise<SessionStatistics>
  // Lines 344-378
  // Finalizes statistics
  // Records daily activity
  // Saves final state
  // Emits SESSION_COMPLETED event (gamification listens here!)
```

**Event Emissions** (via `ReviewEventType`):
- `SESSION_STARTED` - When session begins (line 102)
- `ITEM_PRESENTED` - When item shown to user (line 128)
- `ITEM_ANSWERED` - After answer validation, includes SRS data and nextReviewAt (line 208)
- `PROGRESS_UPDATED` - After each item (line 243)
- `STREAK_UPDATED` - On streak milestones
- `SESSION_COMPLETED` - With full statistics (line 363) **← Gamification listens here!**

#### 2.2.2 Content Adapters

**Directory**: `src/lib/review-engine/adapters/`
**Registry**: `src/lib/review-engine/adapters/registry.ts` (Lines 23-199)

**Purpose**: Transform domain-specific content → unified `ReviewableContent` interface

**Base Interface** (from `core/interfaces.ts` lines 15-106):
```typescript
interface ReviewableContent {
  id: string
  contentType: 'kana' | 'kanji' | 'vocabulary' | 'sentence' | 'custom'

  // Display fields
  primaryDisplay: string      // What user sees (character, word)
  secondaryDisplay?: string   // Supporting info (meaning, translation)
  tertiaryDisplay?: string    // Extra context (examples, notes)
  reading?: string            // Pronunciation

  // Answer fields
  primaryAnswer: string       // Expected answer
  alternativeAnswers?: string[] // Acceptable variations

  // Media
  audioUrl?: string
  imageUrl?: string
  videoUrl?: string

  // Configuration
  difficulty: number          // 0.0 to 1.0
  tags: string[]
  supportedModes: ReviewMode[]
  preferredMode?: ReviewMode

  metadata?: Record<string, any>
}
```

**Registered Adapters** (in AdapterRegistry.initialize(), lines 36-45):
```typescript
'kana' → KanaAdapter           // Hiragana/Katakana characters
'kanji' → KanjiAdapter         // Kanji with readings, meanings, stroke order
'vocabulary' → VocabularyAdapter // Words with readings, pitch accent
'sentence' → SentenceAdapter   // Full sentences with translations
'custom' → CustomContentAdapter // User-defined content
'moodboard' → MoodBoardAdapter
'kanji_mastery' → KanjiMasteryAdapter
'anki-card' → AnkiAdapter
'textbook_vocabulary' → TextbookVocabularyAdapter

// Dynamic adapters (created per instance):
UserListAdapter (via createUserListAdapter())
FlashcardAdapter (via createFlashcardAdapter())
```

**Adapter Base Class** (from `base.adapter.ts` lines 21-136):
```typescript
abstract class BaseContentAdapter<T> {
  abstract transform(rawContent: T): ReviewableContent

  // Optional advanced features:
  generateOptions(content, pool, count): ReviewableContent[]  // Multi-choice
  getSupportedModes(): ReviewMode[]
  prepareForMode(content, mode): ReviewableContent
  calculateDifficulty(content): number
  generateHints(content): string[]
  calculateSimilarity(a, b): number  // Levenshtein distance
}
```

**Example: KanjiAdapter Sophistication** (`kanji.adapter.ts` lines 26-345):
- 14 confusion pairs database (末/未, 土/士)
- 7 semantic categories (nature, time, people, body, movement, numbers, directions)
- 5-tier distractor generation:
  1. Confusion pairs (visual similarity)
  2. Semantic similarity (shared meaning categories)
  3. Structural similarity (shared radicals)
  4. Stroke count similarity (±2 strokes)
  5. Learning level similarity (same JLPT/grade)
- Sophisticated difficulty calculation (lines 166-189)
- 5-level hint system (lines 191-230)

#### 2.2.3 SRS Algorithm

**File**: `src/lib/review-engine/srs/algorithm.ts` (Line 156: `calculateNext()`)
**Implementation**: SM-2+ with enhancements

**Configuration** (`DEFAULT_SRS_CONFIG`):
```typescript
{
  initialEaseFactor: 2.5,
  minEaseFactor: 1.3,
  maxEaseFactor: 2.5,
  learningSteps: [0.0069, 0.0208],  // 10min, 30min in days
  graduatingInterval: 1,              // 1 day
  easyMultiplier: 1.3,
  hardMultiplier: 0.6,
  maxInterval: 365,                   // 1 year max
  leechThreshold: 8,                  // 8 failures = leech
  responseTimeFactor: 0.001
}
```

**State Flow**:
```
NEW → LEARNING → REVIEW → MASTERED
```

**Enhancements**:
- **Interval Randomization**: ±5% to prevent batch review syndrome
- **Overdue Bonus**: +20-50% interval for items 7+ days overdue
- **Leech Detection**: Visual indicators for items with 8+ failures
- **Performance**: <1ms per calculation (target: <10ms)

**Key Method**:
```typescript
calculateNextReview(
  item: ReviewableContentWithSRS,
  result: ReviewResult
): SRSData
```

Returns updated SRS data:
- Next review date/time
- Updated ease factor
- New interval
- Status transition (NEW→LEARNING→REVIEW→MASTERED)
- Streak tracking

#### 2.2.4 Validation System

**Directory**: `src/lib/review-engine/validation/`
**Factory**: `validation/factory.ts` (Line 45)

**Multi-Strategy Validation** with Japanese language support:

**Strategies**:
- **Exact**: Character-perfect matching
- **Fuzzy**: Levenshtein distance (threshold: 0.8 similarity) - `BaseValidator.ts` line 234
- **Custom**: Content-type specific rules

**Japanese-Specific Features**:
- Hiragana/Katakana variant matching (あ = ア)
- Okurigana flexibility (やま.す accepts やま or やます)
- Romaji conversion tolerance
- Partial credit for close answers (0.6-0.8 similarity)

**Base Validator** (`BaseValidator.ts`):
```typescript
abstract class BaseValidator {
  validate(
    userAnswer: string,
    correctAnswer: string | string[],
    context?: any
  ): ValidationResult

  protected normalize(text: string): string
  protected calculateSimilarity(str1: string, str2: string): number  // Line 234
}
```

**Specific Validators**:
- `KanaValidator` - Script-aware kana validation
- `KanjiValidator` - Multiple reading support
- `VocabularyValidator` - Flexible reading/meaning matching
- `SentenceValidator` - Fuzzy sentence matching (threshold: 0.7)

#### 2.2.5 Queue Generator

**File**: `src/lib/review-engine/queue/queue-generator.ts`

**Smart Prioritization Algorithm**:
```typescript
Priority Score = Base + Bonuses - Penalties

Bonuses:
+ 100 max for overdue (1 day = 10 points)
+ 50 for high priority items
+ 30 for new items
+ 20 for learning items
+ 40 for low success rate (<60%)
+ 35 for leech items

Penalties:
- 60 for recently reviewed (< 1 hour)
```

**Queue Generation**:
```typescript
async generateQueue(
  userId: string,
  pinnedItems: PinnedItem[],
  options: QueueOptions
): Promise<{ items: QueueItem[], stats: QueueStatistics }>
```

**Options**:
- `limit` - Max items (default: 20)
- `contentTypes` - Filter by type
- `includeNew` - Include new items
- `includeDue` - Include due reviews
- `includeLearning` - Include learning phase
- `shuffleOrder` - Randomize within priority bands
- `priorityBoost` - Apply user priority settings

#### 2.2.6 Event System

**File**: `src/lib/review-engine/core/events.ts`

**Event-Driven Architecture** for loose coupling:

**Key Events** (ReviewEventType enum, lines 12-52):
```typescript
enum ReviewEventType {
  // Session lifecycle
  SESSION_STARTED = 'session.started',
  SESSION_PAUSED = 'session.paused',
  SESSION_RESUMED = 'session.resumed',
  SESSION_COMPLETED = 'session.completed',  // ← CRITICAL: Gamification listens here
  SESSION_ABANDONED = 'session.abandoned',

  // Item events
  ITEM_PRESENTED = 'item.presented',
  ITEM_ANSWERED = 'item.answered',          // ← Includes SRS data
  ITEM_SKIPPED = 'item.skipped',
  ITEM_HINT_USED = 'item.hint_used',

  // Progress
  PROGRESS_UPDATED = 'progress.updated',
  STREAK_UPDATED = 'streak.updated',

  // Sync/Errors
  SYNC_STARTED = 'sync.started',
  SYNC_COMPLETED = 'sync.completed',
  ERROR_OCCURRED = 'error.occurred',
}
```

**Critical Event Payloads**:

**ItemAnsweredPayload** (lines 154-171):
```typescript
{
  itemId: string
  correct: boolean
  responseTime: number
  userAnswer: string
  expectedAnswer: string
  confidence?: 1|2|3|4|5
  score: number
  attempts: number
  nextReviewAt?: Date              // ← SRS next review time
  contentType?: string
  srsData?: {                       // ← Full SRS state
    interval: number
    repetitions: number
    easeFactor: number
    status: 'NEW' | 'LEARNING' | 'REVIEW' | 'MASTERED'
  }
}
```

**SessionCompletedPayload** (lines 122-126):
```typescript
{
  sessionId: string
  statistics: SessionStatistics    // Full session stats
  duration: number                 // Total time in ms
}
```

---

## 3. Where is URE Properly Implemented?

### 3.1 Server-Side Reference Implementation ✅

**File**: `src/app/api/review/session/start/route.ts`

**Correct Pattern**:
```typescript
// Line 24: Creates SessionManager instance
const storage = new SessionStorage()
const analytics = new AnalyticsService()
const sessionManager = new SessionManager(storage, analytics)

// Uses proper lifecycle
const session = await sessionManager.startSession(options)

// Events automatically emitted
// SessionManager handles all logic
// Storage abstraction used
```

**Why This Works**:
- SessionManager handles all business logic
- Events emitted automatically to gamification listener
- Storage layer abstracted
- SRS calculations centralized
- Statistics tracking unified

### 3.2 Gamification Integration ✅

**File**: `src/lib/gamification/gamificationListener.ts`

**Correct Pattern** (Lines 67-191):
```typescript
// Read-only listener - never modifies URE
reviewEngineEmitter.on(
  ReviewEventType.SESSION_COMPLETED,
  this.handleSessionCompleted.bind(this)
)

// In handleSessionCompleted:
const { sessionId, statistics, duration } = payload

// Call server API
const response = await fetch('/api/review/session/complete', {
  method: 'POST',
  body: JSON.stringify({
    sessionId,
    itemsReviewed: statistics.totalItems,
    correctCount: statistics.correctItems,
    accuracy: statistics.accuracy
  })
})

// Update Zustand store from server response
store.updateFromServer({
  totalXP: result.gamification.newTotalXP,
  currentLevel: result.gamification.newLevel,
  currentStreak: result.gamification.currentStreak,
  bestStreak: result.gamification.bestStreak
})
```

**Why This Works**:
- Gamification is completely decoupled from URE
- Listens to events, doesn't call URE methods
- Firebase is single source of truth (server-side)
- Atomic transactions via gamification-coordinator
- Zero risk of corrupting session state

### 3.3 Complete Data Flow (Correct Implementation)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. URE SESSION COMPLETION                                   │
│    SessionManager.completeSession()                         │
│    ↓ emits SESSION_COMPLETED event                          │
│    src/lib/review-engine/session/manager.ts:363             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. CLIENT-SIDE EVENT LISTENER                               │
│    gamificationListener.handleSessionCompleted()            │
│    src/lib/gamification/gamificationListener.ts:90          │
│    ↓ Extracts: sessionId, statistics, duration              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. SERVER API CALL                                          │
│    POST /api/review/session/complete                        │
│    src/app/api/review/session/complete/route.ts:37         │
│    ↓ Payload: sessionId, itemsReviewed, correctCount,      │
│               accuracy, bestStreak?, fastCards?             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. GAMIFICATION COORDINATOR (Firestore Transaction)         │
│    recordReviewCompletion()                                 │
│    src/lib/gamification/services/gamification-coordinator.ts│
│    :358                                                      │
│    ↓ Atomic transaction:                                    │
│      - calculateReviewXP() or calculateFlashcardXP()        │
│      - Update user_stats.xp.total                           │
│      - Track daily XP (xpGainedToday)                       │
│      - updateStreakWithinTransaction() if threshold met     │
│      - Check achievements                                   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. ZUSTAND STORE UPDATE                                     │
│    useGamificationStore.updateFromServer()                  │
│    src/state/userGamification.ts:476                        │
│    ↓ Updates: totalXP, currentLevel, currentStreak,        │
│               bestStreak, lastSyncedAt                      │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. INCREMENT SESSION COUNT                                  │
│    useGamificationStore.incrementSessionCount()             │
│    src/state/userGamification.ts:451                        │
│    ↓ sessionCount++ (watched by CelebrationProvider)        │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. CELEBRATION UI TRIGGERED                                 │
│    CelebrationProvider useEffect()                          │
│    src/components/gamification/CelebrationProvider.tsx:34   │
│    ↓ Detects: totalXP > previousXP &&                       │
│               sessionCount > previousSessionCount           │
│    ↓ Shows: CelebrationScreen with xpGained                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Current Architecture Problems

### 4.1 Critical Issue: ReviewEngine Bypasses SessionManager

**Problem File**: `src/components/review-engine/ReviewEngine.tsx` (738 lines)

**Root Cause**: ReviewEngine component reimplements SessionManager functionality instead of using it.

**Issues Identified**:

1. **Duplicate Session Logic** (Lines 100-177)
   - Creates ReviewSession object manually
   - Doesn't use SessionManager.startSession()
   - Custom session state management

2. **Duplicate Validation** (Lines 186-187)
   - Comment: "Simplified validation - would use adapter in real implementation"
   - Doesn't use URE validators

3. **Manual SRS Calculation** (Lines 199-241)
   - Calls `srsAlgorithm.calculateNext()` directly
   - Bypasses SessionManager's SRS coordination
   - Comment on line 233: "SRS debugging" (temporary code)

4. **Direct Storage Access** (Line 246)
   - localStorage writes instead of storage layer
   - No offline sync integration
   - No circuit breaker pattern

5. **Custom Event Dispatch** (Lines 294-305)
   - Creates own EventEmitter
   - Doesn't integrate with global event hub
   - Gamification listener may miss events

6. **Statistics Calculation** (Lines 419-512)
   - Duplicates SessionManager statistics logic
   - May produce inconsistent stats

7. **No Analytics Integration**
   - SessionManager has AnalyticsService
   - ReviewEngine has no analytics tracking

**Code Comparison**:

```typescript
// ❌ CURRENT (ReviewEngine.tsx - Lines 100-177)
const ReviewEngine: FC<Props> = ({ content, mode, onComplete, userId }) => {
  // Manual session creation
  const [session, setSession] = useState<ReviewSession>({
    id: `session_${Date.now()}`,
    userId,
    startedAt: new Date(),
    items: content.map(c => ({
      content: c,
      presentedAt: null,
      answeredAt: null,
      // ... manual item structure
    })),
    currentIndex: 0,
    mode,
    status: 'active'
  })

  // Custom validation
  const validateAnswer = (answer: string) => {
    // Simplified validation - would use adapter in real implementation
    return answer === session.items[session.currentIndex].content.primaryAnswer
  }

  // Manual SRS calculation
  const handleAnswer = async (answer: string) => {
    const correct = validateAnswer(answer)

    // Direct SRS call
    const srsData = srsAlgorithm.calculateNext(item.srsData, {
      correct,
      responseTime: Date.now() - presentedAt
    })

    // Direct localStorage write
    localStorage.setItem('progress', JSON.stringify(progress))

    // Custom event emission
    eventEmitter.emit('ITEM_ANSWERED', { ... })
  }

  // Custom statistics
  const calculateStats = () => {
    return {
      totalItems: session.items.length,
      correctItems: session.items.filter(i => i.correct).length,
      // ... manual stat calculation
    }
  }

  return (
    <div>
      {/* Render UI */}
    </div>
  )
}
```

```typescript
// ✅ CORRECT (Should use SessionManager)
const ReviewEngine: FC<Props> = ({ content, mode, onComplete, userId }) => {
  // Use SessionManager via hook
  const {
    session,
    currentItem,
    statistics,
    submitAnswer,
    nextItem,
    completeSession
  } = useSessionManager({
    userId,
    mode,
    content,
    onComplete
  })

  const handleAnswer = async (answer: string) => {
    // SessionManager handles:
    // - Validation via validators
    // - SRS calculation
    // - Storage persistence
    // - Event emission
    // - Statistics tracking
    // - Analytics
    await submitAnswer(answer)
  }

  return (
    <div>
      {/* Render UI with session state */}
    </div>
  )
}
```

### 4.2 Missing Infrastructure

**Missing File**: `src/hooks/useSessionManager.ts` (doesn't exist)

**Required Functionality**:
```typescript
interface UseSessionManagerReturn {
  // State
  session: ReviewSession | null
  currentItem: ReviewSessionItem | null
  statistics: SessionStatistics | null
  isLoading: boolean
  error: Error | null
  progress: {
    current: number
    total: number
    percentage: number
    correct: number
    incorrect: number
    skipped: number
  }

  // Methods
  startSession(options: CreateSessionOptions): Promise<void>
  submitAnswer(answer: string, confidence?: 1|2|3|4|5): Promise<void>
  nextItem(): Promise<void>
  skipItem(): Promise<void>
  useHint(): Promise<string>
  pauseSession(): Promise<void>
  resumeSession(): Promise<void>
  completeSession(): Promise<void>

  // Advanced
  getEventEmitter(): EventEmitter
  manager: SessionManager | null
}
```

### 4.3 Affected Features

**Features Using Legacy ReviewEngine** (not SessionManager):

1. **Kana Learning** (`src/components/learn/KanaLearningComponent.tsx`)
   - Line 48: Dynamically imports ReviewEngine
   - Lines 1110-1117: Uses ReviewEngine for review mode
   - Lines 232-238: Manual gamificationListener initialization
   - Lines 497-508: Manual SESSION_COMPLETED emission
   - **Impact**: ~50 lines need modification

2. **Kanji Browser** (`src/app/[locale]/kanji-browser/KanjiBrowserPage.tsx`)
   - Line 37: Dynamically imports ReviewEngine
   - Lines 692-704: Uses ReviewEngine
   - Lines 180-191: Manual gamificationListener initialization
   - Lines 484-496: Manual SESSION_COMPLETED emission
   - **Impact**: ~80 lines need modification

4. **Anki Study** (`src/app/[locale]/anki-study/[deckId]/page.tsx`)
   - Line 9: Imports ReviewEngine
   - Uses ReviewEngine for study sessions
   - **Impact**: ~100 lines need modification

5. **Textbook Vocabulary** (`src/app/[locale]/textbook-vocabulary/page.tsx`)
   - Uses ReviewEngine
   - **Impact**: ~60 lines need modification

6. **User Lists** (`src/app/[locale]/lists/[listId]/page.tsx`)
   - Uses ReviewEngine
   - **Impact**: ~70 lines need modification

**Total**: 5 features using legacy pattern, ~360 lines to modify

### 4.4 Impact Analysis

**Code Duplication**:
- ReviewEngine: 738 lines
- ~500 lines of session logic per feature
- 5 features = ~3,690 lines of duplicate code

**Bundle Size**:
- ReviewEngine: ~35KB gzipped per feature
- 5 features = ~175KB total
- After migration: ~65KB total (SessionManager + hook shared)
- **Savings**: ~110KB (63% reduction)

**Reliability Issues**:
- Gamification XP sometimes not awarded (~20% failure rate observed)
- Statistics inconsistencies between features
- Session state corruption on fast navigation
- No proper error handling or recovery

**Performance Issues**:
- Multiple EventEmitter instances (memory leak risk)
- No event listener cleanup on unmount
- Direct localStorage I/O on main thread
- No request batching or debouncing

---

## 5. How to Implement URE Correctly

### 5.1 Proper Implementation Flow

```
┌────────────────────────────────────────────────────────────────┐
│ 1. PAGE COMPONENT                                               │
│    ├─ Load content from API/database                           │
│    └─ Pass to useSessionManager hook                           │
├────────────────────────────────────────────────────────────────┤
│ 2. useSessionManager HOOK                                       │
│    ├─ Creates SessionManager instance (client-side)            │
│    ├─ Initializes storage (IndexedDB)                          │
│    ├─ Initializes analytics service                            │
│    ├─ Sets up event listeners (gamification, progress)         │
│    └─ Returns session state + methods                          │
├────────────────────────────────────────────────────────────────┤
│ 3. SessionManager CORE                                          │
│    ├─ startSession()                                            │
│    │  ├─ Get adapter for content type                          │
│    │  ├─ Transform content via adapter                         │
│    │  ├─ Generate queue (if applicable)                        │
│    │  ├─ Create session structure                              │
│    │  ├─ Save to storage                                       │
│    │  └─ Emit SESSION_STARTED event                            │
│    │                                                             │
│    ├─ getCurrentItem()                                          │
│    │  ├─ Get item at currentIndex                              │
│    │  ├─ Mark presentedAt timestamp                            │
│    │  └─ Emit ITEM_PRESENTED event                             │
│    │                                                             │
│    ├─ submitAnswer(answer, confidence)                         │
│    │  ├─ Get validator for content type                        │
│    │  ├─ Validate answer → ValidationResult                    │
│    │  ├─ Calculate base score                                  │
│    │  ├─ Apply modifiers (hints, attempts, confidence)         │
│    │  ├─ Update statistics (accuracy, streaks)                 │
│    │  ├─ Calculate SRS intervals via srsAlgorithm             │
│    │  ├─ Update session item with results                      │
│    │  ├─ Save to storage                                       │
│    │  └─ Emit ITEM_ANSWERED event (includes SRS data!)         │
│    │                                                             │
│    ├─ nextItem()                                                │
│    │  ├─ Increment currentIndex                                │
│    │  ├─ If more items → return next item                      │
│    │  ├─ If no more → call completeSession()                   │
│    │  └─ Emit PROGRESS_UPDATED event                           │
│    │                                                             │
│    └─ completeSession()                                         │
│       ├─ Finalize statistics                                    │
│       ├─ Record daily activity                                  │
│       ├─ Save final state to storage                           │
│       ├─ Emit SESSION_COMPLETED event                          │
│       │  └─ Gamification listener processes XP/achievements    │
│       └─ Return SessionStatistics                              │
└────────────────────────────────────────────────────────────────┘
```

### 5.2 Implementation Steps

#### Step 1: Create Client-Safe EventEmitter ✅ COMPLETE

**Status**: ✅ File exists at `src/lib/review-engine/core/client-event-emitter.ts` (150 lines, committed c2029b6c)

**Why**: SessionManager uses Node.js EventEmitter (line 6 of manager.ts), which doesn't work in browsers.

**Implementation**: Complete browser-compatible EventEmitter

```typescript
/**
 * Browser-compatible EventEmitter implementation
 * Drop-in replacement for Node.js EventEmitter
 */

type EventListener = (...args: any[]) => void | Promise<void>;

export class ClientEventEmitter {
  private events: Map<string, Set<EventListener>> = new Map();
  private maxListeners: number = 10;

  on(event: string, listener: EventListener): this {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    const listeners = this.events.get(event)!;

    if (listeners.size >= this.maxListeners) {
      console.warn(
        `MaxListenersExceededWarning: Possible memory leak detected. ` +
        `${listeners.size + 1} ${event} listeners added.`
      );
    }

    listeners.add(listener);
    return this;
  }

  off(event: string, listener: EventListener): this {
    const listeners = this.events.get(event);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.events.delete(event);
      }
    }
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    const listeners = this.events.get(event);
    if (!listeners || listeners.size === 0) {
      return false;
    }

    listeners.forEach(listener => {
      try {
        listener(...args);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });

    return true;
  }

  once(event: string, listener: EventListener): this {
    const onceWrapper = (...args: any[]) => {
      this.off(event, onceWrapper);
      listener(...args);
    };
    return this.on(event, onceWrapper);
  }

  removeAllListeners(event?: string): this {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
    return this;
  }

  listenerCount(event: string): number {
    return this.events.get(event)?.size || 0;
  }

  setMaxListeners(n: number): this {
    this.maxListeners = n;
    return this;
  }
}
```

**Modify SessionManager** (2 line changes):
```typescript
// OLD (line 6)
import { EventEmitter } from 'events';

// NEW
import { ClientEventEmitter } from '../core/client-event-emitter';

// OLD (line 48)
export class SessionManager extends EventEmitter {

// NEW
export class SessionManager extends ClientEventEmitter {
```

#### Step 2: Create Global Event Hub ✅ COMPLETE

**Status**: ✅ File exists at `src/lib/review-engine/core/event-hub.ts` (160 lines, committed c2029b6c)

**Why**: Single EventEmitter shared across all features ensures gamification integration works reliably.

**Implementation**: Global singleton with gamification listener integration

```typescript
/**
 * Global URE Event Hub
 * Single EventEmitter shared across all features for gamification
 */

import { ClientEventEmitter } from './client-event-emitter';
import { gamificationListener } from '@/lib/gamification/gamificationListener';

let eventHub: ClientEventEmitter | null = null;

export function getEventHub(): ClientEventEmitter {
  if (!eventHub) {
    eventHub = new ClientEventEmitter();
    eventHub.setMaxListeners(50); // Support many features
  }
  return eventHub;
}

export function initializeEventHub(userId: string): void {
  const hub = getEventHub();
  gamificationListener.initialize(userId, hub as any);
  console.log('[EventHub] Initialized for user:', userId);
}

export function destroyEventHub(): void {
  if (eventHub) {
    gamificationListener.destroy();
    eventHub.removeAllListeners();
    eventHub = null;
  }
}
```

**Modify SessionManager** to use event hub (add at line 54):
```typescript
import { getEventHub } from '../core/event-hub';

export class SessionManager extends ClientEventEmitter {
  private globalEventHub: ClientEventEmitter;

  constructor(storage: ISessionStorage, analytics: IAnalyticsService) {
    super();
    this.globalEventHub = getEventHub();
  }

  // Modify emitEvent to emit to both local and global (line 778)
  private emitEvent<T>(type: ReviewEventType, data: T): void {
    const event: ReviewEvent<T> = {
      type,
      timestamp: new Date(),
      sessionId: this.session?.id,
      userId: this.session?.userId,
      data
    };

    // Emit locally (for hook listeners)
    this.emit(type, event);

    // Emit globally (for gamification)
    this.globalEventHub.emit(type, event);

    // Track analytics
    this.analytics.trackEvent(event);
  }
}
```

#### Step 3: Create useSessionManager Hook ✅ COMPLETE

**Status**: ✅ File exists at `src/hooks/useSessionManager.ts` (374 lines, committed c2029b6c)

**Implementation**: React hook providing SessionManager integration

```typescript
/**
 * React hook for URE SessionManager
 * Provides React-friendly API for review sessions
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { SessionManager } from '@/lib/review-engine/session/manager';
import { LocalSessionStorage } from '@/lib/review-engine/session/storage';
import { MockAnalyticsService } from '@/lib/review-engine/session/analytics.service';
import { ReviewableContent } from '@/lib/review-engine/core/interfaces';
import { ReviewMode } from '@/lib/review-engine/core/types';
import { CreateSessionOptions, SessionStatistics, ReviewSessionItem } from '@/lib/review-engine/core/session.types';
import { ReviewEventType } from '@/lib/review-engine/core/events';

export interface UseSessionManagerOptions {
  userId: string;
  mode: ReviewMode;
  content: ReviewableContent[];
  onComplete?: (statistics: SessionStatistics) => void;
  onError?: (error: Error) => void;
  autoStart?: boolean;
  shuffle?: boolean;
}

export interface SessionState {
  isActive: boolean;
  isPaused: boolean;
  isCompleted: boolean;
  currentItem: ReviewSessionItem | null;
  progress: {
    current: number;
    total: number;
    percentage: number;
    correct: number;
    incorrect: number;
    skipped: number;
  };
  statistics: SessionStatistics | null;
  error: string | null;
}

export function useSessionManager({
  userId,
  mode,
  content,
  onComplete,
  onError,
  autoStart = false,
  shuffle = false
}: UseSessionManagerOptions) {
  const managerRef = useRef<SessionManager | null>(null);
  const [state, setState] = useState<SessionState>({
    isActive: false,
    isPaused: false,
    isCompleted: false,
    currentItem: null,
    progress: {
      current: 0,
      total: content.length,
      percentage: 0,
      correct: 0,
      incorrect: 0,
      skipped: 0
    },
    statistics: null,
    error: null
  });

  // Initialize SessionManager
  useEffect(() => {
    const storage = new LocalSessionStorage();
    const analytics = new MockAnalyticsService(true);
    managerRef.current = new SessionManager(storage, analytics);

    const manager = managerRef.current;

    // Subscribe to events
    manager.on(ReviewEventType.SESSION_STARTED, () => {
      setState(prev => ({ ...prev, isActive: true, error: null }));
    });

    manager.on(ReviewEventType.SESSION_COMPLETED, (event) => {
      setState(prev => ({
        ...prev,
        isActive: false,
        isCompleted: true,
        statistics: event.data.statistics
      }));
      if (onComplete) onComplete(event.data.statistics);
    });

    manager.on(ReviewEventType.PROGRESS_UPDATED, (event) => {
      setState(prev => ({
        ...prev,
        progress: {
          current: event.data.current,
          total: event.data.total,
          percentage: Math.round((event.data.current / event.data.total) * 100),
          correct: event.data.correct,
          incorrect: event.data.incorrect,
          skipped: event.data.skipped
        }
      }));
    });

    manager.on(ReviewEventType.ITEM_PRESENTED, () => {
      setState(prev => ({ ...prev, currentItem: manager.getCurrentItem() }));
    });

    manager.on(ReviewEventType.ERROR_OCCURRED, (event) => {
      const error = event.data.error;
      setState(prev => ({ ...prev, error: String(error) }));
      if (onError) onError(error instanceof Error ? error : new Error(String(error)));
    });

    if (autoStart) {
      startSession();
    }

    return () => {
      manager.removeAllListeners();
    };
  }, [userId, mode, autoStart]);

  const startSession = useCallback(async () => {
    if (!managerRef.current) throw new Error('SessionManager not initialized');

    try {
      await managerRef.current.startSession({
        userId,
        mode,
        items: content,
        shuffle,
        source: 'manual',
        config: {
          mode,
          showPrimary: true,
          showSecondary: true,
          showTertiary: false,
          showMedia: false,
          inputType: mode === 'recall' ? 'text' : 'multiple-choice',
          optionCount: 4,
          allowHints: true,
          hintPenalty: 0.1
        }
      });

      const firstItem = managerRef.current.getCurrentItem();
      setState(prev => ({ ...prev, isActive: true, currentItem: firstItem }));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setState(prev => ({ ...prev, error: err.message }));
      if (onError) onError(err);
    }
  }, [userId, mode, content, shuffle]);

  const submitAnswer = useCallback(async (answer: string, confidence?: 1|2|3|4|5) => {
    if (!managerRef.current) throw new Error('SessionManager not initialized');
    return await managerRef.current.submitAnswer(answer, confidence);
  }, []);

  const nextItem = useCallback(async () => {
    if (!managerRef.current) throw new Error('SessionManager not initialized');
    const next = await managerRef.current.nextItem();
    setState(prev => ({ ...prev, currentItem: next }));
    return next;
  }, []);

  const skipItem = useCallback(async () => {
    if (!managerRef.current) throw new Error('SessionManager not initialized');
    await managerRef.current.skipItem();
  }, []);

  return {
    state,
    startSession,
    submitAnswer,
    nextItem,
    skipItem,
    useHint: () => managerRef.current!.useHint(),
    pauseSession: () => managerRef.current!.pauseSession(),
    resumeSession: () => managerRef.current!.resumeSession(),
    completeSession: () => managerRef.current!.completeSession(),
    getEventEmitter: () => managerRef.current,
    manager: managerRef.current
  };
}
```

#### Step 4: Create Tests 🚨 CRITICAL BLOCKER

**Status**: ❌ No tests exist - this is blocking production deployment

**Required Test Files**:
```bash
src/lib/review-engine/__tests__/client-event-emitter.test.ts
src/hooks/__tests__/useSessionManager.test.tsx
src/lib/review-engine/__tests__/session-manager-integration.test.ts
```

**Coverage Targets**:
- ClientEventEmitter: 85%+
- useSessionManager: 80%+
- Integration: Prove gamification events work

**See Section 8 for detailed test implementation**

#### Step 5: Refactor Features

**Pattern for Each Feature**:

```typescript
// BEFORE (KanaLearningComponent.tsx - Lines 32-48, 232-238, 497-508, 1110-1117)
const ReviewEngine = dynamic(() => import('@/components/review-engine/ReviewEngine'))
const ureEventEmitter = new EventEmitter()

useEffect(() => {
  if (user?.uid) {
    gamificationListener.initialize(user.uid, ureEventEmitter)
  }
}, [user?.uid])

const handleReviewComplete = async (stats: SessionStatistics) => {
  const sessionId = `review_${Date.now()}`
  ureEventEmitter.emit(ReviewEventType.SESSION_COMPLETED, {
    data: { sessionId, statistics: stats, duration: stats.totalTime }
  })
  setViewMode('browse')
}

return (
  <>
    {viewMode === 'review' && (
      <ReviewEngine
        content={reviewContent}
        mode="recognition"
        onComplete={handleReviewComplete}
        onCancel={() => setViewMode('browse')}
        userId={user?.uid || ''}
      />
    )}
  </>
)
```

```typescript
// AFTER (KanaLearningComponent.tsx - Simplified)
import { useSessionManager } from '@/hooks/useSessionManager'
import { initializeEventHub } from '@/lib/review-engine/core/event-hub'

// Initialize event hub once
useEffect(() => {
  if (user?.uid) {
    initializeEventHub(user.uid)
  }
}, [user?.uid])

// Use SessionManager hook
const {
  state,
  startSession,
  submitAnswer,
  nextItem,
  skipItem
} = useSessionManager({
  userId: user?.uid || 'anonymous',
  mode: 'recognition',
  content: reviewContent,
  onComplete: (stats) => {
    // Gamification automatically handled via event hub
    setLastSessionStats(stats)
    setViewMode('browse')
  }
})

// Start session when entering review mode
useEffect(() => {
  if (viewMode === 'review' && reviewContent.length > 0) {
    startSession()
  }
}, [viewMode, reviewContent])

return (
  <>
    {state.isActive && !state.isCompleted && (
      <ReviewSessionUI
        currentItem={state.currentItem}
        progress={state.progress}
        mode="recognition"
        onSubmit={submitAnswer}
        onNext={nextItem}
        onSkip={skipItem}
        onCancel={() => setViewMode('browse')}
      />
    )}

    {state.isCompleted && state.statistics && (
      <SessionSummary
        statistics={state.statistics}
        onClose={() => setViewMode('browse')}
      />
    )}
  </>
)
```

**Result**: ~150 lines → ~50 lines (67% reduction per feature)

---

## 6. How to Extend URE

### 6.1 Adding a New Content Type

#### Step 1: Create Adapter

**New File**: `src/lib/review-engine/adapters/MyContentAdapter.ts`

```typescript
import { BaseContentAdapter } from './base.adapter'
import { ReviewableContent } from '../core/interfaces'

interface MyContentItem {
  id: string
  question: string
  answer: string
  difficulty?: number
}

export class MyContentAdapter extends BaseContentAdapter<MyContentItem> {
  adapt(item: MyContentItem): ReviewableContent {
    return {
      id: item.id,
      contentType: 'custom',
      primaryDisplay: item.question,
      secondaryDisplay: 'Type your answer',
      primaryAnswer: item.answer,
      difficulty: item.difficulty || 0.5,
      tags: ['custom'],
      supportedModes: ['recall', 'recognition'],
      preferredMode: 'recall',
    }
  }

  // Optional: Custom hints
  generateHints(content: ReviewableContent): string[] {
    return [
      `First letter: ${content.primaryAnswer[0]}`,
      `Length: ${content.primaryAnswer.length} characters`
    ]
  }
}
```

#### Step 2: Register Adapter

```typescript
// In app initialization or AdapterRegistry.initialize()
import { AdapterRegistry } from '@/lib/review-engine/adapters/registry'
import { MyContentAdapter } from '@/lib/review-engine/adapters/MyContentAdapter'

AdapterRegistry.registerAdapter('my_content', new MyContentAdapter())
```

#### Step 3: Use Adapter

```typescript
const adapter = AdapterRegistry.getAdapter('my_content')
const reviewableContent = myData.map(item => adapter.transform(item))

const { startSession } = useSessionManager({
  userId: user.uid,
  mode: 'recall',
  content: reviewableContent
})
```

### 6.2 Customizing SRS Algorithm

**Option 1: Configure Existing**

```typescript
const srsAlgorithm = new SRSAlgorithm({
  initialEaseFactor: 2.0,    // Easier starting point
  learningSteps: [0.0035, 0.0104, 0.0208],  // 5min, 15min, 30min
  graduatingInterval: 2,     // Graduate to 2 days
  maxInterval: 180,          // 6 months max
  leechThreshold: 5          // Mark as difficult after 5 failures
})
```

**Option 2: Extend Algorithm Class**

```typescript
export class CustomSRSAlgorithm extends SRSAlgorithm {
  protected calculateIntervalModifier(result: ReviewResult): number {
    let modifier = super.calculateIntervalModifier(result)

    // Boost interval for very fast responses
    if (result.responseTime < 1000) {
      modifier *= 1.2
    }

    // Reduce interval for low confidence
    if (result.confidence && result.confidence <= 2) {
      modifier *= 0.8
    }

    return modifier
  }
}
```

### 6.3 Adding New Review Modes

**Step 1: Define Mode**

```typescript
// In src/lib/review-engine/core/types.ts
export type ReviewMode =
  | 'recognition'
  | 'recall'
  | 'listening'
  | 'writing'
  | 'speaking'     // ← NEW
```

**Step 2: Add Configuration**

```typescript
// In DEFAULT_MODE_CONFIGS
speaking: {
  showPrimary: false,
  showSecondary: true,
  showTertiary: true,
  showMedia: false,
  inputType: 'speech',
  allowHints: true,
  hintPenalty: 0.15
}
```

**Step 3: Implement UI**

```typescript
export function SpeechInput({ onAnswer }: { onAnswer: (text: string) => void }) {
  const [transcript, setTranscript] = useState('')

  const startRecording = () => {
    const recognition = new webkitSpeechRecognition()
    recognition.lang = 'ja-JP'
    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript
      setTranscript(text)
      onAnswer(text)
    }
    recognition.start()
  }

  return <button onClick={startRecording}>Speak Answer</button>
}
```

---

## 7. Migration Plan

### 7.1 Phase Overview

```
Phase 1: Infrastructure (Week 1-2)
  ├─ Create ClientEventEmitter
  ├─ Create Event Hub
  ├─ Modify SessionManager for client-side
  ├─ Create useSessionManager hook
  └─ Write unit tests

Phase 2: Pilot Feature (Week 3-4)
  ├─ Migrate Kana Learning
  ├─ Integration testing
  ├─ Monitor for 1 week
  └─ Fix any issues

Phase 3: Remaining Features (Week 5-8)
  ├─ Week 5-6: Kanji Browser + Textbook Vocabulary
  ├─ Week 7-8: Anki Study + User Lists
  └─ Monitor each for 1 week

Phase 4: Cleanup (Week 9)
  ├─ Deprecate ReviewEngine
  ├─ Update documentation
  └─ Performance audit
```

### 7.2 Phase 1: Infrastructure (Week 1-2)

#### Week 1: Core Components

**Day 1-2: ClientEventEmitter**
```
File: src/lib/review-engine/core/client-event-emitter.ts
Lines: 0 → 150
Task: Create browser-compatible EventEmitter
Test: src/lib/review-engine/__tests__/client-event-emitter.test.ts
```

**Day 3-4: Event Hub**
```
File: src/lib/review-engine/core/event-hub.ts
Lines: 0 → 100
Task: Global event singleton for gamification
Modify: src/lib/review-engine/session/manager.ts
  - Line 6: Import ClientEventEmitter
  - Line 48: Extend ClientEventEmitter
  - Line 54: Add globalEventHub property
  - Line 778: Emit to both local and global
```

**Day 5: Storage Updates**
```
File: src/lib/review-engine/session/storage.ts
Task: Add browser environment checks
Modify: Lines 38, 56, 76, 94, 107, 117, 132, 151
  - Add isAvailable() check at start of each async method
```

#### Week 2: Hook & Tests

**Day 1-3: useSessionManager Hook**
```
File: src/hooks/useSessionManager.ts
Lines: 0 → 500
Task: React hook wrapping SessionManager
Features:
  - State management (session, item, progress, stats)
  - Event subscription
  - Method wrappers
  - Error handling
```

**Day 4-5: Testing**
```
Files:
  - src/lib/review-engine/__tests__/client-event-emitter.test.ts
  - src/hooks/__tests__/useSessionManager.test.tsx
  - src/lib/review-engine/__tests__/session-manager-integration.test.ts

Coverage Target: 85%+
```

**Deliverables**:
- [ ] ClientEventEmitter implemented and tested
- [ ] Event Hub created
- [ ] SessionManager modified for client-side
- [ ] useSessionManager hook complete
- [ ] Unit tests passing (85%+ coverage)
- [ ] Code review completed

### 7.3 Phase 2: Pilot Feature - Kana Learning (Week 3-4)

#### Week 3: Implementation

**File**: `src/components/learn/KanaLearningComponent.tsx`

**Changes Required**:

1. **Remove Legacy Imports** (Lines 48, 32)
   ```typescript
   // DELETE
   const ReviewEngine = dynamic(() => import('@/components/review-engine/ReviewEngine'))
   const ureEventEmitter = new EventEmitter()
   ```

2. **Add URE Imports**
   ```typescript
   // ADD
   import { useSessionManager } from '@/hooks/useSessionManager'
   import { initializeEventHub } from '@/lib/review-engine/core/event-hub'
   ```

3. **Replace Manual Gamification Setup** (Lines 232-238)
   ```typescript
   // REPLACE
   useEffect(() => {
     if (user?.uid) {
       const listenerCount = ureEventEmitter.listenerCount(ReviewEventType.SESSION_COMPLETED)
       if (listenerCount === 0) {
         gamificationListener.initialize(user.uid, ureEventEmitter)
       }
     }
   }, [user?.uid])

   // WITH
   useEffect(() => {
     if (user?.uid) {
       initializeEventHub(user.uid)
     }
   }, [user?.uid])
   ```

4. **Replace handleReviewComplete** (Lines 475-514)
   ```typescript
   // DELETE manual event emission (lines 497-508)
   // ureEventEmitter.emit(ReviewEventType.SESSION_COMPLETED, {...})

   // REPLACE with simple callback
   const handleReviewComplete = (stats: SessionStatistics) => {
     // SessionManager + Event Hub handle gamification automatically
     setLastSessionStats(stats)
     setViewMode('browse')
   }
   ```

5. **Add useSessionManager Hook**
   ```typescript
   const {
     state,
     startSession,
     submitAnswer,
     nextItem,
     skipItem
   } = useSessionManager({
     userId: user?.uid || 'anonymous',
     mode: 'recognition',
     content: reviewContent,
     onComplete: handleReviewComplete,
     onError: (error) => {
       showToast(t('review.error'), 'error')
       console.error('[Kana Review] Error:', error)
     }
   })
   ```

6. **Replace ReviewEngine Usage** (Lines 1110-1117)
   ```typescript
   // DELETE
   {viewMode === 'review' && (
     <ReviewEngine
       content={reviewContent}
       mode="recognition"
       onComplete={handleReviewComplete}
       onCancel={() => setViewMode('browse')}
       userId={user?.uid || ''}
     />
   )}

   // REPLACE WITH
   {state.isActive && !state.isCompleted && (
     <ReviewSessionUI
       currentItem={state.currentItem}
       progress={state.progress}
       mode="recognition"
       onSubmit={submitAnswer}
       onNext={nextItem}
       onSkip={skipItem}
       onCancel={() => setViewMode('browse')}
     />
   )}

   {state.isCompleted && state.statistics && (
     <SessionSummary
       statistics={state.statistics}
       onClose={() => setViewMode('browse')}
     />
   )}
   ```

**Line Count**: ~150 lines modified → ~50 lines (67% reduction)

#### Week 4: Testing & Monitoring

**Integration Tests**:
```typescript
// cypress/e2e/kana-learning-migration.cy.ts
describe('Kana Learning Migration', () => {
  it('should start review session', () => {
    cy.login()
    cy.visit('/learn/hiragana')
    cy.contains('Start Review').click()
    cy.url().should('include', 'review')
  })

  it('should complete session and award XP', () => {
    // Get initial XP
    cy.get('[data-testid="xp-display"]').invoke('text').as('initialXP')

    // Complete review
    cy.contains('Start Review').click()
    cy.get('[data-testid="answer-input"]').type('a')
    cy.get('[data-testid="submit-button"]').click()
    cy.contains('Next').click()

    // Verify XP increased
    cy.get('[data-testid="xp-display"]').should(($el) => {
      const newXP = parseInt($el.text())
      cy.get('@initialXP').then((initial) => {
        expect(newXP).to.be.greaterThan(parseInt(initial as string))
      })
    })
  })

  it('should track progress correctly', () => {
    cy.contains('Start Review').click()
    cy.get('[data-testid="progress-bar"]').should('exist')
    cy.get('[data-testid="progress-current"]').should('contain', '1')
  })
})
```

**Monitoring Checklist**:
- [ ] Zero regressions in review functionality
- [ ] Gamification XP awarded correctly (100% success rate)
- [ ] No console errors
- [ ] Session persistence working (localStorage)
- [ ] Offline support maintained (IndexedDB)
- [ ] Performance metrics within targets (<50ms operations)

**Success Criteria**:
- All tests passing
- 1 week in production with no critical bugs
- User feedback positive
- XP awards 100% reliable

### 7.4 Phase 3: Remaining Features (Week 5-8)

#### Week 5-6: Kanji Browser + Textbook Vocabulary

**Feature 2: Kanji Browser**
```
File: src/app/[locale]/kanji-browser/KanjiBrowserPage.tsx
Lines Modified: ~80
Pattern: Same as Kana Learning
  - Remove ReviewEngine import (line 37)
  - Add useSessionManager hook
  - Replace manual event emission (lines 484-496)
  - Replace ReviewEngine usage (lines 692-704)
```

**Feature 5: Textbook Vocabulary**
```
File: src/app/[locale]/textbook-vocabulary/page.tsx
Lines Modified: ~60
Pattern: Same as Kana Learning
```

**Testing**: Integration tests for both features, 1 week monitoring each

#### Week 7-8: Anki Study + User Lists

**Feature 4: Anki Study**
```
File: src/app/[locale]/anki-study/[deckId]/page.tsx
Lines Modified: ~100
Complexity: Medium (external deck format)
Special Considerations:
  - Anki card format compatibility
  - Deck metadata handling
  - Import/export functionality
```

**Feature 6: User Lists**
```
File: src/app/[locale]/lists/[listId]/page.tsx
Lines Modified: ~70
Complexity: Medium (user-created content)
Special Considerations:
  - Dynamic content loading
  - UserListAdapter integration
  - Sharing functionality
```

**Testing**: Full regression test suite, 1 week monitoring each

### 7.5 Phase 4: Cleanup (Week 9)

**Tasks**:

1. **Deprecate ReviewEngine Component**
   ```
   Action: Move src/components/review-engine/ReviewEngine.tsx
       to: src/components/review-engine/legacy/ReviewEngine.tsx
   Add: Deprecation warning in file
   Update: All imports (if any remaining)
   ```

2. **Update Documentation**
   ```
   Files:
   - docs/REVIEW_ENGINE_DEEP_DIVE.md
   - docs/REVIEW_ENGINE_PRACTICAL_GUIDE.md
   - README.md

   Add:
   - useSessionManager usage examples
   - Migration guide for future features
   - Architecture decision records
   ```

3. **Performance Audit**
   ```
   Metrics:
   - Bundle size reduction: Target 63% (175KB → 65KB)
   - Session init time: Target <50ms
   - Event propagation: Target <5ms
   - Memory usage: Monitor for leaks
   ```

4. **Final Review**
   ```
   - All 5 features migrated
   - All tests passing (>85% coverage)
   - No console errors
   - Production monitoring clean
   - User feedback positive
   ```

### 7.6 Rollback Strategy

**If migration fails**:

**Level 1: Feature-Level Rollback**
```typescript
// Keep both implementations side-by-side
const USE_NEW_REVIEW_ENGINE = process.env.NEXT_PUBLIC_USE_NEW_REVIEW_ENGINE === 'true'

if (USE_NEW_REVIEW_ENGINE) {
  // New SessionManager implementation
  return <ReviewSessionUI {...} />
} else {
  // Legacy ReviewEngine
  return <ReviewEngine {...} />
}
```

**Level 2: Database Rollback**
- SessionManager uses same storage schema as ReviewEngine
- No data migration needed
- Can switch back instantly via environment variable

**Level 3: Gradual Migration**
```typescript
const MIGRATED_FEATURES = {
  kanaLearning: true,
  kanjiBrowser: false,  // Keep on legacy
  textbookVocab: false,
  ankiStudy: false,
  userLists: false
}

if (MIGRATED_FEATURES.kanaLearning) {
  // Use new implementation
} else {
  // Use legacy
}
```

---

## 8. Testing Strategy

### 8.1 Unit Tests

**Target Coverage**: 85%+ overall, 95%+ for critical paths

**Files to Test**:
- `client-event-emitter.test.ts` - EventEmitter functionality
- `useSessionManager.test.tsx` - Hook behavior
- `session-manager-integration.test.ts` - End-to-end session flow

**Example Test**:
```typescript
describe('useSessionManager', () => {
  const mockContent = [{
    id: '1',
    contentType: 'kana',
    primaryDisplay: 'あ',
    primaryAnswer: 'a',
    difficulty: 0.3,
    supportedModes: ['recognition']
  }]

  test('should initialize with correct state', () => {
    const { result } = renderHook(() =>
      useSessionManager({
        userId: 'test-user',
        mode: 'recognition',
        content: mockContent
      })
    )

    expect(result.current.state.isActive).toBe(false)
    expect(result.current.state.progress.total).toBe(1)
  })

  test('should start session and emit events', async () => {
    const { result } = renderHook(() =>
      useSessionManager({ userId: 'test', mode: 'recognition', content: mockContent })
    )

    await act(async () => {
      await result.current.startSession()
    })

    await waitFor(() => {
      expect(result.current.state.isActive).toBe(true)
      expect(result.current.state.currentItem).not.toBeNull()
    })
  })

  test('should complete session and trigger gamification', async () => {
    const onComplete = jest.fn()
    const { result } = renderHook(() =>
      useSessionManager({ userId: 'test', mode: 'recognition', content: mockContent, onComplete })
    )

    await act(async () => {
      await result.current.startSession()
      await result.current.submitAnswer('a')
      await result.current.nextItem()
    })

    await waitFor(() => {
      expect(result.current.state.isCompleted).toBe(true)
      expect(onComplete).toHaveBeenCalled()
    })
  })
})
```

### 8.2 Integration Tests

**Test SessionManager + Event Hub + Gamification**:
```typescript
describe('SessionManager Integration', () => {
  test('should emit events to global hub', async () => {
    const hub = getEventHub()
    const listener = jest.fn()
    hub.on(ReviewEventType.SESSION_COMPLETED, listener)

    const storage = new LocalSessionStorage()
    const analytics = new MockAnalyticsService()
    const manager = new SessionManager(storage, analytics)

    await manager.startSession({
      userId: 'test',
      mode: 'recognition',
      items: mockContent,
      source: 'manual'
    })

    await manager.submitAnswer('a')
    await manager.nextItem()

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: ReviewEventType.SESSION_COMPLETED,
        data: expect.objectContaining({
          statistics: expect.objectContaining({
            correctItems: 1,
            totalItems: 1
          })
        })
      })
    )
  })
})
```

### 8.3 E2E Tests

**Cypress Tests Per Feature**:
```typescript
describe('Feature Migration E2E', () => {
  beforeEach(() => {
    cy.login('test@example.com', 'password')
  })

  it('should complete full review flow', () => {
    cy.visit('/learn/hiragana')

    // Start review
    cy.contains('Start Review').click()

    // Answer question
    cy.get('[data-testid="answer-input"]').type('a')
    cy.get('[data-testid="submit"]').click()

    // Verify feedback
    cy.contains('Correct').should('be.visible')
    cy.contains('Next').click()

    // Complete session
    cy.get('[data-testid="session-complete"]').should('be.visible')

    // Verify XP awarded
    cy.get('[data-testid="xp-gained"]').should('exist')
  })

  it('should handle offline mode', () => {
    cy.visit('/learn/hiragana')
    cy.contains('Start Review').click()

    // Go offline
    cy.window().then(win => {
      win.dispatchEvent(new Event('offline'))
    })

    // Answer should still work
    cy.get('[data-testid="answer-input"]').type('a')
    cy.get('[data-testid="submit"]').click()
    cy.contains('Correct').should('be.visible')

    // Verify saved to IndexedDB
    cy.window().then(win => {
      const db = win.indexedDB.open('moshimoshi-reviews')
      // Assert data exists
    })
  })
})
```

### 8.4 Performance Tests

**Metrics to Track**:
```typescript
describe('Performance', () => {
  test('session initialization should be < 50ms', async () => {
    const start = performance.now()
    await manager.startSession(options)
    const duration = performance.now() - start
    expect(duration).toBeLessThan(50)
  })

  test('answer validation should be < 10ms', async () => {
    await manager.startSession(options)
    const start = performance.now()
    await manager.submitAnswer('a')
    const duration = performance.now() - start
    expect(duration).toBeLessThan(10)
  })

  test('event emission should be < 5ms', async () => {
    const hub = getEventHub()
    const start = performance.now()
    hub.emit('test', { data: 'value' })
    const duration = performance.now() - start
    expect(duration).toBeLessThan(5)
  })
})
```

---

## 9. Rollout Timeline

### 9.1 Gantt Chart

```
Week 1-2:  Infrastructure
████████████████

Week 3-4:  Kana Learning (Pilot)
                ████████████████

Week 5:    Kanji Browser
                        ████████

Week 6:    Textbook Vocabulary
                                ████████

Week 7:    Anki Study
                                        ████████

Week 8:    User Lists
                                                ████████

Week 9:    Cleanup & Documentation
                                                        ████████
```

### 9.2 Milestone Checklist

**Week 1-2: Infrastructure** ✅ COMPLETE (Committed Dec 17, 2025 - c2029b6c)
- [x] ClientEventEmitter created (150 lines, src/lib/review-engine/core/client-event-emitter.ts)
- [x] Event Hub created (160 lines, src/lib/review-engine/core/event-hub.ts)
- [x] SessionManager modified for client-side (dual event emission added)
- [x] useSessionManager hook implemented (374 lines, src/hooks/useSessionManager.ts)
- [ ] Unit tests written (85%+ coverage) - 🚨 CRITICAL BLOCKER
- [ ] Integration tests written - 🚨 CRITICAL BLOCKER
- [ ] Code review completed
- [ ] PR merged to main

**Week 3-4: Kana Learning** ✓
- [ ] Feature code modified
- [ ] Manual testing completed
- [ ] E2E tests written
- [ ] Deployed to staging
- [ ] Deployed to production
- [ ] Monitored for 1 week (no regressions)
- [ ] XP awards working 100%

**Week 5-6: Kanji + Textbook** ✓
- [ ] Both features migrated
- [ ] Tests passing
- [ ] Deployed to staging
- [ ] Deployed to production
- [ ] Monitored for 1 week each

**Week 7-8: Anki + Lists** ✓
- [ ] Both features migrated
- [ ] Tests passing
- [ ] Deployed to staging
- [ ] Deployed to production
- [ ] Monitored for 1 week each

**Week 9: Cleanup** ✓
- [ ] ReviewEngine deprecated
- [ ] Documentation updated
- [ ] Performance audit completed
- [ ] All tests passing
- [ ] Production stable

**Final Sign-Off** ✓
- [ ] All 5 features migrated successfully
- [ ] Zero critical bugs
- [ ] Performance targets met
- [ ] User feedback positive
- [ ] Team approval

---

## 10. Critical Files Reference

### 10.1 Core URE Files (Read These First)

**Session Management**:
```
src/lib/review-engine/session/manager.ts          (857 lines)
  - Lines 48-857: SessionManager class
  - Line 66: startSession()
  - Line 143: submitAnswer()
  - Line 344: completeSession()
  - Line 778: emitEvent() - event emission
```

**Events**:
```
src/lib/review-engine/core/events.ts              (353 lines)
  - Lines 12-52: ReviewEventType enum
  - Lines 122-126: SessionCompletedPayload
  - Lines 154-171: ItemAnsweredPayload (includes SRS data!)
```

**Interfaces**:
```
src/lib/review-engine/core/interfaces.ts          (106 lines)
  - Lines 15-106: ReviewableContent interface
```

**Adapters**:
```
src/lib/review-engine/adapters/registry.ts        (431 lines)
  - Lines 23-199: AdapterRegistry class
  - Lines 36-45: Registered adapters
```

**SRS**:
```
src/lib/review-engine/srs/algorithm.ts            (156+ lines)
  - Line 156: calculateNext() - main SRS calculation
```

### 10.2 Files Status

**Infrastructure** ✅ COMPLETE:
```
✅ src/lib/review-engine/core/client-event-emitter.ts  (150 lines, c2029b6c)
✅ src/lib/review-engine/core/event-hub.ts             (160 lines, c2029b6c)
✅ src/hooks/useSessionManager.ts                       (374 lines, c2029b6c)
```

**Tests** ❌ CRITICAL - NEED TO CREATE:
```
❌ src/lib/review-engine/__tests__/client-event-emitter.test.ts
❌ src/hooks/__tests__/useSessionManager.test.tsx
❌ src/lib/review-engine/__tests__/session-manager-integration.test.ts
❌ cypress/e2e/kana-learning-migration.cy.ts
❌ cypress/e2e/kanji-browser-migration.cy.ts
```

**UI Components** ✅ COMPLETE:
```
✅ src/components/review-engine/ReviewSessionUI.tsx (265 lines, 9212fc59)
✅ src/components/review-engine/SessionSummary.tsx (exists)
✅ src/components/review-engine/ReviewCard.tsx (exists)
✅ src/components/review-engine/AnswerInput.tsx (exists)
✅ src/components/review-engine/ProgressBar.tsx (exists)
```

### 10.3 Files Modified ✅

**Infrastructure** ✅ COMPLETE:
```
✅ src/lib/review-engine/session/manager.ts
  - Line 6: Import ClientEventEmitter (DONE)
  - Line 49: Extend ClientEventEmitter (DONE)
  - Line 55: Add globalEventHub property (DONE)
  - Line 794: Emit to global hub (DONE)

⚠️ src/lib/review-engine/session/storage.ts
  - Storage classes exist (LocalSessionStorage, IndexedDBSessionStorage)
  - May need isAvailable() checks (verify during testing)
```

**Features**:
```
src/components/learn/KanaLearningComponent.tsx      (~50 lines modified)
src/app/[locale]/kanji-browser/KanjiBrowserPage.tsx (~80 lines modified)
src/app/[locale]/textbook-vocabulary/page.tsx       (~60 lines modified)
src/app/[locale]/anki-study/[deckId]/page.tsx       (~100 lines modified)
src/app/[locale]/lists/[listId]/page.tsx            (~70 lines modified)
```

### 10.4 Reference Implementations

**Correct URE Usage** (Server-side):
```
src/app/api/review/session/start/route.ts
  - Line 24: Creates SessionManager
  - Shows proper lifecycle usage
```

**Correct Gamification Integration**:
```
src/lib/gamification/gamificationListener.ts
  - Lines 67-191: Read-only event listener
  - Line 115: Calls server API
  - Line 145: Updates store from server
```

**Correct Event Emission**:
```
src/lib/review-engine/session/manager.ts
  - Line 363: SESSION_COMPLETED emission
  - Line 208: ITEM_ANSWERED emission with SRS data
```

### 10.5 Documentation Files

**Current Docs**:
```
docs/REVIEW_ENGINE_DEEP_DIVE.md
docs/REVIEW_ENGINE_PRACTICAL_GUIDE.md
CLAUDE.md (project context)
```

**New Docs to Create**:
```
docs/URE_MIGRATION_GUIDE.md
docs/USE_SESSION_MANAGER_GUIDE.md
docs/ARCHITECTURE_DECISION_RECORD.md
```

---

## 11. Success Metrics

### 11.1 Functional Requirements ✓

- [ ] All 5 features migrated successfully
- [ ] Zero regressions in review functionality
- [ ] Gamification XP awarded correctly (100% success rate)
- [ ] Offline support maintained (IndexedDB working)
- [ ] Session persistence working (localStorage/IndexedDB)
- [ ] Progress tracking accurate
- [ ] Statistics calculations consistent

### 11.2 Performance Requirements ✓

- [ ] Session initialization: <50ms
- [ ] Answer validation: <10ms
- [ ] Event emission: <5ms
- [ ] SRS calculation: <1ms
- [ ] Bundle size: <70KB gzipped (from 175KB)
- [ ] Memory usage: -40% (single EventEmitter)

### 11.3 Code Quality Requirements ✓

- [ ] Test coverage: >85% overall, >95% critical paths
- [ ] No console errors in production
- [ ] No TypeScript errors
- [ ] ESLint passing
- [ ] Code review approved for all PRs
- [ ] Documentation complete

### 11.4 User Experience Requirements ✓

- [ ] No increase in loading time
- [ ] No UI regressions
- [ ] Smooth animations maintained
- [ ] Keyboard shortcuts working
- [ ] Mobile responsive
- [ ] Accessibility (WCAG 2.1 AA)

---

## Appendix A: Quick Reference

### Common Tasks

**Start a Review Session**:
```typescript
const { startSession } = useSessionManager({
  userId: user.uid,
  mode: 'recognition',
  content: reviewableContent
})

await startSession()
```

**Submit an Answer**:
```typescript
const { submitAnswer } = useSessionManager(...)
const result = await submitAnswer('answer', 4) // confidence: 4/5
```

**Listen to Gamification Events**:
```typescript
const hub = getEventHub()
hub.on(ReviewEventType.SESSION_COMPLETED, (event) => {
  console.log('XP awarded:', event.data.statistics)
})
```

**Transform Content**:
```typescript
const adapter = AdapterRegistry.getAdapter('kanji')
const reviewableContent = kanjiData.map(k => adapter.transform(k))
```

---

## Appendix B: Troubleshooting

### Issue: Gamification XP Not Awarded

**Symptoms**: Session completes but no XP shows in UI

**Diagnosis**:
1. Check Event Hub initialization:
   ```typescript
   // Should be called once on app mount
   initializeEventHub(user.uid)
   ```

2. Verify event emission:
   ```typescript
   const hub = getEventHub()
   console.log('Listeners:', hub.listenerCount(ReviewEventType.SESSION_COMPLETED))
   // Should be > 0
   ```

3. Check gamificationListener:
   ```typescript
   // Should log when processing session
   // [Gamification] Received event: {...}
   ```

**Solution**: Ensure Event Hub is initialized before starting sessions

### Issue: Session State Not Persisting

**Symptoms**: Refresh loses session progress

**Diagnosis**:
1. Check storage availability:
   ```typescript
   const storage = new LocalSessionStorage()
   const available = storage.isAvailable() // Should be true
   ```

2. Verify localStorage/IndexedDB access:
   ```typescript
   localStorage.setItem('test', 'value')
   // Should not throw error
   ```

**Solution**: Enable localStorage/IndexedDB in browser settings

### Issue: Performance Degradation

**Symptoms**: Slow session operations

**Diagnosis**:
1. Profile event listeners:
   ```typescript
   const hub = getEventHub()
   Object.keys(ReviewEventType).forEach(type => {
     console.log(type, hub.listenerCount(type))
   })
   // Should be small numbers (< 10 per event)
   ```

2. Check for memory leaks:
   ```typescript
   // Verify cleanup on unmount
   useEffect(() => {
     return () => {
       manager.removeAllListeners()
     }
   }, [])
   ```

**Solution**: Ensure proper event listener cleanup

---

## Document Change Log

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-01-XX | Initial comprehensive plan created | Claude |

---

**END OF DOCUMENT**

This document should be moved to: `/home/beano/DevProjects/NextJs/moshimoshi/01_PRODUCTION_DOCS/URE_ARCHITECTURE_AND_MIGRATION_PLAN.md`
