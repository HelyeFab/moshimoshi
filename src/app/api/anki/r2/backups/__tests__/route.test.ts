import { NextRequest } from 'next/server'
import { GET } from '../route'
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

describe('/api/anki/r2/backups GET', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns backups and deleted deck ids', async () => {
    mockedRequireAuth.mockResolvedValue({ uid: 'user-1' })
    mockedRequireR2Entitlement.mockResolvedValue({ allowed: true })

    const backupsGet = jest.fn().mockResolvedValue({
      docs: [
        {
          id: 'deck-1',
          data: () => ({
            deckId: 'deck-1',
            name: 'Deck 1',
            cardCount: 10,
            hasMedia: false,
            updatedAt: 1,
            r2: { manifestKey: 'm1', packageKey: 'p1' },
          }),
        },
        {
          id: 'deck-2',
          data: () => ({
            deckId: 'deck-2',
            name: 'Deck 2',
            cardCount: 5,
            hasMedia: true,
            updatedAt: 2,
            r2: { manifestKey: 'm2', packageKey: 'p2' },
          }),
        },
      ],
    })

    const deletedGet = jest.fn().mockResolvedValue({
      docs: [{ id: 'deck-1' }],
    })

    mockedAdminDb.collection.mockImplementation((name: string) => {
      if (name === 'anki_r2_backups') {
        return {
          where: jest.fn(() => ({
            orderBy: jest.fn(() => ({
              get: backupsGet,
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
    })

    const request = new NextRequest('http://localhost/api/anki/r2/backups')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.backups).toHaveLength(1)
    expect(data.backups[0].deckId).toBe('deck-2')
    expect(data.deletedDeckIds).toEqual(['deck-1'])
  })
})
