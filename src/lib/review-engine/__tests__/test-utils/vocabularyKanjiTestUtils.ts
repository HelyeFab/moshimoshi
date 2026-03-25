/**
 * Test Utilities for Vocabulary-First Kanji Feature
 *
 * IMPORTANT: These utilities use the ACTUAL contracts from src/types/kanji-study.ts
 * They do NOT invent new card types or session structures.
 *
 * Usage:
 *   import { VocabKanjiFixtures, VocabKanjiHelpers } from './vocabularyKanjiTestUtils'
 */

import type { Kanji } from '@/types/kanji'
import type {
  KanjiStudyCard,
  MeaningCard,
  VocabularyCard,
  ReadingSummaryCard,
  KanjiStudySequence,
  StudySessionKanjiItem,
  KanjiStudySessionState,
  LegacyStudySessionState,
  ReadingExample,
  VocabularyMatch,
  VocabularyLookupResult,
  StudyMode,
  StudySessionSource,
} from '@/types/kanji-study'

/**
 * Mock factory for creating test fixtures using REAL contracts
 */
export class VocabKanjiFixtures {
  /**
   * Create a simple test kanji with predictable vocabulary
   */
  static createSimpleKanji(overrides?: Partial<Kanji>): Kanji {
    return {
      kanji: '日',
      meaning: 'sun, day',
      meanings: ['sun', 'day'],
      onyomi: ['ニチ', 'ジツ'],
      kunyomi: ['ひ', 'び'],
      jlpt: 'N5',
      strokeCount: 4,
      examples: [],
      radicals: ['日'],
      ...overrides,
    }
  }

  /**
   * Create a complex kanji with many readings
   */
  static createComplexKanji(): Kanji {
    return {
      kanji: '生',
      meaning: 'life, birth',
      meanings: ['life', 'birth', 'raw'],
      onyomi: ['セイ', 'ショウ'],
      kunyomi: ['い.きる', 'う.まれる', 'は.える', 'お.う', 'なま'],
      jlpt: 'N4',
      strokeCount: 5,
      examples: [],
      radicals: ['生'],
    }
  }

  /**
   * Create a rare kanji with no vocabulary examples
   */
  static createRareKanji(): Kanji {
    return {
      kanji: '㐂',
      meaning: 'rejoice',
      meanings: ['rejoice'],
      onyomi: ['キ'],
      kunyomi: ['よろこ.ぶ'],
      jlpt: 'N1',
      strokeCount: 7,
      examples: [],
      radicals: [],
    }
  }

  /**
   * Create a MeaningCard using real contract
   */
  static createMeaningCard(kanji: Kanji): MeaningCard {
    return {
      id: `${kanji.kanji}-meaning`,
      type: 'meaning',
      kanjiCharacter: kanji.kanji,
      primaryMeaning: kanji.meanings[0] || '',
      allMeanings: kanji.meanings,
      strokeCount: kanji.strokeCount,
      jlptLevel: kanji.jlpt,
    }
  }

  /**
   * Create a VocabularyCard using real contract
   */
  static createVocabularyCard(kanji: Kanji, overrides?: Partial<VocabularyCard>): VocabularyCard {
    return {
      id: `${kanji.kanji}-vocab-${Math.random().toString(36).substr(2, 9)}`,
      type: 'vocabulary',
      kanjiCharacter: kanji.kanji,
      word: '今日',
      wordReading: 'きょう',
      wordMeaning: 'today',
      targetReading: 'ひ',
      readingType: 'kunyomi',
      isCommonWord: true,
      wordTags: ['news1'],
      patternHint: 'This reading appears at the end of time-related words',
      ...overrides,
    }
  }

  /**
   * Create a ReadingSummaryCard using real contract
   */
  static createReadingSummaryCard(kanji: Kanji, examples?: ReadingExample[]): ReadingSummaryCard {
    return {
      id: `${kanji.kanji}-summary`,
      type: 'reading-summary',
      kanjiCharacter: kanji.kanji,
      onyomi: kanji.onyomi || [],
      kunyomi: kanji.kunyomi || [],
      primaryReading: kanji.kunyomi?.[0] || kanji.onyomi?.[0] || null,
      readingsWithExamples: examples || [],
    }
  }

