import { NextRequest } from 'next/server'
import { POST } from '../route'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { evaluate } from '@/lib/entitlements/evaluator'
import { getStorageDecision } from '@/lib/api/storage-helper'

jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(),
}))

jest.mock('@/lib/firebase/admin', () => ({
  adminDb: { collection: jest.fn() },
}))

jest.mock('@/lib/entitlements/evaluator', () => ({
  evaluate: jest.fn(),
}))

jest.mock('@/lib/api/storage-helper', () => {
  const { NextResponse } = require('next/server')
  return {
    getStorageDecision: jest.fn(),
    createStorageResponse: (data: unknown, decision: unknown, extras?: unknown) =>
      NextResponse.json({
        success: true,
        data,
        storage: decision,
        ...extras,
      }),
  }
})

jest.mock('uuid', () => ({
  v4: () => 'list-1',
}))

const mockedGetSession = getSession as jest.Mock
const mockedAdminDb = adminDb as unknown as { collection: jest.Mock }
const mockedEvaluate = evaluate as jest.Mock
const mockedStorageDecision = getStorageDecision as jest.Mock

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
      limit: 3,
    })

    const userRef = {
      get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ subscription: { plan: 'free', status: 'active' } }) }),
      collection: jest.fn().mockReturnValue({
        count: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ data: () => ({ count: 0 }) }),
        }),
        doc: jest.fn(() => ({ get: jest.fn().mockResolvedValue({ data: () => ({ custom_lists: 3 }) }) })),
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
      limit: 3,
    })
    mockedStorageDecision.mockResolvedValue({
      shouldWriteToFirebase: false,
      storageLocation: 'local',
      isPremium: false,
      plan: 'free',
    })

    const usageSet = jest.fn().mockResolvedValue(true)
    const userRef = {
      get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ subscription: { plan: 'free', status: 'active' } }) }),
      collection: jest.fn().mockReturnValue({
        count: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ data: () => ({ count: 0 }) }),
        }),
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({ data: () => ({ custom_lists: 0 }) }),
          set: usageSet,
        })),
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
    expect(usageSet).toHaveBeenCalled()
  })
})
