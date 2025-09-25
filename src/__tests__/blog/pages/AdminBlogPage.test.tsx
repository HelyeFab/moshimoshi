import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminBlogPage from '@/app/admin/blog/page';
import { renderWithProviders, createMockBlogPosts, createMockBlogPost } from '../test-utils';
import * as blogService from '@/services/blogService';
import { useRouter } from 'next/navigation';
import { Timestamp } from 'firebase/firestore';

// Mock blog service
jest.mock('@/services/blogService');

// Mock router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

describe('AdminBlogPage', () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });

    // Mock window.open
    global.window.open = jest.fn();

    // Mock sessionStorage
    const mockSessionStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };
    Object.defineProperty(window, 'sessionStorage', {
      value: mockSessionStorage,
      writable: true
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner initially', () => {
      (blogService.getAllBlogPosts as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderWithProviders(<AdminBlogPage />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should hide loading spinner after data loads', async () => {
      (blogService.getAllBlogPosts as jest.Mock).mockResolvedValue([]);

      renderWithProviders(<AdminBlogPage />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no posts', async () => {
      (blogService.getAllBlogPosts as jest.Mock).mockResolvedValue([]);

      renderWithProviders(<AdminBlogPage />);

      await waitFor(() => {
        expect(screen.getByText(/no blog posts yet/i)).toBeInTheDocument();
        expect(screen.getByText(/create your first blog post/i)).toBeInTheDocument();
      });
    });

    it('should navigate to create page from empty state', async () => {
      const user = userEvent.setup();
      (blogService.getAllBlogPosts as jest.Mock).mockResolvedValue([]);

      renderWithProviders(<AdminBlogPage />);

      await waitFor(() => {
        expect(screen.getByText(/no blog posts yet/i)).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /create new post/i });
      await user.click(createButton);

      expect(mockPush).toHaveBeenCalledWith('/admin/blog/new');
    });
  });

  describe('Posts List', () => {
    const mockPosts = createMockBlogPosts(5);

    beforeEach(() => {
      (blogService.getAllBlogPosts as jest.Mock).mockResolvedValue(mockPosts);
    });

    it('should display all posts in table view (desktop)', async () => {
      renderWithProviders(<AdminBlogPage />);

      await waitFor(() => {
        mockPosts.forEach(post => {
          expect(screen.getByText(post.title)).toBeInTheDocument();
          expect(screen.getByText(post.slug)).toBeInTheDocument();
        });
      });
    });

    it('should display correct status badges', async () => {
      const postsWithStatus = [
        createMockBlogPost({ title: 'Draft Post', status: 'draft' }),
        createMockBlogPost({ title: 'Published Post', status: 'published' }),
        createMockBlogPost({ title: 'Scheduled Post', status: 'scheduled' }),
      ];

      (blogService.getAllBlogPosts as jest.Mock).mockResolvedValue(postsWithStatus);

      renderWithProviders(<AdminBlogPage />);

      await waitFor(() => {
        expect(screen.getByText('Draft')).toBeInTheDocument();
        expect(screen.getByText('Published')).toBeInTheDocument();
        expect(screen.getByText('Scheduled')).toBeInTheDocument();
      });
    });

    it('should format dates correctly', async () => {
      const post = createMockBlogPost({
        publishDate: Timestamp.fromDate(new Date('2024-01-15')),
      });

      (blogService.getAllBlogPosts as jest.Mock).mockResolvedValue([post]);

      renderWithProviders(<AdminBlogPage />);

      await waitFor(() => {
        expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument();
      });
    });

    it('should sort posts by date (newest first)', async () => {
      const oldPost = createMockBlogPost({
        title: 'Old Post',
        publishDate: Timestamp.fromDate(new Date('2024-01-01')),
      });
      const newPost = createMockBlogPost({
        title: 'New Post',
        publishDate: Timestamp.fromDate(new Date('2024-01-15')),
      });

      (blogService.getAllBlogPosts as jest.Mock).mockResolvedValue([oldPost, newPost]);

      renderWithProviders(<AdminBlogPage />);

      await waitFor(() => {
        const posts = screen.getAllByRole('row');
        // First row is header, so check positions of actual post rows
        expect(posts[1]).toHaveTextContent('New Post');
        expect(posts[2]).toHaveTextContent('Old Post');
      });
    });
  });

  describe('Post Actions', () => {
    const mockPost = createMockBlogPost();

    beforeEach(() => {
      (blogService.getAllBlogPosts as jest.Mock).mockResolvedValue([mockPost]);
    });

    it('should navigate to edit page when edit button clicked', async () => {
      const user = userEvent.setup();

      renderWithProviders(<AdminBlogPage />);

      await waitFor(() => {
        expect(screen.getByText(mockPost.title)).toBeInTheDocument();
      });

      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      expect(mockPush).toHaveBeenCalledWith(`/admin/blog/${mockPost.id}/edit`);
    });

    it('should open external link for view button', async () => {
      renderWithProviders(<AdminBlogPage />);

      await waitFor(() => {
        expect(screen.getByText(mockPost.title)).toBeInTheDocument();
      });

      const viewLink = screen.getByRole('link', { name: /view/i });
      expect(viewLink).toHaveAttribute('href', `/blog/${mockPost.slug}`);
      expect(viewLink).toHaveAttribute('target', '_blank');
    });

    it('should open delete modal when delete button clicked', async () => {
      const user = userEvent.setup();

      renderWithProviders(<AdminBlogPage />);

      await waitFor(() => {
        expect(screen.getByText(mockPost.title)).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      expect(screen.getByText(/delete blog post/i)).toBeInTheDocument();
      expect(screen.getByText(/are you sure you want to delete this blog post/i)).toBeInTheDocument();
      expect(screen.getByText(`"${mockPost.title}"`)).toBeInTheDocument();
    });
  });

  describe('Delete Functionality', () => {
    const mockPost = createMockBlogPost();

    beforeEach(() => {
      (blogService.getAllBlogPosts as jest.Mock).mockResolvedValue([mockPost]);
      (blogService.deleteBlogPost as jest.Mock).mockResolvedValue(undefined);
    });

    it('should delete post when confirmed', async () => {
      const user = userEvent.setup();

      renderWithProviders(<AdminBlogPage />);

      await waitFor(() => {
        expect(screen.getByText(mockPost.title)).toBeInTheDocument();
      });

      // Open delete modal
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      // Confirm delete
      const confirmButton = screen.getByRole('button', { name: /delete/i, description: undefined });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(blogService.deleteBlogPost).toHaveBeenCalledWith(mockPost.id);
        expect(blogService.getAllBlogPosts).toHaveBeenCalledTimes(2); // Initial load + after delete
      });
    });

    it('should close modal when cancel clicked', async () => {
      const user = userEvent.setup();

      renderWithProviders(<AdminBlogPage />);

      await waitFor(() => {
        expect(screen.getByText(mockPost.title)).toBeInTheDocument();
      });

      // Open delete modal
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();

      // Cancel delete
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument();
      expect(blogService.deleteBlogPost).not.toHaveBeenCalled();
    });

    it('should show success message after deletion', async () => {
      const user = userEvent.setup();

      renderWithProviders(<AdminBlogPage />);

      await waitFor(() => {
        expect(screen.getByText(mockPost.title)).toBeInTheDocument();
      });

      // Open delete modal and confirm
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      const confirmButton = screen.getByRole('button', { name: /delete/i, description: undefined });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/deleted successfully/i)).toBeInTheDocument();
      });
    });

    it('should handle deletion errors', async () => {
      const user = userEvent.setup();
      (blogService.deleteBlogPost as jest.Mock).mockRejectedValue(new Error('Delete failed'));

      renderWithProviders(<AdminBlogPage />);

      await waitFor(() => {
        expect(screen.getByText(mockPost.title)).toBeInTheDocument();
      });

      // Open delete modal and confirm
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      const confirmButton = screen.getByRole('button', { name: /delete/i, description: undefined });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to delete/i)).toBeInTheDocument();
      });
    });
  });

  describe('Header Actions', () => {
    beforeEach(() => {
      (blogService.getAllBlogPosts as jest.Mock).mockResolvedValue([]);
    });

    it('should navigate to create page when create button clicked', async () => {
      const user = userEvent.setup();

      renderWithProviders(<AdminBlogPage />);

      await waitFor(() => {
        const createButton = screen.getAllByRole('button', { name: /create new/i })[0];
        expect(createButton).toBeInTheDocument();
      });

      const createButton = screen.getAllByRole('button', { name: /create new/i })[0];
      await user.click(createButton);

      expect(mockPush).toHaveBeenCalledWith('/admin/blog/new');
    });

    it('should have view blog link', async () => {
      renderWithProviders(<AdminBlogPage />);

      await waitFor(() => {
        const viewBlogLink = screen.getByRole('link', { name: /view blog/i });
        expect(viewBlogLink).toBeInTheDocument();
        expect(viewBlogLink).toHaveAttribute('href', '/blog');
        expect(viewBlogLink).toHaveAttribute('target', '_blank');
      });
    });
  });

  describe('Success Messages', () => {
    beforeEach(() => {
      (blogService.getAllBlogPosts as jest.Mock).mockResolvedValue([]);
    });

    it('should display success message from sessionStorage', async () => {
      sessionStorage.setItem('blogSuccessMessage', 'Post created successfully');

      renderWithProviders(<AdminBlogPage />);

      await waitFor(() => {
        expect(screen.getByText('Post created successfully')).toBeInTheDocument();
      });

      // Message should be removed from sessionStorage
      expect(sessionStorage.getItem('blogSuccessMessage')).toBeNull();
    });

    it('should hide success message after timeout', async () => {
      jest.useFakeTimers();
      sessionStorage.setItem('blogSuccessMessage', 'Temporary message');

      renderWithProviders(<AdminBlogPage />);

      await waitFor(() => {
        expect(screen.getByText('Temporary message')).toBeInTheDocument();
      });

      // Fast-forward time
      jest.advanceTimersByTime(3000);

      await waitFor(() => {
        expect(screen.queryByText('Temporary message')).not.toBeInTheDocument();
      });

      jest.useRealTimers();
    });
  });

  describe('Responsive Design', () => {
    const mockPosts = createMockBlogPosts(3);

    beforeEach(() => {
      (blogService.getAllBlogPosts as jest.Mock).mockResolvedValue(mockPosts);
    });

    it('should display mobile view with cards', async () => {
      // Mock mobile viewport
      global.innerWidth = 375;

      renderWithProviders(<AdminBlogPage />);

      await waitFor(() => {
        // Mobile view uses cards instead of table
        mockPosts.forEach(post => {
          expect(screen.getByText(post.title)).toBeInTheDocument();
          expect(screen.getByText(post.slug)).toBeInTheDocument();
        });
      });

      // Should not have table element in mobile view
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('should display desktop view with table', async () => {
      // Mock desktop viewport
      global.innerWidth = 1920;

      renderWithProviders(<AdminBlogPage />);

      await waitFor(() => {
        // Desktop view uses table
        expect(screen.getByRole('table')).toBeInTheDocument();
      });
    });
  });

  describe('View Counter', () => {
    it('should display view count for posts', async () => {
      const post = createMockBlogPost({ views: 123 });
      (blogService.getAllBlogPosts as jest.Mock).mockResolvedValue([post]);

      renderWithProviders(<AdminBlogPage />);

      await waitFor(() => {
        expect(screen.getByText('123')).toBeInTheDocument();
      });
    });

    it('should display 0 for posts without views', async () => {
      const post = createMockBlogPost({ views: undefined });
      (blogService.getAllBlogPosts as jest.Mock).mockResolvedValue([post]);

      renderWithProviders(<AdminBlogPage />);

      await waitFor(() => {
        // Find the views cell
        const viewsCells = screen.getAllByText('0');
        expect(viewsCells.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch errors gracefully', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      (blogService.getAllBlogPosts as jest.Mock).mockRejectedValue(new Error('Fetch failed'));

      renderWithProviders(<AdminBlogPage />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      expect(consoleError).toHaveBeenCalledWith('Error fetching posts:', expect.any(Error));

      consoleError.mockRestore();
    });

    it('should handle malformed data gracefully', async () => {
      const malformedPost = {
        id: 'bad-post',
        title: 'Malformed Post',
        // Missing required fields
      };

      (blogService.getAllBlogPosts as jest.Mock).mockResolvedValue([malformedPost]);

      renderWithProviders(<AdminBlogPage />);

      await waitFor(() => {
        expect(screen.getByText('Malformed Post')).toBeInTheDocument();
      });
    });
  });
});