'use client'

import type { Kanji } from '@/types/kanji'
import type { KanjiProgressRecord } from '@/lib/kanji-mastery/kanjiMasteryDB'

export interface KanjiPoolItem extends Kanji {
  kanji: string
}

export interface SelectionOptions {
  requestedSize: number
  progressRecords: KanjiProgressRecord[]
  recentSessionIds?: Set<string>
  now?: Date
  rng?: () => number
}

const DEFAULT_LEVEL_ORDER = ['N5', 'N4', 'N3', 'N2', 'N1']

const shuffleWithRng = <T,>(items: T[], rng: () => number): T[] => {
  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

const getWeaknessScore = (record: KanjiProgressRecord): number => {
  const difficulty = record.srsData?.difficulty ?? 5
  const accuracy = typeof record.lastAccuracy === 'number' ? record.lastAccuracy : (record.averageScore || 0)
  const normalizedDifficulty = Math.max(0, Math.min(1, difficulty / 10))
  return normalizedDifficulty * 0.6 + (1 - Math.max(0, Math.min(1, accuracy))) * 0.4
}

const isDue = (record: KanjiProgressRecord, now: Date): boolean => {
  const nextReview = record.srsData?.nextReviewAt || record.nextReviewDate
  const dueAt = nextReview ? new Date(nextReview).getTime() : now.getTime()
  return dueAt <= now.getTime()
}

const selectFromBucket = (
  items: KanjiPoolItem[],
  selected: KanjiPoolItem[],
  selectedIds: Set<string>,
  limit: number,
  rng: () => number
) => {
  const shuffled = shuffleWithRng(items, rng)
  for (const item of shuffled) {
    if (selected.length >= limit) break
    if (selectedIds.has(item.kanji)) continue
    selected.push(item)
    selectedIds.add(item.kanji)
  }
}

export const selectKanjiSmartly = (
  allKanji: KanjiPoolItem[],
  options: SelectionOptions
): KanjiPoolItem[] => {
  const {
    requestedSize,
    progressRecords,
    recentSessionIds = new Set<string>(),
    now = new Date(),
    rng = Math.random
  } = options

  const maxNew = Math.max(1, Math.floor(requestedSize * 0.6))
  const progressById = new Map(progressRecords.map(record => [record.kanjiId, record]))

  const dueItems: KanjiPoolItem[] = []
  const weakItems: KanjiPoolItem[] = []
  const newItems: KanjiPoolItem[] = []

  for (const kanji of allKanji) {
    const record = progressById.get(kanji.kanji)
    if (!record) {
      newItems.push(kanji)
      continue
    }

    if (isDue(record, now)) {
      dueItems.push(kanji)
      continue
    }

    weakItems.push(kanji)
  }

  weakItems.sort((a, b) => {
    const recordA = progressById.get(a.kanji)
    const recordB = progressById.get(b.kanji)
    return (recordB ? getWeaknessScore(recordB) : 0) - (recordA ? getWeaknessScore(recordA) : 0)
  })

  const selected: KanjiPoolItem[] = []
  const selectedIds = new Set<string>()

  selectFromBucket(dueItems, selected, selectedIds, requestedSize, rng)

  if (selected.length < requestedSize) {
    const weakNonRecent = weakItems.filter(item => !recentSessionIds.has(item.kanji))
    selectFromBucket(weakNonRecent, selected, selectedIds, requestedSize, rng)
  }

  if (selected.length < requestedSize) {
    const remainingSlots = requestedSize - selected.length
    const newCount = Math.min(maxNew, remainingSlots)
    const newNonRecent = newItems.filter(item => !recentSessionIds.has(item.kanji))
    selectFromBucket(newNonRecent, selected, selectedIds, selected.length + newCount, rng)
  }

  if (selected.length < requestedSize) {
    const remaining = allKanji.filter(
      item => !selectedIds.has(item.kanji) && !recentSessionIds.has(item.kanji)
    )
    selectFromBucket(remaining, selected, selectedIds, requestedSize, rng)
  }

  if (selected.length < requestedSize) {
    const remaining = allKanji.filter(item => !selectedIds.has(item.kanji))
    selectFromBucket(remaining, selected, selectedIds, requestedSize, rng)
  }

  return selected.slice(0, requestedSize)
}

const findLowestUnmasteredLevel = (
  allKanji: KanjiPoolItem[],
  progressById: Map<string, KanjiProgressRecord>
): string | null => {
  for (const level of DEFAULT_LEVEL_ORDER) {
    const levelItems = allKanji.filter(item => item.jlpt === level)
    if (levelItems.length === 0) continue

    const hasUnmastered = levelItems.some(item => {
      const record = progressById.get(item.kanji)
      return !record || record.srsData?.status !== 'mastered'
    })

    if (hasUnmastered) {
      return level
    }
  }
  return DEFAULT_LEVEL_ORDER[0] || null
}

export const selectKanjiMixed = (
  allKanji: KanjiPoolItem[],
  options: SelectionOptions
): KanjiPoolItem[] => {
  const {
    requestedSize,
    progressRecords,
    recentSessionIds = new Set<string>(),
    now = new Date(),
    rng = Math.random
  } = options

  const progressById = new Map(progressRecords.map(record => [record.kanjiId, record]))
  const dueItems: KanjiPoolItem[] = []
  const weakItems: Array<{ kanji: KanjiPoolItem; weakness: number }> = []
  const newItems: KanjiPoolItem[] = []

  for (const kanji of allKanji) {
    const record = progressById.get(kanji.kanji)
    if (!record) {
      newItems.push(kanji)
      continue
    }

    if (isDue(record, now)) {
      dueItems.push(kanji)
      continue
    }

    weakItems.push({ kanji, weakness: getWeaknessScore(record) })
  }

  weakItems.sort((a, b) => b.weakness - a.weakness)

  const dueTarget = Math.floor(requestedSize * 0.4)
  const weakTarget = Math.floor(requestedSize * 0.4)
  const newTarget = Math.max(0, requestedSize - dueTarget - weakTarget)

  const selected: KanjiPoolItem[] = []
  const selectedIds = new Set<string>()

  const dueLimited = dueItems.length > requestedSize
    ? shuffleWithRng(dueItems, rng).slice(0, requestedSize)
    : shuffleWithRng(dueItems, rng).slice(0, dueTarget)

  selectFromBucket(dueLimited, selected, selectedIds, requestedSize, rng)

  if (selected.length < requestedSize) {
    const weakCandidates = weakItems
      .map(item => item.kanji)
      .filter(item => !recentSessionIds.has(item.kanji))
    selectFromBucket(weakCandidates, selected, selectedIds, Math.min(requestedSize, dueTarget + weakTarget), rng)
  }

  if (selected.length < requestedSize) {
    const lowestLevel = findLowestUnmasteredLevel(allKanji, progressById)
    const newCandidates = newItems.filter(item =>
      !recentSessionIds.has(item.kanji) && (!lowestLevel || item.jlpt === lowestLevel)
    )
    selectFromBucket(newCandidates, selected, selectedIds, Math.min(requestedSize, dueTarget + weakTarget + newTarget), rng)
  }

  if (selected.length < requestedSize) {
    const remaining = allKanji.filter(
      item => !selectedIds.has(item.kanji) && !recentSessionIds.has(item.kanji)
    )
    selectFromBucket(remaining, selected, selectedIds, requestedSize, rng)
  }

  if (selected.length < requestedSize) {
    const remaining = allKanji.filter(item => !selectedIds.has(item.kanji))
    selectFromBucket(remaining, selected, selectedIds, requestedSize, rng)
  }

  return selected.slice(0, requestedSize)
}
