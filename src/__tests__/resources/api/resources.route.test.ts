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
    collection: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      get: jest.fn(),
      add: jest.fn(),
      doc: jest.fn()
    }))
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
import { GET, POST } from '@/app/api/admin/resources/route';
import * as sessionModule from '@/lib/auth/session';
import * as adminModule from '@/lib/firebase/admin';
import {
  createMockSession,
  createMockAdminUser,
  createMockRegularUser,
  createMockFirebaseSnapshot,
  createMockResourceFormData,
  TEST_RESOURCES,
  VALIDATION_TEST_CASES
} from '../test-utils';

describe('GET /api/admin/resources', () => {
  const mockGetServerSession = sessionModule.getServerSession as jest.MockedFunction<typeof sessionModule.getServerSession>;
  const mockAdminDb = adminModule.adminDb as jest.Mocked<typeof adminModule.adminDb>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication and Authorization', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockGetServerSession.mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost:3000/api/admin/resources');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user is not admin', async () => {
      const regularUser = createMockRegularUser();
      mockGetServerSession.mockResolvedValueOnce(createMockSession({ uid: regularUser.uid }));

      mockAdminDb.collection = jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValueOnce({
            data: () => regularUser
          })
        })
      });

      const request = new NextRequest('http://localhost:3000/api/admin/resources');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Admin access required');
    });
  });

  describe('Fetching Resources', () => {
    beforeEach(() => {
      const adminUser = createMockAdminUser();
      mockGetServerSession.mockResolvedValueOnce(createMockSession({ uid: adminUser.uid }));

      mockAdminDb.collection = jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValueOnce({
            data: () => adminUser
          })
        }),
        orderBy: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        get: jest.fn()
      });
    });

    it('should return all resources when no filters are applied', async () => {
      const allResources = [...TEST_RESOURCES.published, ...TEST_RESOURCES.drafts, ...TEST_RESOURCES.scheduled];
      const mockSnapshot = createMockFirebaseSnapshot(allResources);

      mockAdminDb.collection = jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValueOnce({
            data: () => createMockAdminUser()
          })
        }),
        orderBy: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValueOnce(mockSnapshot)
        })
      });

      const request = new NextRequest('http://localhost:3000/api/admin/resources');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(5); // 2 published + 2 drafts + 1 scheduled
      expect(mockAdminDb.collection).toHaveBeenCalledWith('resources');
    });

    it('should filter resources by status when status parameter is provided', async () => {
      const mockSnapshot = createMockFirebaseSnapshot(TEST_RESOURCES.published);

      const mockWhere = jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValueOnce(mockSnapshot)
      });

      mockAdminDb.collection = jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValueOnce({
            data: () => createMockAdminUser()
          })
        }),
        orderBy: jest.fn().mockReturnValue({
          where: mockWhere
        })
      });

      const request = new NextRequest('http://localhost:3000/api/admin/resources?status=published');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(mockWhere).toHaveBeenCalledWith('status', '==', 'published');
    });

    it('should handle draft status filter', async () => {
      const mockSnapshot = createMockFirebaseSnapshot(TEST_RESOURCES.drafts);

      const mockWhere = jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValueOnce(mockSnapshot)
      });

      mockAdminDb.collection = jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValueOnce({
            data: () => createMockAdminUser()
          })
        }),
        orderBy: jest.fn().mockReturnValue({
          where: mockWhere
        })
      });

      const request = new NextRequest('http://localhost:3000/api/admin/resources?status=draft');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(mockWhere).toHaveBeenCalledWith('status', '==', 'draft');
    });

    it('should handle scheduled status filter', async () => {
      const mockSnapshot = createMockFirebaseSnapshot(TEST_RESOURCES.scheduled);

      const mockWhere = jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValueOnce(mockSnapshot)
      });

      mockAdminDb.collection = jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValueOnce({
            data: () => createMockAdminUser()
          })
        }),
        orderBy: jest.fn().mockReturnValue({
          where: mockWhere
        })
      });

      const request = new NextRequest('http://localhost:3000/api/admin/resources?status=scheduled');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(mockWhere).toHaveBeenCalledWith('status', '==', 'scheduled');
    });

    it('should return empty array when no resources exist', async () => {
      const mockSnapshot = createMockFirebaseSnapshot([]);

      mockAdminDb.collection = jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValueOnce({
            data: () => createMockAdminUser()
          })
        }),
        orderBy: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValueOnce(mockSnapshot)
        })
      });

      const request = new NextRequest('http://localhost:3000/api/admin/resources');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });

    it('should order resources by updatedAt desc', async () => {
      const mockOrderBy = jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValueOnce(createMockFirebaseSnapshot([]))
      });

      mockAdminDb.collection = jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValueOnce({
            data: () => createMockAdminUser()
          })
        }),
        orderBy: mockOrderBy
      });

      const request = new NextRequest('http://localhost:3000/api/admin/resources');
      await GET(request);

      expect(mockOrderBy).toHaveBeenCalledWith('updatedAt', 'desc');
    });

    it('should handle database errors gracefully', async () => {
      mockAdminDb.collection = jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValueOnce({
            data: () => createMockAdminUser()
          })
        }),
        orderBy: jest.fn().mockReturnValue({
          get: jest.fn().mockRejectedValueOnce(new Error('Database error'))
        })
      });

      const request = new NextRequest('http://localhost:3000/api/admin/resources');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch resources');
    });
  });
});

