import { NextRequest } from 'next/server'
import { POST } from '../route'
import { getSession } from '@/lib/auth/session'
import { adminFirestore } from '@/lib/firebase/admin'
import { evaluateFeatureAccess } from '@/lib/entitlements/server'
import axios from 'axios'
import ytdl from '@distube/ytdl-core'

jest.mock('youtubei.js', () => ({
  Innertube: {
    create: jest.fn(),
  },
}))

jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(),
}))

jest.mock('@/lib/firebase/admin', () => ({
  adminFirestore: { collection: jest.fn() },
  Timestamp: { now: jest.fn(() => new Date('2025-12-26T12:00:00.000Z')) },
}))

jest.mock('@/lib/entitlements/server', () => ({
  evaluateFeatureAccess: jest.fn(),
}))

jest.mock('@/lib/ai/AIService', () => ({
  AIService: {
    getInstance: () => ({
      processTranscript: jest.fn(),
    }),
  },
}))

jest.mock('@/lib/transcript/cache', () => ({
  transcriptCache: { get: jest.fn().mockResolvedValue(null) },
}))

jest.mock('axios')
jest.mock('@distube/ytdl-core')

const mockedGetSession = getSession as jest.Mock
const mockedAdminFirestore = adminFirestore as unknown as { collection: jest.Mock }
const mockedEvaluateFeatureAccess = evaluateFeatureAccess as jest.Mock
const mockedAxios = axios as jest.Mocked<typeof axios>
const mockedYtdl = ytdl as jest.Mocked<typeof ytdl>

describe('/api/youtube/extract POST', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 429 when entitlement denies quota', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1', email: 'user@example.com' })
    mockedEvaluateFeatureAccess.mockResolvedValue({
      decision: { allow: false, remaining: 0, reason: 'limit_reached', limit: 3 },
      currentUsage: 3,
      bucketKey: 'youtube_shadowing_2025-12-26',
    })

    mockedAxios.get.mockResolvedValue({
      data: {
        items: [
          {
            snippet: {
              language: 'ja',
              name: 'Japanese',
              trackKind: 'standard',
            },
            id: 'track-1',
          },
        ],
      },
    } as any)

    mockedYtdl.validateURL.mockReturnValue(true)
    mockedYtdl.getVideoID.mockReturnValue('video-1')

    const docGet = jest.fn().mockResolvedValue({ exists: false })
    mockedAdminFirestore.collection.mockReturnValue({
      doc: jest.fn(() => ({ get: docGet })),
    })

    const request = new NextRequest('http://localhost/api/youtube/extract', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=video-1' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(429)
  })
})
