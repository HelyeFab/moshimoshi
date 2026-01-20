import { NextRequest } from 'next/server'
import { POST } from '../route'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { evaluate } from '@/lib/entitlements/evaluator'

jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(),
}))

jest.mock('@/lib/firebase/admin', () => ({
  adminDb: { collection: jest.fn() },
}))

jest.mock('@/lib/entitlements/evaluator', () => ({
  evaluate: jest.fn(),
}))

const mockedGetSession = getSession as jest.Mock
const mockedAdminDb = adminDb as unknown as { collection: jest.Mock }
const mockedEvaluate = evaluate as jest.Mock

describe('/api/lists/sync POST', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockedGetSession.mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/lists/sync', {
      method: 'POST',
      body: JSON.stringify({ id: 'list-1', userId: 'user-1', name: 'Test', type: 'word' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('returns 429 when entitlement denies for new list', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    mockedEvaluate.mockReturnValue({
      allow: false,
      remaining: 0,
      reason: 'limit_reached',
      limit: 10,
    })

    const userRef = {
      get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ subscription: { plan: 'free', status: 'active' } }) }),
      collection: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({ size: 10, docs: [] }),
        doc: jest.fn(() => ({ set: jest.fn().mockResolvedValue(true) })),
      }),
    }

    mockedAdminDb.collection.mockReturnValue({ doc: jest.fn(() => userRef) })

    const request = new NextRequest('http://localhost/api/lists/sync', {
      method: 'POST',
      body: JSON.stringify({ id: 'list-1', userId: 'user-1', name: 'Test', type: 'word' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(429)
  })

  it('skips entitlement check when list already exists', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    mockedEvaluate.mockReturnValue({ allow: false })

    const userRef = {
      get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ subscription: { plan: 'free', status: 'active' } }) }),
      collection: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({
          size: 10,
          docs: [{ id: 'list-1', data: () => ({ name: 'Existing', type: 'word' }) }],
        }),
        doc: jest.fn(() => ({ set: jest.fn().mockResolvedValue(true) })),
      }),
    }

    mockedAdminDb.collection.mockReturnValue({ doc: jest.fn(() => userRef) })

    const request = new NextRequest('http://localhost/api/lists/sync', {
      method: 'POST',
      body: JSON.stringify({ id: 'list-1', userId: 'user-1', name: 'Existing', type: 'word' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    expect(mockedEvaluate).not.toHaveBeenCalled()
  })
})
