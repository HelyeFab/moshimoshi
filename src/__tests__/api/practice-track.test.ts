import { NextRequest } from 'next/server';
import { POST, GET, DELETE } from '../../app/api/practice/track/route';
import { getAuthSession } from '../../lib/auth/session';
import { practiceHistoryService } from '../../services/practiceHistory/PracticeHistoryService';
import { adminDb } from '../../lib/firebase/admin';
import { createMockPracticeItem, createMockPracticeItems, mockAuthSession } from '../practice-history/test-utils';

// Mock dependencies
jest.mock('../../lib/auth/session');
jest.mock('../../services/practiceHistory/PracticeHistoryService');
jest.mock('../../lib/firebase/admin', () => ({
  adminDb: {
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    get: jest.fn()
  }
}));

describe('Practice Tracking API Routes', () => {
  const mockGetAuthSession = getAuthSession as jest.MockedFunction<typeof getAuthSession>;
  const mockService = practiceHistoryService as jest.Mocked<typeof practiceHistoryService>;
  const mockDb = adminDb as jest.Mocked<typeof adminDb>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    mockService.initialize = jest.fn().mockResolvedValue(undefined);
    mockService.addOrUpdateItem = jest.fn().mockResolvedValue(undefined);
    mockService.getRecentItems = jest.fn().mockResolvedValue([]);
    mockService.getMostPracticed = jest.fn().mockResolvedValue([]);
    mockService.deleteItem = jest.fn().mockResolvedValue(undefined);

    mockDb.collection.mockReturnThis();
    mockDb.doc.mockReturnThis();
  });

  describe('POST /api/practice/track', () => {
    it('should track practice for authenticated user', async () => {
      const session = mockAuthSession();
      mockGetAuthSession.mockResolvedValueOnce(session);

      mockDb.get.mockResolvedValueOnce({
        data: () => ({ subscription: { plan: 'free' } })
      } as any);

      const mockRequest = new NextRequest('http://localhost:3000/api/practice/track', {
        method: 'POST',
        body: JSON.stringify({
          videoUrl: 'https://youtube.com/watch?v=test123',
          videoTitle: 'Test Video',
          videoId: 'test123',
          thumbnailUrl: 'https://example.com/thumb.jpg',
          channelName: 'Test Channel',
          duration: 720,
          practiceTime: 600,
          metadata: { description: 'Test' }
        })
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockService.initialize).toHaveBeenCalledWith('test-user-123', false);
      expect(mockService.addOrUpdateItem).toHaveBeenCalledWith(
        expect.objectContaining({
          videoId: 'test123',
          videoTitle: 'Test Video'
        })
      );
    });

    it('should track practice for guest user', async () => {
      mockGetAuthSession.mockResolvedValueOnce(null);

      const mockRequest = new NextRequest('http://localhost:3000/api/practice/track', {
        method: 'POST',
        body: JSON.stringify({
          videoUrl: 'https://youtube.com/watch?v=test123',
          videoTitle: 'Test Video',
          videoId: 'test123'
        })
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockService.initialize).toHaveBeenCalledWith(undefined, false);
    });

    it('should handle premium user correctly', async () => {
      const session = mockAuthSession();
      mockGetAuthSession.mockResolvedValueOnce(session);

      mockDb.get.mockResolvedValueOnce({
        data: () => ({ subscription: { plan: 'premium_monthly' } })
      } as any);

      const mockRequest = new NextRequest('http://localhost:3000/api/practice/track', {
        method: 'POST',
        body: JSON.stringify({
          videoUrl: 'https://youtube.com/watch?v=test123',
          videoTitle: 'Test Video',
          videoId: 'test123'
        })
      });

      await POST(mockRequest);

      expect(mockService.initialize).toHaveBeenCalledWith('test-user-123', true);
    });

    it('should return 400 for missing required fields', async () => {
      mockGetAuthSession.mockResolvedValueOnce(null);

      const mockRequest = new NextRequest('http://localhost:3000/api/practice/track', {
        method: 'POST',
        body: JSON.stringify({
          videoUrl: 'https://youtube.com/watch?v=test123'
          // Missing videoTitle and videoId
        })
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required fields');
    });

    it('should handle service errors', async () => {
      mockGetAuthSession.mockResolvedValueOnce(null);
      mockService.addOrUpdateItem.mockRejectedValueOnce(new Error('Service error'));

      const mockRequest = new NextRequest('http://localhost:3000/api/practice/track', {
        method: 'POST',
        body: JSON.stringify({
          videoUrl: 'https://youtube.com/watch?v=test123',
          videoTitle: 'Test Video',
          videoId: 'test123'
        })
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to track practice');
    });

    it('should handle annual premium subscriptions', async () => {
      const session = mockAuthSession();
      mockGetAuthSession.mockResolvedValueOnce(session);

      mockDb.get.mockResolvedValueOnce({
        data: () => ({ subscription: { plan: 'premium_annual' } })
      } as any);

      const mockRequest = new NextRequest('http://localhost:3000/api/practice/track', {
        method: 'POST',
        body: JSON.stringify({
          videoUrl: 'https://youtube.com/watch?v=test123',
          videoTitle: 'Test Video',
          videoId: 'test123'
        })
      });

      await POST(mockRequest);

      expect(mockService.initialize).toHaveBeenCalledWith('test-user-123', true);
    });
  });

  describe('GET /api/practice/track', () => {
    it('should fetch practice history for authenticated user', async () => {
      const session = mockAuthSession();
      mockGetAuthSession.mockResolvedValueOnce(session);

      mockDb.get.mockResolvedValueOnce({
        data: () => ({ subscription: { plan: 'free' } })
      } as any);

      const items = createMockPracticeItems(3);
      mockService.getRecentItems.mockResolvedValueOnce(items);

      const mockRequest = new NextRequest('http://localhost:3000/api/practice/track?limit=50&sortBy=recent');

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.items).toEqual(items);
      expect(data.userTier).toBe('free');
      expect(data.count).toBe(3);
      expect(mockService.getRecentItems).toHaveBeenCalledWith(50);
    });

    it('should fetch most practiced items when sortBy is mostPracticed', async () => {
      mockGetAuthSession.mockResolvedValueOnce(null);

      const items = createMockPracticeItems(5);
      mockService.getMostPracticed.mockResolvedValueOnce(items);

      const mockRequest = new NextRequest('http://localhost:3000/api/practice/track?limit=10&sortBy=mostPracticed');

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items).toEqual(items);
      expect(mockService.getMostPracticed).toHaveBeenCalledWith(10);
      expect(mockService.getRecentItems).not.toHaveBeenCalled();
    });

    it('should use default values for missing query params', async () => {
      mockGetAuthSession.mockResolvedValueOnce(null);

      const mockRequest = new NextRequest('http://localhost:3000/api/practice/track');

      await GET(mockRequest);

      expect(mockService.getRecentItems).toHaveBeenCalledWith(50);
    });

    it('should handle service errors', async () => {
      mockGetAuthSession.mockResolvedValueOnce(null);
      mockService.initialize.mockRejectedValueOnce(new Error('Service error'));

      const mockRequest = new NextRequest('http://localhost:3000/api/practice/track');

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch practice history');
    });

    it('should correctly identify guest user tier', async () => {
      mockGetAuthSession.mockResolvedValueOnce(null);

      const mockRequest = new NextRequest('http://localhost:3000/api/practice/track');

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(data.userTier).toBe('guest');
      expect(mockService.initialize).toHaveBeenCalledWith(undefined, false);
    });
  });

  describe('DELETE /api/practice/track', () => {
    it('should delete an item for authenticated user', async () => {
      const session = mockAuthSession();
      mockGetAuthSession.mockResolvedValueOnce(session);

      mockDb.get.mockResolvedValueOnce({
        data: () => ({ subscription: { plan: 'free' } })
      } as any);

      const mockRequest = new NextRequest('http://localhost:3000/api/practice/track', {
        method: 'DELETE',
        body: JSON.stringify({ videoId: 'test123' })
      });

      const response = await DELETE(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockService.deleteItem).toHaveBeenCalledWith('test123');
    });

    it('should delete an item for guest user', async () => {
      mockGetAuthSession.mockResolvedValueOnce(null);

      const mockRequest = new NextRequest('http://localhost:3000/api/practice/track', {
        method: 'DELETE',
        body: JSON.stringify({ videoId: 'test123' })
      });

      const response = await DELETE(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockService.deleteItem).toHaveBeenCalledWith('test123');
    });

    it('should return 400 for missing videoId', async () => {
      mockGetAuthSession.mockResolvedValueOnce(null);

      const mockRequest = new NextRequest('http://localhost:3000/api/practice/track', {
        method: 'DELETE',
        body: JSON.stringify({})
      });

      const response = await DELETE(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing videoId');
      expect(mockService.deleteItem).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      mockGetAuthSession.mockResolvedValueOnce(null);
      mockService.deleteItem.mockRejectedValueOnce(new Error('Delete failed'));

      const mockRequest = new NextRequest('http://localhost:3000/api/practice/track', {
        method: 'DELETE',
        body: JSON.stringify({ videoId: 'test123' })
      });

      const response = await DELETE(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to delete practice history item');
    });
  });

  describe('Edge cases', () => {
    it('should handle malformed JSON in POST request', async () => {
      mockGetAuthSession.mockResolvedValueOnce(null);

      const mockRequest = new NextRequest('http://localhost:3000/api/practice/track', {
        method: 'POST',
        body: 'invalid json'
      });

      const response = await POST(mockRequest);

      expect(response.status).toBe(500);
    });

    it('should handle very large limit values', async () => {
      mockGetAuthSession.mockResolvedValueOnce(null);

      const mockRequest = new NextRequest('http://localhost:3000/api/practice/track?limit=999999');

      await GET(mockRequest);

      expect(mockService.getRecentItems).toHaveBeenCalledWith(999999);
    });

    it('should handle special characters in videoId', async () => {
      mockGetAuthSession.mockResolvedValueOnce(null);

      const mockRequest = new NextRequest('http://localhost:3000/api/practice/track', {
        method: 'DELETE',
        body: JSON.stringify({ videoId: 'test-123_ABC.xyz' })
      });

      const response = await DELETE(mockRequest);

      expect(response.status).toBe(200);
      expect(mockService.deleteItem).toHaveBeenCalledWith('test-123_ABC.xyz');
    });

    it('should handle concurrent requests', async () => {
      mockGetAuthSession.mockResolvedValue(null);

      const requests = Array.from({ length: 5 }, (_, i) =>
        new NextRequest('http://localhost:3000/api/practice/track', {
          method: 'POST',
          body: JSON.stringify({
            videoUrl: `https://youtube.com/watch?v=test${i}`,
            videoTitle: `Test Video ${i}`,
            videoId: `test${i}`
          })
        })
      );

      const responses = await Promise.all(requests.map(req => POST(req)));

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      expect(mockService.addOrUpdateItem).toHaveBeenCalledTimes(5);
    });
  });
});