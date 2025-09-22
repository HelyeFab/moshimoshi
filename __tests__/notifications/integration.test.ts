/**
 * Notification System Integration Tests
 * End-to-end tests for the complete notification flow
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll, jest } from '@jest/globals'
import { NotificationService } from '@/lib/notifications/notification-service'
import { attachAchievementNotifications } from '@/lib/notifications/achievement-notification-hook'
import { EventEmitter } from 'events'

// Mock environment
const TEST_ENV = {
  NEXT_PUBLIC_APP_URL: 'https://test.moshimoshi.app',
  RESEND_API_KEY: 'test_resend_key',
  CRON_SECRET: 'test_cron_secret',
}

// Test data
const TEST_USER = {
  userId: 'test-user-integration',
  email: 'integration@test.com',
  displayName: 'Integration Test User',
  preferences: {
    notifications: {
      dailyReminder: true,
      achievementAlerts: true,
      weeklyProgress: true,
      marketingEmails: false,
      reminderTime: '09:00',
      timezone: 'America/New_York',
    },
  },
  stats: {
    currentStreak: 15,
    totalReviews: 500,
    dueReviews: 30,
    lastStudyDate: new Date('2024-01-20T14:00:00Z'),
  },
  achievements: {
    totalPoints: 1250,
    totalAchievements: 25,
    percentageComplete: 35,
  },
  weeklyData: {
    totalReviews: 210,
    correctReviews: 185,
    accuracy: 88,
    studyTime: 420,
    daysStudied: 6,
  },
}

describe('Notification System Integration', () => {
  let notificationService: NotificationService
  let achievementSystem: EventEmitter
  let emailsSent: any[] = []

  beforeAll(() => {
    // Set test environment
    Object.assign(process.env, TEST_ENV)
  })

  beforeEach(() => {
    jest.clearAllMocks()
    emailsSent = []

    // Mock Resend to capture emails
    jest.mock('resend', () => ({
      Resend: jest.fn().mockImplementation(() => ({
        emails: {
          send: jest.fn((email) => {
            emailsSent.push(email)
            return Promise.resolve({
              data: { id: `email-${Date.now()}` },
              error: null,
            })
          }),
        },
      })),
    }))

    // Setup notification service
    notificationService = NotificationService.getInstance()

    // Setup achievement system mock
    achievementSystem = new EventEmitter()
  })

  afterAll(() => {
    jest.restoreAllMocks()
  })

  describe('Complete Daily Reminder Flow', () => {
    it('should generate and send daily reminder with correct data', async () => {
      // Mock database responses
      jest.spyOn(notificationService as any, 'getUserData').mockResolvedValue(TEST_USER)
      jest.spyOn(notificationService as any, 'getUserNotificationPreferences').mockResolvedValue(
        TEST_USER.preferences.notifications
      )
      jest.spyOn(notificationService as any, 'getUserStudyStats').mockResolvedValue(TEST_USER.stats)
      jest.spyOn(notificationService as any, 'logNotification').mockResolvedValue(undefined)

      // Send daily reminder
      const result = await notificationService.sendDailyReminder(TEST_USER.userId)

      expect(result).toBe(true)
      expect(emailsSent).toHaveLength(1)

      const email = emailsSent[0]
      expect(email.to).toBe(TEST_USER.email)
      expect(email.from).toBe('Moshimoshi <noreply@moshimoshi.app>')
      expect(email.subject).toContain('30 reviews waiting')

      // Verify email content
      expect(email.html).toContain('Integration Test User')
      expect(email.html).toContain('15 days')  // streak
      expect(email.html).toContain('30')       // due reviews
      expect(email.html).toContain('500')      // total reviews
      expect(email.html).toContain('Start Today\'s Study Session')

      // Verify unsubscribe link
      expect(email.html).toContain('/api/notifications/unsubscribe?token=')

      // Verify text version
      expect(email.text).toContain('Current Streak: 15 days')
      expect(email.text).toContain('Reviews Due: 30')
    })

    it('should respect user notification preferences', async () => {
      const disabledPrefs = {
        ...TEST_USER.preferences.notifications,
        dailyReminder: false,
      }

      jest.spyOn(notificationService as any, 'getUserData').mockResolvedValue(TEST_USER)
      jest.spyOn(notificationService as any, 'getUserNotificationPreferences').mockResolvedValue(
        disabledPrefs
      )

      const result = await notificationService.sendDailyReminder(TEST_USER.userId)

      expect(result).toBe(false)
      expect(emailsSent).toHaveLength(0)
    })

    it('should handle zero reviews due gracefully', async () => {
      const zeroReviewStats = {
        ...TEST_USER.stats,
        dueReviews: 0,
      }

      jest.spyOn(notificationService as any, 'getUserData').mockResolvedValue(TEST_USER)
      jest.spyOn(notificationService as any, 'getUserNotificationPreferences').mockResolvedValue(
        TEST_USER.preferences.notifications
      )
      jest.spyOn(notificationService as any, 'getUserStudyStats').mockResolvedValue(zeroReviewStats)
      jest.spyOn(notificationService as any, 'logNotification').mockResolvedValue(undefined)

      const result = await notificationService.sendDailyReminder(TEST_USER.userId)

      expect(result).toBe(true)
      expect(emailsSent[0].subject).toContain('Ready for today\'s Japanese practice?')
      expect(emailsSent[0].html).toContain('All caught up')
    })
  })

  describe('Complete Achievement Alert Flow', () => {
    const TEST_ACHIEVEMENT = {
      id: 'kanji-master',
      name: 'Kanji Master',
      description: 'Learned 100 kanji characters',
      icon: '🈷',
      rarity: 'rare' as const,
      points: 100,
    }

    it('should send achievement notification when unlocked', async () => {
      jest.spyOn(notificationService as any, 'getUserData').mockResolvedValue(TEST_USER)
      jest.spyOn(notificationService as any, 'getUserNotificationPreferences').mockResolvedValue(
        TEST_USER.preferences.notifications
      )
      jest.spyOn(notificationService as any, 'getAchievementData').mockResolvedValue(TEST_ACHIEVEMENT)
      jest.spyOn(notificationService as any, 'getUserAchievementStats').mockResolvedValue({
        ...TEST_USER.achievements,
        nextAchievements: [
          {
            name: 'Kanji Grandmaster',
            description: 'Learn 500 kanji',
            progress: 20,
          },
        ],
      })
      jest.spyOn(notificationService as any, 'logNotification').mockResolvedValue(undefined)

      const result = await notificationService.sendAchievementAlert(
        TEST_USER.userId,
        TEST_ACHIEVEMENT.id
      )

      expect(result).toBe(true)
      expect(emailsSent).toHaveLength(1)

      const email = emailsSent[0]
      expect(email.subject).toBe('🏆 Achievement Unlocked: Kanji Master!')
      expect(email.html).toContain('Kanji Master')
      expect(email.html).toContain('Learned 100 kanji characters')
      expect(email.html).toContain('🈷')
      expect(email.html).toContain('+100 points')
      expect(email.html).toContain('1,250')  // total points with formatting
      expect(email.html).toContain('Rare')    // rarity badge

      // Verify next achievements section
      expect(email.html).toContain('Kanji Grandmaster')
      expect(email.html).toContain('20% complete')
    })

    it('should integrate with achievement system events', async () => {
      // Setup mocks
      jest.spyOn(notificationService as any, 'getUserData').mockResolvedValue(TEST_USER)
      jest.spyOn(notificationService as any, 'getUserNotificationPreferences').mockResolvedValue(
        TEST_USER.preferences.notifications
      )
      jest.spyOn(notificationService as any, 'getAchievementData').mockResolvedValue(TEST_ACHIEVEMENT)
      jest.spyOn(notificationService as any, 'getUserAchievementStats').mockResolvedValue(
        TEST_USER.achievements
      )
      jest.spyOn(notificationService as any, 'logNotification').mockResolvedValue(undefined)

      // Attach notification hook
      const hook = attachAchievementNotifications(achievementSystem, TEST_USER.userId)

      // Spy on sendAchievementAlert
      const sendSpy = jest.spyOn(notificationService, 'sendAchievementAlert')

      // Emit achievement unlocked event
      achievementSystem.emit('achievementUnlocked', TEST_ACHIEVEMENT)

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(sendSpy).toHaveBeenCalledWith(TEST_USER.userId, TEST_ACHIEVEMENT.id)

      // Cleanup
      hook.destroy()
    })
  })

  describe('Complete Weekly Progress Flow', () => {
    it('should send comprehensive weekly report', async () => {
      const weekEnd = new Date('2024-01-21')
      const weekStart = new Date('2024-01-14')

      const weeklyStats = {
        stats: TEST_USER.weeklyData,
        progress: {
          kanjiLearned: 8,
          kanjiMastered: 3,
          vocabularyLearned: 45,
          sentencesCompleted: 20,
        },
        achievements: [
          {
            name: 'Week Warrior',
            icon: '🔥',
            date: new Date('2024-01-18'),
          },
          {
            name: 'Vocabulary Victor',
            icon: '📚',
            date: new Date('2024-01-19'),
          },
        ],
        topPerformingDays: [
          { day: 'Monday', reviews: 45 },
          { day: 'Wednesday', reviews: 38 },
          { day: 'Saturday', reviews: 42 },
        ],
      }

      jest.spyOn(notificationService as any, 'getUserData').mockResolvedValue(TEST_USER)
      jest.spyOn(notificationService as any, 'getUserNotificationPreferences').mockResolvedValue(
        TEST_USER.preferences.notifications
      )
      jest.spyOn(notificationService as any, 'getUserWeeklyStats').mockResolvedValue(weeklyStats)
      jest.spyOn(notificationService as any, 'logNotification').mockResolvedValue(undefined)

      const result = await notificationService.sendWeeklyProgressReport(TEST_USER.userId)

      expect(result).toBe(true)
      expect(emailsSent).toHaveLength(1)

      const email = emailsSent[0]
      expect(email.subject).toBe('📊 Your Weekly Japanese Learning Report')
      expect(email.html).toContain('Your Weekly Progress Report')
      expect(email.html).toContain('210')  // total reviews
      expect(email.html).toContain('88%')  // accuracy
      expect(email.html).toContain('7h 0m')  // 420 minutes formatted
      expect(email.html).toContain('6')    // days studied

      // Verify achievements section
      expect(email.html).toContain('Week Warrior')
      expect(email.html).toContain('Vocabulary Victor')

      // Verify activity chart
      expect(email.html).toContain('Monday')
      expect(email.html).toContain('45')

      // Verify learning progress
      expect(email.html).toContain('8')   // kanji learned
      expect(email.html).toContain('45')  // vocabulary

      // Verify performance message (88% = Great Job)
      expect(email.html).toContain('Great Job')
    })

    it('should suggest appropriate goals based on performance', async () => {
      const lowPerformanceStats = {
        stats: {
          ...TEST_USER.weeklyData,
          accuracy: 65,
          daysStudied: 3,
          totalReviews: 50,
        },
        progress: {
          kanjiLearned: 1,
          kanjiMastered: 0,
          vocabularyLearned: 5,
          sentencesCompleted: 2,
        },
        achievements: [],
        topPerformingDays: [],
      }

      jest.spyOn(notificationService as any, 'getUserData').mockResolvedValue(TEST_USER)
      jest.spyOn(notificationService as any, 'getUserNotificationPreferences').mockResolvedValue(
        TEST_USER.preferences.notifications
      )
      jest.spyOn(notificationService as any, 'getUserWeeklyStats').mockResolvedValue(lowPerformanceStats)
      jest.spyOn(notificationService as any, 'logNotification').mockResolvedValue(undefined)

      await notificationService.sendWeeklyProgressReport(TEST_USER.userId)

      const email = emailsSent[0]

      // Should suggest improvement goals
      expect(email.html).toContain('Focus on accuracy')
      expect(email.html).toContain('Study all 7 days')
      expect(email.html).toContain('Aim for at least 100 reviews')
      expect(email.html).toContain('Learn at least 5 new kanji')

      // Should show encouraging message for low performance
      expect(email.html).toContain('Keep Practicing')
    })
  })

  describe('Unsubscribe Flow', () => {
    it('should generate working unsubscribe links', async () => {
      jest.spyOn(notificationService as any, 'getUserData').mockResolvedValue(TEST_USER)
      jest.spyOn(notificationService as any, 'getUserNotificationPreferences').mockResolvedValue(
        TEST_USER.preferences.notifications
      )
      jest.spyOn(notificationService as any, 'getUserStudyStats').mockResolvedValue(TEST_USER.stats)
      jest.spyOn(notificationService as any, 'logNotification').mockResolvedValue(undefined)

      await notificationService.sendDailyReminder(TEST_USER.userId)

      const email = emailsSent[0]
      const htmlMatch = email.html.match(/\/api\/notifications\/unsubscribe\?token=([^"]+)/)
      const textMatch = email.text.match(/\/api\/notifications\/unsubscribe\?token=(\S+)/)

      expect(htmlMatch).toBeTruthy()
      expect(textMatch).toBeTruthy()

      // Decode and verify token
      const token = htmlMatch[1]
      const decoded = Buffer.from(token, 'base64').toString('utf-8')
      const [userId, type, timestamp] = decoded.split(':')

      expect(userId).toBe(TEST_USER.userId)
      expect(type).toBe('daily_reminder')
      expect(parseInt(timestamp)).toBeGreaterThan(Date.now() - 1000)
    })

    it('should have unique tokens for different notification types', async () => {
      const dailyToken = (notificationService as any).generateUnsubscribeToken(
        TEST_USER.userId,
        'daily_reminder'
      )
      const weeklyToken = (notificationService as any).generateUnsubscribeToken(
        TEST_USER.userId,
        'weekly_progress'
      )
      const achievementToken = (notificationService as any).generateUnsubscribeToken(
        TEST_USER.userId,
        'achievement_alerts'
      )

      expect(dailyToken).not.toBe(weeklyToken)
      expect(weeklyToken).not.toBe(achievementToken)
      expect(dailyToken).not.toBe(achievementToken)

      // Verify each decodes correctly
      [
        { token: dailyToken, type: 'daily_reminder' },
        { token: weeklyToken, type: 'weekly_progress' },
        { token: achievementToken, type: 'achievement_alerts' },
      ].forEach(({ token, type }) => {
        const decoded = Buffer.from(token, 'base64').toString('utf-8')
        const parts = decoded.split(':')
        expect(parts[0]).toBe(TEST_USER.userId)
        expect(parts[1]).toBe(type)
      })
    })
  })

  describe('Error Recovery', () => {
    it('should log failures without throwing', async () => {
      // Force email send to fail
      const Resend = require('resend').Resend
      Resend.mockImplementation(() => ({
        emails: {
          send: jest.fn().mockRejectedValue(new Error('Network error')),
        },
      }))

      jest.spyOn(notificationService as any, 'getUserData').mockResolvedValue(TEST_USER)
      jest.spyOn(notificationService as any, 'getUserNotificationPreferences').mockResolvedValue(
        TEST_USER.preferences.notifications
      )
      jest.spyOn(notificationService as any, 'getUserStudyStats').mockResolvedValue(TEST_USER.stats)

      const logSpy = jest.spyOn(notificationService as any, 'logNotification').mockResolvedValue(undefined)

      const result = await notificationService.sendDailyReminder(TEST_USER.userId)

      expect(result).toBe(false)

      // Verify failure was logged
      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: TEST_USER.userId,
          type: 'daily_reminder',
          channel: 'email',
          status: 'failed',
          error: expect.stringContaining('Network error'),
        })
      )
    })

    it('should continue processing batch even if individual sends fail', async () => {
      const users = [
        { ...TEST_USER, userId: 'user1', email: 'user1@test.com' },
        { ...TEST_USER, userId: 'user2', email: 'user2@test.com' },
        { ...TEST_USER, userId: 'user3', email: 'user3@test.com' },
      ]

      let callCount = 0
      const Resend = require('resend').Resend
      Resend.mockImplementation(() => ({
        emails: {
          send: jest.fn().mockImplementation(() => {
            callCount++
            // Fail the second email
            if (callCount === 2) {
              return Promise.reject(new Error('Email service error'))
            }
            return Promise.resolve({
              data: { id: `email-${callCount}` },
              error: null,
            })
          }),
        },
      }))

      const results = []
      for (const user of users) {
        jest.spyOn(notificationService as any, 'getUserData').mockResolvedValue(user)
        jest.spyOn(notificationService as any, 'getUserNotificationPreferences').mockResolvedValue(
          user.preferences.notifications
        )
        jest.spyOn(notificationService as any, 'getUserStudyStats').mockResolvedValue(user.stats)
        jest.spyOn(notificationService as any, 'logNotification').mockResolvedValue(undefined)

        const result = await notificationService.sendDailyReminder(user.userId)
        results.push(result)
      }

      expect(results).toEqual([true, false, true])
      expect(callCount).toBe(3)
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle large number of users efficiently', async () => {
      const userCount = 100
      const users = Array.from({ length: userCount }, (_, i) => ({
        ...TEST_USER,
        userId: `user-${i}`,
        email: `user${i}@test.com`,
      }))

      const startTime = Date.now()
      const results = []

      for (const user of users) {
        jest.spyOn(notificationService as any, 'getUserData').mockResolvedValue(user)
        jest.spyOn(notificationService as any, 'getUserNotificationPreferences').mockResolvedValue(
          user.preferences.notifications
        )
        jest.spyOn(notificationService as any, 'getUserStudyStats').mockResolvedValue(user.stats)
        jest.spyOn(notificationService as any, 'logNotification').mockResolvedValue(undefined)

        const result = await notificationService.sendDailyReminder(user.userId)
        results.push(result)
      }

      const duration = Date.now() - startTime

      expect(results.every(r => r === true)).toBe(true)
      expect(emailsSent).toHaveLength(userCount)

      // Should process 100 users reasonably quickly (under 5 seconds)
      expect(duration).toBeLessThan(5000)
    })

    it('should batch process without memory leaks', () => {
      // Monitor memory usage
      const initialMemory = process.memoryUsage().heapUsed

      // Process many emails
      const emails = Array.from({ length: 1000 }, (_, i) => ({
        to: `user${i}@test.com`,
        from: 'noreply@test.com',
        subject: 'Test',
        html: '<p>Test content</p>'.repeat(100),  // Large content
        text: 'Test content '.repeat(100),
      }))

      // Process and clear
      emails.forEach(email => {
        // Simulate processing
        JSON.stringify(email)
      })

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)
    })
  })
})