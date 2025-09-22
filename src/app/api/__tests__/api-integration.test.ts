/**
 * Integration Tests for API Endpoints
 * Tests the server-side Firebase Admin SDK architecture
 */

import { NextRequest, NextResponse } from 'next/server'
import { POST as progressTrackPOST, GET as progressTrackGET } from '../progress/track/route'
import { POST as achievementUpdatePOST } from '../achievements/update-activity/route'
import { GET as subscriptionGET } from '../user/subscription/route'
import { adminDb } from '@/lib/firebase/admin'
import { getServerSession } from '@/lib/auth/session'
import { FieldValue } from 'firebase-admin/firestore'

// Mock Firebase Admin
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
            set: jest.fn()
          }))
        }))
      }))
    })),
    batch: jest.fn(() => ({
      set: jest.fn(),
      update: jest.fn(),
      commit: jest.fn()
    }))
  }
}))

// Mock auth session
jest.mock('@/lib/auth/session', () => ({
  getServerSession: jest.fn(),
  getSession: jest.fn()
}))

// Mock FieldValue
jest.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => new Date()),
    increment: jest.fn((n: number) => n)
  }
}))

describe('API Endpoint Integration Tests', () => {
  const mockSession = {
    uid: 'test-user-123',
    email: 'test@example.com'
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('/api/progress/track', () => {
    describe('POST - Save Progress', () => {
      it('should require authentication', async () => {
        (getServerSession as jest.Mock).mockResolvedValue(null)

        const request = new NextRequest('http://localhost/api/progress/track', {
          method: 'POST',
          body: JSON.stringify({
            contentType: 'hiragana',
            items: []
          })
        })

        const response = await progressTrackPOST(request)
        const data = await response.json()

        expect(response.status).toBe(401)
        expect(data.error).toBe('Unauthorized')
      })

      it('should validate required fields', async () => {
        (getServerSession as jest.Mock).mockResolvedValue(mockSession)

        const request = new NextRequest('http://localhost/api/progress/track', {
          method: 'POST',
          body: JSON.stringify({})
        })

        const response = await progressTrackPOST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toContain('Missing required fields')
      })

      it('should save progress for authenticated user', async () => {
        (getServerSession as jest.Mock).mockResolvedValue(mockSession)

        const mockUserDoc = {
          exists: true,
          data: () => ({
            subscription: { plan: 'premium_monthly' }
          })
        }

        const mockProgressRef = {
          set: jest.fn().mockResolvedValue(true)
        }

        const mockUserRef = {
          get: jest.fn().mockResolvedValue(mockUserDoc),
          collection: jest.fn().mockReturnValue({
            doc: jest.fn().mockReturnValue(mockProgressRef)
          })
        }

        ;(adminDb.collection as jest.Mock).mockReturnValue({
          doc: jest.fn().mockReturnValue(mockUserRef)
        })

        const request = new NextRequest('http://localhost/api/progress/track', {
          method: 'POST',
          body: JSON.stringify({
            contentType: 'hiragana',
            items: [
              ['あ', { contentId: 'あ', viewCount: 5 }],
              ['か', { contentId: 'か', viewCount: 3 }]
            ]
          })
        })

        const response = await progressTrackPOST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.itemsCount).toBe(2)
        expect(data.isPremium).toBe(true)
        expect(mockProgressRef.set).toHaveBeenCalled()
      })

      it('should save review history for premium users', async () => {
        (getServerSession as jest.Mock).mockResolvedValue(mockSession)

        const mockUserDoc = {
          exists: true,
          data: () => ({
            subscription: { plan: 'premium_monthly' }
          })
        }

        const mockBatch = {
          set: jest.fn(),
          commit: jest.fn().mockResolvedValue(true)
        }

        ;(adminDb.batch as jest.Mock).mockReturnValue(mockBatch)
        ;(adminDb.collection as jest.Mock).mockReturnValue({
          doc: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue(mockUserDoc),
            collection: jest.fn().mockReturnValue({
              doc: jest.fn().mockReturnValue({
                set: jest.fn()
              })
            })
          })
        })

        const request = new NextRequest('http://localhost/api/progress/track', {
          method: 'POST',
          body: JSON.stringify({
            contentType: 'hiragana',
            items: [['あ', { contentId: 'あ', viewCount: 1 }]],
            reviewHistory: [
              {
                contentId: 'あ',
                event: 'COMPLETED',
                correct: true,
                timestamp: new Date()
              }
            ]
          })
        })

        const response = await progressTrackPOST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(mockBatch.commit).toHaveBeenCalled()
        expect(mockBatch.set).toHaveBeenCalledTimes(1)
      })

      it('should handle free users correctly', async () => {
        (getServerSession as jest.Mock).mockResolvedValue(mockSession)

        const mockUserDoc = {
          exists: true,
          data: () => ({
            subscription: { plan: 'free' }
          })
        }

        const mockProgressRef = {
          set: jest.fn().mockResolvedValue(true)
        }

        ;(adminDb.collection as jest.Mock).mockReturnValue({
          doc: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue(mockUserDoc),
            collection: jest.fn().mockReturnValue({
              doc: jest.fn().mockReturnValue(mockProgressRef)
            })
          })
        })

        const request = new NextRequest('http://localhost/api/progress/track', {
          method: 'POST',
          body: JSON.stringify({
            contentType: 'hiragana',
            items: [['あ', { contentId: 'あ' }]],
            reviewHistory: [{ contentId: 'あ' }] // Should be ignored for free users
          })
        })

        const response = await progressTrackPOST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.isPremium).toBe(false)
        // Progress should still be saved for free users
        expect(mockProgressRef.set).toHaveBeenCalled()
      })
    })

    describe('GET - Load Progress', () => {
      it('should require authentication', async () => {
        (getServerSession as jest.Mock).mockResolvedValue(null)

        const request = new NextRequest('http://localhost/api/progress/track?contentType=hiragana')

        const response = await progressTrackGET(request)
        const data = await response.json()

        expect(response.status).toBe(401)
        expect(data.error).toBe('Unauthorized')
      })

      it('should validate contentType parameter', async () => {
        (getServerSession as jest.Mock).mockResolvedValue(mockSession)

        const request = new NextRequest('http://localhost/api/progress/track')

        const response = await progressTrackGET(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toContain('Missing contentType parameter')
      })

      it('should load progress data', async () => {
        (getServerSession as jest.Mock).mockResolvedValue(mockSession)

        const mockProgressDoc = {
          exists: true,
          data: () => ({
            items: {
              'あ': { contentId: 'あ', viewCount: 5 },
              'か': { contentId: 'か', viewCount: 3 }
            },
            lastUpdated: { toDate: () => new Date('2024-01-01') }
          })
        }

        ;(adminDb.collection as jest.Mock).mockReturnValue({
          doc: jest.fn().mockReturnValue({
            collection: jest.fn().mockReturnValue({
              doc: jest.fn().mockReturnValue({
                get: jest.fn().mockResolvedValue(mockProgressDoc)
              })
            })
          })
        })

        const request = new NextRequest('http://localhost/api/progress/track?contentType=hiragana')

        const response = await progressTrackGET(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.items).toEqual({
          'あ': { contentId: 'あ', viewCount: 5 },
          'か': { contentId: 'か', viewCount: 3 }
        })
        expect(data.contentType).toBe('hiragana')
        expect(data.lastUpdated).toBeDefined()
      })

      it('should return empty data for non-existent progress', async () => {
        (getServerSession as jest.Mock).mockResolvedValue(mockSession)

        const mockProgressDoc = {
          exists: false
        }

        ;(adminDb.collection as jest.Mock).mockReturnValue({
          doc: jest.fn().mockReturnValue({
            collection: jest.fn().mockReturnValue({
              doc: jest.fn().mockReturnValue({
                get: jest.fn().mockResolvedValue(mockProgressDoc)
              })
            })
          })
        })

        const request = new NextRequest('http://localhost/api/progress/track?contentType=hiragana')

        const response = await progressTrackGET(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.items).toEqual({})
        expect(data.contentType).toBe('hiragana')
      })
    })
  })

  describe('/api/achievements/update-activity', () => {
    it('should require authentication', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/achievements/update-activity', {
        method: 'POST',
        body: JSON.stringify({
          sessionType: 'hiragana',
          itemsReviewed: 10,
          accuracy: 80,
          duration: 300000
        })
      })

      const response = await achievementUpdatePOST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should calculate and update streak correctly', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(mockSession)

      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)

      const mockUserDoc = {
        exists: true,
        data: () => ({
          achievements: {
            currentStreak: 5,
            bestStreak: 10,
            lastActivity: { toDate: () => yesterday }
          }
        })
      }

      const mockUpdate = jest.fn().mockResolvedValue(true)

      ;(adminDb.collection as jest.Mock).mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue(mockUserDoc),
          update: mockUpdate
        })
      })

      const request = new NextRequest('http://localhost/api/achievements/update-activity', {
        method: 'POST',
        body: JSON.stringify({
          sessionType: 'hiragana',
          itemsReviewed: 10,
          accuracy: 80,
          duration: 300000
        })
      })

      const response = await achievementUpdatePOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.currentStreak).toBe(6) // Continued streak
      expect(data.bestStreak).toBe(10)
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          'achievements.currentStreak': 6,
          'achievements.bestStreak': 10
        })
      )
    })

    it('should reset streak if last activity was too long ago', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(mockSession)

      const today = new Date()
      const threeDaysAgo = new Date(today)
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

      const mockUserDoc = {
        exists: true,
        data: () => ({
          achievements: {
            currentStreak: 5,
            bestStreak: 10,
            lastActivity: { toDate: () => threeDaysAgo }
          }
        })
      }

      const mockUpdate = jest.fn().mockResolvedValue(true)

      ;(adminDb.collection as jest.Mock).mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue(mockUserDoc),
          update: mockUpdate
        })
      })

      const request = new NextRequest('http://localhost/api/achievements/update-activity', {
        method: 'POST',
        body: JSON.stringify({
          sessionType: 'hiragana',
          itemsReviewed: 10,
          accuracy: 80,
          duration: 300000
        })
      })

      const response = await achievementUpdatePOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.currentStreak).toBe(1) // Reset to 1
      expect(data.bestStreak).toBe(10) // Best streak maintained
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          'achievements.currentStreak': 1
        })
      )
    })

    it('should handle first-time users', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(mockSession)

      const mockUserDoc = {
        exists: false
      }

      const mockSet = jest.fn().mockResolvedValue(true)

      ;(adminDb.collection as jest.Mock).mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue(mockUserDoc),
          set: mockSet
        })
      })

      const request = new NextRequest('http://localhost/api/achievements/update-activity', {
        method: 'POST',
        body: JSON.stringify({
          sessionType: 'hiragana',
          itemsReviewed: 10,
          accuracy: 80,
          duration: 300000
        })
      })

      const response = await achievementUpdatePOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.currentStreak).toBe(1)
      expect(data.bestStreak).toBe(1)
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          achievements: expect.objectContaining({
            currentStreak: 1,
            bestStreak: 1,
            totalSessions: 1,
            totalTimeSpent: 300000,
            totalItemsLearned: 10
          })
        }),
        { merge: true }
      )
    })
  })

  describe('/api/user/subscription', () => {
    it('should require authentication', async () => {
      // Mock for getSession (different from getServerSession)
      const { getSession } = require('@/lib/auth/session')
      getSession.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/user/subscription')

      const response = await subscriptionGET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return premium subscription data', async () => {
      const { getSession } = require('@/lib/auth/session')
      getSession.mockResolvedValue(mockSession)

      const mockUserDoc = {
        exists: true,
        data: () => ({
          subscription: {
            plan: 'premium_monthly',
            status: 'active',
            currentPeriodEnd: {
              toDate: () => new Date('2024-12-31'),
              _seconds: 1735689600
            }
          }
        })
      }

      // Mock adminFirestore (different from adminDb)
      jest.mock('@/lib/firebase/admin', () => ({
        adminFirestore: {
          collection: jest.fn(() => ({
            doc: jest.fn(() => ({
              get: jest.fn(() => Promise.resolve(mockUserDoc))
            }))
          }))
        }
      }), { virtual: true })

      const { adminFirestore } = require('@/lib/firebase/admin')
      adminFirestore.collection = jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue(mockUserDoc)
        })
      })

      const request = new NextRequest('http://localhost/api/user/subscription')

      const response = await subscriptionGET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.subscription).toEqual({
        plan: 'premium_monthly',
        status: 'active',
        currentPeriodEnd: expect.any(String)
      })
    })

    it('should return free tier for users without subscription', async () => {
      const { getSession } = require('@/lib/auth/session')
      getSession.mockResolvedValue(mockSession)

      const mockUserDoc = {
        exists: true,
        data: () => ({})
      }

      const { adminFirestore } = require('@/lib/firebase/admin')
      adminFirestore.collection = jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue(mockUserDoc)
        })
      })

      const request = new NextRequest('http://localhost/api/user/subscription')

      const response = await subscriptionGET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.subscription).toEqual({
        plan: 'free',
        status: 'active'
      })
    })

    it('should handle non-existent users', async () => {
      const { getSession } = require('@/lib/auth/session')
      getSession.mockResolvedValue(mockSession)

      const mockUserDoc = {
        exists: false
      }

      const { adminFirestore } = require('@/lib/firebase/admin')
      adminFirestore.collection = jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue(mockUserDoc)
        })
      })

      const request = new NextRequest('http://localhost/api/user/subscription')

      const response = await subscriptionGET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.subscription).toEqual({
        plan: 'free',
        status: 'active'
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle Firebase errors gracefully', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(mockSession)

      ;(adminDb.collection as jest.Mock).mockImplementation(() => {
        throw new Error('Firebase connection failed')
      })

      const request = new NextRequest('http://localhost/api/progress/track', {
        method: 'POST',
        body: JSON.stringify({
          contentType: 'hiragana',
          items: []
        })
      })

      const response = await progressTrackPOST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to save progress')
    })

    it('should handle malformed request bodies', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(mockSession)

      const request = new NextRequest('http://localhost/api/progress/track', {
        method: 'POST',
        body: 'invalid json'
      })

      const response = await progressTrackPOST(request)

      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('Performance', () => {
    it('should handle large progress updates efficiently', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(mockSession)

      const largeItemsArray = Array.from({ length: 100 }, (_, i) => [
        `char-${i}`,
        { contentId: `char-${i}`, viewCount: i }
      ])

      const mockProgressRef = {
        set: jest.fn().mockResolvedValue(true)
      }

      ;(adminDb.collection as jest.Mock).mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ subscription: { plan: 'premium_monthly' } })
          }),
          collection: jest.fn().mockReturnValue({
            doc: jest.fn().mockReturnValue(mockProgressRef)
          })
        })
      })

      const startTime = Date.now()

      const request = new NextRequest('http://localhost/api/progress/track', {
        method: 'POST',
        body: JSON.stringify({
          contentType: 'hiragana',
          items: largeItemsArray
        })
      })

      const response = await progressTrackPOST(request)
      const endTime = Date.now()

      expect(response.status).toBe(200)
      expect(endTime - startTime).toBeLessThan(1000) // Should complete within 1 second
    })
  })
})