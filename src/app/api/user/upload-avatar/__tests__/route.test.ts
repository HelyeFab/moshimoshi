import { NextRequest } from 'next/server'
import { POST } from '../route'
import { getSession } from '@/lib/auth/session'
import { ensureAdminInitialized } from '@/lib/firebase/admin'
import { evaluateFeatureAccess, getUserPlan } from '@/lib/entitlements/server'

jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(),
}))

jest.mock('@/lib/firebase/admin', () => ({
  ensureAdminInitialized: jest.fn(),
}))

jest.mock('@/lib/entitlements/server', () => ({
  evaluateFeatureAccess: jest.fn(),
  getUserPlan: jest.fn(),
}))

const mockedGetSession = getSession as jest.Mock
const mockedEnsureAdminInitialized = ensureAdminInitialized as jest.Mock
const mockedEvaluateFeatureAccess = evaluateFeatureAccess as jest.Mock
const mockedGetUserPlan = getUserPlan as jest.Mock

describe('/api/user/upload-avatar POST', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedEnsureAdminInitialized.mockReturnValue(true)
  })

  it('returns 429 when entitlement denies upload', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    mockedGetUserPlan.mockResolvedValue('free')
    mockedEvaluateFeatureAccess.mockResolvedValue({
      decision: { allow: false, remaining: 0, reason: 'limit_reached', limit: 2 },
    })

    const formData = new FormData()
    formData.append('avatar', new Blob(['file'], { type: 'image/png' }), 'avatar.png')

    const request = new NextRequest('http://localhost/api/user/upload-avatar', {
      method: 'POST',
      body: formData as any,
    })

    const response = await POST(request)
    expect(response.status).toBe(429)
  })
})
