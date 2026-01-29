/**
 * Kanji Adapter for Blast Mode
 * Transforms Kanji data into BlastItem format
 */

import { BlastItem } from '../types'
import { kanjiService } from '@/services/kanjiService'
import { JLPTLevel, Kanji } from '@/types/kanji'

export interface KanjiAdapterConfig {
  level: JLPTLevel
  count: number
  selection?: 'random' | 'sequential'
}

/**
 * Load kanji and transform to BlastItem format
 */
export async function loadKanjiItems(config: KanjiAdapterConfig): Promise<BlastItem[]> {
  const { level, count, selection = 'random' } = config

  // Load kanji from service
  const allKanji = await kanjiService.loadKanjiByLevel(level)

  // Select kanji
  let selectedKanji: Kanji[]
  if (selection === 'random') {
    selectedKanji = shuffleArray(allKanji).slice(0, count)
  } else {
    selectedKanji = allKanji.slice(0, count)
  }

  // Transform to BlastItem
  return selectedKanji.map(kanjiToBlastItem)
}

/**
 * Transform a single Kanji to BlastItem
 */
export function kanjiToBlastItem(kanji: Kanji): BlastItem {
  // Combine all readings for "other" category
  const allReadings = [...kanji.onyomi, ...kanji.kunyomi]

  return {
    id: `kanji-${kanji.kanji}`,
    contentType: 'kanji',
    kanji: kanji.kanji,
    kana: kanji.kunyomi[0] || kanji.onyomi[0], // Fallback reading
    meaningEn: kanji.meaning,
    readings: {
      onyomi: kanji.onyomi.length > 0 ? kanji.onyomi : undefined,
      kunyomi: kanji.kunyomi.length > 0 ? kanji.kunyomi : undefined,
      other: allReadings.length > 2 ? allReadings.slice(2) : undefined
    },
    tokens: undefined, // Let Agent C's tile-splitter handle this deterministically
    sourceTags: [
      kanji.jlpt,
      ...(kanji.grade ? [`grade-${kanji.grade}`] : [])
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
