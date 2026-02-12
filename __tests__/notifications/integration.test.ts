import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { EventEmitter } from 'events'

const mockResendSend = jest.fn()

jest.mock('resend', () => ({
  Resend: jest.fn(() => ({
    emails: {
      send: mockResendSend,
    },
  })),
}))

jest.mock('@/lib/firebase/config', () => ({
  db: null,
}))

jest.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        collection: jest.fn(() => ({
          add: jest.fn().mockResolvedValue({ id: 'log-1' }),
        })),
      })),
    })),
  },
}))

import { NotificationService } from '@/lib/notifications/notification-service'
import { attachAchievementNotifications } from '@/lib/notifications/achievement-notification-hook'

describe('Notification Integration', () => {
  let service: NotificationService

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_APP_URL = 'https://test.moshimoshi.app'
    process.env.RESEND_API_KEY = 'test_resend_key'
    service = NotificationService.getInstance()
  })

  it('sends daily reminder end-to-end through template + email sender', async () => {
    jest.spyOn(service as any, 'getUserData').mockResolvedValue({
      email: 'integration@test.com',
      displayName: 'Integration User',
    })
    jest.spyOn(service as any, 'getUserNotificationPreferences').mockResolvedValue({
      dailyReminder: true,
    })
    jest.spyOn(service as any, 'getUserStudyStats').mockResolvedValue({
      currentStreak: 15,
      totalReviews: 500,
      dueReviews: 30,
      lastStudyDate: new Date('2026-02-11T12:00:00.000Z'),
    })
    mockResendSend.mockResolvedValue({ data: { id: 'mail-1' }, error: null })

    const result = await service.sendDailyReminder('integration-user')

    expect(result).toBe(true)
    expect(mockResendSend).toHaveBeenCalledTimes(1)
    const email = mockResendSend.mock.calls[0][0]
    expect(email.to).toBe('integration@test.com')
    expect(email.html).toContain('Integration User')
    expect(email.html).toContain('30')
  })

  it('sends achievement email when hook receives achievementUnlocked event', async () => {
    const achievementSystem = new EventEmitter()

    jest.spyOn(service as any, 'getUserData').mockResolvedValue({
      email: 'integration@test.com',
      displayName: 'Integration User',
    })
    jest.spyOn(service as any, 'getUserNotificationPreferences').mockResolvedValue({
      achievementAlerts: true,
    })
    jest.spyOn(service as any, 'getAchievementData').mockResolvedValue({
      id: 'kanji-master',
      name: 'Kanji Master',
      description: 'Learned 100 kanji',
      icon: '🈷',
      rarity: 'rare',
      points: 100,
    })
    jest.spyOn(service as any, 'getUserAchievementStats').mockResolvedValue({
      totalPoints: 1200,
      totalAchievements: 25,
      percentageComplete: 35,
      nextAchievements: [],
    })
    mockResendSend.mockResolvedValue({ data: { id: 'mail-2' }, error: null })

    const hook = attachAchievementNotifications(achievementSystem, 'integration-user')

    achievementSystem.emit('achievementUnlocked', { id: 'kanji-master' })
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(mockResendSend).toHaveBeenCalledTimes(1)
    expect(mockResendSend.mock.calls[0][0].subject).toContain('Kanji Master')
    hook.destroy()
  })
})
