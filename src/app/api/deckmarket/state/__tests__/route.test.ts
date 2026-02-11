import { NextRequest } from 'next/server'
import { GET, PUT, DELETE } from '../route'
import { getSession } from '@/lib/auth/session'
import { getAdminDb } from '@/lib/firebase/admin'
import { getUserPlan } from '@/lib/entitlements/server'

jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(),
}))

jest.mock('@/lib/firebase/admin', () => ({
  getAdminDb: jest.fn(),
}))

jest.mock('@/lib/entitlements/server', () => ({
  getUserPlan: jest.fn(),
}))

const mockedGetSession = getSession as jest.Mock
const mockedGetAdminDb = getAdminDb as jest.Mock
const mockedGetUserPlan = getUserPlan as jest.Mock

function mockSession() {
  mockedGetSession.mockResolvedValue({
    uid: 'user-1',
    email: 'user@test.com',
    tier: 'free',
    admin: false,
    sessionId: 'sess-1',
  })
}

describe('/api/deckmarket/state', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('GET returns 401 when not authenticated', async () => {
    mockedGetSession.mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/deckmarket/state')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('GET returns { deckId: null } when state doc is missing', async () => {
    mockSession()

    const getMock = jest.fn().mockResolvedValue({ exists: false })
    mockedGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          collection: jest.fn(() => ({
            doc: jest.fn(() => ({
              get: getMock,
            })),
          })),
        })),
      })),
    })

    const request = new NextRequest('http://localhost/api/deckmarket/state')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ deckId: null })
  })

  it('GET returns deckId and updatedAt when doc exists', async () => {
    mockSession()

    const getMock = jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({ deckId: 'deck-123', updatedAt: 1739300000000 }),
    })
    mockedGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          collection: jest.fn(() => ({
            doc: jest.fn(() => ({
              get: getMock,
            })),
          })),
        })),
      })),
    })

    const request = new NextRequest('http://localhost/api/deckmarket/state')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ deckId: 'deck-123', updatedAt: 1739300000000 })
  })

  it('PUT returns 403 for premium users', async () => {
    mockSession()
    mockedGetUserPlan.mockResolvedValue('premium_monthly')

    const request = new NextRequest('http://localhost/api/deckmarket/state', {
      method: 'PUT',
      body: JSON.stringify({ deckId: 'deck-1' }),
    })
    const response = await PUT(request)

    expect(response.status).toBe(403)
  })

  it('PUT returns 400 for invalid body', async () => {
    mockSession()
    mockedGetUserPlan.mockResolvedValue('free')

    const request = new NextRequest('http://localhost/api/deckmarket/state', {
      method: 'PUT',
      body: JSON.stringify({}),
    })
    const response = await PUT(request)

    expect(response.status).toBe(400)
  })

  it('PUT stores state for free users', async () => {
    mockSession()
    mockedGetUserPlan.mockResolvedValue('free')

    const setMock = jest.fn().mockResolvedValue(undefined)
    mockedGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          collection: jest.fn(() => ({
            doc: jest.fn(() => ({
              set: setMock,
            })),
          })),
        })),
      })),
    })

    const request = new NextRequest('http://localhost/api/deckmarket/state', {
      method: 'PUT',
      body: JSON.stringify({ deckId: 'deck-1' }),
    })
    const response = await PUT(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.deckId).toBe('deck-1')
    expect(typeof data.updatedAt).toBe('number')
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        deckId: 'deck-1',
        updatedAt: expect.any(Number),
      }),
      { merge: true }
    )
  })

  it('DELETE returns 403 for premium users', async () => {
    mockSession()
    mockedGetUserPlan.mockResolvedValue('premium_yearly')

    const request = new NextRequest('http://localhost/api/deckmarket/state', {
      method: 'DELETE',
    })
    const response = await DELETE(request)

    expect(response.status).toBe(403)
  })

  it('DELETE removes state for free users', async () => {
    mockSession()
    mockedGetUserPlan.mockResolvedValue('free')

    const deleteMock = jest.fn().mockResolvedValue(undefined)
    mockedGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          collection: jest.fn(() => ({
            doc: jest.fn(() => ({
              delete: deleteMock,
            })),
          })),
        })),
      })),
    })

    const request = new NextRequest('http://localhost/api/deckmarket/state', {
      method: 'DELETE',
    })
    const response = await DELETE(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(deleteMock).toHaveBeenCalled()
  })
})
