import { NextRequest } from 'next/server'
import { POST } from '../route'
import { requireAuth } from '@/lib/auth/session'
import { requireR2Entitlement } from '@/lib/api/r2-entitlement'
import { getR2Config } from '@/lib/r2/r2-client'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

jest.mock('@/lib/auth/session', () => ({
  requireAuth: jest.fn(),
}))

jest.mock('@/lib/api/r2-entitlement', () => ({
  requireR2Entitlement: jest.fn(),
}))

jest.mock('@/lib/r2/r2-client', () => ({
  getR2Config: jest.fn(),
}))

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}))

const mockedRequireAuth = requireAuth as jest.Mock
const mockedRequireR2Entitlement = requireR2Entitlement as jest.Mock
const mockedGetR2Config = getR2Config as jest.Mock
const mockedGetSignedUrl = getSignedUrl as jest.Mock

describe('/api/anki/r2/download-urls POST', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedGetR2Config.mockReturnValue({
      client: {},
      bucket: 'bucket',
      signedUrlTtlSeconds: 600,
    })
  })

  it('returns signed urls for valid keys', async () => {
    mockedRequireAuth.mockResolvedValue({ uid: 'user-1' })
    mockedRequireR2Entitlement.mockResolvedValue({ allowed: true })
    mockedGetSignedUrl
      .mockResolvedValueOnce('https://signed-url-1')
      .mockResolvedValueOnce('https://signed-url-2')

    const request = new NextRequest('http://localhost/api/anki/r2/download-urls', {
      method: 'POST',
      body: JSON.stringify({
        deckId: 'deck-1',
        keys: [
          'users/user-1/decks/deck-1/media/a.png',
          'users/user-1/decks/deck-1/media/b.png',
        ],
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.urls).toEqual([
      { key: 'users/user-1/decks/deck-1/media/a.png', url: 'https://signed-url-1' },
      { key: 'users/user-1/decks/deck-1/media/b.png', url: 'https://signed-url-2' },
    ])
    expect(data.expiresIn).toBe(600)
  })

  it('rejects invalid keys outside prefix', async () => {
    mockedRequireAuth.mockResolvedValue({ uid: 'user-1' })
    mockedRequireR2Entitlement.mockResolvedValue({ allowed: true })

    const request = new NextRequest('http://localhost/api/anki/r2/download-urls', {
      method: 'POST',
      body: JSON.stringify({
        deckId: 'deck-1',
        keys: ['users/user-2/decks/deck-1/media/a.png'],
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error?.code).toBe('INVALID_KEY')
  })

  it('returns 403 when premium required', async () => {
    mockedRequireAuth.mockResolvedValue({ uid: 'user-1' })
    mockedRequireR2Entitlement.mockResolvedValue({ allowed: false, reason: 'not_premium' })

    const request = new NextRequest('http://localhost/api/anki/r2/download-urls', {
      method: 'POST',
      body: JSON.stringify({
        deckId: 'deck-1',
        keys: ['users/user-1/decks/deck-1/media/a.png'],
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error?.code).toBe('PREMIUM_REQUIRED')
  })
})
