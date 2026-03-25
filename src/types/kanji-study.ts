/**
 * Kanji Study Card Types
 * Types for vocabulary-first kanji study mode
 */

export type KanjiStudyCardType = 'meaning' | 'vocabulary' | 'reading-summary' | 'reading-match'

/**
 * Base card interface - all study cards extend this
 */
export interface BaseStudyCard {
  id: string
  type: KanjiStudyCardType
  kanjiCharacter: string
}

/**
 * Meaning introduction card
 * Shows the kanji meaning(s) before diving into vocabulary
 */
export interface MeaningCard extends BaseStudyCard {
  type: 'meaning'
  primaryMeaning: string
  allMeanings: string[]
  strokeCount?: number
  jlptLevel?: string
}

/**
 * Vocabulary card - teaches one reading through a real word
 */
export interface VocabularyCard extends BaseStudyCard {
  type: 'vocabulary'
  word: string // The Japanese word (in kanji/kana)
  wordReading: string // Full word reading in hiragana
  wordMeaning: string // English meaning
  targetReading: string // The specific reading this card teaches (hiragana)
  readingType: 'onyomi' | 'kunyomi'
  isCommonWord: boolean // From JMdict common flag/priority tags
  wordTags?: string[] // JMdict tags like news1, ichi1, etc
  source?: 'curated' | 'jmdict' | 'fallback'
  patternHint?: string // Optional hint about the reading pattern
}

/**
 * Reading summary card - shows all readings after vocabulary exposure
 */
export interface ReadingSummaryCard extends BaseStudyCard {
  type: 'reading-summary'
  onyomi: string[] // All on'yomi readings
  kunyomi: string[] // All kun'yomi readings
  primaryReading: string | null // Most common reading
  readingsWithExamples: ReadingExample[] // Readings that had vocabulary cards
}

export interface ReadingExample {
  reading: string
  readingType: 'onyomi' | 'kunyomi'
  exampleWord: string
  exampleReading: string
  exampleMeaning: string
}

export interface ReadingMatchPair {
  word: string
  reading: string
  readingType: 'onyomi' | 'kunyomi'
}

export interface ReadingMatchCard extends BaseStudyCard {
  type: 'reading-match'
  pairs: ReadingMatchPair[]
}

/**
 * Union type for all study cards
 */
export type KanjiStudyCard = MeaningCard | VocabularyCard | ReadingSummaryCard | ReadingMatchCard

/**
 * Complete study sequence for one kanji
 */
export interface KanjiStudySequence {
  kanjiCharacter: string
  cards: KanjiStudyCard[]
  totalCards: number
  vocabularyCardCount: number
  createdAt: number
  source: 'jmdict' | 'fallback' | 'mixed' | 'curated' // Where vocabulary cards originated
}

/**
 * Study session containing multiple kanji sequences (Agent 1's model)
 * @deprecated Use KanjiStudySessionState for actual persistence
 */
export interface VocabularyFirstStudySession {
  sessionId: string
  sequences: KanjiStudySequence[]
  currentSequenceIndex: number
  currentCardIndex: number
  startedAt: number
  lastUpdatedAt: number
  completedSequences: string[] // Array of completed kanji characters
  mode: 'vocabulary-first'
}

// ============================================================================
// Session Persistence Architecture (Agent 2)
// ============================================================================

import type { Kanji } from './kanji'

/**
 * Study mode variants
 * - traditional: Classic mode with kanji character, meaning, and all readings at once
 * - vocabulary-first: Progressive mode showing meaning → vocabulary examples → reading summary
 */
export type StudyMode = 'traditional' | 'vocabulary-first'

/**
 * Study session source
 */
export type StudySessionSource = 'manual-selection' | 'collection'

/**
 * Kanji item within a study session
 * Represents one kanji and its sequence of study cards
 */
export interface StudySessionKanjiItem {
  kanjiId: string // The kanji character (e.g., "日")
  kanjiData: Kanji // Full kanji object (stored for deterministic restore)
  cards: KanjiStudyCard[] // Ordered sequence of cards for this kanji
  currentCardIndex: number // Current position within this kanji's cards (0-based)
  completed: boolean // Whether all cards for this kanji have been viewed
}

