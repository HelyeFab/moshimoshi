/**
 * Test Suite: Review API Middleware
 * Tests for authentication, rate limiting, validation, error handling, and CORS middleware
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Import middleware functions
import { 
  authenticate, 
  requireAuth, 
  requireAdmin, 
  requirePremium, 
  isPremiumUser 
} from '../auth';
import { 
  rateLimit, 
  rateLimitByUser, 
  clearRateLimit, 
  createRateLimiter,
} from '../rateLimit';
import { 
  validateBody, 
  validateQuery, 
  validateParams,
  commonSchemas,
  pinSchemas,
  sessionSchemas,
  statsSchemas,
} from '../validation';
import { withCors } from '../cors';
import { 
  handleApiError, 
  successResponse, 
  ApiError, 
  ErrorCodes 
} from '../errors';

import {
  ApiRouteTestHelper,
  setupApiTest,
  teardownApiTest,
  resetApiMocks,
} from '@/lib/review-engine/__tests__/test-utils/api-test-setup';

// Mock dependencies
jest.mock('@/lib/auth/session', () => ({
  validateSession: jest.fn(),
}));
jest.mock('@/lib/redis/client');
jest.mock('@upstash/ratelimit');

import { validateSession } from '@/lib/auth/session';
import { Ratelimit } from '@upstash/ratelimit';

const mockValidateSession = validateSession as jest.MockedFunction<typeof validateSession>;
const mockRatelimit = Ratelimit as jest.MockedClass<typeof Ratelimit>;

describe('Review API Middleware', () => {
  beforeAll(setupApiTest);
  afterAll(teardownApiTest);
  beforeEach(resetApiMocks);

  describe('Authentication Middleware', () => {
    describe('authenticate()', () => {
      it('should authenticate valid session', async () => {
        mockValidateSession.mockResolvedValue({
          valid: true,
          user: {
            uid: 'test-user',
            email: 'test@example.com',
            tier: 'free',
          },
        });

        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'GET',
          url: 'http://localhost:3000/api/test',
          headers: {
            Authorization: 'Bearer valid-token',
            'User-Agent': 'Test Browser',
            'X-Forwarded-For': '127.0.0.1',
          },
        });

        const result = await authenticate(request);

        expect(result.user).toBeDefined();
        expect(result.user!.uid).toBe('test-user');
        expect(result.response).toBeUndefined();

        expect(mockValidateSession).toHaveBeenCalledWith(
          request,
          {
            userAgent: 'Test Browser',
            ipAddress: '127.0.0.1',
          }
        );
      });

      });

      it('should reject invalid session', async () => {
        mockValidateSession.mockResolvedValue({
          valid: false,
          user: null,
        });

        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'GET',
          url: 'http://localhost:3000/api/test',
          headers: { Authorization: 'Bearer invalid-token' },
        });

        const result = await authenticate(request);

        expect(result.user).toBeNull();
        expect(result.response).toBeDefined();
        expect(result.response!.status).toBe(401);

        const responseData = await result.response!.json();
        expect(responseData.error).toBe('Unauthorized');
        expect(responseData.code).toBe('AUTH_REQUIRED');
      });

      });

      it('should handle authentication errors', async () => {
        mockValidateSession.mockRejectedValue(new Error('Session validation failed'));

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'GET',
          url: 'http://localhost:3000/api/test',
        });

        const result = await authenticate(request);

        expect(result.user).toBeNull();
        expect(result.response).toBeDefined();
        expect(result.response!.status).toBe(401);

        const responseData = await result.response!.json();
        expect(responseData.error).toBe('Authentication failed');
        expect(responseData.code).toBe('AUTH_ERROR');

        expect(consoleSpy).toHaveBeenCalledWith('Authentication error:', expect.any(Error));
        consoleSpy.mockRestore();
      });

      it('should extract IP from different headers', async () => {
        mockValidateSession.mockResolvedValue({ valid: true, user: { uid: 'test' } });

        const requests = [
          { headers: { 'X-Forwarded-For': '192.168.1.1' }, expectedIP: '192.168.1.1' },
          { headers: { 'X-Real-IP': '10.0.0.1' }, expectedIP: '10.0.0.1' },
          { headers: {}, expectedIP: undefined },
        ];

        for (const { headers, expectedIP } of requests) {
          const request = ApiRouteTestHelper.createMockNextRequest({
            method: 'GET',
            url: 'http://localhost:3000/api/test',
            headers,
          });

          await authenticate(request);

          expect(mockValidateSession).toHaveBeenCalledWith(
            request,
            {
              userAgent: undefined,
              ipAddress: expectedIP,
            }
          );

          mockValidateSession.mockClear();
        }
      });
    });

    describe('requireAuth()', () => {
      it('should return user for valid authentication', async () => {
        mockValidateSession.mockResolvedValue({
          valid: true,
          user: { uid: 'test-user', email: 'test@example.com' },
        });

        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'GET',
          url: 'http://localhost:3000/api/test',
          headers: { Authorization: 'Bearer valid-token' },
        });

        const result = await requireAuth(request);

        expect(result.user).toBeDefined();
        expect(result.user.uid).toBe('test-user');
        expect(result.response).toBeUndefined();
      });

      });

      it('should return error response for invalid authentication', async () => {
        mockValidateSession.mockResolvedValue({
          valid: false,
          user: null,
        });

        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'GET',
          url: 'http://localhost:3000/api/test',
        });

        const result = await requireAuth(request);

        expect(result.user).toBeNull();
        expect(result.response).toBeDefined();
        expect(result.response!.status).toBe(401);
      });

    describe('requireAdmin()', () => {
      it('should allow admin users', async () => {
        mockValidateSession.mockResolvedValue({
          valid: true,
          user: { 
            uid: 'admin-user', 
            email: 'admin@example.com',
            admin: true 
          },
        });

        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'GET',
          url: 'http://localhost:3000/api/admin/test',
          headers: { Authorization: 'Bearer admin-token' },
        });

        const result = await requireAdmin(request);

        expect(result.user).toBeDefined();
        expect(result.user.admin).toBe(true);
        expect(result.response).toBeUndefined();
      });

      });

      it('should reject non-admin users', async () => {
        mockValidateSession.mockResolvedValue({
          valid: true,
          user: { 
            uid: 'regular-user', 
            email: 'user@example.com',
            admin: false 
          },
        });

        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'GET',
          url: 'http://localhost:3000/api/admin/test',
          headers: { Authorization: 'Bearer user-token' },
        });

        const result = await requireAdmin(request);

        expect(result.user).toBeNull();
        expect(result.response).toBeDefined();
        expect(result.response!.status).toBe(403);

        const responseData = await result.response!.json();
        expect(responseData.error).toBe('Admin access required');
        expect(responseData.code).toBe('ADMIN_REQUIRED');
      });

    describe('requirePremium()', () => {
      it('should allow premium users', async () => {
        mockValidateSession.mockResolvedValue({
          valid: true,
          user: { 
            uid: 'premium-user', 
            email: 'premium@example.com',
            tier: 'premium_monthly'
          },
        });

        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'GET',
          url: 'http://localhost:3000/api/premium/test',
          headers: { Authorization: 'Bearer premium-token' },
        });

        const result = await requirePremium(request);

        expect(result.user).toBeDefined();
        expect(result.user.tier).toBe('premium_monthly');
        expect(result.response).toBeUndefined();
      });

      });

      it('should reject non-premium users', async () => {
        mockValidateSession.mockResolvedValue({
          valid: true,
          user: { 
            uid: 'free-user', 
            email: 'free@example.com',
            tier: 'free'
          },
        });

        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'GET',
          url: 'http://localhost:3000/api/premium/test',
          headers: { Authorization: 'Bearer free-token' },
        });

        const result = await requirePremium(request);

        expect(result.user).toBeNull();
        expect(result.response).toBeDefined();
        expect(result.response!.status).toBe(403);

        const responseData = await result.response!.json();
        expect(responseData.error).toBe('Premium subscription required');
        expect(responseData.code).toBe('PREMIUM_REQUIRED');
        expect(responseData.upgradeUrl).toBe('/pricing');
      });

    describe('isPremiumUser()', () => {
      it('should identify premium users correctly', () => {
        expect(isPremiumUser({ tier: 'premium_monthly' } as any)).toBe(true);
        expect(isPremiumUser({ tier: 'premium_yearly' } as any)).toBe(true);
        expect(isPremiumUser({ tier: 'free' } as any)).toBe(false);
        expect(isPremiumUser({ tier: 'trial' } as any)).toBe(false);
      });
    });

  describe('Rate Limiting Middleware', () => {
    describe('createRateLimiter()', () => {
      it('should create rate limiter with correct config', () => {
        mockRatelimit.slidingWindow = jest.fn().mockReturnValue('sliding-window-config');

        createRateLimiter('pin');

        expect(mockRatelimit).toHaveBeenCalledWith({
          redis: expect.any(Object),
          limiter: 'sliding-window-config',
          analytics: true,
          prefix: 'review:pin',
        });

        expect(mockRatelimit.slidingWindow).toHaveBeenCalledWith(100, '1m');
      });

      it('should use default config for unknown endpoint', () => {
        mockRatelimit.slidingWindow = jest.fn().mockReturnValue('default-config');

        createRateLimiter('unknown' as any);

        expect(mockRatelimit.slidingWindow).toHaveBeenCalledWith(60, '1m');
      });
    });

    describe('rateLimit()', () => {
      it('should allow requests within rate limit', async () => {
        const mockLimiter = {
          limit: jest.fn().mockResolvedValue({
            success: true,
            limit: 100,
            reset: Date.now() + 60000,
            remaining: 99,
          }),
        };
        mockRatelimit.mockImplementation(() => mockLimiter);

        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'GET',
          url: 'http://localhost:3000/api/test',
          headers: { 'X-User-ID': 'test-user' },
        });

        const result = await rateLimit(request, 'pin');

        expect(result.success).toBe(true);
        expect(result.response).toBeUndefined();
        expect(mockLimiter.limit).toHaveBeenCalledWith('test-user');
      });

      it('should block requests exceeding rate limit', async () => {
        const resetTime = Date.now() + 60000;
        const mockLimiter = {
          limit: jest.fn().mockResolvedValue({
            success: false,
            limit: 100,
            reset: resetTime,
            remaining: 0,
          }),
        };
        mockRatelimit.mockImplementation(() => mockLimiter);

        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'GET',
          url: 'http://localhost:3000/api/test',
          headers: { 'X-Forwarded-For': '192.168.1.1' },
        });

        const result = await rateLimit(request, 'pin');

        expect(result.success).toBe(false);
        expect(result.response).toBeDefined();
        expect(result.response!.status).toBe(429);

        const responseData = await result.response!.json();
        expect(responseData.error).toBe('Too many requests');
        expect(responseData.code).toBe('RATE_LIMIT_EXCEEDED');
        expect(responseData.retryAfter).toBeGreaterThan(0);

        const headers = Object.fromEntries(result.response!.headers.entries());
        expect(headers['x-ratelimit-limit']).toBe('100');
        expect(headers['x-ratelimit-remaining']).toBe('0');
        expect(headers['retry-after']).toBeDefined();
      });

      it('should use fallback identifier when none provided', async () => {
        const mockLimiter = {
          limit: jest.fn().mockResolvedValue({
            success: true,
            limit: 60,
            reset: Date.now() + 60000,
            remaining: 59,
          }),
        };
        mockRatelimit.mockImplementation(() => mockLimiter);

        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'GET',
          url: 'http://localhost:3000/api/test',
        });

        const result = await rateLimit(request);

        expect(result.success).toBe(true);
        expect(mockLimiter.limit).toHaveBeenCalledWith('anonymous');
      });

      it('should handle rate limiting errors gracefully', async () => {
        const mockLimiter = {
          limit: jest.fn().mockRejectedValue(new Error('Redis connection failed')),
        };
        mockRatelimit.mockImplementation(() => mockLimiter);

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'GET',
          url: 'http://localhost:3000/api/test',
        });

        const result = await rateLimit(request, 'pin');

        expect(result.success).toBe(true); // Should not fail the request
        expect(consoleSpy).toHaveBeenCalledWith('Rate limiting error:', expect.any(Error));
        
        consoleSpy.mockRestore();
      });
    });

    describe('rateLimitByUser()', () => {
      it('should apply premium multiplier for premium users', async () => {
        mockRatelimit.slidingWindow = jest.fn().mockReturnValue('premium-config');
        const mockLimiter = {
          limit: jest.fn().mockResolvedValue({
            success: true,
            limit: 200, // 100 * 2
            reset: Date.now() + 60000,
            remaining: 199,
          }),
        };
        mockRatelimit.mockImplementation(() => mockLimiter);

        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'GET',
          url: 'http://localhost:3000/api/test',
          headers: { 'X-User-Tier': 'premium_monthly' },
        });

        const result = await rateLimitByUser(request, 'premium-user', 'pin', 2);

        expect(result.success).toBe(true);
        expect(mockRatelimit.slidingWindow).toHaveBeenCalledWith(200, '1m');
        expect(mockLimiter.limit).toHaveBeenCalledWith('premium-user');
      });

      it('should use regular rate limiting for non-premium users', async () => {
        const mockLimiter = {
          limit: jest.fn().mockResolvedValue({
            success: true,
            limit: 100,
            reset: Date.now() + 60000,
            remaining: 99,
          }),
        };
        mockRatelimit.mockImplementation(() => mockLimiter);

        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'GET',
          url: 'http://localhost:3000/api/test',
          headers: { 'X-User-Tier': 'free' },
        });

        const result = await rateLimitByUser(request, 'free-user', 'pin');

        expect(result.success).toBe(true);
        expect(mockLimiter.limit).toHaveBeenCalledWith('free-user');
      });

      it('should block premium users when they exceed premium limits', async () => {
        const resetTime = Date.now() + 60000;
        const mockLimiter = {
          limit: jest.fn().mockResolvedValue({
            success: false,
            limit: 200,
            reset: resetTime,
            remaining: 0,
          }),
        };
        mockRatelimit.mockImplementation(() => mockLimiter);

        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'GET',
          url: 'http://localhost:3000/api/test',
          headers: { 'X-User-Tier': 'premium_yearly' },
        });

        const result = await rateLimitByUser(request, 'premium-user', 'pin', 2);

        expect(result.success).toBe(false);
        expect(result.response).toBeDefined();
        expect(result.response!.status).toBe(429);

        const responseData = await result.response!.json();
        expect(responseData.premium).toBe(true);
      });
    });

    describe('clearRateLimit()', () => {
      it('should log rate limit clearing', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        await clearRateLimit('test-user', 'pin');

        expect(consoleSpy).toHaveBeenCalledWith('Clearing rate limit for review:pin:test-user');
        
        consoleSpy.mockRestore();
      });

      it('should handle errors gracefully', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        
        // Mock an error scenario
        jest.spyOn(console, 'log').mockImplementation(() => {
          throw new Error('Logging failed');
        });

        await clearRateLimit('test-user');

        expect(consoleSpy).toHaveBeenCalledWith('Error clearing rate limit:', expect.any(Error));
        
        consoleSpy.mockRestore();
      });
    });
  });

  describe('Validation Middleware', () => {
    describe('validateBody()', () => {
      it('should validate correct request body', async () => {
        const schema = z.object({
          name: z.string(),
          age: z.number(),
        });

        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'POST',
          url: 'http://localhost:3000/api/test',
          body: { name: 'John', age: 30 },
        });

        const result = await validateBody(request, schema);

        expect(result.data).toEqual({ name: 'John', age: 30 });
        expect(result.response).toBeUndefined();
      });

      it('should reject invalid request body', async () => {
        const schema = z.object({
          name: z.string(),
          age: z.number(),
        });

        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'POST',
          url: 'http://localhost:3000/api/test',
          body: { name: 'John', age: 'thirty' }, // Invalid age
        });

        const result = await validateBody(request, schema);

        expect(result.data).toBeNull();
        expect(result.response).toBeDefined();
        expect(result.response!.status).toBe(400);

        const responseData = await result.response!.json();
        expect(responseData.error).toBe('Validation error');
        expect(responseData.code).toBe('VALIDATION_ERROR');
        expect(responseData.details).toHaveLength(1);
        expect(responseData.details[0].path).toBe('age');
        expect(responseData.details[0].message).toBe('Expected number, received string');
      });

      it('should handle invalid JSON', async () => {
        const schema = z.object({
          name: z.string(),
        });

        // Mock request with invalid JSON
        const request = {
          json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
        } as any;

        const result = await validateBody(request, schema);

        expect(result.data).toBeNull();
        expect(result.response).toBeDefined();
        expect(result.response!.status).toBe(400);

        const responseData = await result.response!.json();
        expect(responseData.error).toBe('Invalid request body');
        expect(responseData.code).toBe('INVALID_BODY');
      });
    });

    describe('validateQuery()', () => {
      it('should validate correct query parameters', () => {
        const schema = z.object({
          limit: z.number().default(20),
          type: z.string().optional(),
        });

        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'GET',
          url: 'http://localhost:3000/api/test?limit=10&type=daily',
        });

        const result = validateQuery(request, schema);

        expect(result.data).toEqual({ limit: 10, type: 'daily' });
        expect(result.response).toBeUndefined();
      });

      it('should handle missing parameters with defaults', () => {
        const schema = z.object({
          limit: z.number().default(20),
          type: z.string().optional(),
        });

        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'GET',
          url: 'http://localhost:3000/api/test',
        });

        const result = validateQuery(request, schema);

        expect(result.data).toEqual({ limit: 20 });
        expect(result.response).toBeUndefined();
      });

      it('should handle array parameters', () => {
        const schema = z.object({
          ids: z.array(z.string()),
        });

        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'GET',
          url: 'http://localhost:3000/api/test?ids=1&ids=2&ids=3',
        });

        const result = validateQuery(request, schema);

        expect(result.data).toEqual({ ids: ['1', '2', '3'] });
        expect(result.response).toBeUndefined();
      });

      it('should reject invalid query parameters', () => {
        const schema = z.object({
          limit: z.number(),
          required: z.string(),
        });

        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'GET',
          url: 'http://localhost:3000/api/test?limit=invalid',
        });

        const result = validateQuery(request, schema);

        expect(result.data).toBeNull();
        expect(result.response).toBeDefined();
        expect(result.response!.status).toBe(400);

        const responseData = result.response!.json();
        expect(responseData.error).toBe('Invalid query parameters');
        expect(responseData.code).toBe('INVALID_QUERY');
      });
    });

    describe('validateParams()', () => {
      it('should validate correct path parameters', () => {
        const schema = z.object({
          id: z.string(),
          sessionId: z.string().uuid(),
        });

        const params = {
          id: 'test-id',
          sessionId: '123e4567-e89b-12d3-a456-426614174000',
        };

        const result = validateParams(params, schema);

        expect(result.data).toEqual(params);
        expect(result.response).toBeUndefined();
      });

      it('should reject invalid path parameters', () => {
        const schema = z.object({
          id: z.string().min(1),
          count: z.number(),
        });

        const params = {
          id: '', // Invalid empty string
          count: 'not-a-number',
        };

        const result = validateParams(params, schema);

        expect(result.data).toBeNull();
        expect(result.response).toBeDefined();
        expect(result.response!.status).toBe(400);

        const responseData = result.response!.json();
        expect(responseData.error).toBe('Invalid path parameters');
        expect(responseData.code).toBe('INVALID_PARAMS');
      });
    });

    describe('Schema Tests', () => {
      describe('pinSchemas', () => {
        it('should validate pin single schema', () => {
          const valid = {
            contentId: 'kana-a',
            contentType: 'kana',
            priority: 'high',
            tags: ['hiragana'],
            setId: 'basic-set',
          };

          expect(() => pinSchemas.pinSingle.parse(valid)).not.toThrow();

          const invalid = {
            contentId: '',
            contentType: 'invalid-type',
            priority: 'invalid-priority',
          };

          expect(() => pinSchemas.pinSingle.parse(invalid)).toThrow();
        });

        it('should validate pin bulk schema', () => {
          const valid = {
            items: [
              { contentId: 'kana-a', contentType: 'kana' },
              { contentId: 'kanji-1', contentType: 'kanji' },
            ],
            tags: ['basic'],
            dailyLimit: 10,
          };

          expect(() => pinSchemas.pinBulk.parse(valid)).not.toThrow();

          const invalid = {
            items: [], // Empty array
          };

          expect(() => pinSchemas.pinBulk.parse(invalid)).toThrow();
        });

        it('should validate unpin schema', () => {
          const valid = {
            itemIds: ['item1', 'item2', 'item3'],
          };

          expect(() => pinSchemas.unpin.parse(valid)).not.toThrow();

          const invalid = {
            itemIds: [], // Empty array
          };

          expect(() => pinSchemas.unpin.parse(invalid)).toThrow();
        });
      });

      describe('sessionSchemas', () => {
        it('should validate start session schema', () => {
          const valid = {
            type: 'daily',
            itemIds: ['item1', 'item2'],
            settings: {
              shuffleOrder: true,
              maxItems: 20,
              showTimer: false,
            },
          };

          expect(() => sessionSchemas.startSession.parse(valid)).not.toThrow();

          const invalid = {
            type: 'invalid-type',
            settings: {
              maxItems: -1, // Invalid negative number
            },
          };

          expect(() => sessionSchemas.startSession.parse(invalid)).toThrow();
        });

        it('should validate submit answer schema', () => {
          const valid = {
            itemId: 'test-item',
            correct: true,
            responseTime: 1500,
            confidence: 4,
            answerType: 'recognition',
            userAnswer: 'a',
          };

          expect(() => sessionSchemas.submitAnswer.parse(valid)).not.toThrow();

          const invalid = {
            itemId: '',
            correct: 'yes', // Should be boolean
            responseTime: -100, // Negative time
            confidence: 6, // Out of range
          };

          expect(() => sessionSchemas.submitAnswer.parse(invalid)).toThrow();
        });
      });

      describe('statsSchemas', () => {
        it('should validate get stats schema', () => {
          const valid = {
            period: 'month',
            detailed: true,
            contentType: 'kana',
          };

          expect(() => statsSchemas.getStats.parse(valid)).not.toThrow();

          const invalid = {
            period: 'invalid-period',
            detailed: 'yes', // Should be boolean
          };

          expect(() => statsSchemas.getStats.parse(invalid)).toThrow();
        });

        it('should validate heatmap schema', () => {
          const valid = {
            days: 30,
          };

          expect(() => statsSchemas.heatmap.parse(valid)).not.toThrow();

          const invalid = {
            days: 0, // Below minimum
          };

          expect(() => statsSchemas.heatmap.parse(invalid)).toThrow();
        });
      });

      describe('commonSchemas', () => {
        it('should validate content types', () => {
          const validTypes = ['kana', 'kanji', 'vocabulary', 'sentence'];
          validTypes.forEach(type => {
            expect(() => commonSchemas.contentType.parse(type)).not.toThrow();
          });

          expect(() => commonSchemas.contentType.parse('invalid')).toThrow();
        });

        it('should validate date strings', () => {
          const validDates = ['2024-01-01', '2024-12-31T23:59:59Z'];
          validDates.forEach(date => {
            expect(() => commonSchemas.dateString.parse(date)).not.toThrow();
          });

          expect(() => commonSchemas.dateString.parse('invalid-date')).toThrow();
        });

        it('should validate pagination', () => {
          const valid = { limit: 50, offset: 100 };
          expect(() => commonSchemas.pagination.parse(valid)).not.toThrow();

          const invalid = { limit: 0, offset: -1 };
          expect(() => commonSchemas.pagination.parse(invalid)).toThrow();
        });
      });
    });
  });

  describe('Error Handling Middleware', () => {
    describe('ApiError', () => {
      it('should create API error with all properties', () => {
        const error = new ApiError('Test error', ErrorCodes.VALIDATION_ERROR, 400);
        
        expect(error.message).toBe('Test error');
        expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
        expect(error.statusCode).toBe(400);
        expect(error.name).toBe('ApiError');
      });

      it('should create API error with default status code', () => {
        const error = new ApiError('Test error', ErrorCodes.INTERNAL_ERROR);
        
        expect(error.statusCode).toBe(500);
      });
    });

    describe('handleApiError()', () => {
      it('should handle ApiError properly', () => {
        const apiError = new ApiError('Custom error', ErrorCodes.NOT_FOUND, 404);
        
        const response = handleApiError(apiError);
        
        expect(response.status).toBe(404);
        
        const responseData = response.json();
        expect(responseData.success).toBe(false);
        expect(responseData.error.message).toBe('Custom error');
        expect(responseData.error.code).toBe(ErrorCodes.NOT_FOUND);
      });

      it('should handle generic errors', () => {
        const genericError = new Error('Something went wrong');
        
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        
        const response = handleApiError(genericError);
        
        expect(response.status).toBe(500);
        
        const responseData = response.json();
        expect(responseData.success).toBe(false);
        expect(responseData.error.message).toBe('Internal server error');
        expect(responseData.error.code).toBe(ErrorCodes.INTERNAL_ERROR);
        
        expect(consoleSpy).toHaveBeenCalledWith('API Error:', genericError);
        
        consoleSpy.mockRestore();
      });

      it('should handle unknown error types', () => {
        const unknownError = 'string error';
        
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        
        const response = handleApiError(unknownError);
        
        expect(response.status).toBe(500);
        
        const responseData = response.json();
        expect(responseData.success).toBe(false);
        expect(responseData.error.message).toBe('Internal server error');
        
        consoleSpy.mockRestore();
      });
    });

    describe('successResponse()', () => {
      it('should create success response with data', () => {
        const data = { items: [1, 2, 3] };
        const meta = { message: 'Success', count: 3 };
        
        const response = successResponse(data, meta);
        
        expect(response.status).toBe(200);
        
        const responseData = response.json();
        expect(responseData.success).toBe(true);
        expect(responseData.data).toEqual(data);
        expect(responseData.meta).toEqual(meta);
      });

      it('should create success response without meta', () => {
        const data = { value: 42 };
        
        const response = successResponse(data);
        
        const responseData = response.json();
        expect(responseData.success).toBe(true);
        expect(responseData.data).toEqual(data);
        expect(responseData.meta).toEqual({});
      });

      it('should create success response with custom status', () => {
        const data = { created: true };
        
        const response = successResponse(data, {}, 201);
        
        expect(response.status).toBe(201);
      });
    });
  });

  describe('CORS Middleware', () => {
    it('should add CORS headers to response', async () => {
      const mockHandler = jest.fn().mockImplementation(async () => {
        return new NextResponse(JSON.stringify({ test: true }), { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      });

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/test',
        headers: { Origin: 'https://example.com' },
      });

      const response = await withCors(request, mockHandler);

      // Check CORS headers
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeDefined();
      expect(response.headers.get('Access-Control-Allow-Headers')).toBeDefined();
      expect(response.headers.get('Access-Control-Max-Age')).toBeDefined();
      
      expect(mockHandler).toHaveBeenCalledWith();
    });

    it('should handle preflight OPTIONS requests', async () => {
      const mockHandler = jest.fn();

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'OPTIONS',
        url: 'http://localhost:3000/api/test',
        headers: { Origin: 'https://example.com' },
      });

      const response = await withCors(request, mockHandler);

      expect(response.status).toBe(204);
      expect(mockHandler).not.toHaveBeenCalled();
      
      // Check CORS headers are present on preflight
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeDefined();
    });

    it('should handle handler errors', async () => {
      const mockHandler = jest.fn().mockRejectedValue(new Error('Handler error'));

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/test',
      });

      const response = await withCors(request, mockHandler);

      expect(response.status).toBe(500);
      expect(mockHandler).toHaveBeenCalledWith();
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete middleware chain', async () => {
      // Mock authentication
      mockValidateSession.mockResolvedValue({
        valid: true,
        user: { uid: 'test-user', tier: 'free' },
      });

      // Mock rate limiting
      const mockRatelimit = Ratelimit as jest.MockedClass<typeof Ratelimit>;
      const mockLimiter = {
        limit: jest.fn().mockResolvedValue({
          success: true,
          limit: 100,
          reset: Date.now() + 60000,
          remaining: 99,
        }),
      };
      mockRatelimit.mockImplementation(() => mockLimiter);

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/pin',
        headers: { 
          Authorization: 'Bearer valid-token',
          Origin: 'https://example.com'
        },
        body: {
          contentId: 'kana-a',
          contentType: 'kana',
          priority: 'normal',
        },
      });

      // Simulate a complete API endpoint using all middleware
      const handler = async (req: NextRequest) => {
        // 1. Authentication
        const { user, response: authError } = await requireAuth(req);
        if (authError) return authError;

        // 2. Rate limiting
        const { success: rateLimitOk, response: rateLimitError } = await rateLimit(
          req,
          'pin',
          user.uid
        );
        if (rateLimitError) return rateLimitError;

        // 3. Validation
        const { data: body, response: validationError } = await validateBody(
          req,
          pinSchemas.pinSingle
        );
        if (validationError) return validationError;

        // 4. Business logic (mocked)
        return successResponse({
          item: {
            id: 'pinned-item',
            contentId: body!.contentId,
            contentType: body!.contentType,
            priority: body!.priority || 'normal',
          }
        }, {
          message: 'Item pinned successfully'
        });
      };

      const response = await withCors(request, handler);
      const result = await ApiRouteTestHelper.parseResponse(response);

      // Verify successful response
      expect(result.status).toBe(200);
      expect(result.data.success).toBe(true);
      expect(result.data.data.item.contentId).toBe('kana-a');
      expect(result.data.meta.message).toBe('Item pinned successfully');

      // Verify CORS headers
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();

      // Verify middleware was called
      expect(mockValidateSession).toHaveBeenCalled();
      expect(mockLimiter.limit).toHaveBeenCalled();
    });

    it('should handle middleware failure chain', async () => {
      // Mock failed authentication
      mockValidateSession.mockResolvedValue({
        valid: false,
        user: null,
      });

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/pin',
        body: { contentId: 'kana-a', contentType: 'kana' },
      });

      const handler = async (req: NextRequest) => {
        const { user, response: authError } = await requireAuth(req);
        if (authError) return authError;

        // Should not reach here
        return successResponse({ success: true });
      };

      const response = await withCors(request, handler);
      const result = await ApiRouteTestHelper.parseResponse(response);

      // Verify authentication failure
      expect(result.status).toBe(401);
      expect(result.data.code).toBe('AUTH_REQUIRED');

      // Verify CORS headers are still present on error
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();
    });
  });
});
