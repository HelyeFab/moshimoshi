import { KanjiMasteryProgressManager } from '../KanjiMasteryProgressManager'
import type { SessionState } from '@/app/[locale]/tools/kanji-mastery/learn/LearnContent'
import type { SRSData } from '@/lib/review-engine/srs'
import { kanjiMasteryDB } from '@/lib/kanji-mastery/kanjiMasteryDB'
import { AlgorithmFactory } from '@/lib/review-engine/srs/algorithm-factory'

jest.mock('@/lib/kanji-mastery/kanjiMasteryDB', () => ({
  kanjiMasteryDB: {
    getProgressByUserAndLevel: jest.fn(),
    getProgressByUser: jest.fn(),
    getSessionsByUser: jest.fn(),
    saveSession: jest.fn(),
    saveProgress: jest.fn(),
    updateStatistics: jest.fn(),
    getStatistics: jest.fn()
  }
}))

jest.mock('@/lib/review-engine/srs/algorithm-factory', () => ({
  AlgorithmFactory: {
    getDefault: jest.fn(),
    fromSRSData: jest.fn()
  }
}))

const makeSessionState = (overrides: Partial<SessionState> = {}): SessionState => ({
  kanji: [
    {
      kanji: '日',
      meaning: 'sun',
      meanings: ['sun'],
      onyomi: ['ニチ'],
      kunyomi: ['ひ'],
      jlpt: 'N5',
      strokeCount: 4,
      examples: []
    },
    {
      kanji: '月',
      meaning: 'moon',
      meanings: ['moon'],
      onyomi: ['ゲツ'],
      kunyomi: ['つき'],
      jlpt: 'N5',
      strokeCount: 4,
      examples: []
    }
  ],
  currentRound: 3,
  currentIndex: 1,
  progress: new Map([
    [
      '日',
      {
        kanjiId: '日',
        round1Completed: true,
        round2Results: [{ type: 'meaning', correct: true }],
        round2Accuracy: 1,
        round3Rating: 5
      }
    ],
    [
      '月',
      {
        kanjiId: '月',
        round1Completed: true,
        round2Results: [{ type: 'meaning', correct: false }],
        round2Accuracy: 0,
        round3Rating: 1
      }
    ]
  ]),
  reviewAgainPile: new Set(['月']),
  sessionId: 'session-2',
  startTime: new Date('2025-01-01T00:00:00.000Z'),
  level: 'N5',
  mode: 'jlpt',
  ...overrides
})

describe('Kanji Mastery session lifecycle', () => {
  const manager = new KanjiMasteryProgressManager()
  const mockedDB = kanjiMasteryDB as jest.Mocked<typeof kanjiMasteryDB>
  const mockedFactory = AlgorithmFactory as jest.Mocked<typeof AlgorithmFactory>

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2025-01-01T00:02:00.000Z'))
    mockedDB.getProgressByUserAndLevel.mockResolvedValue([])
    mockedDB.getProgressByUser.mockResolvedValue([])
    mockedDB.getSessionsByUser.mockResolvedValue([])
    mockedDB.getStatistics.mockResolvedValue(null)
    mockedDB.saveSession.mockResolvedValue()
    mockedDB.saveProgress.mockResolvedValue()
    mockedDB.updateStatistics.mockResolvedValue()
    ;(global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'ok' })
    })
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  it('computes session stats and syncs to firebase for premium users', async () => {
    const initialSrs: SRSData = {
      interval: 0,
      lastReviewedAt: null,
      nextReviewAt: new Date('2025-01-01T00:00:00.000Z'),
      status: 'new',
      reviewCount: 0,
      correctCount: 0,
      streak: 0,
      bestStreak: 0,
      algorithm: 'fsrs'
    }

    const algorithm = {
      calculateNextReview: jest.fn(() => ({
        ...initialSrs,
        interval: 1,
        lastReviewedAt: new Date('2025-01-01T00:02:00.000Z'),
        nextReviewAt: new Date('2025-01-02T00:00:00.000Z'),
        reviewCount: 1,
        correctCount: 1,
        algorithm: 'fsrs'
      })),
      initializeCardSRS: jest.fn(() => initialSrs)
    }

    mockedFactory.getDefault.mockReturnValue(algorithm as any)
    mockedFactory.fromSRSData.mockReturnValue(algorithm as any)

    const sessionState = makeSessionState()
    const session = await manager.trackSession(sessionState, { uid: 'user-1' }, true)

    expect(session.sessionStats.totalKanji).toBe(2)
    expect(session.sessionStats.reviewAgainCount).toBe(1)
    expect(session.sessionStats.averageAccuracy).toBeCloseTo(0.5)
    expect((global as any).fetch).toHaveBeenCalledWith('/api/kanji-mastery/session', expect.any(Object))
  })
})
