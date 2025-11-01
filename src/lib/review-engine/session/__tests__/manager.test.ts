/**
 * Focused SessionManager tests that exercise the behaviours implemented today.
 * These tests avoid assumptions from the previous auto-generated suite and instead
 * verify the realistic flows we rely on in production (starting sessions, answering,
 * tracking progress, and handling timers/events).
 */

import { SessionManager } from '../manager'
import { SessionError } from '../../core/errors'
import { ReviewEventType } from '../../core/events'
import type { ReviewMode } from '../../core/types'
import { AdapterRegistry, createDefaultAdapterConfigs } from '../../adapters/registry'
import {
  createBulkContent,
  createReviewableContent,
} from '../../__tests__/test-utils/mockFactory'

jest.mock('@/lib/monitoring/logger', () => ({
  reviewLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

const RECOGNITION_MODE: ReviewMode = 'recognition'
const RECALL_MODE: ReviewMode = 'recall'

describe('SessionManager', () => {
  let storageMock: any
  let analyticsMock: any
  let manager: SessionManager

  beforeEach(() => {
    jest.useFakeTimers()

    storageMock = {
      saveSession: jest.fn().mockResolvedValue(undefined),
      updateSession: jest.fn().mockResolvedValue(undefined),
      loadSession: jest.fn(),
      deleteSession: jest.fn(),
      saveStatistics: jest.fn().mockResolvedValue(undefined),
      loadStatistics: jest.fn(),
      getUserSessions: jest.fn(),
      getActiveSession: jest.fn(),
      getSessionSummaries: jest.fn(),
      clearAllSessions: jest.fn(),
      getStorageSize: jest.fn(),
    }

    analyticsMock = {
      trackSessionStart: jest.fn().mockResolvedValue(undefined),
      trackAnswer: jest.fn().mockResolvedValue(undefined),
      trackSessionComplete: jest.fn().mockResolvedValue(undefined),
      trackEvent: jest.fn().mockResolvedValue(undefined),
    }

    manager = new SessionManager(storageMock, analyticsMock)
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
    jest.clearAllMocks()
    AdapterRegistry.reset()
  })

  describe('session lifecycle basics', () => {
    it('starts a new session with initial statistics', async () => {
      const items = createBulkContent(2)

      await manager.startSession({
        userId: 'user-1',
        items,
        mode: RECOGNITION_MODE,
      })

      const session = manager.getSession()
      expect(session).not.toBeNull()
      expect(session?.items).toHaveLength(2)
      expect(session?.status).toBe('active')

      const stats = manager.getStatistics()
      expect(stats).toMatchObject({
        totalItems: 2,
        completedItems: 0,
        correctItems: 0,
        incorrectItems: 0,
      })

      expect(storageMock.saveSession).toHaveBeenCalledTimes(1)
      expect(analyticsMock.trackSessionStart).toHaveBeenCalledTimes(1)
    })

    it('prevents starting a new session while one is active', async () => {
      const items = createBulkContent(1)
      await manager.startSession({
        userId: 'user-1',
        items,
        mode: RECOGNITION_MODE,
      })

      await expect(
        manager.startSession({
          userId: 'user-1',
          items,
          mode: RECOGNITION_MODE,
        }),
      ).rejects.toThrow(SessionError)
    })

    it('presents the current item and emits an event on first access', async () => {
      const items = createBulkContent(1)
      await manager.startSession({
        userId: 'user-1',
        items,
        mode: RECOGNITION_MODE,
      })

      const presented = new Promise(resolve => {
        manager.once(ReviewEventType.ITEM_PRESENTED, resolve)
      })

      const item = manager.getCurrentItem()
      expect(item?.presentedAt).toBeInstanceOf(Date)

      await expect(presented).resolves.toMatchObject({
        type: ReviewEventType.ITEM_PRESENTED,
        data: expect.objectContaining({ index: 0, total: 1 }),
      })
    })
  })

  describe('answering flow', () => {
    beforeEach(async () => {
      const items = [
        createReviewableContent({
          id: 'item-1',
          primaryAnswer: 'correct',
          alternativeAnswers: ['alt'],
        }),
      ]

      await manager.startSession({
        userId: 'user-1',
        items,
        mode: RECALL_MODE,
      })

      manager.getCurrentItem()
    })

    it('records a correct answer and updates statistics', async () => {
      const validation = await manager.submitAnswer('correct', 4)

      expect(validation).toMatchObject({
        correct: true,
        expectedAnswer: 'correct',
      })

      const item = manager.getCurrentItem()
      expect(item?.correct).toBe(true)
      expect(item?.responseTime).toBeGreaterThanOrEqual(0)
      expect(item?.confidence).toBe(4)
      expect(item?.finalScore).toBeGreaterThanOrEqual(100)

      const stats = manager.getStatistics()
      expect(stats).toMatchObject({
        completedItems: 1,
        correctItems: 1,
        incorrectItems: 0,
        accuracy: 100,
      })

      expect(storageMock.updateSession).toHaveBeenCalled()
      expect(analyticsMock.trackAnswer).toHaveBeenCalled()
    })

    it('records an incorrect answer', async () => {
      const validation = await manager.submitAnswer('wrong')

      expect(validation.correct).toBe(false)
      expect(validation.expectedAnswer).toBe('correct')

      const stats = manager.getStatistics()
      expect(stats).toMatchObject({
        completedItems: 1,
        correctItems: 0,
        incorrectItems: 1,
        accuracy: 0,
      })
    })

    it('allows skipping the current item', async () => {
      await manager.submitAnswer('wrong')
      await manager.nextItem() // advance to end

      const items = createBulkContent(2)
      await manager.startSession({
        userId: 'user-1',
        items,
        mode: RECOGNITION_MODE,
      })

      manager.getCurrentItem()
      await manager.skipItem()

      expect(manager.getSession()?.currentIndex).toBe(1)
      expect(manager.getStatistics()?.skippedItems).toBe(1)
    })
  })

  describe('pause and resume', () => {
    beforeEach(async () => {
      const items = createBulkContent(2)
      await manager.startSession({
        userId: 'user-1',
        items,
        mode: RECOGNITION_MODE,
      })
    })

    it('pauses an active session and emits an event', async () => {
      const pauseEvent = new Promise(resolve => {
        manager.once(ReviewEventType.SESSION_PAUSED, resolve)
      })

      await manager.pauseSession()

      expect(manager.getSession()?.status).toBe('paused')
      expect(manager.getSession()?.lastActivityAt).toBeInstanceOf(Date)

      await expect(pauseEvent).resolves.toMatchObject({
        type: ReviewEventType.SESSION_PAUSED,
        data: expect.objectContaining({ currentIndex: 0 }),
      })
    })

    it('resumes a paused session and restarts timers', async () => {
      await manager.pauseSession()

      const resumeEvent = new Promise(resolve => {
        manager.once(ReviewEventType.SESSION_RESUMED, resolve)
      })
      const warningEvent = new Promise(resolve => {
        manager.once(ReviewEventType.TIMEOUT_WARNING, resolve)
      })

      await manager.resumeSession()
      expect(manager.getSession()?.status).toBe('active')

      jest.advanceTimersByTime(5 * 60 * 1000)
      await expect(warningEvent).resolves.toMatchObject({
        type: ReviewEventType.TIMEOUT_WARNING,
      })
      await expect(resumeEvent).resolves.toMatchObject({
        type: ReviewEventType.SESSION_RESUMED,
      })
    })
  })

  describe('progress, statistics, and completion', () => {
    it('tracks difficulty buckets and streaks using real answers', async () => {
      const items = [
        createReviewableContent({
          id: 'easy-1',
          difficulty: 0.2,
          primaryAnswer: 'a',
        }),
        createReviewableContent({
          id: 'medium-1',
          difficulty: 0.5,
          primaryAnswer: 'b',
        }),
        createReviewableContent({
          id: 'hard-1',
          difficulty: 0.9,
          primaryAnswer: 'c',
        }),
      ]

      await manager.startSession({
        userId: 'user-1',
        items,
        mode: RECALL_MODE,
      })

      const answers = ['a', 'b', 'wrong']
      for (let i = 0; i < answers.length; i++) {
        const item = manager.getCurrentItem()
        const answer =
          answers[i] === 'wrong'
            ? 'wrong'
            : item?.content.primaryAnswer ?? answers[i]

        await manager.submitAnswer(answer)
        if (i < answers.length - 1) {
          await manager.nextItem()
        }
      }

      const stats = manager.getStatistics()
      expect(stats?.performanceByDifficulty.easy).toMatchObject({
        correct: 1,
        total: 1,
      })
      expect(stats?.performanceByDifficulty.medium).toMatchObject({
        correct: 1,
        total: 1,
      })
      expect(stats?.performanceByDifficulty.hard).toMatchObject({
        correct: 0,
        total: 1,
      })

      expect(stats?.currentStreak).toBe(0)
      expect(stats?.bestStreak).toBeGreaterThanOrEqual(2)

      await manager.abandonSession()

      const streakEvent = new Promise(resolve => {
        manager.once(ReviewEventType.STREAK_UPDATED, resolve)
      })

      // Create a 5-answer streak to trigger milestone
      const streakItems = createBulkContent(5)
      await manager.startSession({
        userId: 'user-1',
        items: streakItems,
        mode: RECOGNITION_MODE,
      })

      for (let i = 0; i < streakItems.length; i++) {
        const current = manager.getCurrentItem()
        await manager.submitAnswer(current!.content.primaryAnswer)
        if (i < streakItems.length - 1) {
          await manager.nextItem()
        }
      }

      await expect(streakEvent).resolves.toMatchObject({
        type: ReviewEventType.STREAK_UPDATED,
        data: expect.objectContaining({ current: 5 }),
      })
    })

    it('completes a session and clears state', async () => {
      const items = createBulkContent(2)
      await manager.startSession({
        userId: 'user-1',
        items,
        mode: RECOGNITION_MODE,
      })

      for (let i = 0; i < items.length; i++) {
        const current = manager.getCurrentItem()
        await manager.submitAnswer(current!.content.primaryAnswer)
        if (i < items.length - 1) {
          await manager.nextItem()
        }
      }

      const completedEvent = new Promise(resolve => {
        manager.once(ReviewEventType.SESSION_COMPLETED, resolve)
      })

      const stats = await manager.completeSession()
      expect(stats.completedItems).toBe(2)
      expect(manager.getSession()).toBeNull()
      expect(manager.getStatistics()).toBeNull()

      await expect(completedEvent).resolves.toMatchObject({
        type: ReviewEventType.SESSION_COMPLETED,
        data: expect.objectContaining({ statistics: expect.any(Object) }),
      })

      expect(analyticsMock.trackSessionComplete).toHaveBeenCalled()
    })
  })

  describe('hints and adapters', () => {
    it('provides hints via registered adapters and emits an event', async () => {
      AdapterRegistry.initialize(createDefaultAdapterConfigs())

      const items = [
        createReviewableContent({
          id: 'kana-hint',
          contentType: 'kana',
          primaryAnswer: 'a',
        }),
      ]

      await manager.startSession({
        userId: 'user-1',
        items,
        mode: RECOGNITION_MODE,
      })

      manager.getCurrentItem()
      const hintEvent = new Promise(resolve => {
        manager.once(ReviewEventType.ITEM_HINT_USED, resolve)
      })

      const hint = await manager.useHint()
      expect(hint).toEqual(expect.stringMatching(/row|Starts/))
      expect(manager.getSession()?.items[0].hintsUsed).toBe(1)

      await expect(hintEvent).resolves.toMatchObject({
        type: ReviewEventType.ITEM_HINT_USED,
        data: expect.objectContaining({ hintLevel: 1 }),
      })
    })
  })

  describe('error handling', () => {
    it('throws when answering without an active session', async () => {
      await expect(manager.submitAnswer('test')).rejects.toThrow(
        'No active session',
      )
    })
  })
})
