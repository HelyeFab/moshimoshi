import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, createMockBlogPost, waitForAsync } from '../test-utils';
import AdminBlogPage from '@/app/admin/blog/page';
import NewBlogPostPage from '@/app/admin/blog/new/page';
import EditBlogPostPage from '@/app/admin/blog/[id]/edit/page';
import * as blogService from '@/services/blogService';
import { useRouter } from 'next/navigation';
import { Timestamp } from 'firebase/firestore';

// Mock dependencies
jest.mock('@/services/blogService');
jest.mock('next/navigation');

describe('Blog Workflow Integration Tests', () => {
  const mockPush = jest.fn();
  let mockPosts: any[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    mockPosts = [];

    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });

    // Mock blog service to use in-memory store
    (blogService.getAllBlogPosts as jest.Mock).mockImplementation(() =>
      Promise.resolve(mockPosts)
    );

    (blogService.saveBlogPost as jest.Mock).mockImplementation((post, id) => {
      if (id) {
        const index = mockPosts.findIndex(p => p.id === id);
        if (index !== -1) {
          mockPosts[index] = { ...mockPosts[index], ...post };
        }
      } else {
        const newId = `post-${Date.now()}`;
        mockPosts.push({ ...post, id: newId });
        return Promise.resolve(newId);
      }
    });

    (blogService.deleteBlogPost as jest.Mock).mockImplementation((id) => {
      mockPosts = mockPosts.filter(p => p.id !== id);
      return Promise.resolve();
    });

    (blogService.getBlogPostById as jest.Mock).mockImplementation((id) => {
      const post = mockPosts.find(p => p.id === id);
      return Promise.resolve(post || null);
    });
  });

  describe('Complete Blog Creation Workflow', () => {
    it('should create a new blog post from start to finish', async () => {
      const user = userEvent.setup();

      // Step 1: Start on blog list page
      const { rerender } = renderWithProviders(<AdminBlogPage />);

      await waitFor(() => {
        expect(screen.getByText(/no blog posts yet/i)).toBeInTheDocument();
      });

      // Step 2: Navigate to create page
      const createButton = screen.getByRole('button', { name: /create new/i });
      await user.click(createButton);

      expect(mockPush).toHaveBeenCalledWith('/admin/blog/new');

      // Step 3: Render create page
      rerender(<NewBlogPostPage />);

      // Step 4: Fill in blog post details
      await user.type(screen.getByLabelText(/title/i), 'My First Blog Post');
      await user.type(screen.getByLabelText(/content/i), '# Welcome\n\nThis is my first blog post!');
      await user.type(screen.getByLabelText(/excerpt/i), 'An introduction to my blog');
      await user.selectOptions(screen.getByLabelText(/status/i), 'published');

      // Step 5: Add tags
      const tagInput = screen.getByPlaceholderText(/add tag/i);
      await user.type(tagInput, 'javascript{enter}');
      await user.type(tagInput, 'tutorial{enter}');

      // Step 6: Save the post
      const saveButton = screen.getByRole('button', { name: /create/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(blogService.saveBlogPost).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'My First Blog Post',
            slug: 'my-first-blog-post',
            content: '# Welcome\n\nThis is my first blog post!',
            excerpt: 'An introduction to my blog',
            status: 'published',
            tags: ['javascript', 'tutorial'],
          })
        );
      });

      // Step 7: Verify redirect
      expect(mockPush).toHaveBeenCalledWith('/admin/blog');

      // Step 8: Render blog list again
      rerender(<AdminBlogPage />);

      // Step 9: Verify the new post appears
      await waitFor(() => {
        expect(screen.getByText('My First Blog Post')).toBeInTheDocument();
        expect(screen.getByText('my-first-blog-post')).toBeInTheDocument();
      });
    });
  });

  describe('Complete Blog Editing Workflow', () => {
    beforeEach(() => {
      // Pre-populate with a post
      mockPosts = [
        createMockBlogPost({
          id: 'existing-post',
          title: 'Original Title',
          content: 'Original content',
          status: 'draft',
        }),
      ];
    });

    it('should edit an existing blog post', async () => {
      const user = userEvent.setup();

      // Step 1: Start on blog list page
      const { rerender } = renderWithProviders(<AdminBlogPage />);

      await waitFor(() => {
        expect(screen.getByText('Original Title')).toBeInTheDocument();
      });

      // Step 2: Click edit button
      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      expect(mockPush).toHaveBeenCalledWith('/admin/blog/existing-post/edit');

      // Step 3: Render edit page
      rerender(<EditBlogPostPage params={{ id: 'existing-post' }} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/title/i)).toHaveValue('Original Title');
      });

      // Step 4: Update the post
      const titleInput = screen.getByLabelText(/title/i);
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Title');

      const contentInput = screen.getByLabelText(/content/i);
      await user.clear(contentInput);
      await user.type(contentInput, 'Updated content with more information');

      await user.selectOptions(screen.getByLabelText(/status/i), 'published');

      // Step 5: Save changes
      const saveButton = screen.getByRole('button', { name: /update/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(blogService.saveBlogPost).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Updated Title',
            content: 'Updated content with more information',
            status: 'published',
          }),
          'existing-post'
        );
      });

      // Step 6: Verify redirect
      expect(mockPush).toHaveBeenCalledWith('/admin/blog');

      // Step 7: Render blog list again
      rerender(<AdminBlogPage />);

      // Step 8: Verify the updated post
      await waitFor(() => {
        expect(screen.getByText('Updated Title')).toBeInTheDocument();
        expect(screen.queryByText('Original Title')).not.toBeInTheDocument();
      });
    });
  });

  describe('Complete Blog Deletion Workflow', () => {
    beforeEach(() => {
      // Pre-populate with multiple posts
      mockPosts = [
        createMockBlogPost({ id: 'post-1', title: 'First Post' }),
        createMockBlogPost({ id: 'post-2', title: 'Second Post' }),
        createMockBlogPost({ id: 'post-3', title: 'Third Post' }),
      ];
    });

    it('should delete a blog post', async () => {
      const user = userEvent.setup();

      // Step 1: Start on blog list page
      renderWithProviders(<AdminBlogPage />);

      await waitFor(() => {
        expect(screen.getByText('First Post')).toBeInTheDocument();
        expect(screen.getByText('Second Post')).toBeInTheDocument();
        expect(screen.getByText('Third Post')).toBeInTheDocument();
      });

      // Step 2: Click delete button for second post
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[1]); // Delete second post

      // Step 3: Confirm deletion
      await waitFor(() => {
        expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
        expect(screen.getByText('"Second Post"')).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /delete/i, description: undefined });
      await user.click(confirmButton);

      // Step 4: Verify deletion
      await waitFor(() => {
        expect(blogService.deleteBlogPost).toHaveBeenCalledWith('post-2');
        expect(screen.getByText('First Post')).toBeInTheDocument();
        expect(screen.queryByText('Second Post')).not.toBeInTheDocument();
        expect(screen.getByText('Third Post')).toBeInTheDocument();
      });

      // Step 5: Verify success message
      expect(screen.getByText(/deleted successfully/i)).toBeInTheDocument();
    });
  });

  describe('Draft to Published Workflow', () => {
    it('should create draft, then edit and publish', async () => {
      const user = userEvent.setup();

      // Step 1: Create a draft post
      const { rerender } = renderWithProviders(<NewBlogPostPage />);

      await user.type(screen.getByLabelText(/title/i), 'Draft Post');
      await user.type(screen.getByLabelText(/content/i), 'Initial draft content');
      await user.selectOptions(screen.getByLabelText(/status/i), 'draft');

      const createButton = screen.getByRole('button', { name: /create/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(blogService.saveBlogPost).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Draft Post',
            status: 'draft',
          })
        );
      });

      // Get the created post ID
      const createdId = mockPosts[0].id;

      // Step 2: Edit the draft to publish it
      rerender(<EditBlogPostPage params={{ id: createdId }} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/title/i)).toHaveValue('Draft Post');
      });

      // Add more content
      const contentInput = screen.getByLabelText(/content/i);
      await user.clear(contentInput);
      await user.type(contentInput, '# Final Content\n\nThis post is now ready for publication!');

      // Change status to published
      await user.selectOptions(screen.getByLabelText(/status/i), 'published');

      // Save changes
      const updateButton = screen.getByRole('button', { name: /update/i });
      await user.click(updateButton);

      await waitFor(() => {
        expect(blogService.saveBlogPost).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'published',
          }),
          createdId
        );
      });

      // Step 3: Verify on blog list
      rerender(<AdminBlogPage />);

      await waitFor(() => {
        const statusBadge = screen.getByText('Published');
        expect(statusBadge).toBeInTheDocument();
      });
    });
  });

  describe('Scheduled Post Workflow', () => {
    it('should create and manage scheduled posts', async () => {
      const user = userEvent.setup();

      // Step 1: Create a scheduled post
      renderWithProviders(<NewBlogPostPage />);

      await user.type(screen.getByLabelText(/title/i), 'Future Post');
      await user.type(screen.getByLabelText(/content/i), 'Content for the future');
      await user.selectOptions(screen.getByLabelText(/status/i), 'scheduled');

      // Set future date
      const dateInput = screen.getByLabelText(/publish date/i);
      await user.clear(dateInput);
      await user.type(dateInput, '2025-12-25');

      const timeInput = screen.getByLabelText(/publish time/i);
      await user.clear(timeInput);
      await user.type(timeInput, '10:00');

      const createButton = screen.getByRole('button', { name: /create/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(blogService.saveBlogPost).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Future Post',
            status: 'scheduled',
            publishDate: new Date('2025-12-25T10:00'),
          })
        );
      });
    });
  });

  describe('Tag Management Workflow', () => {
    it('should add, edit, and remove tags', async () => {
      const user = userEvent.setup();

      // Step 1: Create post with initial tags
      const { rerender } = renderWithProviders(<NewBlogPostPage />);

      await user.type(screen.getByLabelText(/title/i), 'Tagged Post');
      await user.type(screen.getByLabelText(/content/i), 'Content');

      const tagInput = screen.getByPlaceholderText(/add tag/i);
      await user.type(tagInput, 'tag1{enter}');
      await user.type(tagInput, 'tag2{enter}');
      await user.type(tagInput, 'tag3{enter}');

      const createButton = screen.getByRole('button', { name: /create/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(blogService.saveBlogPost).toHaveBeenCalledWith(
          expect.objectContaining({
            tags: ['tag1', 'tag2', 'tag3'],
          })
        );
      });

      // Step 2: Edit to modify tags
      const createdId = mockPosts[0].id;
      rerender(<EditBlogPostPage params={{ id: createdId }} />);

      await waitFor(() => {
        expect(screen.getByText('tag1')).toBeInTheDocument();
        expect(screen.getByText('tag2')).toBeInTheDocument();
        expect(screen.getByText('tag3')).toBeInTheDocument();
      });

      // Remove tag2
      const tag2Container = screen.getByText('tag2').parentElement;
      const removeButton = tag2Container?.querySelector('button');
      if (removeButton) {
        await user.click(removeButton);
      }

      // Add new tag
      const editTagInput = screen.getByPlaceholderText(/add tag/i);
      await user.type(editTagInput, 'tag4{enter}');

      const updateButton = screen.getByRole('button', { name: /update/i });
      await user.click(updateButton);

      await waitFor(() => {
        expect(blogService.saveBlogPost).toHaveBeenCalledWith(
          expect.objectContaining({
            tags: ['tag1', 'tag3', 'tag4'],
          }),
          createdId
        );
      });
    });
  });

  describe('SEO Fields Workflow', () => {
    it('should manage SEO fields throughout lifecycle', async () => {
      const user = userEvent.setup();

      // Step 1: Create post with custom SEO fields
      renderWithProviders(<NewBlogPostPage />);

      await user.type(screen.getByLabelText(/title/i), 'Regular Title');
      await user.type(screen.getByLabelText(/content/i), 'Content');
      await user.type(screen.getByLabelText(/excerpt/i), 'Regular excerpt');

      // Custom SEO fields
      const seoTitle = screen.getByPlaceholderText(/leave empty to use post title/i);
      const seoDesc = screen.getByPlaceholderText(/leave empty to use excerpt/i);

      await user.type(seoTitle, 'SEO Optimized Title for Search');
      await user.type(seoDesc, 'SEO optimized description for better ranking');

      const createButton = screen.getByRole('button', { name: /create/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(blogService.saveBlogPost).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Regular Title',
            seoTitle: 'SEO Optimized Title for Search',
            seoDescription: 'SEO optimized description for better ranking',
          })
        );
      });
    });
  });

  describe('Error Recovery Workflow', () => {
    it('should handle and recover from save errors', async () => {
      const user = userEvent.setup();

      // Make save fail initially
      (blogService.saveBlogPost as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      renderWithProviders(<NewBlogPostPage />);

      await user.type(screen.getByLabelText(/title/i), 'Test Post');
      await user.type(screen.getByLabelText(/content/i), 'Content');

      const saveButton = screen.getByRole('button', { name: /create/i });
      await user.click(saveButton);

      // Should handle error gracefully
      await waitFor(() => {
        expect(blogService.saveBlogPost).toHaveBeenCalled();
      });

      // Restore functionality
      (blogService.saveBlogPost as jest.Mock).mockImplementation((post) => {
        const newId = 'recovered-post';
        mockPosts.push({ ...post, id: newId });
        return Promise.resolve(newId);
      });

      // Try again
      await user.click(saveButton);

      await waitFor(() => {
        expect(blogService.saveBlogPost).toHaveBeenCalledTimes(2);
      });
    });
  });
});