/**
 * Test Suite: Pin Management API
 * Tests for POST /api/review/pin and DELETE /api/review/pin
 */

import { POST, DELETE } from '../route';
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
jest.mock('@/lib/auth/session');
jest.mock('@/lib/redis/client');

// Import mocked modules
import * as pinManagerModule from '@/lib/review-engine/pinning/pin-manager';
import * as redisModule from '@/lib/redis/client';

const mockPinManager = pinManagerModule as jest.Mocked<typeof pinManagerModule>;
const mockRedis = (redisModule as any).redis;

describe('Pin Management API', () => {
  beforeAll(setupApiTest);
  afterAll(teardownApiTest);
  beforeEach(resetApiMocks);

  describe('POST /api/review/pin - Pin Item Tests', () => {
    describe('Authentication Tests', () => {
      it('should reject unauthenticated requests', async () => {
        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'POST',
          url: 'http://localhost:3000/api/review/pin',
          body: {
            contentId: 'kana-a',
            contentType: 'kana',
          },
        });

        const response = await POST(request);
        const result = await ApiRouteTestHelper.parseResponse(response);

        ApiRouteTestHelper.expectErrorResponse(result, 401, 'AUTH_REQUIRED');
      });

      it('should accept authenticated users', async () => {
        await ApiRouteTestHelper.mockAuthUser('test-user');
        
        mockPinManager.PinManager.prototype.pin.mockResolvedValue({
          id: 'pinned-item-1',
          contentId: 'kana-a',
          contentType: 'kana',
          userId: 'test-user',
          pinnedAt: new Date(),
          priority: 'normal',
          status: 'new',
        });

        mockPinManager.PinManager.prototype.getStatistics.mockResolvedValue({
          totalItems: 1,
          byStatus: { new: 1, learning: 0, mastered: 0 },
        });

        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'POST',
          url: 'http://localhost:3000/api/review/pin',
          headers: { Authorization: 'Bearer fake-token' },
          body: {
            contentId: 'kana-a',
            contentType: 'kana',
          },
        });

        const response = await POST(request);
        const result = await ApiRouteTestHelper.parseResponse(response);

        expect(result.status).toBe(200);
        expect(result.data.success).toBe(true);
        expect(result.data.data.item.contentId).toBe('kana-a');
      });
    });

    describe('Rate Limiting Tests', () => {
      beforeEach(() => {
        await ApiRouteTestHelper.mockAuthUser('test-user');
        
        mockPinManager.PinManager.prototype.pin.mockResolvedValue({
          id: 'pinned-item',
          contentId: 'kana-a',
          contentType: 'kana',
          userId: 'test-user',
          pinnedAt: new Date(),
        });
        mockPinManager.PinManager.prototype.getStatistics.mockResolvedValue({
          totalItems: 1,
          byStatus: { new: 1, learning: 0, mastered: 0 },
        });
      });

      it('should enforce rate limits for pin operations', async () => {
        let requestCount = 0;
        
        mockRedis.get.mockImplementation((key: string) => {
          if (key.includes('rateLimit:pin:test-user')) {
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
            url: 'http://localhost:3000/api/review/pin',
            headers: { Authorization: 'Bearer fake-token' },
            body: {
              contentId: `kana-${requestCount}`,
              contentType: 'kana',
            },
          });
          return POST(request).then(ApiRouteTestHelper.parseResponse);
        };

        // Test rate limit (assuming 20 requests per minute)
        const results = [];
        for (let i = 0; i < 20; i++) {
          const response = await makeRequest();
          results.push(response);
          expect(response.status).toBe(200);
        }
        
        // 21st request should be rate limited
        const limitedResponse = await makeRequest();
        expect(limitedResponse.status).toBe(429);
      });
    });

    describe('Input Validation Tests', () => {
      beforeEach(() => {
        await ApiRouteTestHelper.mockAuthUser('test-user');
      });

      it('should validate required fields', async () => {
        const makeRequest = async (body: any) => {
          const request = ApiRouteTestHelper.createMockNextRequest({
            method: 'POST',
            url: 'http://localhost:3000/api/review/pin',
            headers: { Authorization: 'Bearer fake-token' },
            body,
          });
          return POST(request).then(ApiRouteTestHelper.parseResponse);
        };

        await ValidationTestHelper.testRequiredFields(
          makeRequest,
          {
            contentId: 'kana-a',
            contentType: 'kana',
          },
          ['contentId', 'contentType']
        );
      });

      it('should validate content type', async () => {
        const makeRequest = async (body: any) => {
          const request = ApiRouteTestHelper.createMockNextRequest({
            method: 'POST',
            url: 'http://localhost:3000/api/review/pin',
            headers: { Authorization: 'Bearer fake-token' },
            body,
          });
          return POST(request).then(ApiRouteTestHelper.parseResponse);
        };

        const invalidInputs = [
          { 
            input: { contentId: 'test', contentType: 'invalid' }, 
            expectedError: 'contentType must be one of: kana, kanji, vocabulary, sentence' 
          },
          { 
            input: { contentId: 'test', contentType: 123 }, 
            expectedError: 'contentType must be a string' 
          },
        ];

        await ValidationTestHelper.testInvalidInputs(makeRequest, invalidInputs);
      });

      it('should validate optional priority field', async () => {
        const makeRequest = async (body: any) => {
          const request = ApiRouteTestHelper.createMockNextRequest({
            method: 'POST',
            url: 'http://localhost:3000/api/review/pin',
            headers: { Authorization: 'Bearer fake-token' },
            body,
          });
          return POST(request).then(ApiRouteTestHelper.parseResponse);
        };

        const invalidInputs = [
          { 
            input: { contentId: 'test', contentType: 'kana', priority: 'invalid' }, 
            expectedError: 'priority must be one of: low, normal, high' 
          },
          { 
            input: { contentId: 'test', contentType: 'kana', priority: 123 }, 
            expectedError: 'priority must be a string' 
          },
        ];

        await ValidationTestHelper.testInvalidInputs(makeRequest, invalidInputs);
      });

      it('should validate optional tags field', async () => {
        const makeRequest = async (body: any) => {
          const request = ApiRouteTestHelper.createMockNextRequest({
            method: 'POST',
            url: 'http://localhost:3000/api/review/pin',
            headers: { Authorization: 'Bearer fake-token' },
            body,
          });
          return POST(request).then(ApiRouteTestHelper.parseResponse);
        };

        const invalidInputs = [
          { 
            input: { contentId: 'test', contentType: 'kana', tags: 'not-array' }, 
            expectedError: 'tags must be an array' 
          },
          { 
            input: { contentId: 'test', contentType: 'kana', tags: [123] }, 
            expectedError: 'tag must be a string' 
          },
        ];

        await ValidationTestHelper.testInvalidInputs(makeRequest, invalidInputs);
      });
    });

    describe('Pin Business Logic Tests', () => {
      beforeEach(() => {
        await ApiRouteTestHelper.mockAuthUser('test-user');
      });

      it('should successfully pin a new item', async () => {
        
        mockPinManager.PinManager.prototype.pin.mockResolvedValue({
          id: 'pinned-kana-a',
          contentId: 'kana-a',
          contentType: 'kana',
          userId: 'test-user',
          pinnedAt: new Date('2024-01-01T10:00:00Z'),
          priority: 'normal',
          status: 'new',
          tags: ['hiragana'],
        });

        mockPinManager.PinManager.prototype.getStatistics.mockResolvedValue({
          totalItems: 5,
          byStatus: { new: 3, learning: 1, mastered: 1 },
        });

        mockRedis.del = jest.fn().mockResolvedValue(1);

        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'POST',
          url: 'http://localhost:3000/api/review/pin',
          headers: { Authorization: 'Bearer fake-token' },
          body: {
            contentId: 'kana-a',
            contentType: 'kana',
            priority: 'normal',
            tags: ['hiragana'],
            setId: 'hiragana-basic',
          },
        });

        const response = await POST(request);
        const result = await ApiRouteTestHelper.parseResponse(response);

        expect(result.status).toBe(200);
        expect(result.data.success).toBe(true);
        
        // Verify item data
        expect(result.data.data.item).toEqual({
          id: 'pinned-kana-a',
          contentId: 'kana-a',
          contentType: 'kana',
          userId: 'test-user',
          pinnedAt: '2024-01-01T10:00:00.000Z',
          priority: 'normal',
          status: 'new',
          tags: ['hiragana'],
        });

        // Verify statistics
        expect(result.data.data.stats).toEqual({
          totalPinned: 5,
          newItems: 3,
          learningItems: 1,
          masteredItems: 1,
        });

        // Verify success message
        expect(result.data.meta.message).toBe('Item pinned successfully');

        // Verify cache invalidation
        expect(mockRedis.del).toHaveBeenCalledWith('review:queue:test-user');
        expect(mockRedis.del).toHaveBeenCalledWith('review:stats:test-user');

        // Verify pin manager was called with correct parameters
        expect(mockPinManager.PinManager.prototype.pin).toHaveBeenCalledWith(
          'test-user',
          'kana-a',
          'kana',
          {
            priority: 'normal',
            tags: ['hiragana'],
            setId: 'hiragana-basic',
          }
        );
      });

      it('should handle already pinned items', async () => {
        
        mockPinManager.PinManager.prototype.pin.mockRejectedValue(
          new Error('Item is already pinned')
        );

        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'POST',
          url: 'http://localhost:3000/api/review/pin',
          headers: { Authorization: 'Bearer fake-token' },
          body: {
            contentId: 'kana-a',
            contentType: 'kana',
          },
        });

        const response = await POST(request);
        const result = await ApiRouteTestHelper.parseResponse(response);

        ApiRouteTestHelper.expectErrorResponse(result, 409, 'ALREADY_EXISTS');
        expect(result.data.error.message).toBe('Item is already pinned');
      });

      it('should handle pin limit exceeded', async () => {
        
        mockPinManager.PinManager.prototype.pin.mockRejectedValue(
          new Error('Pin limit exceeded. Maximum 1000 items allowed.')
        );

        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'POST',
          url: 'http://localhost:3000/api/review/pin',
          headers: { Authorization: 'Bearer fake-token' },
          body: {
            contentId: 'kana-a',
            contentType: 'kana',
          },
        });

        const response = await POST(request);
        const result = await ApiRouteTestHelper.parseResponse(response);

        ApiRouteTestHelper.expectErrorResponse(result, 400, 'LIMIT_EXCEEDED');
        expect(result.data.error.message).toBe('Pin limit exceeded. Maximum 1000 items allowed.');
      });
    });
  });

  describe('DELETE /api/review/pin - Unpin Items Tests', () => {
    describe('Authentication Tests', () => {
      it('should reject unauthenticated requests', async () => {
        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'DELETE',
          url: 'http://localhost:3000/api/review/pin',
          body: {
            itemIds: ['item1', 'item2'],
          },
        });

        const response = await DELETE(request);
        const result = await ApiRouteTestHelper.parseResponse(response);

        ApiRouteTestHelper.expectErrorResponse(result, 401, 'AUTH_REQUIRED');
      });

      it('should accept authenticated users', async () => {
        await ApiRouteTestHelper.mockAuthUser('test-user');
        
        mockPinManager.PinManager.prototype.unpin.mockResolvedValue(true);
        mockPinManager.PinManager.prototype.getStatistics.mockResolvedValue({
          totalItems: 3,
          byStatus: { new: 2, learning: 1, mastered: 0 },
        });

        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'DELETE',
          url: 'http://localhost:3000/api/review/pin',
          headers: { Authorization: 'Bearer fake-token' },
          body: {
            itemIds: ['item1', 'item2'],
          },
        });

        const response = await DELETE(request);
        const result = await ApiRouteTestHelper.parseResponse(response);

        expect(result.status).toBe(200);
        expect(result.data.success).toBe(true);
        expect(result.data.data.unpinned).toBe(2);
        expect(result.data.data.failed).toBe(0);
      });
    });

    describe('Input Validation Tests', () => {
      beforeEach(() => {
        await ApiRouteTestHelper.mockAuthUser('test-user');
      });

      it('should validate required itemIds field', async () => {
        const makeRequest = async (body: any) => {
          const request = ApiRouteTestHelper.createMockNextRequest({
            method: 'DELETE',
            url: 'http://localhost:3000/api/review/pin',
            headers: { Authorization: 'Bearer fake-token' },
            body,
          });
          return DELETE(request).then(ApiRouteTestHelper.parseResponse);
        };

        await ValidationTestHelper.testRequiredFields(
          makeRequest,
          { itemIds: ['item1', 'item2'] },
          ['itemIds']
        );
      });

      it('should validate itemIds format', async () => {
        const makeRequest = async (body: any) => {
          const request = ApiRouteTestHelper.createMockNextRequest({
            method: 'DELETE',
            url: 'http://localhost:3000/api/review/pin',
            headers: { Authorization: 'Bearer fake-token' },
            body,
          });
          return DELETE(request).then(ApiRouteTestHelper.parseResponse);
        };

        const invalidInputs = [
          { 
            input: { itemIds: 'not-array' }, 
            expectedError: 'itemIds must be an array' 
          },
          { 
            input: { itemIds: [] }, 
            expectedError: 'itemIds cannot be empty' 
          },
          { 
            input: { itemIds: [123] }, 
            expectedError: 'itemId must be a string' 
          },
        ];

        await ValidationTestHelper.testInvalidInputs(makeRequest, invalidInputs);
      });
    });

    describe('Unpin Business Logic Tests', () => {
      beforeEach(() => {
        await ApiRouteTestHelper.mockAuthUser('test-user');
      });

      it('should successfully unpin multiple items', async () => {
        
        mockPinManager.PinManager.prototype.unpin
          .mockResolvedValueOnce(true) // First item success
          .mockResolvedValueOnce(true) // Second item success
          .mockResolvedValueOnce(true); // Third item success

        mockPinManager.PinManager.prototype.getStatistics.mockResolvedValue({
          totalItems: 2,
          byStatus: { new: 1, learning: 1, mastered: 0 },
        });

        mockRedis.del = jest.fn().mockResolvedValue(1);

        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'DELETE',
          url: 'http://localhost:3000/api/review/pin',
          headers: { Authorization: 'Bearer fake-token' },
          body: {
            itemIds: ['item1', 'item2', 'item3'],
          },
        });

        const response = await DELETE(request);
        const result = await ApiRouteTestHelper.parseResponse(response);

        expect(result.status).toBe(200);
        expect(result.data.success).toBe(true);
        
        // Verify unpin results
        expect(result.data.data.unpinned).toBe(3);
        expect(result.data.data.failed).toBe(0);

        // Verify statistics
        expect(result.data.data.stats).toEqual({
          totalPinned: 2,
          newItems: 1,
          learningItems: 1,
          masteredItems: 0,
        });

        // Verify success message
        expect(result.data.meta.message).toBe('3 items unpinned successfully');

        // Verify cache invalidation
        expect(mockRedis.del).toHaveBeenCalledWith('review:queue:test-user');
        expect(mockRedis.del).toHaveBeenCalledWith('review:stats:test-user');

        // Verify unpin was called for each item
        expect(mockPinManager.PinManager.prototype.unpin).toHaveBeenCalledTimes(3);
        expect(mockPinManager.PinManager.prototype.unpin).toHaveBeenCalledWith('test-user', 'item1');
        expect(mockPinManager.PinManager.prototype.unpin).toHaveBeenCalledWith('test-user', 'item2');
        expect(mockPinManager.PinManager.prototype.unpin).toHaveBeenCalledWith('test-user', 'item3');
      });

      it('should handle partial failures gracefully', async () => {
        
        mockPinManager.PinManager.prototype.unpin
          .mockResolvedValueOnce(true) // First item success
          .mockRejectedValueOnce(new Error('Item not found')) // Second item failure
          .mockResolvedValueOnce(true); // Third item success

        mockPinManager.PinManager.prototype.getStatistics.mockResolvedValue({
          totalItems: 3,
          byStatus: { new: 2, learning: 1, mastered: 0 },
        });

        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'DELETE',
          url: 'http://localhost:3000/api/review/pin',
          headers: { Authorization: 'Bearer fake-token' },
          body: {
            itemIds: ['item1', 'item2', 'item3'],
          },
        });

        const response = await DELETE(request);
        const result = await ApiRouteTestHelper.parseResponse(response);

        expect(result.status).toBe(200);
        expect(result.data.success).toBe(true);
        
        // Verify partial success
        expect(result.data.data.unpinned).toBe(2);
        expect(result.data.data.failed).toBe(1);

        // Verify success message reflects partial success
        expect(result.data.meta.message).toBe('2 items unpinned successfully');
      });

      it('should handle all failures gracefully', async () => {
        
        mockPinManager.PinManager.prototype.unpin
          .mockRejectedValue(new Error('Item not found'));

        mockPinManager.PinManager.prototype.getStatistics.mockResolvedValue({
          totalItems: 5,
          byStatus: { new: 3, learning: 1, mastered: 1 },
        });

        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'DELETE',
          url: 'http://localhost:3000/api/review/pin',
          headers: { Authorization: 'Bearer fake-token' },
          body: {
            itemIds: ['item1', 'item2'],
          },
        });

        const response = await DELETE(request);
        const result = await ApiRouteTestHelper.parseResponse(response);

        expect(result.status).toBe(200);
        expect(result.data.success).toBe(true);
        
        // Verify all failures
        expect(result.data.data.unpinned).toBe(0);
        expect(result.data.data.failed).toBe(2);

        // Verify message reflects no success
        expect(result.data.meta.message).toBe('0 items unpinned successfully');
      });
    });
  });

  describe('Error Handling Tests', () => {
    beforeEach(() => {
      ApiRouteTestHelper.mockAuthUser('test-user');
    });

    it('should handle PinManager initialization errors', async () => {
      const mockPinManager = require('@/lib/review-engine/pinning/pin-manager');
      
      // Mock constructor to throw
      mockPinManager.PinManager.mockImplementation(() => {
        throw new Error('PinManager initialization failed');
      });

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/pin',
        headers: { Authorization: 'Bearer fake-token' },
        body: {
          contentId: 'kana-a',
          contentType: 'kana',
        },
      });

      const response = await POST(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(500);
      expect(result.data.success).toBe(false);
    });

    it('should handle Redis errors gracefully', async () => {
      const mockPinManager = require('@/lib/review-engine/pinning/pin-manager');
      const mockRedis = require('@/lib/redis/client').redis;
      
      mockPinManager.PinManager.prototype.pin.mockResolvedValue({
        id: 'pinned-item',
        contentId: 'kana-a',
        contentType: 'kana',
      });

      mockPinManager.PinManager.prototype.getStatistics.mockResolvedValue({
        totalItems: 1,
        byStatus: { new: 1, learning: 0, mastered: 0 },
      });

      // Mock Redis del to fail
      mockRedis.del.mockRejectedValue(new Error('Redis connection lost'));

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/pin',
        headers: { Authorization: 'Bearer fake-token' },
        body: {
          contentId: 'kana-a',
          contentType: 'kana',
        },
      });

      const response = await POST(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      // Should still succeed despite cache invalidation error
      expect(result.status).toBe(200);
      expect(result.data.success).toBe(true);
    });

    it('should handle statistics retrieval errors', async () => {
      const mockPinManager = require('@/lib/review-engine/pinning/pin-manager');
      
      mockPinManager.PinManager.prototype.pin.mockResolvedValue({
        id: 'pinned-item',
        contentId: 'kana-a',
        contentType: 'kana',
      });

      mockPinManager.PinManager.prototype.getStatistics.mockRejectedValue(
        new Error('Statistics retrieval failed')
      );

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/pin',
        headers: { Authorization: 'Bearer fake-token' },
        body: {
          contentId: 'kana-a',
          contentType: 'kana',
        },
      });

      const response = await POST(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      expect(result.status).toBe(500);
      expect(result.data.success).toBe(false);
    });
  });

  describe('Performance Tests', () => {
    beforeEach(() => {
      ApiRouteTestHelper.mockAuthUser('test-user');
      
      const mockPinManager = require('@/lib/review-engine/pinning/pin-manager');
      mockPinManager.PinManager.prototype.pin.mockResolvedValue({
        id: 'pinned-item',
        contentId: 'kana-a',
        contentType: 'kana',
      });
      mockPinManager.PinManager.prototype.getStatistics.mockResolvedValue({
        totalItems: 1,
        byStatus: { new: 1, learning: 0, mastered: 0 },
      });
    });

    it('should complete pin operations within performance threshold', async () => {
      const makeRequest = async () => {
        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'POST',
          url: 'http://localhost:3000/api/review/pin',
          headers: { Authorization: 'Bearer fake-token' },
          body: {
            contentId: 'kana-a',
            contentType: 'kana',
          },
        });
        return POST(request);
      };

      const { result, duration } = await ApiRouteTestHelper.measureApiPerformance(
        makeRequest,
        200 // 200ms threshold
      );

      expect(duration).toBeLessThan(200);
      
      const parsedResult = await ApiRouteTestHelper.parseResponse(result);
      expect(parsedResult.status).toBe(200);
    });

    it('should handle concurrent pin requests efficiently', async () => {
      let contentCounter = 0;
      
      const makeRequest = async () => {
        const contentId = `kana-${++contentCounter}`;
        
        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'POST',
          url: 'http://localhost:3000/api/review/pin',
          headers: { Authorization: 'Bearer fake-token' },
          body: {
            contentId,
            contentType: 'kana',
          },
        });
        return POST(request).then(ApiRouteTestHelper.parseResponse);
      };

      const { results, avgDuration } = await PerformanceTestHelper.testConcurrentRequests(
        makeRequest,
        5 // 5 concurrent requests
      );

      expect(results).toHaveLength(5);
      expect(avgDuration).toBeLessThan(300);
      
      // All requests should succeed
      results.forEach(result => {
        expect(result.status).toBe(200);
      });
    });

    it('should handle bulk unpin operations efficiently', async () => {
      const mockPinManager = require('@/lib/review-engine/pinning/pin-manager');
      
      // Mock successful unpins
      mockPinManager.PinManager.prototype.unpin.mockResolvedValue(true);
      mockPinManager.PinManager.prototype.getStatistics.mockResolvedValue({
        totalItems: 0,
        byStatus: { new: 0, learning: 0, mastered: 0 },
      });

      const makeRequest = async () => {
        // Create many items to unpin
        const itemIds = Array.from({ length: 50 }, (_, i) => `item-${i}`);
        
        const request = ApiRouteTestHelper.createMockNextRequest({
          method: 'DELETE',
          url: 'http://localhost:3000/api/review/pin',
          headers: { Authorization: 'Bearer fake-token' },
          body: { itemIds },
        });
        return DELETE(request);
      };

      const { result, duration } = await ApiRouteTestHelper.measureApiPerformance(
        makeRequest,
        1000 // 1 second threshold for bulk operations
      );

      expect(duration).toBeLessThan(1000);
      
      const parsedResult = await ApiRouteTestHelper.parseResponse(result);
      expect(parsedResult.status).toBe(200);
      expect(parsedResult.data.data.unpinned).toBe(50);
    });
  });

  describe('CORS Tests', () => {
    it('should include proper CORS headers for POST requests', async () => {
      ApiRouteTestHelper.mockAuthUser('test-user');
      
      const mockPinManager = require('@/lib/review-engine/pinning/pin-manager');
      mockPinManager.PinManager.prototype.pin.mockResolvedValue({
        id: 'pinned-item',
        contentId: 'kana-a',
        contentType: 'kana',
      });
      mockPinManager.PinManager.prototype.getStatistics.mockResolvedValue({
        totalItems: 1,
        byStatus: { new: 1, learning: 0, mastered: 0 },
      });

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/pin',
        headers: { 
          Authorization: 'Bearer fake-token',
          Origin: 'https://example.com'
        },
        body: {
          contentId: 'kana-a',
          contentType: 'kana',
        },
      });

      const response = await POST(request);
      
      // Check CORS headers are present
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeDefined();
      expect(response.headers.get('Access-Control-Allow-Headers')).toBeDefined();
    });

    it('should include proper CORS headers for DELETE requests', async () => {
      ApiRouteTestHelper.mockAuthUser('test-user');
      
      const mockPinManager = require('@/lib/review-engine/pinning/pin-manager');
      mockPinManager.PinManager.prototype.unpin.mockResolvedValue(true);
      mockPinManager.PinManager.prototype.getStatistics.mockResolvedValue({
        totalItems: 0,
        byStatus: { new: 0, learning: 0, mastered: 0 },
      });

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'DELETE',
        url: 'http://localhost:3000/api/review/pin',
        headers: { 
          Authorization: 'Bearer fake-token',
          Origin: 'https://example.com'
        },
        body: {
          itemIds: ['item1'],
        },
      });

      const response = await DELETE(request);
      
      // Check CORS headers are present
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeDefined();
      expect(response.headers.get('Access-Control-Allow-Headers')).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    it('should provide complete pin workflow', async () => {
      ApiRouteTestHelper.mockAuthUser('integration-user');
      
      const mockPinManager = require('@/lib/review-engine/pinning/pin-manager');
      const mockRedis = require('@/lib/redis/client').redis;

      // Mock successful pin operation
      const pinnedItem = {
        id: 'integration-pin-1',
        contentId: 'kana-a',
        contentType: 'kana',
        userId: 'integration-user',
        pinnedAt: new Date('2024-01-01T12:00:00Z'),
        priority: 'high',
        status: 'new',
        tags: ['hiragana', 'vowel'],
        setId: 'basic-hiragana',
      };

      mockPinManager.PinManager.prototype.pin.mockResolvedValue(pinnedItem);

      const statistics = {
        totalItems: 10,
        byStatus: { 
          new: 6,
          learning: 3,
          mastered: 1
        },
      };

      mockPinManager.PinManager.prototype.getStatistics.mockResolvedValue(statistics);
      mockRedis.del = jest.fn().mockResolvedValue(2); // Cache invalidated

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/review/pin',
        headers: { Authorization: 'Bearer integration-token' },
        body: {
          contentId: 'kana-a',
          contentType: 'kana',
          priority: 'high',
          tags: ['hiragana', 'vowel'],
          setId: 'basic-hiragana',
        },
      });

      const response = await POST(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      // Verify complete response
      expect(result.status).toBe(200);
      expect(result.data.success).toBe(true);

      // Verify item data
      expect(result.data.data.item).toEqual({
        id: 'integration-pin-1',
        contentId: 'kana-a',
        contentType: 'kana',
        userId: 'integration-user',
        pinnedAt: '2024-01-01T12:00:00.000Z',
        priority: 'high',
        status: 'new',
        tags: ['hiragana', 'vowel'],
        setId: 'basic-hiragana',
      });

      // Verify statistics
      expect(result.data.data.stats).toEqual({
        totalPinned: 10,
        newItems: 6,
        learningItems: 3,
        masteredItems: 1,
      });

      // Verify success message
      expect(result.data.meta.message).toBe('Item pinned successfully');

      // Verify cache invalidation occurred
      expect(mockRedis.del).toHaveBeenCalledWith('review:queue:integration-user');
      expect(mockRedis.del).toHaveBeenCalledWith('review:stats:integration-user');

      // Verify pin manager was called correctly
      expect(mockPinManager.PinManager.prototype.pin).toHaveBeenCalledWith(
        'integration-user',
        'kana-a',
        'kana',
        {
          priority: 'high',
          tags: ['hiragana', 'vowel'],
          setId: 'basic-hiragana',
        }
      );

      // Verify statistics were retrieved
      expect(mockPinManager.PinManager.prototype.getStatistics).toHaveBeenCalledWith('integration-user');
    });

    it('should provide complete unpin workflow', async () => {
      ApiRouteTestHelper.mockAuthUser('integration-user');
      
      const mockPinManager = require('@/lib/review-engine/pinning/pin-manager');
      const mockRedis = require('@/lib/redis/client').redis;

      // Mock mixed success/failure unpin operations
      mockPinManager.PinManager.prototype.unpin
        .mockResolvedValueOnce(true)  // item1 success
        .mockRejectedValueOnce(new Error('Item not found')) // item2 failure
        .mockResolvedValueOnce(true)  // item3 success
        .mockResolvedValueOnce(true); // item4 success

      const statistics = {
        totalItems: 6,
        byStatus: { 
          new: 4,
          learning: 2,
          mastered: 0
        },
      };

      mockPinManager.PinManager.prototype.getStatistics.mockResolvedValue(statistics);
      mockRedis.del = jest.fn().mockResolvedValue(2);

      const request = ApiRouteTestHelper.createMockNextRequest({
        method: 'DELETE',
        url: 'http://localhost:3000/api/review/pin',
        headers: { Authorization: 'Bearer integration-token' },
        body: {
          itemIds: ['item1', 'item2', 'item3', 'item4'],
        },
      });

      const response = await DELETE(request);
      const result = await ApiRouteTestHelper.parseResponse(response);

      // Verify complete response
      expect(result.status).toBe(200);
      expect(result.data.success).toBe(true);

      // Verify unpin results (3 successful, 1 failed)
      expect(result.data.data.unpinned).toBe(3);
      expect(result.data.data.failed).toBe(1);

      // Verify updated statistics
      expect(result.data.data.stats).toEqual({
        totalPinned: 6,
        newItems: 4,
        learningItems: 2,
        masteredItems: 0,
      });

      // Verify success message
      expect(result.data.meta.message).toBe('3 items unpinned successfully');

      // Verify cache invalidation occurred
      expect(mockRedis.del).toHaveBeenCalledWith('review:queue:integration-user');
      expect(mockRedis.del).toHaveBeenCalledWith('review:stats:integration-user');

      // Verify unpin was called for each item
      expect(mockPinManager.PinManager.prototype.unpin).toHaveBeenCalledTimes(4);
      expect(mockPinManager.PinManager.prototype.unpin).toHaveBeenCalledWith('integration-user', 'item1');
      expect(mockPinManager.PinManager.prototype.unpin).toHaveBeenCalledWith('integration-user', 'item2');
      expect(mockPinManager.PinManager.prototype.unpin).toHaveBeenCalledWith('integration-user', 'item3');
      expect(mockPinManager.PinManager.prototype.unpin).toHaveBeenCalledWith('integration-user', 'item4');

      // Verify statistics were retrieved
      expect(mockPinManager.PinManager.prototype.getStatistics).toHaveBeenCalledWith('integration-user');
    });
  });
});