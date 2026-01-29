/**
 * Vocabulary Adapter for Blast Mode
 * Transforms JMDict vocabulary data into BlastItem format
 */

import { BlastItem } from '../types'
import { getCommonJMdictWords, searchJMdictWords } from '@/utils/jmdictLocalSearch'
import { JapaneseWord } from '@/types/vocabulary'

export interface VocabAdapterConfig {
  count: number
  level?: string  // JLPT level filter (optional)
  selection?: 'common' | 'random'
}

/**
 * Load vocabulary and transform to BlastItem format
 */
export async function loadVocabItems(config: VocabAdapterConfig): Promise<BlastItem[]> {
  const { count, level, selection = 'common' } = config

  // Load vocabulary from JMDict
  const allWords = await getCommonJMdictWords(count * 5) // Get extra for filtering

  // Filter by JLPT level if specified
  let filteredWords = allWords
  if (level && level.startsWith('N')) {
    filteredWords = allWords.filter(word => word.jlpt === level)

    // If we don't have enough words at this level, fall back to all words
    if (filteredWords.length < count) {
      console.warn(`Not enough vocabulary for ${level}, using all common words`)
      filteredWords = allWords
    }
  }

  // Select words
  let selectedWords: JapaneseWord[]
  if (selection === 'random') {
    selectedWords = shuffleArray(filteredWords).slice(0, count)
  } else {
    selectedWords = filteredWords.slice(0, count)
  }

  // Transform to BlastItem
  return selectedWords.map(vocabToBlastItem)
}

/**
 * Transform a single JapaneseWord to BlastItem
 */
export function vocabToBlastItem(word: JapaneseWord): BlastItem {
  // Determine if this is kanji+kana or kana-only
  const hasKanji = word.kanji && word.kanji !== word.kana

  // Extract meaning
  const meaningEn = word.meaning || 'Unknown'

  return {
    id: `vocab-${word.id}`,
    contentType: 'vocabulary',
    kanji: hasKanji ? word.kanji : undefined,
    kana: word.kana,
    meaningEn,
    readings: undefined, // Vocab typically doesn't have separate onyomi/kunyomi
    tokens: undefined, // Let Agent C's tile-splitter handle this deterministically
    sourceTags: [
      ...(word.jlpt ? [word.jlpt] : []),
      ...(word.type ? [`type-${word.type}`] : [])
    ]
  }
}

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}
