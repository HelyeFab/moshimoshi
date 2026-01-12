import { NextRequest } from 'next/server'
import { POST } from '../route'
import { getSession } from '@/lib/auth/session'
import { getAdminDb } from '@/lib/firebase/admin'
import { evaluateFeatureAccess, getUserPlan } from '@/lib/entitlements/server'

jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(),
}))

jest.mock('@/lib/firebase/admin', () => ({
  getAdminDb: jest.fn(),
}))

jest.mock('@/lib/entitlements/server', () => ({
  evaluateFeatureAccess: jest.fn(),
  getUserPlan: jest.fn(),
}))

const mockedGetSession = getSession as jest.Mock
const mockedGetAdminDb = getAdminDb as jest.Mock
const mockedEvaluateFeatureAccess = evaluateFeatureAccess as jest.Mock
const mockedGetUserPlan = getUserPlan as jest.Mock

describe('/api/flashcards/decks POST', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 403 when flashcards entitlement denies', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    mockedGetUserPlan.mockResolvedValue('free')
    mockedEvaluateFeatureAccess.mockResolvedValue({
      decision: { allow: false, remaining: 0, reason: 'no_permission', limit: 0 },
    })

    const request = new NextRequest('http://localhost/api/flashcards/decks', {
      method: 'POST',
      body: JSON.stringify({ decks: [] }),
    })

    const response = await POST(request)
    expect(response.status).toBe(403)
  })

  it('returns 429 when deck limit exceeded', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    mockedGetUserPlan.mockResolvedValue('premium_monthly')
    mockedEvaluateFeatureAccess
      .mockResolvedValueOnce({
        decision: { allow: true, remaining: -1, reason: 'ok', limit: -1 },
      })
      .mockResolvedValueOnce({
        decision: { allow: true, remaining: 0, reason: 'ok', limit: 0 },
        currentUsage: 0,
        bucketKey: 'flashcard_decks_2025-12',
      })

    const db = {
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({})),
      })),
      getAll: jest.fn().mockResolvedValue([]),
    }
    mockedGetAdminDb.mockReturnValue(db)

    const request = new NextRequest('http://localhost/api/flashcards/decks', {
      method: 'POST',
      body: JSON.stringify({ decks: [{ id: 'deck-1', userId: 'user-1', source: 'local', updatedAt: 1 }] }),
    })

    const response = await POST(request)
    expect(response.status).toBe(429)
  })
})
