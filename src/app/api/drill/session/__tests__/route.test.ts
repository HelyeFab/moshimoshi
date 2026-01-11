import { NextRequest } from 'next/server'
import { POST } from '../route'
import { requireAuth } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { evaluate } from '@/lib/entitlements/evaluator'

jest.mock('@/lib/auth/session', () => ({
  requireAuth: jest.fn(),
  getSession: jest.fn(),
}))

jest.mock('@/lib/firebase/admin', () => ({
  adminDb: { collection: jest.fn() },
}))

jest.mock('@/lib/entitlements/evaluator', () => ({
  evaluate: jest.fn(),
  getBucketKey: jest.requireActual('@/lib/entitlements/evaluator').getBucketKey,
}))

const mockedRequireAuth = requireAuth as jest.Mock
const mockedAdminDb = adminDb as unknown as { collection: jest.Mock }
const mockedEvaluate = evaluate as jest.Mock

describe('/api/drill/session POST', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 403 when entitlement denies', async () => {
    mockedRequireAuth.mockResolvedValue({ uid: 'user-1' })
    mockedEvaluate.mockReturnValue({
      allow: false,
      remaining: 0,
      reason: 'limit_reached',
      limit: 5,
    })

    const usageRef = { get: jest.fn().mockResolvedValue({ data: () => ({ conjugation_drill: 5 }) }) }
    const userRef = {
      get: jest.fn().mockResolvedValue({ data: () => ({ subscription: { plan: 'free' } }) }),
      collection: jest.fn().mockReturnValue({ doc: jest.fn(() => usageRef) }),
    }

    mockedAdminDb.collection.mockReturnValue({ doc: jest.fn(() => userRef) })

    const request = new NextRequest('http://localhost/api/drill/session', {
      method: 'POST',
      body: JSON.stringify({ mode: 'random' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(403)
  })
})
