import { NextRequest } from 'next/server'
import { GET } from '../route'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/firebase/admin'
import { evaluateFeatureAccess, getUserPlan } from '@/lib/entitlements/server'

jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(),
}))

jest.mock('@/lib/firebase/admin', () => ({
  db: { collection: jest.fn() },
}))

jest.mock('@/lib/entitlements/server', () => ({
  evaluateFeatureAccess: jest.fn(),
  getUserPlan: jest.fn(),
}))

const mockedGetSession = getSession as jest.Mock
const mockedDb = db as unknown as { collection: jest.Mock }
const mockedEvaluateFeatureAccess = evaluateFeatureAccess as jest.Mock
const mockedGetUserPlan = getUserPlan as jest.Mock

describe('/api/library/books GET', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when unauthenticated for book detail', async () => {
    mockedGetSession.mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/library/books?id=book-1')
    const response = await GET(request)

    expect(response.status).toBe(401)
  })

  it('returns 429 when entitlement denies book detail', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    mockedGetUserPlan.mockResolvedValue('free')
    mockedEvaluateFeatureAccess.mockResolvedValue({
      decision: { allow: false, remaining: 0, reason: 'limit_reached', limit: 2 },
    })

    const request = new NextRequest('http://localhost/api/library/books?id=book-1')
    const response = await GET(request)

    expect(response.status).toBe(429)
  })

  it('returns book detail and increments usage when allowed', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    mockedGetUserPlan.mockResolvedValue('free')
    mockedEvaluateFeatureAccess
      .mockResolvedValueOnce({
        decision: { allow: true, remaining: 2, reason: 'ok', limit: 2 },
      })
      .mockResolvedValueOnce({
        decision: { allow: true, remaining: 1, reason: 'ok', limit: 2 },
      })

    const update = jest.fn().mockResolvedValue(true)
    const bookDoc = {
      exists: true,
      id: 'book-1',
      data: () => ({ title: 'Test Book', viewCount: 0 }),
      ref: { update },
    }
    const doc = jest.fn(() => ({
      get: jest.fn().mockResolvedValue(bookDoc),
    }))
    mockedDb.collection.mockReturnValue({ doc })

    const request = new NextRequest('http://localhost/api/library/books?id=book-1')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(update).toHaveBeenCalled()
  })
})