  /**
   * Create a full card sequence for vocabulary-first mode
   * Uses REAL contract: KanjiStudySequence
   */
  static createVocabularyFirstSequence(kanji: Kanji): KanjiStudySequence {
    const cards: KanjiStudyCard[] = [
      this.createMeaningCard(kanji),
      this.createVocabularyCard(kanji, {
        word: '今日',
        targetReading: 'ひ',
        readingType: 'kunyomi',
      }),
      this.createVocabularyCard(kanji, {
        word: '日本',
        targetReading: 'に',
        readingType: 'onyomi',
      }),
      this.createReadingSummaryCard(kanji, [
        {
          reading: 'ひ',
          readingType: 'kunyomi',
          exampleWord: '今日',
          exampleReading: 'きょう',
          exampleMeaning: 'today',
        },
        {
          reading: 'に',
          readingType: 'onyomi',
          exampleWord: '日本',
          exampleReading: 'にっぽん',
          exampleMeaning: 'Japan',
        },
      ]),
    ]

    return {
      kanjiCharacter: kanji.kanji,
      cards,
      totalCards: cards.length,
      vocabularyCardCount: cards.filter(c => c.type === 'vocabulary').length,
      createdAt: Date.now(),
      source: 'jmdict',
    }
  }

  /**
   * Create a traditional single-card sequence (current implementation)
   */
  static createTraditionalSequence(kanji: Kanji): KanjiStudySequence {
    const cards: KanjiStudyCard[] = [this.createMeaningCard(kanji)]

    return {
      kanjiCharacter: kanji.kanji,
      cards,
      totalCards: 1,
      vocabularyCardCount: 0,
      createdAt: Date.now(),
      source: 'fallback',
    }
  }

  /**
   * Create StudySessionKanjiItem using real contract
   */
  static createSessionKanjiItem(kanji: Kanji, mode: StudyMode): StudySessionKanjiItem {
    const sequence =
      mode === 'vocabulary-first'
        ? this.createVocabularyFirstSequence(kanji)
        : this.createTraditionalSequence(kanji)

    return {
      kanjiId: kanji.kanji,
      kanjiData: kanji,
      cards: sequence.cards,
      currentCardIndex: 0,
      completed: false,
    }
  }

  /**
   * Create KanjiStudySessionState using real contract
   */
  static createStudySession(
    kanjiList: Kanji[],
    mode: StudyMode = 'vocabulary-first',
    source: StudySessionSource = 'manual-selection'
  ): KanjiStudySessionState {
    const sessionKanji = kanjiList.map(k => this.createSessionKanjiItem(k, mode))
    const totalCards = sessionKanji.reduce((sum, item) => sum + item.cards.length, 0)

    return {
      version: 1,
      mode,
      kanji: sessionKanji,
      currentKanjiIndex: 0,
      startedAt: Date.now(),
      source,
      totalCards,
      completedCards: 0,
    }
  }

  /**
   * Create a legacy session (pre-card architecture) for testing detection
   * ACTUAL BEHAVIOR: Legacy sessions are CLEARED, not upgraded
   */
  static createLegacySession(kanjiList: Kanji[]): LegacyStudySessionState {
    return {
      items: kanjiList,
      currentIndex: 0,
      startedAt: Date.now(),
      source: 'manual-selection',
      // No version field = legacy
    }
  }

  /**
   * Mock VocabularyMatch from kanjiVocabularyLookup.ts
   */
  static createVocabularyMatch(overrides?: Partial<VocabularyMatch>): VocabularyMatch {
    return {
      word: '今日',
      wordReading: 'きょう',
      meaning: 'today',
      score: 350,
      isCommon: true,
      tags: ['news1'],
      wordType: 'noun',
      matchQuality: 'excellent',
      ...overrides,
    }
  }

  /**
   * Mock VocabularyLookupResult from kanjiVocabularyLookup.ts
   */
  static createLookupResult(
    reading: string,
    readingType: 'onyomi' | 'kunyomi',
    matches: VocabularyMatch[] = []
  ): VocabularyLookupResult {
    return {
      reading,
      readingType,
      words: matches,
      hasGoodMatch: matches.length > 0 && matches[0].matchQuality === 'excellent',
    }
  }
}

/**
 * Test helpers for assertions and validation
 */
export class VocabKanjiHelpers {
  /**
   * Validate card sequence structure
   */
  static validateCardSequence(cards: KanjiStudyCard[], expectedKanji: string): boolean {
    if (cards.length === 0) {
      throw new Error('Card sequence is empty')
    }

    // All cards must belong to the same kanji
    for (const card of cards) {
      if (card.kanjiCharacter !== expectedKanji) {
        throw new Error(
          `Card ${card.id} has wrong kanji: ${card.kanjiCharacter}, expected ${expectedKanji}`
        )
      }
    }

    // First card must be meaning
    if (cards[0].type !== 'meaning') {
      throw new Error(`First card must be 'meaning', got '${cards[0].type}'`)
    }

    // Last card should be reading-summary (for vocabulary-first mode)
    const hasVocabCards = cards.some(c => c.type === 'vocabulary')
    if (hasVocabCards && cards[cards.length - 1].type !== 'reading-summary') {
      throw new Error(
        `Expected reading-summary as last card when vocabulary cards present, got '${cards[cards.length - 1].type}'`
      )
    }

    return true
  }

