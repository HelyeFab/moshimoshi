/**
 * Test Suite: Review Queue API
 * Tests for GET /api/review/queue
 */

import { GET } from '../route';
import {
  ApiRouteTestHelper,
  ValidationTestHelper,
  PerformanceTestHelper,
  setupApiTest,
  teardownApiTest,
  resetApiMocks,
} from '@/lib/review-engine/__tests__/test-utils/api-test-setup';

// Mock dependencies
jest.mock('@/lib/review-engine/pinning/pin-manager');
jest.mock('@/lib/review-engine/queue/queue-generator');
jest.mock('@/lib/auth/session');
jest.mock('@/lib/redis/client');

// Import mocked modules
import * as pinManagerModule from '@/lib/review-engine/pinning/pin-manager';
import * as queueGeneratorModule from '@/lib/review-engine/queue/queue-generator';
import * as redisModule from '@/lib/redis/client';

const mockPinManager = pinManagerModule as jest.Mocked<typeof pinManagerModule>;
const mockQueueGenerator = queueGeneratorModule as jest.Mocked<typeof queueGeneratorModule>;
const mockRedis = (redisModule as any).redis;

describe('Review Queue API', () => {
  beforeAll(setupApiTest);
  afterAll(teardownApiTest);
  beforeEach(resetApiMocks);

  describe('Authentication Tests', () => {
    it('should reject unauthenticated requests', async () => {
      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/review/queue',
      });

      const response = await GET(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      ApiRouteTestHelper.expectErrorResponse(result, 401, 'AUTH_REQUIRED');
    });

    it('should accept authenticated users', async () => {
      await ApiRouteTestHelper.mockAuthUser('test-user');
      await ApiRouteTestHelper.mockRedisData({});
      

      mockPinManager.PinManager.prototype.getPinnedItems.mockResolvedValue([
        {
          id: 'item1',
          contentType: 'kana',
          status: 'new',
          priority: 'normal',
        },
      ]);

      mockQueueGenerator.QueueGenerator.prototype.generateQueue.mockResolvedValue({
        items: [
          {
            id: 'item1',
            contentType: 'kana',
            queuePriority: 1,
            dueIn: 0,
            source: 'pinned',
            status: 'new',
            streak: 0,
          },
        ],
        stats: {
          total: 1,
          new: 1,
          learning: 0,
          mastered: 0,
          due: 0,
          nextReviewIn: null,
        },
      });

      mockQueueGenerator.QueueGenerator.prototype.applyDailyLimits.mockReturnValue([
        {
          id: 'item1',
          contentType: 'kana',
          queuePriority: 1,
          dueIn: 0,
          source: 'pinned',
          status: 'new',
          streak: 0,
        },
      ]);

      mockQueueGenerator.QueueGenerator.prototype.shuffleForVariety.mockReturnValue([
        {
          id: 'item1',
          contentType: 'kana',
          queuePriority: 1,
          dueIn: 0,
          source: 'pinned',
          status: 'new',
          streak: 0,
        },
      ]);

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/review/queue',
        headers: { Authorization: 'Bearer fake-token' },
      });

      const response = await GET(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      expect(result.data.success).toBe(true);
      expect(result.data.data.items).toHaveLength(1);
    });
  });

  describe('Rate Limiting Tests', () => {
    beforeEach(() => {
      await ApiRouteTestHelper.mockAuthUser('test-user');
      await ApiRouteTestHelper.mockRedisData({});
      

      mockPinManager.PinManager.prototype.getPinnedItems.mockResolvedValue([]);
      mockQueueGenerator.QueueGenerator.prototype.generateQueue.mockResolvedValue({
        items: [],
        stats: { total: 0, new: 0, learning: 0, mastered: 0, due: 0, nextReviewIn: null },
      });
      mockQueueGenerator.QueueGenerator.prototype.applyDailyLimits.mockReturnValue([]);
      mockQueueGenerator.QueueGenerator.prototype.shuffleForVariety.mockReturnValue([]);
    });

    it('should enforce rate limits', async () => {
      let requestCount = 0;
      
      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes('rateLimit:queue:test-user')) {
          return Promise.resolve(requestCount.toString());
        }
        // Return null for cache keys
        return Promise.resolve(null);
      });

      mockRedis.incr.mockImplementation(() => {
        requestCount++;
        return Promise.resolve(requestCount);
      });

      const makeRequest = async () => {
        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'GET',
          url: 'http://localhost:3000/api/review/queue',
          headers: { Authorization: 'Bearer fake-token' },
        });
        return GET(request).then(ApiRouteTestHelper.parseResponse);
      };

      // Test rate limit (assuming 10 requests per minute)
      const results = [];
      for (let i = 0; i < 10; i++) {
        const response = await makeRequest();
        results.push(response);
        expect(response.status).toBe(200);
      }
      
      // 11th request should be rate limited
      const limitedResponse = await makeRequest();
      expect(limitedResponse.status).toBe(429);
    });
  });

  describe('Query Parameter Tests', () => {
    beforeEach(() => {
      await ApiRouteTestHelper.mockAuthUser('test-user');
      await ApiRouteTestHelper.mockRedisData({});
      

      mockPinManager.PinManager.prototype.getPinnedItems.mockResolvedValue([
        { id: 'item1', contentType: 'kana' },
        { id: 'item2', contentType: 'kanji' },
        { id: 'item3', contentType: 'vocabulary' },
      ]);

      mockQueueGenerator.QueueGenerator.prototype.generateQueue.mockResolvedValue({
        items: [
          { id: 'item1', contentType: 'kana', queuePriority: 1, dueIn: 0, source: 'pinned', status: 'new', streak: 0 },
          { id: 'item2', contentType: 'kanji', queuePriority: 2, dueIn: 0, source: 'pinned', status: 'new', streak: 0 },
          { id: 'item3', contentType: 'vocabulary', queuePriority: 3, dueIn: 0, source: 'pinned', status: 'new', streak: 0 },
        ],
        stats: { total: 3, new: 3, learning: 0, mastered: 0, due: 0, nextReviewIn: null },
      });

      mockQueueGenerator.QueueGenerator.prototype.applyDailyLimits.mockImplementation((items) => items);
      mockQueueGenerator.QueueGenerator.prototype.shuffleForVariety.mockImplementation((items) => items);
    });

    it('should handle limit parameter', async () => {
      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/review/queue?limit=2',
        headers: { Authorization: 'Bearer fake-token' },
      });

      const response = await GET(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      
      expect(mockQueueGenerator.QueueGenerator.prototype.generateQueue).toHaveBeenCalledWith(
        'test-user',
        expect.any(Array),
        expect.objectContaining({
          limit: 2,
        })
      );
    });

    it('should handle type parameter for daily sessions', async () => {
      const now = new Date();
      
      mockPinManager.PinManager.prototype.getPinnedItems.mockResolvedValue([
        { id: 'item1', status: 'new', nextReviewAt: null },
        { id: 'item2', status: 'learning', nextReviewAt: new Date(now.getTime() - 60000) },
        { id: 'item3', status: 'mastered', nextReviewAt: new Date(now.getTime() + 60000) },
      ]);

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/review/queue?type=daily',
        headers: { Authorization: 'Bearer fake-token' },
      });

      const response = await GET(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      
      // Verify that only new, learning, and due items are included
      expect(mockQueueGenerator.QueueGenerator.prototype.generateQueue).toHaveBeenCalledWith(
        'test-user',
        expect.arrayContaining([
          expect.objectContaining({ id: 'item1', status: 'new' }),
          expect.objectContaining({ id: 'item2', status: 'learning' }),
        ]),
        expect.any(Object)
      );
    });

    it('should handle type parameter for quick sessions', async () => {
      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/review/queue?type=quick',
        headers: { Authorization: 'Bearer fake-token' },
      });

      const response = await GET(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      
      // Verify that items are sorted by due date and limited to 5
      expect(mockQueueGenerator.QueueGenerator.prototype.generateQueue).toHaveBeenCalledWith(
        'test-user',
        expect.any(Array),
        expect.any(Object)
      );
    });

    it('should handle contentType parameter', async () => {
      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/review/queue?contentType=kana',
        headers: { Authorization: 'Bearer fake-token' },
      });

      const response = await GET(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      
      expect(mockQueueGenerator.QueueGenerator.prototype.generateQueue).toHaveBeenCalledWith(
        'test-user',
        expect.any(Array),
        expect.objectContaining({
          contentTypes: ['kana'],
        })
      );
    });
  });

  describe('Caching Tests', () => {
    beforeEach(() => {
      await ApiRouteTestHelper.mockAuthUser('test-user');
      

      mockPinManager.PinManager.prototype.getPinnedItems.mockResolvedValue([
        { id: 'item1', contentType: 'kana' },
      ]);

      mockQueueGenerator.QueueGenerator.prototype.generateQueue.mockResolvedValue({
        items: [
          { id: 'item1', contentType: 'kana', queuePriority: 1, dueIn: 0, source: 'pinned', status: 'new', streak: 0 },
        ],
        stats: { total: 1, new: 1, learning: 0, mastered: 0, due: 0, nextReviewIn: null },
      });

      mockQueueGenerator.QueueGenerator.prototype.applyDailyLimits.mockImplementation((items) => items);
      mockQueueGenerator.QueueGenerator.prototype.shuffleForVariety.mockImplementation((items) => items);
    });

    it('should return cached results when available', async () => {
      const cachedData = {
        items: [
          { id: 'cached-item', contentType: 'kana', priority: 1 },
        ],
        stats: { queueSize: 1, estimatedMinutes: 1.5 },
      };

      await ApiRouteTestHelper.mockRedisData({
        'review:queue:test-user:all:all:20': cachedData,
      });

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/review/queue',
        headers: { Authorization: 'Bearer fake-token' },
      });

      const response = await GET(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      expect(result.data.data.items[0].id).toBe('cached-item');
      
      // Verify that queue generation was not called due to cache hit
      expect(mockQueueGenerator.QueueGenerator.prototype.generateQueue).not.toHaveBeenCalled();
    });

    it('should cache results for future requests', async () => {
      await ApiRouteTestHelper.mockRedisData({});
      
      mockRedis.setex = jest.fn().mockResolvedValue('OK');

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/review/queue',
        headers: { Authorization: 'Bearer fake-token' },
      });

      const response = await GET(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      
      // Verify that results were cached
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'review:queue:test-user:all:all:20',
        300, // 5 minutes TTL
        expect.any(String)
      );
    });

    it('should use different cache keys for different parameters', async () => {
      await ApiRouteTestHelper.mockRedisData({});
      
      mockRedis.setex = jest.fn().mockResolvedValue('OK');

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/review/queue?type=daily&contentType=kana&limit=10',
        headers: { Authorization: 'Bearer fake-token' },
      });

      const response = await GET(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      
      // Verify cache key includes parameters
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'review:queue:test-user:daily:kana:10',
        300,
        expect.any(String)
      );
    });
  });

  describe('Premium vs Free User Tests', () => {
    beforeEach(() => {

      // Create 60 items to test limits
      const manyItems = Array.from({ length: 60 }, (_, i) => ({
        id: `item${i}`,
        contentType: 'kana',
        queuePriority: i,
        dueIn: 0,
        source: 'pinned',
        status: 'new',
        streak: 0,
      }));

      mockPinManager.PinManager.prototype.getPinnedItems.mockResolvedValue(manyItems);
      mockQueueGenerator.QueueGenerator.prototype.generateQueue.mockResolvedValue({
        items: manyItems,
        stats: { total: 60, new: 60, learning: 0, mastered: 0, due: 0, nextReviewIn: null },
      });
      mockQueueGenerator.QueueGenerator.prototype.applyDailyLimits.mockImplementation((items) => items);
      mockQueueGenerator.QueueGenerator.prototype.shuffleForVariety.mockImplementation((items) => items);

      await ApiRouteTestHelper.mockRedisData({});
    });

    it('should limit queue size for free users', async () => {
      await ApiRouteTestHelper.mockAuthUser('free-user');

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/review/queue?limit=100',
        headers: { Authorization: 'Bearer fake-token' },
      });

      const response = await GET(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      
      expect(mockQueueGenerator.QueueGenerator.prototype.generateQueue).toHaveBeenCalledWith(
        'free-user',
        expect.any(Array),
        expect.objectContaining({
          limit: 50, // Free users limited to 50
        })
      );
    });

    it('should allow larger queue size for premium users', async () => {
      ApiRouteTestHelper.mockPremiumUser('premium-user');

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/review/queue?limit=100',
        headers: { Authorization: 'Bearer fake-token' },
      });

      const response = await GET(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      
      expect(mockQueueGenerator.QueueGenerator.prototype.generateQueue).toHaveBeenCalledWith(
        'premium-user',
        expect.any(Array),
        expect.objectContaining({
          limit: 100, // Premium users can get up to 100
        })
      );
    });

    it('should have different daily new item limits', async () => {
      
      // Mock daily new count
      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes('daily:new')) {
          return Promise.resolve('5');
        }
        return Promise.resolve(null);
      });

      // Test free user
      await ApiRouteTestHelper.mockAuthUser('free-user');

      const freeRequest = ApiRouteTestHelper.createMockNextRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/review/queue',
        headers: { Authorization: 'Bearer fake-token' },
      });

      const freeResponse = await GET(freeRequest);
      const freeResult = await ApiRouteTestHelper.parseResponse(freeResponse);

      expect(freeResult.status).toBe(200);
      expect(freeResult.data.data.stats.dailyNewRemaining).toBe(5); // 10 - 5 = 5 remaining

      // Test premium user
      ApiRouteTestHelper.mockPremiumUser('premium-user');

      const premiumRequest = ApiRouteTestHelper.createMockNextRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/review/queue',
        headers: { Authorization: 'Bearer fake-token' },
      });

      const premiumResponse = await GET(premiumRequest);
      const premiumResult = await ApiRouteTestHelper.parseResponse(premiumResponse);

      expect(premiumResult.status).toBe(200);
      expect(premiumResult.data.data.stats.dailyNewRemaining).toBe(25); // 30 - 5 = 25 remaining
    });
  });

  describe('Queue Generation Tests', () => {
    beforeEach(() => {
      await ApiRouteTestHelper.mockAuthUser('test-user');
      await ApiRouteTestHelper.mockRedisData({});
    });

    it('should shuffle items for variety when queue is large', async () => {

      const manyItems = Array.from({ length: 15 }, (_, i) => ({
        id: `item${i}`,
        contentType: 'kana',
        queuePriority: i,
        dueIn: 0,
        source: 'pinned',
        status: 'new',
        streak: 0,
      }));

      mockPinManager.PinManager.prototype.getPinnedItems.mockResolvedValue(manyItems);
      mockQueueGenerator.QueueGenerator.prototype.generateQueue.mockResolvedValue({
        items: manyItems,
        stats: { total: 15, new: 15, learning: 0, mastered: 0, due: 0, nextReviewIn: null },
      });
      
      mockQueueGenerator.QueueGenerator.prototype.applyDailyLimits.mockReturnValue(manyItems);
      mockQueueGenerator.QueueGenerator.prototype.shuffleForVariety.mockReturnValue(manyItems.slice().reverse());

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/review/queue',
        headers: { Authorization: 'Bearer fake-token' },
      });

      const response = await GET(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      
      // Verify shuffleForVariety was called for large queue
      expect(mockQueueGenerator.QueueGenerator.prototype.shuffleForVariety).toHaveBeenCalledWith(manyItems);
    });

    it('should not shuffle items for small queues', async () => {

      const fewItems = Array.from({ length: 5 }, (_, i) => ({
        id: `item${i}`,
        contentType: 'kana',
        queuePriority: i,
        dueIn: 0,
        source: 'pinned',
        status: 'new',
        streak: 0,
      }));

      mockPinManager.PinManager.prototype.getPinnedItems.mockResolvedValue(fewItems);
      mockQueueGenerator.QueueGenerator.prototype.generateQueue.mockResolvedValue({
        items: fewItems,
        stats: { total: 5, new: 5, learning: 0, mastered: 0, due: 0, nextReviewIn: null },
      });
      
      mockQueueGenerator.QueueGenerator.prototype.applyDailyLimits.mockReturnValue(fewItems);

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/review/queue',
        headers: { Authorization: 'Bearer fake-token' },
      });

      const response = await GET(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      
      // Verify shuffleForVariety was not called for small queue
      expect(mockQueueGenerator.QueueGenerator.prototype.shuffleForVariety).not.toHaveBeenCalled();
    });

    it('should apply daily limits correctly', async () => {

      const items = [
        { id: 'item1', contentType: 'kana', status: 'new' },
        { id: 'item2', contentType: 'kana', status: 'new' },
      ];

      mockPinManager.PinManager.prototype.getPinnedItems.mockResolvedValue(items);
      mockQueueGenerator.QueueGenerator.prototype.generateQueue.mockResolvedValue({
        items,
        stats: { total: 2, new: 2, learning: 0, mastered: 0, due: 0, nextReviewIn: null },
      });
      
      // Mock daily new count
      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes('daily:new')) {
          return Promise.resolve('8'); // 8 new items already today
        }
        return Promise.resolve(null);
      });

      // Mock apply daily limits to return 1 item (due to limit)
      mockQueueGenerator.QueueGenerator.prototype.applyDailyLimits.mockReturnValue([items[0]]);
      mockQueueGenerator.QueueGenerator.prototype.shuffleForVariety.mockImplementation((items) => items);

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/review/queue',
        headers: { Authorization: 'Bearer fake-token' },
      });

      const response = await GET(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      
      // Verify daily limits were applied
      expect(mockQueueGenerator.QueueGenerator.prototype.applyDailyLimits).toHaveBeenCalledWith(
        items,
        8, // dailyNewCount
        10 // dailyNewLimit for free user
      );
      
      expect(result.data.data.stats.dailyNewRemaining).toBe(2); // 10 - 8 = 2
    });
  });

  describe('Response Format Tests', () => {
    beforeEach(() => {
      await ApiRouteTestHelper.mockAuthUser('test-user');
      await ApiRouteTestHelper.mockRedisData({});
      

      mockPinManager.PinManager.prototype.getPinnedItems.mockResolvedValue([
        {
          id: 'test-item',
          contentType: 'kana',
          queuePriority: 1,
          dueIn: 30,
          source: 'pinned',
          status: 'learning',
          streak: 3,
        },
      ]);

      mockQueueGenerator.QueueGenerator.prototype.generateQueue.mockResolvedValue({
        items: [
          {
            id: 'test-item',
            contentType: 'kana',
            queuePriority: 1,
            dueIn: 30,
            source: 'pinned',
            status: 'learning',
            streak: 3,
          },
        ],
        stats: {
          total: 10,
          new: 3,
          learning: 4,
          mastered: 3,
          due: 2,
          nextReviewIn: 1800, // 30 minutes in seconds
        },
      });

      mockQueueGenerator.QueueGenerator.prototype.applyDailyLimits.mockImplementation((items) => items);
      mockQueueGenerator.QueueGenerator.prototype.shuffleForVariety.mockImplementation((items) => items);
    });

    it('should return correct response format', async () => {
      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/review/queue',
        headers: { Authorization: 'Bearer fake-token' },
      });

      const response = await GET(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      expect(result.data.success).toBe(true);
      
      // Verify response structure
      expect(result.data.data).toHaveProperty('items');
      expect(result.data.data).toHaveProperty('stats');
      expect(result.data.data).toHaveProperty('nextReviewIn');
      
      // Verify item format
      expect(result.data.data.items[0]).toEqual({
        id: 'test-item',
        contentType: 'kana',
        priority: 1,
        dueIn: 30,
        source: 'pinned',
        status: 'learning',
        streak: 3,
      });
      
      // Verify stats format
      expect(result.data.data.stats).toEqual({
        total: 10,
        new: 3,
        learning: 4,
        mastered: 3,
        due: 2,
        nextReviewIn: 1800,
        queueSize: 1,
        estimatedMinutes: 1.5,
        dailyNewRemaining: 10, // Free user default
      });
      
      // Verify nextReviewIn is properly formatted
      expect(result.data.data.nextReviewIn).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should handle null nextReviewIn', async () => {
      
      mockQueueGenerator.QueueGenerator.prototype.generateQueue.mockResolvedValue({
        items: [
          {
            id: 'test-item',
            contentType: 'kana',
            queuePriority: 1,
            dueIn: 0,
            source: 'pinned',
            status: 'new',
            streak: 0,
          },
        ],
        stats: {
          total: 1,
          new: 1,
          learning: 0,
          mastered: 0,
          due: 0,
          nextReviewIn: null, // No next review scheduled
        },
      });

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/review/queue',
        headers: { Authorization: 'Bearer fake-token' },
      });

      const response = await GET(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      expect(result.data.data.stats.nextReviewIn).toBeNull();
      expect(result.data.data.nextReviewIn).toBeNull();
    });
  });

  describe('Error Handling Tests', () => {
    beforeEach(() => {
      await ApiRouteTestHelper.mockAuthUser('test-user');
      await ApiRouteTestHelper.mockRedisData({});
    });

    it('should handle PinManager errors gracefully', async () => {
      
      mockPinManager.PinManager.prototype.getPinnedItems.mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/review/queue',
        headers: { Authorization: 'Bearer fake-token' },
      });

      const response = await GET(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(500);
      expect(result.data.success).toBe(false);
    });

    it('should handle QueueGenerator errors gracefully', async () => {

      mockPinManager.PinManager.prototype.getPinnedItems.mockResolvedValue([
        { id: 'item1', contentType: 'kana' },
      ]);

      mockQueueGenerator.QueueGenerator.prototype.generateQueue.mockRejectedValue(
        new Error('Queue generation failed')
      );

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/review/queue',
        headers: { Authorization: 'Bearer fake-token' },
      });

      const response = await GET(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(500);
      expect(result.data.success).toBe(false);
    });

    it('should handle Redis cache errors gracefully', async () => {

      // Mock Redis get to throw error
      mockRedis.get.mockRejectedValue(new Error('Redis connection lost'));

      mockPinManager.PinManager.prototype.getPinnedItems.mockResolvedValue([
        { id: 'item1', contentType: 'kana' },
      ]);

      mockQueueGenerator.QueueGenerator.prototype.generateQueue.mockResolvedValue({
        items: [
          { id: 'item1', contentType: 'kana', queuePriority: 1, dueIn: 0, source: 'pinned', status: 'new', streak: 0 },
        ],
        stats: { total: 1, new: 1, learning: 0, mastered: 0, due: 0, nextReviewIn: null },
      });
      
      mockQueueGenerator.QueueGenerator.prototype.applyDailyLimits.mockImplementation((items) => items);

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/review/queue',
        headers: { Authorization: 'Bearer fake-token' },
      });

      const response = await GET(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      // Should still succeed despite cache error
      expect(result.status).toBe(200);
      expect(result.data.success).toBe(true);
    });
  });

  describe('Performance Tests', () => {
    beforeEach(() => {
      await ApiRouteTestHelper.mockAuthUser('test-user');
      await ApiRouteTestHelper.mockRedisData({});
      

      mockPinManager.PinManager.prototype.getPinnedItems.mockResolvedValue([
        { id: 'item1', contentType: 'kana' },
      ]);

      mockQueueGenerator.QueueGenerator.prototype.generateQueue.mockResolvedValue({
        items: [
          { id: 'item1', contentType: 'kana', queuePriority: 1, dueIn: 0, source: 'pinned', status: 'new', streak: 0 },
        ],
        stats: { total: 1, new: 1, learning: 0, mastered: 0, due: 0, nextReviewIn: null },
      });
      
      mockQueueGenerator.QueueGenerator.prototype.applyDailyLimits.mockImplementation((items) => items);
    });

    it('should respond within performance threshold', async () => {
      const makeRequest = async () => {
        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'GET',
          url: 'http://localhost:3000/api/review/queue',
          headers: { Authorization: 'Bearer fake-token' },
        });
        return GET(request);
      };

      const { result, duration } = await ApiRouteTestHelper.measureApiPerformance(
        makeRequest,
        300 // 300ms threshold
      );

      expect(duration).toBeLessThan(300);
      
      const parsedResult = await ApiRouteTestHelper.parseResponse(result);
      expect(parsedResult.status).toBe(200);
    });

    it('should handle concurrent requests efficiently', async () => {
      let userCounter = 0;
      
      const makeRequest = async () => {
        const userId = `concurrent-user-${++userCounter}`;
        await ApiRouteTestHelper.mockAuthUser(userId);
        
        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'GET',
          url: 'http://localhost:3000/api/review/queue',
          headers: { Authorization: `Bearer fake-token-${userId}` },
        });
        return GET(request).then(ApiRouteTestHelper.parseResponse);
      };

      const { results, avgDuration } = await PerformanceTestHelper.testConcurrentRequests(
        makeRequest,
        10 // 10 concurrent requests
      );

      expect(results).toHaveLength(10);
      expect(avgDuration).toBeLessThan(500);
      
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
        items: [
          { id: 'item1', contentType: 'kana', queuePriority: 1, dueIn: 0, source: 'pinned', status: 'new', streak: 0 },
        ],
        stats: { total: 1, new: 1, learning: 0, mastered: 0, due: 0, nextReviewIn: null },
      });
      
      mockQueueGenerator.QueueGenerator.prototype.applyDailyLimits.mockImplementation((items) => items);

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/review/queue',
        headers: { 
          Authorization: 'Bearer fake-token',
          Origin: 'https://example.com'
        },
      });

      const response = await GET(request);
      
      // Check CORS headers are present
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeDefined();
      expect(response.headers.get('Access-Control-Allow-Headers')).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    it('should provide a complete queue workflow', async () => {
      await ApiRouteTestHelper.mockAuthUser('integration-user');
      

      // Mock no cache
      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes('daily:new:integration-user')) {
          return Promise.resolve('3'); // 3 new items today
        }
        return Promise.resolve(null);
      });
      
      mockRedis.setex = jest.fn().mockResolvedValue('OK');

      // Mock realistic pinned items
      const pinnedItems = [
        {
          id: 'kana-a',
          contentType: 'kana',
          status: 'new',
          nextReviewAt: null,
        },
        {
          id: 'kana-i',
          contentType: 'kana',
          status: 'learning',
          nextReviewAt: new Date(Date.now() - 30 * 60 * 1000), // Due 30 minutes ago
        },
        {
          id: 'kanji-person',
          contentType: 'kanji',
          status: 'mastered',
          nextReviewAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Due tomorrow
        },
      ];

      mockPinManager.PinManager.prototype.getPinnedItems.mockResolvedValue(pinnedItems);

      // Mock queue generation
      const queueItems = [
        {
          id: 'kana-a',
          contentType: 'kana',
          queuePriority: 1,
          dueIn: 0,
          source: 'pinned',
          status: 'new',
          streak: 0,
        },
        {
          id: 'kana-i',
          contentType: 'kana',
          queuePriority: 2,
          dueIn: -30,
          source: 'pinned',
          status: 'learning',
          streak: 2,
        },
      ];

      mockQueueGenerator.QueueGenerator.prototype.generateQueue.mockResolvedValue({
        items: queueItems,
        stats: {
          total: 3,
          new: 1,
          learning: 1,
          mastered: 1,
          due: 1,
          nextReviewIn: 1440, // 24 hours in minutes
        },
      });

      mockQueueGenerator.QueueGenerator.prototype.applyDailyLimits.mockReturnValue(queueItems);
      mockQueueGenerator.QueueGenerator.prototype.shuffleForVariety.mockReturnValue(queueItems);

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/review/queue?type=daily&limit=20',
        headers: { Authorization: 'Bearer fake-token' },
      });

      const response = await GET(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      // Verify complete response
      expect(result.status).toBe(200);
      expect(result.data.success).toBe(true);

      // Verify items
      expect(result.data.data.items).toHaveLength(2);
      expect(result.data.data.items[0]).toEqual({
        id: 'kana-a',
        contentType: 'kana',
        priority: 1,
        dueIn: 0,
        source: 'pinned',
        status: 'new',
        streak: 0,
      });

      // Verify stats
      expect(result.data.data.stats).toEqual({
        total: 3,
        new: 1,
        learning: 1,
        mastered: 1,
        due: 1,
        nextReviewIn: 1440,
        queueSize: 2,
        estimatedMinutes: 3, // 2 items * 1.5 minutes
        dailyNewRemaining: 7, // 10 - 3 = 7
      });

      // Verify nextReviewIn is formatted correctly
      expect(result.data.data.nextReviewIn).toBeDefined();
      expect(new Date(result.data.data.nextReviewIn).getTime()).toBeGreaterThan(Date.now());

      // Verify cache was set
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'review:queue:integration-user:daily:all:20',
        300,
        expect.any(String)
      );

      // Verify queue generation was called with correct parameters
      expect(mockQueueGenerator.QueueGenerator.prototype.generateQueue).toHaveBeenCalledWith(
        'integration-user',
        expect.arrayContaining([
          expect.objectContaining({ id: 'kana-a', status: 'new' }),
          expect.objectContaining({ id: 'kana-i', status: 'learning' }),
        ]),
        expect.objectContaining({
          limit: 20,
          includeNew: true,
          includeDue: true,
          includeLearning: true,
          shuffleOrder: true,
          priorityBoost: true,
        })
      );
    });
  });
});