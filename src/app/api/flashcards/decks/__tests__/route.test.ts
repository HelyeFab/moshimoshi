import { NextRequest } from 'next/server'
import { GET, POST } from '../route'
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

describe('/api/flashcards/decks POST', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 403 when flashcards entitlement denies', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    mockedGetUserPlan.mockResolvedValue('free')
    mockedEvaluateFeatureAccess.mockResolvedValue({
      decision: { allow: false, remaining: 0, reason: 'no_permission', limit: 0 },
    })

    const request = new NextRequest('http://localhost/api/flashcards/decks', {
      method: 'POST',
      body: JSON.stringify({ decks: [] }),
    })

    const response = await POST(request)
    expect(response.status).toBe(403)
  })

  it('returns 429 when deck limit exceeded', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    mockedGetUserPlan.mockResolvedValue('premium_monthly')
    mockedEvaluateFeatureAccess
      .mockResolvedValueOnce({
        decision: { allow: true, remaining: -1, reason: 'ok', limit: -1 },
      })
      .mockResolvedValueOnce({
        decision: { allow: true, remaining: 0, reason: 'ok', limit: 0 },
        currentUsage: 0,
        bucketKey: 'flashcard_decks_2025-12',
      })

    const db = {
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({})),
      })),
      getAll: jest.fn().mockResolvedValue([]),
    }
    mockedGetAdminDb.mockReturnValue(db)

    const request = new NextRequest('http://localhost/api/flashcards/decks', {
      method: 'POST',
      body: JSON.stringify({ decks: [{ id: 'deck-1', userId: 'user-1', source: 'local', updatedAt: 1 }] }),
    })

    const response = await POST(request)
    expect(response.status).toBe(429)
  })
})

describe('/api/flashcards/decks GET', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns decks and deleted deck ids', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    mockedGetUserPlan.mockResolvedValue('premium_monthly')
    mockedEvaluateFeatureAccess.mockResolvedValue({
      decision: { allow: true, remaining: -1, reason: 'ok', limit: -1 },
    })

    const flashcardDecksGet = jest.fn().mockResolvedValue({
      docs: [
        { id: 'deck-1', data: () => ({ userId: 'user-1', source: 'user', updatedAt: 2, name: 'Deck 1' }) },
        { id: 'anki-1', data: () => ({ userId: 'user-1', source: 'anki', updatedAt: 3, name: 'Anki 1' }) },
      ],
    })
    const deletedGet = jest.fn().mockResolvedValue({
      docs: [{ id: 'deck-1' }, { id: 'deck-9' }],
    })

    const db = {
      collection: jest.fn((name: string) => {
        if (name === 'flashcardDecks') {
          return {
            where: jest.fn(() => ({
              orderBy: jest.fn(() => ({
                get: flashcardDecksGet,
              })),
            })),
          }
        }
        if (name === 'users') {
          return {
            doc: jest.fn(() => ({
              collection: jest.fn(() => ({
                where: jest.fn(() => ({
                  get: deletedGet,
                })),
              })),
            })),
          }
        }
        return null
      }),
    }
    mockedGetAdminDb.mockReturnValue(db)

    const request = new NextRequest('http://localhost/api/flashcards/decks')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.decks).toHaveLength(1)
    expect(data.decks[0].id).toBe('deck-1')
    expect(data.deletedDeckIds).toEqual(['deck-1', 'deck-9'])
  })
})
