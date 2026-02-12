import { describe, it, expect, beforeEach, jest } from '@jest/globals'

const mockResendSend = jest.fn()

jest.mock('resend', () => ({
  Resend: jest.fn(() => ({
    emails: {
      send: mockResendSend,
    },
  })),
}))

const mockLogAdd = jest.fn().mockResolvedValue({ id: 'log-1' })
const mockAdminDb = {
  collection: jest.fn(() => ({
    doc: jest.fn(() => ({
      collection: jest.fn(() => ({
        add: mockLogAdd,
      })),
    })),
  })),
}

jest.mock('@/lib/firebase/admin', () => ({
  adminDb: mockAdminDb,
}))

jest.mock('@/lib/firebase/config', () => ({
  db: null,
}))

import { NotificationService } from '@/lib/notifications/notification-service'

describe('NotificationService', () => {
  let service: NotificationService

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_APP_URL = 'https://test.app'
    process.env.RESEND_API_KEY = 'test_key'
    service = NotificationService.getInstance()
  })

  describe('sendDailyReminder', () => {
    it('sends email when user + prefs are eligible', async () => {
      jest.spyOn(service as any, 'getUserData').mockResolvedValue({
        email: 'test@example.com',
        displayName: 'Test User',
      })
      jest.spyOn(service as any, 'getUserNotificationPreferences').mockResolvedValue({
        dailyReminder: true,
      })
      jest.spyOn(service as any, 'getUserStudyStats').mockResolvedValue({
        currentStreak: 7,
        totalReviews: 120,
        dueReviews: 12,
        lastStudyDate: new Date('2026-02-10T10:00:00.000Z'),
      })
      mockResendSend.mockResolvedValue({ data: { id: 'email-1' }, error: null })

      const result = await service.sendDailyReminder('u1')

      expect(result).toBe(true)
      expect(mockResendSend).toHaveBeenCalledTimes(1)
      const payload = mockResendSend.mock.calls[0][0]
      expect(payload.to).toBe('test@example.com')
      expect(payload.subject).toContain('12 reviews waiting')
      expect(payload.html).toContain('Test User')
      expect(payload.html).toContain('/api/notifications/unsubscribe?token=')
      expect(mockLogAdd).toHaveBeenCalled()
    })

    it('does not send when daily reminders are disabled', async () => {
      jest.spyOn(service as any, 'getUserData').mockResolvedValue({
        email: 'test@example.com',
        displayName: 'Test User',
      })
      jest.spyOn(service as any, 'getUserNotificationPreferences').mockResolvedValue({
        dailyReminder: false,
      })

      const result = await service.sendDailyReminder('u1')

      expect(result).toBe(false)
      expect(mockResendSend).not.toHaveBeenCalled()
    })

    it('returns false when email provider fails', async () => {
      jest.spyOn(service as any, 'getUserData').mockResolvedValue({
        email: 'test@example.com',
        displayName: 'Test User',
      })
      jest.spyOn(service as any, 'getUserNotificationPreferences').mockResolvedValue({
        dailyReminder: true,
      })
      jest.spyOn(service as any, 'getUserStudyStats').mockResolvedValue({
        currentStreak: 1,
        totalReviews: 10,
        dueReviews: 2,
        lastStudyDate: null,
      })
      mockResendSend.mockResolvedValue({ data: null, error: new Error('provider-error') })

      const result = await service.sendDailyReminder('u1')
      expect(result).toBe(false)
      expect(mockLogAdd).toHaveBeenCalled()
    })
  })

  describe('sendAchievementAlert', () => {
    it('sends achievement alert for eligible user', async () => {
      jest.spyOn(service as any, 'getUserData').mockResolvedValue({
        email: 'test@example.com',
        displayName: 'Test User',
      })
      jest.spyOn(service as any, 'getUserNotificationPreferences').mockResolvedValue({
        achievementAlerts: true,
      })
      jest.spyOn(service as any, 'getAchievementData').mockResolvedValue({
        id: 'a1',
        name: 'Week Warrior',
        description: '7 day streak',
        icon: '🔥',
        rarity: 'rare',
        points: 50,
      })
      jest.spyOn(service as any, 'getUserAchievementStats').mockResolvedValue({
        totalPoints: 500,
        totalAchievements: 10,
        percentageComplete: 20,
        nextAchievements: [],
      })
      mockResendSend.mockResolvedValue({ data: { id: 'email-2' }, error: null })

      const result = await service.sendAchievementAlert('u1', 'a1')

      expect(result).toBe(true)
      expect(mockResendSend).toHaveBeenCalledTimes(1)
      expect(mockResendSend.mock.calls[0][0].subject).toContain('Achievement Unlocked')
    })
  })

  describe('sendWeeklyProgressReport', () => {
    it('sends weekly report when enabled', async () => {
      jest.spyOn(service as any, 'getUserData').mockResolvedValue({
        email: 'test@example.com',
        displayName: 'Test User',
      })
      jest.spyOn(service as any, 'getUserNotificationPreferences').mockResolvedValue({
        weeklyProgress: true,
      })
      jest.spyOn(service as any, 'getUserWeeklyStats').mockResolvedValue({
        stats: {
          totalReviews: 300,
          correctReviews: 250,
          accuracy: 83,
          studyTime: 240,
          daysStudied: 6,
          currentStreak: 14,
          longestStreak: 20,
        },
        progress: {
          kanjiLearned: 10,
          kanjiMastered: 4,
          vocabularyLearned: 20,
          sentencesCompleted: 8,
        },
        achievements: [],
        topPerformingDays: [{ day: 'Monday', reviews: 50 }],
      })
      mockResendSend.mockResolvedValue({ data: { id: 'email-3' }, error: null })

      const result = await service.sendWeeklyProgressReport('u1')

      expect(result).toBe(true)
      expect(mockResendSend).toHaveBeenCalledTimes(1)
      expect(mockResendSend.mock.calls[0][0].subject).toContain('Weekly Japanese Learning Report')
    })
  })

  describe('unsubscribe token', () => {
    it('generates base64 token containing userId and type', () => {
      const token = (service as any).generateUnsubscribeToken('u1', 'daily_reminder')
      const decoded = Buffer.from(token, 'base64').toString('utf8')
      expect(decoded).toContain('u1:daily_reminder:')
    })
  })
})
