/**
 * Test Utilities for Dual Storage Testing
 * Provides mock functions and helpers for testing storage decisions
 */

import { StorageDecision } from '@/lib/api/storage-helper'

/**
 * Mock storage decision for free users
 */
export const mockFreeUserDecision: StorageDecision = {
  shouldWriteToFirebase: false,
  storageLocation: 'local',
  isPremium: false,
  plan: 'free'
}

/**
 * Mock storage decision for premium users
 */
export const mockPremiumUserDecision: StorageDecision = {
  shouldWriteToFirebase: true,
  storageLocation: 'both',
  isPremium: true,
  plan: 'premium_monthly'
}

/**
 * Mock storage decision for guest users
 */
export const mockGuestDecision: StorageDecision = {
  shouldWriteToFirebase: false,
  storageLocation: 'none',
  isPremium: false,
  plan: 'guest'
}

/**
 * Mock session for free user
 */
export const mockFreeSession = {
  uid: 'free-user-123',
  email: 'free@test.com',
  tier: 'free' // Note: This should not be trusted in production
}

/**
 * Mock session for premium user
 */
export const mockPremiumSession = {
  uid: 'premium-user-456',
  email: 'premium@test.com',
  tier: 'premium' // Note: This should not be trusted in production
}

/**
 * Mock API response with storage metadata
 */
export function createMockApiResponse<T = any>(
  data: T,
  storageLocation: 'none' | 'local' | 'both'
) {
  return {
    success: true,
    data,
    storage: {
      location: storageLocation,
      syncEnabled: storageLocation === 'both',
      plan: storageLocation === 'both' ? 'premium_monthly' : 'free'
    }
  }
}

// Mock Firebase admin is defined in the test file to avoid initialization issues

/**
 * Mock IndexedDB operations
 */
export const mockIndexedDB = {
  open: jest.fn(),
  deleteDatabase: jest.fn(),
  cmp: jest.fn(),
  databases: jest.fn()
}

/**
 * Helper to verify no Firebase writes occurred
 */
export function expectNoFirebaseWrites(firebaseMock: any) {
  expect(firebaseMock.set).not.toHaveBeenCalled()
  expect(firebaseMock.update).not.toHaveBeenCalled()
  expect(firebaseMock.delete).not.toHaveBeenCalled()
}

/**
 * Helper to verify Firebase writes occurred
 */
export function expectFirebaseWrites(firebaseMock: any, count: number = 1) {
  const totalWrites =
    firebaseMock.set.mock.calls.length +
    firebaseMock.update.mock.calls.length +
    firebaseMock.delete.mock.calls.length

  expect(totalWrites).toBe(count)
}

/**
 * Helper to mock fetch responses
 */
export function mockFetch(response: any, status: number = 200) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => response
  })
}

/**
 * Helper to reset all mocks
 */
export function resetAllMocks() {
  jest.clearAllMocks()
  if (global.fetch && jest.isMockFunction(global.fetch)) {
    (global.fetch as jest.Mock).mockClear()
  }
}

/**
 * Helper to create a mock user document
 */
export function createMockUserDoc(isPremium: boolean) {
  return {
    exists: true,
    data: () => ({
      uid: isPremium ? 'premium-user-456' : 'free-user-123',
      email: isPremium ? 'premium@test.com' : 'free@test.com',
      subscription: {
        status: isPremium ? 'active' : 'inactive',
        plan: isPremium ? 'premium_monthly' : 'free',
        currentPeriodEnd: isPremium ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null
      }
    })
  }
}

/**
 * Helper to verify storage location in API response
 */
export function expectStorageLocation(
  response: any,
  expectedLocation: 'none' | 'local' | 'both'
) {
  expect(response.storage).toBeDefined()
  expect(response.storage.location).toBe(expectedLocation)
  expect(response.storage.syncEnabled).toBe(expectedLocation === 'both')
}