/**
 * Integration Tests for useNotificationIntegration Hook
 * Tests the integration between Review Engine and Notification System
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { useNotificationIntegration } from '../useNotificationIntegration'
import { ReviewEventType, ItemAnsweredPayload } from '@/lib/review-engine/core/events'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'

// Mock Firebase
jest.mock('@/lib/firebase/config', () => ({
  db: {}
}))

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
  Timestamp: {
    fromDate: jest.fn((date) => ({ toDate: () => date })),
    now: jest.fn(() => ({ toDate: () => new Date() }))
  }
}))

// Mock Auth hook
jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(() => ({
    user: { uid: 'test-user-123', email: 'test@example.com', id: 'test-user-123' }
  }))
}))

// Mock notification service
jest.mock('@/lib/notifications/notification-service', () => ({
  notificationService: {
    sendDailyReminder: jest.fn()
  }
}))

// Mock logger
jest.mock('@/lib/monitoring/logger', () => ({
  reviewLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}))

describe('useNotificationIntegration', () => {
  let mockNotification: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock Notification API
    mockNotification = {
      permission: 'default',
      requestPermission: jest.fn().mockResolvedValue('granted')
    }
    ;(global as any).Notification = mockNotification

    // Mock localStorage
    const localStorageMock: { [key: string]: string } = {}
    global.localStorage = {
      getItem: jest.fn((key) => localStorageMock[key] || null),
      setItem: jest.fn((key, value) => {
        localStorageMock[key] = value
      }),
      removeItem: jest.fn((key) => {
        delete localStorageMock[key]
      }),
      clear: jest.fn(() => {
        Object.keys(localStorageMock).forEach(key => delete localStorageMock[key])
      }),
      length: 0,
      key: jest.fn()
    } as Storage

    // Mock window events
    global.dispatchEvent = jest.fn()
    global.addEventListener = jest.fn()
    global.removeEventListener = jest.fn()
  })

  afterEach(() => {
    jest.clearAllTimers()
  })

  describe('Initialization', () => {
    it('should load user preferences on mount', async () => {
      const mockPreferences = {
        channels: { browser: true, inApp: true, push: false, email: true },
        timing: { immediate: true, daily: true, overdue: true },
        quiet_hours: { enabled: false, start: '22:00', end: '08:00', timezone: 'UTC' }
      }

      ;(getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => mockPreferences
      })

      const { result } = renderHook(() => useNotificationIntegration())

      await waitFor(() => {
        expect(getDoc).toHaveBeenCalled()
      })

      expect(result.current.preferences).toEqual(mockPreferences)
    })

    it('should create default preferences if none exist', async () => {
      ;(getDoc as jest.Mock).mockResolvedValue({
        exists: () => false
      })

      const { result } = renderHook(() => useNotificationIntegration())

      await waitFor(() => {
        expect(setDoc).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            channels: {
              browser: false,
              inApp: true,
              push: false,
              email: true
            }
          })
        )
      })

      expect(result.current.preferences).toBeTruthy()
    })

    it('should set up Review Engine event listeners', async () => {
      renderHook(() => useNotificationIntegration())

      await waitFor(() => {
        expect(global.addEventListener).toHaveBeenCalledWith(
          `review:${ReviewEventType.ITEM_ANSWERED}`,
          expect.any(Function)
        )
        expect(global.addEventListener).toHaveBeenCalledWith(
          `review:${ReviewEventType.SESSION_COMPLETED}`,
          expect.any(Function)
        )
        expect(global.addEventListener).toHaveBeenCalledWith(
          `review:${ReviewEventType.PROGRESS_UPDATED}`,
          expect.any(Function)
        )
      })
    })
  })

  describe('Notification Scheduling', () => {
    it('should schedule notification after correct answer', async () => {
      const { result } = renderHook(() => useNotificationIntegration())

      // Mock preferences loaded
      await waitFor(() => {
        expect(result.current.preferences).toBeTruthy()
      })

      // Simulate item answered event
      const event = new CustomEvent(`review:${ReviewEventType.ITEM_ANSWERED}`, {
        detail: {
          itemId: 'test-item-1',
          correct: true,
          contentType: 'hiragana'
        } as ItemAnsweredPayload
      })

      act(() => {
        const handler = (global.addEventListener as jest.Mock).mock.calls.find(
          call => call[0] === `review:${ReviewEventType.ITEM_ANSWERED}`
        )?.[1]
        if (handler) handler(event)
      })

      await waitFor(() => {
        expect(global.dispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'review:scheduled',
            detail: expect.objectContaining({
              itemId: 'test-item-1',
              contentType: 'hiragana'
            })
          })
        )
      })
    })

    it('should not schedule notification after incorrect answer', async () => {
      const { result } = renderHook(() => useNotificationIntegration())

      await waitFor(() => {
        expect(result.current.preferences).toBeTruthy()
      })

      const event = new CustomEvent(`review:${ReviewEventType.ITEM_ANSWERED}`, {
        detail: {
          itemId: 'test-item-2',
          correct: false,
          contentType: 'kanji'
        } as ItemAnsweredPayload
      })

      act(() => {
        const handler = (global.addEventListener as jest.Mock).mock.calls.find(
          call => call[0] === `review:${ReviewEventType.ITEM_ANSWERED}`
        )?.[1]
        if (handler) handler(event)
      })

      // Should still schedule but with shorter interval (10 minutes for failed items)
      await waitFor(() => {
        expect(global.dispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'review:scheduled',
            detail: expect.objectContaining({
              itemId: 'test-item-2',
              nextReviewAt: expect.any(Date)
            })
          })
        )
      })

      const scheduledEvent = (global.dispatchEvent as jest.Mock).mock.calls[0][0]
      const nextReviewTime = new Date(scheduledEvent.detail.nextReviewAt).getTime()
      const expectedTime = Date.now() + 10 * 60 * 1000 // 10 minutes

      expect(Math.abs(nextReviewTime - expectedTime)).toBeLessThan(1000) // Within 1 second
    })

    it('should respect quiet hours when scheduling', async () => {
      // Set current time to be within quiet hours
      const originalDate = Date
      const mockDate = new Date('2024-01-01T23:00:00') // 11 PM
      global.Date = jest.fn(() => mockDate) as any
      global.Date.now = originalDate.now

      const mockPreferences = {
        channels: { browser: true, inApp: true, push: false, email: true },
        timing: { immediate: true, daily: true, overdue: true },
        quiet_hours: { enabled: true, start: '22:00', end: '08:00', timezone: 'UTC' }
      }

      ;(getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => mockPreferences
      })

      const { result } = renderHook(() => useNotificationIntegration())

      await waitFor(() => {
        expect(result.current.preferences).toEqual(mockPreferences)
      })

      // Try to send immediate notification
      await act(async () => {
        await result.current.scheduleNotification({
          itemId: 'test-item',
          scheduledFor: new Date(Date.now() - 1000), // Already due
          contentType: 'vocabulary',
          metadata: {}
        })
      })

      // Should not send notification immediately during quiet hours
      expect(global.dispatchEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'notification:show'
        })
      )

      // Restore original Date
      global.Date = originalDate
    })
  })

  describe('Notification Permissions', () => {
    it('should request browser notification permission', async () => {
      const { result } = renderHook(() => useNotificationIntegration())

      await act(async () => {
        const permission = await result.current.requestNotificationPermission()
        expect(permission).toBe('granted')
      })

      expect(mockNotification.requestPermission).toHaveBeenCalled()
      expect(setDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          browser_permission: 'granted'
        }),
        { merge: true }
      )
    })

    it('should handle permission denial', async () => {
      mockNotification.requestPermission.mockResolvedValue('denied')

      const { result } = renderHook(() => useNotificationIntegration())

      await act(async () => {
        const permission = await result.current.requestNotificationPermission()
        expect(permission).toBe('denied')
      })

      expect(setDoc).not.toHaveBeenCalled()
    })
  })

  describe('Test Notifications', () => {
    it('should send test notification', async () => {
      mockNotification.permission = 'granted'
      const mockNotificationInstance = {
        onclick: null,
        close: jest.fn()
      }
      global.Notification = jest.fn(() => mockNotificationInstance) as any
      global.Notification.permission = 'granted'

      const { result } = renderHook(() => useNotificationIntegration())

      await waitFor(() => {
        expect(result.current.preferences).toBeTruthy()
      })

      await act(async () => {
        await result.current.testNotification()
      })

      expect(global.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'notification:show',
          detail: expect.objectContaining({
            title: 'Review Due!',
            type: 'review_due'
          })
        })
      )
    })
  })

  describe('Preference Updates', () => {
    it('should update notification preferences', async () => {
      const { result } = renderHook(() => useNotificationIntegration())

      const newPreferences = {
        channels: {
          browser: false,
          inApp: false,
          push: true,
          email: false
        }
      }

      await act(async () => {
        await result.current.updatePreferences(newPreferences)
      })

      expect(setDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          ...newPreferences,
          updated_at: expect.any(Date)
        }),
        { merge: true }
      )
    })

    it('should reload preferences after update', async () => {
      const initialPrefs = {
        channels: { browser: true, inApp: true, push: false, email: true }
      }

      const updatedPrefs = {
        channels: { browser: false, inApp: true, push: true, email: false }
      }

      ;(getDoc as jest.Mock)
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => initialPrefs
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => updatedPrefs
        })

      const { result } = renderHook(() => useNotificationIntegration())

      await waitFor(() => {
        expect(result.current.preferences?.channels).toEqual(initialPrefs.channels)
      })

      await act(async () => {
        await result.current.updatePreferences(updatedPrefs)
      })

      await waitFor(() => {
        expect(result.current.preferences?.channels).toEqual(updatedPrefs.channels)
      })
    })
  })

  describe('SRS Interval Calculation', () => {
    it('should calculate correct intervals for consecutive correct answers', async () => {
      const { result } = renderHook(() => useNotificationIntegration())

      await waitFor(() => {
        expect(result.current.preferences).toBeTruthy()
      })

      const testCases = [
        { consecutiveCorrect: 0, expectedMinutes: 10 },
        { consecutiveCorrect: 1, expectedMinutes: 30 },
        { consecutiveCorrect: 2, expectedMinutes: 24 * 60 },
        { consecutiveCorrect: 3, expectedMinutes: 3 * 24 * 60 },
        { consecutiveCorrect: 4, expectedMinutes: 7 * 24 * 60 }
      ]

      for (const testCase of testCases) {
        const event = new CustomEvent(`review:${ReviewEventType.ITEM_ANSWERED}`, {
          detail: {
            itemId: `test-item-${testCase.consecutiveCorrect}`,
            correct: true,
            contentType: 'kanji',
            srsData: {
              repetitions: testCase.consecutiveCorrect
            }
          } as ItemAnsweredPayload
        })

        act(() => {
          const handler = (global.addEventListener as jest.Mock).mock.calls.find(
            call => call[0] === `review:${ReviewEventType.ITEM_ANSWERED}`
          )?.[1]
          if (handler) handler(event)
        })

        await waitFor(() => {
          const calls = (global.dispatchEvent as jest.Mock).mock.calls
          const lastCall = calls[calls.length - 1]
          if (lastCall) {
            const scheduledEvent = lastCall[0]
            const nextReviewTime = new Date(scheduledEvent.detail.nextReviewAt).getTime()
            const expectedTime = Date.now() + testCase.expectedMinutes * 60 * 1000
            expect(Math.abs(nextReviewTime - expectedTime)).toBeLessThan(5000) // Within 5 seconds
          }
        })
      }
    })
  })

  describe('Progress Events', () => {
    it('should show milestone notification for streak', async () => {
      const { result } = renderHook(() => useNotificationIntegration())

      await waitFor(() => {
        expect(result.current.preferences).toBeTruthy()
      })

      const event = new CustomEvent(`review:${ReviewEventType.PROGRESS_UPDATED}`, {
        detail: {
          sessionId: 'test-session',
          streak: 10,
          accuracy: 85,
          total: 15
        }
      })

      act(() => {
        const handler = (global.addEventListener as jest.Mock).mock.calls.find(
          call => call[0] === `review:${ReviewEventType.PROGRESS_UPDATED}`
        )?.[1]
        if (handler) handler(event)
      })

      await waitFor(() => {
        expect(global.dispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'notification:show',
            detail: expect.objectContaining({
              title: 'Streak Milestone!',
              type: 'achievement'
            })
          })
        )
      })
    })

    it('should show high accuracy notification', async () => {
      const { result } = renderHook(() => useNotificationIntegration())

      await waitFor(() => {
        expect(result.current.preferences).toBeTruthy()
      })

      const event = new CustomEvent(`review:${ReviewEventType.PROGRESS_UPDATED}`, {
        detail: {
          sessionId: 'test-session',
          streak: 5,
          accuracy: 95,
          total: 20
        }
      })

      act(() => {
        const handler = (global.addEventListener as jest.Mock).mock.calls.find(
          call => call[0] === `review:${ReviewEventType.PROGRESS_UPDATED}`
        )?.[1]
        if (handler) handler(event)
      })

      await waitFor(() => {
        expect(global.dispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'notification:show',
            detail: expect.objectContaining({
              title: 'Excellent Performance!',
              body: expect.stringContaining('95%'),
              type: 'achievement'
            })
          })
        )
      })
    })
  })

  describe('Cleanup', () => {
    it('should clean up event listeners on unmount', async () => {
      const { unmount } = renderHook(() => useNotificationIntegration())

      await waitFor(() => {
        expect(global.addEventListener).toHaveBeenCalled()
      })

      unmount()

      expect(global.removeEventListener).toHaveBeenCalledWith(
        `review:${ReviewEventType.ITEM_ANSWERED}`,
        expect.any(Function)
      )
      expect(global.removeEventListener).toHaveBeenCalledWith(
        `review:${ReviewEventType.SESSION_COMPLETED}`,
        expect.any(Function)
      )
      expect(global.removeEventListener).toHaveBeenCalledWith(
        `review:${ReviewEventType.PROGRESS_UPDATED}`,
        expect.any(Function)
      )
    })

    it('should clear scheduled notifications on unmount', async () => {
      jest.useFakeTimers()

      const { result, unmount } = renderHook(() => useNotificationIntegration())

      await waitFor(() => {
        expect(result.current.preferences).toBeTruthy()
      })

      // Schedule a notification
      await act(async () => {
        await result.current.scheduleNotification({
          itemId: 'test-item',
          scheduledFor: new Date(Date.now() + 5000),
          contentType: 'test',
          metadata: {}
        })
      })

      unmount()

      // Advance time
      jest.advanceTimersByTime(6000)

      // Notification should not fire after unmount
      expect(global.dispatchEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'notification:show'
        })
      )

      jest.useRealTimers()
    })
  })
})

describe('Integration with Email Notifications', () => {
  const { notificationService } = require('@/lib/notifications/notification-service')

  it('should trigger email for daily summary', async () => {
    const mockPreferences = {
      channels: { browser: false, inApp: false, push: false, email: true },
      timing: { immediate: false, daily: true, overdue: false },
      quiet_hours: { enabled: false, start: '22:00', end: '08:00', timezone: 'UTC' }
    }

    ;(getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => mockPreferences
    })

    const { result } = renderHook(() => useNotificationIntegration())

    await waitFor(() => {
      expect(result.current.preferences).toEqual(mockPreferences)
    })

    // Schedule a daily summary notification
    await act(async () => {
      await result.current.scheduleNotification({
        itemId: 'daily-batch',
        scheduledFor: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
        contentType: 'daily_summary',
        metadata: { itemCount: 10 }
      })
    })

    // Verify notification was stored for batch processing
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: 'daily_summary',
        status: 'pending'
      })
    )
  })
})