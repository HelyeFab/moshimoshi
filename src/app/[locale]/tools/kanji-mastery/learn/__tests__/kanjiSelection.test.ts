import { selectKanjiMixed, type KanjiPoolItem } from '../kanjiSelection'
import type { KanjiProgressRecord } from '@/lib/kanji-mastery/kanjiMasteryDB'

const makeKanji = (kanji: string, jlpt: 'N5' | 'N4'): KanjiPoolItem => ({
  kanji,
  meaning: kanji,
  meanings: [kanji],
  onyomi: [],
  kunyomi: [],
  jlpt,
  strokeCount: 1,
})

const makeProgress = (
  kanjiId: string,
  level: string,
  nextReviewDate: string,
  lastAccuracy: number,
  status: 'learning' | 'mastered'
): KanjiProgressRecord => ({
  userId: 'user',
  kanjiId,
  character: kanjiId,
  level,
  lastReviewed: new Date().toISOString(),
  nextReviewDate,
  reviewCount: 1,
  averageScore: lastAccuracy,
  lastScore: lastAccuracy,
  lastAccuracy,
  rounds: {
    round1: true,
    round2Accuracy: lastAccuracy,
    round3Rating: 3,
  },
  srsData: {
    interval: 1,
    lastReviewedAt: new Date().toISOString(),
    nextReviewAt: nextReviewDate,
    status,
    reviewCount: 1,
    correctCount: 1,
    streak: 1,
    bestStreak: 1,
    algorithm: 'sm2',
    difficulty: 5,
  },
})

describe('selectKanjiMixed', () => {
  it('prioritizes due items and avoids recent weak/new when possible', () => {
    const allKanji = [
      makeKanji('k1', 'N5'),
      makeKanji('k2', 'N5'),
      makeKanji('k3', 'N5'),
      makeKanji('k4', 'N5'),
      makeKanji('k5', 'N5'),
      makeKanji('k6', 'N4'),
      makeKanji('k7', 'N4'),
      makeKanji('k8', 'N4'),
      makeKanji('k9', 'N4'),
      makeKanji('k10', 'N4'),
    ]

    const now = new Date('2025-01-01T00:00:00.000Z')
    const past = new Date('2024-12-01T00:00:00.000Z').toISOString()
    const future = new Date('2025-12-01T00:00:00.000Z').toISOString()

    const progressRecords: KanjiProgressRecord[] = [
      makeProgress('k1', 'N5', past, 0.4, 'learning'),
      makeProgress('k2', 'N5', past, 0.4, 'learning'),
      makeProgress('k3', 'N5', past, 0.4, 'learning'),
      makeProgress('k6', 'N4', past, 0.4, 'learning'),
      makeProgress('k4', 'N5', future, 0.2, 'learning'),
      makeProgress('k7', 'N4', future, 0.2, 'learning'),
      makeProgress('k8', 'N4', future, 0.2, 'learning'),
    ]

    const recentSessionIds = new Set(['k4', 'k5'])

    const selected = selectKanjiMixed(allKanji, {
      requestedSize: 8,
      progressRecords,
      recentSessionIds,
      now,
      rng: () => 0.1,
    })

    const selectedIds = selected.map(item => item.kanji)

    expect(selectedIds).toEqual(expect.arrayContaining(['k1', 'k2', 'k3', 'k6']))
    expect(selectedIds).not.toContain('k4')
    expect(selectedIds).not.toContain('k5')
  })

  it('draws new items from the lowest unmastered level', () => {
    const allKanji = [
      makeKanji('n5-1', 'N5'),
      makeKanji('n5-2', 'N5'),
      makeKanji('n4-1', 'N4'),
      makeKanji('n4-2', 'N4'),
      makeKanji('n4-3', 'N4'),
    ]

    const now = new Date('2025-01-01T00:00:00.000Z')
    const future = new Date('2025-12-01T00:00:00.000Z').toISOString()

    const progressRecords: KanjiProgressRecord[] = [
      makeProgress('n5-1', 'N5', future, 0.9, 'learning'),
      makeProgress('n4-1', 'N4', future, 0.9, 'learning'),
      makeProgress('n4-2', 'N4', future, 0.9, 'learning'),
    ]

    const selected = selectKanjiMixed(allKanji, {
      requestedSize: 5,
      progressRecords,
      now,
      rng: () => 0.2,
    })

    const selectedIds = selected.map(item => item.kanji)
    expect(selectedIds).toContain('n5-2')
  })
})
