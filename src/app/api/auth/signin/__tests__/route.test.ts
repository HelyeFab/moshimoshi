import { NextRequest } from 'next/server'
import { POST } from '../route'

jest.mock('@/lib/firebase/admin', () => {
  const mockGetUser = jest.fn()
  const mockGetDoc = jest.fn()
  const mockEnsureUserProfile = jest.fn()
  const mockSetAdminClaims = jest.fn()
  const mockIsAdminUserCached = jest.fn()

  return {
    adminAuth: {
      getUser: mockGetUser,
    },
    adminFirestore: {
      collection: () => ({
        doc: () => ({
          get: mockGetDoc,
          update: jest.fn(),
        }),
      }),
    },
    ensureAdminInitialized: jest.fn(),
    ensureUserProfile: (...args: unknown[]) => mockEnsureUserProfile(...args),
    setAdminClaims: (...args: unknown[]) => mockSetAdminClaims(...args),
    isAdminUserCached: (...args: unknown[]) => mockIsAdminUserCached(...args),
    __mocks: {
      mockGetUser,
      mockGetDoc,
      mockEnsureUserProfile,
      mockSetAdminClaims,
      mockIsAdminUserCached,
    },
  }
})

jest.mock('@/lib/auth/session', () => {
  const mockCreateSession = jest.fn()
  return {
    createSession: (...args: unknown[]) => mockCreateSession(...args),
    __mocks: { mockCreateSession },
  }
})

jest.mock('@/lib/auth/validation', () => ({
  signInSchema: {
    parse: (body: any) => body,
  },
  getSecurityHeaders: () => ({}),
  formatZodErrors: jest.fn(),
}))

jest.mock('@/lib/auth/rateLimit', () => ({
  checkSigninRateLimit: jest.fn().mockResolvedValue({ success: true }),
  getRateLimitHeaders: jest.fn().mockReturnValue({}),
  trackAuthAttempt: jest.fn(),
  isLockedOut: jest.fn().mockResolvedValue(false),
}))

jest.mock('@/lib/auth/audit', () => ({
  logAuditEvent: jest.fn(),
  logAuthAttempt: jest.fn(),
  AuditEvent: {
    FAILED_LOGIN: 'FAILED_LOGIN',
    SIGN_IN: 'SIGN_IN',
    SYSTEM_ERROR: 'SYSTEM_ERROR',
  },
}))

jest.mock('@/lib/auth/recaptcha', () => ({
  verifyReCaptcha: jest.fn(),
  isReCaptchaConfigured: jest.fn().mockReturnValue(false),
}))

describe('/api/auth/signin', () => {
  const ORIGINAL_ENV = { ...process.env }
  const adminMocks = jest.requireMock('@/lib/firebase/admin').__mocks as {
    mockGetUser: jest.Mock
    mockGetDoc: jest.Mock
    mockEnsureUserProfile: jest.Mock
    mockSetAdminClaims: jest.Mock
    mockIsAdminUserCached: jest.Mock
  }
  const sessionMocks = jest.requireMock('@/lib/auth/session').__mocks as {
    mockCreateSession: jest.Mock
  }

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {
      ...ORIGINAL_ENV,
      NEXT_PUBLIC_FIREBASE_API_KEY: 'test_api_key',
    }
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })

  it('returns config error when Firebase API key is missing', async () => {
    process.env = {
      ...ORIGINAL_ENV,
      NEXT_PUBLIC_FIREBASE_API_KEY: '',
    }

    const req = new NextRequest('http://localhost/api/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email: 'user@test.com', password: 'Password123!' }),
      headers: { 'content-type': 'application/json' },
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error?.code).toBe('AUTH_CONFIG_ERROR')
  })

  it('returns invalid credentials when REST auth fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'INVALID_PASSWORD' } }),
    }) as unknown as typeof fetch

    const req = new NextRequest('http://localhost/api/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email: 'user@test.com', password: 'Password123!' }),
      headers: { 'content-type': 'application/json' },
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error?.code).toBe('AUTH_INVALID_CREDENTIALS')
  })

  it('creates a session when REST auth succeeds', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        localId: 'uid_123',
        email: 'user@test.com',
        idToken: 'token',
        refreshToken: 'refresh',
        expiresIn: '3600',
      }),
    }) as unknown as typeof fetch

    adminMocks.mockGetUser.mockResolvedValue({
      uid: 'uid_123',
      email: 'user@test.com',
      emailVerified: true,
    })

    adminMocks.mockGetDoc.mockResolvedValue({
      exists: true,
      data: () => ({
        displayName: 'Test User',
        userState: 'active',
      }),
    })

    adminMocks.mockIsAdminUserCached.mockResolvedValue(false)
    sessionMocks.mockCreateSession.mockResolvedValue({
      uid: 'uid_123',
      email: 'user@test.com',
      sessionId: 'sid_123',
    })

    const req = new NextRequest('http://localhost/api/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email: 'user@test.com', password: 'Password123!' }),
      headers: { 'content-type': 'application/json' },
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(sessionMocks.mockCreateSession).toHaveBeenCalled()
  })
})
