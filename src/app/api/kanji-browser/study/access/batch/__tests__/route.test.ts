/**
 * Tests for Kanji Browser Study Batch Access API
 * POST /api/kanji-browser/study/access/batch
 *
 * Covers all required scenarios from Agent D brief:
 * 7. guest denied
 * 8. all selected kanji already unlocked -> allowed, zero new unlocks
 * 9. mixed selection under remaining cap -> allowed, all new kanji unlocked atomically
 * 10. mixed selection over remaining cap -> denied, zero partial unlocks
 * 11. premium selection always allowed
 * 12. response correctly reports alreadyUnlockedCount and newUnlockCount
 *
 * CRITICAL: Tests must specifically protect against partial unlock regressions
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

describe('POST /api/kanji-browser/study/access/batch', () => {
  const mockDb = {
    collection: jest.fn(),
    runTransaction: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetAdminDb.mockReturnValue(mockDb);
    mockedGetBucketKey.mockReturnValue('kanji_browser_study_2026-03-25');
  });

  describe('Scenario 7: guest denied', () => {
    it('returns 401 with allow=false for unauthenticated users', async () => {
      mockedGetSession.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/kanji-browser/study/access/batch', {
        method: 'POST',
        body: JSON.stringify({ kanji: ['見', '話', '聞'] }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({
        allow: false,
        alreadyUnlockedCount: 0,
        newUnlockCount: 3,
        totalUnlockedCount: 0,
        remaining: 0,
        plan: 'guest',
        reason: 'Authentication required',
      });
    });
  });

  describe('Scenario 8: all selected kanji already unlocked', () => {
    it('returns allow=true with zero new unlocks when all kanji are already unlocked', async () => {
      mockedGetSession.mockResolvedValue({ uid: 'user-1' });

      const progressDoc = {
        exists: true,
        data: () => ({
          unlockedKanji: ['見', '話', '聞', '食'],
          unlockedCount: 4,
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

      const request = new NextRequest('http://localhost/api/kanji-browser/study/access/batch', {
        method: 'POST',
        body: JSON.stringify({ kanji: ['見', '話', '聞'] }), // All already unlocked
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        allow: true,
        alreadyUnlockedCount: 3,
        newUnlockCount: 0,
        totalUnlockedCount: 4,
        remaining: 6, // 10 - 4
        plan: 'free',
      });

      // Verify no transaction was run since no new unlocks needed
      expect(mockDb.runTransaction).not.toHaveBeenCalled();
    });
  });

  describe('Scenario 9: mixed selection under remaining cap', () => {
    it('atomically unlocks all new kanji when under cap', async () => {
      mockedGetSession.mockResolvedValue({ uid: 'user-1' });
      mockedEvaluate.mockReturnValue({
        allow: true,
        remaining: 6, // 6 remaining slots
        reason: 'ok',
      });

      const progressDoc = {
        exists: true,
        data: () => ({
          unlockedKanji: ['見', '話'],
          unlockedCount: 2,
          lastUnlockedAt: '2026-03-24T10:00:00.000Z',
          updatedAt: '2026-03-24T10:00:00.000Z',
        }),
      };

      const usageDoc = {
        data: () => ({ kanji_browser_study: 2 }),
      };

      // Mock transaction to simulate successful batch unlock
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

      const request = new NextRequest('http://localhost/api/kanji-browser/study/access/batch', {
        method: 'POST',
        body: JSON.stringify({ kanji: ['見', '話', '聞', '食', '読'] }), // 2 already unlocked, 3 new
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        allow: true,
        alreadyUnlockedCount: 2,
        newUnlockCount: 3,
        totalUnlockedCount: 5, // 2 + 3
        remaining: 5,          // 10 - 5
        plan: 'free',
      });

      // Verify transaction was called for atomic unlock
      expect(mockDb.runTransaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('Scenario 10: mixed selection over remaining cap - CRITICAL anti-regression', () => {
    it('denies request and performs zero partial unlocks when selection exceeds cap', async () => {
      mockedGetSession.mockResolvedValue({ uid: 'user-1' });
      mockedEvaluate.mockReturnValue({
        allow: true,
        remaining: 2, // Only 2 slots remaining
        reason: 'ok',
      });

      const progressDoc = {
        exists: true,
        data: () => ({
          unlockedKanji: ['見', '話', '聞', '食', '読', '書', '語', '話'],
          unlockedCount: 8,
          lastUnlockedAt: '2026-03-24T10:00:00.000Z',
          updatedAt: '2026-03-24T10:00:00.000Z',
        }),
      };

      const usageDoc = {
        data: () => ({ kanji_browser_study: 8 }),
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

      const request = new NextRequest('http://localhost/api/kanji-browser/study/access/batch', {
        method: 'POST',
        body: JSON.stringify({
          kanji: ['見', '話', '新', '旧', '古', '今'] // 2 already unlocked, 4 new (exceeds 2 remaining)
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        allow: false,
        alreadyUnlockedCount: 2,
        newUnlockCount: 4,
        totalUnlockedCount: 8,
        remaining: 2,
        plan: 'free',
        reason: 'limit_reached',
        limit: 10,
      });

      // CRITICAL: Verify no transaction was run - no partial unlocks should happen
      expect(mockDb.runTransaction).not.toHaveBeenCalled();
    });

    it('prevents partial unlocks - atomic all-or-nothing behavior', async () => {
      mockedGetSession.mockResolvedValue({ uid: 'user-1' });
      mockedEvaluate.mockReturnValue({
        allow: true,
        remaining: 1, // Only 1 slot remaining
        reason: 'ok',
      });

      const initialProgressDoc = {
        exists: true,
        data: () => ({
          unlockedKanji: ['見', '話', '聞', '食', '読', '書', '語', '話', '行'],
          unlockedCount: 9,
          lastUnlockedAt: '2026-03-24T10:00:00.000Z',
          updatedAt: '2026-03-24T10:00:00.000Z',
        }),
      };

      const usageDoc = {
        data: () => ({ kanji_browser_study: 9 }),
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
                      get: jest.fn().mockResolvedValue(initialProgressDoc),
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

      const request = new NextRequest('http://localhost/api/kanji-browser/study/access/batch', {
        method: 'POST',
        body: JSON.stringify({
          kanji: ['新', '旧', '古'] // 3 new kanji, but only 1 remaining slot
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      // Request should be denied
      expect(data.allow).toBe(false);
      expect(data.newUnlockCount).toBe(3);

      // CRITICAL: No transaction should run - no partial unlocks
      expect(mockDb.runTransaction).not.toHaveBeenCalled();

      // Post-condition check: totalUnlockedCount should remain at 9
      expect(data.totalUnlockedCount).toBe(9);
    });
  });

  describe('Scenario 11: premium selection always allowed', () => {
    it('allows premium_monthly users to unlock any number of kanji', async () => {
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

      const request = new NextRequest('http://localhost/api/kanji-browser/study/access/batch', {
        method: 'POST',
        body: JSON.stringify({
          kanji: ['見', '話', '聞', '食', '読', '書', '語', '行', '来', '出', '入', '上', '下'] // 1 already, 12 new
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        allow: true,
        alreadyUnlockedCount: 1,
        newUnlockCount: 12,
        totalUnlockedCount: 13,
        remaining: -1, // Unlimited
        plan: 'premium_monthly',
      });
    });

    it('allows premium_yearly users to unlock any number of kanji', async () => {
      mockedGetSession.mockResolvedValue({ uid: 'user-premium-yearly' });

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

      const request = new NextRequest('http://localhost/api/kanji-browser/study/access/batch', {
        method: 'POST',
        body: JSON.stringify({
          kanji: ['見', '話'] // All already unlocked for premium
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        allow: true,
        alreadyUnlockedCount: 2,
        newUnlockCount: 0,
        totalUnlockedCount: 2,
        remaining: -1, // Unlimited
        plan: 'premium_yearly',
      });
    });
  });

  describe('Scenario 12: response correctly reports counts', () => {
    it('accurately reports alreadyUnlockedCount and newUnlockCount', async () => {
      mockedGetSession.mockResolvedValue({ uid: 'user-1' });
      mockedEvaluate.mockReturnValue({
        allow: true,
        remaining: 5,
        reason: 'ok',
      });

      const progressDoc = {
        exists: true,
        data: () => ({
          unlockedKanji: ['見', '話', '聞', '食', '読'],
          unlockedCount: 5,
          lastUnlockedAt: '2026-03-24T10:00:00.000Z',
          updatedAt: '2026-03-24T10:00:00.000Z',
        }),
      };

      const usageDoc = {
        data: () => ({ kanji_browser_study: 5 }),
      };

      mockDb.runTransaction.mockImplementation(async (callback: any) => {
        const mockTransaction = {
          get: jest.fn()
            .mockResolvedValueOnce(progressDoc)
            .mockResolvedValueOnce(usageDoc),
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

      const request = new NextRequest('http://localhost/api/kanji-browser/study/access/batch', {
        method: 'POST',
        body: JSON.stringify({
          kanji: ['見', '話', '書', '語', '行'] // 2 already unlocked (見, 話), 3 new (書, 語, 行)
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.alreadyUnlockedCount).toBe(2);
      expect(data.newUnlockCount).toBe(3);
      expect(data.totalUnlockedCount).toBe(8); // 5 + 3
      expect(data.remaining).toBe(2);           // 10 - 8

      // Verify all required response fields are present
      expect(data).toHaveProperty('allow');
      expect(data).toHaveProperty('alreadyUnlockedCount');
      expect(data).toHaveProperty('newUnlockCount');
      expect(data).toHaveProperty('totalUnlockedCount');
      expect(data).toHaveProperty('remaining');
      expect(data).toHaveProperty('plan');
    });

    it('handles deduplication correctly in count reporting', async () => {
      mockedGetSession.mockResolvedValue({ uid: 'user-1' });

      const progressDoc = {
        exists: true,
        data: () => ({
          unlockedKanji: ['見', '話'],
          unlockedCount: 2,
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

      const request = new NextRequest('http://localhost/api/kanji-browser/study/access/batch', {
        method: 'POST',
        body: JSON.stringify({
          kanji: ['見', '見', '話', '話', '見'] // Duplicates - should dedupe to 2 already unlocked
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.alreadyUnlockedCount).toBe(2);
      expect(data.newUnlockCount).toBe(0);
      expect(data.totalUnlockedCount).toBe(2);
    });
  });

  describe('Input validation', () => {
    it('returns 400 for invalid JSON body', async () => {
      const request = new NextRequest('http://localhost/api/kanji-browser/study/access/batch', {
        method: 'POST',
        body: 'invalid json',
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('returns 400 for missing kanji field', async () => {
      const request = new NextRequest('http://localhost/api/kanji-browser/study/access/batch', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();
      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid request');
    });

    it('returns 400 for empty kanji array', async () => {
      const request = new NextRequest('http://localhost/api/kanji-browser/study/access/batch', {
        method: 'POST',
        body: JSON.stringify({ kanji: [] }),
      });

      const response = await POST(request);
      const data = await response.json();
      expect(response.status).toBe(400);
      expect(data.error).toContain('at least one character');
    });

    it('returns 400 for non-array kanji field', async () => {
      const request = new NextRequest('http://localhost/api/kanji-browser/study/access/batch', {
        method: 'POST',
        body: JSON.stringify({ kanji: '見' }),
      });

      const response = await POST(request);
      const data = await response.json();
      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid request');
    });

    it('returns 400 for multi-character kanji strings in array', async () => {
      const request = new NextRequest('http://localhost/api/kanji-browser/study/access/batch', {
        method: 'POST',
        body: JSON.stringify({ kanji: ['見', '話す', '聞'] }),
      });

      const response = await POST(request);
      const data = await response.json();
      expect(response.status).toBe(400);
      expect(data.error).toContain('single character');
    });
  });
});
