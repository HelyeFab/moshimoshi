import { NextRequest } from 'next/server'
import { POST } from '../route'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { evaluateFeatureAccess, getUserPlan } from '@/lib/entitlements/server'

jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(),
}))

jest.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: jest.fn(),
    batch: jest.fn(),
  },
}))

jest.mock('@/lib/entitlements/server', () => ({
  evaluateFeatureAccess: jest.fn(),
  getUserPlan: jest.fn(),
}))

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => new Date('2025-12-26T12:00:00.000Z')),
    increment: jest.fn((n: number) => n),
  },
}))

const mockedGetSession = getSession as jest.Mock
const mockedAdminDb = adminDb as unknown as { collection: jest.Mock; batch: jest.Mock }
const mockedEvaluateFeatureAccess = evaluateFeatureAccess as jest.Mock
const mockedGetUserPlan = getUserPlan as jest.Mock

describe('/api/kanji/add-to-review POST', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockedGetSession.mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/kanji/add-to-review', {
      method: 'POST',
      body: JSON.stringify({ kanjiIds: ['1'] }),
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('returns 429 when entitlement denies', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    mockedGetUserPlan.mockResolvedValue('free')
    mockedEvaluateFeatureAccess.mockResolvedValue({
      decision: {
        allow: false,
        remaining: 0,
        reason: 'limit_reached',
        limit: 5,
      },
      currentUsage: 5,
      bucketKey: 'kanji_browser_2025-12-26',
    })

    const request = new NextRequest('http://localhost/api/kanji/add-to-review', {
      method: 'POST',
      body: JSON.stringify({ kanjiIds: ['1'] }),
    })

    const response = await POST(request)
    expect(response.status).toBe(429)
  })

  it('adds kanji when allowed', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    mockedGetUserPlan.mockResolvedValue('free')
    mockedEvaluateFeatureAccess.mockResolvedValue({
      decision: {
        allow: true,
        remaining: 5,
        reason: 'ok',
        limit: 5,
      },
      currentUsage: 0,
      bucketKey: 'kanji_browser_2025-12-26',
    })

    const batchSet = jest.fn()
    const batchCommit = jest.fn().mockResolvedValue(true)
    mockedAdminDb.batch.mockReturnValue({ set: batchSet, commit: batchCommit })

    const achievementSet = jest.fn().mockResolvedValue(true)
    const nestedDoc = { set: achievementSet }
    const userDoc = {
      collection: jest.fn(() => ({
        doc: jest.fn(() => nestedDoc),
      })),
    }
    mockedAdminDb.collection.mockImplementation((name: string) => {
      if (name === 'users') {
        return { doc: jest.fn(() => userDoc) }
      }
      return { doc: jest.fn(() => ({})) }
    })

    const request = new NextRequest('http://localhost/api/kanji/add-to-review', {
      method: 'POST',
      body: JSON.stringify({ kanjiIds: ['1', '2'] }),
    })

    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(batchCommit).toHaveBeenCalled()
  })
})
