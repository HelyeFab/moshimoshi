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

describe('/api/deckmarket/decks GET', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(firebaseAdmin as any).__setAdminFirestore(null)
  })

  it('returns 401 when no session', async () => {
    mockNotLoggedIn()

    const request = new NextRequest('http://localhost/api/deckmarket/decks')
    const response = await GET(request)

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('returns published decks only', async () => {
    mockLoggedIn()

    const mockDocs = [
      {
        id: 'deck-1',
        data: () => ({
          title: 'Genki',
          description: 'A deck',
          tags: [],
          jlpt: 'N5',
          language: 'ja',
          downloadCount: 10,
          isPublished: true,
          updatedAt: { toDate: () => new Date('2026-02-09') },
        }),
      },
    ]

    const mockQuery = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      count: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ data: () => ({ count: 1 }) }),
      })),
      get: jest.fn().mockResolvedValue({ docs: mockDocs }),
    }

    setMockFirestore({
      collection: jest.fn(() => mockQuery),
    })

    const request = new NextRequest('http://localhost/api/deckmarket/decks?page=1&pageSize=20')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.items).toHaveLength(1)
    expect(data.data.items[0].id).toBe('deck-1')
    expect(data.data.page).toBe(1)
    expect(data.data.pageSize).toBe(20)
    expect(mockQuery.where).toHaveBeenCalledWith('isPublished', '==', true)
  })

  it('returns correct pagination shape', async () => {
    mockLoggedIn()

    const mockQuery = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      count: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ data: () => ({ count: 0 }) }),
      })),
      get: jest.fn().mockResolvedValue({ docs: [] }),
    }

    setMockFirestore({
      collection: jest.fn(() => mockQuery),
    })

    const request = new NextRequest('http://localhost/api/deckmarket/decks?page=2&pageSize=5')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.page).toBe(2)
    expect(data.data.pageSize).toBe(5)
    expect(Array.isArray(data.data.items)).toBe(true)
  })

  it('returns empty items when no published decks', async () => {
    mockLoggedIn()

    const mockQuery = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      count: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ data: () => ({ count: 0 }) }),
      })),
      get: jest.fn().mockResolvedValue({ docs: [] }),
    }

    setMockFirestore({
      collection: jest.fn(() => mockQuery),
    })

    const request = new NextRequest('http://localhost/api/deckmarket/decks?page=1&pageSize=20')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.items).toHaveLength(0)
    expect(data.data.total).toBe(0)
  })

  it('filters by JLPT level', async () => {
    mockLoggedIn()

    const mockQuery = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      count: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ data: () => ({ count: 0 }) }),
      })),
      get: jest.fn().mockResolvedValue({ docs: [] }),
    }

    setMockFirestore({
      collection: jest.fn(() => mockQuery),
    })

    const request = new NextRequest('http://localhost/api/deckmarket/decks?jlpt=N5')
    await GET(request)

    expect(mockQuery.where).toHaveBeenCalledWith('jlpt', '==', 'N5')
  })

  it('filters by language', async () => {
    mockLoggedIn()

    const mockQuery = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      count: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ data: () => ({ count: 0 }) }),
      })),
      get: jest.fn().mockResolvedValue({ docs: [] }),
    }

    setMockFirestore({
      collection: jest.fn(() => mockQuery),
    })

    const request = new NextRequest('http://localhost/api/deckmarket/decks?language=ja')
    await GET(request)

    expect(mockQuery.where).toHaveBeenCalledWith('language', '==', 'ja')
  })

  it('searches by title (case-insensitive)', async () => {
    mockLoggedIn()

    const mockDocs = [
      {
        id: 'deck-1',
        data: () => ({
          title: 'Genki',
          description: 'A deck',
          tags: [],
          jlpt: 'N5',
          language: 'ja',
          downloadCount: 10,
          isPublished: true,
          updatedAt: { toDate: () => new Date('2026-02-09') },
        }),
      },
      {
        id: 'deck-2',
        data: () => ({
          title: 'Tobira',
          description: 'Another deck',
          tags: [],
          jlpt: 'N4',
          language: 'ja',
          downloadCount: 5,
          isPublished: true,
          updatedAt: { toDate: () => new Date('2026-02-08') },
        }),
      },
    ]

    const mockQuery = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      count: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ data: () => ({ count: 2 }) }),
      })),
      get: jest.fn().mockResolvedValue({ docs: mockDocs }),
    }

    setMockFirestore({
      collection: jest.fn(() => mockQuery),
    })

    const request = new NextRequest('http://localhost/api/deckmarket/decks?search=genki')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.items).toHaveLength(1)
    expect(data.data.items[0].id).toBe('deck-1')
  })

  it('searches by description', async () => {
    mockLoggedIn()

    const mockDocs = [
      {
        id: 'deck-1',
        data: () => ({
          title: 'Deck One',
          description: 'JLPT vocab practice',
          tags: [],
          jlpt: 'N5',
          language: 'ja',
          downloadCount: 10,
          isPublished: true,
          updatedAt: { toDate: () => new Date('2026-02-09') },
        }),
      },
    ]

    const mockQuery = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      count: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ data: () => ({ count: 1 }) }),
      })),
      get: jest.fn().mockResolvedValue({ docs: mockDocs }),
    }

    setMockFirestore({
      collection: jest.fn(() => mockQuery),
    })

    const request = new NextRequest('http://localhost/api/deckmarket/decks?search=vocab')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.items).toHaveLength(1)
    expect(data.data.items[0].id).toBe('deck-1')
  })

  it('paginates correctly with page and pageSize', async () => {
    mockLoggedIn()

    const mockQuery = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      count: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ data: () => ({ count: 12 }) }),
      })),
      get: jest.fn().mockResolvedValue({ docs: [] }),
    }

    setMockFirestore({
      collection: jest.fn(() => mockQuery),
    })

    const request = new NextRequest('http://localhost/api/deckmarket/decks?page=3&pageSize=5')
    await GET(request)

    expect(mockQuery.offset).toHaveBeenCalledWith(10)
    expect(mockQuery.limit).toHaveBeenCalledWith(5)
  })
})
