/**
 * Tests for Kanji Browser Study Access API
 * POST /api/kanji-browser/study/access
 *
 * Covers all required scenarios from Agent D brief:
 * 1. guest denied
 * 2. already unlocked kanji allowed without increment and with newlyUnlocked=false
 * 3. new kanji under cap unlocks and increments with newlyUnlocked=true
 * 4. new kanji over cap denied
 * 5. premium user always allowed
 * 6. response shape is consistent
 */

import { NextRequest } from 'next/server';
import { POST } from '../route';
import { getSession } from '@/lib/auth/session';
import { getAdminDb, FieldValue } from '@/lib/firebase/admin';
import { evaluate, getBucketKey } from '@/lib/entitlements/evaluator';

jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(),
}));

jest.mock('@/lib/firebase/admin', () => ({
  getAdminDb: jest.fn(),
  FieldValue: {
    arrayUnion: jest.fn((...items: any[]) => items),
  },
}));

jest.mock('@/lib/entitlements/evaluator', () => ({
  evaluate: jest.fn(),
  getBucketKey: jest.fn(),
}));

const mockedGetSession = getSession as jest.Mock;
const mockedGetAdminDb = getAdminDb as jest.Mock;
const mockedEvaluate = evaluate as jest.Mock;
const mockedGetBucketKey = getBucketKey as jest.Mock;

