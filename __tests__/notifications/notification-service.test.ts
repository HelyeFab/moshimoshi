/**
 * Notification Service Tests
 * Tests the core notification service functionality
 */

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals'
import { notificationService, NotificationService } from '@/lib/notifications/notification-service'

// Mock Resend
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn(),
    },
  })),
}))

// Mock Firebase
jest.mock('@/lib/firebase/config', () => ({
  db: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(),
        set: jest.fn(),
        update: jest.fn(),
      })),
    })),
  },
}))

jest.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(),
        set: jest.fn(),
        update: jest.fn(),
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            get: jest.fn(),
            set: jest.fn(),
          })),
          add: jest.fn(),
          where: jest.fn(() => ({
            get: jest.fn(() => Promise.resolve({ empty: true })),
          })),
        })),
      })),
    })),
    doc: jest.fn(() => ({
      get: jest.fn(),
    })),
  },
}))

describe('NotificationService', () => {
  let service: NotificationService
  let mockResendSend: jest.Mock

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks()

    // Get instance of service
    service = NotificationService.getInstance()

    // Setup Resend mock
    const Resend = require('resend').Resend
    mockResendSend = jest.fn()
    Resend.mockImplementation(() => ({
      emails: {
        send: mockResendSend,
      },
    }))

    // Set up environment variables
    process.env.NEXT_PUBLIC_APP_URL = 'https://test.app'
    process.env.RESEND_API_KEY = 'test_api_key'
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('sendDailyReminder', () => {
    const mockUserId = 'test-user-123'
    const mockUserData = {
      uid: mockUserId,
      email: 'test@example.com',
      displayName: 'Test User',
    }

    const mockPreferences = {
      notifications: {
        dailyReminder: true,
        achievementAlerts: true,
        weeklyProgress: false,
        marketingEmails: false,
      },
    }

    const mockStats = {
      currentStreak: 7,
      totalReviews: 150,
      dueReviews: 25,
      lastStudyDate: new Date('2024-01-20'),
    }

    beforeEach(() => {
      // Setup mock responses
      const { adminDb } = require('@/lib/firebase/admin')

      // Mock user data retrieval
      adminDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockUserData,
      })

      // Mock preferences retrieval
      adminDb.collection().doc().collection().doc().get.mockResolvedValue({
        exists: () => true,
        data: () => mockPreferences,
      })

      // Mock stats retrieval - use a different mock path
      adminDb.collection.mockImplementation((collection: string) => {
        if (collection === 'users') {
          return {
            doc: jest.fn((docId: string) => ({
              get: jest.fn().mockResolvedValue({
                exists: true,
                data: () => mockUserData,
              }),
              collection: jest.fn((subcollection: string) => {
                if (subcollection === 'preferences') {
                  return {
                    doc: jest.fn().mockResolvedValue({
                      exists: () => true,
                      data: () => mockPreferences,
                    }),
                  }
                }
                if (subcollection === 'statistics') {
                  return {
                    doc: jest.fn(() => ({
                      get: jest.fn().mockResolvedValue({
                        exists: () => true,
                        data: () => mockStats,
                      }),
                    })),
                  }
                }
                if (subcollection === 'notificationLogs') {
                  return {
                    add: jest.fn().mockResolvedValue({ id: 'log-123' }),
                  }
                }
                return {
                  doc: jest.fn(),
                  add: jest.fn(),
                }
              }),
            })),
          }
        }
        return {
          doc: jest.fn(),
        }
      })
    })

    it('should send daily reminder email when preferences enabled', async () => {
      mockResendSend.mockResolvedValue({
        data: { id: 'email-123' },
        error: null,
      })

      const result = await service.sendDailyReminder(mockUserId)

      expect(result).toBe(true)
      expect(mockResendSend).toHaveBeenCalledTimes(1)

      const emailCall = mockResendSend.mock.calls[0][0]
      expect(emailCall.to).toBe('test@example.com')
      expect(emailCall.from).toBe('Moshimoshi <noreply@moshimoshi.app>')
      expect(emailCall.subject).toContain('25 reviews waiting')
      expect(emailCall.html).toContain('Test User')
      expect(emailCall.html).toContain('7 days')  // streak
      expect(emailCall.html).toContain('25')      // due reviews
    })

    it('should not send email when daily reminders disabled', async () => {
      const disabledPrefs = {
        ...mockPreferences,
        notifications: {
          ...mockPreferences.notifications,
          dailyReminder: false,
        },
      }

      // Mock disabled preferences
      const { adminDb } = require('@/lib/firebase/admin')
      adminDb.collection().doc().collection().doc().get.mockResolvedValue({
        exists: () => true,
        data: () => disabledPrefs,
      })

      const result = await service.sendDailyReminder(mockUserId)

      expect(result).toBe(false)
      expect(mockResendSend).not.toHaveBeenCalled()
    })

    it('should handle user not found', async () => {
      const { adminDb } = require('@/lib/firebase/admin')
      adminDb.collection().doc().get.mockResolvedValue({
        exists: false,
      })

      const result = await service.sendDailyReminder(mockUserId)

      expect(result).toBe(false)
      expect(mockResendSend).not.toHaveBeenCalled()
    })

    it('should handle email sending failure', async () => {
      mockResendSend.mockResolvedValue({
        data: null,
        error: new Error('Email service error'),
      })

      const result = await service.sendDailyReminder(mockUserId)

      expect(result).toBe(false)
      expect(mockResendSend).toHaveBeenCalled()
    })

    it('should log successful notification', async () => {
      mockResendSend.mockResolvedValue({
        data: { id: 'email-123' },
        error: null,
      })

      const { adminDb } = require('@/lib/firebase/admin')
      const addMock = jest.fn().mockResolvedValue({ id: 'log-123' })
      adminDb.collection().doc().collection().add = addMock

      await service.sendDailyReminder(mockUserId)

      // Check that notification was logged
      expect(addMock).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          type: 'daily_reminder',
          channel: 'email',
          status: 'sent',
        })
      )
    })

    it('should log failed notification', async () => {
      mockResendSend.mockRejectedValue(new Error('Network error'))

      const { adminDb } = require('@/lib/firebase/admin')
      const addMock = jest.fn()
      adminDb.collection().doc().collection().add = addMock

      await service.sendDailyReminder(mockUserId)

      // Check that failure was logged
      expect(addMock).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          type: 'daily_reminder',
          channel: 'email',
          status: 'failed',
          error: expect.stringContaining('Network error'),
        })
      )
    })
  })

  describe('sendAchievementAlert', () => {
    const mockUserId = 'test-user-123'
    const mockAchievementId = 'week-warrior'

    const mockUserData = {
      uid: mockUserId,
      email: 'test@example.com',
      displayName: 'Test User',
    }

    const mockAchievement = {
      id: mockAchievementId,
      name: 'Week Warrior',
      description: 'Maintained a 7-day streak',
      icon: '🔥',
      rarity: 'uncommon',
      points: 50,
    }

    const mockAchievementStats = {
      totalPoints: 500,
      totalAchievements: 10,
      percentageComplete: 25,
      nextAchievements: [
        {
          name: 'Month Master',
          description: 'Maintain a 30-day streak',
          progress: 23,
        },
      ],
    }

    beforeEach(() => {
      const { adminDb } = require('@/lib/firebase/admin')

      // Setup mocks for achievement alert
      adminDb.collection.mockImplementation((collection: string) => {
        if (collection === 'users') {
          return {
            doc: jest.fn(() => ({
              get: jest.fn().mockResolvedValue({
                exists: true,
                data: () => mockUserData,
              }),
              collection: jest.fn((subcollection: string) => {
                if (subcollection === 'achievements') {
                  return {
                    doc: jest.fn(() => ({
                      get: jest.fn().mockResolvedValue({
                        exists: () => true,
                        data: () => mockAchievementStats,
                      }),
                    })),
                  }
                }
                if (subcollection === 'notificationLogs') {
                  return {
                    add: jest.fn().mockResolvedValue({ id: 'log-456' }),
                  }
                }
                return {
                  doc: jest.fn(() => ({
                    get: jest.fn().mockResolvedValue({
                      exists: () => true,
                      data: () => ({
                        notifications: {
                          achievementAlerts: true,
                        },
                      }),
                    }),
                  })),
                }
              }),
            })),
          }
        }
        if (collection === 'achievements') {
          return {
            doc: jest.fn(() => ({
              get: jest.fn().mockResolvedValue({
                exists: true,
                data: () => mockAchievement,
              }),
            })),
          }
        }
        return { doc: jest.fn() }
      })

      adminDb.doc.mockImplementation((path: string) => {
        if (path.includes('achievements')) {
          return {
            get: jest.fn().mockResolvedValue({
              exists: true,
              data: () => mockAchievement,
            }),
          }
        }
        return { get: jest.fn() }
      })
    })

    it('should send achievement alert email', async () => {
      mockResendSend.mockResolvedValue({
        data: { id: 'email-456' },
        error: null,
      })

      const result = await service.sendAchievementAlert(mockUserId, mockAchievementId)

      expect(result).toBe(true)
      expect(mockResendSend).toHaveBeenCalledTimes(1)

      const emailCall = mockResendSend.mock.calls[0][0]
      expect(emailCall.to).toBe('test@example.com')
      expect(emailCall.subject).toContain('Achievement Unlocked: Week Warrior')
      expect(emailCall.html).toContain('Week Warrior')
      expect(emailCall.html).toContain('50')  // points
      expect(emailCall.html).toContain('🔥')  // icon
    })

    it('should not send when achievement alerts disabled', async () => {
      const { adminDb } = require('@/lib/firebase/admin')
      adminDb.collection().doc().collection().doc().get.mockResolvedValue({
        exists: () => true,
        data: () => ({
          notifications: {
            achievementAlerts: false,
          },
        }),
      })

      const result = await service.sendAchievementAlert(mockUserId, mockAchievementId)

      expect(result).toBe(false)
      expect(mockResendSend).not.toHaveBeenCalled()
    })

    it('should handle achievement not found', async () => {
      const { adminDb } = require('@/lib/firebase/admin')
      adminDb.doc.mockResolvedValue({
        get: jest.fn().mockResolvedValue({
          exists: false,
        }),
      })

      const result = await service.sendAchievementAlert(mockUserId, 'invalid-achievement')

      expect(result).toBe(false)
      expect(mockResendSend).not.toHaveBeenCalled()
    })
  })

  describe('sendWeeklyProgressReport', () => {
    const mockUserId = 'test-user-123'
    const mockUserData = {
      uid: mockUserId,
      email: 'test@example.com',
      displayName: 'Test User',
    }

    const mockWeeklyStats = {
      stats: {
        totalReviews: 350,
        correctReviews: 280,
        accuracy: 80,
        studyTime: 245,
        daysStudied: 6,
        currentStreak: 15,
        longestStreak: 30,
      },
      progress: {
        kanjiLearned: 12,
        kanjiMastered: 5,
        vocabularyLearned: 25,
        sentencesCompleted: 10,
      },
      achievements: [
        {
          name: 'Week Warrior',
          icon: '🔥',
          date: new Date(),
        },
      ],
      topPerformingDays: [
        { day: 'Monday', reviews: 75 },
        { day: 'Wednesday', reviews: 60 },
      ],
    }

    beforeEach(() => {
      const { adminDb } = require('@/lib/firebase/admin')

      adminDb.collection.mockImplementation(() => ({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => mockUserData,
          }),
          collection: jest.fn(() => ({
            doc: jest.fn(() => ({
              get: jest.fn().mockResolvedValue({
                exists: () => true,
                data: () => ({
                  notifications: {
                    weeklyProgress: true,
                  },
                }),
              }),
            })),
            add: jest.fn(),
          })),
        })),
      }))

      // Mock the weekly stats retrieval
      jest.spyOn(service as any, 'getUserWeeklyStats').mockResolvedValue(mockWeeklyStats)
    })

    it('should send weekly progress report email', async () => {
      mockResendSend.mockResolvedValue({
        data: { id: 'email-789' },
        error: null,
      })

      const result = await service.sendWeeklyProgressReport(mockUserId)

      expect(result).toBe(true)
      expect(mockResendSend).toHaveBeenCalledTimes(1)

      const emailCall = mockResendSend.mock.calls[0][0]
      expect(emailCall.to).toBe('test@example.com')
      expect(emailCall.subject).toContain('Weekly Japanese Learning Report')
      expect(emailCall.html).toContain('350')  // total reviews
      expect(emailCall.html).toContain('80%')  // accuracy
      expect(emailCall.html).toContain('6')    // days studied
    })

    it('should not send when weekly reports disabled', async () => {
      const { adminDb } = require('@/lib/firebase/admin')
      adminDb.collection().doc().collection().doc().get.mockResolvedValue({
        exists: () => true,
        data: () => ({
          notifications: {
            weeklyProgress: false,
          },
        }),
      })

      const result = await service.sendWeeklyProgressReport(mockUserId)

      expect(result).toBe(false)
      expect(mockResendSend).not.toHaveBeenCalled()
    })

    it('should include week date range in email', async () => {
      mockResendSend.mockResolvedValue({
        data: { id: 'email-789' },
        error: null,
      })

      await service.sendWeeklyProgressReport(mockUserId)

      const emailCall = mockResendSend.mock.calls[0][0]
      // Check that the HTML contains a date range
      expect(emailCall.html).toMatch(/\w+ \d+ - \w+ \d+, \d{4}/)
    })
  })

  describe('Unsubscribe Token Generation', () => {
    it('should generate valid unsubscribe tokens', () => {
      const userId = 'test-user-123'
      const notificationType = 'daily_reminder'

      // Access private method through any type
      const token = (service as any).generateUnsubscribeToken(userId, notificationType)

      expect(token).toBeTruthy()
      expect(typeof token).toBe('string')

      // Decode and verify token
      const decoded = Buffer.from(token, 'base64').toString('utf-8')
      const parts = decoded.split(':')

      expect(parts[0]).toBe(userId)
      expect(parts[1]).toBe(notificationType)
      expect(parts[2]).toBeTruthy()  // timestamp
      expect(parseInt(parts[2])).toBeGreaterThan(0)
    })

    it('should generate unique tokens for different inputs', () => {
      const token1 = (service as any).generateUnsubscribeToken('user1', 'daily_reminder')
      const token2 = (service as any).generateUnsubscribeToken('user2', 'weekly_progress')

      expect(token1).not.toBe(token2)
    })

    it('should include unsubscribe URL in emails', async () => {
      mockResendSend.mockResolvedValue({
        data: { id: 'email-123' },
        error: null,
      })

      await service.sendDailyReminder('test-user-123')

      const emailCall = mockResendSend.mock.calls[0][0]
      expect(emailCall.html).toContain('/api/notifications/unsubscribe?token=')
      expect(emailCall.text).toContain('/api/notifications/unsubscribe?token=')
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockResendSend.mockRejectedValue(new Error('Network timeout'))

      const result = await service.sendDailyReminder('test-user-123')

      expect(result).toBe(false)
    })

    it('should handle database errors gracefully', async () => {
      const { adminDb } = require('@/lib/firebase/admin')
      adminDb.collection().doc().get.mockRejectedValue(new Error('Database connection failed'))

      const result = await service.sendDailyReminder('test-user-123')

      expect(result).toBe(false)
      expect(mockResendSend).not.toHaveBeenCalled()
    })

    it('should handle missing environment variables', async () => {
      delete process.env.RESEND_API_KEY

      const result = await service.sendDailyReminder('test-user-123')

      // Should still attempt but may fail
      expect(result).toBe(false)
    })
  })

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = NotificationService.getInstance()
      const instance2 = NotificationService.getInstance()

      expect(instance1).toBe(instance2)
    })
  })
})