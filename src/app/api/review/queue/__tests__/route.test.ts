/**
 * Review Queue API tests
 */

import { GET } from '../route';
import {
  ApiRouteTestHelper,
  resetApiMocks,
  setupApiTest,
  teardownApiTest,
} from '@/lib/review-engine/__tests__/test-utils/api-test-setup';
import { NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock('@/lib/review-engine/pinning/pin-manager');
jest.mock('@/lib/review-engine/queue/queue-generator');
jest.mock('@/lib/auth/session');
jest.mock('@/lib/redis/client');
jest.mock('@/lib/monitoring/logger', () => ({
  reviewLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  serverLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}));

jest.mock('msw', () => ({
  rest: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));
jest.mock('msw/node', () => ({
  setupServer: jest.fn(() => ({
    listen: jest.fn(),
    close: jest.fn(),
    resetHandlers: jest.fn(),
    use: jest.fn(),
  })),
}));

jest.mock('../../_middleware/validation', () => {
  const queue: Array<{ data: any; response?: NextResponse }> = [];
  let defaultResult: any = null;
  const validateQuery = jest.fn(async () => {
    if (queue.length > 0) {
      return queue.shift()!;
    }
    return { data: defaultResult, response: undefined };
  });
  return {
    validateQuery,
    queueSchemas: { getQueue: {} },
    __enqueueValidationResponse: (result: { data: any; response?: NextResponse }) => {
      queue.push(result);
    },
    __setValidationDefault: (data: any) => {
      defaultResult = data;
    },
    __resetValidationState: () => {
      queue.length = 0;
      defaultResult = null;
      validateQuery.mockClear();
      validateQuery.mockImplementation(async () => {
        if (queue.length > 0) {
          return queue.shift()!;
        }
        return { data: defaultResult, response: undefined };
      });
    },
  };
});

jest.mock('../../_middleware/rateLimit', () => {
  const queue: Array<{ success: boolean; response?: NextResponse }> = [];
  let defaultResult: { success: boolean; response?: NextResponse } = {
    success: true,
    response: undefined,
  };
  const rateLimit = jest.fn(async () => {
    if (queue.length > 0) {
      return queue.shift()!;
    }
    return defaultResult;
  });
  return {
    rateLimit,
    __enqueueRateLimitResponse: (result: { success: boolean; response?: NextResponse }) => {
      queue.push(result);
    },
    __setRateLimitDefault: (result: { success: boolean; response?: NextResponse }) => {
      defaultResult = result;
    },
    __resetRateLimitState: () => {
      queue.length = 0;
      defaultResult = { success: true, response: undefined };
      rateLimit.mockClear();
      rateLimit.mockImplementation(async () => {
        if (queue.length > 0) {
          return queue.shift()!;
        }
        return defaultResult;
      });
    },
  };
});

jest.mock('../../_middleware/auth', () => {
  const state: { user: any; response?: NextResponse } = { user: null };
  const requireAuth = jest.fn(async () => {
    if (state.response) {
      return { user: null as any, response: state.response };
    }
    return { user: state.user, response: undefined };
  });
  const isPremiumUser = jest.fn((user: any) => Boolean(user?.tier?.includes('premium')));
  return {
    requireAuth,
    isPremiumUser,
    __setAuthState: (next: { user?: any; response?: NextResponse }) => {
      if ('user' in next) {
        state.user = next.user ?? null;
      }
      if ('response' in next) {
        state.response = next.response;
      }
    },
    __resetAuthState: () => {
      state.user = null;
      state.response = undefined;
      requireAuth.mockClear();
      isPremiumUser.mockClear();
      requireAuth.mockImplementation(async () => {
        if (state.response) {
          return { user: null as any, response: state.response };
        }
        return { user: state.user, response: undefined };
      });
      isPremiumUser.mockImplementation((user: any) => Boolean(user?.tier?.includes('premium')));
    },
  };
});

jest.mock('@/lib/auth', () => {
  const actual = jest.requireActual('@/lib/auth');
  return {
    ...actual,
    validateSessionFromRequest: jest.fn(async () => ({ valid: false })),
  };
});

// ---------------------------------------------------------------------------
// Imports for mocked modules
// ---------------------------------------------------------------------------

import * as pinManagerModule from '@/lib/review-engine/pinning/pin-manager';
import * as queueGeneratorModule from '@/lib/review-engine/queue/queue-generator';
import * as redisModule from '@/lib/redis/client';
import * as authMiddleware from '../../_middleware/auth';
import * as rateLimitMiddleware from '../../_middleware/rateLimit';
import * as validationMiddleware from '../../_middleware/validation';

const mockPinManager = pinManagerModule as jest.Mocked<typeof pinManagerModule>;
const mockQueueGenerator = queueGeneratorModule as jest.Mocked<typeof queueGeneratorModule>;
const mockRedis = (redisModule as any).redis;

const setAuthState = (authMiddleware as any).__setAuthState as (next: {
  user?: any;
  response?: NextResponse;
}) => void;
const resetAuthState = (authMiddleware as any).__resetAuthState as () => void;
const enqueueRateLimitResponse = (rateLimitMiddleware as any)
  .__enqueueRateLimitResponse as (result: { success: boolean; response?: NextResponse }) => void;
const setRateLimitDefault = (rateLimitMiddleware as any)
  .__setRateLimitDefault as (result: { success: boolean; response?: NextResponse }) => void;
const resetRateLimitState = (rateLimitMiddleware as any).__resetRateLimitState as () => void;
const enqueueValidationResponse = (validationMiddleware as any)
  .__enqueueValidationResponse as (result: { data: any; response?: NextResponse }) => void;
const setValidationDefault = (validationMiddleware as any).__setValidationDefault as (
  data: any
) => void;
const resetValidationState = (validationMiddleware as any).__resetValidationState as () => void;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type MockPinnedItem = {
  id: string;
  contentType: string;
  status?: string;
  nextReviewAt?: Date;
  srsData?: any;
  queuePriority?: string;
};

type MockQueueEntry = {
  id: string;
  contentType: string;
  queuePriority?: string;
  dueIn?: number;
  source?: string;
  srsData?: { status?: string; streak?: number };
};

const DEFAULT_USER = {
  uid: 'test-user',
  email: 'test-user@test.com',
  tier: 'free' as const,
  admin: false,
  sessionId: 'session-test',
};

function buildPinned(items: MockPinnedItem[]): any[] {
  return items.map(item => ({
    id: item.id,
    contentType: item.contentType,
    status: item.status ?? 'new',
    nextReviewAt: item.nextReviewAt ?? new Date(),
    srsData: item.srsData ?? { status: 'new', streak: 0 },
    queuePriority: item.queuePriority ?? 'normal',
    pinnedAt: new Date(),
  }));
}

function configureQueueSuccess(options: {
  pinnedItems?: MockPinnedItem[];
  queueItems?: MockQueueEntry[];
  stats?: Partial<{
    total: number;
    new: number;
    learning: number;
    mastered: number;
    due: number;
    nextReviewIn: number | null;
  }>;
}) {
  const pinned = buildPinned(
    options.pinnedItems ?? [
      { id: 'item-1', contentType: 'kana', status: 'new' },
    ]
  );
  const queueItems = options.queueItems ?? [
    { id: 'item-1', contentType: 'kana', queuePriority: 'normal', source: 'manual' },
  ];
  mockPinManager.PinManager.prototype.getPinnedItems.mockResolvedValue(pinned);
  mockQueueGenerator.QueueGenerator.prototype.generateQueue.mockResolvedValue({
    items: queueItems,
    stats: {
      total: queueItems.length,
      new: queueItems.length,
      learning: 0,
      mastered: 0,
      due: queueItems.length,
      nextReviewIn: null,
      ...options.stats,
    },
  });
  mockQueueGenerator.QueueGenerator.prototype.applyDailyLimits.mockImplementation((items, _count) => items);
  mockQueueGenerator.QueueGenerator.prototype.shuffleForVariety.mockImplementation(items => items);
}

async function authenticateUser({ uid, premium }: { uid: string; premium: boolean }) {
  const user = premium
    ? await (ApiRouteTestHelper as any).mockPremiumUser(uid)
    : await (ApiRouteTestHelper as any).mockAuthUser(uid);
  setAuthState({ user, response: undefined });
  return user;
}

function markUnauthenticated() {
  setAuthState({
    user: null,
    response: NextResponse.json(
      { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
      { status: 401 }
    ),
  });
}

function resetHarnessState() {
  resetApiMocks();
  resetAuthState();
  resetRateLimitState();
  resetValidationState();
  setRateLimitDefault({ success: true, response: undefined });
  setValidationDefault(null);
  setAuthState({ user: DEFAULT_USER });

  mockRedis.get.mockReset();
  mockRedis.set.mockReset?.();
  mockRedis.setex.mockReset?.();
  mockRedis.del.mockReset?.();
  mockRedis.get.mockResolvedValue(null);
  mockRedis.setex.mockResolvedValue('OK');

  mockPinManager.PinManager.prototype.getPinnedItems.mockReset();
  mockQueueGenerator.QueueGenerator.prototype.generateQueue.mockReset();
  mockQueueGenerator.QueueGenerator.prototype.applyDailyLimits.mockReset();
  mockQueueGenerator.QueueGenerator.prototype.shuffleForVariety.mockReset();
}

function enqueueRateLimitBlock(status: number) {
  enqueueRateLimitResponse({
    success: false,
    response: NextResponse.json(
      { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } },
      { status }
    ),
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Review Queue API', () => {
  beforeAll(setupApiTest);
  afterAll(teardownApiTest);
  beforeEach(() => {
    resetHarnessState();
  });

  describe('Authentication & rate limiting', () => {
    it('returns 401 for unauthenticated users', async () => {
      markUnauthenticated();

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/review/queue',
      });

      const response = await GET(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(401);
    });

    it('enforces rate limits', async () => {
      await authenticateUser({ uid: 'rate-user', premium: false });
      configureQueueSuccess({});
      enqueueRateLimitResponse({ success: true, response: undefined });
      enqueueRateLimitBlock(429);

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/review/queue',
        headers: { Authorization: 'Bearer rate-token' },
      });

      const first = await GET(request);
      const firstResult = await ApiRouteTestHelper.parseResponse(first);
      expect(firstResult.status).toBe(200);

      const second = await GET(request);
      const secondResult = await ApiRouteTestHelper.parseResponse(second);
      expect(secondResult.status).toBe(429);
    });
  });

  describe('Queue responses', () => {
    it('returns pinned items as queue entries', async () => {
      await authenticateUser({ uid: 'queue-user', premium: false });
      configureQueueSuccess({
        queueItems: [
          { id: 'item1', contentType: 'kana', queuePriority: 'normal', source: 'manual' },
        ],
      });

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/review/queue',
        headers: { Authorization: 'Bearer queue-token' },
      });

      const response = await GET(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      expect(result.data.data.items).toHaveLength(1);
      expect(result.data.data.items[0].id).toBe('item1');
      expect(result.data.data.stats.queueSize).toBe(1);
    });

    it('applies limit parameter for free users', async () => {
      await authenticateUser({ uid: 'limited-user', premium: false });
      configureQueueSuccess({
        pinnedItems: Array.from({ length: 100 }).map((_, index) => ({
          id: `item-${index}`,
          contentType: 'kana',
        })),
        queueItems: Array.from({ length: 100 }).map((_, index) => ({
          id: `item-${index}`,
          contentType: 'kana',
        })),
      });

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/review/queue?limit=80',
        headers: { Authorization: 'Bearer limited-token' },
      });

      const response = await GET(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      expect(mockQueueGenerator.QueueGenerator.prototype.generateQueue).toHaveBeenCalledWith(
        'limited-user',
        expect.any(Array),
        expect.objectContaining({ limit: 50 })
      );
    });

    it('allows larger limits for premium users', async () => {
      await authenticateUser({ uid: 'premium-queue', premium: true });
      configureQueueSuccess({
        queueItems: Array.from({ length: 120 }).map((_, index) => ({
          id: `item-${index}`,
          contentType: 'kana',
        })),
      });

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/review/queue?limit=120',
        headers: { Authorization: 'Bearer premium-token' },
      });

      const response = await GET(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      expect(mockQueueGenerator.QueueGenerator.prototype.generateQueue).toHaveBeenCalledWith(
        'premium-queue',
        expect.any(Array),
        expect.objectContaining({ limit: 100 })
      );
    });

    it('filters by content type', async () => {
      await authenticateUser({ uid: 'filter-user', premium: false });
      configureQueueSuccess({ queueItems: [{ id: 'item1', contentType: 'kanji' }] });

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/review/queue?contentType=kanji',
        headers: { Authorization: 'Bearer filter-token' },
      });

      const response = await GET(request);
      await ApiRouteTestHelper.parseResponse(response);

      expect(mockQueueGenerator.QueueGenerator.prototype.generateQueue).toHaveBeenCalledWith(
        'filter-user',
        expect.any(Array),
        expect.objectContaining({ contentTypes: ['kanji'] })
      );
    });

    it('returns cached responses when available', async () => {
      await authenticateUser({ uid: 'cache-user', premium: false });
      const cachedPayload = {
        items: [{ id: 'cached-item', contentType: 'kana' }],
        stats: { queueSize: 1 },
      };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(cachedPayload));

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/review/queue',
        headers: { Authorization: 'Bearer cache-token' },
      });

      const response = await GET(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      expect(result.data.data.items[0].id).toBe('cached-item');
      expect(mockPinManager.PinManager.prototype.getPinnedItems).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    beforeEach(async () => {
      await authenticateUser({ uid: 'error-user', premium: false });
    });

    it('propagates PinManager failures', async () => {
      mockPinManager.PinManager.prototype.getPinnedItems.mockRejectedValue(
        new Error('Pin manager failure')
      );

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/review/queue',
        headers: { Authorization: 'Bearer error-token' },
      });

      const response = await GET(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(500);
    });

    it('propagates QueueGenerator failures', async () => {
      configureQueueSuccess({});
      mockQueueGenerator.QueueGenerator.prototype.generateQueue.mockRejectedValue(
        new Error('Generator failure')
      );

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/review/queue',
        headers: { Authorization: 'Bearer error-token' },
      });

      const response = await GET(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(500);
    });
  });

  describe('CORS', () => {
    it('includes CORS headers', async () => {
      await authenticateUser({ uid: 'cors-user', premium: false });
      configureQueueSuccess({});

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/review/queue',
        headers: { Authorization: 'Bearer cors-token', Origin: 'https://example.com' },
      });

      const response = await GET(request);

      expect(response.headers.get('access-control-allow-origin')).toBeDefined();
      expect(response.headers.get('access-control-allow-methods')).toBeDefined();
      expect(response.headers.get('access-control-allow-headers')).toBeDefined();
    });
  });
});
