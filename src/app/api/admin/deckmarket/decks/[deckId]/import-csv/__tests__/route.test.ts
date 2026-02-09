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
  })),
}))

jest.mock('@aws-sdk/client-s3', () => ({
  PutObjectCommand: jest.fn().mockImplementation((params) => params),
}))

jest.mock('child_process', () => ({
  execFile: jest.fn((_cmd, _args, callback) => {
    callback(null, 'OK', '')
  }),
}))

jest.mock('fs', () => ({
  promises: {
    access: jest.fn().mockResolvedValue(undefined),
    mkdtemp: jest.fn().mockResolvedValue('/tmp/deckmarket-abc'),
    writeFile: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue(Buffer.from('fake-apkg-content')),
    rm: jest.fn().mockResolvedValue(undefined),
  },
}))

import { POST } from '../route'
import { getSession } from '@/lib/auth/session'
import { isAdminUserCached, __setAdminFirestore } from '@/lib/firebase/admin'
import { promises as fsPromises } from 'fs'

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

function createFakeFile(name: string, size = 10) {
  return {
    name,
    size,
    arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(size)),
  }
}

describe('/api/admin/deckmarket/decks/[deckId]/import-csv POST', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when no session', async () => {
    mockedGetSession.mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks/test-deck/import-csv', {
      method: 'POST',
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

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks/test-deck/import-csv', {
      method: 'POST',
    })

    ;(request as any).formData = jest.fn().mockResolvedValue({
      get: jest.fn(() => null),
    })

    const response = await POST(request, { params: Promise.resolve({ deckId: 'test-deck' }) })
    expect(response.status).toBe(404)
  })

  it('returns 400 when no file provided', async () => {
    mockAdminAuth()

    const deckRef = {
      get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ title: 'Test' }) }),
    }

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => deckRef),
      })),
    })

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks/test-deck/import-csv', {
      method: 'POST',
    })

    ;(request as any).formData = jest.fn().mockResolvedValue({
      get: jest.fn(() => null),
    })

    const response = await POST(request, { params: Promise.resolve({ deckId: 'test-deck' }) })
    expect(response.status).toBe(400)
  })

  it('returns 400 for non-.csv file', async () => {
    mockAdminAuth()

    const deckRef = {
      get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ title: 'Test' }) }),
    }

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => deckRef),
      })),
    })

    const file = createFakeFile('bad.txt', 10)
    const formData = {
      get: jest.fn((key: string) => (key === 'file' ? file : null)),
    }

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks/test-deck/import-csv', {
      method: 'POST',
    })

    ;(request as any).formData = jest.fn().mockResolvedValue(formData)

    const response = await POST(request, { params: Promise.resolve({ deckId: 'test-deck' }) })
    expect(response.status).toBe(400)
  })

  it('returns 400 for empty file', async () => {
    mockAdminAuth()

    const deckRef = {
      get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ title: 'Test' }) }),
    }

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => deckRef),
      })),
    })

    const file = createFakeFile('deck.csv', 0)
    const formData = {
      get: jest.fn((key: string) => (key === 'file' ? file : null)),
    }

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks/test-deck/import-csv', {
      method: 'POST',
    })

    ;(request as any).formData = jest.fn().mockResolvedValue(formData)

    const response = await POST(request, { params: Promise.resolve({ deckId: 'test-deck' }) })
    expect(response.status).toBe(400)
  })

  it('converts CSV and uploads to R2', async () => {
    mockAdminAuth()

    const mockVersionSet = jest.fn().mockResolvedValue(undefined)
    const mockUpdate = jest.fn().mockResolvedValue(undefined)

    const deckRef = {
      get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ title: 'Test' }) }),
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({ set: mockVersionSet })),
      })),
      update: mockUpdate,
    }

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => deckRef),
      })),
    })

    const file = createFakeFile('deck.csv', 10)
    const formData = {
      get: jest.fn((key: string) => {
        if (key === 'file') return file
        if (key === 'versionLabel') return 'v1'
        if (key === 'changelog') return 'Initial'
        return null
      }),
    }

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks/test-deck/import-csv', {
      method: 'POST',
    })

    ;(request as any).formData = jest.fn().mockResolvedValue(formData)

    const response = await POST(request, { params: Promise.resolve({ deckId: 'test-deck' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.r2Key).toContain('deckmarket/test-deck/')
    expect(mockVersionSet).toHaveBeenCalled()
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('creates version doc in Firestore', async () => {
    mockAdminAuth()

    const mockVersionSet = jest.fn().mockResolvedValue(undefined)
    const deckRef = {
      get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ title: 'Test' }) }),
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({ set: mockVersionSet })),
      })),
      update: jest.fn().mockResolvedValue(undefined),
    }

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => deckRef),
      })),
    })

    const file = createFakeFile('deck.csv', 10)
    const formData = {
      get: jest.fn((key: string) => (key === 'file' ? file : null)),
    }

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks/test-deck/import-csv', {
      method: 'POST',
    })

    ;(request as any).formData = jest.fn().mockResolvedValue(formData)

    const response = await POST(request, { params: Promise.resolve({ deckId: 'test-deck' }) })
    expect(response.status).toBe(200)
    expect(mockVersionSet).toHaveBeenCalledWith(
      expect.objectContaining({
        deckId: 'test-deck',
        createdByUid: 'admin-1',
      })
    )
  })

  it('cleans up temp directory on success', async () => {
    mockAdminAuth()

    const deckRef = {
      get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ title: 'Test' }) }),
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({ set: jest.fn().mockResolvedValue(undefined) })),
      })),
      update: jest.fn().mockResolvedValue(undefined),
    }

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => deckRef),
      })),
    })

    const file = createFakeFile('deck.csv', 10)
    const formData = {
      get: jest.fn((key: string) => (key === 'file' ? file : null)),
    }

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks/test-deck/import-csv', {
      method: 'POST',
    })

    ;(request as any).formData = jest.fn().mockResolvedValue(formData)

    await POST(request, { params: Promise.resolve({ deckId: 'test-deck' }) })

    expect(fsPromises.rm).toHaveBeenCalledWith('/tmp/deckmarket-abc', { recursive: true, force: true })
  })

  it('cleans up temp directory on error', async () => {
    mockAdminAuth()

    const deckRef = {
      get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ title: 'Test' }) }),
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({ set: jest.fn().mockResolvedValue(undefined) })),
      })),
      update: jest.fn().mockResolvedValue(undefined),
    }

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => deckRef),
      })),
    })

    ;(fsPromises.readFile as jest.Mock).mockRejectedValueOnce(new Error('read fail'))

    const file = createFakeFile('deck.csv', 10)
    const formData = {
      get: jest.fn((key: string) => (key === 'file' ? file : null)),
    }

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks/test-deck/import-csv', {
      method: 'POST',
    })

    ;(request as any).formData = jest.fn().mockResolvedValue(formData)

    await POST(request, { params: Promise.resolve({ deckId: 'test-deck' }) })

    expect(fsPromises.rm).toHaveBeenCalledWith('/tmp/deckmarket-abc', { recursive: true, force: true })
  })
})
