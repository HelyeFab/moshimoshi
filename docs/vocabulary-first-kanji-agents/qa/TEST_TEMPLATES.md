# Vocabulary-First Kanji: Test Templates

**Version:** 1.0
**Date:** 2026-03-24
**Purpose:** Ready-to-use test templates for implementation agents

---

## Template 1: Unit Test for Vocabulary Lookup

**File:** `src/utils/__tests__/vocabularyKanjiLookup.test.ts`

```typescript
/**
 * Unit tests for vocabulary lookup and prioritization
 * Agent 1 deliverable
 */

import { VocabKanjiMockFactory } from '@/lib/review-engine/__tests__/test-utils/vocabularyKanjiTestUtils'
import {
  findVocabularyForReading,
  prioritizeVocabulary,
  generateVocabularyCards,
} from '../vocabularyKanjiLookup' // Adjust import based on actual file

describe('Vocabulary Lookup for Kanji', () => {
  describe('findVocabularyForReading()', () => {
    it('should find vocabulary words for a given kanji+reading', () => {
      const kanji = '日'
      const reading = 'ひ'

      const results = findVocabularyForReading(kanji, reading, {
        maxResults: 5,
        preferCommon: true,
      })

      // Should return JMdict matches
      expect(results).toBeInstanceOf(Array)
      expect(results.length).toBeGreaterThan(0)
      expect(results.length).toBeLessThanOrEqual(5)

      // Each result should have required fields
      results.forEach(result => {
        expect(result).toHaveProperty('word')
        expect(result).toHaveProperty('reading')
        expect(result).toHaveProperty('meaning')
        expect(result.word).toContain(kanji)
      })
    })

    it('should return empty array for readings with no matches', () => {
      const kanji = '㐂'
      const reading = 'よろこ'

      const results = findVocabularyForReading(kanji, reading, {
        maxResults: 5,
      })

      expect(results).toEqual([])
    })

    it('should prioritize common words (news1, ichi1 tags)', () => {
      const kanji = '日'
      const reading = 'ひ'

      const results = findVocabularyForReading(kanji, reading, {
        maxResults: 3,
        preferCommon: true,
      })

      // First result should have high-priority tag
      const firstResult = results[0]
      expect(firstResult.tags).toContain('news1' || 'ichi1')
    })

    it('should filter out overly complex words', () => {
      const kanji = '日'
      const reading = 'ひ'

      const results = findVocabularyForReading(kanji, reading, {
        maxResults: 10,
        maxWordLength: 3, // Limit to 3-char words
      })

      results.forEach(result => {
        expect(result.word.length).toBeLessThanOrEqual(3)
      })
    })
  })

  describe('prioritizeVocabulary()', () => {
    it('should limit to 2 words per reading type', () => {
      const kanji = VocabKanjiMockFactory.createSimpleKanji()

      const prioritized = prioritizeVocabulary(kanji, {
        maxPerReadingType: 2,
      })

      // Should have at most 2 onyomi and 2 kunyomi words
      const onyomiWords = prioritized.filter(v => v.readingType === 'onyomi')
      const kunyomiWords = prioritized.filter(v => v.readingType === 'kunyomi')

      expect(onyomiWords.length).toBeLessThanOrEqual(2)
      expect(kunyomiWords.length).toBeLessThanOrEqual(2)
    })

    it('should include pattern hints', () => {
      const kanji = VocabKanjiMockFactory.createSimpleKanji()

      const prioritized = prioritizeVocabulary(kanji)

      prioritized.forEach(vocab => {
        expect(vocab).toHaveProperty('patternHint')
        expect(typeof vocab.patternHint).toBe('string')
      })
    })
  })

  describe('generateVocabularyCards()', () => {
    it('should create full card sequence for simple kanji', () => {
      const kanji = VocabKanjiMockFactory.createSimpleKanji()

      const cards = generateVocabularyCards(kanji)

      // Should have: meaning + vocabs + summary
      expect(cards.length).toBeGreaterThanOrEqual(3)

      // First card should be meaning
      expect(cards[0].type).toBe('meaning')

      // Last card should be summary
      expect(cards[cards.length - 1].type).toBe('reading-summary')

      // Middle cards should be vocabulary
      const vocabCards = cards.filter(c => c.type === 'vocabulary')
      expect(vocabCards.length).toBeGreaterThan(0)
    })

    it('should handle kanji with no vocabulary gracefully', () => {
      const rareKanji = VocabKanjiMockFactory.createRareKanji()

      const cards = generateVocabularyCards(rareKanji)

      // Should still have meaning + summary (no vocab cards)
      expect(cards.length).toBeGreaterThanOrEqual(2)
      expect(cards[0].type).toBe('meaning')
      expect(cards[cards.length - 1].type).toBe('reading-summary')

      // No vocabulary cards
      const vocabCards = cards.filter(c => c.type === 'vocabulary')
      expect(vocabCards.length).toBe(0)
    })
  })

  describe('Performance', () => {
    it('should generate cards in under 100ms', () => {
      const kanji = VocabKanjiMockFactory.createSimpleKanji()

      const start = performance.now()
      generateVocabularyCards(kanji)
      const duration = performance.now() - start

      expect(duration).toBeLessThan(100)
    })

    it('should cache vocabulary lookups', () => {
      const kanji = VocabKanjiMockFactory.createSimpleKanji()

      // First call (uncached)
      const start1 = performance.now()
      generateVocabularyCards(kanji)
      const duration1 = performance.now() - start1

      // Second call (cached)
      const start2 = performance.now()
      generateVocabularyCards(kanji)
      const duration2 = performance.now() - start2

      // Cached call should be faster
      expect(duration2).toBeLessThan(duration1)
    })
  })
})
```

