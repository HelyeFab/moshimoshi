import { kanjiMasteryDB, KANJI_DB_NAME, type KanjiProgressRecord, type KanjiSession, type KanjiStatistics } from '../kanjiMasteryDB'

require('fake-indexeddb/auto')

const resetDb = async () => {
  try {
    if ((kanjiMasteryDB as any).db) {
      ;(kanjiMasteryDB as any).db.close()
    }

    const request = indexedDB.deleteDatabase(KANJI_DB_NAME)
    await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(null)
      request.onerror = () => reject(request.error)
      request.onblocked = () => {
        setTimeout(resolve, 100)
      }
    })
  } catch (error) {
    console.warn('Reset DB error:', error)
  }

  ;(kanjiMasteryDB as any).db = null
  ;(kanjiMasteryDB as any).initPromise = null
}

describe('KanjiMasteryDB', () => {
  beforeEach(async () => {
    await resetDb()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('saves and retrieves progress records', async () => {
    const record: KanjiProgressRecord = {
      userId: 'user',
      kanjiId: '日',
      character: '日',
      level: 'N5',
      lastReviewed: new Date().toISOString(),
      nextReviewDate: new Date().toISOString(),
      reviewCount: 1,
      averageScore: 0.8,
      lastScore: 0.8,
      lastAccuracy: 0.8,
      rounds: {
        round1: true,
        round2Accuracy: 0.8,
        round3Rating: 4
      },
      srsData: {
        interval: 1,
        lastReviewedAt: new Date().toISOString(),
        nextReviewAt: new Date().toISOString(),
        status: 'learning',
        reviewCount: 1,
        correctCount: 1,
        streak: 1,
        bestStreak: 1,
        algorithm: 'fsrs',
        difficulty: 4
      }
    }

    await kanjiMasteryDB.saveProgress(record)
    const fetched = await kanjiMasteryDB.getProgress('user', '日')

    expect(fetched).not.toBeNull()
    expect(fetched?.kanjiId).toBe('日')
    expect(fetched?.srsData?.algorithm).toBe('fsrs')
  })

  it('returns upcoming reviews sorted by due date', async () => {
    const now = Date.now()
    const due = new Date(now - 1000 * 60 * 60).toISOString()
    const later = new Date(now - 1000 * 30).toISOString()
    const future = new Date(now + 1000 * 60 * 60).toISOString()

    const makeProgress = (kanjiId: string, nextReviewDate: string): KanjiProgressRecord => ({
      userId: 'user',
      kanjiId,
      character: kanjiId,
      level: 'N5',
      lastReviewed: new Date().toISOString(),
      nextReviewDate,
      reviewCount: 1,
      averageScore: 0.6,
      lastScore: 0.6,
      rounds: {
        round1: true,
        round2Accuracy: 0.6,
        round3Rating: 3
      }
    })

    await kanjiMasteryDB.saveProgress(makeProgress('a', due))
    await kanjiMasteryDB.saveProgress(makeProgress('b', later))
    await kanjiMasteryDB.saveProgress(makeProgress('c', future))

    const upcoming = await kanjiMasteryDB.getUpcomingReviews('user', 10)
    expect(upcoming.map(item => item.kanjiId)).toEqual(['a', 'b'])
  })

  it('returns sessions ordered by endTime desc', async () => {
    const sessions: KanjiSession[] = [
      {
        sessionId: 's1',
        userId: 'user',
        startTime: '2025-01-01T00:00:00.000Z',
        endTime: '2025-01-01T00:10:00.000Z',
        kanji: [],
        sessionStats: {
          totalKanji: 0,
          perfectKanji: 0,
          reviewAgainCount: 0,
          averageAccuracy: 0,
          timeSpentSeconds: 0
        }
      },
      {
        sessionId: 's2',
        userId: 'user',
        startTime: '2025-01-02T00:00:00.000Z',
        endTime: '2025-01-02T00:10:00.000Z',
        kanji: [],
        sessionStats: {
          totalKanji: 0,
          perfectKanji: 0,
          reviewAgainCount: 0,
          averageAccuracy: 0,
          timeSpentSeconds: 0
        }
      }
    ]

    for (const session of sessions) {
      await kanjiMasteryDB.saveSession(session)
    }

    const result = await kanjiMasteryDB.getSessionsByUser('user')
    expect(result.map(item => item.sessionId)).toEqual(['s2', 's1'])
  })

  it('updates and retrieves statistics', async () => {
    const stats: KanjiStatistics = {
      userId: 'user',
      totalSessions: 3,
      totalKanjiLearned: 25,
      perfectSessions: 1,
      averageAccuracy: 0.7,
      lastSessionDate: new Date().toISOString()
    }

    await kanjiMasteryDB.updateStatistics(stats)
    const fetched = await kanjiMasteryDB.getStatistics('user')

    expect(fetched).not.toBeNull()
    expect(fetched?.totalSessions).toBe(3)
  })
})
