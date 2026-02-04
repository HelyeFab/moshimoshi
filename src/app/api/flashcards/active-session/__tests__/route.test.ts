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

function buildAdminDb({ plan = 'premium_monthly', sessionDoc = null }: { plan?: string; sessionDoc?: any }) {
  const flashcardActiveSessions = {
    doc: jest.fn(() => ({
      get: jest.fn().mockResolvedValue({ exists: !!sessionDoc, data: () => sessionDoc }),
      set: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    })),
    orderBy: jest.fn(() => ({
      limit: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({
          empty: !sessionDoc,
          docs: sessionDoc ? [{ data: () => sessionDoc }] : [],
        }),
      })),
    })),
  }

  return {
    collection: jest.fn((name: string) => {
      if (name === 'users') {
        return {
          doc: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({ data: () => ({ subscription: { plan } }) }),
            collection: jest.fn(() => flashcardActiveSessions),
          })),
        }
      }
      return null
    }),
  }
}

describe('/api/flashcards/active-session', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('GET returns latest session when present', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    mockedGetAdminDb.mockReturnValue(buildAdminDb({
      sessionDoc: { userId: 'user-1', deckId: 'deck-1', savedAt: 123 }
    }))

    const request = new NextRequest('http://localhost/api/flashcards/active-session')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.session?.deckId).toBe('deck-1')
  })

  it('PUT rejects non-premium users', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    mockedGetAdminDb.mockReturnValue(buildAdminDb({ plan: 'free' }))

    const request = new NextRequest('http://localhost/api/flashcards/active-session', {
      method: 'PUT',
      body: JSON.stringify({
        version: 1,
        userId: 'user-1',
        deckId: 'deck-1',
        mode: 'classic',
        cardIds: ['c1'],
        currentIndex: 0,
        responses: [],
        correctCount: 0,
        incorrectCount: 0,
        skippedCount: 0,
        newCardsStudied: 0,
        learningCardsStudied: 0,
        reviewCardsStudied: 0,
        streakCount: 0,
        bestStreak: 0,
        totalResponseTime: 0,
        fastestResponseTime: 0,
        slowestResponseTime: 0,
        elapsedTime: 0,
        pausedTime: 0,
        isPaused: false,
        savedAt: Date.now(),
      }),
    })

    const response = await PUT(request)
    expect(response.status).toBe(403)
  })

  it('DELETE removes session for premium user', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    const adminDb = buildAdminDb({ plan: 'premium_monthly' })
    mockedGetAdminDb.mockReturnValue(adminDb)

    const request = new NextRequest('http://localhost/api/flashcards/active-session?deckId=deck-1', {
      method: 'DELETE',
    })
    const response = await DELETE(request)
    expect(response.status).toBe(200)
  })
})
