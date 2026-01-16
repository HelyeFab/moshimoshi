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

jest.mock('uuid', () => ({
  v4: () => 'list-1',
}))

const mockedGetSession = getSession as jest.Mock
const mockedAdminDb = adminDb as unknown as { collection: jest.Mock }
const mockedEvaluate = evaluate as jest.Mock

describe('/api/lists POST', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockedGetSession.mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/lists', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', type: 'word' }),
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
      limit: 10,
    })

    const userRef = {
      get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ subscription: { plan: 'free', status: 'active' } }) }),
      collection: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({ size: 10, docs: [] }),
      }),
    }

    mockedAdminDb.collection.mockReturnValue({ doc: jest.fn(() => userRef) })

    const request = new NextRequest('http://localhost/api/lists', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', type: 'word' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(429)
  })

  it('creates list and updates usage when allowed', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    mockedEvaluate.mockReturnValue({
      allow: true,
      remaining: 3,
      reason: 'ok',
      limit: 10,
    })

    const userRef = {
      get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ subscription: { plan: 'free', status: 'active' } }) }),
      collection: jest.fn().mockReturnValue({
        doc: jest.fn(() => ({
          set: jest.fn().mockResolvedValue(true),
        })),
        get: jest.fn().mockResolvedValue({ size: 0, docs: [] }),
      }),
    }

    mockedAdminDb.collection.mockReturnValue({ doc: jest.fn(() => userRef) })

    const request = new NextRequest('http://localhost/api/lists', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', type: 'word' }),
    })

    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })
})
