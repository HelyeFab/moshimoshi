export interface ResourcePost {
  id: string;
  title: string;
  subtitle?: string;
  slug: string; // URL-friendly version of title
  content: string; // Markdown content
  excerpt: string; // Short description for cards/SEO
  imageUrl?: string;
  imageAlt?: string;
  externalUrl?: string; // For quick resources from URLs
  author: {
    id: string;
    name: string;
    email: string;
  };
  status: 'draft' | 'published' | 'scheduled';
  publishedAt?: Date;
  scheduledFor?: Date;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  category?: string;
  readingTimeMinutes: number; // Auto-calculated
  views: number;
  isPremium: boolean;
  seoTitle?: string;
  seoDescription?: string;
  featured: boolean; // For highlighting important posts
  isPillStyle?: boolean; // For pill-style display format
}

export interface ResourceFormData {
  title: string;
  subtitle: string;
  slug: string;
  content: string;
  excerpt: string;
  imageUrl: string;
  imageAlt: string;
  externalUrl?: string; // For quick resources from URLs
  status: 'draft' | 'published' | 'scheduled';
  scheduledFor?: string; // ISO string for form handling
  tags: string[];
  category: string;
  isPremium: boolean;
  seoTitle: string;
  seoDescription: string;
  featured: boolean;
  isPillStyle?: boolean; // For pill-style display format
}

export interface ResourceSearchFilters {
  query?: string;
  category?: string;
  tags?: string[];
  status?: 'draft' | 'published' | 'scheduled';
  featured?: boolean;
  isPremium?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface ResourceStats {
  totalPosts: number;
  publishedPosts: number;
  draftPosts: number;
  totalViews: number;
  mostViewedPost?: {
    id: string;
    title: string;
    views: number;
  };
  recentPosts: {
    id: string;
    title: string;
    publishedAt: Date;
    views: number;
  }[];
}

// For the admin interface
export interface ResourceListItem {
  id: string;
  title: string;
  status: 'draft' | 'published' | 'scheduled';
  publishedAt?: Date;
  views: number;
  featured: boolean;
  category?: string;
  tags: string[];
  updatedAt: Date;
}

// Available categories for resources
export const RESOURCE_CATEGORIES = [
  'Study Tips',
  'Grammar',
  'Vocabulary',
  'Culture',
  'Language Learning',
  'News',
  'Technology',
  'Announcements',
  'Updates',
  'JLPT Preparation',
  'Kanji Study',
  'Speaking Practice',
  'Listening Practice',
  'Writing Practice',
  'Japanese Media'
] as const;

export type ResourceCategory = typeof RESOURCE_CATEGORIES[number];