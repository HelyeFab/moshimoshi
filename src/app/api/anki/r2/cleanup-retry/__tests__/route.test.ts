import { NextRequest } from 'next/server'
import { GET, POST } from '../route'
import { adminDb } from '@/lib/firebase/admin'
import { getR2Config } from '@/lib/r2/r2-client'

jest.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: jest.fn(),
    collectionGroup: jest.fn(),
  },
}))

jest.mock('@/lib/r2/r2-client', () => ({
  getR2Config: jest.fn(),
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

const mockedAdminDb = adminDb as unknown as {
  collection: jest.Mock
  collectionGroup: jest.Mock
}
const mockedGetR2Config = getR2Config as jest.Mock

describe('/api/anki/r2/cleanup-retry', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
  })

  it('returns 401 when unauthorized', async () => {
    const request = new NextRequest('http://localhost/api/anki/r2/cleanup-retry')
    const response = await GET(request)
    expect(response.status).toBe(401)
  })

  it('retries a scoped partial cleanup job and clears it when complete', async () => {
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

    const jobGet = jest.fn().mockResolvedValue({
      exists: true,
      id: 'deck-1',
      data: () => ({
        userId: 'user-1',
        deckId: 'deck-1',
        prefix: 'users/user-1/decks/deck-1/',
        status: 'partial',
        retryable: true,
        attemptCount: 2,
      }),
    })
    const metadataDelete = jest.fn().mockResolvedValue(undefined)
    const tombstoneSet = jest.fn().mockResolvedValue(undefined)
    const cleanupJobDelete = jest.fn().mockResolvedValue(undefined)
    const cleanupJobSet = jest.fn().mockResolvedValue(undefined)

    mockedAdminDb.collection.mockImplementation((name: string) => {
      if (name === 'anki_r2_backups') {
        return {
          doc: jest.fn(() => ({
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
                  doc: jest.fn(() => ({ set: tombstoneSet })),
                }
              }
              if (subName === 'ankiBackupCleanupJobs') {
                return {
                  doc: jest.fn(() => ({
                    get: jobGet,
                    delete: cleanupJobDelete,
                    set: cleanupJobSet,
                  })),
                  where: jest.fn(() => ({
                    get: jest.fn().mockResolvedValue({ docs: [] }),
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

    const request = new NextRequest('http://localhost/api/anki/r2/cleanup-retry', {
      method: 'POST',
      headers: { authorization: 'Bearer test-secret' },
      body: JSON.stringify({ userId: 'user-1', deckId: 'deck-1' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.result.processed).toBe(1)
    expect(data.result.completed).toBe(1)
    expect(data.result.partial).toBe(0)
    expect(data.result.results[0]).toEqual(
      expect.objectContaining({
        userId: 'user-1',
        deckId: 'deck-1',
        status: 'complete',
        deletedCount: 1,
      })
    )

    expect(metadataDelete).toHaveBeenCalledTimes(1)
    expect(tombstoneSet).toHaveBeenCalledTimes(1)
    expect(cleanupJobDelete).toHaveBeenCalledTimes(1)
    expect(cleanupJobSet).not.toHaveBeenCalled()
    expect(clientSend).toHaveBeenCalledTimes(2)
  })
})

