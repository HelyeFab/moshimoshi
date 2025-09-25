import React from 'react';
import { render as rtlRender, RenderOptions } from '@testing-library/react';
import { I18nProvider } from '@/i18n/I18nContext';
import { BlogPost } from '@/services/blogService';
import { Timestamp } from 'firebase/firestore';

// Mock router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    };
  },
  usePathname() {
    return '/admin/blog';
  },
  useSearchParams() {
    return new URLSearchParams();
  },
}));

// Mock sessionStorage
const mockSessionStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
});

// Custom render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  locale?: string;
}

export function renderWithProviders(
  ui: React.ReactElement,
  { locale = 'en', ...options }: CustomRenderOptions = {}
) {
  const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
    return (
      <I18nProvider locale={locale}>
        {children}
      </I18nProvider>
    );
  };

  return rtlRender(ui, { wrapper: AllTheProviders, ...options });
}

// Mock blog post factory
export function createMockBlogPost(overrides?: Partial<BlogPost>): BlogPost {
  return {
    id: 'test-post-123',
    title: 'Test Blog Post',
    slug: 'test-blog-post',
    content: '# Test Content\n\nThis is a test blog post with **markdown**.',
    excerpt: 'This is a test blog post excerpt',
    author: 'Test Author',
    tags: ['test', 'blog', 'sample'],
    status: 'published',
    publishDate: Timestamp.fromDate(new Date('2024-01-15')),
    createdAt: Timestamp.fromDate(new Date('2024-01-10')),
    updatedAt: Timestamp.fromDate(new Date('2024-01-12')),
    seoTitle: 'Test Blog Post - SEO Title',
    seoDescription: 'SEO description for test blog post',
    readingTime: '5 min read',
    views: 42,
    cover: 'https://example.com/cover.jpg',
    ogImage: 'https://example.com/og.jpg',
    ...overrides,
  };
}

// Mock multiple blog posts
export function createMockBlogPosts(count: number): BlogPost[] {
  return Array.from({ length: count }, (_, i) =>
    createMockBlogPost({
      id: `post-${i + 1}`,
      title: `Blog Post ${i + 1}`,
      slug: `blog-post-${i + 1}`,
      views: Math.floor(Math.random() * 1000),
      status: i % 3 === 0 ? 'draft' : i % 3 === 1 ? 'scheduled' : 'published',
      publishDate: Timestamp.fromDate(
        new Date(Date.now() - (count - i) * 24 * 60 * 60 * 1000)
      ),
    })
  );
}

// Wait for async operations
export const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0));

// Mock Firebase services
export const mockFirebase = {
  db: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        id: 'mock-doc-id',
        set: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue({
          exists: () => true,
          data: () => createMockBlogPost(),
          id: 'mock-doc-id',
        }),
      })),
      where: jest.fn(() => ({
        orderBy: jest.fn(() => ({
          limit: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({
              docs: [],
              empty: false,
            }),
          })),
          get: jest.fn().mockResolvedValue({
            docs: [],
            empty: false,
          }),
        })),
      })),
      orderBy: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({
          docs: [],
          empty: false,
        }),
      })),
    })),
  },
  adminDb: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        id: 'mock-doc-id',
        set: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue({
          exists: () => true,
          data: () => createMockBlogPost(),
          id: 'mock-doc-id',
        }),
      })),
      orderBy: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({
          docs: [],
        }),
      })),
    })),
  },
};

// Common test IDs for easy selection
export const testIds = {
  blogEditor: {
    titleInput: 'blog-title-input',
    slugInput: 'blog-slug-input',
    contentTextarea: 'blog-content-textarea',
    excerptTextarea: 'blog-excerpt-textarea',
    authorInput: 'blog-author-input',
    statusSelect: 'blog-status-select',
    publishDateInput: 'blog-publish-date',
    publishTimeInput: 'blog-publish-time',
    tagInput: 'blog-tag-input',
    addTagButton: 'blog-add-tag-button',
    removeTagButton: 'blog-remove-tag-button',
    seoTitleInput: 'blog-seo-title',
    seoDescriptionTextarea: 'blog-seo-description',
    previewButton: 'blog-preview-button',
    saveButton: 'blog-save-button',
    cancelButton: 'blog-cancel-button',
  },
  blogList: {
    createButton: 'blog-create-button',
    viewBlogButton: 'blog-view-button',
    postCard: 'blog-post-card',
    postTable: 'blog-post-table',
    editButton: 'blog-edit-button',
    deleteButton: 'blog-delete-button',
    viewButton: 'blog-view-post-button',
    deleteModal: 'blog-delete-modal',
    deleteConfirmButton: 'blog-delete-confirm',
    deleteCancelButton: 'blog-delete-cancel',
    successMessage: 'blog-success-message',
    loadingSpinner: 'blog-loading-spinner',
    emptyState: 'blog-empty-state',
  },
};

export * from '@testing-library/react';