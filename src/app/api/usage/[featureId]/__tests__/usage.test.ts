import { NextRequest } from 'next/server'
import { GET as checkGET } from '../check/route'
import { POST as incrementPOST } from '../increment/route'
import { adminDb, getAdminDb } from '@/lib/firebase/admin'
import { getSession } from '@/lib/auth/session'

jest.mock('@/lib/firebase/admin', () => ({
  adminDb: { collection: jest.fn() },
  getAdminDb: jest.fn(),
}))

jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(),
}))

const mockedAdminDb = adminDb as unknown as {
  collection: jest.Mock
}
const mockedGetAdminDb = getAdminDb as jest.Mock
const mockedGetSession = getSession as jest.Mock

describe('/api/usage/[featureId] routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers().setSystemTime(new Date('2025-12-26T12:00:00.000Z'))
    mockedGetAdminDb.mockReturnValue(mockedAdminDb)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('GET /check', () => {
    it('returns 400 for invalid feature id', async () => {
      const request = new NextRequest('http://localhost/api/usage/invalid/check')
      const response = await checkGET(request, {
        params: Promise.resolve({ featureId: 'invalid_feature' }),
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Invalid feature ID')
    })

    it('returns guest decision when unauthenticated', async () => {
      mockedGetSession.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/usage/comics/check')
      const response = await checkGET(request, {
        params: Promise.resolve({ featureId: 'comics' }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.plan).toBe('guest')
      expect(data.isGuest).toBe(true)
      expect(data.allow).toBe(false)
    })

    it('uses feature bucket key and reads usage', async () => {
      mockedGetSession.mockResolvedValue({ uid: 'user-1' })

      let usageDocId = ''
      const usageGet = jest.fn().mockResolvedValue({
        data: () => ({ conjugation_drill: 2 }),
      })

      const userDoc = {
        exists: true,
        data: () => ({ subscription: { plan: 'free' } }),
      }

      const userRef = {
        get: jest.fn().mockResolvedValue(userDoc),
        collection: jest.fn().mockReturnValue({
          doc: jest.fn((docId: string) => {
            usageDocId = docId
            return { get: usageGet }
          }),
        }),
      }

      mockedAdminDb.collection.mockImplementation((name: string) => {
        if (name === 'users') {
          return { doc: jest.fn(() => userRef) }
        }
        return { doc: jest.fn() }
      })

      const request = new NextRequest('http://localhost/api/usage/conjugation_drill/check')
      const response = await checkGET(request, {
        params: Promise.resolve({ featureId: 'conjugation_drill' }),
      })

      const data = await response.json()
      expect(response.status).toBe(200)
      expect(usageDocId).toBe('conjugation_drill_2025-12-26')
      expect(data.currentUsage).toBe(2)
    })
  })

  describe('POST /increment', () => {
    it('returns 400 for invalid feature id', async () => {
      mockedGetSession.mockResolvedValue({ uid: 'user-1' })

      const request = new NextRequest('http://localhost/api/usage/invalid/increment', {
        method: 'POST',
        body: JSON.stringify({ idempotencyKey: 'test-1' }),
      })
      const response = await incrementPOST(request, {
        params: Promise.resolve({ featureId: 'invalid_feature' }),
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Invalid feature ID')
    })

    it('returns cached decision for idempotency key', async () => {
      mockedGetSession.mockResolvedValue({ uid: 'user-1' })

      const cachedDecision = { allow: false, remaining: 0, reason: 'limit_reached' }
      const idempotencyDoc = {
        exists: true,
        data: () => ({ decision: cachedDecision }),
      }

      const usageSet = jest.fn()

      mockedAdminDb.collection.mockImplementation((name: string) => {
        if (name === 'idempotency') {
          return { doc: jest.fn(() => ({ get: jest.fn().mockResolvedValue(idempotencyDoc) })) }
        }
        if (name === 'users') {
          return {
            doc: jest.fn(() => ({
              get: jest.fn().mockResolvedValue({
                data: () => ({ subscription: { plan: 'free' } }),
              }),
              collection: jest.fn().mockReturnValue({
                doc: jest.fn(() => ({ get: jest.fn(), set: usageSet })),
              }),
            })),
          }
        }
        return { doc: jest.fn() }
      })

      const request = new NextRequest('http://localhost/api/usage/conjugation_drill/increment', {
        method: 'POST',
        body: JSON.stringify({ idempotencyKey: 'dup-1' }),
      })
      const response = await incrementPOST(request, {
        params: Promise.resolve({ featureId: 'conjugation_drill' }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toEqual(cachedDecision)
      expect(usageSet).not.toHaveBeenCalled()
    })

    it('increments usage and uses feature bucket key', async () => {
      mockedGetSession.mockResolvedValue({ uid: 'user-1' })

      let usageDocId = ''
      const usageSet = jest.fn().mockResolvedValue(true)
      const usageGet = jest.fn().mockResolvedValue({ data: () => ({ conjugation_drill: 0 }) })

      mockedAdminDb.collection.mockImplementation((name: string) => {
        if (name === 'idempotency') {
          return {
            doc: jest.fn(() => ({
              get: jest.fn().mockResolvedValue({ exists: false }),
              set: jest.fn().mockResolvedValue(true),
            })),
          }
        }
        if (name === 'users') {
          return {
            doc: jest.fn(() => ({
              get: jest.fn().mockResolvedValue({
                data: () => ({ subscription: { plan: 'free' } }),
              }),
              collection: jest.fn().mockReturnValue({
                doc: jest.fn((docId: string) => {
                  usageDocId = docId
                  return { get: usageGet, set: usageSet }
                }),
              }),
            })),
          }
        }
        return { doc: jest.fn() }
      })

      const request = new NextRequest('http://localhost/api/usage/conjugation_drill/increment', {
        method: 'POST',
        body: JSON.stringify({ idempotencyKey: 'inc-1' }),
      })
      const response = await incrementPOST(request, {
        params: Promise.resolve({ featureId: 'conjugation_drill' }),
      })

      const data = await response.json()
      expect(response.status).toBe(200)
      expect(usageDocId).toBe('conjugation_drill_2025-12-26')
      expect(usageSet).toHaveBeenCalledWith(
        expect.objectContaining({
          conjugation_drill: 1,
          lastUpdated: expect.any(String),
        }),
        { merge: true }
      )
      expect(data.allow).toBe(true)
    })
  })
})
