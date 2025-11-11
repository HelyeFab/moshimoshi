import { NextRequest, NextResponse } from 'next/server'
import {
  authenticate,
  requireAdmin,
  requireAuth,
  requirePremium,
  isPremiumUser,
} from '../auth'
import { handleOptions, setCorsHeaders, withCors } from '../cors'
import * as rateLimitModule from '../rateLimit'
import { validateSessionFromRequest } from '@/lib/auth'

jest.mock('@/lib/auth', () => ({
  validateSessionFromRequest: jest.fn(),
}))

jest.mock('@/lib/redis/client', () => ({
  redis: {},
}))

jest.mock('@upstash/ratelimit', () => {
  const limitMock = jest.fn()
  const MockRatelimit = jest.fn().mockImplementation(() => ({
    limit: limitMock,
  }))

  MockRatelimit.slidingWindow = jest
    .fn()
    .mockImplementation((requests: number, window: string) => ({
      requests,
      window,
    }))

  return {
    Ratelimit: MockRatelimit,
    __limitMock: limitMock,
  }
})

const mockValidateSessionFromRequest =
  validateSessionFromRequest as jest.MockedFunction<
    typeof validateSessionFromRequest
  >

const { __limitMock, Ratelimit } = jest.requireMock(
  '@upstash/ratelimit'
) as {
  __limitMock: jest.Mock
  Ratelimit: jest.Mock & { slidingWindow: jest.Mock }
}

const originalNodeEnv = process.env.NODE_ENV
const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL

beforeAll(() => {
  process.env.NODE_ENV = 'test'
  process.env.NEXT_PUBLIC_APP_URL = 'http://test.app'
})

afterAll(() => {
  process.env.NODE_ENV = originalNodeEnv
  process.env.NEXT_PUBLIC_APP_URL = originalAppUrl
})

afterEach(() => {
  jest.clearAllMocks()
  jest.restoreAllMocks()
  __limitMock.mockReset()
  Ratelimit.mockClear()
  Ratelimit.slidingWindow.mockClear()
})

const createRequest = (overrides: {
  method?: string
  headers?: Record<string, string>
} = {}) => {
  const headers = new Headers({
    'user-agent': 'jest',
    ...overrides.headers,
  })

  return {
    method: overrides.method ?? 'GET',
    headers,
  } as unknown as NextRequest
}

describe('Authentication middleware', () => {
  it('returns authenticated user when session is valid', async () => {
    const request = createRequest()
    const sessionUser = {
      uid: 'user-123',
      email: 'user@example.com',
      tier: 'free',
      admin: false,
      sessionId: 'session-1',
    } as any

    mockValidateSessionFromRequest.mockResolvedValue({
      valid: true,
      user: sessionUser,
    })

    const result = await authenticate(request)

    expect(result.user).toEqual(sessionUser)
    expect(result.response).toBeUndefined()
    expect(mockValidateSessionFromRequest).toHaveBeenCalledWith(request)
  })

  it('returns 401 response when authentication fails', async () => {
    const request = createRequest()

    mockValidateSessionFromRequest.mockResolvedValue({
      valid: false,
      user: null,
    } as any)

    const result = await authenticate(request)

    expect(result.user).toBeNull()
    expect(result.response?.status).toBe(401)
    const payload = await result.response?.json()
    expect(payload).toMatchObject({
      error: 'Unauthorized',
      code: 'AUTH_REQUIRED',
    })
  })

  it('requireAuth returns 401 response when session invalid', async () => {
    const request = createRequest()

    mockValidateSessionFromRequest.mockResolvedValue({
      valid: false,
      user: null,
    } as any)

    const result = await requireAuth(request)

    expect(result.user).toBeNull()
    expect(result.response?.status).toBe(401)
    const payload = await result.response?.json()
    expect(payload).toMatchObject({
      code: 'AUTH_REQUIRED',
    })
  })

  it('requireAdmin rejects non-admin users', async () => {
    const request = createRequest()
    const nonAdminUser = {
      uid: 'user-234',
      email: 'user@example.com',
      tier: 'free',
      admin: false,
      sessionId: 'session-2',
    } as any

    mockValidateSessionFromRequest.mockResolvedValue({
      valid: true,
      user: nonAdminUser,
    })

    const result = await requireAdmin(request)

    expect(result.user).toBeNull()
    expect(result.response?.status).toBe(403)
    const payload = await result.response?.json()
    expect(payload).toMatchObject({
      code: 'ADMIN_REQUIRED',
    })
  })

  it('requirePremium rejects free tier users with upgrade hint', async () => {
    const request = createRequest()
    const freeUser = {
      uid: 'user-345',
      email: 'user@example.com',
      tier: 'free',
      admin: false,
      sessionId: 'session-3',
    } as any

    mockValidateSessionFromRequest.mockResolvedValue({
      valid: true,
      user: freeUser,
    })

    const result = await requirePremium(request)

    expect(result.user).toBeNull()
    expect(result.response?.status).toBe(403)
    const payload = await result.response?.json()
    expect(payload).toMatchObject({
      code: 'PREMIUM_REQUIRED',
      upgradeUrl: '/pricing',
    })
  })

  it('requirePremium allows premium users', async () => {
    const request = createRequest()
    const premiumUser = {
      uid: 'user-456',
      email: 'user@example.com',
      tier: 'premium_yearly',
      admin: false,
      sessionId: 'session-4',
    } as any

    mockValidateSessionFromRequest.mockResolvedValue({
      valid: true,
      user: premiumUser,
    })

    const result = await requirePremium(request)

    expect(result.user).toEqual(premiumUser)
    expect(result.response).toBeUndefined()
  })
})

