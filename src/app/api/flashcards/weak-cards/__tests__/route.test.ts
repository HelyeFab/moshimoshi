import { NextRequest } from 'next/server'
import { GET, PUT, DELETE } from '../route'
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

describe('/api/flashcards/weak-cards GET', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns items for premium users', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    const weakCardsGet = jest.fn().mockResolvedValue({
      docs: [
        {
          id: 'deck-1',
          data: () => ({ entries: [{ cardId: 'card-1', difficulty: 'again' }], updatedAt: 123 }),
        },
      ],
    })

    const db = {
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue(buildUserDoc('premium_monthly')),
          collection: jest.fn(() => ({
            get: weakCardsGet,
          })),
        })),
      })),
    }
    mockedGetAdminDb.mockReturnValue(db)

    const request = new NextRequest('http://localhost/api/flashcards/weak-cards')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.items).toHaveLength(1)
    expect(data.items[0].deckId).toBe('deck-1')
  })
})

describe('/api/flashcards/weak-cards PUT', () => {
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

    const request = new NextRequest('http://localhost/api/flashcards/weak-cards', {
      method: 'PUT',
      body: JSON.stringify({
        deckId: 'deck-1',
        entries: [{ cardId: 'card-1', difficulty: 'again' }],
      }),
    })

    const response = await PUT(request)
    expect(response.status).toBe(403)
  })

  it('stores weak cards for premium users', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    const setMock = jest.fn().mockResolvedValue(undefined)
    const db = {
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue(buildUserDoc('premium_monthly')),
          collection: jest.fn(() => ({
            doc: jest.fn(() => ({
              set: setMock,
            })),
          })),
        })),
      })),
    }
    mockedGetAdminDb.mockReturnValue(db)

    const request = new NextRequest('http://localhost/api/flashcards/weak-cards', {
      method: 'PUT',
      body: JSON.stringify({
        deckId: 'deck-1',
        entries: [{ cardId: 'card-1', difficulty: 'again' }],
      }),
    })

    const response = await PUT(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        entries: [{ cardId: 'card-1', difficulty: 'again' }],
        updatedAt: expect.any(Number),
      }),
      { merge: true }
    )
  })
})

describe('/api/flashcards/weak-cards DELETE', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('deletes weak cards for premium users', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    const deleteMock = jest.fn().mockResolvedValue(undefined)
    const db = {
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue(buildUserDoc('premium_monthly')),
          collection: jest.fn(() => ({
            doc: jest.fn(() => ({
              delete: deleteMock,
            })),
          })),
        })),
      })),
    }
    mockedGetAdminDb.mockReturnValue(db)

    const request = new NextRequest('http://localhost/api/flashcards/weak-cards', {
      method: 'DELETE',
      body: JSON.stringify({ deckId: 'deck-1' }),
    })

    const response = await DELETE(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(deleteMock).toHaveBeenCalled()
  })
})
