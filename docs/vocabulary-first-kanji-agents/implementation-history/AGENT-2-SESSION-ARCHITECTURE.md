# Agent 2: Session Architecture Documentation

## Overview

This document describes the card-level session persistence architecture implemented for the vocabulary-first kanji study system.

**Version:** 1.0
**Date:** 2026-03-24
**Owner:** Agent 2 (Session Architecture & Persistence)

---

## Table of Contents

1. [Session Schema](#session-schema)
2. [State Machine](#state-machine)
3. [Persistence Semantics](#persistence-semantics)
4. [Migration Strategy](#migration-strategy)
5. [API Reference](#api-reference)
6. [Integration Points](#integration-points)

---

## Session Schema

### Current Schema (Version 1)

```typescript
interface KanjiStudySessionState {
  version: 1 // Schema version for migration handling
  mode: 'traditional' | 'vocabulary-first' // Study mode
  kanji: StudySessionKanjiItem[] // Ordered kanji sequence
  currentKanjiIndex: number // Current position in sequence (0-based)
  startedAt: number // Unix timestamp
  source: 'manual-selection' | 'collection' // Session origin
  totalCards: number // Total cards across all kanji
  completedCards: number // Progress tracking
}
```

### Kanji Item Structure

```typescript
interface StudySessionKanjiItem {
  kanjiId: string // The kanji character (e.g., "日")
  kanjiData: Kanji // Full kanji object for deterministic restore
  cards: KanjiStudyCard[] // Ordered card sequence
  currentCardIndex: number // Current card position (0-based)
  completed: boolean // Whether all cards viewed
}
```

### Card Types (defined by Agent 1)

```typescript
type KanjiStudyCard = MeaningCard | VocabularyCard | ReadingSummaryCard

interface MeaningCard {
  id: string
  type: 'meaning'
  kanjiCharacter: string
  primaryMeaning: string
  allMeanings: string[]
  strokeCount?: number
  jlptLevel?: string
}

interface VocabularyCard {
  id: string
  type: 'vocabulary'
  kanjiCharacter: string
  word: string // Japanese word
  wordReading: string // Hiragana reading
  wordMeaning: string // English translation
  targetReading: string // The reading this card teaches
  readingType: 'onyomi' | 'kunyomi'
  isCommonWord: boolean
  wordTags?: string[]
  patternHint?: string
}

interface ReadingSummaryCard {
  id: string
  type: 'reading-summary'
  kanjiCharacter: string
  onyomi: string[]
  kunyomi: string[]
  primaryReading: string | null
  readingsWithExamples: ReadingExample[]
}
```

---

## State Machine

### Session States

```
┌─────────────────────────────────────────────────────────────┐
│                    SESSION STATE MACHINE                     │
└─────────────────────────────────────────────────────────────┘

[IDLE]
  │
  │ User selects kanji + clicks "Start Study"
  ├──────────────────────────────────────────────────────────►
  │                                                            │
  │                                                            ▼
  │                                                    [ACTIVE STUDY]
  │                                                            │
  │                                                            │
  │                    ┌───────────────────────────────────────┤
  │                    │ User refreshes page                   │
  │                    │ or closes browser                     │
  │                    ▼                                       │
  │            [SUSPENDED (in localStorage)]                   │
  │                    │                                       │
  │                    │ Page reloads, session restored        │
  │                    └───────────────────────────────────────┘
  │                                                            │
  │                    Session completes (all cards viewed)    │
  │                    or user manually exits                  │
  ◄────────────────────────────────────────────────────────────┘
  │
[IDLE]
```

### State Transitions

| From State | Event | To State | Side Effects |
|------------|-------|----------|--------------|
| IDLE | `startStudySession()` | ACTIVE | Create session, save to localStorage, emit SESSION_START |
| ACTIVE | Page refresh | SUSPENDED | Session remains in localStorage |
| SUSPENDED | Page load | ACTIVE | Restore session, show "resumed" toast |
| ACTIVE | Complete last card | IDLE | Clear localStorage, emit SESSION_COMPLETED, show XP |
| ACTIVE | Click "Exit" | IDLE | Keep localStorage session for later resume |
| IDLE | Detect legacy session | IDLE | Clear legacy session, show migration toast |

---

## Persistence Semantics

### Storage Mechanism

- **Location:** Browser `localStorage`
- **Key Format:** `kanji-browser-study-session:{userId}`
- **Serialization:** JSON.stringify / JSON.parse
- **Max Size:** ~5-10 MB (localStorage limit)

### Persistence Guarantees

1. **Refresh Survives:** ✅ Session automatically restores on page load
2. **Browser Close Survives:** ✅ Session persists across browser restarts
3. **Manual Exit Preserves Session:** ✅ Return to browse mode without losing position
4. **Completion Clears Session:** ✅ Automatic cleanup on session completion
5. **Collection Study Works:** ✅ Both `manual-selection` and `collection` sources supported

### Persistence Behavior

#### Auto-Save

```typescript
useEffect(() => {
  if (!studySession || studySession.kanji.length === 0) {
    // Clear empty sessions
    localStorage.removeItem(storageKey)
    return
  }

  // Save valid sessions
  localStorage.setItem(storageKey, JSON.stringify(studySession))
}, [studySession, user?.uid])
```

#### Auto-Restore

```typescript
useEffect(() => {
  if (!user?.uid || restoredForUser === user.uid) return

  const raw = localStorage.getItem(sessionKey)
  if (!raw) return

  const parsed = JSON.parse(raw)

  if (isLegacySession(parsed)) {
    // Clear old sessions
    clearPersistedSession()
    return
  }

  if (isCurrentSession(parsed)) {
    // Restore v1 sessions
    setStudySession(parsed)
    setViewMode('study')
  }
}, [user?.uid])
```

#### Completion Cleanup

```typescript
if (isLastCard && isLastKanji) {
  // Emit XP event
  emitSessionCompleted()

  // Clear persisted state
  localStorage.removeItem(sessionKey)

  // Return to browse mode
  setViewMode('browse')
}
```

---

## Migration Strategy

### Version Detection

```typescript
function isLegacySession(session: any): boolean {
  return !('version' in session) && 'items' in session
}

function isCurrentSession(session: any): boolean {
  return session.version === 1 && 'kanji' in session
}
```

### Legacy Session Schema

```typescript
// Old schema (unversioned)
interface LegacyStudySessionState {
  items: Kanji[] // Array of kanji
  currentIndex: number // Simple index
  startedAt: number
  source: 'manual-selection' | 'collection'
  // No version field
}
```

### Migration Path

| Session Type | Version | Action |
|--------------|---------|--------|
| No session | N/A | No action |
| Legacy (no version) | 0 (implicit) | **Clear** - show migration toast |
| Current | 1 | **Restore** - normal flow |
| Future | 2+ | **Upgrade** - apply migrations |

### Migration Logic

```typescript
// On page load
const raw = localStorage.getItem(sessionKey)
if (!raw) return // No session

const parsed = JSON.parse(raw)

if (isLegacySession(parsed)) {
  console.log('Detected legacy session, clearing...')
  localStorage.removeItem(sessionKey)
  showToast('Previous session format outdated. Please start new session.')
  return
}

if (parsed.version === 1) {
  // Current version - restore normally
  restoreSession(parsed)
}

// Future: if (parsed.version === 2) { migrate v1→v2 }
```

---

## API Reference

### Helper Functions

#### `getSessionPosition(session: KanjiStudySessionState): SessionPosition`

Returns detailed position information about the current state.

```typescript
interface SessionPosition {
  kanjiIndex: number // Current kanji index
  cardIndex: number // Current card index within kanji
  kanjiId: string // Current kanji character
  currentCard: KanjiStudyCard | null // Current card object
  currentKanjiData: Kanji | null // Full kanji object
  isLastCard: boolean // On last card of current kanji?
  isLastKanji: boolean // On last kanji of session?
  isSessionComplete: boolean // Session finished?
}
```

**Example:**
```typescript
const position = getSessionPosition(studySession)

if (position.isSessionComplete) {
  completeSession()
} else {
  console.log(`Kanji ${position.kanjiIndex + 1}, Card ${position.cardIndex + 1}`)
}
```

---

#### `advanceToNextCard(session: KanjiStudySessionState): KanjiStudySessionState`

Advances to the next card in the session. Returns updated session state.

**Behavior:**
- If on last card of kanji → mark kanji as completed, move to next kanji
- If on last card of last kanji → session complete (no further advancement)
- Otherwise → increment `currentCardIndex`

**Example:**
```typescript
setStudySession(prev => prev ? advanceToNextCard(prev) : prev)
```

---

#### `goToPreviousCard(session: KanjiStudySessionState): KanjiStudySessionState`

Goes back to the previous card. Returns updated session state.

**Behavior:**
- If on first card of kanji → go to previous kanji's last card
- If on first card of first kanji → no change (already at start)
- Otherwise → decrement `currentCardIndex`

**Example:**
```typescript
setStudySession(prev => prev ? goToPreviousCard(prev) : prev)
```

---

#### `createEmptySession(mode: StudyMode, source: StudySessionSource): KanjiStudySessionState`

Creates an empty session with proper initialization.

**Example:**
```typescript
const session = createEmptySession('traditional', 'manual-selection')
// Returns:
{
  version: 1,
  mode: 'traditional',
  kanji: [],
  currentKanjiIndex: 0,
  startedAt: Date.now(),
  source: 'manual-selection',
  totalCards: 0,
  completedCards: 0
}
```

---

### Creating a Session

```typescript
const startStudySession = (kanjiItems: Kanji[], source: StudySessionSource) => {
  // Build kanji items with cards
  const sessionKanji: StudySessionKanjiItem[] = kanjiItems.map(kanji => ({
    kanjiId: kanji.kanji,
    kanjiData: kanji, // Store full object for restore
    cards: [
      // For traditional mode: single meaning card
      {
        id: `${kanji.kanji}-meaning`,
        type: 'meaning',
        kanjiCharacter: kanji.kanji,
        primaryMeaning: kanji.meanings[0],
        allMeanings: kanji.meanings,
        strokeCount: kanji.strokeCount,
        jlptLevel: kanji.jlpt
      }
    ],
    currentCardIndex: 0,
    completed: false
  }))

  const totalCards = sessionKanji.reduce((sum, item) => sum + item.cards.length, 0)

  setStudySession({
    version: 1,
    mode: 'traditional', // or 'vocabulary-first'
    kanji: sessionKanji,
    currentKanjiIndex: 0,
    startedAt: Date.now(),
    source,
    totalCards,
    completedCards: 0
  })

  setViewMode('study')
}
```

---

## Integration Points

### With KanjiStudyMode Component

```typescript
<KanjiStudyMode
  kanji={currentStudyKanji} // Full Kanji object
  currentCard={getSessionPosition(session).currentCard} // Current card
  studyMode={session.mode} // 'traditional' | 'vocabulary-first'
  cardIndex={session.kanji[session.currentKanjiIndex].currentCardIndex}
  totalCards={session.kanji[session.currentKanjiIndex].cards.length}
  onNext={() => setStudySession(prev => advanceToNextCard(prev))}
  onPrevious={() => setStudySession(prev => goToPreviousCard(prev))}
  ...
/>
```

### With Progress Manager

```typescript
// Progress tracking still uses kanji-level tracking
await kanjiProgressManager.trackKanjiView(kanji.kanji, user, isPremium)

// Session completion emits XP event
getEventHub().emit(ReviewEventType.SESSION_COMPLETED, {
  data: {
    sessionId,
    statistics: {
      correctItems: session.kanji.length,
      accuracy: 100,
      ...
    }
  }
})
```

### With Agent 1 (Card Generation)

```typescript
// Agent 1 provides card generation API
import { generateVocabularyFirstCards } from '@/lib/kanji-vocabulary-cards'

// When creating vocabulary-first session:
const sessionKanji: StudySessionKanjiItem[] = kanjiItems.map(kanji => {
  const cards = generateVocabularyFirstCards(kanji) // Agent 1's method
  return {
    kanjiId: kanji.kanji,
    kanjiData: kanji,
    cards, // MeaningCard, VocabularyCards, ReadingSummaryCard
    currentCardIndex: 0,
    completed: false
  }
})
```

### With Agent 3 (Study UI)

Agent 3 will use the `currentCard` prop to render different UI based on card type:

```typescript
function KanjiStudyMode({ currentCard, studyMode, ... }) {
  if (studyMode === 'traditional') {
    // Show traditional all-at-once UI
    return <TraditionalKanjiView kanji={kanji} />
  }

  // Vocabulary-first mode: render by card type
  switch (currentCard?.type) {
    case 'meaning':
      return <MeaningCardView card={currentCard} />
    case 'vocabulary':
      return <VocabularyCardView card={currentCard} />
    case 'reading-summary':
      return <ReadingSummaryView card={currentCard} />
    default:
      return <FallbackView />
  }
}
```

---

## Summary

### Key Decisions

1. **Versioned Schema:** All sessions include `version: 1` for future migrations
2. **Full Data Storage:** `kanjiData` is fully serialized to avoid dependency on loaded JLPT data
3. **Card-Level Granularity:** Both `currentKanjiIndex` and `currentCardIndex` tracked
4. **Deterministic Restore:** Session contains all data needed to recreate UI state
5. **Legacy Migration:** Old sessions auto-cleared with user notification

### Guarantees

- ✅ Refresh survives
- ✅ Browser close survives
- ✅ Manual exit clears session (clean exit)
- ✅ Completion clears session
- ✅ Collection study works
- ✅ Legacy sessions handled gracefully

### Next Steps for Other Agents

**Agent 3 (Study UI):**
- Use `currentCard` prop to render card-specific UI
- Implement vocabulary card and reading summary components
- Handle `studyMode` prop for traditional vs vocabulary-first

**Agent 4 (Progress Tracking):**
- Extend progress tracking to card-level if needed
- Ensure vocabulary card completions are tracked
- Consider separate progress for vocabulary exposure

**Agent 5 (Browser/Review Alignment):**
- Ensure review mode adapter works with new card structure
- Align furigana rendering with vocabulary cards
- Maintain consistency across browse/study/review

---

**Document Version:** 1.0
**Last Updated:** 2026-03-24
**Status:** ✅ Implemented & Documented