  /**
   * Validate session state structure using real contract
   */
  static validateSessionState(session: KanjiStudySessionState): boolean {
    if (session.version !== 1) {
      throw new Error(`Session version must be 1, got ${session.version}`)
    }

    if (session.kanji.length === 0) {
      throw new Error('Session must have at least one kanji')
    }

    if (session.currentKanjiIndex < 0 || session.currentKanjiIndex >= session.kanji.length) {
      throw new Error(`Invalid currentKanjiIndex: ${session.currentKanjiIndex}`)
    }

    // Validate totalCards matches actual card count
    const actualTotalCards = session.kanji.reduce((sum, item) => sum + item.cards.length, 0)
    if (session.totalCards !== actualTotalCards) {
      throw new Error(
        `Session totalCards (${session.totalCards}) doesn't match actual (${actualTotalCards})`
      )
    }

    // Validate each kanji item
    for (const kanjiItem of session.kanji) {
      if (kanjiItem.cards.length === 0) {
        throw new Error(`Kanji ${kanjiItem.kanjiId} has no cards`)
      }
      if (kanjiItem.currentCardIndex < 0 || kanjiItem.currentCardIndex >= kanjiItem.cards.length) {
        throw new Error(
          `Invalid currentCardIndex for kanji ${kanjiItem.kanjiId}: ${kanjiItem.currentCardIndex}`
        )
      }
    }

    return true
  }

  /**
   * Serialize session for localStorage testing
   */
  static serializeSession(session: KanjiStudySessionState): string {
    return JSON.stringify(session)
  }

  /**
   * Deserialize session from localStorage
   */
  static deserializeSession(data: string): any {
    return JSON.parse(data)
  }

  /**
   * Check if session is complete using real helper functions
   */
  static isSessionComplete(session: KanjiStudySessionState): boolean {
    return session.completedCards >= session.totalCards
  }

  /**
   * Get current card from session using real contract
   */
  static getCurrentCard(session: KanjiStudySessionState): KanjiStudyCard | null {
    const currentKanji = session.kanji[session.currentKanjiIndex]
    if (!currentKanji) return null

    return currentKanji.cards[currentKanji.currentCardIndex] || null
  }

  /**
   * Mock localStorage for testing
   * Returns functions to get/set/clear session
   */
  static mockLocalStorage(userId: string) {
    const storage: Record<string, string> = {}
    const key = `kanji-browser-study-session:${userId}`

    return {
      get: () => (storage[key] ? JSON.parse(storage[key]) : null),
      set: (session: KanjiStudySessionState) => {
        storage[key] = JSON.stringify(session)
      },
      clear: () => {
        delete storage[key]
      },
      exists: () => key in storage,
    }
  }
}

/**
 * Example test usage:
 *
 * ```typescript
 * import { VocabKanjiFixtures, VocabKanjiHelpers } from './vocabularyKanjiTestUtils'
 * import { advanceToNextCard, getSessionPosition } from '@/types/kanji-study'
 *
 * describe('Vocabulary Card Generation', () => {
 *   it('should create vocabulary-first sequence with real contracts', () => {
 *     const kanji = VocabKanjiFixtures.createSimpleKanji()
 *     const sequence = VocabKanjiFixtures.createVocabularyFirstSequence(kanji)
 *
 *     // Validate structure
 *     VocabKanjiHelpers.validateCardSequence(sequence.cards, kanji.kanji)
 *
 *     // Check card types
 *     expect(sequence.cards[0].type).toBe('meaning')
 *     expect(sequence.cards.filter(c => c.type === 'vocabulary').length).toBeGreaterThan(0)
 *     expect(sequence.cards[sequence.cards.length - 1].type).toBe('reading-summary')
 *   })
 *
 *   it('should create valid session state', () => {
 *     const kanji = [VocabKanjiFixtures.createSimpleKanji()]
 *     const session = VocabKanjiFixtures.createStudySession(kanji, 'vocabulary-first')
 *
 *     // Validate using real helpers
 *     VocabKanjiHelpers.validateSessionState(session)
 *
 *     // Use real helper functions
 *     const position = getSessionPosition(session)
 *     expect(position.kanjiId).toBe('日')
 *     expect(position.currentCard?.type).toBe('meaning')
 *   })
 * })
 * ```
 */
