import { NextRequest } from 'next/server';
import { GET, POST, PUT, DELETE } from '@/app/api/admin/blog/route';
import { adminDb } from '@/lib/firebase/admin';
import { checkAdminAuth } from '@/lib/admin/adminAuth';
import { createMockBlogPost } from '../test-utils';

// Mock Firebase Admin
jest.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: jest.fn(),
  },
}));

// Mock Admin Auth
jest.mock('@/lib/admin/adminAuth', () => ({
  checkAdminAuth: jest.fn(),
}));

describe('Blog API Routes', () => {
  const mockCollection = {
    doc: jest.fn(),
    orderBy: jest.fn(),
    get: jest.fn(),
  };

  const mockDocRef = {
    id: 'mock-doc-id',
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (adminDb.collection as jest.Mock).mockReturnValue(mockCollection);
    mockCollection.doc.mockReturnValue(mockDocRef);
  });

  describe('Authentication', () => {
    it('should reject unauthorized GET requests', async () => {
      (checkAdminAuth as jest.Mock).mockResolvedValue({ isAdmin: false });

      const request = new NextRequest('http://localhost/api/admin/blog');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should reject unauthorized POST requests', async () => {
      (checkAdminAuth as jest.Mock).mockResolvedValue({ isAdmin: false });

      const request = new NextRequest('http://localhost/api/admin/blog', {
        method: 'POST',
        body: JSON.stringify({ title: 'Test' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should reject unauthorized PUT requests', async () => {
      (checkAdminAuth as jest.Mock).mockResolvedValue({ isAdmin: false });

      const request = new NextRequest('http://localhost/api/admin/blog', {
        method: 'PUT',
        body: JSON.stringify({ id: 'test-id', title: 'Test' }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should reject unauthorized DELETE requests', async () => {
      (checkAdminAuth as jest.Mock).mockResolvedValue({ isAdmin: false });

      const request = new NextRequest('http://localhost/api/admin/blog?id=test-id');
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('GET /api/admin/blog', () => {
    beforeEach(() => {
      (checkAdminAuth as jest.Mock).mockResolvedValue({ isAdmin: true });
    });

    it('should fetch all blog posts', async () => {
      const mockPosts = [
        createMockBlogPost({ id: '1', title: 'Post 1' }),
        createMockBlogPost({ id: '2', title: 'Post 2' }),
      ];

      const mockSnapshot = {
        docs: mockPosts.map(post => ({
          id: post.id,
          data: () => ({
            ...post,
            publishDate: post.publishDate,
            createdAt: post.createdAt,
            updatedAt: post.updatedAt,
          }),
        })),
      };

      mockCollection.orderBy.mockReturnValue({
        get: jest.fn().mockResolvedValue(mockSnapshot),
      });

      const request = new NextRequest('http://localhost/api/admin/blog');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.posts).toHaveLength(2);
      expect(data.posts[0].title).toBe('Post 1');
      expect(mockCollection.orderBy).toHaveBeenCalledWith('publishDate', 'desc');
    });

    it('should handle empty results', async () => {
      const mockSnapshot = { docs: [] };

      mockCollection.orderBy.mockReturnValue({
        get: jest.fn().mockResolvedValue(mockSnapshot),
      });

      const request = new NextRequest('http://localhost/api/admin/blog');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.posts).toHaveLength(0);
    });

    it('should handle errors gracefully', async () => {
      mockCollection.orderBy.mockImplementation(() => {
        throw new Error('Database error');
      });

      const request = new NextRequest('http://localhost/api/admin/blog');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch blog posts');
    });
  });

  describe('POST /api/admin/blog', () => {
    beforeEach(() => {
      (checkAdminAuth as jest.Mock).mockResolvedValue({ isAdmin: true });
    });

    it('should create a new blog post', async () => {
      mockDocRef.set.mockResolvedValue(undefined);

      const newPost = {
        title: 'New Post',
        content: 'This is new content for testing the API.',
        author: 'Test Author',
        status: 'draft',
      };

      const request = new NextRequest('http://localhost/api/admin/blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPost),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.id).toBe('mock-doc-id');

      expect(mockDocRef.set).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Post',
          slug: 'new-post',
          content: 'This is new content for testing the API.',
          readingTime: '1 min read',
          views: 0,
        })
      );
    });

    it('should generate slug from title', async () => {
      mockDocRef.set.mockResolvedValue(undefined);

      const newPost = {
        title: 'Complex Title With Special Characters!',
        content: 'Content',
      };

      const request = new NextRequest('http://localhost/api/admin/blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPost),
      });

      await POST(request);

      expect(mockDocRef.set).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: 'complex-title-with-special-characters',
        })
      );
    });

    it('should use provided slug if available', async () => {
      mockDocRef.set.mockResolvedValue(undefined);

      const newPost = {
        title: 'Test Post',
        slug: 'custom-slug',
        content: 'Content',
      };

      const request = new NextRequest('http://localhost/api/admin/blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPost),
      });

      await POST(request);

      expect(mockDocRef.set).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: 'custom-slug',
        })
      );
    });

    it('should calculate reading time', async () => {
      mockDocRef.set.mockResolvedValue(undefined);

      // Create content with ~400 words (2 min read)
      const longContent = Array(400).fill('word').join(' ');

      const newPost = {
        title: 'Long Post',
        content: longContent,
      };

      const request = new NextRequest('http://localhost/api/admin/blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPost),
      });

      await POST(request);

      expect(mockDocRef.set).toHaveBeenCalledWith(
        expect.objectContaining({
          readingTime: '2 min read',
        })
      );
    });

    it('should handle errors gracefully', async () => {
      mockDocRef.set.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost/api/admin/blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create blog post');
    });
  });

  describe('PUT /api/admin/blog', () => {
    beforeEach(() => {
      (checkAdminAuth as jest.Mock).mockResolvedValue({ isAdmin: true });
    });

    it('should update an existing blog post', async () => {
      mockDocRef.update.mockResolvedValue(undefined);

      const updateData = {
        id: 'existing-id',
        title: 'Updated Title',
        content: 'Updated content',
      };

      const request = new NextRequest('http://localhost/api/admin/blog', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      expect(mockCollection.doc).toHaveBeenCalledWith('existing-id');
      expect(mockDocRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Updated Title',
          content: 'Updated content',
          readingTime: '1 min read',
        })
      );
    });

    it('should require post ID', async () => {
      const request = new NextRequest('http://localhost/api/admin/blog', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test' }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Post ID is required');
    });

    it('should recalculate reading time on content update', async () => {
      mockDocRef.update.mockResolvedValue(undefined);

      const longContent = Array(600).fill('word').join(' '); // 3 min read

      const updateData = {
        id: 'test-id',
        content: longContent,
      };

      const request = new NextRequest('http://localhost/api/admin/blog', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      await PUT(request);

      expect(mockDocRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          readingTime: '3 min read',
        })
      );
    });

    it('should handle errors gracefully', async () => {
      mockDocRef.update.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost/api/admin/blog', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'test-id', title: 'Test' }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to update blog post');
    });
  });

  describe('DELETE /api/admin/blog', () => {
    beforeEach(() => {
      (checkAdminAuth as jest.Mock).mockResolvedValue({ isAdmin: true });
    });

    it('should delete a blog post', async () => {
      mockDocRef.delete.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost/api/admin/blog?id=test-id');
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      expect(mockCollection.doc).toHaveBeenCalledWith('test-id');
      expect(mockDocRef.delete).toHaveBeenCalled();
    });

    it('should require post ID', async () => {
      const request = new NextRequest('http://localhost/api/admin/blog');
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Post ID is required');
    });

    it('should handle deletion errors', async () => {
      mockDocRef.delete.mockRejectedValue(new Error('Delete failed'));

      const request = new NextRequest('http://localhost/api/admin/blog?id=test-id');
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to delete blog post');
    });
  });

  describe('Reading Time Calculation', () => {
    beforeEach(() => {
      (checkAdminAuth as jest.Mock).mockResolvedValue({ isAdmin: true });
    });

    it.each([
      ['', '1 min read'],
      ['Short content', '1 min read'],
      [Array(150).fill('word').join(' '), '1 min read'],
      [Array(200).fill('word').join(' '), '1 min read'],
      [Array(201).fill('word').join(' '), '2 min read'],
      [Array(400).fill('word').join(' '), '2 min read'],
      [Array(600).fill('word').join(' '), '3 min read'],
      [Array(1000).fill('word').join(' '), '5 min read'],
    ])('should calculate reading time for %s words', async (content, expectedTime) => {
      mockDocRef.set.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost/api/admin/blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test',
          content,
        }),
      });

      await POST(request);

      expect(mockDocRef.set).toHaveBeenCalledWith(
        expect.objectContaining({
          readingTime: expectedTime,
        })
      );
    });
  });
});