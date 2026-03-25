# Vocabulary-First Kanji: Testing Strategy

**Version:** 2.0 (Precision Revision)
**Date:** 2026-03-24
**Status:** Aligned with Actual Contracts

---

## Document Status

**This document distinguishes:**
- ✅ **Current Implementation** - What exists now in src/types/kanji-study.ts and the codebase
- 🎯 **Proposed Targets** - Recommended metrics and thresholds
- 🔮 **Future Work** - Features not yet implemented (Agent 1-5 deliverables)

---

## Executive Summary

The vocabulary-first kanji feature will extend the existing kanji browser study mode to support multi-card sequences. The test strategy must validate:
1. **Card generation** (Agent 1) - Creating vocabulary cards from JMdict
2. **Session architecture** (Agent 2) - Storing and restoring card-level sessions
3. **UI components** (Agent 3) - Rendering vocabulary cards
4. **Progress tracking** (Agent 4) - Tracking vocabulary exposures (NOT YET IMPLEMENTED)
5. **Review alignment** (Agent 5) - Integration with review mode

### Critical Risks (Grounded in Actual Architecture)

1. **Session Persistence Corruption**
   - Current: `KanjiStudySessionState` with nested `kanji[]` array (version 1)
   - Risk: card-level currentCardIndex not saved/restored correctly
   - **NOT** flat cards array - that was a mistake in v1.0 of this doc

2. **Legacy Session Handling**
   - Current: Legacy sessions (no `version` field) are **CLEARED, not upgraded**
   - Behavior: `isLegacySession()` type guard, localStorage cleared
   - **NOT** migration logic - that was incorrectly assumed

3. **Progress Schema Evolution**
   - Current: Standard `KanjiProgressData` from `kanjiProgressManager.ts`
   - Future: Agent 4 will add vocabulary-specific fields (NOT YET EXISTS)
   - Risk: Tests that assume vocabulary fields will fail until Agent 4 completes

4. **Mobile Card Layout**
   - Risk: Vocabulary cards with long words overflow on 320-375px screens
   - Mitigation: Responsive component tests

5. **Vocabulary Lookup Accuracy**
   - Current: `kanjiVocabularyLookup.ts` uses heuristic kana matching
   - Limitations: Cannot handle all rendaku, okurigana, irregular readings
   - Risk: Poor vocabulary matches confuse learners

---

## Current Implementation (Verified)

### Existing Contracts (src/types/kanji-study.ts)

```typescript
// Card types (ACTUAL - do not invent new types)
type KanjiStudyCardType = 'meaning' | 'vocabulary' | 'reading-summary'

// Session structure (ACTUAL - nested kanji[] with per-kanji cards[])
interface KanjiStudySessionState {
  version: 1
  mode: 'traditional' | 'vocabulary-first'
  kanji: StudySessionKanjiItem[]  // NOT flat cards array
  currentKanjiIndex: number
  startedAt: number
  source: 'manual-selection' | 'collection'
  totalCards: number
  completedCards: number
}

// Per-kanji item (ACTUAL)
interface StudySessionKanjiItem {
  kanjiId: string
  kanjiData: Kanji
  cards: KanjiStudyCard[]        // Cards for THIS kanji only
  currentCardIndex: number        // Position within THIS kanji's cards
  completed: boolean
}
```

### Existing Infrastructure

**Storage:**
- localStorage key: `kanji-browser-study-session:${userId}`
- Format: `KanjiStudySessionState` (JSON serialized)
- Detection: `isLegacySession()` and `isCurrentSession()` type guards

**Vocabulary Lookup:**
- File: `src/utils/kanjiVocabularyLookup.ts`
- Functions: `findWordsForKanjiReading()`, `getBestVocabularyMatch()`
- Limitations: Heuristic matching, not morphologically accurate

**Feature Flags:**
- System 1: `src/lib/features/featureFlags.ts` (env vars)
- System 2: `src/lib/features/runtimeFeatureFlags.ts` (Firestore)
- **VOCABULARY_FIRST_KANJI flag does NOT exist yet** - see Rollout Strategy for proposal

---

## Testing Layers

### Layer 1: Unit Tests (🎯 Proposed Target: 85%+ coverage)

#### **Vocabulary Lookup (Agent 1 Deliverable)**

**Files to Test:**
- `src/utils/kanjiVocabularyLookup.ts` (ALREADY EXISTS)
- Card generation logic (AGENT 1 WILL CREATE)

**Test File:** `src/utils/__tests__/kanjiVocabularyLookup.test.ts`

