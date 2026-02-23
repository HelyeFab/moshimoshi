import { NextRequest } from 'next/server'
import { POST } from '../route'
import { requireAuth } from '@/lib/auth/session'
import { requireR2Entitlement } from '@/lib/api/r2-entitlement'
import { getR2Config } from '@/lib/r2/r2-client'
import { adminDb } from '@/lib/firebase/admin'

jest.mock('@/lib/auth/session', () => ({
  requireAuth: jest.fn(),
}))

jest.mock('@/lib/api/r2-entitlement', () => ({
  requireR2Entitlement: jest.fn(),
}))

jest.mock('@/lib/r2/r2-client', () => ({
  getR2Config: jest.fn(),
}))

jest.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: jest.fn(),
  },
}))

jest.mock('@aws-sdk/client-s3', () => ({
  ListObjectsV2Command: class ListObjectsV2Command {
    input: unknown
    constructor(input: unknown) {
      this.input = input
    }
  },
  DeleteObjectsCommand: class DeleteObjectsCommand {
    input: unknown
    constructor(input: unknown) {
      this.input = input
    }
  },
}))

const mockedRequireAuth = requireAuth as jest.Mock
const mockedRequireR2Entitlement = requireR2Entitlement as jest.Mock
const mockedGetR2Config = getR2Config as jest.Mock
const mockedAdminDb = adminDb as unknown as { collection: jest.Mock }

