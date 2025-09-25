import { ResourceFormData, ResourceListItem, ResourcePost } from '@/types/resources';

export function validateResourceFormData(data: any): string[] {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    errors.push('Invalid form data');
    return errors;
  }

  if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
    errors.push('Title is required');
  }

  if (!data.excerpt || typeof data.excerpt !== 'string' || data.excerpt.trim().length === 0) {
    errors.push('Excerpt is required');
  }

  if (!data.content || typeof data.content !== 'string' || data.content.trim().length === 0) {
    errors.push('Content is required');
  }

  if (!data.status || !['draft', 'published', 'scheduled'].includes(data.status)) {
    errors.push('Valid status is required');
  }

  if (!data.slug || typeof data.slug !== 'string' || data.slug.trim().length === 0) {
    errors.push('Slug is required');
  }

  return errors;
}

export function prepareResourceForSaving(formData: ResourceFormData, authorId: string): any {
  return {
    title: formData.title,
    subtitle: formData.subtitle || '',
    slug: formData.slug,
    content: formData.content,
    excerpt: formData.excerpt,
    imageUrl: formData.imageUrl || '',
    imageAlt: formData.imageAlt || '',
    externalUrl: formData.externalUrl,
    status: formData.status,
    scheduledFor: formData.scheduledFor ? new Date(formData.scheduledFor) : null,
    tags: formData.tags || [],
    category: formData.category || '',
    isPremium: formData.isPremium || false,
    seoTitle: formData.seoTitle || formData.title,
    seoDescription: formData.seoDescription || formData.excerpt,
    featured: formData.featured || false,
    isPillStyle: formData.isPillStyle || false,
    author: {
      id: authorId,
      name: '',
      email: ''
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    views: 0,
    readingTimeMinutes: Math.ceil(formData.content.split(' ').length / 200) // Rough estimate
  };
}

export function prepareResourceForUpdate(formData: ResourceFormData): any {
  const updates: any = {
    title: formData.title,
    subtitle: formData.subtitle || '',
    slug: formData.slug,
    content: formData.content,
    excerpt: formData.excerpt,
    imageUrl: formData.imageUrl || '',
    imageAlt: formData.imageAlt || '',
    externalUrl: formData.externalUrl,
    status: formData.status,
    tags: formData.tags || [],
    category: formData.category || '',
    isPremium: formData.isPremium || false,
    seoTitle: formData.seoTitle || formData.title,
    seoDescription: formData.seoDescription || formData.excerpt,
    featured: formData.featured || false,
    isPillStyle: formData.isPillStyle || false,
    updatedAt: new Date(),
    readingTimeMinutes: Math.ceil(formData.content.split(' ').length / 200) // Rough estimate
  };

  // Handle scheduled date
  if (formData.scheduledFor) {
    updates.scheduledFor = new Date(formData.scheduledFor);
  }

  return updates;
}

export function formatResourceForDisplay(doc: any): ResourcePost {
  return {
    id: doc.id,
    title: doc.title || '',
    subtitle: doc.subtitle || '',
    slug: doc.slug || '',
    content: doc.content || '',
    excerpt: doc.excerpt || '',
    imageUrl: doc.imageUrl || '',
    imageAlt: doc.imageAlt || '',
    externalUrl: doc.externalUrl,
    author: doc.author || { id: '', name: 'Unknown', email: '' },
    status: doc.status || 'draft',
    publishedAt: doc.publishedAt ? (doc.publishedAt.toDate ? doc.publishedAt.toDate() : new Date(doc.publishedAt)) : undefined,
    scheduledFor: doc.scheduledFor ? (doc.scheduledFor.toDate ? doc.scheduledFor.toDate() : new Date(doc.scheduledFor)) : undefined,
    createdAt: doc.createdAt ? (doc.createdAt.toDate ? doc.createdAt.toDate() : new Date(doc.createdAt)) : new Date(),
    updatedAt: doc.updatedAt ? (doc.updatedAt.toDate ? doc.updatedAt.toDate() : new Date(doc.updatedAt)) : new Date(),
    tags: doc.tags || [],
    category: doc.category || '',
    readingTimeMinutes: doc.readingTimeMinutes || 1,
    views: doc.views || 0,
    isPremium: doc.isPremium || false,
    seoTitle: doc.seoTitle || doc.title || '',
    seoDescription: doc.seoDescription || doc.excerpt || '',
    featured: doc.featured || false,
    isPillStyle: doc.isPillStyle || false
  };
}

export function formatResourceListItem(doc: any): ResourceListItem {
  return {
    id: doc.id,
    title: doc.title || '',
    status: doc.status || 'draft',
    publishedAt: doc.publishedAt ? (doc.publishedAt.toDate ? doc.publishedAt.toDate() : new Date(doc.publishedAt)) : undefined,
    views: doc.views || 0,
    featured: doc.featured || false,
    category: doc.category || '',
    tags: doc.tags || [],
    updatedAt: doc.updatedAt ? (doc.updatedAt.toDate ? doc.updatedAt.toDate() : new Date(doc.updatedAt)) : new Date()
  };
}