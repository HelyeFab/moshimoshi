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
  DeleteObjectCommand: jest.fn().mockImplementation((params) => params),
}))

import { DELETE } from '../route'
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

describe('/api/admin/deckmarket/decks/[deckId]/versions/[versionId] DELETE', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when no session', async () => {
    mockedGetSession.mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks/test-deck/versions/v-1', {
      method: 'DELETE',
    })

    const response = await DELETE(request, {
      params: Promise.resolve({ deckId: 'test-deck', versionId: 'v-1' }),
    })

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

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks/test-deck/versions/v-1', {
      method: 'DELETE',
    })

    const response = await DELETE(request, {
      params: Promise.resolve({ deckId: 'test-deck', versionId: 'v-1' }),
    })

    expect(response.status).toBe(404)
  })

  it('returns 404 when version does not exist', async () => {
    mockAdminAuth()

    const versionRef = {
      get: jest.fn().mockResolvedValue({ exists: false }),
      delete: jest.fn(),
    }

    const deckRef = {
      get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ latestVersionId: 'v-1' }) }),
      collection: jest.fn(() => ({
        doc: jest.fn(() => versionRef),
      })),
    }

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => deckRef),
      })),
    })

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks/test-deck/versions/v-1', {
      method: 'DELETE',
    })

    const response = await DELETE(request, {
      params: Promise.resolve({ deckId: 'test-deck', versionId: 'v-1' }),
    })

    expect(response.status).toBe(404)
  })

  it('deletes R2 object and Firestore doc', async () => {
    mockAdminAuth()

    const versionRef = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({ apkgR2Key: 'deckmarket/test-deck/v-1/deck.apkg' }),
      }),
      delete: jest.fn().mockResolvedValue(undefined),
    }

    const deckRef = {
      get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ latestVersionId: 'other' }) }),
      collection: jest.fn(() => ({
        doc: jest.fn(() => versionRef),
      })),
    }

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => deckRef),
      })),
    })

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks/test-deck/versions/v-1', {
      method: 'DELETE',
    })

    const response = await DELETE(request, {
      params: Promise.resolve({ deckId: 'test-deck', versionId: 'v-1' }),
    })

    expect(response.status).toBe(200)
    expect(versionRef.delete).toHaveBeenCalled()
  })

  it('cascades latestVersionId to next version when deleting latest', async () => {
    mockAdminAuth()

    const mockUpdate = jest.fn().mockResolvedValue(undefined)
    const versionRef = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({ apkgR2Key: 'deckmarket/test-deck/v-1/deck.apkg' }),
      }),
      delete: jest.fn().mockResolvedValue(undefined),
    }

    const versionsCollection = {
      orderBy: jest.fn(() => ({
        limit: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({ docs: [{ id: 'v-2' }] }),
        })),
      })),
      doc: jest.fn(() => versionRef),
    }

    const deckRef = {
      get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ latestVersionId: 'v-1' }) }),
      collection: jest.fn(() => versionsCollection),
      update: mockUpdate,
    }

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => deckRef),
      })),
    })

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks/test-deck/versions/v-1', {
      method: 'DELETE',
    })

    const response = await DELETE(request, {
      params: Promise.resolve({ deckId: 'test-deck', versionId: 'v-1' }),
    })

    expect(response.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ latestVersionId: 'v-2' })
    )
  })

  it('sets latestVersionId to null when deleting the only version', async () => {
    mockAdminAuth()

    const mockUpdate = jest.fn().mockResolvedValue(undefined)
    const versionRef = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({ apkgR2Key: 'deckmarket/test-deck/v-1/deck.apkg' }),
      }),
      delete: jest.fn().mockResolvedValue(undefined),
    }

    const versionsCollection = {
      orderBy: jest.fn(() => ({
        limit: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({ docs: [] }),
        })),
      })),
      doc: jest.fn(() => versionRef),
    }

    const deckRef = {
      get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ latestVersionId: 'v-1' }) }),
      collection: jest.fn(() => versionsCollection),
      update: mockUpdate,
    }

    setMockFirestore({
      collection: jest.fn(() => ({
        doc: jest.fn(() => deckRef),
      })),
    })

    const request = new NextRequest('http://localhost/api/admin/deckmarket/decks/test-deck/versions/v-1', {
      method: 'DELETE',
    })

    const response = await DELETE(request, {
      params: Promise.resolve({ deckId: 'test-deck', versionId: 'v-1' }),
    })

    expect(response.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ latestVersionId: null })
    )
  })
})
