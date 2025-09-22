/**
 * Test Suite: Session Start API
 * Tests for POST /api/review/session/start
 */

import { POST } from '../route';
import {
  ApiRouteTestHelper,
  ValidationTestHelper,
  SessionTestHelper,
  PerformanceTestHelper,
  setupApiTest,
  teardownApiTest,
  resetApiMocks,
} from '@/lib/review-engine/__tests__/test-utils/api-test-setup';

// Mock dependencies
jest.mock('@/lib/review-engine/session/manager');
jest.mock('@/lib/review-engine/session/storage');
jest.mock('@/lib/review-engine/session/analytics.service');
jest.mock('@/lib/review-engine/pinning/pin-manager');
jest.mock('@/lib/review-engine/queue/queue-generator');
jest.mock('@/lib/auth/session');
jest.mock('@/lib/redis/client');

// Import mocked modules
import * as sessionManagerModule from '@/lib/review-engine/session/manager';
import * as pinManagerModule from '@/lib/review-engine/pinning/pin-manager';
import * as queueGeneratorModule from '@/lib/review-engine/queue/queue-generator';
import * as redisModule from '@/lib/redis/client';

const mockSessionManager = sessionManagerModule as jest.Mocked<typeof sessionManagerModule>;
const mockPinManager = pinManagerModule as jest.Mocked<typeof pinManagerModule>;
const mockQueueGenerator = queueGeneratorModule as jest.Mocked<typeof queueGeneratorModule>;
const mockRedis = (redisModule as any).redis;

