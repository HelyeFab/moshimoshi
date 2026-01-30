/**
 * Blast Mode Data Loader
 * Loads items and generates steps based on content type
 */

import { BlastItem, BlastStep, BlastLessonInfo } from './types'
import { loadKanjiItems, kanjiToBlastItem } from './adapters/kanji.adapter'
import { loadVocabItems } from './adapters/vocab.adapter'
import { generateBlastSteps } from './step-generator'
import { listToBlastItems } from './adapters/list.adapter'
import { buildDistractorPool } from './distractor-pool'
import { JLPTLevel } from '@/types/kanji'
import { listManager } from '@/lib/lists/ListManager'
import type { ListItem } from '@/types/userLists'
import { kanjiService } from '@/services/kanjiService'
import { DEFAULT_LESSON_SIZE, getLessonId, getLessonSlice, splitIntoLessons } from './lesson-utils'

/**
 * Shuffle array using Fisher-Yates algorithm
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Load items and generate steps based on content type
 * Uses adapters and step generator to prepare blast mode session data
 */
export async function loadBlastData(
  contentType: string,
  size: number,
  level: string,
  userId: string,
  isPremium: boolean,
  listId?: string,
  selectedKanji?: string[]
): Promise<{ items: BlastItem[], steps: BlastStep[] }> {
  let items: BlastItem[] = []
  let listItems: ListItem[] = []

  try {
    if (contentType === 'kanji') {
      if (selectedKanji && selectedKanji.length > 0) {
        const kanjiMap = await kanjiService.getMultipleKanjiDetails(selectedKanji)
        const selected = selectedKanji
          .map(k => kanjiMap.get(k))
          .filter((k): k is NonNullable<typeof k> => Boolean(k))
        items = selected.map(kanjiToBlastItem)
      } else {
      // Load kanji items
        items = await loadKanjiItems({
          level: level as JLPTLevel,
          count: size,
          selection: 'random'
        })
      }
    } else if (contentType === 'vocabulary') {
      // Load vocabulary items
      items = await loadVocabItems({
        count: size,
        level,
        selection: 'common'
      })
    } else if (contentType === 'mixed') {
      // Load mix of kanji and vocabulary
      const kanjiCount = Math.floor(size / 2)
      const vocabCount = size - kanjiCount

      const kanjiItems = await loadKanjiItems({
        level: level as JLPTLevel,
        count: kanjiCount,
        selection: 'random'
      })

      const vocabItems = await loadVocabItems({
        count: vocabCount,
        level,
        selection: 'common'
      })

      items = [...kanjiItems, ...vocabItems]
      // Shuffle mixed items
      items = shuffleArray(items)
    } else if (contentType === 'list' || contentType === 'sentence') {
      if (!listId) {
        throw new Error('Missing listId for list content type')
      }

      const lists = await listManager.getLists(userId, isPremium)
      const list = lists.find(l => l.id === listId)
      if (!list) {
        throw new Error('List not found')
      }

      if (contentType === 'sentence' && list.type !== 'sentence') {
        throw new Error('List is not a sentence list')
      }

      listItems = list.items
      items = listToBlastItems({ list, count: size })
    }

    const pool = await buildDistractorPool({
      contentType,
      level: level as JLPTLevel,
      size,
      items,
      listItems
    })

    // Generate steps using step generator
    const steps = generateBlastSteps(items, pool)

    return { items, steps }
  } catch (error) {
    console.error('Failed to load blast data:', error)
    throw error
  }
}

/**
 * Load items and generate steps for a specific lesson (Kanji only).
 * Lessons are linear slices of the JLPT kanji list in source order.
 */
export async function loadBlastLessonData(
  level: string,
  lessonIndex: number,
  userId: string,
  lessonSize: number = DEFAULT_LESSON_SIZE
): Promise<{ items: BlastItem[], steps: BlastStep[], lesson: BlastLessonInfo }> {
  try {
    const levelKanji = await kanjiService.loadKanjiByLevel(level as JLPTLevel)
    const kanjiIds = levelKanji.map(k => k.kanji)
    const lessons = splitIntoLessons(kanjiIds, lessonSize)
    const totalLessons = lessons.length
    const safeIndex = Math.min(Math.max(lessonIndex, 0), Math.max(totalLessons - 1, 0))
    const lessonKanji = lessons[safeIndex] || []

    const kanjiMap = await kanjiService.getMultipleKanjiDetails(lessonKanji)
    const selected = lessonKanji
      .map(k => kanjiMap.get(k))
      .filter((k): k is NonNullable<typeof k> => Boolean(k))
    const items = selected.map(kanjiToBlastItem)

    const pool = await buildDistractorPool({
      contentType: 'kanji',
      level: level as JLPTLevel,
      size: items.length,
      items,
      listItems: []
    })

    const steps = generateBlastSteps(items, pool)
    const lesson: BlastLessonInfo = {
      lessonId: getLessonId(userId, level, safeIndex),
      level,
      lessonIndex: safeIndex,
      lessonSize,
      totalLessons,
      kanjiIds: lessonKanji
    }

    return { items, steps, lesson }
  } catch (error) {
    console.error('Failed to load blast lesson data:', error)
    throw error
  }
}