---

## Template 2: Integration Test for Study Session

**File:** `src/hooks/__tests__/vocabularyFirstSession.integration.test.tsx`

```typescript
/**
 * Integration tests for vocabulary-first study session
 * Agent 2 deliverable
 */

import { renderHook, act } from '@testing-library/react'
import { VocabKanjiMockFactory, VocabKanjiTestHelpers } from '@/lib/review-engine/__tests__/test-utils/vocabularyKanjiTestUtils'
import { useVocabularyFirstSession } from '../useVocabularyFirstSession' // Adjust import

describe('Vocabulary-First Study Session (Integration)', () => {
  let mockUser: any
  let mockIsPremium: boolean

  beforeEach(() => {
    mockUser = { uid: 'test-user-123' }
    mockIsPremium = true
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('Session Initialization', () => {
    it('should create multi-card session from single kanji', () => {
      const kanji = [VocabKanjiMockFactory.createSimpleKanji()]

      const { result } = renderHook(() =>
        useVocabularyFirstSession(kanji, mockUser, mockIsPremium)
      )

      act(() => {
        result.current.startSession()
      })

      const session = result.current.session
      expect(session).not.toBeNull()
      expect(session?.cards.length).toBeGreaterThanOrEqual(3)
      expect(session?.currentCardIndex).toBe(0)
      expect(session?.mode).toBe('vocabulary-first')
    })

    it('should preserve kanji order in card sequence', () => {
      const kanji = [
        VocabKanjiMockFactory.createSimpleKanji({ kanji: '日' }),
        VocabKanjiMockFactory.createSimpleKanji({ kanji: '月' }),
      ]

      const { result } = renderHook(() =>
        useVocabularyFirstSession(kanji, mockUser, mockIsPremium)
      )

      act(() => {
        result.current.startSession()
      })

      const session = result.current.session
      const firstKanjiCards = session?.cards.filter(c => c.parentKanjiId === '日')
      const secondKanjiCards = session?.cards.filter(c => c.parentKanjiId === '月')

      // All "日" cards should come before "月" cards
      const lastDayCardIndex = firstKanjiCards?.[firstKanjiCards.length - 1]?.order || 0
      const firstMonthCardIndex = secondKanjiCards?.[0]?.order || 0

      expect(lastDayCardIndex).toBeLessThan(firstMonthCardIndex)
    })
  })

  describe('Card Navigation', () => {
    it('should advance to next card', () => {
      const kanji = [VocabKanjiMockFactory.createSimpleKanji()]

      const { result } = renderHook(() =>
        useVocabularyFirstSession(kanji, mockUser, mockIsPremium)
      )

      act(() => {
        result.current.startSession()
        result.current.advanceCard()
      })

      expect(result.current.session?.currentCardIndex).toBe(1)
    })

    it('should go back to previous card', () => {
      const kanji = [VocabKanjiMockFactory.createSimpleKanji()]

      const { result } = renderHook(() =>
        useVocabularyFirstSession(kanji, mockUser, mockIsPremium)
      )

      act(() => {
        result.current.startSession()
        result.current.advanceCard() // Index 1
        result.current.advanceCard() // Index 2
        result.current.previousCard() // Back to 1
      })

      expect(result.current.session?.currentCardIndex).toBe(1)
    })

    it('should not go below index 0', () => {
      const kanji = [VocabKanjiMockFactory.createSimpleKanji()]

      const { result } = renderHook(() =>
        useVocabularyFirstSession(kanji, mockUser, mockIsPremium)
      )

      act(() => {
        result.current.startSession()
        result.current.previousCard() // Try to go negative
      })

      expect(result.current.session?.currentCardIndex).toBe(0)
    })

    it('should detect session completion', () => {
      const kanji = [VocabKanjiMockFactory.createSimpleKanji()]

      const { result } = renderHook(() =>
        useVocabularyFirstSession(kanji, mockUser, mockIsPremium)
      )

      act(() => {
        result.current.startSession()
      })

      const totalCards = result.current.session?.cards.length || 0

      act(() => {
        // Advance to last card
        for (let i = 0; i < totalCards - 1; i++) {
          result.current.advanceCard()
        }
      })

      expect(result.current.isComplete).toBe(true)
    })
  })

  describe('Session Persistence', () => {
    it('should save session to localStorage on advance', () => {
      const kanji = [VocabKanjiMockFactory.createSimpleKanji()]

      const { result } = renderHook(() =>
        useVocabularyFirstSession(kanji, mockUser, mockIsPremium)
      )

      act(() => {
        result.current.startSession()
        result.current.advanceCard()
      })

      const storageKey = `kanji-browser-study-session:${mockUser.uid}`
      const savedData = localStorage.getItem(storageKey)

      expect(savedData).not.toBeNull()

      const parsed = JSON.parse(savedData!)
      expect(parsed.currentCardIndex).toBe(1)
      expect(parsed.mode).toBe('vocabulary-first')
    })

    it('should restore session from localStorage', () => {
      const kanji = [VocabKanjiMockFactory.createSimpleKanji()]
      const mockSession = VocabKanjiMockFactory.createVocabularySession(kanji, {
        currentCardIndex: 2,
      })

      const storageKey = `kanji-browser-study-session:${mockUser.uid}`
      localStorage.setItem(storageKey, VocabKanjiTestHelpers.serializeSession(mockSession))

      const { result } = renderHook(() =>
        useVocabularyFirstSession(kanji, mockUser, mockIsPremium)
      )

      act(() => {
        result.current.restoreSession()
      })

      expect(result.current.session?.currentCardIndex).toBe(2)
    })

    it('should clear session on completion', () => {
      const kanji = [VocabKanjiMockFactory.createSimpleKanji()]

      const { result } = renderHook(() =>
        useVocabularyFirstSession(kanji, mockUser, mockIsPremium)
      )

      act(() => {
        result.current.startSession()
      })

      const totalCards = result.current.session?.cards.length || 0

      act(() => {
        // Complete session
        for (let i = 0; i < totalCards; i++) {
          result.current.advanceCard()
        }
        result.current.completeSession()
      })

      const storageKey = `kanji-browser-study-session:${mockUser.uid}`
      expect(localStorage.getItem(storageKey)).toBeNull()
    })
  })

  describe('Backward Compatibility', () => {
    it('should migrate old session format', () => {
      // Old format: no cards array, just items + currentIndex
      const oldSession = {
        items: [VocabKanjiMockFactory.createSimpleKanji()],
        currentIndex: 1,
        startedAt: Date.now(),
        source: 'manual-selection',
      }

      const storageKey = `kanji-browser-study-session:${mockUser.uid}`
      localStorage.setItem(storageKey, JSON.stringify(oldSession))

      const { result } = renderHook(() =>
        useVocabularyFirstSession([], mockUser, mockIsPremium)
      )

      act(() => {
        result.current.restoreSession()
      })

      // Should migrate to new format with cards
      expect(result.current.session?.cards).toBeDefined()
      expect(result.current.session?.mode).toBe('vocabulary-first')
    })
  })
})
```

