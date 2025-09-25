import {
  saveBlogPost,
  getAllBlogPosts,
  getPublishedBlogPosts,
  getBlogPostBySlug,
  getBlogPostById,
  deleteBlogPost,
  getRelatedPosts,
  incrementBlogPostViews,
  publishScheduledPosts,
  BlogPost,
} from '@/services/blogService';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

// Mock Firebase
jest.mock('@/lib/firebase/client', () => ({
  db: {},
}));

jest.mock('firebase/firestore', () => {
  class MockTimestamp {
    constructor(public _seconds: number, public _nanoseconds: number) {}
    toDate() {
      return new Date(this._seconds * 1000);
    }
    static now() {
      return new MockTimestamp(Date.now() / 1000, 0);
    }
    static fromDate(date: Date) {
      return new MockTimestamp(date.getTime() / 1000, 0);
    }
  }

  return {
    collection: jest.fn(),
    doc: jest.fn(),
    getDoc: jest.fn(),
    getDocs: jest.fn(),
    setDoc: jest.fn(),
    updateDoc: jest.fn(),
    deleteDoc: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    Timestamp: MockTimestamp,
    serverTimestamp: jest.fn(() => new Date()),
  };
});

describe('blogService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveBlogPost', () => {
    it('should create a new blog post', async () => {
      const mockId = 'new-post-id';
      const mockDocRef = { id: mockId };

      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (collection as jest.Mock).mockReturnValue({});
      (setDoc as jest.Mock).mockResolvedValue(undefined);

      const newPost = {
        title: 'New Post',
        content: 'This is a new post with some content for testing.',
        author: 'Test Author',
        tags: ['test', 'new'],
        status: 'draft' as const,
      };

      const result = await saveBlogPost(newPost);

      expect(result).toBe(mockId);
      expect(setDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          id: mockId,
          title: 'New Post',
          slug: 'new-post',
          readingTime: '1 min read',
        })
      );
    });

    it('should update an existing blog post', async () => {
      const existingId = 'existing-post-id';
      const mockDocRef = { id: existingId };

      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const updatedPost = {
        title: 'Updated Post',
        content: 'Updated content that is longer to test reading time calculation with more words.',
      };

      const result = await saveBlogPost(updatedPost, existingId);

      expect(result).toBe(existingId);
      expect(updateDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          title: 'Updated Post',
          readingTime: '1 min read',
        })
      );
    });

    it('should calculate reading time correctly', async () => {
      const mockId = 'test-id';
      const mockDocRef = { id: mockId };

      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (collection as jest.Mock).mockReturnValue({});
      (setDoc as jest.Mock).mockResolvedValue(undefined);

      // Create content with exactly 400 words (should be 2 min read at 200 wpm)
      const words = Array(400).fill('word').join(' ');
      const post = {
        title: 'Reading Time Test',
        content: words,
      };

      await saveBlogPost(post);

      expect(setDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          readingTime: '2 min read',
        })
      );
    });

    it('should generate slug from title', async () => {
      const mockId = 'test-id';
      const mockDocRef = { id: mockId };

      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (collection as jest.Mock).mockReturnValue({});
      (setDoc as jest.Mock).mockResolvedValue(undefined);

      const post = {
        title: 'This Is A Complex Title! With Special @#$ Characters',
        content: 'Content',
      };

      await saveBlogPost(post);

      expect(setDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          slug: 'this-is-a-complex-title-with-special-characters',
        })
      );
    });

    it('should handle errors gracefully', async () => {
      (doc as jest.Mock).mockImplementation(() => {
        throw new Error('Firebase error');
      });

      const post = {
        title: 'Error Test',
        content: 'Content',
      };

      await expect(saveBlogPost(post)).rejects.toThrow('Firebase error');
    });
  });

  describe('getAllBlogPosts', () => {
    it('should fetch all blog posts including scheduled ones', async () => {
      const mockPosts = [
        { id: '1', title: 'Post 1', status: 'published', publishDate: Timestamp.now() },
        { id: '2', title: 'Post 2', status: 'draft', publishDate: Timestamp.now() },
        { id: '3', title: 'Post 3', status: 'scheduled', publishDate: Timestamp.now() },
      ];

      const mockSnapshot = {
        docs: mockPosts.map(post => ({
          id: post.id,
          data: () => post,
        })),
      };

      (query as jest.Mock).mockReturnValue('mock-query');
      (collection as jest.Mock).mockReturnValue('mock-collection');
      (orderBy as jest.Mock).mockReturnValue('mock-order');
      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);

      const result = await getAllBlogPosts(true);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(expect.objectContaining({ id: '1', title: 'Post 1' }));
      expect(orderBy).toHaveBeenCalledWith('publishDate', 'desc');
    });

    it('should exclude draft and future scheduled posts when includeScheduled is false', async () => {
      const now = new Date();
      const future = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
      const past = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Yesterday

      const mockPosts = [
        { id: '1', title: 'Published', status: 'published', publishDate: Timestamp.fromDate(past) },
        { id: '2', title: 'Draft', status: 'draft', publishDate: Timestamp.fromDate(now) },
        { id: '3', title: 'Scheduled Future', status: 'scheduled', publishDate: Timestamp.fromDate(future) },
        { id: '4', title: 'Scheduled Past', status: 'scheduled', publishDate: Timestamp.fromDate(past) },
      ];

      const mockSnapshot = {
        docs: mockPosts.map(post => ({
          id: post.id,
          data: () => post,
        })),
      };

      (query as jest.Mock).mockReturnValue('mock-query');
      (collection as jest.Mock).mockReturnValue('mock-collection');
      (orderBy as jest.Mock).mockReturnValue('mock-order');
      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);

      const result = await getAllBlogPosts(false);

      expect(result).toHaveLength(2);
      expect(result.find(p => p.title === 'Published')).toBeDefined();
      expect(result.find(p => p.title === 'Scheduled Past')).toBeDefined();
      expect(result.find(p => p.title === 'Draft')).toBeUndefined();
      expect(result.find(p => p.title === 'Scheduled Future')).toBeUndefined();
    });

    it('should handle empty results', async () => {
      const mockSnapshot = { docs: [] };

      (query as jest.Mock).mockReturnValue('mock-query');
      (collection as jest.Mock).mockReturnValue('mock-collection');
      (orderBy as jest.Mock).mockReturnValue('mock-order');
      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);

      const result = await getAllBlogPosts();

      expect(result).toHaveLength(0);
    });
  });

  describe('getPublishedBlogPosts', () => {
    it('should fetch only published posts with limit', async () => {
      const mockPosts = [
        { id: '1', title: 'Post 1', status: 'published', publishDate: Timestamp.now() },
        { id: '2', title: 'Post 2', status: 'published', publishDate: Timestamp.now() },
      ];

      const mockSnapshot = {
        docs: mockPosts.map(post => ({
          id: post.id,
          data: () => post,
        })),
      };

      (query as jest.Mock).mockReturnValue('mock-query');
      (collection as jest.Mock).mockReturnValue('mock-collection');
      (where as jest.Mock).mockReturnValue('mock-where');
      (orderBy as jest.Mock).mockReturnValue('mock-order');
      (limit as jest.Mock).mockReturnValue('mock-limit');
      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);

      const result = await getPublishedBlogPosts(5);

      expect(result).toHaveLength(2);
      expect(where).toHaveBeenCalledWith('status', 'in', ['published', 'scheduled']);
      expect(limit).toHaveBeenCalledWith(5);
    });

    it('should filter out future scheduled posts', async () => {
      const now = new Date();
      const future = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const mockPosts = [
        { id: '1', title: 'Published', status: 'published', publishDate: Timestamp.fromDate(now) },
        { id: '2', title: 'Scheduled Past', status: 'scheduled', publishDate: Timestamp.fromDate(past) },
        { id: '3', title: 'Scheduled Future', status: 'scheduled', publishDate: Timestamp.fromDate(future) },
      ];

      const mockSnapshot = {
        docs: mockPosts.map(post => ({
          id: post.id,
          data: () => post,
        })),
      };

      (query as jest.Mock).mockReturnValue('mock-query');
      (collection as jest.Mock).mockReturnValue('mock-collection');
      (where as jest.Mock).mockReturnValue('mock-where');
      (orderBy as jest.Mock).mockReturnValue('mock-order');
      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);

      const result = await getPublishedBlogPosts();

      expect(result).toHaveLength(2);
      expect(result.find(p => p.title === 'Published')).toBeDefined();
      expect(result.find(p => p.title === 'Scheduled Past')).toBeDefined();
      expect(result.find(p => p.title === 'Scheduled Future')).toBeUndefined();
    });
  });

  describe('getBlogPostBySlug', () => {
    it('should fetch a published blog post by slug', async () => {
      const mockPost = {
        id: 'test-id',
        title: 'Test Post',
        slug: 'test-post',
        status: 'published',
        publishDate: Timestamp.now(),
      };

      const mockSnapshot = {
        empty: false,
        docs: [{
          id: mockPost.id,
          data: () => mockPost,
        }],
      };

      (query as jest.Mock).mockReturnValue('mock-query');
      (collection as jest.Mock).mockReturnValue('mock-collection');
      (where as jest.Mock).mockReturnValue('mock-where');
      (limit as jest.Mock).mockReturnValue('mock-limit');
      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);

      const result = await getBlogPostBySlug('test-post');

      expect(result).toEqual(expect.objectContaining({
        id: 'test-id',
        title: 'Test Post',
        slug: 'test-post',
      }));
      expect(where).toHaveBeenCalledWith('slug', '==', 'test-post');
      expect(limit).toHaveBeenCalledWith(1);
    });

    it('should return null for non-existent slug', async () => {
      const mockSnapshot = {
        empty: true,
        docs: [],
      };

      (query as jest.Mock).mockReturnValue('mock-query');
      (collection as jest.Mock).mockReturnValue('mock-collection');
      (where as jest.Mock).mockReturnValue('mock-where');
      (limit as jest.Mock).mockReturnValue('mock-limit');
      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);

      const result = await getBlogPostBySlug('non-existent');

      expect(result).toBeNull();
    });

    it('should return null for draft posts', async () => {
      const mockPost = {
        id: 'draft-id',
        title: 'Draft Post',
        slug: 'draft-post',
        status: 'draft',
        publishDate: Timestamp.now(),
      };

      const mockSnapshot = {
        empty: false,
        docs: [{
          id: mockPost.id,
          data: () => mockPost,
        }],
      };

      (query as jest.Mock).mockReturnValue('mock-query');
      (collection as jest.Mock).mockReturnValue('mock-collection');
      (where as jest.Mock).mockReturnValue('mock-where');
      (limit as jest.Mock).mockReturnValue('mock-limit');
      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);

      const result = await getBlogPostBySlug('draft-post');

      expect(result).toBeNull();
    });

    it('should return null for future scheduled posts', async () => {
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const mockPost = {
        id: 'scheduled-id',
        title: 'Scheduled Post',
        slug: 'scheduled-post',
        status: 'scheduled',
        publishDate: Timestamp.fromDate(future),
      };

      const mockSnapshot = {
        empty: false,
        docs: [{
          id: mockPost.id,
          data: () => mockPost,
        }],
      };

      (query as jest.Mock).mockReturnValue('mock-query');
      (collection as jest.Mock).mockReturnValue('mock-collection');
      (where as jest.Mock).mockReturnValue('mock-where');
      (limit as jest.Mock).mockReturnValue('mock-limit');
      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);

      const result = await getBlogPostBySlug('scheduled-post');

      expect(result).toBeNull();
    });
  });

  describe('getBlogPostById', () => {
    it('should fetch a blog post by ID', async () => {
      const mockPost = {
        id: 'test-id',
        title: 'Test Post',
        status: 'draft',
      };

      const mockDoc = {
        exists: () => true,
        id: mockPost.id,
        data: () => mockPost,
      };

      (doc as jest.Mock).mockReturnValue('mock-doc-ref');
      (getDoc as jest.Mock).mockResolvedValue(mockDoc);

      const result = await getBlogPostById('test-id');

      expect(result).toEqual(expect.objectContaining({
        id: 'test-id',
        title: 'Test Post',
        status: 'draft',
      }));
      expect(doc).toHaveBeenCalledWith(db, 'blogPosts', 'test-id');
    });

    it('should return null for non-existent ID', async () => {
      const mockDoc = {
        exists: () => false,
      };

      (doc as jest.Mock).mockReturnValue('mock-doc-ref');
      (getDoc as jest.Mock).mockResolvedValue(mockDoc);

      const result = await getBlogPostById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('deleteBlogPost', () => {
    it('should delete a blog post', async () => {
      const mockDocRef = {};

      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (deleteDoc as jest.Mock).mockResolvedValue(undefined);

      await deleteBlogPost('test-id');

      expect(doc).toHaveBeenCalledWith(db, 'blogPosts', 'test-id');
      expect(deleteDoc).toHaveBeenCalledWith(mockDocRef);
    });

    it('should handle deletion errors', async () => {
      (doc as jest.Mock).mockReturnValue({});
      (deleteDoc as jest.Mock).mockRejectedValue(new Error('Delete failed'));

      await expect(deleteBlogPost('test-id')).rejects.toThrow('Delete failed');
    });
  });

  describe('getRelatedPosts', () => {
    it('should fetch related posts by tags', async () => {
      const mockPosts = [
        { id: '1', title: 'Related 1', slug: 'related-1', tags: ['javascript', 'react'], status: 'published' },
        { id: '2', title: 'Related 2', slug: 'related-2', tags: ['javascript'], status: 'published' },
        { id: '3', title: 'Current', slug: 'current', tags: ['javascript', 'react'], status: 'published' },
      ];

      const mockSnapshot = {
        docs: mockPosts.map(post => ({
          id: post.id,
          data: () => post,
        })),
      };

      (query as jest.Mock).mockReturnValue('mock-query');
      (collection as jest.Mock).mockReturnValue('mock-collection');
      (where as jest.Mock).mockReturnValue('mock-where');
      (orderBy as jest.Mock).mockReturnValue('mock-order');
      (limit as jest.Mock).mockReturnValue('mock-limit');
      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);

      const result = await getRelatedPosts('current', ['javascript', 'react'], 2);

      expect(result).toHaveLength(2);
      expect(result.find(p => p.slug === 'current')).toBeUndefined();
      expect(where).toHaveBeenCalledWith('tags', 'array-contains-any', ['javascript', 'react']);
      expect(limit).toHaveBeenCalledWith(3); // maxPosts + 1
    });

    it('should return empty array for no tags', async () => {
      const result = await getRelatedPosts('current', [], 3);
      expect(result).toHaveLength(0);
      expect(getDocs).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      (query as jest.Mock).mockImplementation(() => {
        throw new Error('Query failed');
      });

      const result = await getRelatedPosts('current', ['tag'], 3);
      expect(result).toHaveLength(0);
    });
  });

  describe('incrementBlogPostViews', () => {
    it('should increment view count', async () => {
      const mockDoc = {
        exists: () => true,
        data: () => ({ views: 10 }),
      };
      const mockDocRef = {};

      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (getDoc as jest.Mock).mockResolvedValue(mockDoc);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await incrementBlogPostViews('test-id');

      expect(updateDoc).toHaveBeenCalledWith(mockDocRef, { views: 11 });
    });

    it('should handle posts with no views', async () => {
      const mockDoc = {
        exists: () => true,
        data: () => ({}),
      };
      const mockDocRef = {};

      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (getDoc as jest.Mock).mockResolvedValue(mockDoc);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await incrementBlogPostViews('test-id');

      expect(updateDoc).toHaveBeenCalledWith(mockDocRef, { views: 1 });
    });

    it('should not increment for non-existent posts', async () => {
      const mockDoc = {
        exists: () => false,
      };

      (doc as jest.Mock).mockReturnValue({});
      (getDoc as jest.Mock).mockResolvedValue(mockDoc);

      await incrementBlogPostViews('non-existent');

      expect(updateDoc).not.toHaveBeenCalled();
    });

    it('should handle errors silently', async () => {
      (doc as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      // Should not throw
      await expect(incrementBlogPostViews('test-id')).resolves.toBeUndefined();
    });
  });

  describe('publishScheduledPosts', () => {
    it('should publish posts scheduled for past dates', async () => {
      const now = new Date();
      const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const mockPosts = [
        { id: '1', status: 'scheduled', publishDate: Timestamp.fromDate(past) },
        { id: '2', status: 'scheduled', publishDate: Timestamp.fromDate(past) },
      ];

      const mockSnapshot = {
        size: 2,
        docs: mockPosts.map(post => ({
          id: post.id,
          ref: { id: post.id },
          data: () => post,
        })),
      };

      (query as jest.Mock).mockReturnValue('mock-query');
      (collection as jest.Mock).mockReturnValue('mock-collection');
      (where as jest.Mock).mockReturnValueOnce('mock-where-1').mockReturnValueOnce('mock-where-2');
      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await publishScheduledPosts();

      expect(where).toHaveBeenCalledWith('status', '==', 'scheduled');
      expect(updateDoc).toHaveBeenCalledTimes(2);
      expect(updateDoc).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          status: 'published',
        })
      );
    });

    it('should handle no scheduled posts', async () => {
      const mockSnapshot = {
        size: 0,
        docs: [],
      };

      (query as jest.Mock).mockReturnValue('mock-query');
      (collection as jest.Mock).mockReturnValue('mock-collection');
      (where as jest.Mock).mockReturnValue('mock-where');
      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);

      await publishScheduledPosts();

      expect(updateDoc).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      (query as jest.Mock).mockImplementation(() => {
        throw new Error('Query failed');
      });

      // Should not throw
      await expect(publishScheduledPosts()).resolves.toBeUndefined();
    });
  });
});