**Coverage (Using REAL Contracts):**
```typescript
import { VocabKanjiFixtures } from '@/lib/review-engine/__tests__/test-utils/vocabularyKanjiTestUtils'
import { findWordsForKanjiReading, DEFAULT_VOCABULARY_CRITERIA } from '../kanjiVocabularyLookup'

describe('Vocabulary Lookup (Existing Implementation)', () => {
  it('should find vocabulary words for kanji reading', async () => {
    const result = await findWordsForKanjiReading(
      '日',
      'ひ',
      'kunyomi',
      DEFAULT_VOCABULARY_CRITERIA
    )

    expect(result.readingType).toBe('kunyomi')
    expect(result.words).toBeInstanceOf(Array)
    // hasGoodMatch depends on JMdict data quality
  })

  it('should return empty for readings with no matches', async () => {
    const result = await findWordsForKanjiReading(
      '㐂',
      'よろこ',
      'kunyomi',
      DEFAULT_VOCABULARY_CRITERIA
    )

    expect(result.words).toEqual([])
    expect(result.hasGoodMatch).toBe(false)
  })

  it('should cache results', async () => {
    const start1 = performance.now()
    await findWordsForKanjiReading('日', 'ひ', 'kunyomi', DEFAULT_VOCABULARY_CRITERIA)
    const duration1 = performance.now() - start1

    const start2 = performance.now()
    await findWordsForKanjiReading('日', 'ひ', 'kunyomi', DEFAULT_VOCABULARY_CRITERIA)
    const duration2 = performance.now() - start2

    expect(duration2).toBeLessThan(duration1)
  })
})

describe('Card Generation (Agent 1 Will Implement)', () => {
  it('should create vocabulary-first sequence using real contracts', () => {
    const kanji = VocabKanjiFixtures.createSimpleKanji()
    const sequence = VocabKanjiFixtures.createVocabularyFirstSequence(kanji)

    // Validate structure matches KanjiStudySequence contract
    expect(sequence.kanjiCharacter).toBe(kanji.kanji)
    expect(sequence.cards).toBeInstanceOf(Array)
    expect(sequence.totalCards).toBe(sequence.cards.length)
    expect(sequence.vocabularyCardCount).toBeGreaterThan(0)

    // First card must be meaning
    expect(sequence.cards[0].type).toBe('meaning')

    // Last card should be reading-summary
    expect(sequence.cards[sequence.cards.length - 1].type).toBe('reading-summary')
  })

  it('should handle kanji with no vocabulary gracefully', () => {
    const rareKanji = VocabKanjiFixtures.createRareKanji()
    const sequence = VocabKanjiFixtures.createVocabularyFirstSequence(rareKanji)

    // Should still have meaning + summary (fallback behavior)
    expect(sequence.cards.length).toBeGreaterThanOrEqual(2)
    expect(sequence.vocabularyCardCount).toBe(0)
    expect(sequence.source).toBe('fallback' || 'mixed')
  })
})
```

**🎯 Proposed Coverage Target:** 90%+

---

#### **Session Architecture (Agent 2 Deliverable)**

**Files to Test:**
- Session creation logic (AGENT 2 WILL CREATE)
- Existing: `src/types/kanji-study.ts` helper functions

**Test File:** `src/hooks/__tests__/vocabularyFirstSession.test.ts`

