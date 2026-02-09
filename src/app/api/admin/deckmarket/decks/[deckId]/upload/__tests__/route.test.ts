import { NextRequest } from 'next/server'

jest.mock('server-only', () => ({}))

jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(),
}))

let adminFirestoreMock: any = null

jest.mock('@/lib/firebase/admin', () => ({
  adminAuth: null,
  isAdminUserCached: jest.fn(),
  get adminFirestore() {
    return adminFirestoreMock
  },
  ensureAdminInitialized: jest.fn(),
  FieldValue: {
    serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
    increment: jest.fn((n: number) => `INCREMENT_${n}`),
  },
  __setAdminFirestore: (value: any) => {
    adminFirestoreMock = value
  },
}))

jest.mock('@/lib/r2/r2-client', () => ({
  getR2Config: jest.fn(() => ({
    client: { send: jest.fn().mockResolvedValue({}) },
    bucket: 'test-bucket',
    signedUrlTtlSeconds: 900,
  })),
}))

jest.mock('@aws-sdk/client-s3', () => ({
  PutObjectCommand: jest.fn().mockImplementation((params) => params),
}))

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://presigned.example.com/put'),
}))

import { POST } from '../route'
import { getSession } from '@/lib/auth/session'
import { isAdminUserCached, __setAdminFirestore } from '@/lib/firebase/admin'

const mockedGetSession = getSession as jest.Mock
const mockedIsAdmin = isAdminUserCached as jest.Mock

function mockAdminAuth() {
  mockedGetSession.mockResolvedValue({
    uid: 'admin-1',
    email: 'admin@test.com',
    admin: true,
    tier: 'admin',
    sessionId: 'sess-1',
  })
  mockedIsAdmin.mockResolvedValue(true)
}

function setMockFirestore(mockDb: any) {
  __setAdminFirestore(mockDb)
}

describe('/api/admin/deckmarket/decks/[deckId]/upload POST', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when no session', async () => {
    mockedGetSession.mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks/test-deck/upload', {
      method: 'POST',
      body: JSON.stringify({ filename: 'deck.apkg', fileSize: 1024 }),
    })

    const response = await POST(request, { params: Promise.resolve({ deckId: 'test-deck' }) })
    expect(response.status).toBe(401)
  })

  it('returns 404 when deck does not exist', async () => {
    mockAdminAuth()

    const deckRef = {
      get: jest.fn().mockResolvedValue({ exists: false }),
    }

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => deckRef),
      })),
    })

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks/test-deck/upload', {
      method: 'POST',
      body: JSON.stringify({ filename: 'deck.apkg', fileSize: 1024 }),
    })

    const response = await POST(request, { params: Promise.resolve({ deckId: 'test-deck' }) })
    expect(response.status).toBe(404)
  })

  it('returns 400 when filename is missing', async () => {
    mockAdminAuth()

    const deckRef = {
      get: jest.fn().mockResolvedValue({ exists: true }),
    }

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => deckRef),
      })),
    })

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks/test-deck/upload', {
      method: 'POST',
      body: JSON.stringify({ fileSize: 1024 }),
    })

    const response = await POST(request, { params: Promise.resolve({ deckId: 'test-deck' }) })
    expect(response.status).toBe(400)
  })

  it('returns 400 when fileSize is zero', async () => {
    mockAdminAuth()

    const deckRef = {
      get: jest.fn().mockResolvedValue({ exists: true }),
    }

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => deckRef),
      })),
    })

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks/test-deck/upload', {
      method: 'POST',
      body: JSON.stringify({ filename: 'deck.apkg', fileSize: 0 }),
    })

    const response = await POST(request, { params: Promise.resolve({ deckId: 'test-deck' }) })
    expect(response.status).toBe(400)
  })

  it('returns 400 when fileSize exceeds 200MB', async () => {
    mockAdminAuth()

    const deckRef = {
      get: jest.fn().mockResolvedValue({ exists: true }),
    }

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => deckRef),
      })),
    })

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks/test-deck/upload', {
      method: 'POST',
      body: JSON.stringify({ filename: 'deck.apkg', fileSize: 201 * 1024 * 1024 }),
    })

    const response = await POST(request, { params: Promise.resolve({ deckId: 'test-deck' }) })
    expect(response.status).toBe(400)
  })

  it('returns 400 for non-.apkg extension', async () => {
    mockAdminAuth()

    const deckRef = {
      get: jest.fn().mockResolvedValue({ exists: true }),
    }

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => deckRef),
      })),
    })

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks/test-deck/upload', {
      method: 'POST',
      body: JSON.stringify({ filename: 'deck.txt', fileSize: 1024 }),
    })

    const response = await POST(request, { params: Promise.resolve({ deckId: 'test-deck' }) })
    expect(response.status).toBe(400)
  })

  it('returns presigned URL and creates version doc', async () => {
    mockAdminAuth()

    const mockVersionSet = jest.fn().mockResolvedValue(undefined)
    const mockUpdate = jest.fn().mockResolvedValue(undefined)

    const deckRef = {
      get: jest.fn().mockResolvedValue({ exists: true }),
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          set: mockVersionSet,
        })),
      })),
      update: mockUpdate,
    }

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => deckRef),
      })),
    })

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks/test-deck/upload', {
      method: 'POST',
      body: JSON.stringify({ filename: 'deck.apkg', fileSize: 1024 }),
    })

    const response = await POST(request, { params: Promise.resolve({ deckId: 'test-deck' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.uploadUrl).toBe('https://presigned.example.com/put')
    expect(data.versionId).toBe('00000000-0000-4000-8000-000000000000')
    expect(data.r2Key).toContain('deckmarket/test-deck/')
    expect(data.expiresIn).toBe(900)
    expect(mockVersionSet).toHaveBeenCalledWith(
      expect.objectContaining({
        deckId: 'test-deck',
        sizeBytes: 1024,
        createdByUid: 'admin-1',
      })
    )
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        latestVersionId: '00000000-0000-4000-8000-000000000000',
      })
    )
  })
})
