/**
 * XP API Endpoints Tests
 * Test the /api/xp/track endpoint with all scenarios
 */

/**
 * @jest-environment node
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'

// Mock upstash/redis BEFORE anything else to prevent import errors
jest.mock('@upstash/redis', () => ({
  Redis: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    expire: jest.fn(),
    sadd: jest.fn(),
    srem: jest.fn(),
    sismember: jest.fn(),
    smembers: jest.fn()
  }))
}))

// Mock redis client
jest.mock('@/lib/redis/client', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    expire: jest.fn()
  }
}))

jest.mock('@/lib/auth/session')
jest.mock('@/lib/firebase/admin')
jest.mock('@/lib/gamification/xp-system', () => ({
  xpSystem: {
    getLevelFromXP: jest.fn((xp) => Math.floor(xp / 100) + 1),
    getUserLevel: jest.fn((xp) => ({
      currentLevel: Math.floor(xp / 100) + 1,
      currentXP: xp % 100,
      xpToNextLevel: 100 - (xp % 100),
      progressPercentage: (xp % 100),
      title: 'Student',
      nextLevelTitle: 'Apprentice',
      totalXP: xp
    })),
    getLevelBadge: jest.fn(() => '🎓'),
    getLevelColor: jest.fn(() => 'from-blue-400 to-blue-600'),
    getXPMultiplier: jest.fn((level) => level >= 20 ? 1.2 : 1.0),
    calculateXPForLevel: jest.fn((level) => (level - 1) * 100)
  }
}))

// Now import after all mocks are set up
import '../setup/jest-setup'
import { NextRequest } from 'next/server'
import { POST, GET } from '@/app/api/xp/track/route'
import * as sessionModule from '@/lib/auth/session'
import * as firebaseAdmin from '@/lib/firebase/admin'

const mockSession = sessionModule as jest.Mocked<typeof sessionModule>
const mockFirebase = firebaseAdmin as jest.Mocked<typeof firebaseAdmin>

describe('XP API Endpoints', () => {
  let mockUserRef: any
  let mockHistoryRef: any
  let mockBatch: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup Firebase mocks
    mockBatch = {
      update: jest.fn(),
      set: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined)
    }

    mockHistoryRef = {
      set: jest.fn()
    }

    mockUserRef = {
      get: jest.fn().mockResolvedValue({
        data: () => ({
          progress: {
            totalXp: 100,
            currentLevel: 2
          },
          subscription: {
            plan: 'free'
          }
        })
      }),
      update: jest.fn()
    }

    const mockCollection = {
      doc: jest.fn(() => ({
        get: mockUserRef.get,
        update: mockUserRef.update,
        collection: jest.fn(() => ({
          doc: jest.fn(() => mockHistoryRef)
        }))
      }))
    }

    mockFirebase.adminDb = {
      collection: jest.fn(() => mockCollection),
      batch: jest.fn(() => mockBatch)
    } as any

    mockFirebase.FieldValue = {
      serverTimestamp: jest.fn(() => new Date()),
      increment: jest.fn((n) => n)
    } as any
  })

  describe('POST /api/xp/track', () => {
    it('should successfully track XP for authenticated user', async () => {
      mockSession.requireAuth.mockResolvedValue({ uid: 'user123' } as any)

      const request = new NextRequest('http://localhost/api/xp/track', {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'review_completed',
          amount: 10,
          source: 'Test review',
          metadata: { contentType: 'kanji' }
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveProperty('xpGained')
      expect(data.data).toHaveProperty('totalXP')
      expect(data.data).toHaveProperty('currentLevel')
    })

    it('should apply premium multiplier for premium users', async () => {
      mockSession.requireAuth.mockResolvedValue({ uid: 'premium123' } as any)

      mockUserRef.get.mockResolvedValue({
        data: () => ({
          progress: {
            totalXp: 500,
            currentLevel: 10
          },
          subscription: {
            plan: 'premium_monthly'
          }
        })
      })

      const request = new NextRequest('http://localhost/api/xp/track', {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'review_completed',
          amount: 10,
          source: 'Premium review'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.xpGained).toBeGreaterThan(10) // Should have multiplier
    })

    it('should detect and handle level ups', async () => {
      mockSession.requireAuth.mockResolvedValue({ uid: 'levelup123' } as any)

      // User is very close to leveling up
      mockUserRef.get.mockResolvedValue({
        data: () => ({
          progress: {
            totalXp: 195, // Just 5 XP away from level 3
            currentLevel: 2
          },
          subscription: {
            plan: 'free'
          }
        })
      })

      const request = new NextRequest('http://localhost/api/xp/track', {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'review_completed',
          amount: 10,
          source: 'Level up review'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.leveledUp).toBe(true)
      expect(data.data.levelUpBonus).toBeDefined()
      expect(data.data.newLevelTitle).toBeDefined()
      expect(data.data.levelBadge).toBeDefined()
    })

    it('should validate input and reject invalid event types', async () => {
      mockSession.requireAuth.mockResolvedValue({ uid: 'user123' } as any)

      const request = new NextRequest('http://localhost/api/xp/track', {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'invalid_event',
          amount: 10,
          source: 'Test'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject negative XP amounts', async () => {
      mockSession.requireAuth.mockResolvedValue({ uid: 'user123' } as any)

      const request = new NextRequest('http://localhost/api/xp/track', {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'review_completed',
          amount: -10,
          source: 'Test'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should cap XP at maximum allowed (1000)', async () => {
      mockSession.requireAuth.mockResolvedValue({ uid: 'user123' } as any)

      const request = new NextRequest('http://localhost/api/xp/track', {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'review_completed',
          amount: 5000,
          source: 'Test'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should require authentication', async () => {
      mockSession.requireAuth.mockRejectedValue(new Error('Unauthorized'))

      const request = new NextRequest('http://localhost/api/xp/track', {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'review_completed',
          amount: 10,
          source: 'Test'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('AUTH_REQUIRED')
    })

    it('should handle Firebase errors gracefully', async () => {
      mockSession.requireAuth.mockResolvedValue({ uid: 'user123' } as any)
      mockBatch.commit.mockRejectedValue(new Error('Firebase error'))

      const request = new NextRequest('http://localhost/api/xp/track', {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'review_completed',
          amount: 10,
          source: 'Test'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })

    it('should store XP history with all metadata', async () => {
      mockSession.requireAuth.mockResolvedValue({ uid: 'user123' } as any)

      const metadata = {
        contentType: 'kanji',
        contentId: 'kanji-1',
        sessionId: 'session-123',
        correct: true,
        responseTime: 1500
      }

      const request = new NextRequest('http://localhost/api/xp/track', {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'review_completed',
          amount: 15,
          source: 'Kanji review',
          metadata
        })
      })

      await POST(request)

      // Verify XP history was saved with metadata
      expect(mockBatch.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: 'review_completed',
          xpGained: 15,
          source: 'Kanji review',
          metadata: expect.objectContaining(metadata),
          userId: 'user123'
        })
      )
    })
  })

  describe('GET /api/xp/track', () => {
    it('should return current XP status for authenticated user', async () => {
      mockSession.requireAuth.mockResolvedValue({ uid: 'user123' } as any)

      const mockHistoryDocs = [
        { id: '1', data: () => ({ xpGained: 10, timestamp: new Date() }) },
        { id: '2', data: () => ({ xpGained: 15, timestamp: new Date() }) }
      ]

      mockFirebase.adminDb = {
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({
              data: () => ({
                progress: {
                  totalXp: 250,
                  currentLevel: 5,
                  lastXpGain: 10,
                  updatedAt: new Date()
                }
              })
            }),
            collection: jest.fn(() => ({
              orderBy: jest.fn(() => ({
                limit: jest.fn(() => ({
                  get: jest.fn().mockResolvedValue({
                    docs: mockHistoryDocs
                  })
                }))
              }))
            }))
          }))
        }))
      } as any

      const request = new NextRequest('http://localhost/api/xp/status', {
        method: 'GET'
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.totalXP).toBe(250)
      expect(data.data.currentLevel).toBe(5)
      expect(data.data.recentEvents).toHaveLength(2)
    })

    it('should handle users with no XP data', async () => {
      mockSession.requireAuth.mockResolvedValue({ uid: 'newuser' } as any)

      mockFirebase.adminDb = {
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({
              data: () => ({})
            }),
            collection: jest.fn(() => ({
              orderBy: jest.fn(() => ({
                limit: jest.fn(() => ({
                  get: jest.fn().mockResolvedValue({
                    docs: []
                  })
                }))
              }))
            }))
          }))
        }))
      } as any

      const request = new NextRequest('http://localhost/api/xp/status', {
        method: 'GET'
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.totalXP).toBe(0)
      expect(data.data.currentLevel).toBe(1)
      expect(data.data.recentEvents).toEqual([])
    })

    it('should require authentication for GET requests', async () => {
      mockSession.requireAuth.mockRejectedValue(new Error('Unauthorized'))

      const request = new NextRequest('http://localhost/api/xp/status', {
        method: 'GET'
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('AUTH_REQUIRED')
    })
  })
})