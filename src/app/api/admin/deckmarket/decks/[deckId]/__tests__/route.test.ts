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
    signedUrlTtlSeconds: 3600,
  })),
}))

jest.mock('@/lib/r2/r2-keys', () => ({
  isValidDeckKey: jest.fn(() => true),
}))

jest.mock('@aws-sdk/client-s3', () => ({
  DeleteObjectCommand: jest.fn().mockImplementation((p) => p),
}))

import { GET, PATCH, DELETE } from '../route'
import { getSession } from '@/lib/auth/session'
import { isAdminUserCached, FieldValue, __setAdminFirestore } from '@/lib/firebase/admin'
import { getR2Config } from '@/lib/r2/r2-client'

const mockedGetSession = getSession as jest.Mock
const mockedIsAdmin = isAdminUserCached as jest.Mock
const mockedGetR2Config = getR2Config as jest.Mock

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

describe('/api/admin/deckmarket/decks/[deckId] GET', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when no session', async () => {
    mockedGetSession.mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks/genki-1')
    const response = await GET(request, { params: Promise.resolve({ deckId: 'genki-1' }) })

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

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks/genki-1')
    const response = await GET(request, { params: Promise.resolve({ deckId: 'genki-1' }) })

    expect(response.status).toBe(404)
  })

  it('returns deck with versions and latestVersion', async () => {
    mockAdminAuth()

    const mockDeckDoc = {
      exists: true,
      data: () => ({
        title: 'Genki 1',
        description: 'Test',
        hasNativeAudio: true,
        language: 'ja',
        jlpt: 'N5',
        tags: ['vocab'],
        isPublished: true,
        latestVersionId: 'v-1',
        downloadCount: 10,
        lastDownloadAt: { toDate: () => new Date('2026-02-09') },
        createdAt: { toDate: () => new Date('2026-02-01') },
        updatedAt: { toDate: () => new Date('2026-02-09') },
      }),
    }

    const mockVersionDoc = {
      id: 'v-1',
      data: () => ({
        deckId: 'genki-1',
        versionLabel: 'v1',
        changelog: 'Initial',
        apkgR2Key: 'deckmarket/genki-1/v-1/genki.apkg',
        apkgFilename: 'genki.apkg',
        sizeBytes: 1024000,
        sha256: null,
        createdAt: { toDate: () => new Date('2026-02-01') },
        createdByUid: 'admin-1',
      }),
    }

    const deckRef = {
      get: jest.fn().mockResolvedValue(mockDeckDoc),
      collection: jest.fn(() => ({
        orderBy: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({ docs: [mockVersionDoc] }),
        })),
      })),
    }

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => deckRef),
      })),
    })

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks/genki-1')
    const response = await GET(request, { params: Promise.resolve({ deckId: 'genki-1' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.deck.id).toBe('genki-1')
    expect(data.data.deck.hasNativeAudio).toBe(true)
    expect(data.data.versions).toHaveLength(1)
    expect(data.data.latestVersion.id).toBe('v-1')
  })

  it('returns empty versions array when no versions exist', async () => {
    mockAdminAuth()

    const deckRef = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          title: 'Genki 1',
          description: 'Test',
          language: 'ja',
          jlpt: 'N5',
          tags: [],
          isPublished: false,
          latestVersionId: null,
          downloadCount: 0,
          lastDownloadAt: null,
          createdAt: { toDate: () => new Date('2026-02-01') },
          updatedAt: { toDate: () => new Date('2026-02-09') },
        }),
      }),
      collection: jest.fn(() => ({
        orderBy: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({ docs: [] }),
        })),
      })),
    }

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => deckRef),
      })),
    })

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks/genki-1')
    const response = await GET(request, { params: Promise.resolve({ deckId: 'genki-1' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.versions).toHaveLength(0)
    expect(data.data.latestVersion).toBeNull()
  })
})