/**
 * Kanji study session state (persisted to localStorage)
 *
 * This schema is versioned to support future migrations.
 * Version 1 introduces card-level granularity and vocabulary-first support.
 */
export interface KanjiStudySessionState {
  /**
   * Schema version for migration handling
   * - Version 1: Card-level sessions with vocabulary-first support
   * - Unversioned (legacy): Single kanji-level sessions (auto-cleared on detection)
   */
  version: 1

  /**
   * Study mode for this session
   */
  mode: StudyMode

  /**
   * Ordered array of kanji to study
   */
  kanji: StudySessionKanjiItem[]

  /**
   * Current kanji index in the overall session (0-based)
   */
  currentKanjiIndex: number

  /**
   * Session metadata
   */
  startedAt: number // Unix timestamp
  source: StudySessionSource

  /**
   * Session completion tracking
   */
  totalCards: number // Total number of cards across all kanji
  completedCards: number // Number of cards completed so far

  /**
   * Session-local de-duplication for vocabulary exposure tracking.
   * Each vocabulary card should only count once per study session,
   * even if the user navigates back and forward repeatedly.
   */
  trackedVocabularyCardIds: string[]
}

/**
 * Legacy session state (pre-card architecture)
 * Used only for detecting and migrating old sessions
 */
export interface LegacyStudySessionState {
  items: Kanji[]
  currentIndex: number
  startedAt: number
  source: StudySessionSource
  // No version field indicates legacy
}

/**
 * Type guard to check if a session is legacy (should be cleared)
 */
export function isLegacySession(session: any): session is LegacyStudySessionState {
  return (
    session &&
    typeof session === 'object' &&
    !('version' in session) &&
    'items' in session &&
    Array.isArray(session.items) &&
    'currentIndex' in session &&
    typeof session.currentIndex === 'number'
  )
}

/**
 * Type guard to check if a session is current version
 */
export function isCurrentSession(session: any): session is KanjiStudySessionState {
  return (
    session &&
    typeof session === 'object' &&
    session.version === 1 &&
    'kanji' in session &&
    Array.isArray(session.kanji) &&
    'currentKanjiIndex' in session
  )
}

/**
 * Helper to create an empty session
 */
export function createEmptySession(
  mode: StudyMode,
  source: StudySessionSource
): KanjiStudySessionState {
  return {
    version: 1,
    mode,
    kanji: [],
    currentKanjiIndex: 0,
    startedAt: Date.now(),
    source,
    totalCards: 0,
    completedCards: 0,
    trackedVocabularyCardIds: [],
  }
}

/**
 * Helper to get current position in session
 */
export interface SessionPosition {
  kanjiIndex: number
  cardIndex: number
  kanjiId: string
  currentCard: KanjiStudyCard | null
  currentKanjiData: Kanji | null
  isLastCard: boolean
  isLastKanji: boolean
  isSessionComplete: boolean
}

/**
 * Get detailed position information for current session state
 */
export function getSessionPosition(session: KanjiStudySessionState): SessionPosition {
  const currentKanji = session.kanji[session.currentKanjiIndex]

  if (!currentKanji) {
    return {
      kanjiIndex: session.currentKanjiIndex,
      cardIndex: 0,
      kanjiId: '',
      currentCard: null,
      currentKanjiData: null,
      isLastCard: true,
      isLastKanji: true,
      isSessionComplete: true,
    }
  }

  const currentCard = currentKanji.cards[currentKanji.currentCardIndex] || null
  const isLastCard = currentKanji.currentCardIndex >= currentKanji.cards.length - 1
  const isLastKanji = session.currentKanjiIndex >= session.kanji.length - 1
  const isSessionComplete = isLastKanji && isLastCard

  return {
    kanjiIndex: session.currentKanjiIndex,
    cardIndex: currentKanji.currentCardIndex,
    kanjiId: currentKanji.kanjiId,
    currentCard,
    currentKanjiData: currentKanji.kanjiData,
    isLastCard,
    isLastKanji,
    isSessionComplete,
  }
}

/**
 * Helper to advance to next card in session
 * Returns updated session state
 */
