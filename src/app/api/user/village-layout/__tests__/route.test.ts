import { NextRequest } from 'next/server'
import { PATCH } from '../route'
import { requireAuth } from '@/lib/auth/session'
import { ensureAdminInitialized, adminFirestore } from '@/lib/firebase/admin'
import { evaluateFeatureAccess, getUserPlan } from '@/lib/entitlements/server'

jest.mock('@/lib/auth/session', () => ({
  requireAuth: jest.fn(),
}))

jest.mock('@/lib/firebase/admin', () => ({
  ensureAdminInitialized: jest.fn(),
  adminFirestore: { collection: jest.fn() },
}))

jest.mock('@/lib/entitlements/server', () => ({
  evaluateFeatureAccess: jest.fn(),
  getUserPlan: jest.fn(),
}))

const mockedRequireAuth = requireAuth as jest.Mock
const mockedEnsureAdminInitialized = ensureAdminInitialized as jest.Mock
const mockedFirestore = adminFirestore as unknown as { collection: jest.Mock }
const mockedEvaluateFeatureAccess = evaluateFeatureAccess as jest.Mock
const mockedGetUserPlan = getUserPlan as jest.Mock

describe('/api/user/village-layout PATCH', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedEnsureAdminInitialized.mockReturnValue(true)
  })

  it('returns 429 when entitlement denies', async () => {
    mockedRequireAuth.mockResolvedValue({ uid: 'user-1' })
    mockedGetUserPlan.mockResolvedValue('free')
    mockedEvaluateFeatureAccess.mockResolvedValue({
      decision: { allow: false, remaining: 0, reason: 'limit_reached', limit: 1 },
    })

    const request = new NextRequest('http://localhost/api/user/village-layout', {
      method: 'PATCH',
      body: JSON.stringify({ districtOrder: ['foundation', 'study', 'immersion', 'play', 'community'] }),
    })

    const response = await PATCH(request)
    expect(response.status).toBe(429)
  })

  it('updates layout when allowed', async () => {
    mockedRequireAuth.mockResolvedValue({ uid: 'user-1' })
    mockedGetUserPlan.mockResolvedValue('free')
    mockedEvaluateFeatureAccess
      .mockResolvedValueOnce({
        decision: { allow: true, remaining: 1, reason: 'ok', limit: 1 },
      })
      .mockResolvedValueOnce({
        decision: { allow: true, remaining: 0, reason: 'ok', limit: 1 },
      })

    const set = jest.fn().mockResolvedValue(true)
    mockedFirestore.collection.mockReturnValue({
      doc: jest.fn(() => ({
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({ set })),
        })),
      })),
    })

    const request = new NextRequest('http://localhost/api/user/village-layout', {
      method: 'PATCH',
      body: JSON.stringify({ districtOrder: ['foundation', 'study', 'immersion', 'play', 'community'] }),
    })

    const response = await PATCH(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(set).toHaveBeenCalled()
  })
})