describe('/api/admin/deckmarket/decks/[deckId] PATCH', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 404 when deck does not exist', async () => {
    mockAdminAuth()

    const deckRef = {
      get: jest.fn().mockResolvedValue({ exists: false }),
      update: jest.fn(),
    }

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => deckRef),
      })),
    })

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks/genki-1', {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Updated' }),
    })

    const response = await PATCH(request, { params: Promise.resolve({ deckId: 'genki-1' }) })
    expect(response.status).toBe(404)
  })

  it('returns 400 when no valid fields provided', async () => {
    mockAdminAuth()

    const deckRef = {
      get: jest.fn().mockResolvedValue({ exists: true }),
      update: jest.fn(),
    }

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => deckRef),
      })),
    })

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks/genki-1', {
      method: 'PATCH',
      body: JSON.stringify({}),
    })

    const response = await PATCH(request, { params: Promise.resolve({ deckId: 'genki-1' }) })
    expect(response.status).toBe(400)
  })

  it('updates only provided fields', async () => {
    mockAdminAuth()

    const deckRef = {
      get: jest.fn().mockResolvedValue({ exists: true }),
      update: jest.fn().mockResolvedValue(undefined),
    }

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => deckRef),
      })),
    })

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks/genki-1', {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Updated', tags: ['a'], hasNativeAudio: true }),
    })

    const response = await PATCH(request, { params: Promise.resolve({ deckId: 'genki-1' }) })
    expect(response.status).toBe(200)
    expect(deckRef.update).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Updated',
        tags: ['a'],
        hasNativeAudio: true,
        updatedAt: FieldValue.serverTimestamp(),
      })
    )
  })

  it('updates isPublished toggle', async () => {
    mockAdminAuth()

    const deckRef = {
      get: jest.fn().mockResolvedValue({ exists: true }),
      update: jest.fn().mockResolvedValue(undefined),
    }

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => deckRef),
      })),
    })

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks/genki-1', {
      method: 'PATCH',
      body: JSON.stringify({ isPublished: true }),
    })

    const response = await PATCH(request, { params: Promise.resolve({ deckId: 'genki-1' }) })
    expect(response.status).toBe(200)
    expect(deckRef.update).toHaveBeenCalledWith(
      expect.objectContaining({
        isPublished: true,
      })
    )
  })

  it('always includes updatedAt in update', async () => {
    mockAdminAuth()

    const deckRef = {
      get: jest.fn().mockResolvedValue({ exists: true }),
      update: jest.fn().mockResolvedValue(undefined),
    }

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => deckRef),
      })),
    })

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks/genki-1', {
      method: 'PATCH',
      body: JSON.stringify({ description: 'Updated' }),
    })

    const response = await PATCH(request, { params: Promise.resolve({ deckId: 'genki-1' }) })
    expect(response.status).toBe(200)
    expect(deckRef.update).toHaveBeenCalledWith(
      expect.objectContaining({
        updatedAt: FieldValue.serverTimestamp(),
      })
    )
  })
})

describe('/api/admin/deckmarket/decks/[deckId] DELETE', () => {
  beforeEach(() => {
    jest.clearAllMocks()
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

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks/genki-1', {
      method: 'DELETE',
    })
    const response = await DELETE(request, { params: Promise.resolve({ deckId: 'genki-1' }) })

    expect(response.status).toBe(404)
  })

  it('deletes deck, versions, and R2 objects', async () => {
    mockAdminAuth()

    const batchDelete = jest.fn()
    const batchCommit = jest.fn().mockResolvedValue(undefined)
    const mockBatch = {
      delete: batchDelete,
      commit: batchCommit,
    }

    const versionDocs = [
      {
        data: () => ({
          apkgR2Key: 'deckmarket/genki-1/v-1/genki.apkg',
          csvR2Key: 'deckmarket/genki-1/v-1/genki.csv',
        }),
        ref: { id: 'v-1' },
      },
      {
        data: () => ({ apkgR2Key: 'deckmarket/genki-1/v-2/genki.apkg' }),
        ref: { id: 'v-2' },
      },
    ]

    const deckRef = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({ coverR2Key: 'deckmarket/genki-1/cover.png' }),
      }),
      delete: jest.fn().mockResolvedValue(undefined),
      collection: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ docs: versionDocs }),
      })),
    }

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => deckRef),
      })),
      batch: jest.fn(() => mockBatch),
    })

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks/genki-1', {
      method: 'DELETE',
    })
    const response = await DELETE(request, { params: Promise.resolve({ deckId: 'genki-1' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(batchDelete).toHaveBeenCalledTimes(2)
    expect(batchCommit).toHaveBeenCalled()
    expect(deckRef.delete).toHaveBeenCalled()

    const r2Config = mockedGetR2Config.mock.results[0].value
    const sendMock = r2Config.client.send as jest.Mock
    expect(sendMock).toHaveBeenCalledWith({
      Bucket: 'test-bucket',
      Key: 'deckmarket/genki-1/v-1/genki.apkg',
    })
    expect(sendMock).toHaveBeenCalledWith({
      Bucket: 'test-bucket',
      Key: 'deckmarket/genki-1/v-2/genki.apkg',
    })
    expect(sendMock).toHaveBeenCalledWith({
      Bucket: 'test-bucket',
      Key: 'deckmarket/genki-1/v-1/genki.csv',
    })
    expect(sendMock).toHaveBeenCalledWith({
      Bucket: 'test-bucket',
      Key: 'deckmarket/genki-1/cover.png',
    })
  })
})