---

## Template 3: Component Test for Vocabulary Card UI

**File:** `src/components/kanji/__tests__/VocabularyCard.test.tsx`

```typescript
/**
 * Component tests for VocabularyCard
 * Agent 3 deliverable
 */

import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { VocabKanjiMockFactory } from '@/lib/review-engine/__tests__/test-utils/vocabularyKanjiTestUtils'
import VocabularyCard from '../VocabularyCard' // Adjust import

describe('VocabularyCard Component', () => {
  const mockPlayTTS = jest.fn()

  beforeEach(() => {
    mockPlayTTS.mockClear()
  })

  it('should render vocabulary word with furigana', () => {
    const card = VocabKanjiMockFactory.createVocabularyCard({
      word: '今日',
      wordReading: 'きょう',
      furiganaSegments: [
        { text: '今', furigana: 'きょ', isTarget: false },
        { text: '日', furigana: 'う', isTarget: true },
      ],
    })

    render(<VocabularyCard card={card} playTTS={mockPlayTTS} />)

    // Word should be visible
    expect(screen.getByText('今')).toBeInTheDocument()
    expect(screen.getByText('日')).toBeInTheDocument()

    // Furigana should be rendered above kanji
    expect(screen.getByText('きょ')).toBeInTheDocument()
    expect(screen.getByText('う')).toBeInTheDocument()
  })

  it('should highlight target kanji differently', () => {
    const card = VocabKanjiMockFactory.createVocabularyCard({
      word: '今日',
      targetKanji: '日',
    })

    render(<VocabularyCard card={card} playTTS={mockPlayTTS} />)

    const targetElement = screen.getByText('日')
    expect(targetElement).toHaveClass('target-kanji') // Adjust class name
  })

  it('should show pattern hint', () => {
    const card = VocabKanjiMockFactory.createVocabularyCard({
      patternHint: 'This reading appears at the end of words',
    })

    render(<VocabularyCard card={card} playTTS={mockPlayTTS} />)

    expect(
      screen.getByText(/This reading appears at the end of words/i)
    ).toBeInTheDocument()
  })

  it('should play audio on button click', () => {
    const card = VocabKanjiMockFactory.createVocabularyCard({
      word: '今日',
      wordReading: 'きょう',
    })

    render(<VocabularyCard card={card} playTTS={mockPlayTTS} />)

    const audioButton = screen.getByLabelText(/play audio/i)
    fireEvent.click(audioButton)

    expect(mockPlayTTS).toHaveBeenCalledWith('今日', expect.any(Object))
  })

  it('should show meaning', () => {
    const card = VocabKanjiMockFactory.createVocabularyCard({
      wordMeaning: 'today',
    })

    render(<VocabularyCard card={card} playTTS={mockPlayTTS} />)

    expect(screen.getByText(/today/i)).toBeInTheDocument()
  })

  describe('Mobile Responsiveness', () => {
    beforeEach(() => {
      // Mock mobile viewport
      global.innerWidth = 375
      global.innerHeight = 667
    })

    it('should wrap long words on small screens', () => {
      const card = VocabKanjiMockFactory.createVocabularyCard({
        word: '一生懸命', // Long word
      })

      render(<VocabularyCard card={card} playTTS={mockPlayTTS} />)

      const wordContainer = screen.getByTestId('word-display')
      expect(wordContainer).toHaveStyle({ wordBreak: 'break-word' })
    })
  })
})
```

