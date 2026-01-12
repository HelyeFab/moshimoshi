import { NextRequest } from 'next/server'
import { POST } from '../route'
import { requireAuth } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { evaluateFeatureAccess, getUserPlan } from '@/lib/entitlements/server'

jest.mock('@/lib/auth/session', () => ({
  requireAuth: jest.fn(),
  getSession: jest.fn(),
}))

jest.mock('@/lib/firebase/admin', () => ({
  adminDb: { collection: jest.fn() },
}))

jest.mock('@/lib/entitlements/server', () => ({
  evaluateFeatureAccess: jest.fn(),
  getUserPlan: jest.fn(),
}))

const mockedRequireAuth = requireAuth as jest.Mock
const mockedEvaluateFeatureAccess = evaluateFeatureAccess as jest.Mock
const mockedGetUserPlan = getUserPlan as jest.Mock

describe('/api/kanji-mastery/session POST', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 429 when entitlement denies', async () => {
    mockedRequireAuth.mockResolvedValue({ uid: 'user-1' })
    mockedGetUserPlan.mockResolvedValue('free')
    mockedEvaluateFeatureAccess.mockResolvedValue({
      decision: { allow: false, remaining: 0, reason: 'limit_reached', limit: 5 },
    })

    const request = new NextRequest('http://localhost/api/kanji-mastery/session', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: 'session-1',
        kanji: [{ id: 'k1', character: '日', finalScore: 1, nextReviewDate: new Date().toISOString(), rounds: 1 }],
        sessionStats: { averageAccuracy: 1 },
        totalXP: 10,
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(429)
  })
})
