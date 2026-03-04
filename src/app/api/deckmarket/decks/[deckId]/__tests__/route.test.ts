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
      hasNativeAudio: true,
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

describe('/api/deckmarket/decks/[deckId] GET', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(firebaseAdmin as any).__setAdminFirestore(null)
  })

  it('returns 401 when no session', async () => {
    mockNotLoggedIn()

    const request = new NextRequest('http://localhost/api/deckmarket/decks/test-deck')
    const response = await GET(request, {
      params: Promise.resolve({ deckId: 'test-deck' }),
    })

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 404 when deck does not exist', async () => {
    mockLoggedIn()

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({ exists: false }),
        })),
      })),
    })

    const request = new NextRequest('http://localhost/api/deckmarket/decks/test-deck')
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

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue(deckDoc),
        })),
      })),
    })

    const request = new NextRequest('http://localhost/api/deckmarket/decks/test-deck')
    const response = await GET(request, {
      params: Promise.resolve({ deckId: 'test-deck' }),
    })

    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toBe('Deck not found')
  })

  it('returns deck with versions and latestVersion', async () => {
    mockLoggedIn()

    const deckDoc = createMockDeckDoc()
    const versionDoc = createMockVersionDoc('v-1')

    const mockDocRef = {
      get: jest.fn().mockResolvedValue(deckDoc),
      collection: jest.fn(() => ({
        orderBy: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({ docs: [versionDoc] }),
        })),
      })),
    }

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => mockDocRef),
      })),
    })

    const request = new NextRequest('http://localhost/api/deckmarket/decks/test-deck')
    const response = await GET(request, {
      params: Promise.resolve({ deckId: 'test-deck' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.deck.id).toBe('test-deck')
    expect(data.data.deck.hasNativeAudio).toBe(true)
    expect(data.data.deck.isPublished).toBe(true)
    expect(data.data.versions).toHaveLength(1)
    expect(data.data.latestVersion.id).toBe('v-1')
  })

  it('returns null latestVersion when latestVersionId is null', async () => {
    mockLoggedIn()

    const deckDoc = createMockDeckDoc({ latestVersionId: null })
    const versionDoc = createMockVersionDoc('v-1')

    const mockDocRef = {
      get: jest.fn().mockResolvedValue(deckDoc),
      collection: jest.fn(() => ({
        orderBy: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({ docs: [versionDoc] }),
        })),
      })),
    }

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => mockDocRef),
      })),
    })

    const request = new NextRequest('http://localhost/api/deckmarket/decks/test-deck')
    const response = await GET(request, {
      params: Promise.resolve({ deckId: 'test-deck' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.latestVersion).toBeNull()
  })

  it('serializes all Firestore Timestamps to ISO strings', async () => {
    mockLoggedIn()

    const deckDoc = createMockDeckDoc()
    const versionDoc = createMockVersionDoc('v-1')

    const mockDocRef = {
      get: jest.fn().mockResolvedValue(deckDoc),
      collection: jest.fn(() => ({
        orderBy: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({ docs: [versionDoc] }),
        })),
      })),
    }

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => mockDocRef),
      })),
    })

    const request = new NextRequest('http://localhost/api/deckmarket/decks/test-deck')
    const response = await GET(request, {
      params: Promise.resolve({ deckId: 'test-deck' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(typeof data.data.deck.createdAt).toBe('string')
    expect(typeof data.data.deck.updatedAt).toBe('string')
    expect(typeof data.data.deck.lastDownloadAt).toBe('string')
    expect(typeof data.data.versions[0].createdAt).toBe('string')
  })
})
