import { NextRequest } from 'next/server'
import { POST } from '../route'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { evaluate } from '@/lib/entitlements/evaluator'
import { AIService } from '@/lib/ai/AIService'
import { getCachedWordExplanation, setCachedWordExplanation } from '@/lib/ai/cache/WordExplanationCache'

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

jest.mock('@/lib/ai/cache/WordExplanationCache', () => ({
  getCachedWordExplanation: jest.fn(),
  setCachedWordExplanation: jest.fn(),
}))

const mockedGetSession = getSession as jest.Mock
const mockedAdminDb = adminDb as unknown as { collection: jest.Mock }
const mockedEvaluate = evaluate as jest.Mock
const mockedAIService = AIService.getInstance as jest.Mock
const mockedGetCached = getCachedWordExplanation as jest.Mock
const mockedSetCached = setCachedWordExplanation as jest.Mock

describe('/api/word/explain', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockedGetSession.mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/word/explain', {
      method: 'POST',
      body: JSON.stringify({ word: '猫' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('returns 403 when entitlement denies standalone lookup', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    mockedEvaluate.mockReturnValue({
      allow: false,
      remaining: 0,
      reason: 'limit_reached',
      policyVersion: 1,
    })

    const usageRef = { get: jest.fn().mockResolvedValue({ data: () => ({ word_lookup: 15 }) }) }
    const userRef = {
      get: jest.fn().mockResolvedValue({ data: () => ({ subscription: { plan: 'free' } }) }),
      collection: jest.fn().mockReturnValue({ doc: jest.fn(() => usageRef) }),
    }

    mockedAdminDb.collection.mockImplementation((name: string) => {
      if (name === 'users') return { doc: jest.fn(() => userRef) }
      return { doc: jest.fn() }
    })

    const request = new NextRequest('http://localhost/api/word/explain', {
      method: 'POST',
      body: JSON.stringify({ word: '猫' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(403)
  })

  it('skips quota when content headers are provided', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    mockedGetCached.mockResolvedValue(null)
    mockedAIService.mockReturnValue({
      explainWord: jest.fn().mockResolvedValue({
        success: true,
        data: { word: '猫', meaning: 'cat' },
      }),
    })

    const userRef = {
      get: jest.fn().mockResolvedValue({ data: () => ({ subscription: { plan: 'free' } }) }),
    }
    mockedAdminDb.collection.mockImplementation((name: string) => {
      if (name === 'users') return { doc: jest.fn(() => userRef) }
      return { doc: jest.fn() }
    })

    const request = new NextRequest('http://localhost/api/word/explain', {
      method: 'POST',
      headers: {
        'x-content-id': 'comic-1',
        'x-content-type': 'comic',
      },
      body: JSON.stringify({ word: '猫' }),
    })

    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockedEvaluate).not.toHaveBeenCalled()
  })

  it('returns explanation and increments usage when allowed', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    mockedEvaluate.mockReturnValue({
      allow: true,
      remaining: 10,
      reason: 'ok',
      policyVersion: 1,
      limit: 15,
    })
    mockedGetCached.mockResolvedValue(null)

    const usageSet = jest.fn().mockResolvedValue(true)
    const usageRef = {
      get: jest.fn().mockResolvedValue({ data: () => ({ word_lookup: 0 }) }),
      set: usageSet,
    }
    const userRef = {
      get: jest.fn().mockResolvedValue({ data: () => ({ subscription: { plan: 'free' } }) }),
      collection: jest.fn().mockReturnValue({ doc: jest.fn(() => usageRef) }),
    }

    mockedAdminDb.collection.mockImplementation((name: string) => {
      if (name === 'users') return { doc: jest.fn(() => userRef) }
      return { doc: jest.fn() }
    })

    mockedAIService.mockReturnValue({
      explainWord: jest.fn().mockResolvedValue({
        success: true,
        data: { word: '猫', meaning: 'cat' },
      }),
    })

    const request = new NextRequest('http://localhost/api/word/explain', {
      method: 'POST',
      body: JSON.stringify({ word: '猫' }),
    })

    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(usageSet).toHaveBeenCalled()
    expect(mockedSetCached).toHaveBeenCalled()
  })
})
