'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/I18nContext';
import { formatDistanceToNow } from 'date-fns';
import { marked } from 'marked';
import { useAuth } from '@/hooks/useAuth';
import Navbar from '@/components/layout/Navbar';
import { getGradientForBook } from '@/lib/utils/gradients';
import { readOfflineListCache } from '@/lib/pwa/offline-list-cache';

interface Resource {
  id: string;
  title: string;
  description: string;
  content: string;
  imageUrl?: string;
  imageAlt?: string;
  status: string;
  category: string;
  tags: string[];
  featured: boolean;
  views: number;
  publishedAt: Date;
  updatedAt: Date;
  author?: {
    name: string;
    avatar?: string;
  };
}

// Helper function to safely format dates
function formatPublishedDate(dateValue: any): string {
  try {
    if (!dateValue) return 'Recently';
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return 'Recently';
    return formatDistanceToNow(date, { addSuffix: true });
  } catch (error) {
    return 'Recently';
  }
}

export default function ResourceDetailPage() {
  const { t, strings } = useI18n();
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const offlineCacheKey = 'offline-resources';
  const [resource, setResource] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);
  const [relatedResources, setRelatedResources] = useState<Resource[]>([]);
  const [hasTrackedView, setHasTrackedView] = useState(false);

  useEffect(() => {
    if (params.id && !hasTrackedView) {
      loadResource(params.id as string);
      setHasTrackedView(true);
    }
  }, [params.id, hasTrackedView]);

  const loadResource = async (id: string) => {
    try {
      setLoading(true);
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      if (isOffline) {
        const cached = readOfflineListCache<Resource>(offlineCacheKey);
        const cachedResource = cached?.items?.find(item => item.id === id);
        if (cachedResource) {
          setResource(cachedResource);
          setRelatedResources([]);
          return;
        }
        throw new Error('Offline with no cached resource');
      }
      const response = await fetch(`/api/resources/${id}`);

      if (!response.ok) {
        router.push('/resources');
        return;
      }

      const data = await response.json();
      setResource(data);

      // Load related resources
      if (data.category) {
        loadRelatedResources(data.category, id);
      }
    } catch (error) {
      console.error('Error loading resource:', error);
      const cached = readOfflineListCache<Resource>(offlineCacheKey);
      const cachedResource = cached?.items?.find(item => item.id === id);
      if (cachedResource) {
        setResource(cachedResource);
        setRelatedResources([]);
        return;
      }
      router.push('/resources');
    } finally {
      setLoading(false);
    }
  };

  const loadRelatedResources = async (category: string, excludeId: string) => {
    try {
      const response = await fetch(`/api/resources/related?category=${category}&exclude=${excludeId}`);
      if (response.ok) {
        const data = await response.json();
        setRelatedResources(data.resources || []);
      }
    } catch (error) {
      console.error('Error loading related resources:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background-light via-soft-white to-primary-50 dark:from-dark-900 dark:via-dark-850 dark:to-dark-800">
      {/* Navigation is now global - rendered in root layout */}
        <div className="container mx-auto px-4 py-16">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!resource) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background-light via-soft-white to-primary-50 dark:from-dark-900 dark:via-dark-850 dark:to-dark-800">
      {/* Navigation is now global - rendered in root layout */}
        <div className="container mx-auto px-4 py-16 text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {strings.resources?.notFound || 'Resource not found'}
          </h2>
          <button
            onClick={() => router.push('/resources')}
            className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            {strings.resources?.backToResources || 'Back to Resources'}
          </button>
        </div>
      </div>
    );
  }

  const gradient = getGradientForBook(resource.id);
  const htmlContent = marked.parse(resource.content || '') as string;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-soft-white to-primary-50 dark:from-dark-900 dark:via-dark-850 dark:to-dark-800">
      {/* Desktop Navbar */}
      <div className="hidden sm:block">
        <Navbar user={user} showUserMenu={true} />
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Resource Detail */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-dark-900 rounded-lg shadow-lg overflow-hidden">
            {/* Cover Image */}
            <div className="relative h-80 overflow-hidden">
              {resource.imageUrl ? (
                <img
                  src={resource.imageUrl}
                  alt={resource.imageAlt || resource.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className={`w-full h-full bg-gradient-to-br ${gradient} relative`}>
                  {/* Decorative pattern */}
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-8 right-8 w-48 h-48 border-8 border-white rounded-full" />
                    <div className="absolute bottom-8 left-8 w-32 h-32 border-8 border-white rounded-full" />
                  </div>
                  {/* Centered title overlay */}
                  <div className="absolute inset-0 flex items-center justify-center p-8">
                    <h1 className="text-4xl md:text-5xl font-bold text-white text-center drop-shadow-lg">
                      {resource.title}
                    </h1>
                  </div>
                </div>
              )}
            </div>

            {/* Header */}
            <div className="p-8 border-b border-gray-200 dark:border-gray-700">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                {resource.title}
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-4">
                {resource.description}
              </p>
              <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {formatPublishedDate(resource.publishedAt)}
                </span>
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  {resource.views} {strings.resources?.views || 'views'}
                </span>
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  {resource.category}
                </span>
              </div>
              {resource.tags && resource.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {resource.tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-8">
              <div
                className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-a:text-primary-600 dark:prose-a:text-primary-400 prose-img:rounded-lg prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />
            </div>

            {/* Footer */}
            <div className="p-8 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-dark-850">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => router.push('/resources')}
                  className="flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-primary-500 transition-colors"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  {strings.resources?.backToResources || 'Back to Resources'}
                </button>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {strings.resources?.lastUpdated || 'Last updated'}: {formatPublishedDate(resource.updatedAt)}
                </div>
              </div>
            </div>
          </div>

          {/* Related Resources */}
          {relatedResources.length > 0 && (
            <div className="mt-12">
              <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
                {strings.resources?.relatedResources || 'Related Resources'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {relatedResources.slice(0, 4).map(related => (
                  <div
                    key={related.id}
                    className="bg-white dark:bg-dark-900 rounded-lg shadow-md hover:shadow-lg transition-all cursor-pointer p-6"
                    onClick={() => router.push(`/resources/${related.id}`)}
                  >
                    <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
                      {related.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
                      {related.description}
                    </p>
                    <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                      <span>{related.category}</span>
                      <span>{related.views} {strings.resources?.views || 'views'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
