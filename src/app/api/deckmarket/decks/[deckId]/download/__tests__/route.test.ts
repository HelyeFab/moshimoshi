import { NextRequest } from 'next/server'
import { GET } from '../route'
import { getSession } from '@/lib/auth/session'
import * as firebaseAdmin from '@/lib/firebase/admin'

jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(),
}))

jest.mock('@/lib/firebase/admin', () => {
  let adminFirestoreValue: any = null
  return {
    get adminFirestore() {
      return adminFirestoreValue
    },
    __setAdminFirestore: (value: any) => {
      adminFirestoreValue = value
    },
    FieldValue: {
      serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
      increment: jest.fn((n: number) => `INCREMENT_${n}`),
    },
  }
})

jest.mock('@/lib/r2/r2-client', () => ({
  getR2Config: jest.fn(() => ({
    client: { send: jest.fn().mockResolvedValue({}) },
    bucket: 'test-bucket',
    signedUrlTtlSeconds: 3600,
  })),
}))

jest.mock('@/lib/r2/r2-keys', () => ({
  isValidDeckKey: jest.fn(() => true),
}))

jest.mock('@aws-sdk/client-s3', () => ({
  GetObjectCommand: jest.fn().mockImplementation((p) => p),
}))

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://presigned.example.com/download'),
}))

const mockedGetSession = getSession as jest.Mock

function setMockFirestore(mockDb: any) {
  ;(firebaseAdmin as any).__setAdminFirestore(mockDb)
}

function mockLoggedIn() {
  mockedGetSession.mockResolvedValue({
    uid: 'user-1',
    email: 'user@test.com',
    tier: 'free',
    admin: false,
    sessionId: 'sess-1',
  })
}

function mockNotLoggedIn() {
  mockedGetSession.mockResolvedValue(null)
}

function createMockDeckDoc(overrides: Record<string, any> = {}) {
  return {
    exists: true,
    id: 'test-deck',
    data: () => ({
      title: 'Test Deck',
      description: 'A test deck',
      language: 'ja',
      jlpt: 'N5',
      tags: ['vocab'],
      isPublished: true,
      latestVersionId: 'v-1',
      downloadCount: 42,
      lastDownloadAt: { toDate: () => new Date('2026-02-08') },
      createdAt: { toDate: () => new Date('2026-02-01') },
      updatedAt: { toDate: () => new Date('2026-02-09') },
      ...overrides,
    }),
  }
}

function createMockVersionDoc(id: string = 'v-1', overrides: Record<string, any> = {}) {
  return {
    exists: true,
    id,
    data: () => ({
      deckId: 'test-deck',
      versionLabel: 'v1',
      changelog: 'Initial release',
      apkgR2Key: `deckmarket/test-deck/${id}/deck.apkg`,
      apkgFilename: 'deck.apkg',
      sizeBytes: 1024000,
      sha256: null,
      createdAt: { toDate: () => new Date('2026-02-01') },
      createdByUid: 'admin-1',
      ...overrides,
    }),
  }
}

describe('/api/deckmarket/decks/[deckId]/download GET', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(firebaseAdmin as any).__setAdminFirestore(null)
  })

  it('returns 401 when no session', async () => {
    mockNotLoggedIn()

    const request = new NextRequest('http://localhost/api/deckmarket/decks/test-deck/download')
    const response = await GET(request, {
      params: Promise.resolve({ deckId: 'test-deck' }),
    })

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 404 when deck does not exist', async () => {
    mockLoggedIn()

    const mockDocRef = {
      get: jest.fn().mockResolvedValue({ exists: false }),
    }

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => mockDocRef),
      })),
    })

    const request = new NextRequest('http://localhost/api/deckmarket/decks/test-deck/download')
    const response = await GET(request, {
      params: Promise.resolve({ deckId: 'test-deck' }),
    })

    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toBe('Deck not found')
  })

  it('returns 404 when deck is not published', async () => {
    mockLoggedIn()

    const deckDoc = createMockDeckDoc({ isPublished: false })
    const mockDocRef = {
      get: jest.fn().mockResolvedValue(deckDoc),
    }

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => mockDocRef),
      })),
    })

    const request = new NextRequest('http://localhost/api/deckmarket/decks/test-deck/download')
    const response = await GET(request, {
      params: Promise.resolve({ deckId: 'test-deck' }),
    })

    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toBe('Deck not found')
  })

  it('returns 404 when no latestVersionId', async () => {
    mockLoggedIn()

    const deckDoc = createMockDeckDoc({ latestVersionId: null })
    const mockDocRef = {
      get: jest.fn().mockResolvedValue(deckDoc),
    }

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => mockDocRef),
      })),
    })

    const request = new NextRequest('http://localhost/api/deckmarket/decks/test-deck/download')
    const response = await GET(request, {
      params: Promise.resolve({ deckId: 'test-deck' }),
    })

    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toBe('No version available')
  })

  it('returns 404 when version doc does not exist', async () => {
    mockLoggedIn()

    const deckDoc = createMockDeckDoc({ latestVersionId: 'v-1' })
    const mockDocRef = {
      get: jest.fn().mockResolvedValue(deckDoc),
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({ exists: false }),
        })),
      })),
    }

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => mockDocRef),
      })),
    })

    const request = new NextRequest('http://localhost/api/deckmarket/decks/test-deck/download')
    const response = await GET(request, {
      params: Promise.resolve({ deckId: 'test-deck' }),
    })

    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toBe('Version not found')
  })

  it('returns presigned download URL and increments stats', async () => {
    mockLoggedIn()

    const mockUpdate = jest.fn().mockResolvedValue(undefined)
    const deckDoc = createMockDeckDoc({ latestVersionId: 'v-1' })
    const versionDoc = createMockVersionDoc('v-1')

    const mockDocRef = {
      get: jest.fn().mockResolvedValue(deckDoc),
      update: mockUpdate,
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue(versionDoc),
        })),
      })),
    }

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => mockDocRef),
      })),
    })

    const request = new NextRequest('http://localhost/api/deckmarket/decks/test-deck/download')
    const response = await GET(request, {
      params: Promise.resolve({ deckId: 'test-deck' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.downloadUrl).toBe('https://presigned.example.com/download')
    expect(data.filename).toBe('deck.apkg')
    expect(data.sizeBytes).toBe(1024000)
    expect(data.expiresIn).toBe(3600)

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        downloadCount: 'INCREMENT_1',
        lastDownloadAt: 'SERVER_TIMESTAMP',
      })
    )
  })
})
