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

import { NextRequest } from 'next/server';
import { GET, PUT, DELETE } from '@/app/api/admin/resources/[id]/route';
import * as sessionModule from '@/lib/auth/session';
import * as adminModule from '@/lib/firebase/admin';
import {
  createMockSession,
  createMockAdminUser,
  createMockResourcePost,
  createMockResourceFormData,
} from '../test-utils';

describe('Resource CRUD Operations', () => {
  const mockGetServerSession = sessionModule.getServerSession as jest.MockedFunction<typeof sessionModule.getServerSession>;
  const mockAdminDb = adminModule.adminDb as jest.Mocked<typeof adminModule.adminDb>;

  const resourceId = 'test-resource-123';
  const params = { id: resourceId };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/admin/resources/[id]', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockGetServerSession.mockResolvedValueOnce(null);

      const request = new NextRequest(`http://localhost:3000/api/admin/resources/${resourceId}`);
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return resource when authenticated', async () => {
      const mockResource = createMockResourcePost({ id: resourceId });
      mockGetServerSession.mockResolvedValueOnce(createMockSession());

      const mockDoc = {
        get: jest.fn().mockResolvedValueOnce({
          exists: true,
          id: resourceId,
          data: () => mockResource
        })
      };

      mockAdminDb.collection = jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue(mockDoc)
      }) as any;

      const request = new NextRequest(`http://localhost:3000/api/admin/resources/${resourceId}`);
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(resourceId);
      expect(data.title).toBe(mockResource.title);
    });

    it('should return 404 when resource does not exist', async () => {
      mockGetServerSession.mockResolvedValueOnce(createMockSession());

      const mockDoc = {
        get: jest.fn().mockResolvedValueOnce({
          exists: false
        })
      };

      mockAdminDb.collection = jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue(mockDoc)
      }) as any;

      const request = new NextRequest(`http://localhost:3000/api/admin/resources/${resourceId}`);
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Resource not found');
    });
  });

  describe('PUT /api/admin/resources/[id]', () => {
    const adminUser = createMockAdminUser();
    const formData = createMockResourceFormData();

    it('should return 401 when user is not authenticated', async () => {
      mockGetServerSession.mockResolvedValueOnce(null);

      const request = new NextRequest(`http://localhost:3000/api/admin/resources/${resourceId}`, {
        method: 'PUT',
        body: JSON.stringify(formData)
      });
      const response = await PUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should update resource successfully with valid data', async () => {
      mockGetServerSession.mockResolvedValueOnce(createMockSession({ uid: adminUser.uid }));

      const mockUpdate = jest.fn().mockResolvedValueOnce({});
      let callCount = 0;

      mockAdminDb.collection = jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              // First call - get user
              return Promise.resolve({
                exists: () => true,
                data: () => adminUser
              });
            } else {
              // Second call - get resource
              return Promise.resolve({
                exists: true,
                data: () => createMockResourcePost()
              });
            }
          }),
          update: mockUpdate
        }),
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({ empty: true })
      }) as any;

      const request = new NextRequest(`http://localhost:3000/api/admin/resources/${resourceId}`, {
        method: 'PUT',
        body: JSON.stringify(formData)
      });
      const response = await PUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Resource updated successfully');
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should return 404 when resource does not exist', async () => {
      mockGetServerSession.mockResolvedValueOnce(createMockSession({ uid: adminUser.uid }));

      let callCount = 0;
      mockAdminDb.collection = jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              // First call - get user
              return Promise.resolve({
                exists: () => true,
                data: () => adminUser
              });
            } else {
              // Second call - resource doesn't exist
              return Promise.resolve({
                exists: false
              });
            }
          })
        })
      }) as any;

      const request = new NextRequest(`http://localhost:3000/api/admin/resources/${resourceId}`, {
        method: 'PUT',
        body: JSON.stringify(formData)
      });
      const response = await PUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Resource not found');
    });
  });

  describe('DELETE /api/admin/resources/[id]', () => {
    const adminUser = createMockAdminUser();

    it('should return 401 when user is not authenticated', async () => {
      mockGetServerSession.mockResolvedValueOnce(null);

      const request = new NextRequest(`http://localhost:3000/api/admin/resources/${resourceId}`, {
        method: 'DELETE'
      });
      const response = await DELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should delete resource successfully', async () => {
      mockGetServerSession.mockResolvedValueOnce(createMockSession({ uid: adminUser.uid }));

      const mockDelete = jest.fn().mockResolvedValueOnce({});
      let callCount = 0;

      mockAdminDb.collection = jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              // First call - get user
              return Promise.resolve({
                exists: () => true,
                data: () => adminUser
              });
            } else {
              // Second call - get resource
              return Promise.resolve({
                exists: true,
                data: () => createMockResourcePost()
              });
            }
          }),
          delete: mockDelete
        })
      }) as any;

      const request = new NextRequest(`http://localhost:3000/api/admin/resources/${resourceId}`, {
        method: 'DELETE'
      });
      const response = await DELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Resource deleted successfully');
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should return 404 when resource does not exist', async () => {
      mockGetServerSession.mockResolvedValueOnce(createMockSession({ uid: adminUser.uid }));

      let callCount = 0;
      mockAdminDb.collection = jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              // First call - get user
              return Promise.resolve({
                exists: () => true,
                data: () => adminUser
              });
            } else {
              // Second call - resource doesn't exist
              return Promise.resolve({
                exists: false
              });
            }
          })
        })
      }) as any;

      const request = new NextRequest(`http://localhost:3000/api/admin/resources/${resourceId}`, {
        method: 'DELETE'
      });
      const response = await DELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Resource not found');
    });
  });
});