---

## Template 4: Progress Tracking Test

**File:** `src/utils/__tests__/vocabularyKanjiProgress.test.ts`

```typescript
/**
 * Tests for vocabulary card progress tracking
 * Agent 4 deliverable
 */

import { VocabKanjiTestHelpers } from '@/lib/review-engine/__tests__/test-utils/vocabularyKanjiTestUtils'
import { kanjiProgressManager } from '../kanjiProgressManager'
import { ProgressEvent } from '@/lib/review-engine/core/progress.types'

describe('Vocabulary Card Progress Tracking', () => {
  let mockUser: any
  let mockIsPremium: boolean

  beforeEach(() => {
    mockUser = { uid: 'test-user-123' }
    mockIsPremium = true
  })

  describe('Vocabulary View Tracking', () => {
    it('should increment vocabularySeenCount on vocab card view', async () => {
      const kanjiId = '日'

      // Initial state
      let progress = await kanjiProgressManager.getKanjiProgressItem(
        kanjiId,
        mockUser,
        mockIsPremium
      )
      const initialVocabCount = progress?.vocabularySeenCount || 0

      // Track vocabulary view
      await kanjiProgressManager.trackProgress(
        'kanji',
        kanjiId,
        ProgressEvent.VOCABULARY_VIEWED,
        mockUser,
        mockIsPremium
      )

      // Check updated count
      progress = await kanjiProgressManager.getKanjiProgressItem(
        kanjiId,
        mockUser,
        mockIsPremium
      )

      expect(progress?.vocabularySeenCount).toBe(initialVocabCount + 1)
    })

    it('should NOT increment viewCount for vocabulary views', async () => {
      const kanjiId = '日'

      // Initial view count
      let progress = await kanjiProgressManager.getKanjiProgressItem(
        kanjiId,
        mockUser,
        mockIsPremium
      )
      const initialViewCount = progress?.viewCount || 0

      // Track vocabulary view
      await kanjiProgressManager.trackProgress(
        'kanji',
        kanjiId,
        ProgressEvent.VOCABULARY_VIEWED,
        mockUser,
        mockIsPremium
      )

      progress = await kanjiProgressManager.getKanjiProgressItem(
        kanjiId,
        mockUser,
        mockIsPremium
      )

      // viewCount should be unchanged
      expect(progress?.viewCount).toBe(initialViewCount)
    })
  })

  describe('Reading Exposure Tracking', () => {
    it('should track exposed readings', async () => {
      const kanjiId = '日'
      const reading = 'ひ'

      await kanjiProgressManager.trackReadingExposure(
        kanjiId,
        reading,
        mockUser,
        mockIsPremium
      )

      const progress = await kanjiProgressManager.getKanjiProgressItem(
        kanjiId,
        mockUser,
        mockIsPremium
      )

      expect(progress?.readingsExposed).toContain(reading)
    })

    it('should accumulate multiple readings', async () => {
      const kanjiId = '日'

      await kanjiProgressManager.trackReadingExposure(
        kanjiId,
        'ひ',
        mockUser,
        mockIsPremium
      )
      await kanjiProgressManager.trackReadingExposure(
        kanjiId,
        'にち',
        mockUser,
        mockIsPremium
      )

      const progress = await kanjiProgressManager.getKanjiProgressItem(
        kanjiId,
        mockUser,
        mockIsPremium
      )

      expect(progress?.readingsExposed?.size).toBe(2)
      expect(progress?.readingsExposed).toContain('ひ')
      expect(progress?.readingsExposed).toContain('にち')
    })
  })

  describe('Schema Migration', () => {
    it('should add vocabulary fields to existing progress', async () => {
      const kanjiId = '日'

      // Create old-style progress (no vocab fields)
      const oldProgress = {
        contentId: kanjiId,
        contentType: 'kanji',
        status: 'learning',
        viewCount: 5,
        // NO vocabularySeenCount or readingsExposed
      }

      // Simulate loading old progress
      await kanjiProgressManager.saveProgress(
        mockUser.uid,
        'kanji',
        kanjiId,
        oldProgress as any,
        mockIsPremium
      )

      // Trigger migration (happens on next read/write)
      const progress = await kanjiProgressManager.getKanjiProgressItem(
        kanjiId,
        mockUser,
        mockIsPremium
      )

      // Should have new fields with defaults
      expect(progress?.vocabularySeenCount).toBe(0)
      expect(progress?.readingsExposed).toEqual(new Set())
    })
  })
})
```

---

## Usage Instructions for Implementation Agents

### Step 1: Copy Template
1. Choose the template that matches your agent's responsibility
2. Copy to appropriate `__tests__/` directory
3. Rename file to match implementation file

### Step 2: Customize Tests
1. Update import paths to match actual implementation
2. Adjust test cases based on actual API surface
3. Add edge cases specific to your implementation

### Step 3: Run Tests
```bash
# Run single test file
npm test -- vocabularyKanjiLookup.test.ts

# Run all vocabulary-first tests
npm test -- vocabulary

# Run with coverage
npm test -- --coverage vocabularyKanjiLookup.test.ts
```

### Step 4: Achieve Coverage Targets
- Unit tests: 85%+
- Integration tests: 90%+ for critical paths
- Component tests: 80%+

---

**Document Version:** 1.0
**Author:** Agent 6 (Testing & Rollout)
**Last Updated:** 2026-03-24
