/**
 * API Endpoints Tests
 * Tests all notification-related API endpoints
 */

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals'
import { NextRequest } from 'next/server'
import { GET as dailyReminderGET, POST as dailyReminderPOST } from '@/app/api/notifications/daily-reminder/route'
import { GET as weeklyProgressGET, POST as weeklyProgressPOST } from '@/app/api/notifications/weekly-progress/route'
import { GET as unsubscribeGET, POST as unsubscribePOST } from '@/app/api/notifications/unsubscribe/route'

// Mock Next.js headers
jest.mock('next/headers', () => ({
  headers: jest.fn(() => ({
    get: jest.fn(),
  })),
}))

// Mock Firebase Admin
jest.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: jest.fn(),
  },
}))

// Mock notification service
jest.mock('@/lib/notifications/notification-service', () => ({
  notificationService: {
    sendDailyReminder: jest.fn(),
    sendWeeklyProgressReport: jest.fn(),
  },
}))

describe('Daily Reminder API Endpoint', () => {
  let mockHeaders: jest.Mock
  const mockCronSecret = 'test-cron-secret'

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.CRON_SECRET = mockCronSecret

    const { headers } = require('next/headers')
    mockHeaders = headers().get
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('GET /api/notifications/daily-reminder', () => {
    it('should reject requests without proper authorization', async () => {
      mockHeaders.mockReturnValue('invalid-token')

      const request = new NextRequest('http://localhost/api/notifications/daily-reminder')
      const response = await dailyReminderGET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should accept requests with valid cron secret', async () => {
      mockHeaders.mockReturnValue(`Bearer ${mockCronSecret}`)

      const { adminDb } = require('@/lib/firebase/admin')
      adminDb.collection.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          size: 0,
          docs: [],
        }),
      })

      const request = new NextRequest('http://localhost/api/notifications/daily-reminder')
      const response = await dailyReminderGET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.results).toBeDefined()
    })

    it('should process users with daily reminders enabled', async () => {
      mockHeaders.mockReturnValue(`Bearer ${mockCronSecret}`)

      const mockUsers = [
        {
          id: 'user1',
          data: () => ({
            preferences: {
              notifications: {
                timezone: 'UTC',
                reminderTime: '09:00',
                dailyReminder: true,
              },
            },
          }),
        },
        {
          id: 'user2',
          data: () => ({
            preferences: {
              notifications: {
                timezone: 'UTC',
                reminderTime: '09:00',
                dailyReminder: true,
              },
            },
          }),
        },
      ]

      const { adminDb } = require('@/lib/firebase/admin')
      adminDb.collection.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          size: mockUsers.length,
          docs: mockUsers,
        }),
      })

      // Mock notification logs check
      mockUsers.forEach(user => {
        adminDb.collection.mockImplementation(() => ({
          doc: jest.fn(() => ({
            collection: jest.fn(() => ({
              where: jest.fn().mockReturnThis(),
              limit: jest.fn().mockReturnThis(),
              get: jest.fn().mockResolvedValue({ empty: true }),
            })),
          })),
          where: jest.fn().mockReturnThis(),
          get: jest.fn().mockResolvedValue({
            size: mockUsers.length,
            docs: mockUsers,
          }),
        }))
      })

      const { notificationService } = require('@/lib/notifications/notification-service')
      notificationService.sendDailyReminder.mockResolvedValue(true)

      // Mock date to match reminder time
      const mockDate = new Date('2024-01-20T09:00:00Z')
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any)

      const request = new NextRequest('http://localhost/api/notifications/daily-reminder')
      const response = await dailyReminderGET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.results.total).toBe(2)
    })

    it('should skip users already notified today', async () => {
      mockHeaders.mockReturnValue(`Bearer ${mockCronSecret}`)

      const mockUser = {
        id: 'user1',
        data: () => ({
          preferences: {
            notifications: {
              timezone: 'UTC',
              reminderTime: '09:00',
              dailyReminder: true,
            },
          },
        }),
      }

      const { adminDb } = require('@/lib/firebase/admin')
      adminDb.collection.mockImplementation(() => ({
        doc: jest.fn(() => ({
          collection: jest.fn(() => ({
            where: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue({
              empty: false,  // User already notified
              docs: [{ data: () => ({ sentAt: new Date() }) }],
            }),
          })),
        })),
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          size: 1,
          docs: [mockUser],
        }),
      }))

      const request = new NextRequest('http://localhost/api/notifications/daily-reminder')
      const response = await dailyReminderGET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.results.skipped).toBe(1)

      const { notificationService } = require('@/lib/notifications/notification-service')
      expect(notificationService.sendDailyReminder).not.toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      mockHeaders.mockReturnValue(`Bearer ${mockCronSecret}`)

      const { adminDb } = require('@/lib/firebase/admin')
      adminDb.collection.mockImplementation(() => {
        throw new Error('Database error')
      })

      const request = new NextRequest('http://localhost/api/notifications/daily-reminder')
      const response = await dailyReminderGET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
      expect(data.message).toContain('Database error')
    })
  })

  describe('POST /api/notifications/daily-reminder', () => {
    it('should require authentication', async () => {
      mockHeaders.mockReturnValue(null)

      const request = new NextRequest('http://localhost/api/notifications/daily-reminder', {
        method: 'POST',
        body: JSON.stringify({ userId: 'test-user' }),
      })

      const response = await dailyReminderPOST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should require userId in request body', async () => {
      mockHeaders.mockReturnValue('Bearer valid-token')

      const request = new NextRequest('http://localhost/api/notifications/daily-reminder', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await dailyReminderPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('User ID required')
    })

    it('should send reminder to specific user', async () => {
      mockHeaders.mockReturnValue('Bearer valid-token')

      const { notificationService } = require('@/lib/notifications/notification-service')
      notificationService.sendDailyReminder.mockResolvedValue(true)

      const request = new NextRequest('http://localhost/api/notifications/daily-reminder', {
        method: 'POST',
        body: JSON.stringify({ userId: 'test-user-123' }),
      })

      const response = await dailyReminderPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Reminder sent successfully')
      expect(notificationService.sendDailyReminder).toHaveBeenCalledWith('test-user-123')
    })

    it('should handle send failure', async () => {
      mockHeaders.mockReturnValue('Bearer valid-token')

      const { notificationService } = require('@/lib/notifications/notification-service')
      notificationService.sendDailyReminder.mockResolvedValue(false)

      const request = new NextRequest('http://localhost/api/notifications/daily-reminder', {
        method: 'POST',
        body: JSON.stringify({ userId: 'test-user-123' }),
      })

      const response = await dailyReminderPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(false)
      expect(data.message).toBe('Failed to send reminder')
    })
  })
})

