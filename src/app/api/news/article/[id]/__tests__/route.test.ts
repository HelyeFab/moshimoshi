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

describe('/api/news/article/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockedGetSession.mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/news/article/test', {
      method: 'GET',
    })

    const response = await GET(request, { params: Promise.resolve({ id: 'article-1' }) })
    expect(response.status).toBe(401)
  })

  it('returns 429 when entitlement denies', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    mockedGetUserPlan.mockResolvedValue('free')
    mockedEvaluateFeatureAccess.mockResolvedValue({
      decision: { allow: false, remaining: 0, reason: 'limit_reached', policyVersion: 1 },
      currentUsage: 2,
      bucketKey: 'news_2025-01-01',
    })

    const request = new NextRequest('http://localhost/api/news/article/test', {
      method: 'GET',
    })

    const response = await GET(request, { params: Promise.resolve({ id: 'article-1' }) })
    expect(response.status).toBe(429)
  })

  it('returns article when allowed', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    mockedGetUserPlan.mockResolvedValue('free')
    mockedEvaluateFeatureAccess
      .mockResolvedValueOnce({
        decision: { allow: true, remaining: 2, reason: 'ok', policyVersion: 1, limit: 2 },
        currentUsage: 0,
        bucketKey: 'news_2025-01-01',
      })
      .mockResolvedValueOnce({
        decision: { allow: true, remaining: 1, reason: 'ok', policyVersion: 1, limit: 2 },
        currentUsage: 1,
        bucketKey: 'news_2025-01-01',
      })

    const docGet = jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        title: 'Test',
        content: 'Hello',
        publishDate: new Date().toISOString(),
      }),
    })
    mockedDb.collection.mockReturnValue({
      doc: jest.fn(() => ({ get: docGet })),
    })

    const request = new NextRequest('http://localhost/api/news/article/test', {
      method: 'GET',
    })

    const response = await GET(request, { params: Promise.resolve({ id: 'article-1' }) })
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.article?.title).toBe('Test')
    expect(mockedEvaluateFeatureAccess).toHaveBeenCalledTimes(2)
  })
})