describe('POST /api/kanji-browser/study/access', () => {
  const mockDb = {
    collection: jest.fn(),
    runTransaction: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetAdminDb.mockReturnValue(mockDb);
    mockedGetBucketKey.mockReturnValue('kanji_browser_study_2026-03-25');
  });

  describe('Scenario 1: guest denied', () => {
    it('returns 401 with allow=false for unauthenticated users', async () => {
      mockedGetSession.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/kanji-browser/study/access', {
        method: 'POST',
        body: JSON.stringify({ kanji: '見' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({
        allow: false,
        newlyUnlocked: false,
        unlockedCount: 0,
        remaining: 0,
        plan: 'guest',
        reason: 'Authentication required',
      });
    });
  });

  describe('Scenario 2: already unlocked kanji allowed without increment', () => {
    it('returns allow=true, newlyUnlocked=false for already unlocked kanji', async () => {
      mockedGetSession.mockResolvedValue({ uid: 'user-1' });

      const progressDoc = {
        exists: true,
        data: () => ({
          unlockedKanji: ['見', '話'],
          unlockedCount: 2,
          lastUnlockedAt: '2026-03-24T10:00:00.000Z',
          updatedAt: '2026-03-24T10:00:00.000Z',
        }),
      };

      mockDb.collection.mockImplementation((name: string) => {
        if (name === 'users') {
          return {
            doc: jest.fn(() => ({
              get: jest.fn().mockResolvedValue({
                data: () => ({ subscription: { plan: 'free' } }),
              }),
              collection: jest.fn(() => ({
                doc: jest.fn(() => ({
                  get: jest.fn().mockResolvedValue(progressDoc),
                })),
              })),
            })),
          };
        }
        return { doc: jest.fn() };
      });

      const request = new NextRequest('http://localhost/api/kanji-browser/study/access', {
        method: 'POST',
        body: JSON.stringify({ kanji: '見' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        allow: true,
        newlyUnlocked: false,
        unlockedCount: 2,
        remaining: 8, // 10 - 2
        plan: 'free',
      });

      // Verify no transaction was run
      expect(mockDb.runTransaction).not.toHaveBeenCalled();
    });
  });

  describe('Scenario 3: new kanji under cap unlocks and increments', () => {
    it('returns allow=true, newlyUnlocked=true and atomically unlocks kanji', async () => {
      mockedGetSession.mockResolvedValue({ uid: 'user-1' });
      mockedEvaluate.mockReturnValue({
        allow: true,
        remaining: 7,
        reason: 'ok',
      });

      const progressDoc = {
        exists: true,
        data: () => ({
          unlockedKanji: ['見', '話', '聞'],
          unlockedCount: 3,
          lastUnlockedAt: '2026-03-24T10:00:00.000Z',
          updatedAt: '2026-03-24T10:00:00.000Z',
        }),
      };

      const usageDoc = {
        data: () => ({ kanji_browser_study: 3 }),
      };

      // Mock transaction to simulate successful unlock
      mockDb.runTransaction.mockImplementation(async (callback: any) => {
        const mockTransaction = {
          get: jest.fn()
            .mockResolvedValueOnce(progressDoc) // re-read progress
            .mockResolvedValueOnce(usageDoc),    // re-read usage
          set: jest.fn(),
        };
        await callback(mockTransaction);
        return Promise.resolve();
      });

      mockDb.collection.mockImplementation((name: string) => {
        if (name === 'users') {
          return {
            doc: jest.fn(() => ({
              get: jest.fn().mockResolvedValue({
                data: () => ({ subscription: { plan: 'free' } }),
              }),
              collection: jest.fn((collName: string) => {
                if (collName === 'progress') {
                  return {
                    doc: jest.fn(() => ({
                      get: jest.fn().mockResolvedValue(progressDoc),
                    })),
                  };
                }
                if (collName === 'usage') {
                  return {
                    doc: jest.fn(() => ({
                      get: jest.fn().mockResolvedValue(usageDoc),
                    })),
                  };
                }
              }),
            })),
          };
        }
        return { doc: jest.fn() };
      });

      const request = new NextRequest('http://localhost/api/kanji-browser/study/access', {
        method: 'POST',
        body: JSON.stringify({ kanji: '食' }), // New kanji
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        allow: true,
        newlyUnlocked: true,
        unlockedCount: 4, // 3 + 1
        remaining: 6,     // 10 - 4
        plan: 'free',
      });

      // Verify transaction was called
      expect(mockDb.runTransaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('Scenario 4: new kanji over cap denied', () => {
    it('returns allow=false when free user reaches unlock limit', async () => {
      mockedGetSession.mockResolvedValue({ uid: 'user-1' });
      mockedEvaluate.mockReturnValue({
        allow: false,
        remaining: 0,
        reason: 'Monthly limit reached',
        limit: 10,
      });

      const progressDoc = {
        exists: true,
        data: () => ({
          unlockedKanji: Array.from({ length: 10 }, (_, i) => `kanji${i}`),
          unlockedCount: 10,
          lastUnlockedAt: '2026-03-24T10:00:00.000Z',
          updatedAt: '2026-03-24T10:00:00.000Z',
        }),
      };

      const usageDoc = {
        data: () => ({ kanji_browser_study: 10 }),
      };

      mockDb.collection.mockImplementation((name: string) => {
        if (name === 'users') {
          return {
            doc: jest.fn(() => ({
              get: jest.fn().mockResolvedValue({
                data: () => ({ subscription: { plan: 'free' } }),
              }),
              collection: jest.fn((collName: string) => {
                if (collName === 'progress') {
                  return {
                    doc: jest.fn(() => ({
                      get: jest.fn().mockResolvedValue(progressDoc),
                    })),
                  };
                }
                if (collName === 'usage') {
                  return {
                    doc: jest.fn(() => ({
                      get: jest.fn().mockResolvedValue(usageDoc),
                    })),
                  };
                }
              }),
            })),
          };
        }
        return { doc: jest.fn() };
      });

      const request = new NextRequest('http://localhost/api/kanji-browser/study/access', {
        method: 'POST',
        body: JSON.stringify({ kanji: '新' }), // New kanji that would exceed limit
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        allow: false,
        newlyUnlocked: false,
        unlockedCount: 10,
        remaining: 0,
        plan: 'free',
        reason: 'Monthly limit reached',
        limit: 10,
      });

      // Verify no transaction was run
      expect(mockDb.runTransaction).not.toHaveBeenCalled();
    });
  });

  describe('Scenario 5: premium user always allowed', () => {
    it('allows premium_monthly users with unlimited access', async () => {
      mockedGetSession.mockResolvedValue({ uid: 'user-premium' });

      const progressDoc = {
        exists: true,
        data: () => ({
          unlockedKanji: ['見'],
          unlockedCount: 1,
          lastUnlockedAt: '2026-03-24T10:00:00.000Z',
          updatedAt: '2026-03-24T10:00:00.000Z',
        }),
      };

      mockDb.collection.mockImplementation((name: string) => {
        if (name === 'users') {
          return {
            doc: jest.fn(() => ({
              get: jest.fn().mockResolvedValue({
                data: () => ({ subscription: { plan: 'premium_monthly' } }),
              }),
              collection: jest.fn(() => ({
                doc: jest.fn(() => ({
                  get: jest.fn().mockResolvedValue(progressDoc),
                  set: jest.fn().mockResolvedValue(true),
                })),
              })),
            })),
          };
        }
        return { doc: jest.fn() };
      });

      const request = new NextRequest('http://localhost/api/kanji-browser/study/access', {
        method: 'POST',
        body: JSON.stringify({ kanji: '話' }), // New kanji for premium user
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        allow: true,
        newlyUnlocked: true,
        unlockedCount: 2,
        remaining: -1, // Unlimited
        plan: 'premium_monthly',
      });
    });

    it('allows premium_yearly users with unlimited access', async () => {
      mockedGetSession.mockResolvedValue({ uid: 'user-premium-yearly' });

      const progressDoc = {
        exists: true,
        data: () => ({
          unlockedKanji: ['見'],
          unlockedCount: 1,
          lastUnlockedAt: '2026-03-24T10:00:00.000Z',
          updatedAt: '2026-03-24T10:00:00.000Z',
        }),
      };

      mockDb.collection.mockImplementation((name: string) => {
        if (name === 'users') {
          return {
            doc: jest.fn(() => ({
              get: jest.fn().mockResolvedValue({
                data: () => ({ subscription: { plan: 'premium_yearly' } }),
              }),
              collection: jest.fn(() => ({
                doc: jest.fn(() => ({
                  get: jest.fn().mockResolvedValue(progressDoc),
                })),
              })),
            })),
          };
        }
        return { doc: jest.fn() };
      });

      const request = new NextRequest('http://localhost/api/kanji-browser/study/access', {
        method: 'POST',
        body: JSON.stringify({ kanji: '見' }), // Already unlocked for premium
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        allow: true,
        newlyUnlocked: false,
        unlockedCount: 1,
        remaining: -1, // Unlimited
        plan: 'premium_yearly',
      });
    });
  });

  describe('Scenario 6: response shape consistency', () => {
    it('always includes required fields in success response', async () => {
      mockedGetSession.mockResolvedValue({ uid: 'user-1' });

      const progressDoc = {
        exists: true,
        data: () => ({
          unlockedKanji: ['見'],
          unlockedCount: 1,
          lastUnlockedAt: '2026-03-24T10:00:00.000Z',
          updatedAt: '2026-03-24T10:00:00.000Z',
        }),
      };

      mockDb.collection.mockImplementation((name: string) => {
        if (name === 'users') {
          return {
            doc: jest.fn(() => ({
              get: jest.fn().mockResolvedValue({
                data: () => ({ subscription: { plan: 'free' } }),
              }),
              collection: jest.fn(() => ({
                doc: jest.fn(() => ({
                  get: jest.fn().mockResolvedValue(progressDoc),
                })),
              })),
            })),
          };
        }
        return { doc: jest.fn() };
      });

      const request = new NextRequest('http://localhost/api/kanji-browser/study/access', {
        method: 'POST',
        body: JSON.stringify({ kanji: '見' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Verify all required fields are present
      expect(data).toHaveProperty('allow');
      expect(data).toHaveProperty('newlyUnlocked');
      expect(data).toHaveProperty('unlockedCount');
      expect(data).toHaveProperty('remaining');
      expect(data).toHaveProperty('plan');
      expect(typeof data.allow).toBe('boolean');
      expect(typeof data.newlyUnlocked).toBe('boolean');
      expect(typeof data.unlockedCount).toBe('number');
      expect(typeof data.remaining).toBe('number');
      expect(typeof data.plan).toBe('string');
    });

    it('includes reason and limit fields in denial response', async () => {
      mockedGetSession.mockResolvedValue({ uid: 'user-1' });
      mockedEvaluate.mockReturnValue({
        allow: false,
        remaining: 0,
        reason: 'Monthly limit reached',
        limit: 10,
      });

      const progressDoc = {
        exists: true,
        data: () => ({
          unlockedKanji: Array.from({ length: 10 }, (_, i) => `k${i}`),
          unlockedCount: 10,
        }),
      };

      const usageDoc = { data: () => ({ kanji_browser_study: 10 }) };

      mockDb.collection.mockImplementation((name: string) => {
        if (name === 'users') {
          return {
            doc: jest.fn(() => ({
              get: jest.fn().mockResolvedValue({
                data: () => ({ subscription: { plan: 'free' } }),
              }),
              collection: jest.fn((collName: string) => {
                if (collName === 'progress') {
                  return { doc: jest.fn(() => ({ get: jest.fn().mockResolvedValue(progressDoc) })) };
                }
                if (collName === 'usage') {
                  return { doc: jest.fn(() => ({ get: jest.fn().mockResolvedValue(usageDoc) })) };
                }
              }),
            })),
          };
        }
        return { doc: jest.fn() };
      });

      const request = new NextRequest('http://localhost/api/kanji-browser/study/access', {
        method: 'POST',
        body: JSON.stringify({ kanji: '新' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data).toHaveProperty('reason');
      expect(data).toHaveProperty('limit');
      expect(typeof data.reason).toBe('string');
      expect(typeof data.limit).toBe('number');
    });
  });

  describe('Input validation', () => {
    it('returns 400 for invalid JSON body', async () => {
      const request = new NextRequest('http://localhost/api/kanji-browser/study/access', {
        method: 'POST',
        body: 'invalid json',
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('returns 400 for missing kanji field', async () => {
      const request = new NextRequest('http://localhost/api/kanji-browser/study/access', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();
      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid request');
    });

    it('returns 400 for multi-character kanji string', async () => {
      const request = new NextRequest('http://localhost/api/kanji-browser/study/access', {
        method: 'POST',
        body: JSON.stringify({ kanji: '見る' }),
      });

      const response = await POST(request);
      const data = await response.json();
      expect(response.status).toBe(400);
      expect(data.error).toContain('single character');
    });
  });
});
