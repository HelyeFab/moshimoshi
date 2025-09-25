/**
 * Drill Feature Types
 * Clean types for the conjugation drill feature
 */

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
export interface DrillSession {
  id: string;
  userId?: string; // Optional for client-side, required server-side
  questions: DrillQuestion[];
  currentQuestionIndex: number;
  score: number;
  startedAt: string;
  completedAt?: string;
  mode: DrillMode;
  wordTypeFilter: WordTypeFilter;
}

export type DrillMode = 'random' | 'lists' | 'review';
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
}

// Word List for drill selection
export interface WordList {
  id: string;
  name: string;
  description?: string;
  wordIds: string[];
  words?: JapaneseWord[];
  createdAt: string;
  updatedAt: string;
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