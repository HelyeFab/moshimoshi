import { NextRequest } from 'next/server'
import { POST } from '../route'
import { requireAuth } from '@/lib/auth/session'
import { adminDb, FieldValue, Timestamp } from '@/lib/firebase/admin'
import { evaluate } from '@/lib/entitlements/evaluator'
import { getStorageDecision } from '@/lib/api/storage-helper'

jest.mock('@/lib/auth/session', () => ({
  requireAuth: jest.fn(),
}))

jest.mock('@/lib/firebase/admin', () => ({
  adminDb: { collection: jest.fn(), batch: jest.fn() },
  FieldValue: { increment: jest.fn((n: number) => n) },
  Timestamp: {
    now: jest.fn(() => ({
      toDate: () => new Date('2025-12-26T12:00:00.000Z'),
    })),
    fromDate: jest.fn((d: Date) => ({
      toDate: () => d,
    })),
  },
}))

jest.mock('@/lib/entitlements/evaluator', () => ({
  evaluate: jest.fn(),
  getTodayBucket: jest.requireActual('@/lib/entitlements/evaluator').getTodayBucket,
}))

jest.mock('@/lib/api/storage-helper', () => {
  const { NextResponse } = require('next/server')
  return {
    getStorageDecision: jest.fn(),
    createStorageResponse: (data: unknown, decision: unknown, extras?: unknown) =>
      NextResponse.json({ success: true, data, storage: decision, ...extras }),
  }
})

const mockedRequireAuth = requireAuth as jest.Mock
const mockedAdminDb = adminDb as unknown as { collection: jest.Mock; batch: jest.Mock }
const mockedEvaluate = evaluate as jest.Mock
const mockedStorageDecision = getStorageDecision as jest.Mock

describe('/api/todos POST', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 429 when entitlement denies', async () => {
    mockedRequireAuth.mockResolvedValue({ uid: 'user-1' })
    mockedEvaluate.mockReturnValue({
      allow: false,
      remaining: 0,
      reason: 'limit_reached',
      limit: 50,
    })

    const usageRef = { get: jest.fn().mockResolvedValue({ data: () => ({ todos: 50 }) }) }
    const userRef = {
      get: jest.fn().mockResolvedValue({ data: () => ({ subscription: { plan: 'free' } }) }),
      collection: jest.fn().mockReturnValue({ doc: jest.fn(() => usageRef) }),
    }
    mockedAdminDb.collection.mockReturnValue({ doc: jest.fn(() => userRef) })

    const request = new NextRequest('http://localhost/api/todos', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test todo' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(429)
  })

  it('creates todo and updates usage when allowed', async () => {
    mockedRequireAuth.mockResolvedValue({ uid: 'user-1' })
    mockedEvaluate.mockReturnValue({
      allow: true,
      remaining: 10,
      reason: 'ok',
      limit: 50,
    })
    mockedStorageDecision.mockResolvedValue({
      shouldWriteToFirebase: true,
      storageLocation: 'both',
      isPremium: true,
      plan: 'premium_monthly',
    })

    const batchSet = jest.fn()
    const batchCommit = jest.fn().mockResolvedValue(true)
    mockedAdminDb.batch.mockReturnValue({ set: batchSet, commit: batchCommit })

    const usageRef = { get: jest.fn().mockResolvedValue({ data: () => ({ todos: 0 }) }) }
    const userRef = {
      get: jest.fn().mockResolvedValue({ data: () => ({ subscription: { plan: 'premium_monthly' } }) }),
      collection: jest.fn().mockReturnValue({
        doc: jest.fn(() => usageRef),
      }),
    }
    mockedAdminDb.collection.mockReturnValue({ doc: jest.fn(() => userRef) })

    const request = new NextRequest('http://localhost/api/todos', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test todo' }),
    })

    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(batchSet).toHaveBeenCalled()
    expect(batchCommit).toHaveBeenCalled()
  })
})
