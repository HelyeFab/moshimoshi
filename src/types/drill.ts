/**
 * Drill Feature Types
 * Clean types for the conjugation drill feature
 *
 * FIXED: Now uses ISO string types for dates and includes versioning
 */

import type { ISODateTimeString } from '@/lib/types/shared/timestamp.types'
import type { Versioned } from '@/lib/types/shared/versioned.types'

// Word Types for Japanese
export type WordType =
  | 'Ichidan'
  | 'Godan'
  | 'Irregular'
  | 'i-adjective'
  | 'na-adjective'
  | 'noun'
  | 'adverb'
  | 'particle'
  | 'other';

// JLPT Levels
export type JLPTLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

// Base Japanese Word Interface
export interface JapaneseWord {
  id: string;
  kanji: string;
  kana: string;
  romaji?: string;
  meaning: string;
  english?: string; // Alternative to meaning
  type: WordType;
  jlpt?: JLPTLevel;
  tags?: string[];
  frequency?: number;
  examples?: string[];
  partsOfSpeech?: string[]; // NEW: Parts of speech for detailed word type detection
}

// Extended Conjugation Forms
export interface ConjugationForms {
  // Basic Forms
  present: string;
  past: string;
  negative: string;
  pastNegative: string;

  // Polite Forms
  polite: string;
  politePast: string;
  politeNegative: string;
  politePastNegative: string;

  // Te Forms
  teForm: string;
  negativeTeForm: string;

  // Stems
  masuStem: string;
  negativeStem: string;

  // Conditional Forms
  provisional: string;
  conditional: string;

  // Volitional
  volitional: string;

  // Potential Forms (for verbs)
  potential?: string;
  potentialNegative?: string;

  // Passive Forms (for verbs)
  passive?: string;
  passiveNegative?: string;

  // Causative Forms (for verbs)
  causative?: string;
  causativeNegative?: string;

  // Imperative Forms (for verbs)
  imperativePlain?: string;
  imperativePolite?: string;

  // Tai Forms (want to do - for verbs)
  taiForm?: string;
  taiFormNegative?: string;

  // Adverbial (for adjectives)
  adverbial?: string;
}

// Drill Question Interface
export interface DrillQuestion {
  id: string;
  word: JapaneseWord;
  targetForm: keyof ConjugationForms;
  stem: string;
  correctAnswer: string;
  options: string[];
  rule?: string;
}

// Drill Session Types
export interface DrillSession extends Versioned {
  id: string;
  userId?: string; // Optional for client-side, required server-side
  questions: DrillQuestion[];
  currentQuestionIndex: number;
  score: number;
  startedAt: ISODateTimeString; // FIXED: Type-safe ISO datetime
  completedAt?: ISODateTimeString; // FIXED: Type-safe ISO datetime
  mode: DrillMode;
  wordTypeFilter: WordTypeFilter;
  version: number; // From Versioned
  updatedAt: ISODateTimeString; // From Versioned
}

export type DrillMode = 'random' | 'lists' | 'srs';  // 'review' → 'srs' for clarity
export type WordTypeFilter = 'all' | 'verbs' | 'adjectives';

// Drill Results
export interface DrillResults {
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  timeSpent: number;
  wordsStudied: string[];
}

// Drill Settings
export interface DrillSettings {
  questionsPerSession: number;
  autoAdvance: boolean;
  showRules: boolean;
  wordTypeFilter: WordTypeFilter;
  drillMode: DrillMode;
  selectedLists?: string[];
  jlptLevels?: JLPTLevel[]; // NEW: Filter by JLPT levels (N5, N4, N3, N2, N1)
  conjugationForms?: string[]; // NEW: Filter specific conjugation forms
}

// Word List for drill selection
export interface WordList {
  id: string;
  name: string;
  description?: string;
  wordIds: string[];
  words?: JapaneseWord[];
  createdAt: ISODateTimeString; // FIXED: Type-safe ISO datetime
  updatedAt: ISODateTimeString; // FIXED: Type-safe ISO datetime
  color?: string;
  isConjugable?: boolean;
}

// API Response types
export interface DrillApiResponse {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
  };
}

export interface WordsApiResponse extends DrillApiResponse {
  data?: {
    words: JapaneseWord[];
    total: number;
  };
}

export interface SessionApiResponse extends DrillApiResponse {
  data?: {
    session: DrillSession;
    usage?: {
      current: number;
      limit: number;
      remaining: number;
    };
  };
}

// Practice Cache types
export interface CachedPracticeWords {
  words: JapaneseWord[];
  timestamp: number;
  expiresAt: number;
}

// ============= SRS (Spaced Repetition System) Types =============

/**
 * SRS status for a word
 */
export type SRSStatus = 'new' | 'learning' | 'review' | 'mastered';

/**
 * Per-conjugation-form accuracy tracking
 */
export interface ConjugationFormAccuracy {
  attempts: number;
  correct: number;
  lastAttempted: ISODateTimeString | null;
  averageTime: number; // milliseconds
}

/**
 * Individual review event in history
 */
export interface ReviewHistoryEntry {
  timestamp: ISODateTimeString;
  targetForm: string;
  correct: boolean;
  responseTime: number;
}

/**
 * Complete SRS data for a single word
 * Tracks everything needed for spaced repetition scheduling
 */
export interface WordSRSEntry extends Versioned {
  // Word identification
  wordId: string; // Format: "${kanji}:${kana}"
  word: {
    kanji: string;
    kana: string;
    meaning: string;
    type: WordType;
    jlpt?: JLPTLevel;
  };

  // Core SRS data (SM-2 algorithm)
  srsData: {
    interval: number;           // Days until next review
    easeFactor: number;         // 1.3 - 2.5
    repetitions: number;        // Consecutive correct answers
    lastReviewedAt: ISODateTimeString | null;
    nextReviewAt: ISODateTimeString;
    status: SRSStatus;
    lapses: number;            // Number of times forgotten
  };

  // Drill-specific tracking
  conjugationAccuracy: Record<string, ConjugationFormAccuracy>; // Per-form tracking
  reviewHistory: ReviewHistoryEntry[]; // Last 10 reviews
  leechScore: number;          // How many times failed (0-10+)

  // Metadata
  firstSeenAt: ISODateTimeString;
  lastReviewedAt: ISODateTimeString | null;
  totalReviews: number;
  version: number; // From Versioned
  updatedAt: ISODateTimeString; // From Versioned
}

/**
 * SRS statistics for the user's drill progress
 */
export interface DrillSRSStats {
  totalWords: number;
  newWords: number;
  learningWords: number;
  reviewWords: number;
  masteredWords: number;
  dueToday: number;
  dueThisWeek: number;
  leechWords: number; // Words with leechScore >= 5
  averageAccuracy: number;
  totalReviews: number;
}

/**
 * Word selection criteria for SRS mode
 */
export interface SRSWordSelectionCriteria {
  userId: string;
  targetCount: number;

  // Distribution ratios
  dueWordRatio: number;      // Default: 0.6 (60%)
  newWordRatio: number;      // Default: 0.3 (30%)
  recentWordRatio: number;   // Default: 0.1 (10%)

  // Filters
  excludeWordIds?: string[];
  includeJLPT?: JLPTLevel[];
  maxLeechScore?: number;    // Optionally exclude leeches
}