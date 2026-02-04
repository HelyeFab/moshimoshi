import { NextRequest } from 'next/server'
import { POST } from '../route'
import { getSession } from '@/lib/auth/session'
import { getAdminDb } from '@/lib/firebase/admin'
import { evaluateFeatureAccess, getUserPlan } from '@/lib/entitlements/server'

jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(),
}))

jest.mock('@/lib/firebase/admin', () => ({
  getAdminDb: jest.fn(),
}))

jest.mock('@/lib/entitlements/server', () => ({
  evaluateFeatureAccess: jest.fn(),
  getUserPlan: jest.fn(),
}))

const mockedGetSession = getSession as jest.Mock
const mockedGetAdminDb = getAdminDb as jest.Mock
const mockedEvaluateFeatureAccess = evaluateFeatureAccess as jest.Mock
const mockedGetUserPlan = getUserPlan as jest.Mock

describe('/api/flashcards/r2/upload-url POST', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 403 when flashcards entitlement denies', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    mockedGetUserPlan.mockResolvedValue('free')
    mockedEvaluateFeatureAccess.mockResolvedValue({
      decision: { allow: false, remaining: 0, reason: 'no_permission', limit: 0 },
    })
    mockedGetAdminDb.mockReturnValue({ collection: jest.fn() })

    const request = new NextRequest('http://localhost/api/flashcards/r2/upload-url', {
      method: 'POST',
      body: JSON.stringify({ deckId: 'deck-1', key: 'file.apkg' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(403)
  })

  it('returns 403 when plan is free even if entitlement allows', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    mockedGetUserPlan.mockResolvedValue('free')
    mockedEvaluateFeatureAccess.mockResolvedValue({
      decision: { allow: true, remaining: -1, reason: 'ok', limit: -1 },
    })
    mockedGetAdminDb.mockReturnValue({ collection: jest.fn() })

    const request = new NextRequest('http://localhost/api/flashcards/r2/upload-url', {
      method: 'POST',
      body: JSON.stringify({ deckId: 'deck-1', key: 'file.apkg' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(403)
  })
})
