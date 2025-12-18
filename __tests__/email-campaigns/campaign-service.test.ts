/**
 * Email Campaign Service Tests
 * Tests the campaign service functionality including user segmentation and batch sending
 */

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals'
import { CampaignService } from '@/lib/email/campaigns/service'
import type { EmailCampaign } from '@/lib/email/campaigns/types'

// Mock Firebase Admin
jest.mock('@/lib/firebase/admin', () => ({
  ensureAdminInitialized: jest.fn(),
  adminAuth: {
    getUser: jest.fn(),
  },
  adminFirestore: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(),
        update: jest.fn(),
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            get: jest.fn(),
          })),
        })),
      })),
      where: jest.fn(() => ({
        where: jest.fn(() => ({
          get: jest.fn(),
        })),
        get: jest.fn(),
      })),
      get: jest.fn(),
    })),
  },
}))

// Mock Resend email service
jest.mock('@/lib/email/resend', () => ({
  sendEmail: jest.fn(),
}))

// Mock waitlist email template
jest.mock('@/lib/email/waitlistThankYou', () => ({
  buildWaitlistThankYouContent: jest.fn(() => ({
    html: '<p>Test email</p>',
    text: 'Test email',
  })),
}))

describe('CampaignService', () => {
  let service: CampaignService
  let mockFirestore: any
  let mockAuth: any
  let mockSendEmail: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()

    // Get mocked modules
    const { adminFirestore, adminAuth } = require('@/lib/firebase/admin')
    const { sendEmail } = require('@/lib/email/resend')

    mockFirestore = adminFirestore
    mockAuth = adminAuth
    mockSendEmail = sendEmail as jest.Mock

    service = new CampaignService()
  })

  describe('getUsersForSegment', () => {
    it('should filter free users correctly', async () => {
      // Mock Firestore query for all users
      const mockSnapshot = {
        size: 3,
        docs: [
          {
            id: 'user1',
            data: () => ({ subscription: { plan: 'free', status: 'active' } }),
          },
          {
            id: 'user2',
            data: () => ({ subscription: { plan: 'premium_monthly', status: 'active' } }),
          },
          {
            id: 'user3',
            data: () => ({}), // No subscription = free user
          },
        ],
      }

      mockFirestore.collection.mockReturnValue({
        get: jest.fn().mockResolvedValue(mockSnapshot),
      })

      // Mock Auth to return emails
      mockAuth.getUser.mockImplementation((uid: string) =>
        Promise.resolve({
          uid,
          email: `${uid}@test.com`,
          emailVerified: true,
        })
      )

      const segment = {
        type: 'free' as const,
        respectMarketingPrefs: false,
        emailVerifiedOnly: false,
      }

      const users = await service.getUsersForSegment(segment)

      // Should return user1 and user3 (both free), not user2 (premium)
      expect(users).toHaveLength(2)
      expect(users[0].email).toBe('user1@test.com')
      expect(users[1].email).toBe('user3@test.com')
    })

    it('should filter premium users correctly', async () => {
      const mockSnapshot = {
        size: 2,
        docs: [
          {
            id: 'premium1',
            data: () => ({ subscription: { plan: 'premium_monthly', status: 'active' } }),
          },
          {
            id: 'premium2',
            data: () => ({ subscription: { plan: 'premium_monthly', status: 'trialing' } }),
          },
        ],
      }

      mockFirestore.collection.mockReturnValue({
        where: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue(mockSnapshot),
          }),
        }),
      })

      mockAuth.getUser.mockImplementation((uid: string) =>
        Promise.resolve({
          uid,
          email: `${uid}@test.com`,
          emailVerified: true,
        })
      )

      const segment = {
        type: 'premium_monthly' as const,
        respectMarketingPrefs: false,
        emailVerifiedOnly: false,
      }

      const users = await service.getUsersForSegment(segment)

      expect(users).toHaveLength(2)
      expect(mockFirestore.collection).toHaveBeenCalledWith('users')
    })

    it('should respect email verification filter', async () => {
      const mockSnapshot = {
        size: 2,
        docs: [
          {
            id: 'user1',
            data: () => ({}),
          },
          {
            id: 'user2',
            data: () => ({}),
          },
        ],
      }

      mockFirestore.collection.mockReturnValue({
        get: jest.fn().mockResolvedValue(mockSnapshot),
      })

      // user1 verified, user2 not verified
      mockAuth.getUser.mockImplementation((uid: string) =>
        Promise.resolve({
          uid,
          email: `${uid}@test.com`,
          emailVerified: uid === 'user1',
        })
      )

      const segment = {
        type: 'all' as const,
        respectMarketingPrefs: false,
        emailVerifiedOnly: true,
      }

      const users = await service.getUsersForSegment(segment)

      // Only user1 should be returned (verified)
      expect(users).toHaveLength(1)
      expect(users[0].uid).toBe('user1')
    })

    it('should respect marketing preferences filter - exclude only explicit opt-outs', async () => {
      const mockSnapshot = {
        size: 3,
        docs: [
          {
            id: 'user1',
            data: () => ({}),
          },
          {
            id: 'user2',
            data: () => ({}),
          },
          {
            id: 'user3',
            data: () => ({}),
          },
        ],
      }

      mockFirestore.collection.mockReturnValue({
        get: jest.fn().mockResolvedValue(mockSnapshot),
        doc: jest.fn((uid: string) => ({
          collection: jest.fn(() => ({
            doc: jest.fn(() => ({
              get: jest.fn().mockResolvedValue({
                exists: uid !== 'user3', // user3 has no preferences doc
                data: () => ({
                  notifications: {
                    marketingEmails: uid === 'user1', // user1: true, user2: false, user3: no prefs
                  },
                }),
              }),
            })),
          })),
        })),
      })

      mockAuth.getUser.mockImplementation((uid: string) =>
        Promise.resolve({
          uid,
          email: `${uid}@test.com`,
          emailVerified: true,
        })
      )

      const segment = {
        type: 'all' as const,
        respectMarketingPrefs: true,
        emailVerifiedOnly: false,
      }

      const users = await service.getUsersForSegment(segment)

      // user1 (opted in) and user3 (no preference = default opt-in) should be returned
      // user2 (explicitly opted out) should be excluded
      expect(users).toHaveLength(2)
      expect(users.map((u) => u.uid).sort()).toEqual(['user1', 'user3'])
    })

    it('should skip users without email', async () => {
      const mockSnapshot = {
        size: 2,
        docs: [
          {
            id: 'user1',
            data: () => ({}),
          },
          {
            id: 'user2',
            data: () => ({}),
          },
        ],
      }

      mockFirestore.collection.mockReturnValue({
        get: jest.fn().mockResolvedValue(mockSnapshot),
      })

      // user1 has email, user2 doesn't
      mockAuth.getUser.mockImplementation((uid: string) => {
        if (uid === 'user1') {
          return Promise.resolve({
            uid,
            email: 'user1@test.com',
            emailVerified: true,
          })
        } else {
          return Promise.resolve({
            uid,
            email: null, // No email
            emailVerified: false,
          })
        }
      })

      const segment = {
        type: 'all' as const,
        respectMarketingPrefs: false,
        emailVerifiedOnly: false,
      }

      const users = await service.getUsersForSegment(segment)

      expect(users).toHaveLength(1)
      expect(users[0].uid).toBe('user1')
    })
  })

  describe('sendCampaign', () => {
    it('should send campaign to all eligible users', async () => {
      const mockCampaignData = {
        id: 'campaign1',
        name: 'Test Campaign',
        template: 'waitlist',
        subject: 'Test Subject',
        segment: {
          type: 'all',
          respectMarketingPrefs: false,
          emailVerifiedOnly: false,
        },
        status: 'draft',
        stats: {
          totalRecipients: 0,
          sentCount: 0,
          failedCount: 0,
          skippedCount: 0,
        },
      } as EmailCampaign

      const mockCampaignRef = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => mockCampaignData,
        }),
        update: jest.fn().mockResolvedValue({}),
      }

      mockFirestore.collection.mockReturnValue({
        doc: jest.fn(() => mockCampaignRef),
        get: jest.fn().mockResolvedValue({
          size: 2,
          docs: [
            {
              id: 'user1',
              data: () => ({}),
            },
            {
              id: 'user2',
              data: () => ({}),
            },
          ],
        }),
      })

      mockAuth.getUser.mockImplementation((uid: string) =>
        Promise.resolve({
          uid,
          email: `${uid}@test.com`,
          emailVerified: true,
        })
      )

      mockSendEmail.mockResolvedValue({})

      await service.sendCampaign('campaign1')

      // Verify campaign status was updated to 'sending'
      expect(mockCampaignRef.update).toHaveBeenCalledWith({ status: 'sending' })

      // Verify emails were sent
      expect(mockSendEmail).toHaveBeenCalledTimes(2)

      // Verify final status update to 'sent'
      expect(mockCampaignRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'sent',
        })
      )
    })

    it('should handle email send failures gracefully', async () => {
      const mockCampaignData = {
        id: 'campaign1',
        name: 'Test Campaign',
        template: 'waitlist',
        subject: 'Test Subject',
        segment: {
          type: 'all',
          respectMarketingPrefs: false,
          emailVerifiedOnly: false,
        },
        status: 'draft',
        stats: {
          totalRecipients: 0,
          sentCount: 0,
          failedCount: 0,
          skippedCount: 0,
        },
      } as EmailCampaign

      const mockCampaignRef = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => mockCampaignData,
        }),
        update: jest.fn().mockResolvedValue({}),
      }

      mockFirestore.collection.mockReturnValue({
        doc: jest.fn(() => mockCampaignRef),
        get: jest.fn().mockResolvedValue({
          size: 2,
          docs: [
            {
              id: 'user1',
              data: () => ({}),
            },
            {
              id: 'user2',
              data: () => ({}),
            },
          ],
        }),
      })

      mockAuth.getUser.mockImplementation((uid: string) =>
        Promise.resolve({
          uid,
          email: `${uid}@test.com`,
          emailVerified: true,
        })
      )

      // First email succeeds, second fails
      mockSendEmail
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Failed to send'))

      await service.sendCampaign('campaign1')

      // Should still complete with 1 sent, 1 failed
      expect(mockCampaignRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          'stats.sentCount': 1,
          'stats.failedCount': 1,
        })
      )

      // Should still mark as sent (partial success)
      expect(mockCampaignRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'sent',
        })
      )
    })

    it('should handle empty recipient list', async () => {
      const mockCampaignData = {
        id: 'campaign1',
        name: 'Test Campaign',
        template: 'waitlist',
        subject: 'Test Subject',
        segment: {
          type: 'all',
          respectMarketingPrefs: false,
          emailVerifiedOnly: false,
        },
        status: 'draft',
        stats: {
          totalRecipients: 0,
          sentCount: 0,
          failedCount: 0,
          skippedCount: 0,
        },
      } as EmailCampaign

      const mockCampaignRef = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => mockCampaignData,
        }),
        update: jest.fn().mockResolvedValue({}),
      }

      mockFirestore.collection.mockReturnValue({
        doc: jest.fn(() => mockCampaignRef),
        get: jest.fn().mockResolvedValue({
          size: 0,
          docs: [],
        }),
      })

      await service.sendCampaign('campaign1')

      // Should mark as sent with 0 recipients
      expect(mockCampaignRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          'stats.totalRecipients': 0,
        })
      )

      expect(mockCampaignRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'sent',
        })
      )

      // Should not attempt to send any emails
      expect(mockSendEmail).not.toHaveBeenCalled()
    })
  })

  describe('Rate Limiting', () => {
    it('should batch emails correctly', async () => {
      // This test verifies the batching logic conceptually
      // The actual rate limiting is tested through the sendCampaign integration test

      const mockCampaignData = {
        id: 'campaign1',
        name: 'Test Campaign',
        template: 'waitlist',
        subject: 'Test Subject',
        segment: {
          type: 'all',
          respectMarketingPrefs: false,
          emailVerifiedOnly: false,
        },
        status: 'draft',
        stats: {
          totalRecipients: 0,
          sentCount: 0,
          failedCount: 0,
          skippedCount: 0,
        },
      } as EmailCampaign

      const mockCampaignRef = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => mockCampaignData,
        }),
        update: jest.fn().mockResolvedValue({}),
      }

      // Create 75 users (will be sent in 2 batches of 50 and 25)
      const mockUsers = Array.from({ length: 75 }, (_, i) => ({
        id: `user${i}`,
        data: () => ({}),
      }))

      mockFirestore.collection.mockReturnValue({
        doc: jest.fn(() => mockCampaignRef),
        get: jest.fn().mockResolvedValue({
          size: 75,
          docs: mockUsers,
        }),
      })

      mockAuth.getUser.mockImplementation((uid: string) =>
        Promise.resolve({
          uid,
          email: `${uid}@test.com`,
          emailVerified: true,
        })
      )

      mockSendEmail.mockResolvedValue({})

      await service.sendCampaign('campaign1')

      // Verify all 75 emails were sent
      expect(mockSendEmail).toHaveBeenCalledTimes(75)

      // Verify progress updates occurred (at least once per batch)
      const updateCalls = mockCampaignRef.update.mock.calls.filter((call: any) =>
        call[0].hasOwnProperty('stats.sentCount')
      )
      expect(updateCalls.length).toBeGreaterThanOrEqual(2) // At least 2 batch updates
    })
  })
})
