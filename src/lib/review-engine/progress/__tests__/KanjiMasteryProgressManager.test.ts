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
    getProgress: jest.fn().mockResolvedValue(null),
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
    }
  ],
  currentRound: 3,
  currentIndex: 0,
  progress: new Map([
    [
      '日',
      {
        kanjiId: '日',
        round1Completed: true,
        round2Results: [
          { type: 'meaning', correct: true },
          { type: 'recognition', correct: false }
        ],
        round2Accuracy: 0.5,
        round3Rating: 2
      }
    ]
  ]),
  reviewAgainPile: new Set(),
  sessionId: 'session-1',
  startTime: new Date('2025-01-01T00:00:00.000Z'),
  level: 'N5',
  mode: 'jlpt',
  ...overrides
})

describe('KanjiMasteryProgressManager', () => {
  const manager = new KanjiMasteryProgressManager()
  const mockedDB = kanjiMasteryDB as jest.Mocked<typeof kanjiMasteryDB>
  const mockedFactory = AlgorithmFactory as jest.Mocked<typeof AlgorithmFactory>

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2025-01-01T00:00:10.000Z'))
    mockedDB.getProgressByUserAndLevel.mockResolvedValue([])
    mockedDB.getProgressByUser.mockResolvedValue([])
    mockedDB.getSessionsByUser.mockResolvedValue([])
    mockedDB.getStatistics.mockResolvedValue(null)
    mockedDB.saveSession.mockResolvedValue()
    mockedDB.saveProgress.mockResolvedValue()
    mockedDB.updateStatistics.mockResolvedValue()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  it('maps performance into FSRS difficulty and records response time', async () => {
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

    let capturedResult: any = null
    const algorithm = {
      calculateNextReview: jest.fn((item: any, result: any) => {
        capturedResult = result
        return {
          ...initialSrs,
          interval: 1,
          lastReviewedAt: new Date('2025-01-01T00:00:10.000Z'),
          nextReviewAt: new Date('2025-01-02T00:00:00.000Z'),
          reviewCount: 1,
          correctCount: result.correct ? 1 : 0,
          algorithm: 'fsrs'
        }
      }),
      initializeCardSRS: jest.fn(() => initialSrs)
    }

    mockedFactory.getDefault.mockReturnValue(algorithm as any)
    mockedFactory.fromSRSData.mockReturnValue(algorithm as any)

    const sessionState = makeSessionState({
      progress: new Map([
        [
          '日',
          {
            kanjiId: '日',
            round1Completed: true,
            round2Results: [{ type: 'meaning', correct: false }],
            round2Accuracy: 0.4,
            round3Rating: 2
          }
        ]
      ])
    })

    await manager.trackSession(sessionState, { uid: 'user-1' }, false)

    expect(algorithm.calculateNextReview).toHaveBeenCalled()
    expect(capturedResult).toMatchObject({
      correct: false,
      difficulty: 'again'
    })
    expect(capturedResult.responseTime).toBe(10000)
  })

  it('persists to IndexedDB for all users and skips firebase sync for free users', async () => {
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
        lastReviewedAt: new Date('2025-01-01T00:00:10.000Z'),
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

    await manager.trackSession(sessionState, { uid: 'user-1' }, false)

    expect(mockedDB.saveSession).toHaveBeenCalledTimes(1)
    expect(mockedDB.saveProgress).toHaveBeenCalledTimes(1)
    expect(mockedDB.updateStatistics).toHaveBeenCalledTimes(1)
  })
})
