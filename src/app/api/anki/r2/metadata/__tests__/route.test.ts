import { NextRequest } from 'next/server'
import { POST } from '../route'
import { requireAuth } from '@/lib/auth/session'
import { requireR2Entitlement } from '@/lib/api/r2-entitlement'
import { adminDb } from '@/lib/firebase/admin'

jest.mock('@/lib/auth/session', () => ({
  requireAuth: jest.fn(),
}))

jest.mock('@/lib/api/r2-entitlement', () => ({
  requireR2Entitlement: jest.fn(),
}))

jest.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: jest.fn(),
  },
}))

const mockedRequireAuth = requireAuth as jest.Mock
const mockedRequireR2Entitlement = requireR2Entitlement as jest.Mock
const mockedAdminDb = adminDb as unknown as { collection: jest.Mock }

describe('/api/anki/r2/metadata POST', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedRequireAuth.mockResolvedValue({ uid: 'user-1' })
  })

  it('stores metadata including deckmarket origin', async () => {
    const set = jest.fn().mockResolvedValue(undefined)
    mockedRequireR2Entitlement.mockResolvedValue({ allowed: true })
    mockedAdminDb.collection.mockImplementation((name: string) => {
      if (name === 'anki_r2_backups') {
        return {
          doc: jest.fn(() => ({ set })),
        }
      }
      return null
    })

    const request = new NextRequest('http://localhost/api/anki/r2/metadata', {
      method: 'POST',
      body: JSON.stringify({
        deckId: 'deck-1',
        name: 'Deck 1',
        cardCount: 10,
        hasMedia: true,
        totalBytes: 1000,
        origin: 'deckmarket',
        r2: {
          packageKey: 'users/user-1/decks/deck-1/package.apkg',
          manifestKey: 'users/user-1/decks/deck-1/manifest.json',
          mediaPrefix: 'users/user-1/decks/deck-1/media/',
        },
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        deckId: 'deck-1',
        origin: 'deckmarket',
        userId: 'user-1',
      })
    )
  })

  it('returns 403 when premium is required', async () => {
    mockedRequireR2Entitlement.mockResolvedValue({ allowed: false, reason: 'not_premium' })

    const request = new NextRequest('http://localhost/api/anki/r2/metadata', {
      method: 'POST',
      body: JSON.stringify({
        deckId: 'deck-1',
        name: 'Deck 1',
        cardCount: 10,
        hasMedia: true,
        totalBytes: 1000,
        r2: {
          packageKey: 'users/user-1/decks/deck-1/package.apkg',
          manifestKey: 'users/user-1/decks/deck-1/manifest.json',
          mediaPrefix: 'users/user-1/decks/deck-1/media/',
        },
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error?.code).toBe('PREMIUM_REQUIRED')
  })
})
