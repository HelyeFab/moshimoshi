export type JLPTLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'

export interface KanjiExample {
  word: string
  reading: string
  meaning: string
}

// Unified Kanji interface - this is the standard structure we'll use everywhere
export interface Kanji {
  // Primary identifiers
  kanji: string           // The kanji character

  // Meanings
  meaning: string         // Primary meaning
  meanings: string[]      // All meanings (includes primary)

  // Readings
  onyomi: string[]        // On'yomi readings (Chinese origin)
  kunyomi: string[]       // Kun'yomi readings (Japanese origin)

  // Metadata
  jlpt: JLPTLevel        // JLPT level
  strokeCount: number     // Number of strokes
  grade?: number          // School grade level (1-6 for kyōiku, 7 for jōyō)
  frequency?: number      // Frequency rank in newspapers

  // Learning aids
  examples: KanjiExample[] // Example words using this kanji
  radicals?: string[]     // Component radicals
  components?: string[]   // Component parts
}

export interface KanjiByLevel {
  N5?: Kanji[]
  N4?: Kanji[]
  N3?: Kanji[]
  N2?: Kanji[]
  N1?: Kanji[]
}

export interface SavedKanji {
  kanji: Kanji
  savedAt: Date
  listIds?: string[]
}