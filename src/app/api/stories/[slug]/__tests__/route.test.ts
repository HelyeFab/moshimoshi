import { NextRequest } from 'next/server'
import { GET } from '../route'
import { getSession } from '@/lib/auth/session'
import { adminFirestore } from '@/lib/firebase/admin'
import { getUserPlan } from '@/lib/entitlements/server'
import { evaluate, getBucketKey } from '@/lib/entitlements/evaluator'

jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(),
}))

jest.mock('@/lib/firebase/admin', () => ({
  adminFirestore: { collection: jest.fn(), runTransaction: jest.fn() },
}))

jest.mock('@/lib/entitlements/server', () => ({
  getUserPlan: jest.fn(),
}))

jest.mock('@/lib/entitlements/evaluator', () => ({
  evaluate: jest.fn(),
  getBucketKey: jest.fn(),
}))

const mockedGetSession = getSession as jest.Mock
const mockedFirestore = adminFirestore as unknown as { collection: jest.Mock }
const mockedGetUserPlan = getUserPlan as jest.Mock
const mockedEvaluate = evaluate as jest.Mock
const mockedGetBucketKey = getBucketKey as jest.Mock

describe('/api/stories/[slug] GET', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 429 when entitlement denies', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    mockedGetUserPlan.mockResolvedValue('free')
    mockedEvaluate.mockReturnValue({
      allow: false,
      remaining: 0,
      reason: 'limit_reached',
      limit: 2,
      policyVersion: 1
    })
    mockedGetBucketKey.mockReturnValue('story_2025-12-26')

    const update = jest.fn().mockResolvedValue(true)
    const storyDoc = {
      data: () => ({ title: 'Test Story', status: 'published', viewCount: 0 }),
      id: 'story-1',
    }
    const get = jest.fn().mockResolvedValue({ empty: false, docs: [storyDoc] })

    const usageRef = { id: 'story_2025-12-26' }
    const transactionGet = jest.fn().mockResolvedValue({ exists: false, data: () => ({}) })
    const transactionSet = jest.fn()
    mockedFirestore.runTransaction.mockImplementation(async (callback: any) => {
      return callback({ get: transactionGet, set: transactionSet })
    })

    mockedFirestore.collection.mockImplementation((name: string) => {
      if (name === 'stories') {
        return {
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          get,
          doc: jest.fn(() => ({ update })),
        }
      }
      if (name === 'users') {
        return {
          doc: jest.fn(() => ({
            collection: jest.fn().mockReturnValue({
              doc: jest.fn(() => usageRef),
            }),
          })),
        }
      }
      return { doc: jest.fn(), get: jest.fn() }
    })

    const request = new NextRequest('http://localhost/api/stories/story-1')
    const response = await GET(request, { params: Promise.resolve({ slug: 'story-1' }) })

    expect(response.status).toBe(429)
  })

  it('returns story and increments usage when allowed', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    mockedGetUserPlan.mockResolvedValue('free')
    mockedEvaluate.mockReturnValue({
      allow: true,
      remaining: 2,
      reason: 'ok',
      limit: 2,
      policyVersion: 1
    })
    mockedGetBucketKey.mockReturnValue('story_2025-12-26')

    const update = jest.fn().mockResolvedValue(true)
    const storyDoc = {
      data: () => ({ title: 'Test Story', status: 'published', viewCount: 0 }),
      id: 'story-1',
    }
    const get = jest.fn().mockResolvedValue({ empty: false, docs: [storyDoc] })

    const usageRef = { id: 'story_2025-12-26' }
    const transactionGet = jest.fn().mockResolvedValue({ exists: false, data: () => ({}) })
    const transactionSet = jest.fn()
    mockedFirestore.runTransaction.mockImplementation(async (callback: any) => {
      return callback({ get: transactionGet, set: transactionSet })
    })

    mockedFirestore.collection.mockImplementation((name: string) => {
      if (name === 'stories') {
        return {
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          get,
          doc: jest.fn(() => ({ update })),
        }
      }
      if (name === 'users') {
        return {
          doc: jest.fn(() => ({
            collection: jest.fn().mockReturnValue({
              doc: jest.fn(() => usageRef),
            }),
          })),
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
    expect(transactionSet).toHaveBeenCalled()
  })
})
