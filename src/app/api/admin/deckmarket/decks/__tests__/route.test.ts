import { NextRequest } from 'next/server'

// Mock server-only (withAdminAuth imports it)
jest.mock('server-only', () => ({}))

// Mock auth/session for withAdminAuth's dynamic import
jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(),
}))

let adminFirestoreMock: any = null

// Mock firebase/admin
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

import { GET, POST } from '../route'
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

describe('/api/admin/deckmarket/decks GET', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when no session', async () => {
    mockedGetSession.mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks')
    const response = await GET(request, { params: Promise.resolve({}) })

    expect(response.status).toBe(401)
  })

  it('returns 403 when user is not admin', async () => {
    mockedGetSession.mockResolvedValue({ uid: 'user-1', email: 'user@test.com' })
    mockedIsAdmin.mockResolvedValue(false)

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks')
    const response = await GET(request, { params: Promise.resolve({}) })

    expect(response.status).toBe(403)
  })

  it('returns empty array when no decks exist', async () => {
    mockAdminAuth()

    const mockCollection = {
      where: jest.fn(() => mockCollection),
      orderBy: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ docs: [] }),
      })),
    }

    setMockFirestore({
      collection: jest.fn(() => mockCollection),
    })

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks')
    const response = await GET(request, { params: Promise.resolve({}) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data).toHaveLength(0)
  })

  it('returns all decks with serialized timestamps', async () => {
    mockAdminAuth()

    const mockDoc = {
      id: 'genki-1',
      data: () => ({
        title: 'Genki 1',
        description: 'A deck',
        tags: ['vocabulary'],
        jlpt: 'N5',
        language: 'ja',
        downloadCount: 42,
        isPublished: true,
        updatedAt: { toDate: () => new Date('2026-02-09T00:00:00Z') },
        createdAt: { toDate: () => new Date('2026-02-01T00:00:00Z') },
      }),
    }

    const mockCollection = {
      where: jest.fn(() => mockCollection),
      orderBy: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ docs: [mockDoc] }),
      })),
    }

    setMockFirestore({
      collection: jest.fn(() => mockCollection),
    })

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks')
    const response = await GET(request, { params: Promise.resolve({}) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data).toHaveLength(1)
    expect(data.data[0].id).toBe('genki-1')
    expect(data.data[0].title).toBe('Genki 1')
    expect(data.data[0].isPublished).toBe(true)
    expect(data.data[0].updatedAt).toBe('2026-02-09T00:00:00.000Z')
  })

  it('filters by published=true', async () => {
    mockAdminAuth()

    const orderByGet = jest.fn().mockResolvedValue({ docs: [] })
    const mockCollection = {
      where: jest.fn(() => mockCollection),
      orderBy: jest.fn(() => ({ get: orderByGet })),
    }

    setMockFirestore({
      collection: jest.fn(() => mockCollection),
    })

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks?published=true')
    const response = await GET(request, { params: Promise.resolve({}) })

    expect(response.status).toBe(200)
    expect(mockCollection.where).toHaveBeenCalledWith('isPublished', '==', true)
  })

  it('filters by published=false', async () => {
    mockAdminAuth()

    const orderByGet = jest.fn().mockResolvedValue({ docs: [] })
    const mockCollection = {
      where: jest.fn(() => mockCollection),
      orderBy: jest.fn(() => ({ get: orderByGet })),
    }

    setMockFirestore({
      collection: jest.fn(() => mockCollection),
    })

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks?published=false')
    const response = await GET(request, { params: Promise.resolve({}) })

    expect(response.status).toBe(200)
    expect(mockCollection.where).toHaveBeenCalledWith('isPublished', '==', false)
  })

  it('filters by search query', async () => {
    mockAdminAuth()

    const mockDocs = [
      {
        id: 'deck-1',
        data: () => ({
          title: 'JLPT N5 Vocab',
          description: 'Basic words',
          tags: [],
          jlpt: 'N5',
          language: 'ja',
          downloadCount: 0,
          isPublished: false,
          updatedAt: { toDate: () => new Date('2026-02-09T00:00:00Z') },
        }),
      },
      {
        id: 'deck-2',
        data: () => ({
          title: 'Advanced',
          description: 'N1 grammar',
          tags: [],
          jlpt: 'N1',
          language: 'ja',
          downloadCount: 0,
          isPublished: false,
          updatedAt: { toDate: () => new Date('2026-02-09T00:00:00Z') },
        }),
      },
    ]

    const mockCollection = {
      where: jest.fn(() => mockCollection),
      orderBy: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ docs: mockDocs }),
      })),
    }

    setMockFirestore({
      collection: jest.fn(() => mockCollection),
    })

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks?search=jlpt')
    const response = await GET(request, { params: Promise.resolve({}) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data).toHaveLength(1)
    expect(data.data[0].id).toBe('deck-1')
  })
})