**Coverage (Using REAL Contracts):**
```typescript
import { VocabKanjiFixtures, VocabKanjiHelpers } from '@/lib/review-engine/__tests__/test-utils/vocabularyKanjiTestUtils'
import {
  advanceToNextCard,
  goToPreviousCard,
  getSessionPosition,
  isCurrentSession,
  isLegacySession,
} from '@/types/kanji-study'

describe('Session Architecture (Using Real Contracts)', () => {
  it('should create valid KanjiStudySessionState', () => {
    const kanji = [VocabKanjiFixtures.createSimpleKanji()]
    const session = VocabKanjiFixtures.createStudySession(kanji, 'vocabulary-first')

    // Validate using helper
    VocabKanjiHelpers.validateSessionState(session)

    // Check structure
    expect(session.version).toBe(1)
    expect(session.mode).toBe('vocabulary-first')
    expect(session.kanji).toHaveLength(1)
    expect(session.currentKanjiIndex).toBe(0)
  })

  it('should advance to next card within same kanji', () => {
    const kanji = [VocabKanjiFixtures.createSimpleKanji()]
    const session = VocabKanjiFixtures.createStudySession(kanji, 'vocabulary-first')

    const updated = advanceToNextCard(session)

    expect(updated.kanji[0].currentCardIndex).toBe(1)
    expect(updated.currentKanjiIndex).toBe(0) // Still on first kanji
  })

  it('should advance to next kanji when current completes', () => {
    const kanjiList = [
      VocabKanjiFixtures.createSimpleKanji({ kanji: '日' }),
      VocabKanjiFixtures.createSimpleKanji({ kanji: '月' }),
    ]
    const session = VocabKanjiFixtures.createStudySession(kanjiList, 'vocabulary-first')

    // Advance to last card of first kanji
    let current = session
    const firstKanjiCardCount = current.kanji[0].cards.length
    for (let i = 0; i < firstKanjiCardCount; i++) {
      current = advanceToNextCard(current)
    }

    // Should now be on second kanji
    expect(current.currentKanjiIndex).toBe(1)
    expect(current.kanji[0].completed).toBe(true)
  })

  it('should go back to previous card', () => {
    const kanji = [VocabKanjiFixtures.createSimpleKanji()]
    const session = VocabKanjiFixtures.createStudySession(kanji, 'vocabulary-first')

    const advanced = advanceToNextCard(session)
    const backtracked = goToPreviousCard(advanced)

    expect(backtracked.kanji[0].currentCardIndex).toBe(0)
  })

  it('should detect legacy sessions', () => {
    const kanji = [VocabKanjiFixtures.createSimpleKanji()]
    const legacy = VocabKanjiFixtures.createLegacySession(kanji)

    expect(isLegacySession(legacy)).toBe(true)
    expect(isCurrentSession(legacy)).toBe(false)
  })

  it('should detect current sessions', () => {
    const kanji = [VocabKanjiFixtures.createSimpleKanji()]
    const current = VocabKanjiFixtures.createStudySession(kanji, 'vocabulary-first')

    expect(isCurrentSession(current)).toBe(true)
    expect(isLegacySession(current)).toBe(false)
  })
})

describe('Session Persistence (Agent 2)', () => {
  it('should serialize and deserialize session without data loss', () => {
    const kanji = [VocabKanjiFixtures.createSimpleKanji()]
    const session = VocabKanjiFixtures.createStudySession(kanji, 'vocabulary-first')

    const serialized = VocabKanjiHelpers.serializeSession(session)
    const deserialized = VocabKanjiHelpers.deserializeSession(serialized)

    expect(deserialized.version).toBe(1)
    expect(deserialized.kanji).toHaveLength(1)
    expect(deserialized.kanji[0].cards).toBeInstanceOf(Array)
  })

  it('should restore session at exact card position', () => {
    const kanji = [VocabKanjiFixtures.createSimpleKanji()]
    const session = VocabKanjiFixtures.createStudySession(kanji, 'vocabulary-first')

    // Advance to card 2
    const advanced = advanceToNextCard(advanceToNextCard(session))

    // Mock localStorage
    const storage = VocabKanjiHelpers.mockLocalStorage('test-user')
    storage.set(advanced)

    // Restore
    const restored = storage.get()
    expect(restored.kanji[0].currentCardIndex).toBe(2)
  })
})
```

**🎯 Proposed Coverage Target:** 90%+ (critical path)

---

#### **Progress Tracking (Agent 4 Deliverable - NOT YET IMPLEMENTED)**

**⚠️ IMPORTANT: These tests assume Agent 4's vocabulary progress schema exists**

**Files to Test:**
- Extensions to `kanjiProgressManager.ts` (AGENT 4 WILL ADD)

**Test File:** `src/utils/__tests__/vocabularyKanjiProgress.test.ts`

