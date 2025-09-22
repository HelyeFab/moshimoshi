/**
 * Vocabulary Types
 * Types for Japanese words, verbs, adjectives, and other vocabulary items
 */

export type WordType =
  | 'noun'
  | 'verb'
  | 'i-adjective'
  | 'na-adjective'
  | 'adverb'
  | 'particle'
  | 'counter'
  | 'expression'
  | 'other';

export type VerbType = 'Ichidan' | 'Godan' | 'Irregular';

export type JLPTLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

/**
 * Main Japanese Word Interface
 */
export interface JapaneseWord {
  id: string;
  kanji?: string;           // Kanji representation (optional as some words are kana-only)
  kana: string;             // Hiragana/Katakana reading (required)
  romaji?: string;          // Romanized version
  meaning: string;          // English meaning

  type?: WordType | string; // Word type (can be specific like "Ichidan", "Godan", etc.)
  verbType?: VerbType;      // Specific verb type if applicable

  jlpt?: JLPTLevel;         // JLPT level
  wanikaniLevel?: number;   // WaniKani level if applicable
  frequency?: number;       // Usage frequency ranking

  tags?: string[];          // Additional tags
  notes?: string;           // Additional notes

  // Parts of speech (from dictionaries)
  partsOfSpeech?: string[];

  // Example sentences
  examples?: {
    japanese: string;
    english: string;
    audio?: string;
  }[];
}

/**
 * Vocabulary Word - Extended type for saved vocabulary
 */
export interface VocabularyWord extends JapaneseWord {
  savedAt?: number;         // When user saved this word
  reviewData?: {
    nextReviewDate: number;
    interval: number;
    easeFactor: number;
    reviewCount: number;
    correctCount: number;
    lastReviewedAt?: number;
    mastered: boolean;
  };
  userNotes?: string;       // User's personal notes
  lists?: string[];         // IDs of lists this word belongs to
}

/**
 * Helper function to determine if a word is drillable (verb or adjective)
 */
export function isDrillable(word: JapaneseWord): boolean {
  if (!word.type) return false;

  const drillableTypes = ['verb', 'i-adjective', 'na-adjective', 'Ichidan', 'Godan', 'Irregular'];

  // Check if type matches any drillable type
  if (drillableTypes.includes(word.type)) {
    return true;
  }

  // Also check parts of speech
  if (word.partsOfSpeech) {
    const posLower = word.partsOfSpeech.map(pos => pos.toLowerCase()).join(' ');
    return posLower.includes('verb') ||
           posLower.includes('adjective') ||
           posLower.includes('ichidan') ||
           posLower.includes('godan');
  }

  return false;
}

/**
 * Determine the appropriate list type for a word
 */
export function getRecommendedListType(word: JapaneseWord): 'flashcard' | 'drillable' {
  return isDrillable(word) ? 'drillable' : 'flashcard';
}

/**
 * Check if word contains kanji characters
 */
export function hasKanji(text: string): boolean {
  const kanjiRegex = /[\u4e00-\u9faf\u3400-\u4dbf]/;
  return kanjiRegex.test(text);
}