describe('/api/admin/deckmarket/decks POST', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when no session', async () => {
    mockedGetSession.mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test Deck' }),
    })

    const response = await POST(request, { params: Promise.resolve({}) })
    expect(response.status).toBe(401)
  })

  it('returns 400 when title is missing', async () => {
    mockAdminAuth()

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks', {
      method: 'POST',
      body: JSON.stringify({}),
    })

    const response = await POST(request, { params: Promise.resolve({}) })
    expect(response.status).toBe(400)
  })

  it('returns 400 when title is empty string', async () => {
    mockAdminAuth()

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks', {
      method: 'POST',
      body: JSON.stringify({ title: '   ' }),
    })

    const response = await POST(request, { params: Promise.resolve({}) })
    expect(response.status).toBe(400)
  })

  it('returns 400 for invalid slug format', async () => {
    mockAdminAuth()

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test Deck', id: 'Bad Slug' }),
    })

    const response = await POST(request, { params: Promise.resolve({}) })
    expect(response.status).toBe(400)
  })

  it('returns 400 when slug already exists', async () => {
    mockAdminAuth()

    const mockGet = jest.fn().mockResolvedValue({ exists: true })
    const mockSet = jest.fn().mockResolvedValue(undefined)

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: mockGet,
          set: mockSet,
        })),
      })),
    })

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test Deck', id: 'test-deck' }),
    })

    const response = await POST(request, { params: Promise.resolve({}) })
    expect(response.status).toBe(400)
  })

  it('returns 400 for invalid JLPT level', async () => {
    mockAdminAuth()

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test Deck', id: 'test-deck', jlpt: 'N6' }),
    })

    const response = await POST(request, { params: Promise.resolve({}) })
    expect(response.status).toBe(400)
  })

  it('creates deck with correct document shape', async () => {
    mockAdminAuth()

    const mockSet = jest.fn().mockResolvedValue(undefined)
    const mockGet = jest.fn().mockResolvedValue({ exists: false })

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: mockGet,
          set: mockSet,
        })),
      })),
    })

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test Deck',
        id: 'test-deck',
        description: 'A test deck',
        hasNativeAudio: true,
        language: 'ja',
        jlpt: 'N5',
        tags: ['test'],
      }),
    })

    const response = await POST(request, { params: Promise.resolve({}) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.id).toBe('test-deck')
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test-deck',
        title: 'Test Deck',
        hasNativeAudio: true,
        isPublished: false,
        downloadCount: 0,
      })
    )
  })

  it('auto-generates slug from title when id not provided', async () => {
    mockAdminAuth()

    const mockSet = jest.fn().mockResolvedValue(undefined)
    const mockGet = jest.fn().mockResolvedValue({ exists: false })
    const docSpy = jest.fn(() => ({
      get: mockGet,
      set: mockSet,
    }))

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: docSpy,
      })),
    })

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks', {
      method: 'POST',
      body: JSON.stringify({
        title: 'My New Deck',
        description: 'A test deck',
      }),
    })

    const response = await POST(request, { params: Promise.resolve({}) })
    expect(response.status).toBe(200)
    expect(docSpy).toHaveBeenCalledWith('my-new-deck')
  })

  it('defaults hasNativeAudio to false when omitted', async () => {
    mockAdminAuth()

    const mockSet = jest.fn().mockResolvedValue(undefined)
    const mockGet = jest.fn().mockResolvedValue({ exists: false })

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: mockGet,
          set: mockSet,
        })),
      })),
    })

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Audio Unknown Deck',
        id: 'audio-unknown-deck',
      }),
    })

    const response = await POST(request, { params: Promise.resolve({}) })
    expect(response.status).toBe(200)
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ hasNativeAudio: false }))
  })
})
