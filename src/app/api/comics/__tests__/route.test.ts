import { NextRequest } from 'next/server'
import { GET as seriesGET } from '../series/route'
import { GET as episodesGET } from '../episodes/route'
import { GET as episodeGET } from '../episodes/[episodeId]/route'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/firebase/admin'
import { evaluate } from '@/lib/entitlements/evaluator'

jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(),
}))

jest.mock('@/lib/firebase/admin', () => ({
  db: {
    collection: jest.fn(),
  },
}))

jest.mock('@/lib/entitlements/evaluator', () => ({
  evaluate: jest.fn(),
}))

const mockedGetSession = getSession as jest.Mock
const mockedDb = db as unknown as { collection: jest.Mock }
const mockedEvaluate = evaluate as jest.Mock

describe('/api/comics entitlement gating', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockedGetSession.mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/comics/series')
    const response = await seriesGET(request)
    expect(response.status).toBe(401)
  })

  it('returns 403 when entitlement denies', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    mockedEvaluate.mockReturnValue({ allow: false, remaining: 0, reason: 'limit_reached' })

    const userDoc = { data: () => ({ subscription: { plan: 'free' } }) }
    mockedDb.collection.mockReturnValue({ doc: jest.fn(() => ({ get: jest.fn().mockResolvedValue(userDoc) })) })

    const request = new NextRequest('http://localhost/api/comics/episodes')
    const response = await episodesGET(request)
    expect(response.status).toBe(403)
  })

  it('allows access when entitlement allows', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1' })
    mockedEvaluate.mockReturnValue({ allow: true, remaining: -1, reason: 'ok' })

    const seriesDoc = { exists: false, data: () => ({}) }
    mockedDb.collection.mockImplementation((name: string) => {
      if (name === 'users') {
        return { doc: jest.fn(() => ({ get: jest.fn().mockResolvedValue({ data: () => ({ subscription: { plan: 'premium_monthly' } }) }) })) }
      }
      if (name === 'comic_series') {
        return { doc: jest.fn(() => ({ get: jest.fn().mockResolvedValue(seriesDoc) })) }
      }
      if (name === 'comics') {
        return {
          doc: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({ exists: false }),
          })),
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          get: jest.fn().mockResolvedValue({ docs: [] }),
        }
      }
      return { doc: jest.fn() }
    })

    const seriesResponse = await seriesGET(new NextRequest('http://localhost/api/comics/series'))
    expect(seriesResponse.status).toBe(200)

    const episodesResponse = await episodesGET(new NextRequest('http://localhost/api/comics/episodes'))
    expect(episodesResponse.status).toBe(200)

    const episodeResponse = await episodeGET(new NextRequest('http://localhost/api/comics/episodes/ep1'), {
      params: Promise.resolve({ episodeId: 'ep1' }),
    })
    expect(episodeResponse.status).toBe(404)
  })
})
