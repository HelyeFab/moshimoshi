import { NextRequest } from 'next/server'
import { POST } from '../route'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { evaluate } from '@/lib/entitlements/evaluator'
import { AIService } from '@/lib/ai/AIService'
import { getCachedExplanation, setCachedExplanation } from '@/lib/ai/cache/GrammarExplanationCache'

jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(),
}))

jest.mock('@/lib/firebase/admin', () => ({
  adminDb: { collection: jest.fn() },
}))

jest.mock('@/lib/entitlements/evaluator', () => ({
  evaluate: jest.fn(),
  getBucketKey: jest.requireActual('@/lib/entitlements/evaluator').getBucketKey,
}))

jest.mock('@/lib/ai/AIService', () => ({
  AIService: { getInstance: jest.fn() },
}))

jest.mock('@/lib/ai/cache/GrammarExplanationCache', () => ({
  getCachedExplanation: jest.fn(),
  setCachedExplanation: jest.fn(),
}))

const mockedGetSession = getSession as jest.Mock
const mockedAdminDb = adminDb as unknown as { collection: jest.Mock }
const mockedEvaluate = evaluate as jest.Mock
const mockedAIService = AIService.getInstance as jest.Mock
const mockedGetCached = getCachedExplanation as jest.Mock
const mockedSetCached = setCachedExplanation as jest.Mock

describe('/api/grammar/explain', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockedGetSession.mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/grammar/explain', {
      method: 'POST',
      body: JSON.stringify({ sentence: 'テスト' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('returns 403 when entitlement denies', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    mockedEvaluate.mockReturnValue({
      allow: false,
      remaining: 0,
      reason: 'limit_reached',
      policyVersion: 1,
    })

    const usageRef = { get: jest.fn().mockResolvedValue({ data: () => ({ grammar_explanations: 3 }) }) }
    const userRef = {
      get: jest.fn().mockResolvedValue({ data: () => ({ subscription: { plan: 'free' } }) }),
      collection: jest.fn().mockReturnValue({ doc: jest.fn(() => usageRef) }),
    }

    mockedAdminDb.collection.mockImplementation((name: string) => {
      if (name === 'users') return { doc: jest.fn(() => userRef) }
      return { doc: jest.fn() }
    })

    const request = new NextRequest('http://localhost/api/grammar/explain', {
      method: 'POST',
      body: JSON.stringify({ sentence: 'テスト' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(403)
  })

  it('returns explanation and increments usage when allowed', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    mockedEvaluate.mockReturnValue({
      allow: true,
      remaining: 3,
      reason: 'ok',
      policyVersion: 1,
      limit: 3,
    })
    mockedGetCached.mockResolvedValue(null)

    const usageSet = jest.fn().mockResolvedValue(true)
    const usageRef = {
      get: jest.fn().mockResolvedValue({ data: () => ({ grammar_explanations: 0 }) }),
      set: usageSet,
    }
    const userRef = {
      get: jest.fn().mockResolvedValue({ data: () => ({ subscription: { plan: 'free' }, profile: {} }) }),
      collection: jest.fn().mockReturnValue({ doc: jest.fn(() => usageRef) }),
    }

    mockedAdminDb.collection.mockImplementation((name: string) => {
      if (name === 'users') return { doc: jest.fn(() => userRef) }
      return { doc: jest.fn() }
    })

    mockedAIService.mockReturnValue({
      explainGrammarSentence: jest.fn().mockResolvedValue({
        success: true,
        data: { pattern: 'A', meaning: 'B' },
      }),
    })

    const request = new NextRequest('http://localhost/api/grammar/explain', {
      method: 'POST',
      body: JSON.stringify({ sentence: 'テスト' }),
    })

    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(usageSet).toHaveBeenCalled()
    expect(mockedSetCached).toHaveBeenCalled()
  })
})
