/**
 * XP API Endpoints Tests - Isolated Version
 * Tests the actual API route logic with proper mocking
 */

/**
 * @jest-environment node
 */

// Define mocks for global objects FIRST
class MockHeaders {
  private headers: Map<string, string> = new Map()

  get(name: string) { return this.headers.get(name) || null }
  set(name: string, value: string) { this.headers.set(name, value) }
  has(name: string) { return this.headers.has(name) }
  append(name: string, value: string) { this.headers.set(name, value) }
  delete(name: string) { this.headers.delete(name) }
  forEach(cb: (value: string, key: string) => void) {
    this.headers.forEach(cb)
  }
}

class MockRequest {
  public url: string
  public method: string
  public headers: MockHeaders
  private body: any

  constructor(url: string, init?: { method?: string; body?: string; headers?: any }) {
    this.url = url
    this.method = init?.method || 'GET'
    this.headers = new MockHeaders()
    this.body = init?.body

    if (init?.headers) {
      Object.entries(init.headers).forEach(([k, v]) => {
        this.headers.set(k, v as string)
      })
    }
  }

  async json() {
    try {
      return typeof this.body === 'string' ? JSON.parse(this.body) : this.body
    } catch (e) {
      return {}
    }
  }
}

class MockResponse {
  public body: any
  public status: number
  public headers: MockHeaders

  constructor(body: any, init?: { status?: number; headers?: any }) {
    this.body = body
    this.status = init?.status || 200
    this.headers = new MockHeaders()

    if (init?.headers) {
      Object.entries(init.headers).forEach(([k, v]) => {
        this.headers.set(k, v as string)
      })
    }
  }

  static json(body: any, init?: { status?: number; headers?: any }) {
    const response = new MockResponse(body, init)
    response.headers.set('content-type', 'application/json')
    return response
  }

  async json() {
    return this.body
  }
}

// Set globals BEFORE any imports
global.Request = MockRequest as any
global.Response = MockResponse as any
global.Headers = MockHeaders as any

import { describe, it, expect, beforeEach, jest } from '@jest/globals'

// First, set up all module mocks before any code is imported
jest.mock('@upstash/redis', () => ({
  Redis: jest.fn(() => ({
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

jest.mock('@/lib/redis/client', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn(),
    expire: jest.fn().mockResolvedValue(1)
  }
}))

jest.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: jest.fn(),
    batch: jest.fn()
  }
}))

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => new Date()),
    increment: jest.fn((n) => n)
  },
  Timestamp: {
    now: jest.fn(() => new Date())
  }
}))

jest.mock('@/lib/auth/session', () => ({
  requireAuth: jest.fn(),
  getSession: jest.fn()
}))

// Don't mock zod, let it work normally

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
      totalXP: xp,
      rank: 0,
      recentXPEvents: []
    })),
    getLevelBadge: jest.fn(() => '🎓'),
    getLevelColor: jest.fn(() => 'from-blue-400 to-blue-600'),
    getXPMultiplier: jest.fn((level) => level >= 20 ? 1.2 : 1.0),
    calculateXPForLevel: jest.fn((level) => (level - 1) * 100)
  }
}))

// Extended mock classes for Next.js
class MockNextRequest extends MockRequest {
  public nextUrl: any
  private _body: any

  constructor(url: string, init?: { method?: string; body?: string; headers?: any }) {
    super(url, init)
    this._body = init?.body
    const parsedUrl = new URL(url)
    this.nextUrl = {
      pathname: parsedUrl.pathname,
      searchParams: parsedUrl.searchParams,
      href: parsedUrl.href,
      origin: parsedUrl.origin
    }
  }

  async json() {
    try {
      return typeof this._body === 'string' ? JSON.parse(this._body) : this._body
    } catch (e) {
      console.error('Failed to parse body:', this._body)
      return {}
    }
  }
}

class MockNextResponse extends MockResponse {
  static json(body: any, init?: { status?: number; headers?: any }) {
    const response = new MockNextResponse(body, init)
    response.headers.set('content-type', 'application/json')
    return response
  }
}

// Mock next/server
jest.mock('next/server', () => ({
  NextRequest: MockNextRequest,
  NextResponse: MockNextResponse
}))