describe('Weekly Progress API Endpoint', () => {
  let mockHeaders: jest.Mock
  const mockCronSecret = 'test-cron-secret'

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.CRON_SECRET = mockCronSecret

    const { headers } = require('next/headers')
    mockHeaders = headers().get
  })

  describe('GET /api/notifications/weekly-progress', () => {
    it('should only run on Sundays', async () => {
      mockHeaders.mockReturnValue(`Bearer ${mockCronSecret}`)

      // Mock a Monday
      const monday = new Date('2024-01-22T18:00:00Z')  // Monday
      jest.spyOn(global, 'Date').mockImplementation(() => monday as any)

      const request = new NextRequest('http://localhost/api/notifications/weekly-progress')
      const response = await weeklyProgressGET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('Not Sunday')
      expect(data.currentDay).toBe(1)  // Monday = 1
    })

    it('should process users on Sunday', async () => {
      mockHeaders.mockReturnValue(`Bearer ${mockCronSecret}`)

      // Mock a Sunday
      const sunday = new Date('2024-01-21T18:00:00Z')  // Sunday
      jest.spyOn(global, 'Date').mockImplementation(() => sunday as any)

      const mockUsers = [
        {
          id: 'user1',
          data: () => ({
            preferences: {
              notifications: {
                weeklyProgress: true,
              },
            },
          }),
        },
      ]

      const { adminDb } = require('@/lib/firebase/admin')
      adminDb.collection.mockImplementation(() => ({
        doc: jest.fn(() => ({
          collection: jest.fn(() => ({
            where: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue({
              empty: false,
              docs: [{
                data: () => ({
                  createdAt: {
                    toMillis: () => Date.now() - 86400000,  // 1 day ago
                  },
                }),
              }],
            }),
            add: jest.fn(),
          })),
        })),
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          size: mockUsers.length,
          docs: mockUsers,
        }),
        add: jest.fn(),
      }))

      const { notificationService } = require('@/lib/notifications/notification-service')
      notificationService.sendWeeklyProgressReport.mockResolvedValue(true)

      const request = new NextRequest('http://localhost/api/notifications/weekly-progress')
      const response = await weeklyProgressGET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.results.sent).toBe(1)
    })

    it('should skip inactive users (30+ days)', async () => {
      mockHeaders.mockReturnValue(`Bearer ${mockCronSecret}`)

      // Mock Sunday
      const sunday = new Date('2024-01-21T18:00:00Z')
      jest.spyOn(global, 'Date').mockImplementation(() => sunday as any)

      const mockUser = {
        id: 'inactive-user',
        data: () => ({
          preferences: {
            notifications: {
              weeklyProgress: true,
            },
          },
        }),
      }

      const { adminDb } = require('@/lib/firebase/admin')
      adminDb.collection.mockImplementation(() => ({
        doc: jest.fn(() => ({
          collection: jest.fn(() => ({
            where: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue({
              empty: false,
              docs: [{
                data: () => ({
                  createdAt: {
                    toMillis: () => Date.now() - (31 * 86400000),  // 31 days ago
                  },
                }),
              }],
            }),
          })),
        })),
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          size: 1,
          docs: [mockUser],
        }),
        add: jest.fn(),
      }))

      const request = new NextRequest('http://localhost/api/notifications/weekly-progress')
      const response = await weeklyProgressGET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.results.skipped).toBe(1)

      const { notificationService } = require('@/lib/notifications/notification-service')
      expect(notificationService.sendWeeklyProgressReport).not.toHaveBeenCalled()
    })

    it('should log job execution', async () => {
      mockHeaders.mockReturnValue(`Bearer ${mockCronSecret}`)

      // Mock Sunday
      const sunday = new Date('2024-01-21T18:00:00Z')
      jest.spyOn(global, 'Date').mockImplementation(() => sunday as any)

      const { adminDb } = require('@/lib/firebase/admin')
      const addMock = jest.fn()

      adminDb.collection.mockImplementation((collection: string) => {
        if (collection === 'cronJobs') {
          return { add: addMock }
        }
        return {
          where: jest.fn().mockReturnThis(),
          get: jest.fn().mockResolvedValue({ size: 0, docs: [] }),
        }
      })

      const request = new NextRequest('http://localhost/api/notifications/weekly-progress')
      await weeklyProgressGET(request)

      expect(addMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'weekly_progress',
          executedAt: expect.any(Date),
          results: expect.any(Object),
        })
      )
    })
  })

  describe('POST /api/notifications/weekly-progress', () => {
    it('should send weekly report to specific user', async () => {
      mockHeaders.mockReturnValue('Bearer valid-token')

      const { notificationService } = require('@/lib/notifications/notification-service')
      notificationService.sendWeeklyProgressReport.mockResolvedValue(true)

      const request = new NextRequest('http://localhost/api/notifications/weekly-progress', {
        method: 'POST',
        body: JSON.stringify({ userId: 'test-user-123' }),
      })

      const response = await weeklyProgressPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Weekly report sent successfully')
      expect(notificationService.sendWeeklyProgressReport).toHaveBeenCalledWith('test-user-123')
    })
  })
})

