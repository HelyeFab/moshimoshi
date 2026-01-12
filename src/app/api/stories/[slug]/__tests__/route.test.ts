import { NextRequest } from 'next/server'
import { GET } from '../route'
import { getSession } from '@/lib/auth/session'
import { adminFirestore } from '@/lib/firebase/admin'
import { evaluateFeatureAccess, getUserPlan } from '@/lib/entitlements/server'

jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(),
}))

jest.mock('@/lib/firebase/admin', () => ({
  adminFirestore: { collection: jest.fn() },
}))

jest.mock('@/lib/entitlements/server', () => ({
  evaluateFeatureAccess: jest.fn(),
  getUserPlan: jest.fn(),
}))

const mockedGetSession = getSession as jest.Mock
const mockedFirestore = adminFirestore as unknown as { collection: jest.Mock }
const mockedEvaluateFeatureAccess = evaluateFeatureAccess as jest.Mock
const mockedGetUserPlan = getUserPlan as jest.Mock

describe('/api/stories/[slug] GET', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 429 when entitlement denies', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    mockedGetUserPlan.mockResolvedValue('free')
    mockedEvaluateFeatureAccess.mockResolvedValue({
      decision: { allow: false, remaining: 0, reason: 'limit_reached', limit: 2 },
    })

    const request = new NextRequest('http://localhost/api/stories/story-1')
    const response = await GET(request, { params: Promise.resolve({ slug: 'story-1' }) })

    expect(response.status).toBe(429)
  })

  it('returns story and increments usage when allowed', async () => {
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
    const storyDoc = {
      data: () => ({ title: 'Test Story', status: 'published', viewCount: 0 }),
      id: 'story-1',
    }
    const get = jest.fn().mockResolvedValue({ empty: false, docs: [storyDoc] })

    mockedFirestore.collection.mockImplementation((name: string) => {
      if (name === 'stories') {
        return {
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          get,
          doc: jest.fn(() => ({ update })),
        }
      }
      return { doc: jest.fn(), get: jest.fn() }
    })

    const request = new NextRequest('http://localhost/api/stories/story-1')
    const response = await GET(request, { params: Promise.resolve({ slug: 'story-1' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(update).toHaveBeenCalled()
  })
})
