import { NextRequest } from 'next/server'
import { POST } from '../route'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { evaluateFeatureAccess, getUserPlan } from '@/lib/entitlements/server'

jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(),
}))

jest.mock('@/lib/firebase/admin', () => ({
  adminDb: { collection: jest.fn() },
}))

jest.mock('@/lib/entitlements/server', () => ({
  evaluateFeatureAccess: jest.fn(),
  getUserPlan: jest.fn(),
}))

const mockedGetSession = getSession as jest.Mock
const mockedAdminDb = adminDb as unknown as { collection: jest.Mock }
const mockedEvaluateFeatureAccess = evaluateFeatureAccess as jest.Mock
const mockedGetUserPlan = getUserPlan as jest.Mock

describe('/api/lists/[listId]/items POST', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 429 when entitlement denies', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    mockedGetUserPlan.mockResolvedValue('free')
    mockedEvaluateFeatureAccess.mockResolvedValue({
      decision: { allow: false, remaining: 0, reason: 'limit_reached', limit: 50 },
    })

    const listDoc = {
      exists: true,
      data: () => ({ items: [], type: 'word' }),
    }
    const listRef = { get: jest.fn().mockResolvedValue(listDoc) }
    mockedAdminDb.collection.mockReturnValue({
      doc: jest.fn(() => ({
        collection: jest.fn(() => ({
          doc: jest.fn(() => listRef),
        })),
      })),
    })

    const request = new NextRequest('http://localhost/api/lists/list-1/items', {
      method: 'POST',
      body: JSON.stringify({ content: 'word' }),
    })

    const response = await POST(request, { params: Promise.resolve({ listId: 'list-1' }) })
    expect(response.status).toBe(429)
  })

  it('adds item and increments usage when allowed', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    mockedGetUserPlan.mockResolvedValue('free')
    mockedEvaluateFeatureAccess
      .mockResolvedValueOnce({
        decision: { allow: true, remaining: 50, reason: 'ok', limit: 50 },
      })
      .mockResolvedValueOnce({
        decision: { allow: true, remaining: 49, reason: 'ok', limit: 50 },
      })

    const update = jest.fn().mockResolvedValue(true)
    const listDoc = {
      exists: true,
      data: () => ({ items: [], type: 'word' }),
    }
    const listRef = { get: jest.fn().mockResolvedValue(listDoc), update }
    mockedAdminDb.collection.mockReturnValue({
      doc: jest.fn(() => ({
        collection: jest.fn(() => ({
          doc: jest.fn(() => listRef),
        })),
      })),
    })

    const request = new NextRequest('http://localhost/api/lists/list-1/items', {
      method: 'POST',
      body: JSON.stringify({ content: 'word' }),
    })

    const response = await POST(request, { params: Promise.resolve({ listId: 'list-1' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(update).toHaveBeenCalled()
  })
})
