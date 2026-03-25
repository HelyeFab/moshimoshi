# Kanji Browser System Architecture

**Version:** 1.0
**Last Updated:** 2026-03-24
**Status:** Production

---

## Table of Contents

1. [System Overview](#system-overview)
2. [State Machine & Mode Transitions](#state-machine--mode-transitions)
3. [Data Flow Architecture](#data-flow-architecture)
4. [Session Lifecycle](#session-lifecycle)
5. [Progress Architecture](#progress-architecture)
6. [Reading Presentation Logic](#reading-presentation-logic)
7. [Critical Invariants](#critical-invariants)
8. [Risk Vectors](#risk-vectors)
9. [Safe Change Guide](#safe-change-guide)

---

## System Overview

The Kanji Browser is a multi-mode learning system built on three core architectural layers:

### **Three Modes**
1. **Browse Mode** — Discovery and selection (default entry point)
2. **Study Mode** — Flashcard-based sequential learning
3. **Review Mode** — SRS-powered quiz sessions via Universal Review Engine (URE)

### **Core Systems**
- **Universal Review Engine (URE)** — Powers review mode with SRS scheduling
- **Progress Manager** — Dual-storage (IndexedDB + Firebase) progress tracking
- **Kanji Browser Adapter** — Transforms kanji data into reviewable content
- **Prioritized Readings** — JMdict-powered reading curation
- **Feature Entitlements** — Usage tracking and premium gating

### **Key Files**
```
/src/app/[locale]/kanji-browser/KanjiBrowserPage.tsx  (main UI container)
/src/components/kanji/KanjiStudyMode.tsx              (study mode UI)
/src/lib/review-engine/adapters/KanjiBrowserAdapter.ts (data adapter)
/src/utils/kanjiProgressManager.ts                     (progress tracking)
/src/utils/kanjiReadingPriority.ts                     (reading curation)
/src/hooks/useKanjiBrowser.ts                          (browse state hook)
/src/hooks/usePrioritizedKanjiReadings.ts              (reading hook)
/src/app/api/kanji/add-to-review/route.ts              (review queue API)
/src/app/api/progress/track/route.ts                   (progress sync API)
```

---

## State Machine & Mode Transitions

### **Primary State: `viewMode`**
```typescript
type ViewMode = 'browse' | 'study' | 'review'
```

### **State Transition Rules**

```
┌─────────────────────────────────────────────────────────────────┐
│                         KANJI BROWSER                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [BROWSE MODE] ────────────────────────────────────────────────┐│
│       │                                                         ││
│       │ Select kanji → Click "Study Selected"                  ││
│       ├────────────────────────────────────────────────────────▶││
│       │                    [STUDY MODE]                         ││
│       │                         │                               ││
│       │                         │ Complete/Back                 ││
│       │                         └─────────────────────────────▶ ││
│       │                                                         ││
│       │ Select kanji → Click "Review Selected"                 ││
│       └────────────────────────────────────────────────────────▶││
│                          [REVIEW MODE]                          ││
│                               │                                 ││
│                               │ Complete/Abandon                ││
│                               └─────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### **Transition Logic**

#### **Browse → Study**
```typescript
// KanjiBrowserPage.tsx
const handleStartStudy = () => {
  if (selectedKanji.size === 0) return

  const kanjiItems = buildKanjiSelectionData(selectedKanji)
  const success = startStudySession(kanjiItems, 'manual-selection')

  if (success) {
    setViewMode('study')
    // State persisted to localStorage for recovery
  }
}
```

#### **Browse → Review**
```typescript
// KanjiBrowserPage.tsx
const handleStartReview = () => {
  if (selectedKanji.size === 0) return

  const reviewableItems = selectedKanjiData.map(k => kanjiAdapter.transform(k))
  const allKanji = Object.values(kanjiData).flat()
  const optionsPool = allKanji.map(k => kanjiAdapter.transform(k))

  setReviewContent(reviewableItems)
  setReviewContentPool(optionsPool)
  setViewMode('review')
}
```

#### **Study/Review → Browse**
```typescript
// Both modes
const handleBack = () => {
  handleModeChange('browse')  // Clears session state
}
```

### **State Persistence**

**Study Mode:**
- Persisted to `localStorage` with key: `kanji-browser-study-session:{userId}`
- Auto-restored on page load if incomplete
- Cleared on completion or explicit exit

**Review Mode:**
- Ephemeral — session not persisted
- Progress tracked via URE event system
- Lost on page refresh (intentional design)

---

## Data Flow Architecture

### **Kanji Loading Pipeline**

```
┌─────────────────────────────────────────────────────────────────┐
│                     KANJI DATA FLOW                              │
└─────────────────────────────────────────────────────────────────┘

1. [Page Mount]
       │
       ▼
   kanjiService.loadKanjiByLevel('N5')  ───────┐
       │                                        │
       ▼                                        │
   setKanjiData({ N5: [...] })                 │ Initial fast load
       │                                        │
       ▼                                        │
   [Progressive Load N4-N1] ◀─────────────────┘
       │
       ▼
   kanjiData: KanjiByLevel = {
     N5: Kanji[],
     N4: Kanji[],
     ...
   }
```

### **Browse Mode Flow**

```
User Action              State Update              Side Effects
───────────────────────────────────────────────────────────────────
Click kanji card    →   setModalKanji(kanji)  →   trackKanjiView()
                                                    ↓
                                                 kanjiProgressManager
                                                    ↓
                                                 IndexedDB update
                                                    ↓
                                                 Firebase sync (if premium)

Toggle bookmark     →   bookmarks.add(id)     →   POST /api/kanji/bookmarks
                        kanji.bookmarked=true

Add to review       →   none                  →   POST /api/kanji/add-to-review
                                                    ↓
                                                 Firestore review_queue
```

### **Study Mode Flow**

```
┌─────────────────────────────────────────────────────────────────┐
│                     STUDY SESSION FLOW                           │
└─────────────────────────────────────────────────────────────────┘

startStudySession(kanjiItems) ──────────────────────────────────┐
    │                                                            │
    ▼                                                            │
setStudySession({                                                │
  items: Kanji[],                                                │
  currentIndex: 0,                                               │
  startedAt: timestamp,                                          │
  source: 'manual-selection' | 'collection'                      │
})                                                               │
    │                                                            │
    ▼                                                            │
localStorage.setItem(sessionKey, JSON.stringify(session)) ◀─────┘
    │
    ▼
setViewMode('study') ──────────────────────────────────────────┐
    │                                                            │
    ▼                                                            │
[KanjiStudyMode renders] ──────────────────────────────────────┐│
    │                                                           │││
    │ User views kanji                                          │││
    ├────────────────────────────────────────────────────────► │││
    │                   kanjiProgressManager.trackKanjiView()  │││
    │                           ↓                               │││
    │                   setCurrentStatus('learning')            │││
    │                                                           │││
    │ User marks learned                                        │││
    ├────────────────────────────────────────────────────────► │││
    │                   kanjiProgressManager.markKanjiLearned() │││
    │                           ↓                               │││
    │                   setIsLearned(true)                      │││
    │                   onNext() (auto-advance)                 │││
    │                                                           │││
    │ Session complete                                          │││
    └────────────────────────────────────────────────────────► │││
                        clearPersistedStudySession()            │││
                        setViewMode('browse')                   │││
                                                                │││
                                                                │││
└───────────────────────────────────────────────────────────────┘│
                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### **Review Mode Flow**

```
┌─────────────────────────────────────────────────────────────────┐
│                     REVIEW SESSION FLOW                          │
└─────────────────────────────────────────────────────────────────┘

handleStartReview() ──────────────────────────────────────────┐
    │                                                          │
    ▼                                                          │
selectedKanjiData.map(k => kanjiAdapter.transform(k))          │
    │                                                          │
    ▼                                                          │
setReviewContent(reviewableItems)                              │
setReviewContentPool(allKanjiAsReviewable)                     │
    │                                                          │
    ▼                                                          │
setViewMode('review') ────────────────────────────────────────┐│
    │                                                         │││
    ▼                                                         │││
[ReviewSessionUI renders] ────────────────────────────────────┐│││
    │                                                        ││││
    │ URE creates session                                    ││││
    ├──────────────────────────────────────────────────────► ││││
    │            ReviewSession {                             ││││
    │              items: ReviewSessionItem[],               ││││
    │              currentIndex: 0,                          ││││
    │              status: 'active',                         ││││
    │              mode: 'recognition',                      ││││
    │              config: {...}                             ││││
    │            }                                            ││││
    │                                                         ││││
    │ User answers question                                   ││││
    ├──────────────────────────────────────────────────────► ││││
    │            answerItem() ───────────────────────────────┐││││
    │                │                                       │││││
    │                ├─ Validate answer                      │││││
    │                ├─ Update SRS data                      │││││
    │                ├─ Emit ITEM_ANSWERED event ───────────┐│││││
    │                │       ↓                              ││││││
    │                │   Event Hub broadcasts               ││││││
    │                │       ↓                              ││││││
    │                │   Gamification listener (XP)         ││││││
    │                │   Progress listener (IndexedDB)      ││││││
    │                │                                      ││││││
    │                └─ Advance to next item ◀─────────────┘│││││
    │                                                        │││││
    │ Session complete                                       │││││
    └──────────────────────────────────────────────────────► │││││
                 endSession() ──────────────────────────────┐│││││
                     │                                      ││││││
                     ├─ Calculate stats                     ││││││
                     ├─ Save to IndexedDB                   ││││││
                     ├─ Sync to Firebase (if premium)       ││││││
                     ├─ Emit SESSION_COMPLETED event ──────┐││││││
                     │       ↓                             │││││││
                     │   Event Hub broadcasts              │││││││
                     │       ↓                             │││││││
                     │   Achievement listener              │││││││
                     │   XP calculation (bonus)            │││││││
                     │                                     │││││││
                     └─ Return stats ◀───────────────────┘│││││││
                                                           ││││││
└──────────────────────────────────────────────────────────┘│││││
                                                            ││││
└───────────────────────────────────────────────────────────┘│││
                                                             ││
└──────────────────────────────────────────────────────────┘│
                                                            │
└───────────────────────────────────────────────────────────┘
```

### **Kanji Adapter Transform Pipeline**

```
Raw Kanji Data ──────────────────────────────────────────────────┐
│                                                                 │
│ {                                                               │
│   kanji: "日",                                                  │
│   meanings: ["sun", "day"],                                     │
│   onyomi: ["ニチ", "ジツ"],                                     │
│   kunyomi: ["ひ", "び"],                                         │
│   strokeCount: 4,                                               │
│   jlpt: "N5",                                                   │
│   examples: [...]                                               │
│ }                                                               │
│                                                                 │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
      kanjiAdapter.transform(kanji)
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│ ReviewableContent {                                              │
│   id: "日",                                                      │
│   contentType: "kanji",                                          │
│   primaryDisplay: "sun, day",           // Meanings (question)   │
│   secondaryDisplay: "On: ニチ, ジツ | Kun: ひ, び",             │
│   primaryAnswer: "日",                  // Kanji (correct answer)│
│   alternativeAnswers: ["day"],          // Other meanings        │
│   difficulty: 0.35,                     // Calculated            │
│   tags: ["kanji", "jlpt-n5", "grade-1", "strokes-4"],           │
│   supportedModes: ["recognition", "listening"],                  │
│   preferredMode: "recognition",                                  │
│   metadata: {                           // Full kanji data       │
│     strokeCount: 4,                                              │
│     radicals: [...],                                             │
│     jlptLevel: 5,                                                │
│     kanjiCharacter: "日",                                        │
│     meanings: ["sun", "day"],                                    │
│     onyomi: ["ニチ", "ジツ"],                                   │
│     kunyomi: ["ひ", "び"]                                        │
│   }                                                              │
│ }                                                                │
└──────────────────────────────────────────────────────────────────┘
```

---

## Session Lifecycle

### **Study Session States**

```typescript
interface StudySessionState {
  items: Kanji[]              // Kanji to study
  currentIndex: number         // Current position (0-based)
  startedAt: number           // Unix timestamp
  source: 'manual-selection' | 'collection'
}
```

**Lifecycle:**
1. **Creation** — `startStudySession()` called with kanji array
2. **Persistence** — Serialized to `localStorage` with user-specific key
3. **Restoration** — Auto-loaded on page mount if incomplete
4. **Navigation** — `currentIndex` increments on "Next", decrements on "Previous"
5. **Completion** — Cleared from localStorage when all items viewed
6. **Abandonment** — Cleared on "Exit" button or mode change

### **Review Session States**

```typescript
interface ReviewSession {
  id: string
  userId: string
  startedAt: Date
  endedAt?: Date
  items: ReviewSessionItem[]
  currentIndex: number
  mode: ReviewMode              // 'recognition' | 'listening'
  config: ReviewModeConfig
  status: 'active' | 'paused' | 'completed' | 'abandoned'
  stats?: SessionStatistics
}
```

**Lifecycle:**
1. **Creation** — URE's `createSession()` called by `ReviewSessionUI`
2. **Active** — User answers questions, URE tracks responses
3. **Pause** — (Not currently used in kanji browser)
4. **Resume** — (Not currently used in kanji browser)
5. **Completion** — All items answered, stats calculated
6. **Persistence** — Session summary saved to IndexedDB + Firebase
7. **Event Emission** — `SESSION_COMPLETED` event broadcasted to Event Hub

### **Event Hub Integration**

**Study Mode:**
- Manually emits events via `getEventHub().emit()`
- No automatic session tracking
- Progress updates go directly to `kanjiProgressManager`

**Review Mode:**
- URE automatically emits all events
- Event Hub listeners handle:
  - Gamification (XP, achievements)
  - Progress tracking (IndexedDB + Firebase)
  - Analytics

### **Session Persistence Strategy**

| Mode     | Storage        | Key Format                            | Restoration |
|----------|----------------|---------------------------------------|-------------|
| Study    | `localStorage` | `kanji-browser-study-session:{uid}`   | Automatic   |
| Review   | IndexedDB      | `sessions` store, `by-session` index  | Manual      |

---

## Progress Architecture

### **Two-Tier Storage**

```
┌─────────────────────────────────────────────────────────────────┐
│                     PROGRESS STORAGE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  LOCAL (All Authenticated Users)                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  IndexedDB: moshimoshi-universal-progress                │    │
│  │  Store: progress                                         │    │
│  │  Index: by-composite-key (userId:contentType:contentId)  │    │
│  │                                                           │    │
│  │  Instant read/write, offline-first                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                           │                                      │
│                           │ Sync (debounced 500ms)               │
│                           ▼                                      │
│  CLOUD (Premium Users Only)                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Firebase: /users/{uid}/progress/kanji                   │    │
│  │  Document structure:                                     │    │
│  │  {                                                        │    │
│  │    userId: string,                                        │    │
│  │    contentType: "kanji",                                  │    │
│  │    items: {                                               │    │
│  │      "日": { status, viewCount, ... },                   │    │
│  │      "月": { status, viewCount, ... }                    │    │
│  │    },                                                     │    │
│  │    lastUpdated: Timestamp                                 │    │
│  │  }                                                        │    │
│  │                                                           │    │
│  │  Cross-device sync, backup                               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### **Progress Data Schema**

```typescript
interface KanjiProgressData extends ReviewProgressData {
  // Core fields
  contentId: string              // Kanji character (e.g., "日")
  contentType: 'kanji'

  // Status tracking
  status: 'not-started' | 'learning' | 'learned'
  viewCount: number               // Total views
  interactionCount: number        // User interactions (clicks, reveals)
  correctCount: number            // Correct answers in reviews
  incorrectCount: number          // Incorrect answers
  accuracy: number                // % correct

  // Streaks
  streak: number                  // Current correct streak
  bestStreak: number              // All-time best streak

  // Timestamps
  firstViewedAt: string | null
  lastViewedAt: string | null
  lastInteractedAt: string | null
  createdAt: string
  updatedAt: string

  // Flags
  pinned: boolean
  bookmarked: boolean
  flaggedForReview: boolean

  // SRS (if in review mode)
  srsLevel: number | null
  nextReviewDate: string | null
  easeFactor: number | null
  interval: number | null

  // Metadata
  character?: string              // Kanji-specific
  jlptLevel?: string
  version: number
  syncedAt: string | null
}
```

### **Status Promotion Logic**

**Thresholds (in `kanjiProgressManager.ts`):**
```typescript
const LEARNED_VIEW_THRESHOLD = 6

updateProgressForEvent(progress, event) {
  const views = progress.viewCount || 0

  if (views >= 6) {
    progress.status = 'learned'
  } else if (views > 0 && progress.status === 'not-started') {
    progress.status = 'learning'
  }

  return progress
}
```

**Explicit Marking:**
```typescript
// User clicks "Mark as Learned"
markKanjiLearned(kanjiId, user, isPremium) {
  const updated = {
    ...existing,
    status: 'learned',
    viewCount: Math.max(existing.viewCount, 6),  // Ensure threshold met
    correctCount: existing.correctCount + 1
  }
  await saveProgress(userId, 'kanji', kanjiId, updated, isPremium)
  if (isPremium) await flushPendingSync()
}
```

### **Sync Conflict Resolution**

**Strategy:** Last-Write-Wins (LWW) based on `updatedAt` timestamp

```typescript
mergeProgress(local, cloud) {
  const merged = new Map(local)

  for (const [contentId, cloudItem] of cloud) {
    const localItem = local.get(contentId)

    // Cloud is newer → overwrite local
    if (!localItem || cloudItem.updatedAt > localItem.updatedAt) {
      merged.set(contentId, cloudItem)
      // Backfill to IndexedDB
      await saveToIndexedDB(userId, contentType, contentId, cloudItem)
    }
  }

  return merged
}
```

### **Offline Support**

**Free Users:**
- All progress stored in IndexedDB only
- No sync to Firebase
- Data lost if browser cache cleared

**Premium Users:**
- IndexedDB + Firebase sync
- Offline writes queued in `syncQueue` store
- Auto-retry on reconnect

---

## Reading Presentation Logic

### **Problem:** Default Kanji Readings Are Unordered

Raw kanji data lists all on'yomi and kun'yomi readings without prioritization:
```json
{
  "kanji": "日",
  "onyomi": ["ニチ", "ジツ"],
  "kunyomi": ["ひ", "び", "か"]
}
```

**Which reading should be shown first?**

### **Solution:** JMdict-Powered Priority Algorithm

**Implementation:** `kanjiReadingPriority.ts`

**Algorithm:**
1. **Build Candidate Pool** — Extract all onyomi/kunyomi from kanji data
2. **Search JMdict** — Query for words containing the kanji (limit 80 results)
3. **Score Each Reading** — Based on:
   - **Tag Priority** (news1 > ichi1 > spec1 > nf01-nf49)
   - **Word Type** (noun > verb > adjective)
   - **Word Complexity** (shorter words score higher)
   - **Position Match** (word start/end = higher)
   - **Reading Match** (exact > prefix > contains)
4. **Rank & Truncate** — Return top 2 onyomi + top 3 kunyomi

**Output:**
```typescript
interface PrioritizedKanjiReadings {
  onyomi: string[]              // Top 2 most common
  kunyomi: string[]             // Top 3 most common
  primaryReading: string | null // Single most common (prefer kunyomi)
  hasAdditionalOnyomi: boolean  // More readings exist
  hasAdditionalKunyomi: boolean
  source: 'jmdict' | 'fallback' // Was JMdict used?
}
```

### **Caching Strategy**

**Cache Key:** `${kanji}|${onyomi.join(',')}|${kunyomi.join(',')}`

- In-memory cache (Map)
- No expiration (kanji readings don't change)
- Cleared on page reload

### **UI Integration**

**Study Mode (KanjiStudyMode.tsx):**
```typescript
const {
  onyomi: primaryOnyomi,
  kunyomi: primaryKunyomi,
} = usePrioritizedKanjiReadings(kanji.kanji, kanji.onyomi, kanji.kunyomi)

// Render only curated readings
primaryOnyomi.map(reading => (
  <AudioButton onPlay={() => handlePlayAudio(reading)} />
))
```

**Details Modal (KanjiDetailsModal):**
- Shows **curated** readings by default
- "Show More" button reveals **all** readings if `hasAdditional*` is true

---

## Critical Invariants

**MUST NOT BREAK:**

### **1. Progress Status Consistency**
```typescript
INVARIANT: status must match viewCount

if (viewCount >= 6) → status === 'learned'
if (0 < viewCount < 6) → status === 'learning'
if (viewCount === 0) → status === 'not-started'
```

**Enforced By:**
- `kanjiProgressManager.updateProgressForEvent()`
- `refreshKanjiProgress()` normalization step

### **2. Session State Isolation**
```typescript
INVARIANT: Switching modes clears session state

handleModeChange(newMode) {
  setViewMode(newMode)
  setSelectedKanji(new Set())     // Clear selection
  setStudySession(null)           // Clear study state
  setReviewContent([])            // Clear review queue
  setReviewContentPool([])        // Clear options pool
}
```

**Why:** Prevents leftover state from one mode leaking into another (e.g., review mode options showing study kanji).

### **3. Study Session Persistence Uniqueness**
```typescript
INVARIANT: One study session per user

localStorage key = `kanji-browser-study-session:${userId}`
```

**Why:** Multiple sessions would conflict during restoration.

### **4. Kanji Adapter Transform Consistency**
```typescript
INVARIANT: ReviewableContent must retain full kanji data in metadata

kanjiAdapter.transform(kanji) MUST include:
- metadata.kanjiCharacter
- metadata.meanings
- metadata.onyomi
- metadata.kunyomi
- metadata.strokeCount
- metadata.jlptLevel
```

**Why:** Review mode UI components (KanjiCard) depend on this metadata for display.

### **5. Reading Prioritization Cacheability**
```typescript
INVARIANT: Readings for same kanji+onyomi+kunyomi always return same result

cacheKey = `${kanji}|${onyomi.join(',')}|${kunyomi.join(',')}`
```

**Why:** JMdict queries are expensive; must be deterministic for caching.

### **6. Premium Sync Exclusivity**
```typescript
INVARIANT: Only premium users sync to Firebase

if (isPremium) {
  queueFirebaseSync(...)
} else {
  // IndexedDB only
}
```

**Why:** Free users should never touch Firebase to avoid scaling costs.

---

## Risk Vectors

**High-Risk Areas Likely to Break:**

### **1. Session State Corruption**
**Symptoms:**
- Review mode shows study kanji
- Study mode session doesn't clear after completion
- "Resume session" shows wrong kanji

**Root Causes:**
- Forgot to call `handleModeChange()` instead of `setViewMode()` directly
- Study session not cleared from `localStorage` on completion
- `studySession` state not reset on user logout

**Prevention:**
- Always use `handleModeChange()` for mode transitions
- Implement `clearPersistedStudySession()` cleanup in all exit paths
- Add `useEffect(() => { if (!user) clearSession() }, [user])`

### **2. Progress Sync Race Conditions**
**Symptoms:**
- IndexedDB and Firebase show different progress
- `viewCount` resets to 0 unexpectedly
- Duplicate progress entries

**Root Causes:**
- Concurrent writes to same kanji from multiple tabs
- Firebase sync triggered before IndexedDB write completes
- Merge logic overwriting newer local data with stale cloud data

**Prevention:**
- Use `compositeKey` unique index in IndexedDB
- Implement try/catch + retry for `ConstraintError` in `saveToIndexedDB()`
- Always compare `updatedAt` timestamps in `mergeProgress()`

### **3. Kanji Adapter Metadata Loss**
**Symptoms:**
- Kanji card shows "undefined" for readings
- Stroke count missing in review mode
- TTS fails to play audio

**Root Causes:**
- `transform()` method not copying all required fields to `metadata`
- Raw kanji data schema changed (e.g., `jlpt` vs `jlptLevel`)
- `alternativeAnswers` not populated correctly

**Prevention:**
- Add type guards in `transform()` to handle both schema formats
- Test adapter with both Kanji and KanjiContent input types
- Always populate `metadata.kanjiCharacter` as fallback display value

### **4. Reading Priority Cache Invalidation**
**Symptoms:**
- Outdated readings shown after data update
- Same kanji shows different readings on different pages

**Root Causes:**
- Cache key doesn't include all dependencies
- JMdict data updated but cache not cleared
- Fallback readings used when JMdict should be available

**Prevention:**
- Include `onyomi` and `kunyomi` arrays in cache key
- Catch and log errors in `searchJMdictWords()`
- Add `source: 'jmdict' | 'fallback'` to debug cache hits

### **5. Entitlement Check Bypass**
**Symptoms:**
- Free users access premium features
- Usage limits not enforced
- Analytics show zero usage

**Root Causes:**
- `checkAndTrack()` not awaited before action
- `skipTracking: true` used incorrectly
- Entitlement check inside conditionally-rendered component

**Prevention:**
- Always `await checkAndTrack()` and check return value
- Place entitlement checks at action entry points (button onClick)
- Never gate UI rendering on entitlement checks (use fallback UI instead)

---

## Safe Change Guide

### **Adding a New Kanji Field**

**Example:** Add "radicals" display to study mode

**Steps:**
1. **Verify Field Exists in Raw Data**
   ```typescript
   // Check /data/kanji/N5.json
   { "kanji": "日", "radicals": ["日"] }
   ```

2. **Update Kanji Type (if needed)**
   ```typescript
   // /src/types/kanji.ts
   export interface Kanji {
     radicals?: string[]  // Add this
   }
   ```

3. **Update Adapter Metadata**
   ```typescript
   // KanjiBrowserAdapter.transform()
   metadata: {
     ...existing,
     radicals: kanji.radicals || []  // Copy to metadata
   }
   ```

4. **Access in UI**
   ```typescript
   // KanjiStudyMode.tsx
   const radicals = kanji.metadata?.radicals || []
   ```

**Testing:**
- Verify field appears in both study and review modes
- Check that missing field doesn't crash (use defaults)

---

### **Adding a New Study Mode Feature**

**Example:** Add "Etymology" section

**Steps:**
1. **Add Data Source**
   ```typescript
   // Fetch etymology from external API or local JSON
   const [etymology, setEtymology] = useState<string | null>(null)

   useEffect(() => {
     fetchEtymology(kanji.kanji).then(setEtymology)
   }, [kanji.kanji])
   ```

2. **Update UI**
   ```typescript
   {etymology && (
     <div className="etymology-section">
       <h3>Etymology</h3>
       <p>{etymology}</p>
     </div>
   )}
   ```

3. **Consider Progress Tracking**
   ```typescript
   // Do we need to track "etymology viewed"?
   const handleEtymologyView = () => {
     kanjiProgressManager.trackProgress(
       'kanji',
       kanji.kanji,
       ProgressEvent.INTERACTED,
       user,
       isPremium,
       { interactionType: 'etymology_viewed' }
     )
   }
   ```

**Testing:**
- Ensure feature doesn't slow down initial render
- Verify progress tracking doesn't break existing stats

---

### **Modifying Progress Schema**

**Example:** Add "timeSpent" field

**⚠️ CRITICAL:** Progress data is persisted — migrations required!

**Steps:**
1. **Update Type**
   ```typescript
   interface KanjiProgressData {
     timeSpent?: number  // Optional for backward compat
   }
   ```

2. **Update `createInitialProgress()`**
   ```typescript
   createInitialProgress(contentId, contentType) {
     return {
       ...existing,
       timeSpent: 0  // Initialize new field
     }
   }
   ```

3. **Add Migration Logic**
   ```typescript
   // In loadFromIndexedDB()
   const progressMap = new Map<string, KanjiProgressData>()
   for (const record of records) {
     const data = record.data
     if (data.timeSpent === undefined) {
       data.timeSpent = 0  // Migrate old records
     }
     progressMap.set(record.contentId, data)
   }
   ```

4. **Update API Schema**
   ```typescript
   // /api/progress/track route.ts
   // Ensure Firebase schema matches
   ```

**Testing:**
- Test with both new and existing progress data
- Verify Firebase sync doesn't fail on old data

---

### **Changing Review Mode Config**

**Example:** Add 6-choice option (currently only 4-choice)

**Steps:**
1. **Update Adapter Config**
   ```typescript
   const kanjiAdapter = new KanjiBrowserAdapter({
     availableModes: [{
       mode: 'recognition',
       optionCount: 6,  // Change from 4
     }]
   })
   ```

2. **Update `generateOptions()` Logic**
   ```typescript
   // KanjiBrowserAdapter.generateOptions()
   // Ensure pool has enough kanji for 6 options
   if (pool.length < count - 1) {
     console.warn('Not enough kanji for options')
   }
   ```

3. **Update UI Layout**
   ```typescript
   // KanjiCard.tsx (review mode)
   // Adjust grid layout for 6 options
   className="grid grid-cols-3 gap-4"  // Was grid-cols-2
   ```

**Testing:**
- Test with small pools (< 6 kanji) to ensure graceful fallback
- Verify mobile layout doesn't overflow

---

### **Debugging Session Issues**

**Common Patterns:**

**Issue:** "Review mode shows no kanji"
```typescript
// Check adapter transform
console.log('Review content:', reviewContent)
console.log('Options pool:', reviewContentPool)

// Verify adapter metadata
const transformed = kanjiAdapter.transform(kanji)
console.log('Transformed metadata:', transformed.metadata)
```

**Issue:** "Progress not syncing"
```typescript
// Check IndexedDB
const progress = await kanjiProgressManager.getKanjiProgressItem(
  kanjiId, user, isPremium
)
console.log('IndexedDB progress:', progress)

// Check Firebase (premium only)
const res = await fetch('/api/progress/track?contentType=kanji')
const cloud = await res.json()
console.log('Cloud progress:', cloud.items[kanjiId])
```

**Issue:** "Study session not restoring"
```typescript
// Check localStorage
const key = `kanji-browser-study-session:${user.uid}`
const raw = localStorage.getItem(key)
console.log('Stored session:', JSON.parse(raw))

// Check restoration logic
console.log('Restored for user:', restoredStudySessionForUser)
console.log('Current user:', user?.uid)
```

---

## Summary

**Key Takeaways:**

1. **Three Modes, Three State Machines** — Browse, Study, Review each have distinct lifecycles
2. **Dual Storage** — IndexedDB (all) + Firebase (premium) with conflict resolution
3. **Adapter is Bridge** — KanjiBrowserAdapter converts raw kanji → URE ReviewableContent
4. **Readings Are Curated** — JMdict-powered prioritization, not raw dumps
5. **Progress is Sacred** — Careful migrations required, status must match viewCount
6. **Session State Must Isolate** — Always use `handleModeChange()` to clear state
7. **Event Hub for Review Only** — Study mode tracks progress directly
8. **Entitlements at Action Points** — Never gate UI rendering, only user actions

**Before Making Changes:**
- Read relevant invariants
- Identify risk vectors
- Test with both new and existing data
- Verify progress tracking still works
- Check both free and premium user flows

**When Things Break:**
- Check session state first (`studySession`, `reviewContent`)
- Verify IndexedDB → Firebase sync
- Log adapter transform output
- Inspect Event Hub listeners
- Validate entitlement checks are awaited

---

**Document Version:** 1.0
**Author:** Claude Code (Anthropic)
**Last Review:** 2026-03-24