// NOW import the route handlers after all mocks are in place
import { POST, GET } from '@/app/api/xp/track/route'
import { requireAuth } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { xpSystem } from '@/lib/gamification/xp-system'

describe('XP API Endpoints - Isolated', () => {
  let mockBatch: any
  let mockUserDoc: any
  let mockHistoryRef: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup mock batch
    mockBatch = {
      update: jest.fn(),
      set: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined)
    }

    // Setup mock history ref
    mockHistoryRef = {
      set: jest.fn()
    }

    // Setup mock user doc with data
    mockUserDoc = {
      data: jest.fn(() => ({
        progress: {
          totalXp: 100,
          currentLevel: 2
        },
        subscription: {
          plan: 'free'
        }
      }))
    }

    // Configure Firebase admin mocks - need to mock the nested structure properly
    const mockUserRef = {
      get: jest.fn().mockResolvedValue(mockUserDoc),
      update: jest.fn(),
      collection: jest.fn(() => ({
        doc: jest.fn(() => mockHistoryRef)
      }))
    }

    // Mock the collection chain: adminDb.collection('users').doc(uid)
    const mockUsersCollection = {
      doc: jest.fn((docId) => {
        if (docId) {
          // This is for users/{uid}
          return mockUserRef
        }
        return mockHistoryRef
      })
    }

    ;(adminDb.collection as jest.Mock).mockImplementation((collectionName) => {
      if (collectionName === 'users') {
        return mockUsersCollection
      }
      return {
        doc: jest.fn(() => mockHistoryRef)
      }
    })

    ;(adminDb.batch as jest.Mock).mockReturnValue(mockBatch)
  })

  describe('POST /api/xp/track', () => {
    it('should successfully track XP for authenticated user', async () => {
      ;(requireAuth as jest.Mock).mockResolvedValue({ uid: 'user123' })

      const request = new MockNextRequest('http://localhost/api/xp/track', {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'review_completed',
          amount: 10,
          source: 'Test review'
        })
      }) as any

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveProperty('xpGained')
      expect(data.data.xpGained).toBe(10)
      expect(data.data).toHaveProperty('totalXP')
      expect(data.data.totalXP).toBe(110) // 100 + 10
      expect(data.data).toHaveProperty('currentLevel')
    })

    it('should detect and handle level ups', async () => {
      ;(requireAuth as jest.Mock).mockResolvedValue({ uid: 'levelup123' })

      // User at 195 XP, close to level 3 (200 XP)
      mockUserDoc.data.mockReturnValue({
        progress: { totalXp: 195, currentLevel: 2 },
        subscription: { plan: 'free' }
      })

      const request = new MockNextRequest('http://localhost/api/xp/track', {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'review_completed',
          amount: 10,
          source: 'Level up review'
        })
      }) as any

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.leveledUp).toBe(true)
      expect(data.data.levelUpBonus).toBeDefined()
      expect(data.data.levelUpBonus).toBe(30) // Level 3 * 10
      expect(data.data.totalXP).toBe(235) // 195 + 10 + 30 (level bonus)
    })

    it('should apply premium multiplier for high-level premium users', async () => {
      ;(requireAuth as jest.Mock).mockResolvedValue({ uid: 'premium123' })

      // Premium user at level 21
      mockUserDoc.data.mockReturnValue({
        progress: { totalXp: 2100, currentLevel: 21 },
        subscription: { plan: 'premium_monthly' }
      })

      ;(xpSystem.getXPMultiplier as jest.Mock).mockReturnValue(1.2)

      const request = new MockNextRequest('http://localhost/api/xp/track', {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'review_completed',
          amount: 10,
          source: 'Premium review'
        })
      }) as any

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.xpGained).toBe(12) // 10 * 1.2
    })

    it('should validate input and reject invalid event types', async () => {
      ;(requireAuth as jest.Mock).mockResolvedValue({ uid: 'user123' })

      const request = new MockNextRequest('http://localhost/api/xp/track', {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'invalid_event',
          amount: 10,
          source: 'Test'
        })
      }) as any

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject negative XP amounts', async () => {
      ;(requireAuth as jest.Mock).mockResolvedValue({ uid: 'user123' })

      const request = new MockNextRequest('http://localhost/api/xp/track', {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'review_completed',
          amount: -10,
          source: 'Test'
        })
      }) as any

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should cap XP at maximum allowed (1000)', async () => {
      ;(requireAuth as jest.Mock).mockResolvedValue({ uid: 'user123' })

      const request = new MockNextRequest('http://localhost/api/xp/track', {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'review_completed',
          amount: 5000,
          source: 'Test'
        })
      }) as any

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should require authentication', async () => {
      ;(requireAuth as jest.Mock).mockRejectedValue(new Error('Unauthorized'))

      const request = new MockNextRequest('http://localhost/api/xp/track', {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'review_completed',
          amount: 10,
          source: 'Test'
        })
      }) as any

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('AUTH_REQUIRED')
    })

    it('should handle Firebase errors gracefully', async () => {
      ;(requireAuth as jest.Mock).mockResolvedValue({ uid: 'user123' })
      mockBatch.commit.mockRejectedValue(new Error('Firebase error'))

      const request = new MockNextRequest('http://localhost/api/xp/track', {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'review_completed',
          amount: 10,
          source: 'Test'
        })
      }) as any

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })

    it('should store XP history with all metadata', async () => {
      ;(requireAuth as jest.Mock).mockResolvedValue({ uid: 'user123' })

      // Test with simple fields that work with Zod
      const request = new MockNextRequest('http://localhost/api/xp/track', {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'review_completed',
          amount: 15,
          source: 'Kanji review',
          sessionId: 'session-123',
          contentType: 'kanji'
        })
      }) as any

      const response = await POST(request)
      const data = await response.json()

      // Ensure the request was successful first
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.xpGained).toBe(15)

      // Verify batch operations were called for XP history
      expect(mockBatch.set).toHaveBeenCalled()
      expect(mockBatch.update).toHaveBeenCalled()
      expect(mockBatch.commit).toHaveBeenCalled()

      // Verify the XP history was saved
      const setCall = mockBatch.set.mock.calls[0]
      expect(setCall).toBeDefined()
      expect(setCall[1]).toMatchObject({
        type: 'review_completed',
        xpGained: 15,
        source: 'Kanji review',
        userId: 'user123'
      })
    })
  })

  describe('GET /api/xp/track', () => {
    it('should return current XP status for authenticated user', async () => {
      ;(requireAuth as jest.Mock).mockResolvedValue({ uid: 'user123' })

      const mockHistoryDocs = [
        {
          id: '1',
          data: () => ({
            xpGained: 10,
            type: 'review_completed',
            timestamp: new Date()
          })
        },
        {
          id: '2',
          data: () => ({
            xpGained: 15,
            type: 'streak_bonus',
            timestamp: new Date()
          })
        }
      ]

      // Mock the user document
      const userRef = {
        get: jest.fn().mockResolvedValue({
          data: () => ({
            progress: {
              totalXp: 250,
              currentLevel: 3,
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
      }

      ;(adminDb.collection as jest.Mock).mockReturnValue({
        doc: jest.fn(() => userRef)
      })

      const request = new MockNextRequest('http://localhost/api/xp/status', {
        method: 'GET'
      }) as any

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.totalXP).toBe(250)
      expect(data.data.currentLevel).toBe(3)
      expect(data.data.recentEvents).toHaveLength(2)
      expect(data.data.levelInfo).toBeDefined()
    })

    it('should handle users with no XP data', async () => {
      ;(requireAuth as jest.Mock).mockResolvedValue({ uid: 'newuser' })

      const userRef = {
        get: jest.fn().mockResolvedValue({
          data: () => ({})  // No progress data
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
      }

      ;(adminDb.collection as jest.Mock).mockReturnValue({
        doc: jest.fn(() => userRef)
      })

      const request = new MockNextRequest('http://localhost/api/xp/status', {
        method: 'GET'
      }) as any

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.totalXP).toBe(0)
      expect(data.data.currentLevel).toBe(1)
      expect(data.data.recentEvents).toEqual([])
    })

    it('should require authentication for GET requests', async () => {
      ;(requireAuth as jest.Mock).mockRejectedValue(new Error('Unauthorized'))

      const request = new MockNextRequest('http://localhost/api/xp/status', {
        method: 'GET'
      }) as any

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('AUTH_REQUIRED')
    })
  })
})