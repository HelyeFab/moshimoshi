import { ResourcePost, ResourceFormData, ResourceListItem, ResourceStats } from '@/types/resources';

// Mock data generators
export const createMockResourcePost = (overrides?: Partial<ResourcePost>): ResourcePost => ({
  id: 'test-resource-1',
  title: 'Test Resource Title',
  subtitle: 'Test Subtitle',
  slug: 'test-resource-title',
  content: '# Test Content\n\nThis is test content with **markdown**.',
  excerpt: 'This is a test excerpt for the resource',
  imageUrl: 'https://example.com/image.jpg',
  imageAlt: 'Test image alt text',
  author: {
    id: 'test-author-1',
    name: 'Test Author',
    email: 'test@example.com'
  },
  status: 'published',
  publishedAt: new Date('2024-01-15T10:00:00Z'),
  createdAt: new Date('2024-01-10T10:00:00Z'),
  updatedAt: new Date('2024-01-15T10:00:00Z'),
  tags: ['test', 'resource', 'mock'],
  category: 'Study Tips',
  readingTimeMinutes: 5,
  views: 100,
  isPremium: false,
  seoTitle: 'Test Resource SEO Title',
  seoDescription: 'Test resource SEO description',
  featured: false,
  ...overrides
});

export const createMockResourceFormData = (overrides?: Partial<ResourceFormData>): ResourceFormData => ({
  title: 'New Resource Title',
  subtitle: 'New Subtitle',
  slug: 'new-resource-title',
  content: '# New Content\n\nThis is new content.',
  excerpt: 'New excerpt',
  imageUrl: 'https://example.com/new-image.jpg',
  imageAlt: 'New image alt',
  status: 'draft',
  tags: ['new', 'draft'],
  category: 'Grammar',
  isPremium: false,
  seoTitle: 'New SEO Title',
  seoDescription: 'New SEO description',
  featured: false,
  ...overrides
});

export const createMockResourceListItem = (overrides?: Partial<ResourceListItem>): ResourceListItem => ({
  id: 'list-item-1',
  title: 'List Item Title',
  status: 'published',
  publishedAt: new Date('2024-01-15T10:00:00Z'),
  views: 50,
  featured: false,
  category: 'Vocabulary',
  tags: ['vocab', 'test'],
  updatedAt: new Date('2024-01-15T10:00:00Z'),
  ...overrides
});

export const createMockResourceStats = (overrides?: Partial<ResourceStats>): ResourceStats => ({
  totalPosts: 25,
  publishedPosts: 20,
  draftPosts: 5,
  totalViews: 1500,
  mostViewedPost: {
    id: 'most-viewed-1',
    title: 'Most Popular Resource',
    views: 500
  },
  recentPosts: [
    {
      id: 'recent-1',
      title: 'Recent Post 1',
      publishedAt: new Date('2024-01-20T10:00:00Z'),
      views: 25
    },
    {
      id: 'recent-2',
      title: 'Recent Post 2',
      publishedAt: new Date('2024-01-19T10:00:00Z'),
      views: 15
    }
  ],
  ...overrides
});

// Mock Firebase data
export const createMockFirebaseDoc = (data: any, id: string) => ({
  id,
  data: () => data,
  exists: true,
  ref: { id }
});

export const createMockFirebaseSnapshot = (docs: any[]) => ({
  docs: docs.map((doc, i) => createMockFirebaseDoc(doc, doc.id || `doc-${i}`)),
  empty: docs.length === 0,
  size: docs.length,
  forEach: (callback: (doc: any) => void) => {
    docs.forEach((doc, i) => callback(createMockFirebaseDoc(doc, doc.id || `doc-${i}`)));
  }
});

// Mock session data
export const createMockSession = (overrides?: any) => ({
  uid: 'test-user-123',
  email: 'admin@example.com',
  isAdmin: true,
  ...overrides
});

export const createMockAdminUser = (overrides?: any) => ({
  uid: 'admin-user-123',
  email: 'admin@example.com',
  displayName: 'Admin User',
  isAdmin: true,
  ...overrides
});

export const createMockRegularUser = (overrides?: any) => ({
  uid: 'regular-user-123',
  email: 'user@example.com',
  displayName: 'Regular User',
  isAdmin: false,
  ...overrides
});

// Test data sets for various scenarios
export const TEST_RESOURCES = {
  published: [
    createMockResourceListItem({
      id: 'pub-1',
      title: 'Published Resource 1',
      status: 'published',
      views: 150,
      category: 'Grammar'
    }),
    createMockResourceListItem({
      id: 'pub-2',
      title: 'Published Resource 2',
      status: 'published',
      views: 200,
      featured: true
    })
  ],
  drafts: [
    createMockResourceListItem({
      id: 'draft-1',
      title: 'Draft Resource 1',
      status: 'draft',
      publishedAt: undefined
    }),
    createMockResourceListItem({
      id: 'draft-2',
      title: 'Draft Resource 2',
      status: 'draft',
      publishedAt: undefined
    })
  ],
  scheduled: [
    createMockResourceListItem({
      id: 'sched-1',
      title: 'Scheduled Resource',
      status: 'scheduled',
      publishedAt: undefined
    })
  ]
};

// Validation test cases
export const VALIDATION_TEST_CASES = {
  valid: createMockResourceFormData(),
  missingTitle: createMockResourceFormData({ title: '' }),
  missingContent: createMockResourceFormData({ content: '' }),
  invalidSlug: createMockResourceFormData({ slug: 'Invalid Slug!' }),
  longSeoTitle: createMockResourceFormData({
    seoTitle: 'A'.repeat(61) // Over 60 char limit
  }),
  longSeoDescription: createMockResourceFormData({
    seoDescription: 'A'.repeat(161) // Over 160 char limit
  }),
  scheduledWithoutDate: createMockResourceFormData({
    status: 'scheduled',
    scheduledFor: undefined
  })
};

// i18n test strings
export const MOCK_I18N_STRINGS = {
  en: {
    common: {
      cancel: 'Cancel',
      confirm: 'Confirm',
      delete: 'Delete',
      save: 'Save',
      loading: 'Loading...'
    },
    admin: {
      resources: {
        title: 'Resources',
        description: 'Manage blog posts and learning resources',
        newResource: 'New Resource',
        searchResources: 'Search resources...',
        allStatus: 'All Status',
        published: 'Published',
        draft: 'Draft',
        scheduled: 'Scheduled',
        selected: 'selected',
        deleteSelected: 'Delete Selected',
        clearSelection: 'Clear Selection',
        loadingResources: 'Loading resources...',
        noResourcesFound: 'No resources found',
        noResourcesMatching: 'No resources matching your search',
        selectAll: 'Select All',
        featured: 'Featured',
        uncategorized: 'Uncategorized',
        views: 'views',
        edit: 'Edit',
        view: 'View',
        delete: 'Delete',
        actions: 'Actions',
        status: 'Status',
        category: 'Category',
        updated: 'Updated',
        totalPosts: 'Total Posts',
        totalViews: 'Total Views',
        deleteResource: 'Delete Resource',
        deleteResourceConfirm: 'Are you sure you want to delete this resource? This action cannot be undone.',
        deleteResources: 'Delete Resources',
        deleteResourcesConfirm: 'Are you sure you want to delete {count} resources? This action cannot be undone.',
        error: 'Error',
        failedToDelete: 'Failed to delete resource',
        failedToDeleteSome: 'Failed to delete some resources',
        cancel: 'Cancel',
        errors: {
          loadFailed: 'Failed to load resources'
        }
      }
    },
    loading: {
      general: 'Loading...'
    }
  }
};