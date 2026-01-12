import { NextRequest } from 'next/server'
import { POST } from '../route'
import { getSession } from '@/lib/auth/session'
import { evaluateFeatureAccess, getUserPlan } from '@/lib/entitlements/server'

jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(),
}))

jest.mock('@/lib/entitlements/server', () => ({
  evaluateFeatureAccess: jest.fn(),
  getUserPlan: jest.fn(),
}))

const mockedGetSession = getSession as jest.Mock
const mockedEvaluateFeatureAccess = evaluateFeatureAccess as jest.Mock
const mockedGetUserPlan = getUserPlan as jest.Mock

describe('/api/flashcards/sessions POST', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 429 when daily review entitlement denies', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    mockedGetUserPlan.mockResolvedValue('premium_monthly')
    mockedEvaluateFeatureAccess
      .mockResolvedValueOnce({
        decision: { allow: true, remaining: -1, reason: 'ok', limit: -1 },
      })
      .mockResolvedValueOnce({
        decision: { allow: false, remaining: 0, reason: 'limit_reached', limit: 0 },
      })

    const request = new NextRequest('http://localhost/api/flashcards/sessions', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'user-1',
        timestamp: Date.now(),
        cardsStudied: 10,
        duration: 120,
        accuracy: 0.9,
        deckId: 'deck-1',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(429)
  })
})