export function advanceToNextCard(session: KanjiStudySessionState): KanjiStudySessionState {
  const currentKanji = session.kanji[session.currentKanjiIndex]

  if (!currentKanji) {
    return session // No change if no current kanji
  }

  // Clone to avoid mutation
  const updatedSession = { ...session }
  const updatedKanji = [...session.kanji]
  const updatedCurrentKanji = { ...currentKanji }

  // Mark current card as viewed
  updatedSession.completedCards = session.completedCards + 1

  // Check if we're at the last card of this kanji
  if (updatedCurrentKanji.currentCardIndex >= updatedCurrentKanji.cards.length - 1) {
    // Mark kanji as completed
    updatedCurrentKanji.completed = true
    updatedKanji[session.currentKanjiIndex] = updatedCurrentKanji

    // Move to next kanji if available
    if (session.currentKanjiIndex < session.kanji.length - 1) {
      return {
        ...updatedSession,
        kanji: updatedKanji,
        currentKanjiIndex: session.currentKanjiIndex + 1,
      }
    } else {
      // Session complete
      return {
        ...updatedSession,
        kanji: updatedKanji,
      }
    }
  } else {
    // Move to next card in current kanji
    updatedCurrentKanji.currentCardIndex++
    updatedKanji[session.currentKanjiIndex] = updatedCurrentKanji

    return {
      ...updatedSession,
      kanji: updatedKanji,
    }
  }
}

/**
 * Helper to go back to previous card in session
 * Returns updated session state
 */
export function goToPreviousCard(session: KanjiStudySessionState): KanjiStudySessionState {
  const currentKanji = session.kanji[session.currentKanjiIndex]

  if (!currentKanji) {
    return session
  }

  // Clone to avoid mutation
  const updatedKanji = [...session.kanji]
  const updatedCurrentKanji = { ...currentKanji }

  // If not at first card of current kanji, go back one card
  if (updatedCurrentKanji.currentCardIndex > 0) {
    updatedCurrentKanji.currentCardIndex--
    updatedKanji[session.currentKanjiIndex] = updatedCurrentKanji

    return {
      ...session,
      kanji: updatedKanji,
      completedCards: Math.max(0, session.completedCards - 1),
    }
  }

  // If at first card of current kanji, go to previous kanji's last card
  if (session.currentKanjiIndex > 0) {
    const prevKanji = { ...updatedKanji[session.currentKanjiIndex - 1] }
    prevKanji.currentCardIndex = prevKanji.cards.length - 1
    prevKanji.completed = false
    updatedKanji[session.currentKanjiIndex - 1] = prevKanji
    updatedKanji[session.currentKanjiIndex] = updatedCurrentKanji

    return {
      ...session,
      kanji: updatedKanji,
      currentKanjiIndex: session.currentKanjiIndex - 1,
      completedCards: Math.max(0, session.completedCards - 1),
    }
  }

  // Already at first card of first kanji
  return session
}

/**
 * Vocabulary lookup result for a specific reading
 */
export interface VocabularyLookupResult {
  reading: string
  readingType: 'onyomi' | 'kunyomi'
  words: VocabularyMatch[]
  hasGoodMatch: boolean // True if at least one high-quality match found
}

/**
 * A matched vocabulary word for a kanji reading
 */
export interface VocabularyMatch {
  word: string
  wordReading: string
  meaning: string
  score: number // Composite score for ranking
  isCommon: boolean
  tags: string[]
  wordType?: string // noun, verb, adjective, etc.
  matchQuality: 'excellent' | 'good' | 'fair' | 'poor'
}

/**
 * Criteria for what makes a "good" vocabulary example
 *
 * NOTE: Word type preferences (noun, verb, adjective) are fixed via
 * WORD_TYPE_SCORES in kanjiVocabularyLookup.ts and are not configurable.
 */
export interface VocabularySelectionCriteria {
  maxWordLength: number // Prefer short words (default: 3 kanji)
  requireCommonFlag: boolean // Require common tag or priority
  minScore: number // Minimum composite score to consider
  maxResultsPerReading: number // How many examples to find per reading
}

/**
 * Default criteria for vocabulary selection
 */
export const DEFAULT_VOCABULARY_CRITERIA: VocabularySelectionCriteria = {
  maxWordLength: 3,
  requireCommonFlag: false, // Don't strictly require, but prioritize
  minScore: 50, // Composite score threshold
  maxResultsPerReading: 3, // Find top 3, pick best 1
}
