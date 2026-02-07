import { NextRequest } from 'next/server'
import { GET, PUT } from '../route'
import { getSession } from '@/lib/auth/session'
import { getAdminDb } from '@/lib/firebase/admin'

jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(),
}))

jest.mock('@/lib/firebase/admin', () => ({
  getAdminDb: jest.fn(),
}))

const mockedGetSession = getSession as jest.Mock
const mockedGetAdminDb = getAdminDb as jest.Mock

const buildUserDoc = (plan: string) => ({
  data: () => ({ subscription: { plan } }),
})

describe('/api/flashcards/streak-snapshots GET', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns items for premium users', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    const streakGet = jest.fn().mockResolvedValue({
      docs: [
        {
          id: '2026-02-07',
          data: () => ({ streak1: 1, streak2: 2, streak3plus: 3, total: 6, updatedAt: 123 }),
        },
      ],
    })

    const db = {
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue(buildUserDoc('premium_monthly')),
          collection: jest.fn(() => ({
            get: streakGet,
          })),
        })),
      })),
    }
    mockedGetAdminDb.mockReturnValue(db)

    const request = new NextRequest('http://localhost/api/flashcards/streak-snapshots')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.items).toHaveLength(1)
    expect(data.items[0].date).toBe('2026-02-07')
  })
})

describe('/api/flashcards/streak-snapshots PUT', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 403 for non-premium users', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    const db = {
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue(buildUserDoc('free')),
        })),
      })),
    }
    mockedGetAdminDb.mockReturnValue(db)

    const request = new NextRequest('http://localhost/api/flashcards/streak-snapshots', {
      method: 'PUT',
      body: JSON.stringify({
        date: '2026-02-07',
        streak1: 1,
        streak2: 2,
        streak3plus: 3,
        total: 6,
        updatedAt: 123,
      }),
    })

    const response = await PUT(request)
    expect(response.status).toBe(403)
  })

  it('stores streak snapshot for premium users', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    const setMock = jest.fn().mockResolvedValue(undefined)
    const db = {
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue(buildUserDoc('premium_yearly')),
          collection: jest.fn(() => ({
            doc: jest.fn(() => ({
              set: setMock,
            })),
          })),
        })),
      })),
    }
    mockedGetAdminDb.mockReturnValue(db)

    const request = new NextRequest('http://localhost/api/flashcards/streak-snapshots', {
      method: 'PUT',
      body: JSON.stringify({
        date: '2026-02-07',
        streak1: 1,
        streak2: 2,
        streak3plus: 3,
        total: 6,
        updatedAt: 123,
      }),
    })

    const response = await PUT(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        date: '2026-02-07',
        streak1: 1,
        streak2: 2,
        streak3plus: 3,
        total: 6,
        updatedAt: 123,
      }),
      { merge: true }
    )
  })
})
