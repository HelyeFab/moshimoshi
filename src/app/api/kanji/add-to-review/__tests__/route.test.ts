import { NextRequest } from 'next/server'
import { POST } from '../route'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { evaluate } from '@/lib/entitlements/evaluator'

jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(),
}))

jest.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: jest.fn(),
    batch: jest.fn(),
  },
}))

jest.mock('@/lib/entitlements/evaluator', () => ({
  evaluate: jest.fn(),
  getTodayBucket: jest.requireActual('@/lib/entitlements/evaluator').getTodayBucket,
}))

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => new Date('2025-12-26T12:00:00.000Z')),
    increment: jest.fn((n: number) => n),
  },
}))

const mockedGetSession = getSession as jest.Mock
const mockedAdminDb = adminDb as unknown as { collection: jest.Mock; batch: jest.Mock }
const mockedEvaluate = evaluate as jest.Mock

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
    mockedEvaluate.mockReturnValue({
      allow: false,
      remaining: 0,
      reason: 'limit_reached',
      limit: 5,
    })

    const usageRef = { get: jest.fn().mockResolvedValue({ data: () => ({ kanji_browser: 5 }) }) }
    const userRef = {
      get: jest.fn().mockResolvedValue({ data: () => ({ subscription: { plan: 'free' } }) }),
      collection: jest.fn((name: string) => {
        if (name === 'usage') {
          return { doc: jest.fn(() => usageRef) }
        }
        return { doc: jest.fn(() => ({ set: jest.fn() })) }
      }),
    }
    mockedAdminDb.collection.mockReturnValue({ doc: jest.fn(() => userRef) })

    const request = new NextRequest('http://localhost/api/kanji/add-to-review', {
      method: 'POST',
      body: JSON.stringify({ kanjiIds: ['1'] }),
    })

    const response = await POST(request)
    expect(response.status).toBe(429)
  })

  it('adds kanji and updates usage when allowed', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    mockedEvaluate.mockReturnValue({
      allow: true,
      remaining: 5,
      reason: 'ok',
      limit: 5,
    })

    const usageRef = { get: jest.fn().mockResolvedValue({ data: () => ({ kanji_browser: 0 }) }) }
    const userRef = {
      get: jest.fn().mockResolvedValue({ data: () => ({ subscription: { plan: 'free' } }) }),
      collection: jest.fn((name: string) => {
        if (name === 'usage') {
          return { doc: jest.fn(() => usageRef) }
        }
        return { doc: jest.fn(() => ({ set: jest.fn() })) }
      }),
    }

    const batchSet = jest.fn()
    const batchCommit = jest.fn().mockResolvedValue(true)
    mockedAdminDb.batch.mockReturnValue({ set: batchSet, commit: batchCommit })

    mockedAdminDb.collection.mockReturnValue({ doc: jest.fn(() => userRef) })

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
