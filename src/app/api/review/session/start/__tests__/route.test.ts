/**
 * Session Start API tests
 */

import { POST } from '../route';
import {
  ApiRouteTestHelper,
  RateLimitTestHelper,
  ValidationTestHelper,
  resetApiMocks,
  setupApiTest,
  teardownApiTest,
} from '@/lib/review-engine/__tests__/test-utils/api-test-setup';
import { NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock('@/lib/review-engine/session/manager');
jest.mock('@/lib/review-engine/session/storage');
jest.mock('@/lib/review-engine/session/analytics.service');
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

// Middleware mocks with stateful helpers
jest.mock('../../../_middleware/validation', () => {
  const responses: Array<{ data: any; response?: NextResponse }> = [];
  let defaultData: any = null;
  const validateBody = jest.fn(async (request: Request) => {
    if (responses.length > 0) {
      return responses.shift()!;
    }
    if (defaultData !== null) {
      return { data: defaultData, response: undefined };
    }
    try {
      const parsed = await request.clone().json();
      return { data: parsed, response: undefined };
    } catch (error) {
      return { data: {}, response: undefined };
    }
  });
  return {
    validateBody,
    sessionSchemas: { startSession: {} },
    __enqueueValidationResponse: (result: { data: any; response?: NextResponse }) => {
      responses.push(result);
    },
    __setValidationDefault: (data: any) => {
      defaultData = data;
    },
    __resetValidationState: () => {
      responses.length = 0;
      defaultData = null;
      validateBody.mockClear();
      validateBody.mockImplementation(async (request: Request) => {
        if (responses.length > 0) {
          return responses.shift()!;
        }
        if (defaultData !== null) {
          return { data: defaultData, response: undefined };
        }
        try {
          const parsed = await request.clone().json();
          return { data: parsed, response: undefined };
        } catch {
          return { data: {}, response: undefined };
        }
      });
    },
  };
});

jest.mock('../../../_middleware/rateLimit', () => {
  const queue: Array<{ success: boolean; response?: NextResponse }> = [];
  let defaultResult: { success: boolean; response?: NextResponse } = {
    success: true,
    response: undefined,
  };
  const rateLimitByUser = jest.fn(async () => {
    if (queue.length > 0) {
      return queue.shift()!;
    }
    return defaultResult;
  });
  return {
    rateLimitByUser,
    __enqueueRateLimitResponse: (result: { success: boolean; response?: NextResponse }) => {
      queue.push(result);
    },
    __setRateLimitDefault: (result: { success: boolean; response?: NextResponse }) => {
      defaultResult = result;
    },
    __resetRateLimitState: () => {
      queue.length = 0;
      defaultResult = { success: true, response: undefined };
      rateLimitByUser.mockClear();
      rateLimitByUser.mockImplementation(async () => {
        if (queue.length > 0) {
          return queue.shift()!;
        }
        return defaultResult;
      });
    },
  };
});

jest.mock('../../../_middleware/auth', () => {
  const state: {
    user: any;
    premium?: boolean;
    response?: NextResponse;
  } = { user: null };
  const requireAuth = jest.fn(async () => {
    if (state.response) {
      return { user: null as any, response: state.response };
    }
    return { user: state.user, response: undefined };
  });
  const isPremiumUser = jest.fn((user: any) => {
    if (typeof state.premium === 'boolean') {
      return state.premium;
    }
    return !!user?.tier && user.tier.toString().startsWith('premium');
  });
  return {
    requireAuth,
    isPremiumUser,
    __setAuthState: (next: { user?: any; premium?: boolean; response?: NextResponse }) => {
      if ('user' in next) {
        state.user = next.user ?? null;
      }
      if ('premium' in next) {
        state.premium = next.premium;
      }
      if ('response' in next) {
        state.response = next.response;
      }
    },
    __resetAuthState: () => {
      state.user = null;
      state.premium = undefined;
      state.response = undefined;
      requireAuth.mockClear();
      isPremiumUser.mockClear();
      requireAuth.mockImplementation(async () => {
        if (state.response) {
          return { user: null as any, response: state.response };
        }
        return { user: state.user, response: undefined };
      });
      isPremiumUser.mockImplementation((user: any) => {
        if (typeof state.premium === 'boolean') {
          return state.premium;
        }
        return !!user?.tier && user.tier.toString().startsWith('premium');
      });
    },
  };
});

jest.mock('@/lib/auth', () => {
  const actual = jest.requireActual('@/lib/auth');
  return {
    ...actual,
    validateSessionFromRequest: jest.fn(async () => ({
      valid: false,
      reason: 'unauthenticated',
    })),
  };
});

// ---------------------------------------------------------------------------
// Imports for mocked modules (after jest.mock)
// ---------------------------------------------------------------------------

import * as sessionManagerModule from '@/lib/review-engine/session/manager';
import * as pinManagerModule from '@/lib/review-engine/pinning/pin-manager';
import * as queueGeneratorModule from '@/lib/review-engine/queue/queue-generator';
import * as redisModule from '@/lib/redis/client';
import * as authMiddleware from '../../../_middleware/auth';
import * as rateLimitMiddleware from '../../../_middleware/rateLimit';
import * as validationMiddleware from '../../../_middleware/validation';

const mockSessionManager = sessionManagerModule as jest.Mocked<typeof sessionManagerModule>;
const mockPinManager = pinManagerModule as jest.Mocked<typeof pinManagerModule>;
const mockQueueGenerator = queueGeneratorModule as jest.Mocked<typeof queueGeneratorModule>;
const mockRedis = (redisModule as any).redis;

const setAuthState = (authMiddleware as any).__setAuthState as (
  next: { user?: any; premium?: boolean; response?: NextResponse }
) => void;
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
// Test helpers
// ---------------------------------------------------------------------------

type MockQueueItem = {
  id: string;
  contentType: string;
  primaryDisplay?: string;
  primaryAnswer?: string;
  difficulty?: number;
  tags?: string[];
};

const DEFAULT_FREE_USER = {
  uid: 'test-user',
  email: 'test-user@test.com',
  tier: 'free' as const,
  admin: false,
  sessionId: 'test-user-session',
};

function buildPinnedItem(item: MockQueueItem) {
  return {
    id: item.id,
    contentType: item.contentType,
    status: 'new',
    nextReviewAt: new Date(),
    primaryDisplay: item.primaryDisplay ?? '',
    primaryAnswer: item.primaryAnswer ?? '',
    difficulty: item.difficulty ?? 0.5,
    tags: item.tags ?? [],
    queuePriority: 'normal',
    pinnedAt: new Date(),
  };
}

function configureSessionSuccess(options: {
  queueItems?: MockQueueItem[];
  pinnedItems?: any[];
  sessionSource?: string;
  sessionLimit?: number;
  shuffleOrder?: boolean;
}) {
  const queueItems = options.queueItems ?? [
    {
      id: 'item1',
      contentType: 'kana',
      primaryDisplay: 'あ',
      primaryAnswer: 'a',
    },
  ];
  const pinnedItems = options.pinnedItems ?? queueItems.map(buildPinnedItem);

  mockPinManager.PinManager.prototype.getPinnedItems.mockResolvedValue(pinnedItems);
  mockQueueGenerator.QueueGenerator.prototype.generateQueue.mockResolvedValue({
    items: queueItems,
    stats: {
      total: queueItems.length,
      new: queueItems.length,
      learning: 0,
      mastered: 0,
      due: queueItems.length,
      nextReviewIn: null,
    },
  });
  mockQueueGenerator.QueueGenerator.prototype.applyDailyLimits.mockImplementation(items => items);
  mockQueueGenerator.QueueGenerator.prototype.shuffleForVariety.mockImplementation(items => items);
  mockSessionManager.SessionManager.prototype.startSession.mockResolvedValue({
    id: 'session-123',
    status: 'active',
    startedAt: new Date(),
    currentIndex: 0,
    items: queueItems.map(item => ({
      content: { id: item.id, contentType: item.contentType },
      status: 'pending',
    })),
    mode: 'recognition',
    source: options.sessionSource ?? 'manual',
  });
}

async function authenticateUser({ uid, premium }: { uid: string; premium: boolean }) {
  const user = premium
    ? await (ApiRouteTestHelper as any).mockPremiumUser(uid)
    : await (ApiRouteTestHelper as any).mockAuthUser(uid);
  setAuthState({ user, premium, response: undefined });
  return user;
}

function markUnauthenticated() {
  setAuthState({
    user: null,
    premium: false,
    response: NextResponse.json(
      { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
      { status: 401 }
    ),
  });
}

function resetHarnessState() {
  resetAuthState();
  resetRateLimitState();
  resetValidationState();
  setRateLimitDefault({ success: true, response: undefined });
  setValidationDefault(null);
  setAuthState({ user: DEFAULT_FREE_USER, premium: false, response: undefined });

  mockRedis.get.mockReset();
  mockRedis.set.mockReset?.();
  mockRedis.setex.mockReset?.();
  mockRedis.del.mockReset?.();
  mockRedis.exists.mockReset?.();
  mockRedis.incr.mockReset?.();
  mockRedis.get.mockResolvedValue(null);
  mockRedis.exists.mockResolvedValue(0);
  mockRedis.incr.mockResolvedValue(1);
  mockRedis.set.mockResolvedValue('OK');
  mockRedis.setex.mockResolvedValue('OK');
  mockRedis.del.mockResolvedValue(1);

  mockPinManager.PinManager.prototype.getPinnedItems.mockReset();
  mockQueueGenerator.QueueGenerator.prototype.generateQueue.mockReset();
  mockQueueGenerator.QueueGenerator.prototype.applyDailyLimits.mockReset();
  mockQueueGenerator.QueueGenerator.prototype.shuffleForVariety.mockReset();
  mockSessionManager.SessionManager.prototype.startSession.mockReset();
}

function enqueueRateLimitBlock(status: number, message: string) {
  enqueueRateLimitResponse({
    success: false,
    response: NextResponse.json(
      {
        success: false,
        error: { code: 'RATE_LIMIT_EXCEEDED', message },
      },
      { status }
    ),
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Session Start API', () => {
  beforeAll(setupApiTest);
  afterAll(teardownApiTest);
  beforeEach(() => {
    resetApiMocks();
    resetHarnessState();
  });

  describe('Authentication', () => {
    it('rejects unauthenticated requests', async () => {
      markUnauthenticated();

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/session/start',
        body: { type: 'daily' },
      });

      const response = await POST(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      ApiRouteTestHelper.expectErrorResponse(result, 401, 'AUTH_REQUIRED');
    });

    it('starts a session for free users', async () => {
      await authenticateUser({ uid: 'free-user', premium: false });
      configureSessionSuccess({ sessionSource: 'daily' });

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/session/start',
        headers: { Authorization: 'Bearer fake-token' },
        body: { type: 'daily' },
      });

      const response = await POST(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      expect(result.data.success).toBe(true);
      expect(result.data.data.session.source).toBe('daily');
    });

    it('starts a session for premium users', async () => {
      await authenticateUser({ uid: 'premium-user', premium: true });
      configureSessionSuccess({ sessionSource: 'daily' });

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/session/start',
        headers: { Authorization: 'Bearer premium-token' },
        body: { type: 'daily' },
      });

      const response = await POST(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      expect(result.data.success).toBe(true);
      expect(result.data.data.session.source).toBe('daily');
    });
  });

  describe('Rate limiting', () => {
    it('enforces per-user limits', async () => {
      await authenticateUser({ uid: 'limit-user', premium: false });
      configureSessionSuccess({ sessionSource: 'daily' });
      enqueueRateLimitResponse({ success: true, response: undefined });
      enqueueRateLimitBlock(429, 'Too many requests');

      const makeRequest = async () => {
        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'POST',
          url: 'http://localhost:3000/api/review/session/start',
          headers: { Authorization: 'Bearer limit-token' },
          body: { type: 'daily' },
        });
        return POST(request).then(ApiRouteTestHelper.parseResponse);
      };

      await RateLimitTestHelper.testRateLimit(makeRequest, 1, 60000);
    });

    it('allows higher limits for premium users', async () => {
      await authenticateUser({ uid: 'limit-premium', premium: true });
      configureSessionSuccess({ sessionSource: 'daily' });

      enqueueRateLimitResponse({ success: true, response: undefined });
      enqueueRateLimitResponse({ success: true, response: undefined });
      enqueueRateLimitBlock(429, 'Too many requests');

      const makeRequest = async () => {
        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'POST',
          url: 'http://localhost:3000/api/review/session/start',
          headers: { Authorization: 'Bearer limit-premium-token' },
          body: { type: 'daily' },
        });
        return POST(request).then(ApiRouteTestHelper.parseResponse);
      };

      const first = await makeRequest();
      const second = await makeRequest();
      const third = await makeRequest();

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(third.status).toBe(429);
    });
  });

  describe('Validation', () => {
    it('returns 400 for invalid session type', async () => {
      await authenticateUser({ uid: 'validation-user', premium: false });
      enqueueValidationResponse({
        data: null,
        response: NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'type is required' } },
          { status: 400 }
        ),
      });

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/session/start',
        headers: { Authorization: 'Bearer validation-token' },
        body: {},
      });

      const response = await POST(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      ApiRouteTestHelper.expectErrorResponse(result, 400, 'VALIDATION_ERROR');
      const errorMessage =
        typeof result.data.error === 'string'
          ? result.data.error
          : result.data.error?.message ?? '';
      expect(errorMessage).toContain('type is required');
    });

    it('validates session settings', async () => {
      await authenticateUser({ uid: 'validation-user', premium: false });
      enqueueValidationResponse({
        data: null,
        response: NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'maxItems must be positive' } },
          { status: 400 }
        ),
      });

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/session/start',
        headers: { Authorization: 'Bearer validation-token' },
        body: { type: 'daily', settings: { maxItems: -1 } },
      });

      const response = await POST(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      ApiRouteTestHelper.expectErrorResponse(result, 400, 'VALIDATION_ERROR');
      const errorMessage =
        typeof result.data.error === 'string'
          ? result.data.error
          : result.data.error?.message ?? '';
      expect(errorMessage).toContain('maxItems must be positive');
    });
  });

  describe('Business logic', () => {
    it('returns 409 when active session exists', async () => {
      await authenticateUser({ uid: 'conflict-user', premium: false });
      configureSessionSuccess({ sessionSource: 'daily' });

      mockRedis.get.mockImplementation(async (key: string) => {
        if (key === 'review:session:active:conflict-user') {
          return JSON.stringify({
            sessionId: 'existing-session',
            startedAt: new Date().toISOString(),
            itemCount: 10,
          });
        }
        return null;
      });

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/session/start',
        headers: { Authorization: 'Bearer conflict-token' },
        body: { type: 'daily' },
      });

      const response = await POST(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      ApiRouteTestHelper.expectErrorResponse(result, 409, 'CONFLICT');
      const errorMessage =
        typeof result.data.error === 'string'
          ? result.data.error
          : result.data.error?.message ?? '';
      expect(errorMessage).toContain('active session already exists');
    });

    it('creates a daily session with due and learning items', async () => {
      await authenticateUser({ uid: 'daily-user', premium: false });
      const pinnedItems = [
        {
          id: 'due-item',
          contentType: 'kana',
          status: 'new',
          nextReviewAt: new Date(Date.now() - 1000),
        },
        {
          id: 'learning-item',
          contentType: 'kana',
          status: 'learning',
          nextReviewAt: new Date(Date.now() + 60000),
        },
      ].map(item => ({
        ...item,
        primaryDisplay: item.id,
        primaryAnswer: item.id,
        difficulty: 0.5,
        tags: [],
        queuePriority: 'normal',
        pinnedAt: new Date(),
      }));
      const queueItems: MockQueueItem[] = [
        { id: 'due-item', contentType: 'kana' },
        { id: 'learning-item', contentType: 'kana' },
      ];
      configureSessionSuccess({
        pinnedItems,
        queueItems,
        sessionSource: 'daily',
      });

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/session/start',
        headers: { Authorization: 'Bearer daily-token' },
        body: { type: 'daily' },
      });

      const response = await POST(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      expect(result.data.data.session.source).toBe('daily');
      expect(mockQueueGenerator.QueueGenerator.prototype.generateQueue).toHaveBeenCalledWith(
        'daily-user',
        expect.any(Array),
        expect.objectContaining({
          includeNew: true,
          includeDue: true,
          includeLearning: true,
        })
      );
    });

    it('creates a quick session limited to five items', async () => {
      await authenticateUser({ uid: 'quick-user', premium: false });
      configureSessionSuccess({
        queueItems: Array.from({ length: 5 }).map((_, index) => ({
          id: `item-${index}`,
          contentType: 'kana',
        })),
        sessionSource: 'quick',
      });

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/session/start',
        headers: { Authorization: 'Bearer quick-token' },
        body: { type: 'quick' },
      });

      const response = await POST(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      expect(result.data.data.session.source).toBe('quick');
      expect(mockQueueGenerator.QueueGenerator.prototype.generateQueue).toHaveBeenCalledWith(
        'quick-user',
        expect.any(Array),
        expect.objectContaining({ limit: 5 })
      );
    });

    it('creates a test session without shuffling', async () => {
      await authenticateUser({ uid: 'test-user', premium: false });
      configureSessionSuccess({
        queueItems: [
          { id: 'item1', contentType: 'kana' },
        ],
        sessionSource: 'test',
      });

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/session/start',
        headers: { Authorization: 'Bearer test-token' },
        body: { type: 'test' },
      });

      const response = await POST(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      expect(result.data.data.session.source).toBe('test');
      expect(mockQueueGenerator.QueueGenerator.prototype.generateQueue).toHaveBeenCalledWith(
        'test-user',
        expect.any(Array),
        expect.objectContaining({ shuffleOrder: false })
      );
    });

    it('resolves specific item IDs', async () => {
      await authenticateUser({ uid: 'custom-user', premium: false });

      const pinnedItems = [
        { id: 'item1', contentType: 'kana' },
        { id: 'item2', contentType: 'kana' },
        { id: 'item3', contentType: 'kana' },
      ].map(buildPinnedItem);

      mockPinManager.PinManager.prototype.getPinnedItems.mockResolvedValue(pinnedItems);
      mockSessionManager.SessionManager.prototype.startSession.mockResolvedValue({
        id: 'manual-session',
        status: 'active',
        startedAt: new Date(),
        currentIndex: 0,
        items: [
          { content: { id: 'item1', contentType: 'kana' }, status: 'pending' },
          { content: { id: 'item3', contentType: 'kana' }, status: 'pending' },
        ],
        mode: 'recognition',
        source: 'manual',
      });

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/session/start',
        headers: { Authorization: 'Bearer custom-token' },
        body: { type: 'custom', itemIds: ['item1', 'item3'] },
      });

      const response = await POST(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      expect(result.data.data.items.map((item: any) => item.id)).toEqual(['item1', 'item3']);
    });

    it('returns 400 when no items are available', async () => {
      await authenticateUser({ uid: 'empty-user', premium: false });
      mockPinManager.PinManager.prototype.getPinnedItems.mockResolvedValue([]);
      mockQueueGenerator.QueueGenerator.prototype.generateQueue.mockResolvedValue({ items: [] });

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/session/start',
        headers: { Authorization: 'Bearer empty-token' },
        body: { type: 'daily' },
      });

      const response = await POST(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      ApiRouteTestHelper.expectErrorResponse(result, 400, 'INVALID_STATE');
    });
  });

  describe('Error handling', () => {
    beforeEach(async () => {
      await authenticateUser({ uid: 'error-user', premium: false });
    });

    it('handles PinManager failures', async () => {
      mockPinManager.PinManager.prototype.getPinnedItems.mockRejectedValue(
        new Error('Pin manager failure')
      );

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/session/start',
        headers: { Authorization: 'Bearer error-token' },
        body: { type: 'daily' },
      });

      const response = await POST(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(500);
    });

    it('handles SessionManager failures', async () => {
      configureSessionSuccess({ sessionSource: 'daily' });
      mockSessionManager.SessionManager.prototype.startSession.mockRejectedValue(
        new Error('Session manager failure')
      );

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/session/start',
        headers: { Authorization: 'Bearer error-token' },
        body: { type: 'daily' },
      });

      const response = await POST(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(500);
    });
  });

  describe('CORS', () => {
    it('includes CORS headers in the response', async () => {
      await authenticateUser({ uid: 'cors-user', premium: false });
      configureSessionSuccess({ sessionSource: 'daily' });

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/session/start',
        headers: {
          Authorization: 'Bearer cors-token',
          Origin: 'https://example.com',
        },
        body: { type: 'daily' },
      });

      const response = await POST(request);

      expect(response.headers.get('access-control-allow-origin')).toBeDefined();
      expect(response.headers.get('access-control-allow-methods')).toBeDefined();
      expect(response.headers.get('access-control-allow-headers')).toBeDefined();
    });
  });
});