describe('/api/anki/r2/delete POST', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedRequireAuth.mockResolvedValue({ uid: 'user-1' })
    mockedRequireR2Entitlement.mockResolvedValue({ allowed: true })
  })

  it('deletes R2 objects, metadata, and writes deletedAnkiDecks tombstone', async () => {
    const clientSend = jest
      .fn()
      .mockResolvedValueOnce({
        Contents: [{ Key: 'users/user-1/decks/deck-1/package.apkg' }],
      })
      .mockResolvedValueOnce({
        Deleted: [{ Key: 'users/user-1/decks/deck-1/package.apkg' }],
        Errors: [],
      })

    mockedGetR2Config.mockReturnValue({
      client: { send: clientSend },
      bucket: 'test-bucket',
    })

    const metadataDelete = jest.fn().mockResolvedValue(undefined)
    const tombstoneSet = jest.fn().mockResolvedValue(undefined)
    const cleanupJobDelete = jest.fn().mockResolvedValue(undefined)
    const cleanupJobSet = jest.fn().mockResolvedValue(undefined)
    const metadataGet = jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({ userId: 'user-1', origin: 'deckmarket' }),
    })

    mockedAdminDb.collection.mockImplementation((name: string) => {
      if (name === 'anki_r2_backups') {
        return {
          doc: jest.fn(() => ({
            get: metadataGet,
            delete: metadataDelete,
          })),
        }
      }

      if (name === 'users') {
        return {
          doc: jest.fn(() => ({
            collection: jest.fn((subName: string) => {
              if (subName === 'deletedAnkiDecks') {
                return {
                  doc: jest.fn(() => ({
                    set: tombstoneSet,
                  })),
                }
              }
              if (subName === 'ankiBackupCleanupJobs') {
                return {
                  doc: jest.fn(() => ({
                    set: cleanupJobSet,
                    delete: cleanupJobDelete,
                  })),
                }
              }
              return null
            }),
          })),
        }
      }

      return null
    })

    const request = new NextRequest('http://localhost/api/anki/r2/delete', {
      method: 'POST',
      body: JSON.stringify({ deckId: 'deck-1' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.status).toBe('complete')
    expect(data.deletedCount).toBe(1)
    expect(data.metadataDeleted).toBe(true)
    expect(data.tombstoneWritten).toBe(true)

    expect(metadataGet).toHaveBeenCalledTimes(1)
    expect(metadataDelete).toHaveBeenCalledTimes(1)
    expect(tombstoneSet).toHaveBeenCalledWith(
      expect.objectContaining({
        deletedAt: expect.any(Number),
        origin: 'deckmarket',
      }),
      { merge: true }
    )
    expect(cleanupJobDelete).toHaveBeenCalledTimes(1)
    expect(cleanupJobSet).not.toHaveBeenCalled()
    expect(clientSend).toHaveBeenCalledTimes(2)
  })

  it('returns partial status when R2 delete reports per-object errors but still writes tombstone and deletes metadata', async () => {
    const clientSend = jest
      .fn()
      .mockResolvedValueOnce({
        Contents: [{ Key: 'users/user-1/decks/deck-2/package.apkg' }],
      })
      .mockResolvedValueOnce({
        Deleted: [],
        Errors: [{ Key: 'users/user-1/decks/deck-2/package.apkg', Code: 'AccessDenied' }],
      })

    mockedGetR2Config.mockReturnValue({
      client: { send: clientSend },
      bucket: 'test-bucket',
    })

    const metadataDelete = jest.fn().mockResolvedValue(undefined)
    const tombstoneSet = jest.fn().mockResolvedValue(undefined)
    const cleanupJobDelete = jest.fn().mockResolvedValue(undefined)
    const cleanupJobSet = jest.fn().mockResolvedValue(undefined)
    const metadataGet = jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({ userId: 'user-1' }),
    })

    mockedAdminDb.collection.mockImplementation((name: string) => {
      if (name === 'anki_r2_backups') {
        return { doc: jest.fn(() => ({ get: metadataGet, delete: metadataDelete })) }
      }
      if (name === 'users') {
        return {
          doc: jest.fn(() => ({
            collection: jest.fn((subName: string) => {
              if (subName === 'deletedAnkiDecks') {
                return { doc: jest.fn(() => ({ set: tombstoneSet })) }
              }
              if (subName === 'ankiBackupCleanupJobs') {
                return { doc: jest.fn(() => ({ set: cleanupJobSet, delete: cleanupJobDelete })) }
              }
              return null
            }),
          })),
        }
      }
      return null
    })

    const request = new NextRequest('http://localhost/api/anki/r2/delete', {
      method: 'POST',
      body: JSON.stringify({ deckId: 'deck-2' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.status).toBe('partial')
    expect(data.metadataDeleted).toBe(true)
    expect(data.tombstoneWritten).toBe(true)
    expect(data.errors).toHaveLength(1)
    expect(metadataDelete).toHaveBeenCalledTimes(1)
    expect(tombstoneSet).toHaveBeenCalledTimes(1)
    expect(cleanupJobSet).toHaveBeenCalledWith(
      expect.objectContaining({
        deckId: 'deck-2',
        userId: 'user-1',
        status: 'partial',
        retryable: true,
        metadataDeleted: true,
        tombstoneWritten: true,
      }),
      { merge: true }
    )
    expect(cleanupJobDelete).not.toHaveBeenCalled()
  })

  it('writes tombstone and deletes metadata even when no R2 files are found', async () => {
    const clientSend = jest.fn().mockResolvedValueOnce({
      Contents: [],
    })

    mockedGetR2Config.mockReturnValue({
      client: { send: clientSend },
      bucket: 'test-bucket',
    })

    const metadataDelete = jest.fn().mockResolvedValue(undefined)
    const tombstoneSet = jest.fn().mockResolvedValue(undefined)
    const cleanupJobDelete = jest.fn().mockResolvedValue(undefined)
    const cleanupJobSet = jest.fn().mockResolvedValue(undefined)
    const metadataGet = jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({ userId: 'user-1' }),
    })

    mockedAdminDb.collection.mockImplementation((name: string) => {
      if (name === 'anki_r2_backups') {
        return { doc: jest.fn(() => ({ get: metadataGet, delete: metadataDelete })) }
      }
      if (name === 'users') {
        return {
          doc: jest.fn(() => ({
            collection: jest.fn((subName: string) => {
              if (subName === 'deletedAnkiDecks') {
                return { doc: jest.fn(() => ({ set: tombstoneSet })) }
              }
              if (subName === 'ankiBackupCleanupJobs') {
                return { doc: jest.fn(() => ({ set: cleanupJobSet, delete: cleanupJobDelete })) }
              }
              return null
            }),
          })),
        }
      }
      return null
    })

    const request = new NextRequest('http://localhost/api/anki/r2/delete', {
      method: 'POST',
      body: JSON.stringify({ deckId: 'deck-3' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.status).toBe('complete')
    expect(data.deletedCount).toBe(0)
    expect(data.r2FilesFound).toBe(0)
    expect(data.metadataDeleted).toBe(true)
    expect(data.tombstoneWritten).toBe(true)
    expect(metadataDelete).toHaveBeenCalledTimes(1)
    expect(tombstoneSet).toHaveBeenCalledTimes(1)
    expect(cleanupJobDelete).toHaveBeenCalledTimes(1)
    expect(cleanupJobSet).not.toHaveBeenCalled()
    expect(clientSend).toHaveBeenCalledTimes(1)
  })
})
