/**
 * Dual Storage Implementation Tests
 * Comprehensive tests to ensure free users don't access Firebase
 * and premium users get proper cloud sync
 */

// Setup mocks before any imports
jest.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(),
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        collection: jest.fn(() => ({
          add: jest.fn(),
          doc: jest.fn()
        }))
      }))
    })),
    batch: jest.fn(() => ({
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn()
    }))
  }
}))

jest.mock('@/lib/monitoring/firebase-tracker', () => ({
  firebaseTracker: {
    trackOperation: jest.fn()
  }
}))

// Now import after mocks are setup
import { getStorageDecision, createStorageResponse } from '@/lib/api/storage-helper'
import {
  mockFreeSession,
  mockPremiumSession,
  createMockUserDoc,
  expectNoFirebaseWrites,
  expectFirebaseWrites,
  expectStorageLocation,
  resetAllMocks
} from './test-utils'
import { adminDb } from '@/lib/firebase/admin'

// Get mocked functions for testing
const mockAdminDb = adminDb as jest.Mocked<typeof adminDb>

describe('Dual Storage Implementation', () => {
  beforeEach(() => {
    resetAllMocks()
    jest.clearAllMocks()
  })

  describe('getStorageDecision', () => {
    it('should return local storage for free users', async () => {
      // Mock Firebase to return free user data
      const mockGet = jest.fn().mockResolvedValue(createMockUserDoc(false))
      ;(mockAdminDb.collection as jest.Mock).mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: mockGet
        })
      })

      const decision = await getStorageDecision(mockFreeSession)

      expect(decision.shouldWriteToFirebase).toBe(false)
      expect(decision.storageLocation).toBe('local')
      expect(decision.isPremium).toBe(false)
      expect(decision.plan).toBe('free')
    })

    it('should return both storage for premium users', async () => {
      // Mock Firebase to return premium user data
      const mockGet = jest.fn().mockResolvedValue(createMockUserDoc(true))
      ;(mockAdminDb.collection as jest.Mock).mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: mockGet
        })
      })

      const decision = await getStorageDecision(mockPremiumSession)

      expect(decision.shouldWriteToFirebase).toBe(true)
      expect(decision.storageLocation).toBe('both')
      expect(decision.isPremium).toBe(true)
      expect(decision.plan).toBe('premium_monthly')
    })

    it('should never trust cached session.tier', async () => {
      // Session says premium but Firebase says free
      const fakeSession = { ...mockPremiumSession, tier: 'premium' }
      const mockGet = jest.fn().mockResolvedValue(createMockUserDoc(false))
      ;(mockAdminDb.collection as jest.Mock).mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: mockGet
        })
      })

      const decision = await getStorageDecision(fakeSession)

      // Should use Firebase data, not session.tier
      expect(decision.shouldWriteToFirebase).toBe(false)
      expect(decision.storageLocation).toBe('local')
      expect(decision.isPremium).toBe(false)
    })

    it('should default to local storage on error', async () => {
      // Mock Firebase error
      const mockGet = jest.fn().mockRejectedValue(new Error('Firebase error'))
      ;(mockAdminDb.collection as jest.Mock).mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: mockGet
        })
      })

      const decision = await getStorageDecision(mockFreeSession)

      expect(decision.shouldWriteToFirebase).toBe(false)
      expect(decision.storageLocation).toBe('local')
      expect(decision.isPremium).toBe(false)
      expect(decision.plan).toBe('free')
    })
  })

  describe('createStorageResponse', () => {
    it('should include storage metadata in response', () => {
      const data = { id: '123', value: 'test' }
      const decision = {
        shouldWriteToFirebase: false,
        storageLocation: 'local' as const,
        isPremium: false,
        plan: 'free'
      }

      const response = createStorageResponse(data, decision)
      const responseBody = JSON.parse(response.body)

      expect(responseBody.success).toBe(true)
      expect(responseBody.data).toEqual(data)
      expectStorageLocation(responseBody, 'local')
    })

    it('should include additional info in response', () => {
      const data = { id: '456' }
      const decision = {
        shouldWriteToFirebase: true,
        storageLocation: 'both' as const,
        isPremium: true,
        plan: 'premium_monthly'
      }
      const additionalInfo = { usage: { current: 5, limit: 100 } }

      const response = createStorageResponse(data, decision, additionalInfo)
      const responseBody = JSON.parse(response.body)

      expect(responseBody.usage).toEqual(additionalInfo.usage)
      expectStorageLocation(responseBody, 'both')
    })
  })

  describe('Todo Operations', () => {
    it('should not write todos to Firebase for free users', async () => {
      const mockGet = jest.fn().mockResolvedValue(createMockUserDoc(false))
      const mockSet = jest.fn()
      ;(mockAdminDb.collection as jest.Mock).mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: mockGet,
          set: mockSet
        })
      })

      const decision = await getStorageDecision(mockFreeSession)

      if (decision.shouldWriteToFirebase) {
        // This should not execute for free users
        await mockSet({ title: 'Test' })
      }

      expect(mockSet).not.toHaveBeenCalled()
    })

    it('should write todos to Firebase for premium users', async () => {
      const mockGet = jest.fn().mockResolvedValue(createMockUserDoc(true))
      const mockSet = jest.fn()
      ;(mockAdminDb.collection as jest.Mock).mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: mockGet,
          set: mockSet
        })
      })

      const decision = await getStorageDecision(mockPremiumSession)

      if (decision.shouldWriteToFirebase) {
        await mockSet({ title: 'Test' })
      }

      expect(mockSet).toHaveBeenCalledWith({ title: 'Test' })
    })
  })

  describe('XP Tracking', () => {
    it('should not track XP in Firebase for free users', async () => {
      const mockGet = jest.fn().mockResolvedValue(createMockUserDoc(false))
      const mockAdd = jest.fn()
      ;(mockAdminDb.collection as jest.Mock).mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: mockGet,
          collection: jest.fn().mockReturnValue({
            add: mockAdd
          })
        })
      })

      const decision = await getStorageDecision(mockFreeSession)

      if (decision.shouldWriteToFirebase) {
        await mockAdd({ xpGained: 10 })
      }

      expect(mockAdd).not.toHaveBeenCalled()
    })

    it('should track XP in Firebase for premium users', async () => {
      const mockGet = jest.fn().mockResolvedValue(createMockUserDoc(true))
      const mockAdd = jest.fn()
      ;(mockAdminDb.collection as jest.Mock).mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: mockGet,
          collection: jest.fn().mockReturnValue({
            add: mockAdd
          })
        })
      })

      const decision = await getStorageDecision(mockPremiumSession)

      if (decision.shouldWriteToFirebase) {
        await mockAdd({ xpGained: 10 })
      }

      expect(mockAdd).toHaveBeenCalledWith({ xpGained: 10 })
    })
  })

  describe('Premium Downgrade Scenario', () => {
    it('should stop Firebase writes when user downgrades from premium', async () => {
      const mockGet = jest.fn()
        .mockResolvedValueOnce(createMockUserDoc(true))  // First call: premium
        .mockResolvedValueOnce(createMockUserDoc(false)) // Second call: free

      ;(mockAdminDb.collection as jest.Mock).mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: mockGet
        })
      })

      // First call: user is premium
      let decision = await getStorageDecision(mockPremiumSession)
      expect(decision.shouldWriteToFirebase).toBe(true)

      // User downgrades
      decision = await getStorageDecision(mockPremiumSession)
      expect(decision.shouldWriteToFirebase).toBe(false)
    })
  })

  describe('Storage Location in API Responses', () => {
    it('should return correct storage location for free users', async () => {
      const mockGet = jest.fn().mockResolvedValue(createMockUserDoc(false))
      ;(mockAdminDb.collection as jest.Mock).mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: mockGet
        })
      })

      const decision = await getStorageDecision(mockFreeSession)
      const response = createStorageResponse({ id: '123' }, decision)
      const responseBody = JSON.parse(response.body)

      expectStorageLocation(responseBody, 'local')
      expect(responseBody.storage.plan).toBe('free')
    })

    it('should return correct storage location for premium users', async () => {
      const mockGet = jest.fn().mockResolvedValue(createMockUserDoc(true))
      ;(mockAdminDb.collection as jest.Mock).mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: mockGet
        })
      })

      const decision = await getStorageDecision(mockPremiumSession)
      const response = createStorageResponse({ id: '456' }, decision)
      const responseBody = JSON.parse(response.body)

      expectStorageLocation(responseBody, 'both')
      expect(responseBody.storage.plan).toBe('premium_monthly')
    })
  })
})