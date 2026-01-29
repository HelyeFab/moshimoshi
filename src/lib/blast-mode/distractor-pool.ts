/**
 * Build a DistractorPool using local datasets (JMdict, Kanji)
 */

import type { BlastItem } from './types'
import type { DistractorPool } from './distractors'
import type { JLPTLevel } from '@/types/kanji'
import type { JapaneseWord } from '@/types/vocabulary'
import type { ListItem } from '@/types/userLists'
import { getCommonJMdictWords } from '@/utils/jmdictLocalSearch'
import { kanjiService } from '@/services/kanjiService'

interface BuildPoolOptions {
  contentType: string
  level?: JLPTLevel
  size?: number
  items: BlastItem[]
  listItems?: ListItem[]
}

export async function buildDistractorPool(options: BuildPoolOptions): Promise<DistractorPool> {
  const { contentType, level, size = 10, items, listItems = [] } = options
  const pool: DistractorPool = { kanji: [], vocabulary: [], readings: [] }

  const needsKanjiPool = contentType === 'kanji' || contentType === 'mixed' || items.some(i => i.contentType === 'kanji')
  const needsVocabPool = true

  if (needsKanjiPool && level) {
    const kanjiList = await kanjiService.loadKanjiByLevel(level)
    const limit = Math.max(200, size * 20)
    let selectedKanji = kanjiList.slice(0, limit)

    pool.kanji = selectedKanji.map(k => k.kanji)
    pool.readings = selectedKanji.flatMap(k => [
      ...k.onyomi.map(r => ({ reading: r, type: 'onyomi' as const })),
      ...k.kunyomi.map(r => ({ reading: r, type: 'kunyomi' as const }))
    ])

    const kanjiVocabulary = selectedKanji.map(k => ({
      kanji: k.kanji,
      kana: k.kunyomi[0] || k.onyomi[0] || '',
      meaning: k.meaning,
      pos: undefined
    }))
    pool.vocabulary = [...(pool.vocabulary || []), ...kanjiVocabulary]

    // Fallback: if level pool is too small, expand with all JLPT levels
    if (pool.kanji.length < 200) {
      const all = await kanjiService.loadAllKanji()
      const expanded = Object.values(all).flatMap(levelList => levelList || [])
      const extraKanji = expanded.filter(k => !pool.kanji?.includes(k.kanji))

      pool.kanji = [...(pool.kanji || []), ...extraKanji.map(k => k.kanji)]
      pool.readings = [
        ...(pool.readings || []),
        ...extraKanji.flatMap(k => [
          ...k.onyomi.map(r => ({ reading: r, type: 'onyomi' as const })),
          ...k.kunyomi.map(r => ({ reading: r, type: 'kunyomi' as const }))
        ])
      ]
      pool.vocabulary = [
        ...(pool.vocabulary || []),
        ...extraKanji.map(k => ({
          kanji: k.kanji,
          kana: k.kunyomi[0] || k.onyomi[0] || '',
          meaning: k.meaning,
          pos: undefined
        }))
      ]
    }
  }

  if (needsVocabPool) {
    const limit = Math.max(300, size * 25)
    let commonWords: JapaneseWord[] = await getCommonJMdictWords(limit)

    if (level && level.startsWith('N')) {
      const filtered = commonWords.filter(word => word.jlpt === level)
      if (filtered.length > 0) {
        commonWords = filtered
      }
      // Fallback: add unfiltered common words if pool is small
      if (commonWords.length < size * 10) {
        const extra = await getCommonJMdictWords(Math.max(200, size * 25))
        const merged = [...commonWords, ...extra]
        const seen = new Set<string>()
        commonWords = merged.filter(word => {
          const key = `${word.kanji || ''}|${word.kana}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
      }
    }

    pool.vocabulary = commonWords.map(word => ({
      kanji: word.kanji,
      kana: word.kana,
      meaning: word.meaning,
      pos: word.type || word.partsOfSpeech?.[0]
    }))
  }

  if (listItems.length > 0) {
    const listVocabulary = listItems.map(item => ({
      kanji: item.content,
      kana: item.metadata?.reading || item.content,
      meaning: item.metadata?.meaning || 'Unknown',
      pos: undefined
    }))

    pool.vocabulary = [...(pool.vocabulary || []), ...listVocabulary]
  }

  // Merge item-based vocabulary (session-specific)
  if (items.length > 0) {
    const itemVocabulary = items.map(item => ({
      kanji: item.kanji,
      kana: item.kana || '',
      meaning: item.meaningEn,
      pos: undefined
    }))
    pool.vocabulary = [...(pool.vocabulary || []), ...itemVocabulary]
  }

  return pool
}