describe('Unsubscribe API Endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_APP_URL = 'https://test.app'
  })

  describe('GET /api/notifications/unsubscribe', () => {
    it('should require token parameter', async () => {
      const request = new NextRequest('http://localhost/api/notifications/unsubscribe')
      const response = await unsubscribeGET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid unsubscribe link')
    })

    it('should validate token format', async () => {
      const request = new NextRequest('http://localhost/api/notifications/unsubscribe?token=invalid')
      const response = await unsubscribeGET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid unsubscribe token')
    })

    it('should check token expiration', async () => {
      // Create expired token (25 hours old)
      const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000)
      const token = Buffer.from(`user123:daily_reminder:${oldTimestamp}`).toString('base64')

      const request = new NextRequest(`http://localhost/api/notifications/unsubscribe?token=${token}`)
      const response = await unsubscribeGET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Unsubscribe link has expired')
    })

    it('should unsubscribe user successfully', async () => {
      // Create valid token
      const timestamp = Date.now()
      const token = Buffer.from(`user123:daily_reminder:${timestamp}`).toString('base64')

      const { adminDb } = require('@/lib/firebase/admin')
      const updateMock = jest.fn()
      const addMock = jest.fn()

      adminDb.collection.mockImplementation(() => ({
        doc: jest.fn(() => ({
          collection: jest.fn(() => ({
            doc: jest.fn(() => ({
              update: updateMock,
            })),
            add: addMock,
          })),
        })),
      }))

      const request = new NextRequest(`http://localhost/api/notifications/unsubscribe?token=${token}`)
      const response = await unsubscribeGET(request)

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('text/html')

      const html = await response.text()
      expect(html).toContain('Successfully Unsubscribed')
      expect(html).toContain('daily reminder')

      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          'notifications.dailyReminder': false,
        })
      )

      expect(addMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'unsubscribe',
          notificationType: 'daily_reminder',
        })
      )
    })

    it('should return user-friendly HTML page', async () => {
      const timestamp = Date.now()
      const token = Buffer.from(`user123:weekly_progress:${timestamp}`).toString('base64')

      const { adminDb } = require('@/lib/firebase/admin')
      adminDb.collection.mockImplementation(() => ({
        doc: jest.fn(() => ({
          collection: jest.fn(() => ({
            doc: jest.fn(() => ({
              update: jest.fn(),
            })),
            add: jest.fn(),
          })),
        })),
      }))

      const request = new NextRequest(`http://localhost/api/notifications/unsubscribe?token=${token}`)
      const response = await unsubscribeGET(request)
      const html = await response.text()

      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('Manage Preferences')
      expect(html).toContain('Back to App')
      expect(html).toContain(process.env.NEXT_PUBLIC_APP_URL)
    })
  })

  describe('POST /api/notifications/unsubscribe', () => {
    it('should unsubscribe from specific notification type', async () => {
      const { adminDb } = require('@/lib/firebase/admin')
      const updateMock = jest.fn()

      adminDb.collection.mockImplementation(() => ({
        doc: jest.fn(() => ({
          collection: jest.fn(() => ({
            doc: jest.fn(() => ({
              update: updateMock,
            })),
          })),
        })),
      }))

      const request = new NextRequest('http://localhost/api/notifications/unsubscribe', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'test-user',
          notificationType: 'achievement_alerts',
        }),
      })

      const response = await unsubscribePOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Unsubscribed from achievement_alerts notifications')

      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          'notifications.achievementAlerts': false,
        })
      )
    })

    it('should unsubscribe from all notifications', async () => {
      const { adminDb } = require('@/lib/firebase/admin')
      const updateMock = jest.fn()

      adminDb.collection.mockImplementation(() => ({
        doc: jest.fn(() => ({
          collection: jest.fn(() => ({
            doc: jest.fn(() => ({
              update: updateMock,
            })),
          })),
        })),
      }))

      const request = new NextRequest('http://localhost/api/notifications/unsubscribe', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'test-user',
          notificationType: 'all',
        }),
      })

      const response = await unsubscribePOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          'notifications.dailyReminder': false,
          'notifications.achievementAlerts': false,
          'notifications.weeklyProgress': false,
          'notifications.marketingEmails': false,
        })
      )
    })

    it('should reject invalid notification types', async () => {
      const request = new NextRequest('http://localhost/api/notifications/unsubscribe', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'test-user',
          notificationType: 'invalid_type',
        }),
      })

      const response = await unsubscribePOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid notification type')
    })

    it('should require userId and notificationType', async () => {
      const request = new NextRequest('http://localhost/api/notifications/unsubscribe', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await unsubscribePOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Missing required fields')
    })
  })
})