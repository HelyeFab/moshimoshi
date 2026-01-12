import { NextRequest } from 'next/server'
import { GET } from '../route'
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

describe('/api/flashcards/decks/[deckId] GET', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 403 when flashcards entitlement denies', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    mockedGetUserPlan.mockResolvedValue('free')
    mockedEvaluateFeatureAccess.mockResolvedValue({
      decision: { allow: false, remaining: 0, reason: 'no_permission', limit: 0 },
    })

    const request = new NextRequest('http://localhost/api/flashcards/decks/deck-1')
    const response = await GET(request, { params: Promise.resolve({ deckId: 'deck-1' }) })

    expect(response.status).toBe(403)
  })
})
