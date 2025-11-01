/**
 * Pin management API tests
 */

import { POST, DELETE } from '../route';
import { handleApiError } from '../../_middleware/errors';
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
  let defaultData: any = null;
  const validateBody = jest.fn(async () => {
    if (queue.length > 0) {
      return queue.shift()!;
    }
    return { data: defaultData, response: undefined };
  });
  return {
    validateBody,
    pinSchemas: {
      pinSingle: {},
      unpin: {},
    },
    __enqueueValidationResponse: (result: { data: any; response?: NextResponse }) => {
      queue.push(result);
    },
    __setValidationDefault: (data: any) => {
      defaultData = data;
    },
    __resetValidationState: () => {
      queue.length = 0;
      defaultData = null;
      validateBody.mockClear();
      validateBody.mockImplementation(async () => {
        if (queue.length > 0) {
          return queue.shift()!;
        }
        return { data: defaultData, response: undefined };
      });
    },
  };
});

jest.mock('../../_middleware/rateLimit', () => {
  const responses: Array<{ success: boolean; response?: NextResponse }> = [];
  let defaultResult: { success: boolean; response?: NextResponse } = {
    success: true,
    response: undefined,
  };
  const rateLimit = jest.fn(async () => {
    if (responses.length > 0) {
      return responses.shift()!;
    }
    return defaultResult;
  });
  return {
    rateLimit,
    __enqueueRateLimitResponse: (result: { success: boolean; response?: NextResponse }) => {
      responses.push(result);
    },
    __setRateLimitDefault: (result: { success: boolean; response?: NextResponse }) => {
      defaultResult = result;
    },
    __resetRateLimitState: () => {
      responses.length = 0;
      defaultResult = { success: true, response: undefined };
      rateLimit.mockClear();
      rateLimit.mockImplementation(async () => {
        if (responses.length > 0) {
          return responses.shift()!;
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
  return {
    requireAuth,
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
      requireAuth.mockImplementation(async () => {
        if (state.response) {
          return { user: null as any, response: state.response };
        }
        return { user: state.user, response: undefined };
      });
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
import * as redisModule from '@/lib/redis/client';
import * as authMiddleware from '../../_middleware/auth';
import * as rateLimitMiddleware from '../../_middleware/rateLimit';
import * as validationMiddleware from '../../_middleware/validation';

const mockPinManager = pinManagerModule as jest.Mocked<typeof pinManagerModule>;
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

const DEFAULT_USER = {
  uid: 'pin-user',
  email: 'pin-user@test.com',
  tier: 'free' as const,
  admin: false,
  sessionId: 'pin-session',
};

function configurePinSuccess() {
  mockPinManager.PinManager.prototype.pin.mockResolvedValue({
    id: 'pinned-item',
    contentId: 'kana-1',
    contentType: 'kana',
    priority: 'normal',
  });
  mockPinManager.PinManager.prototype.getStatistics.mockResolvedValue({
    totalPinned: 1,
    activeItems: 1,
    scheduledItems: 0,
  });
  mockPinManager.PinManager.prototype.unpin.mockResolvedValue(true);
}

async function authenticateUser(userId = 'pin-user') {
  const user = await (ApiRouteTestHelper as any).mockAuthUser(userId);
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
  setValidationDefault({ contentId: 'kana-1', contentType: 'kana' });
  setAuthState({ user: DEFAULT_USER });
  configurePinSuccess();

  mockRedis.del.mockReset?.();
  mockRedis.del.mockResolvedValue(1);
}

async function executePost(request: Request) {
  try {
    return await POST(request as any);
  } catch (error) {
    return handleApiError(error);
  }
}

async function executeDelete(request: Request) {
  try {
    return await DELETE(request as any);
  } catch (error) {
    return handleApiError(error);
  }
}

function enqueueValidationFailure(message: string) {
  enqueueValidationResponse({
    data: null,
    response: NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message } },
      { status: 400 }
    ),
  });
}

function enqueueRateLimitBlock(status = 429) {
  enqueueRateLimitResponse({
    success: false,
    response: NextResponse.json(
      { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } },
      { status }
    ),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Review Pin API', () => {
  beforeAll(setupApiTest);
  afterAll(teardownApiTest);
  beforeEach(() => {
    resetHarnessState();
  });

  describe('POST /api/review/pin', () => {
    it('rejects unauthenticated requests', async () => {
      markUnauthenticated();

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/pin',
        body: { contentId: 'kana-1', contentType: 'kana' },
      });

      const response = await executePost(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(401);
    });

    it('pins an item successfully', async () => {
      await authenticateUser();

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/pin',
        headers: { Authorization: 'Bearer pin-token' },
        body: { contentId: 'kana-1', contentType: 'kana' },
      });

      const response = await executePost(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      expect(result.data.data.item.contentId).toBe('kana-1');
      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('returns 429 when rate limited', async () => {
      await authenticateUser();
      enqueueRateLimitBlock();

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/pin',
        headers: { Authorization: 'Bearer pin-token' },
        body: { contentId: 'kana-1', contentType: 'kana' },
      });

      const response = await executePost(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(429);
    });

    it('returns validation errors', async () => {
      await authenticateUser();
      enqueueValidationFailure('contentId is required');

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/pin',
        headers: { Authorization: 'Bearer pin-token' },
        body: {},
      });

      const response = await executePost(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(400);
    });

    it('returns 409 when item already pinned', async () => {
      await authenticateUser();
      mockPinManager.PinManager.prototype.pin.mockRejectedValueOnce(new Error('already pinned'));

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/pin',
        headers: { Authorization: 'Bearer pin-token' },
        body: { contentId: 'kana-1', contentType: 'kana' },
      });

      const response = await executePost(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(409);
    });

    it('returns 400 when pin limit exceeded', async () => {
      await authenticateUser();
      mockPinManager.PinManager.prototype.pin.mockRejectedValueOnce(new Error('limit reached'));

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/pin',
        headers: { Authorization: 'Bearer pin-token' },
        body: { contentId: 'kana-1', contentType: 'kana' },
      });

      const response = await executePost(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(400);
    });

    it('returns 500 for unexpected errors', async () => {
      await authenticateUser();
      mockPinManager.PinManager.prototype.pin.mockRejectedValueOnce(new Error('unexpected'));

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/pin',
        headers: { Authorization: 'Bearer pin-token' },
        body: { contentId: 'kana-1', contentType: 'kana' },
      });

      const response = await executePost(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(500);
    });
  });

  describe('DELETE /api/review/pin', () => {
    beforeEach(() => {
      setValidationDefault({ itemIds: ['kana-1', 'kana-2'] });
    });

    it('removes items and returns statistics', async () => {
      await authenticateUser();
      mockPinManager.PinManager.prototype.unpin.mockResolvedValueOnce(true);
      mockPinManager.PinManager.prototype.unpin.mockRejectedValueOnce(new Error('not pinned'));
      mockPinManager.PinManager.prototype.getStatistics.mockResolvedValueOnce({
        totalPinned: 3,
        activeItems: 3,
        scheduledItems: 0,
      });

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'DELETE',
        url: 'http://localhost:3000/api/review/pin',
        headers: { Authorization: 'Bearer pin-token' },
        body: { itemIds: ['kana-1', 'kana-2'] },
      });

      const response = await executeDelete(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      expect(result.data.data.unpinned).toBe(1);
      expect(result.data.data.failed).toBe(1);
      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('returns 429 when rate limited', async () => {
      await authenticateUser();
      enqueueRateLimitBlock();

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'DELETE',
        url: 'http://localhost:3000/api/review/pin',
        headers: { Authorization: 'Bearer pin-token' },
        body: { itemIds: ['kana-1'] },
      });

      const response = await executeDelete(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(429);
    });

    it('propagates validation errors', async () => {
      await authenticateUser();
      enqueueValidationFailure('itemIds must not be empty');

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'DELETE',
        url: 'http://localhost:3000/api/review/pin',
        headers: { Authorization: 'Bearer pin-token' },
        body: {},
      });

      const response = await executeDelete(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(400);
    });

    it('returns 500 on unexpected errors', async () => {
      await authenticateUser();
      mockPinManager.PinManager.prototype.unpin.mockResolvedValueOnce(true);
      mockPinManager.PinManager.prototype.getStatistics.mockRejectedValueOnce(
        new Error('stats failure')
      );

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'DELETE',
        url: 'http://localhost:3000/api/review/pin',
        headers: { Authorization: 'Bearer pin-token' },
        body: { itemIds: ['kana-1'] },
      });

      const response = await executeDelete(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(500);
    });
  });

  describe('CORS', () => {
    it('includes CORS headers', async () => {
      await authenticateUser();

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/pin',
        headers: {
          Authorization: 'Bearer cors-token',
          Origin: 'https://example.com',
        },
        body: { contentId: 'kana-1', contentType: 'kana' },
      });

      const response = await POST(request);

      expect(response.headers.get('access-control-allow-origin')).toBeDefined();
      expect(response.headers.get('access-control-allow-methods')).toBeDefined();
      expect(response.headers.get('access-control-allow-headers')).toBeDefined();
    });
  });
});