describe('POST /api/admin/resources', () => {
  const mockGetServerSession = sessionModule.getServerSession as jest.MockedFunction<typeof sessionModule.getServerSession>;
  const mockAdminDb = adminModule.adminDb as jest.Mocked<typeof adminModule.adminDb>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication and Authorization', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockGetServerSession.mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost:3000/api/admin/resources', {
        method: 'POST',
        body: JSON.stringify(createMockResourceFormData())
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user is not admin', async () => {
      const regularUser = createMockRegularUser();
      mockGetServerSession.mockResolvedValueOnce(createMockSession({ uid: regularUser.uid }));

      mockAdminDb.collection = jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValueOnce({
            data: () => regularUser
          })
        })
      });

      const request = new NextRequest('http://localhost:3000/api/admin/resources', {
        method: 'POST',
        body: JSON.stringify(createMockResourceFormData())
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Admin access required');
    });
  });

  describe('Resource Creation', () => {
    const adminUser = createMockAdminUser();

    beforeEach(() => {
      mockGetServerSession.mockResolvedValueOnce(createMockSession({ uid: adminUser.uid }));

      mockAdminDb.collection = jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValueOnce({
            data: () => adminUser
          })
        }),
        where: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValueOnce({ empty: true })
        }),
        add: jest.fn().mockResolvedValueOnce({ id: 'new-resource-id' })
      });
    });

    it('should create a resource successfully with valid data', async () => {
      const formData = createMockResourceFormData();
      const request = new NextRequest('http://localhost:3000/api/admin/resources', {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('new-resource-id');
      expect(data.message).toBe('Resource created successfully');
    });

    it('should return 400 for invalid form data - missing title', async () => {
      const formData = VALIDATION_TEST_CASES.missingTitle;
      const request = new NextRequest('http://localhost:3000/api/admin/resources', {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.errors).toContain('Title is required');
    });

    it('should return 400 for invalid form data - missing content', async () => {
      const formData = VALIDATION_TEST_CASES.missingContent;
      const request = new NextRequest('http://localhost:3000/api/admin/resources', {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.errors).toContain('Content is required');
    });

    it('should return 400 for invalid slug format', async () => {
      const formData = VALIDATION_TEST_CASES.invalidSlug;
      const request = new NextRequest('http://localhost:3000/api/admin/resources', {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.errors).toContain('Slug can only contain lowercase letters, numbers, and hyphens');
    });

    it('should return 400 when slug already exists', async () => {
      mockAdminDb.collection = jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValueOnce({
            data: () => adminUser
          })
        }),
        where: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValueOnce({ empty: false })
        })
      });

      const formData = createMockResourceFormData();
      const request = new NextRequest('http://localhost:3000/api/admin/resources', {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('A resource with this slug already exists');
    });

    it('should auto-generate slug if not provided', async () => {
      const mockAdd = jest.fn().mockResolvedValueOnce({ id: 'new-resource-id' });
      mockAdminDb.collection = jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValueOnce({
            data: () => adminUser
          })
        }),
        where: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValueOnce({ empty: true })
        }),
        add: mockAdd
      });

      const formData = createMockResourceFormData({ slug: '', title: 'Test Title' });
      const request = new NextRequest('http://localhost:3000/api/admin/resources', {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      const response = await POST(request);
      const addedData = mockAdd.mock.calls[0][0];

      expect(response.status).toBe(200);
      expect(addedData.slug).toBe('test-title');
    });

    it('should set author information from session', async () => {
      const mockAdd = jest.fn().mockResolvedValueOnce({ id: 'new-resource-id' });
      mockAdminDb.collection = jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValueOnce({
            data: () => adminUser
          })
        }),
        where: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValueOnce({ empty: true })
        }),
        add: mockAdd
      });

      const formData = createMockResourceFormData();
      const request = new NextRequest('http://localhost:3000/api/admin/resources', {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      await POST(request);
      const addedData = mockAdd.mock.calls[0][0];

      expect(addedData.author.id).toBe(adminUser.uid);
      expect(addedData.author.email).toBe(adminUser.email);
      expect(addedData.author.name).toBe(adminUser.displayName);
    });

    it('should handle multiple validation errors', async () => {
      const formData = createMockResourceFormData({
        title: '',
        content: '',
        slug: 'INVALID!',
        seoTitle: 'A'.repeat(61),
        status: 'scheduled',
        scheduledFor: undefined
      });

      const request = new NextRequest('http://localhost:3000/api/admin/resources', {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.errors).toContain('Title is required');
      expect(data.errors).toContain('Content is required');
      expect(data.errors).toContain('Slug can only contain lowercase letters, numbers, and hyphens');
      expect(data.errors).toContain('SEO title should be less than 60 characters');
      expect(data.errors).toContain('Scheduled date is required when status is scheduled');
    });

    it('should handle database errors gracefully', async () => {
      mockAdminDb.collection = jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValueOnce({
            data: () => adminUser
          })
        }),
        where: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValueOnce({ empty: true })
        }),
        add: jest.fn().mockRejectedValueOnce(new Error('Database error'))
      });

      const formData = createMockResourceFormData();
      const request = new NextRequest('http://localhost:3000/api/admin/resources', {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create resource');
    });

    it('should handle malformed JSON in request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/resources', {
        method: 'POST',
        body: 'invalid json'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create resource');
    });
  });
});