describe('isPremiumUser', () => {
  it.each([
    ['premium_yearly', true],
    ['premium_monthly', true],
    ['free', false],
    ['trial', false],
  ])('returns %s => %s', (tier, expected) => {
    const user = { tier } as any
    expect(isPremiumUser(user)).toBe(expected)
  })
})

describe('CORS middleware', () => {
  it('sets CORS headers for allowed origin', () => {
    const request = createRequest({
      headers: { origin: 'http://localhost:3000' },
    })
    const response = setCorsHeaders(new NextResponse(null, { status: 200 }), request)

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'http://localhost:3000'
    )
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET')
  })

  it('returns 204 for OPTIONS requests', () => {
    const optionsRequest = createRequest({ method: 'OPTIONS' })
    const response = handleOptions(optionsRequest)

    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true')
  })

  it('applies CORS headers to handler responses', async () => {
    const request = createRequest({
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
    })

    const handler = jest.fn().mockResolvedValue(
      NextResponse.json(
        { ok: true },
        {
          status: 200,
        }
      )
    )

    const response = await withCors(request, handler)

    expect(handler).toHaveBeenCalled()
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'http://localhost:3000'
    )
  })
})

describe('Rate limiting middleware', () => {
  it('returns success when limiter allows request', async () => {
    const request = createRequest({
      headers: { 'x-forwarded-for': '1.1.1.1' },
    })

    const limitResult = {
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 1000,
    }

    __limitMock.mockResolvedValue(limitResult)

    const result = await rateLimitModule.rateLimit(request, 'queue', 'user-1')

    expect(result.success).toBe(true)
    expect(__limitMock).toHaveBeenCalledWith('user-1')
  })

  it('returns 429 when requests exceed limit', async () => {
    const now = Date.now()
    jest.spyOn(Date, 'now').mockReturnValue(now)

    const request = createRequest({
      headers: { 'x-forwarded-for': '2.2.2.2' },
    })

    const limitResult = {
      success: false,
      limit: 5,
      remaining: 0,
      reset: now + 2000,
    }

    __limitMock.mockResolvedValue(limitResult)

    const result = await rateLimitModule.rateLimit(request, 'queue', 'user-2')

    expect(result.success).toBe(false)
    expect(result.response?.status).toBe(429)
    expect(result.response?.headers.get('Retry-After')).toBe('2')
    const payload = await result.response?.json()
    expect(payload).toMatchObject({
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 2,
    })
  })

  it('delegates to base limiter for non-premium users', async () => {
    const request = createRequest({
      headers: { 'x-user-tier': 'free' },
    })

    __limitMock.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 8,
      reset: Date.now() + 1000,
    })

    const result = await rateLimitModule.rateLimitByUser(
      request,
      'user-3',
      'queue'
    )

    expect(result.success).toBe(true)
    expect(__limitMock).toHaveBeenCalledWith('user-3')
  })
})