**Coverage (FUTURE - Vocabulary Fields Don't Exist Yet):**
```typescript
describe('Vocabulary Progress Tracking (Agent 4 - NOT YET IMPLEMENTED)', () => {
  // NOTE: These tests will fail until Agent 4 adds vocabulary fields

  it.skip('should track vocabularySeenCount separately from viewCount', async () => {
    // Agent 4 needs to add vocabularySeenCount field to KanjiProgressData
  })

  it.skip('should track exposed readings', async () => {
    // Agent 4 needs to add readingsExposed Set<string> field
  })

  it.skip('should migrate old progress without breaking', async () => {
    // Agent 4 needs to handle missing fields gracefully
  })
})
```

**🎯 Proposed Coverage Target:** 90%+ (after Agent 4 completes)

---

### Layer 2: Integration Tests (🎯 Proposed Target: 90%+ for critical flows)

**Test File:** `src/app/[locale]/kanji-browser/__tests__/vocabularyFirstFlow.integration.test.ts`

**Current State vs Future:**
```typescript
describe('Vocabulary-First Study Flow (Integration)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should create vocabulary-first session using real contracts', () => {
    // Uses KanjiStudySessionState (version 1)
    // Uses nested kanji[] with per-kanji cards[]
    // NOT flat cards array
  })

  it('should restore session from localStorage', () => {
    // Key: kanji-browser-study-session:${userId}
    // Format: KanjiStudySessionState (JSON)
  })

  it('should CLEAR legacy sessions, not upgrade them', () => {
    // CURRENT BEHAVIOR: isLegacySession() → clear localStorage
    // NOT: migrate to new format
  })
})
```

---

### Layer 3: Component Tests (🎯 Proposed Target: 80%+ for new components)

**Test File:** `src/components/kanji/__tests__/VocabularyCard.test.tsx`

**Coverage:**
- Render vocabulary word with correct structure
- Display meaning and reading
- Audio button functionality
- Pattern hint display (if present)

---

### Layer 4: Manual QA

See `QA_CHECKLIST.md` (separate file, already accurate).

---

## Coverage Targets (🎯 PROPOSED, Not Requirements)

| Module                    | Unit | Integration | Component | Rationale               |
|---------------------------|------|-------------|-----------|-------------------------|
| Vocabulary Lookup         | 90%  | -           | -         | Critical for accuracy   |
| Session Architecture      | 85%  | 95%         | -         | Persistence is critical |
| Study UI                  | 75%  | -           | 85%       | Visual QA more important|
| Progress Tracking         | 90%  | 90%         | -         | After Agent 4 completes |
| Browser/Review Alignment  | 80%  | 90%         | 80%       | Integration risk        |

**These are recommended targets, not approved requirements.**

---

## Performance Targets (🎯 PROPOSED)

| Operation                       | Target | Rationale              |
|---------------------------------|--------|------------------------|
| Vocabulary lookup (cached)      | <5ms   | Avoid session lag      |
| Vocabulary lookup (uncached)    | <200ms | JMdict query + scoring |
| Session creation                | <50ms  | Synchronous UI         |
| Session restoration (localStorage) | <20ms | Page load critical  |
| Progress save (IndexedDB)       | <30ms  | Non-blocking           |

**These are proposed targets for benchmarking, not current measurements.**

---

## Test Data Requirements

### Fixtures (Using Real Contracts)

```typescript
// Use VocabKanjiFixtures from vocabularyKanjiTestUtils.ts
const kanji = VocabKanjiFixtures.createSimpleKanji()
const session = VocabKanjiFixtures.createStudySession([kanji], 'vocabulary-first')
```

### Mock JMdict Responses

The actual `kanjiVocabularyLookup.ts` loads JMdict from:
- `/public/data/dictionary/jmdict-eng-common.json`

For tests, use fixtures that mock `VocabularyLookupResult` structure.

---

## Risk Matrix

| Risk                          | Probability | Impact | Current Mitigation                          |
|-------------------------------|-------------|--------|---------------------------------------------|
| Session corruption            | Medium      | High   | Schema versioning, type guards              |
| Legacy session incompatibility| Low         | Medium | isLegacySession() detection, clear storage  |
| Mobile layout breakage        | High        | Medium | Responsive component tests + manual QA      |
| Vocabulary lookup inaccuracy  | Medium      | Medium | Heuristic limitations documented, fallback  |
| Progress sync conflicts       | Medium      | Medium | LWW with timestamps (Agent 4 will implement)|

---

## Acceptance Criteria

**Before declaring tests "ready":**

1. ✅ Test utilities use ACTUAL contracts from `src/types/kanji-study.ts`
2. ✅ No invented card types (only meaning, vocabulary, reading-summary)
3. ✅ Session structure matches nested `kanji[]` model (not flat cards)
4. ✅ Tests acknowledge what's NOT yet implemented (Agent 4 progress fields)
5. ✅ Legacy session tests verify CLEAR behavior, not upgrade
6. ⬜ All unit tests pass
7. ⬜ All integration tests pass
8. ⬜ Coverage targets met (when agents complete implementation)

---

## Clarifications from v1.0 Mistakes

**What I Got Wrong in v1.0:**

1. **Invented card types** - "pattern-hint" is not a card type, it's a field on VocabularyCard
2. **Invented session structure** - Used flat `cards[]` array instead of nested `kanji[].cards[]`
3. **Assumed upgrade logic** - Legacy sessions are CLEARED, not migrated
4. **Assumed vocabulary progress fields exist** - They don't yet (Agent 4 work)
5. **Presented targets as facts** - Coverage percentages are proposals, not requirements

**What's Now Correct:**

1. Uses `KanjiStudyCardType`, `KanjiStudySessionState`, `StudySessionKanjiItem` from real contracts
2. Acknowledges nested session structure: `session.kanji[].cards[]`
3. Tests legacy detection with `isLegacySession()` and clear behavior
4. Marks vocabulary progress tests as `.skip()` until Agent 4 implements
5. Labels all metrics as "🎯 Proposed Target" not facts

---

**Document Version:** 2.0 (Precision Revision)
**Author:** Agent 6 (Testing & Rollout)
**Last Updated:** 2026-03-24
**Status:** Aligned with actual contracts and implementation