describe('Session Start API', () => {
  beforeAll(setupApiTest);
  afterAll(teardownApiTest);
  beforeEach(resetApiMocks);

  describe('Authentication Tests', () => {
    it('should reject unauthenticated requests', async () => {
      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/session/start',
        body: { type: 'daily' },
      });

      const response = await POST(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      ApiRouteTestHelper.expectErrorResponse(result, 401, 'AUTH_REQUIRED');
    });

    it('should accept authenticated free users', async () => {
      const user = await ApiRouteTestHelper.mockAuthUser('free-user');
      
      // Mock no active session
      await ApiRouteTestHelper.mockRedisData({});
      
      // Mock pinned items
      mockPinManager.PinManager.prototype.getPinnedItems.mockResolvedValue([
        {
          id: 'item1',
          contentType: 'kana',
          primaryDisplay: 'あ',
          primaryAnswer: 'a',
          difficulty: 0.5,
          tags: [],
          status: 'new',
        },
      ]);

      // Mock queue generator
      mockQueueGenerator.QueueGenerator.prototype.generateQueue.mockResolvedValue({
        items: [
          {
            id: 'item1',
            contentType: 'kana',
            primaryDisplay: 'あ',
            primaryAnswer: 'a',
            difficulty: 0.5,
            tags: [],
          },
        ],
      });

      // Mock session manager
      mockSessionManager.SessionManager.prototype.startSession.mockResolvedValue({
        id: 'session123',
        status: 'active',
        startedAt: new Date(),
        currentIndex: 0,
        items: [
          {
            content: {
              id: 'item1',
              contentType: 'kana',
            },
            status: 'pending',
          },
        ],
        mode: 'recognition',
        source: 'daily',
      });

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
      expect(result.data.data.session.id).toBe('session123');
    });

    it('should accept authenticated premium users', async () => {
      const user = ApiRouteTestHelper.mockPremiumUser('premium-user');
      
      // Mock no active session
      await ApiRouteTestHelper.mockRedisData({});
      
      // Mock dependencies similar to free user test
      mockPinManager.PinManager.prototype.getPinnedItems.mockResolvedValue([
        {
          id: 'item1',
          contentType: 'kana',
          primaryDisplay: 'あ',
          primaryAnswer: 'a',
          difficulty: 0.5,
          tags: [],
          status: 'new',
        },
      ]);

      mockQueueGenerator.QueueGenerator.prototype.generateQueue.mockResolvedValue({
        items: [
          {
            id: 'item1',
            contentType: 'kana',
            primaryDisplay: 'あ',
            primaryAnswer: 'a',
            difficulty: 0.5,
            tags: [],
          },
        ],
      });

      mockSessionManager.SessionManager.prototype.startSession.mockResolvedValue({
        id: 'session123',
        status: 'active',
        startedAt: new Date(),
        currentIndex: 0,
        items: [
          {
            content: {
              id: 'item1',
              contentType: 'kana',
            },
            status: 'pending',
          },
        ],
        mode: 'recognition',
        source: 'daily',
      });

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
      expect(result.data.data.session.id).toBe('session123');
    });
  });

  describe('Rate Limiting Tests', () => {
    beforeEach(() => {
      await ApiRouteTestHelper.mockAuthUser('test-user');
      await ApiRouteTestHelper.mockRedisData({});
    });

    it('should enforce rate limits for free users', async () => {
      let requestCount = 0;
      
      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes('rateLimit:sessionStart:test-user')) {
          return Promise.resolve(requestCount.toString());
        }
        return Promise.resolve(null);
      });

      mockRedis.incr.mockImplementation(() => {
        requestCount++;
        return Promise.resolve(requestCount);
      });

      const makeRequest = async () => {
        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'POST',
          url: 'http://localhost:3000/api/review/session/start',
          headers: { Authorization: 'Bearer fake-token' },
          body: { type: 'daily' },
        });
        return POST(request).then(ApiRouteTestHelper.parseResponse);
      };

      // Test rate limit for free users (1 request per minute)
      await RateLimitTestHelper.testRateLimit(makeRequest, 1, 60000);
    });

    it('should allow higher rate limits for premium users', async () => {
      ApiRouteTestHelper.mockPremiumUser('premium-user');
      
      let requestCount = 0;
      
      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes('rateLimit:sessionStart:premium-user')) {
          return Promise.resolve(requestCount.toString());
        }
        return Promise.resolve(null);
      });

      mockRedis.incr.mockImplementation(() => {
        requestCount++;
        return Promise.resolve(requestCount);
      });

      const makeRequest = async () => {
        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'POST',
          url: 'http://localhost:3000/api/review/session/start',
          headers: { Authorization: 'Bearer fake-token' },
          body: { type: 'daily' },
        });
        return POST(request).then(ApiRouteTestHelper.parseResponse);
      };

      // Premium users can make 2 requests per minute
      const firstResponse = await makeRequest();
      expect(firstResponse.status).toBe(200);
      
      const secondResponse = await makeRequest();
      expect(secondResponse.status).toBe(200);
      
      // Third request should be rate limited
      const thirdResponse = await makeRequest();
      expect(thirdResponse.status).toBe(429);
    });
  });

  describe('Input Validation Tests', () => {
    beforeEach(() => {
      await ApiRouteTestHelper.mockAuthUser('test-user');
      await ApiRouteTestHelper.mockRedisData({});
    });

    it('should validate session type', async () => {
      const makeRequest = async (body: any) => {
        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'POST',
          url: 'http://localhost:3000/api/review/session/start',
          headers: { Authorization: 'Bearer fake-token' },
          body,
        });
        return POST(request).then(ApiRouteTestHelper.parseResponse);
      };

      const invalidInputs = [
        { input: { type: 'invalid' }, expectedError: 'Invalid session type' },
        { input: { type: 123 }, expectedError: 'type must be a string' },
        { input: { type: null }, expectedError: 'type is required' },
      ];

      await ValidationTestHelper.testInvalidInputs(makeRequest, invalidInputs);
    });

    it('should validate session settings', async () => {
      const makeRequest = async (body: any) => {
        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'POST',
          url: 'http://localhost:3000/api/review/session/start',
          headers: { Authorization: 'Bearer fake-token' },
          body,
        });
        return POST(request).then(ApiRouteTestHelper.parseResponse);
      };

      const invalidInputs = [
        { 
          input: { type: 'daily', settings: { maxItems: 'invalid' } }, 
          expectedError: 'maxItems must be a number' 
        },
        { 
          input: { type: 'daily', settings: { maxItems: -1 } }, 
          expectedError: 'maxItems must be positive' 
        },
        { 
          input: { type: 'daily', settings: { shuffleOrder: 'yes' } }, 
          expectedError: 'shuffleOrder must be a boolean' 
        },
      ];

      await ValidationTestHelper.testInvalidInputs(makeRequest, invalidInputs);
    });

    it('should validate itemIds when provided', async () => {
      const makeRequest = async (body: any) => {
        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'POST',
          url: 'http://localhost:3000/api/review/session/start',
          headers: { Authorization: 'Bearer fake-token' },
          body,
        });
        return POST(request).then(ApiRouteTestHelper.parseResponse);
      };

      const invalidInputs = [
        { input: { itemIds: 'not-array' }, expectedError: 'itemIds must be an array' },
        { input: { itemIds: [123] }, expectedError: 'itemId must be a string' },
        { input: { itemIds: [] }, expectedError: 'itemIds cannot be empty' },
      ];

      await ValidationTestHelper.testInvalidInputs(makeRequest, invalidInputs);
    });
  });

  describe('Business Logic Tests', () => {
    beforeEach(() => {
      await ApiRouteTestHelper.mockAuthUser('test-user');
      await ApiRouteTestHelper.mockRedisData({});
    });

    it('should reject requests when active session exists', async () => {
      // Mock active session
      await ApiRouteTestHelper.mockRedisData({
        'review:session:active:test-user': {
          sessionId: 'existing-session',
          startedAt: new Date(),
          itemCount: 10,
        },
      });

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/session/start',
        headers: { Authorization: 'Bearer fake-token' },
        body: { type: 'daily' },
      });

      const response = await POST(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      ApiRouteTestHelper.expectErrorResponse(result, 409, 'CONFLICT');
      expect(result.data.error.message).toContain('active session already exists');
    });

    it('should handle daily session type correctly', async () => {

      // Mock pinned items
      mockPinManager.PinManager.prototype.getPinnedItems.mockResolvedValue([
        {
          id: 'item1',
          contentType: 'kana',
          status: 'new',
          nextReviewAt: new Date(Date.now() - 1000), // Due now
        },
        {
          id: 'item2',
          contentType: 'kana',
          status: 'learning',
          nextReviewAt: new Date(Date.now() + 60000), // Due in 1 minute
        },
      ]);

      // Mock queue generation
      mockQueueGenerator.QueueGenerator.prototype.generateQueue.mockResolvedValue({
        items: [
          { id: 'item1', contentType: 'kana' },
          { id: 'item2', contentType: 'kana' },
        ],
      });

      // Mock session creation
      mockSessionManager.SessionManager.prototype.startSession.mockResolvedValue({
        id: 'daily-session',
        status: 'active',
        startedAt: new Date(),
        currentIndex: 0,
        items: [
          { content: { id: 'item1', contentType: 'kana' }, status: 'pending' },
          { content: { id: 'item2', contentType: 'kana' }, status: 'pending' },
        ],
        mode: 'recognition',
        source: 'daily',
      });

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/session/start',
        headers: { Authorization: 'Bearer fake-token' },
        body: { type: 'daily' },
      });

      const response = await POST(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      expect(result.data.data.session.source).toBe('daily');
      expect(mockQueueGenerator.QueueGenerator.prototype.generateQueue).toHaveBeenCalledWith(
        'test-user',
        expect.any(Array),
        expect.objectContaining({
          includeNew: true,
          includeDue: true,
          includeLearning: true,
        })
      );
    });

    it('should handle quick session type correctly', async () => {

      // Mock pinned items
      mockPinManager.PinManager.prototype.getPinnedItems.mockResolvedValue([
        { id: 'item1', contentType: 'kana' },
        { id: 'item2', contentType: 'kana' },
        { id: 'item3', contentType: 'kana' },
        { id: 'item4', contentType: 'kana' },
        { id: 'item5', contentType: 'kana' },
      ]);

      // Mock queue generation
      mockQueueGenerator.QueueGenerator.prototype.generateQueue.mockResolvedValue({
        items: [
          { id: 'item1', contentType: 'kana' },
          { id: 'item2', contentType: 'kana' },
          { id: 'item3', contentType: 'kana' },
          { id: 'item4', contentType: 'kana' },
          { id: 'item5', contentType: 'kana' },
        ],
      });

      // Mock session creation
      mockSessionManager.SessionManager.prototype.startSession.mockResolvedValue({
        id: 'quick-session',
        status: 'active',
        startedAt: new Date(),
        currentIndex: 0,
        items: [
          { content: { id: 'item1', contentType: 'kana' }, status: 'pending' },
          { content: { id: 'item2', contentType: 'kana' }, status: 'pending' },
          { content: { id: 'item3', contentType: 'kana' }, status: 'pending' },
          { content: { id: 'item4', contentType: 'kana' }, status: 'pending' },
          { content: { id: 'item5', contentType: 'kana' }, status: 'pending' },
        ],
        mode: 'recognition',
        source: 'quick',
      });

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/session/start',
        headers: { Authorization: 'Bearer fake-token' },
        body: { type: 'quick' },
      });

      const response = await POST(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      expect(result.data.data.session.source).toBe('quick');
      expect(mockQueueGenerator.QueueGenerator.prototype.generateQueue).toHaveBeenCalledWith(
        'test-user',
        expect.any(Array),
        expect.objectContaining({
          limit: 5,
        })
      );
    });

    it('should handle test session type correctly', async () => {

      // Mock dependencies
      mockPinManager.PinManager.prototype.getPinnedItems.mockResolvedValue([
        { id: 'item1', contentType: 'kana' },
      ]);

      mockQueueGenerator.QueueGenerator.prototype.generateQueue.mockResolvedValue({
        items: [{ id: 'item1', contentType: 'kana' }],
      });

      mockSessionManager.SessionManager.prototype.startSession.mockResolvedValue({
        id: 'test-session',
        status: 'active',
        startedAt: new Date(),
        currentIndex: 0,
        items: [
          { content: { id: 'item1', contentType: 'kana' }, status: 'pending' },
        ],
        mode: 'recognition',
        source: 'test',
      });

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/session/start',
        headers: { Authorization: 'Bearer fake-token' },
        body: { type: 'test' },
      });

      const response = await POST(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      expect(result.data.data.session.source).toBe('test');
      expect(mockQueueGenerator.QueueGenerator.prototype.generateQueue).toHaveBeenCalledWith(
        'test-user',
        expect.any(Array),
        expect.objectContaining({
          shuffleOrder: false, // Test mode doesn't shuffle
        })
      );
    });

    it('should handle specific item IDs correctly', async () => {

      // Mock pinned items
      mockPinManager.PinManager.prototype.getPinnedItems.mockResolvedValue([
        { id: 'item1', contentType: 'kana' },
        { id: 'item2', contentType: 'kana' },
        { id: 'item3', contentType: 'kana' },
      ]);

      // Mock session creation
      mockSessionManager.SessionManager.prototype.startSession.mockResolvedValue({
        id: 'specific-session',
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
        headers: { Authorization: 'Bearer fake-token' },
        body: { 
          type: 'custom',
          itemIds: ['item1', 'item3']
        },
      });

      const response = await POST(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      expect(result.data.data.items).toHaveLength(2);
      expect(result.data.data.items.map((item: any) => item.id)).toEqual(['item1', 'item3']);
    });

    it('should reject when no items are available', async () => {
      
      // Mock empty pinned items
      mockPinManager.PinManager.prototype.getPinnedItems.mockResolvedValue([]);

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/session/start',
        headers: { Authorization: 'Bearer fake-token' },
        body: { type: 'daily' },
      });

      const response = await POST(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      ApiRouteTestHelper.expectErrorResponse(result, 400, 'INVALID_STATE');
      expect(result.data.error.message).toContain('No items available for review');
    });

    it('should enforce item limits for free vs premium users', async () => {

      // Generate 60 items
      const manyItems = Array.from({ length: 60 }, (_, i) => ({
        id: `item${i}`,
        contentType: 'kana',
      }));

      mockPinManager.PinManager.prototype.getPinnedItems.mockResolvedValue(manyItems);
      mockQueueGenerator.QueueGenerator.prototype.generateQueue.mockResolvedValue({
        items: manyItems,
      });

      // Test free user (should be limited to 50 items)
      await ApiRouteTestHelper.mockAuthUser('free-user');
      
      mockSessionManager.SessionManager.prototype.startSession.mockResolvedValue({
        id: 'limited-session',
        status: 'active',
        startedAt: new Date(),
        currentIndex: 0,
        items: manyItems.slice(0, 50).map(item => ({
          content: item,
          status: 'pending',
        })),
        mode: 'recognition',
        source: 'daily',
      });

      const freeRequest = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/session/start',
        headers: { Authorization: 'Bearer fake-token' },
        body: { type: 'daily' },
      });

      const freeResponse = await POST(freeRequest);
      const freeResult = await ApiRouteTestHelper.parseResponse(freeResponse);

      expect(freeResult.status).toBe(200);
      expect(freeResult.data.data.session.totalItems).toBeLessThanOrEqual(50);

      // Test premium user (should be limited to 100 items)
      ApiRouteTestHelper.mockPremiumUser('premium-user');

      mockSessionManager.SessionManager.prototype.startSession.mockResolvedValue({
        id: 'unlimited-session',
        status: 'active',
        startedAt: new Date(),
        currentIndex: 0,
        items: manyItems.map(item => ({
          content: item,
          status: 'pending',
        })),
        mode: 'recognition',
        source: 'daily',
      });

      const premiumRequest = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/session/start',
        headers: { Authorization: 'Bearer fake-token' },
        body: { type: 'daily' },
      });

      const premiumResponse = await POST(premiumRequest);
      const premiumResult = await ApiRouteTestHelper.parseResponse(premiumResponse);

      expect(premiumResult.status).toBe(200);
      expect(premiumResult.data.data.session.totalItems).toBe(60); // All items
    });
  });

  describe('Error Handling Tests', () => {
    beforeEach(() => {
      await ApiRouteTestHelper.mockAuthUser('test-user');
      await ApiRouteTestHelper.mockRedisData({});
    });

    it('should handle PinManager errors gracefully', async () => {
      
      mockPinManager.PinManager.prototype.getPinnedItems.mockRejectedValue(
        new Error('Database connection error')
      );

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/session/start',
        headers: { Authorization: 'Bearer fake-token' },
        body: { type: 'daily' },
      });

      const response = await POST(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(500);
      expect(result.data.success).toBe(false);
    });

    it('should handle SessionManager errors gracefully', async () => {

      mockPinManager.PinManager.prototype.getPinnedItems.mockResolvedValue([
        { id: 'item1', contentType: 'kana' },
      ]);

      mockQueueGenerator.QueueGenerator.prototype.generateQueue.mockResolvedValue({
        items: [{ id: 'item1', contentType: 'kana' }],
      });

      mockSessionManager.SessionManager.prototype.startSession.mockRejectedValue(
        new Error('Session creation failed')
      );

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/session/start',
        headers: { Authorization: 'Bearer fake-token' },
        body: { type: 'daily' },
      });

      const response = await POST(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(500);
      expect(result.data.success).toBe(false);
    });

    it('should handle Redis errors gracefully', async () => {
      
      mockRedis.get.mockRejectedValue(new Error('Redis connection error'));
      mockPinManager.PinManager.prototype.getPinnedItems.mockResolvedValue([
        { id: 'item1', contentType: 'kana' },
      ]);

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/session/start',
        headers: { Authorization: 'Bearer fake-token' },
        body: { type: 'daily' },
      });

      const response = await POST(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(500);
      expect(result.data.success).toBe(false);
    });
  });

  describe('Performance Tests', () => {
    beforeEach(() => {
      await ApiRouteTestHelper.mockAuthUser('test-user');
      await ApiRouteTestHelper.mockRedisData({});
      
      // Mock dependencies with fast responses

      mockPinManager.PinManager.prototype.getPinnedItems.mockResolvedValue([
        { id: 'item1', contentType: 'kana' },
      ]);

      mockQueueGenerator.QueueGenerator.prototype.generateQueue.mockResolvedValue({
        items: [{ id: 'item1', contentType: 'kana' }],
      });

      mockSessionManager.SessionManager.prototype.startSession.mockResolvedValue({
        id: 'perf-session',
        status: 'active',
        startedAt: new Date(),
        currentIndex: 0,
        items: [{ content: { id: 'item1', contentType: 'kana' }, status: 'pending' }],
        mode: 'recognition',
        source: 'daily',
      });
    });

    it('should complete session start within performance threshold', async () => {
      const makeRequest = async () => {
        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'POST',
          url: 'http://localhost:3000/api/review/session/start',
          headers: { Authorization: 'Bearer fake-token' },
          body: { type: 'daily' },
        });
        return POST(request);
      };

      const { result, duration } = await ApiRouteTestHelper.measureApiPerformance(
        makeRequest,
        500 // 500ms threshold for session start
      );

      expect(duration).toBeLessThan(500);
      
      const parsedResult = await ApiRouteTestHelper.parseResponse(result);
      expect(parsedResult.status).toBe(200);
    });

    it('should handle concurrent session start requests', async () => {
      // Each request needs its own user to avoid conflicts
      let userCounter = 0;
      
      const makeRequest = async () => {
        const userId = `concurrent-user-${++userCounter}`;
        await ApiRouteTestHelper.mockAuthUser(userId);
        
        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'POST',
          url: 'http://localhost:3000/api/review/session/start',
          headers: { Authorization: `Bearer fake-token-${userId}` },
          body: { type: 'daily' },
        });
        return POST(request).then(ApiRouteTestHelper.parseResponse);
      };

      const { results, duration, avgDuration } = await PerformanceTestHelper.testConcurrentRequests(
        makeRequest,
        5 // 5 concurrent requests
      );

      expect(results).toHaveLength(5);
      expect(avgDuration).toBeLessThan(1000); // Average under 1 second
      
      // All requests should succeed
      results.forEach(result => {
        expect(result.status).toBe(200);
      });
    });
  });

  describe('CORS Tests', () => {
    it('should include proper CORS headers', async () => {
      await ApiRouteTestHelper.mockAuthUser('test-user');
      await ApiRouteTestHelper.mockRedisData({});
      

      mockPinManager.PinManager.prototype.getPinnedItems.mockResolvedValue([
        { id: 'item1', contentType: 'kana' },
      ]);

      mockQueueGenerator.QueueGenerator.prototype.generateQueue.mockResolvedValue({
        items: [{ id: 'item1', contentType: 'kana' }],
      });

      mockSessionManager.SessionManager.prototype.startSession.mockResolvedValue({
        id: 'cors-session',
        status: 'active',
        startedAt: new Date(),
        currentIndex: 0,
        items: [{ content: { id: 'item1', contentType: 'kana' }, status: 'pending' }],
        mode: 'recognition',
        source: 'daily',
      });

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/session/start',
        headers: { 
          Authorization: 'Bearer fake-token',
          Origin: 'https://example.com'
        },
        body: { type: 'daily' },
      });

      const response = await POST(request);
      
      // Check CORS headers are present
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeDefined();
      expect(response.headers.get('Access-Control-Allow-Headers')).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    it('should create a complete session workflow', async () => {
      await ApiRouteTestHelper.mockAuthUser('integration-user');
      await ApiRouteTestHelper.mockRedisData({});
      

      // Mock complete workflow
      mockPinManager.PinManager.prototype.getPinnedItems.mockResolvedValue([
        {
          id: 'kana1',
          contentType: 'kana',
          primaryDisplay: 'あ',
          primaryAnswer: 'a',
          difficulty: 0.3,
          tags: ['hiragana'],
          status: 'new',
        },
        {
          id: 'kana2',
          contentType: 'kana',
          primaryDisplay: 'い',
          primaryAnswer: 'i',
          difficulty: 0.4,
          tags: ['hiragana'],
          status: 'learning',
          nextReviewAt: new Date(Date.now() - 60000), // Due 1 minute ago
        },
      ]);

      mockQueueGenerator.QueueGenerator.prototype.generateQueue.mockResolvedValue({
        items: [
          {
            id: 'kana1',
            contentType: 'kana',
            primaryDisplay: 'あ',
            primaryAnswer: 'a',
            difficulty: 0.3,
            tags: ['hiragana'],
          },
          {
            id: 'kana2',
            contentType: 'kana',
            primaryDisplay: 'い',
            primaryAnswer: 'i',
            difficulty: 0.4,
            tags: ['hiragana'],
          },
        ],
      });

      mockSessionManager.SessionManager.prototype.startSession.mockResolvedValue({
        id: 'integration-session-123',
        status: 'active',
        startedAt: new Date(),
        currentIndex: 0,
        items: [
          {
            content: {
              id: 'kana1',
              contentType: 'kana',
              primaryDisplay: 'あ',
              primaryAnswer: 'a',
            },
            status: 'pending',
          },
          {
            content: {
              id: 'kana2',
              contentType: 'kana',
              primaryDisplay: 'い',
              primaryAnswer: 'i',
            },
            status: 'pending',
          },
        ],
        mode: 'recognition',
        source: 'daily',
      });

      // Mock Redis setex for session storage
      mockRedis.setex.mockResolvedValue('OK');

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/session/start',
        headers: { Authorization: 'Bearer fake-token' },
        body: { 
          type: 'daily',
          settings: {
            maxItems: 20,
            shuffleOrder: true,
            showTimer: true,
            allowSkip: true,
          }
        },
      });

      const response = await POST(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      // Verify complete response structure
      expect(result.status).toBe(200);
      expect(result.data.success).toBe(true);
      expect(result.data.data).toHaveProperty('session');
      expect(result.data.data).toHaveProperty('items');
      expect(result.data.data).toHaveProperty('metadata');

      // Verify session details
      expect(result.data.data.session.id).toBe('integration-session-123');
      expect(result.data.data.session.status).toBe('active');
      expect(result.data.data.session.totalItems).toBe(2);
      expect(result.data.data.session.currentIndex).toBe(0);
      expect(result.data.data.session.mode).toBe('recognition');
      expect(result.data.data.session.source).toBe('daily');

      // Verify items
      expect(result.data.data.items).toHaveLength(2);
      expect(result.data.data.items[0].id).toBe('kana1');
      expect(result.data.data.items[1].id).toBe('kana2');

      // Verify metadata
      expect(result.data.data.metadata.estimatedMinutes).toBe(3); // 2 items * 1.5 minutes
      expect(result.data.data.metadata.showTimer).toBe(true);
      expect(result.data.data.metadata.allowSkip).toBe(true);
      expect(result.data.data.metadata.sessionType).toBe('daily');

      // Verify Redis storage was called
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'review:session:active:integration-user',
        3600,
        expect.stringContaining('integration-session-123')
      );

      // Verify success message
      expect(result.data.meta.message).toContain('Session started with 2 items');
    });
  });
});