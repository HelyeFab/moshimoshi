import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BlogEditor } from '@/components/admin/BlogEditor';
import { renderWithProviders, createMockBlogPost } from '../test-utils';
import { Timestamp } from 'firebase/firestore';

describe('BlogEditor Component', () => {
  const mockOnSave = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('New Post Mode', () => {
    it('should render all form fields', () => {
      renderWithProviders(
        <BlogEditor onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      expect(document.getElementById('title')).toBeInTheDocument();
      expect(document.getElementById('slug')).toBeInTheDocument();
      expect(document.getElementById('content')).toBeInTheDocument();
      expect(document.getElementById('excerpt')).toBeInTheDocument();
      expect(document.getElementById('author')).toBeInTheDocument();
      expect(document.getElementById('status')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /tags/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /seo/i })).toBeInTheDocument();
    });

    it('should auto-generate slug from title', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <BlogEditor onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const titleInput = document.getElementById('title');
      const slugInput = document.getElementById('slug');

      await user.type(titleInput, 'This Is My New Blog Post!');

      expect(slugInput).toHaveValue('this-is-my-new-blog-post');
    });

    it('should handle special characters in slug generation', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <BlogEditor onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const titleInput = document.getElementById('title');
      const slugInput = document.getElementById('slug');

      await user.type(titleInput, 'Post with @#$ Special & Characters!!!');

      expect(slugInput).toHaveValue('post-with-special-characters');
    });

    it('should save new post with correct data', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <BlogEditor onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      // Fill in form fields
      await user.type(document.getElementById('title'), 'Test Post');
      await user.type(document.getElementById('content'), '# Test Content\n\nThis is test content.');
      await user.type(document.getElementById('excerpt'), 'Test excerpt');
      await user.type(screen.getByLabelText(/author/i), 'Test Author');

      const statusSelect = document.getElementById('status');
      await user.selectOptions(statusSelect, 'published');

      // Submit form
      const saveButton = screen.getByRole('button', { name: /create/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Test Post',
            slug: 'test-post',
            content: '# Test Content\n\nThis is test content.',
            excerpt: 'Test excerpt',
            author: 'Moshimoshi TeamTest Author',
            status: 'published',
          })
        );
      });
    });

    it('should handle cancel action', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <BlogEditor onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('Edit Post Mode', () => {
    const existingPost = createMockBlogPost({
      title: 'Existing Post',
      slug: 'existing-post',
      content: 'Existing content',
      excerpt: 'Existing excerpt',
      author: 'Existing Author',
      status: 'published',
      tags: ['tag1', 'tag2'],
    });

    it('should load existing post data', () => {
      renderWithProviders(
        <BlogEditor post={existingPost} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      expect(document.getElementById('title')).toHaveValue('Existing Post');
      expect(screen.getByLabelText(/url slug/i)).toHaveValue('existing-post');
      expect(document.getElementById('content')).toHaveValue('Existing content');
      expect(document.getElementById('excerpt')).toHaveValue('Existing excerpt');
      expect(screen.getByLabelText(/author/i)).toHaveValue('Existing Author');
      expect(document.getElementById('status')).toHaveValue('published');
    });

    it('should display existing tags', () => {
      renderWithProviders(
        <BlogEditor post={existingPost} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      expect(screen.getByText('tag1')).toBeInTheDocument();
      expect(screen.getByText('tag2')).toBeInTheDocument();
    });

    it('should not auto-generate slug when editing', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <BlogEditor post={existingPost} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const titleInput = document.getElementById('title');
      const slugInput = document.getElementById('slug');

      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Title');

      // Slug should remain unchanged
      expect(slugInput).toHaveValue('existing-post');
    });

    it('should update post with modified data', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <BlogEditor post={existingPost} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const titleInput = document.getElementById('title');
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Post Title');

      const saveButton = screen.getByRole('button', { name: /update/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Updated Post Title',
            slug: 'existing-post', // Should maintain existing slug
          })
        );
      });
    });
  });

  describe('Tag Management', () => {
    it('should add new tags', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <BlogEditor onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const tagInput = screen.getByPlaceholderText(/add tag/i);
      const addButton = screen.getByRole('button', { name: /add/i });

      await user.type(tagInput, 'javascript');
      await user.click(addButton);

      expect(screen.getByText('javascript')).toBeInTheDocument();

      await user.type(tagInput, 'react');
      await user.click(addButton);

      expect(screen.getByText('react')).toBeInTheDocument();
    });

    it('should add tag on Enter key', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <BlogEditor onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const tagInput = screen.getByPlaceholderText(/add tag/i);

      await user.type(tagInput, 'typescript{enter}');

      expect(screen.getByText('typescript')).toBeInTheDocument();
    });

    it('should prevent duplicate tags', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <BlogEditor onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const tagInput = screen.getByPlaceholderText(/add tag/i);
      const addButton = screen.getByRole('button', { name: /add/i });

      await user.type(tagInput, 'duplicate');
      await user.click(addButton);

      await user.type(tagInput, 'duplicate');
      await user.click(addButton);

      // Should only have one instance
      const duplicateTags = screen.getAllByText('duplicate');
      expect(duplicateTags).toHaveLength(1);
    });

    it('should remove tags', async () => {
      const user = userEvent.setup();
      const post = createMockBlogPost({ tags: ['tag1', 'tag2', 'tag3'] });

      renderWithProviders(
        <BlogEditor post={post} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      expect(screen.getByText('tag2')).toBeInTheDocument();

      // Find and click the remove button for tag2
      const tag2Element = screen.getByText('tag2');
      const removeButton = tag2Element.parentElement?.querySelector('button[type="button"]');

      if (removeButton) {
        await user.click(removeButton);
        await waitFor(() => {
          expect(screen.queryByText('tag2')).not.toBeInTheDocument();
        });
      } else {
        throw new Error('Remove button not found for tag2');
      }
      expect(screen.getByText('tag1')).toBeInTheDocument();
      expect(screen.getByText('tag3')).toBeInTheDocument();
    });

    it('should trim whitespace from tags', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <BlogEditor onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const tagInput = screen.getByPlaceholderText(/add tag/i);
      const addButton = screen.getByRole('button', { name: /add/i });

      await user.type(tagInput, '  whitespace  ');
      await user.click(addButton);

      expect(screen.getByText('whitespace')).toBeInTheDocument();
      expect(screen.queryByText('  whitespace  ')).not.toBeInTheDocument();
    });
  });

  describe('Publishing Options', () => {
    it('should show date/time fields for scheduled posts', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <BlogEditor onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const statusSelect = document.getElementById('status');
      await user.selectOptions(statusSelect, 'scheduled');

      expect(screen.getByLabelText(/publish date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/publish time/i)).toBeInTheDocument();
    });

    it('should hide date/time fields for draft posts', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <BlogEditor onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const statusSelect = document.getElementById('status');
      await user.selectOptions(statusSelect, 'draft');

      expect(screen.queryByLabelText(/publish date/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/publish time/i)).not.toBeInTheDocument();
    });

    it('should save scheduled post with correct date/time', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <BlogEditor onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      await user.type(document.getElementById('title'), 'Scheduled Post');
      await user.selectOptions(document.getElementById('status'), 'scheduled');

      const dateInput = screen.getByLabelText(/publish date/i);
      const timeInput = screen.getByLabelText(/publish time/i);

      await user.clear(dateInput);
      await user.type(dateInput, '2024-12-25');
      await user.clear(timeInput);
      await user.type(timeInput, '14:30');

      const saveButton = screen.getByRole('button', { name: /create/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'scheduled',
            publishDate: new Date('2024-12-25T14:30'),
          })
        );
      });
    });
  });

  describe('Content Preview', () => {
    it('should toggle between edit and preview modes', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <BlogEditor onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const contentTextarea = document.getElementById('content');
      await user.type(contentTextarea, '# Heading\n\n**Bold text**');

      const previewButton = screen.getByRole('button', { name: /preview/i });
      await user.click(previewButton);

      // In preview mode, textarea should not be visible
      expect(screen.queryByLabelText(/content/i)).not.toBeInTheDocument();

      // Preview content should be visible
      const preview = screen.getByText(/Bold text/);
      expect(preview).toBeInTheDocument();

      // Toggle back to edit mode
      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      expect(document.getElementById('content')).toBeInTheDocument();
    });

    it('should preserve content when toggling preview', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <BlogEditor onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const content = '# Test\n\nContent preservation test';
      const contentTextarea = document.getElementById('content');
      await user.type(contentTextarea, content);

      // Toggle to preview
      const previewButton = screen.getByRole('button', { name: /preview/i });
      await user.click(previewButton);

      // Toggle back to edit
      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      expect(document.getElementById('content')).toHaveValue(content);
    });
  });

  describe('SEO Options', () => {
    it('should save SEO fields', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <BlogEditor onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      await user.type(document.getElementById('title'), 'Main Title');
      await user.type(document.getElementById('excerpt'), 'Main excerpt');

      const seoTitleInput = screen.getByPlaceholderText(/leave empty to use post title/i);
      const seoDescInput = screen.getByPlaceholderText(/leave empty to use excerpt/i);

      await user.type(seoTitleInput, 'Custom SEO Title');
      await user.type(seoDescInput, 'Custom SEO Description');

      const saveButton = screen.getByRole('button', { name: /create/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            seoTitle: 'Custom SEO Title',
            seoDescription: 'Custom SEO Description',
          })
        );
      });
    });

    it('should default SEO fields to title and excerpt', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <BlogEditor onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      await user.type(document.getElementById('title'), 'Main Title');
      await user.type(document.getElementById('excerpt'), 'Main excerpt');

      // Leave SEO fields empty
      const saveButton = screen.getByRole('button', { name: /create/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            seoTitle: 'Main Title',
            seoDescription: 'Main excerpt',
          })
        );
      });
    });
  });

  describe('Form Validation', () => {
    it('should require title field', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <BlogEditor onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const titleInput = document.getElementById('title');
      const saveButton = screen.getByRole('button', { name: /create/i });

      // Try to save without title
      await user.click(saveButton);

      // Check for HTML5 validation
      expect(titleInput).toBeRequired();
    });

    it('should require content field', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <BlogEditor onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const contentTextarea = document.getElementById('content');
      const saveButton = screen.getByRole('button', { name: /create/i });

      await user.type(document.getElementById('title'), 'Title');
      await user.click(saveButton);

      // Check for HTML5 validation
      expect(contentTextarea).toBeRequired();
    });

    it('should require slug field', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <BlogEditor onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const slugInput = document.getElementById('slug');

      // Clear auto-generated slug
      await user.clear(slugInput);

      const saveButton = screen.getByRole('button', { name: /create/i });
      await user.click(saveButton);

      // Check for HTML5 validation
      expect(slugInput).toBeRequired();
    });
  });

  describe('Loading State', () => {
    it('should disable save button when saving', () => {
      renderWithProviders(
        <BlogEditor onSave={mockOnSave} onCancel={mockOnCancel} saving={true} />
      );

      const saveButton = screen.getByRole('button', { name: /saving/i });
      expect(saveButton).toBeDisabled();
    });

    it('should show correct button text when saving', () => {
      renderWithProviders(
        <BlogEditor onSave={mockOnSave} onCancel={mockOnCancel} saving={true} />
      );

      expect(screen.getByRole('button', { name: /saving/i })).toBeInTheDocument();
    });
  });

  describe('Internationalization', () => {
    it('should render in English', () => {
      renderWithProviders(
        <BlogEditor onSave={mockOnSave} onCancel={mockOnCancel} />,
        { locale: 'en' }
      );

      expect(screen.getByRole('heading', { name: /publishing/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /tags/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /seo/i })).toBeInTheDocument();
    });

    it('should render in Japanese', () => {
      renderWithProviders(
        <BlogEditor onSave={mockOnSave} onCancel={mockOnCancel} />,
        { locale: 'ja' }
      );

      expect(screen.getByRole('heading', { name: /公開設定/ })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /タグ/ })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /SEO/ })).toBeInTheDocument();
    });

    it('should show correct status labels in different languages', () => {
      renderWithProviders(
        <BlogEditor onSave={mockOnSave} onCancel={mockOnCancel} />,
        { locale: 'ja' }
      );

      const statusSelect = document.getElementById('status');
      expect(statusSelect).toBeInTheDocument();

      // Check option values
      const options = statusSelect.querySelectorAll('option');
      const optionTexts = Array.from(options).map(opt => opt.textContent);

      expect(optionTexts).toContain('下書き');
      expect(optionTexts).toContain('公開済み');
      expect(optionTexts).toContain('予約投稿');
    });
  });
});