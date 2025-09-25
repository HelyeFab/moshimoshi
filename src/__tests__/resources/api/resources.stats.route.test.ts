// Mock Redis client BEFORE imports
jest.mock('@/lib/redis/client', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    expire: jest.fn()
  }
}));

// Mock Firebase Admin BEFORE imports
jest.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: jest.fn()
  },
  adminAuth: {
    verifyIdToken: jest.fn()
  },
  FieldValue: {
    serverTimestamp: jest.fn(() => new Date())
  }
}));

jest.mock('@/lib/auth/session', () => ({
  getServerSession: jest.fn(),
  createSession: jest.fn(),
  deleteSession: jest.fn()
}));

import { GET } from '@/app/api/admin/resources/stats/route';
import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { mockResource, createMockSession } from '../test-utils';

describe('/api/admin/resources/stats', () => {
  const mockGetServerSession = getServerSession as jest.Mock;
  const mockAdminDb = adminDb as jest.Mocked<typeof adminDb>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should require authentication', async () => {
      mockGetServerSession.mockResolvedValueOnce(null);
      const req = new NextRequest('http://localhost:3000/api/admin/resources/stats');

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should require admin access', async () => {
      mockGetServerSession.mockResolvedValueOnce(createMockSession(false));

      const mockDoc = {
        data: () => ({ isAdmin: false })
      };

      mockAdminDb.collection = jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValueOnce(mockDoc)
        })
      }) as any;

      const req = new NextRequest('http://localhost:3000/api/admin/resources/stats');

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Admin access required');
    });

    it('should return complete stats for admin', async () => {
      mockGetServerSession.mockResolvedValueOnce(createMockSession(true));

      // Mock user doc
      const mockUserDoc = {
        data: () => ({ isAdmin: true })
      };

      // Mock resources
      const mockPublishedResources = [
        {
          id: '1',
          data: () => ({
            ...mockResource({ status: 'published', views: 100 }),
            publishedAt: { toDate: () => new Date('2024-01-20') }
          })
        },
        {
          id: '2',
          data: () => ({
            ...mockResource({ status: 'published', views: 250 }),
            publishedAt: { toDate: () => new Date('2024-01-19') }
          })
        },
        {
          id: '3',
          data: () => ({
            ...mockResource({ status: 'published', views: 75 }),
            publishedAt: { toDate: () => new Date('2024-01-18') }
          })
        }
      ];

      const mockDraftResources = [
        { id: '4', data: () => mockResource({ status: 'draft' }) },
        { id: '5', data: () => mockResource({ status: 'draft' }) }
      ];

      const mockAllResources = [...mockPublishedResources, ...mockDraftResources];

      // Mock forEach for snapshots
      const mockPublishedSnapshot = {
        size: mockPublishedResources.length,
        forEach: (callback: any) => mockPublishedResources.forEach(callback)
      };

      const mockDraftSnapshot = {
        size: mockDraftResources.length,
        forEach: (callback: any) => mockDraftResources.forEach(callback)
      };

      const mockAllSnapshot = {
        size: mockAllResources.length,
        forEach: (callback: any) => mockAllResources.forEach(callback)
      };

      // Create a mock that handles both users and resources
      const mockCollectionGet = jest.fn();
      const mockWhereGet = jest.fn();

      mockAdminDb.collection = jest.fn().mockImplementation((collectionName: string) => {
        if (collectionName === 'users') {
          return {
            doc: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValueOnce(mockUserDoc)
            })
          };
        } else {
          // Resources collection
          return {
            get: mockCollectionGet.mockResolvedValueOnce(mockAllSnapshot),
            where: jest.fn().mockImplementation((field: string, op: string, value: any) => ({
              get: mockWhereGet.mockResolvedValueOnce(
                value === 'published' ? mockPublishedSnapshot : mockDraftSnapshot
              )
            }))
          };
        }
      }) as any;

      const req = new NextRequest('http://localhost:3000/api/admin/resources/stats');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalPosts).toBe(5);
      expect(data.publishedPosts).toBe(3);
      expect(data.draftPosts).toBe(2);
      expect(data.totalViews).toBe(425); // 100 + 250 + 75
      expect(data.mostViewedPost).toBeDefined();
      expect(data.mostViewedPost.views).toBe(250);
      expect(data.recentPosts).toHaveLength(3);
    });

    it('should handle empty collections gracefully', async () => {
      mockGetServerSession.mockResolvedValueOnce(createMockSession(true));

      const mockUserDoc = {
        data: () => ({ isAdmin: true })
      };

      const emptySnapshot = {
        size: 0,
        forEach: (callback: any) => {}
      };

      mockAdminDb.collection = jest.fn().mockImplementation((collectionName: string) => {
        if (collectionName === 'users') {
          return {
            doc: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValueOnce(mockUserDoc)
            })
          };
        } else {
          return {
            get: jest.fn().mockResolvedValueOnce(emptySnapshot),
            where: jest.fn().mockReturnThis()
          };
        }
      }) as any;

      const req = new NextRequest('http://localhost:3000/api/admin/resources/stats');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalPosts).toBe(0);
      expect(data.publishedPosts).toBe(0);
      expect(data.draftPosts).toBe(0);
      expect(data.totalViews).toBe(0);
      expect(data.recentPosts).toHaveLength(0);
    });

    it('should handle database errors', async () => {
      mockGetServerSession.mockResolvedValueOnce(createMockSession(true));

      mockAdminDb.collection = jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockRejectedValueOnce(new Error('Database error'))
        })
      }) as any;

      const req = new NextRequest('http://localhost:3000/api/admin/resources/stats');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch resource stats');
    });
  });
});