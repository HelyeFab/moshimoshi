'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/I18nContext';
import { formatDistanceToNow } from 'date-fns';
import Navbar from '@/components/layout/Navbar';
import LearningPageHeader from '@/components/learn/LearningPageHeader';
import { useAuth } from '@/hooks/useAuth';
import Dropdown from '@/components/ui/Dropdown';

interface Resource {
  id: string;
  title: string;
  description: string;
  content: string;
  status: 'published' | 'draft' | 'scheduled';
  category: string;
  tags: string[];
  featured: boolean;
  views: number;
  publishedAt: Date;
  updatedAt: Date;
}

export default function ResourcesPage() {
  const { t, strings } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    loadResources();
  }, []);

  const loadResources = async () => {
    try {
      setLoading(true);
      // For public view, only fetch published resources
      const response = await fetch('/api/resources/public');

      if (!response.ok) {
        console.error('Failed to fetch resources');
        setResources([]);
        return;
      }

      const data = await response.json();
      setResources(data.resources || []);

      // Extract unique categories
      const uniqueCategories = Array.from(
        new Set(data.resources?.map((r: Resource) => r.category).filter(Boolean))
      );
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error loading resources:', error);
      setResources([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredResources = resources.filter(resource => {
    const matchesSearch = searchQuery === '' ||
      resource.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resource.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resource.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === 'all' || resource.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const featuredResources = filteredResources.filter(r => r.featured);
  const regularResources = filteredResources.filter(r => !r.featured);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-soft-white to-primary-50 dark:from-dark-900 dark:via-dark-850 dark:to-dark-800">
      <Navbar user={user} showUserMenu={true} />

      <LearningPageHeader
        title={strings.resources?.title || 'Learning Resources'}
        description={strings.resources?.subtitle || 'Discover guides, tutorials, and articles to enhance your Japanese learning journey'}
      />

      {/* Search and Filters */}
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white dark:bg-dark-900 rounded-lg shadow-md p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder={strings.resources?.searchPlaceholder || 'Search resources...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-dark-850 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            {categories.length > 0 && (
              <Dropdown
                value={selectedCategory}
                onChange={setSelectedCategory}
                placeholder={strings.resources?.allCategories || 'All Categories'}
                options={[
                  { value: 'all', label: strings.resources?.allCategories || 'All Categories' },
                  ...categories.map(cat => ({
                    value: cat,
                    label: cat.charAt(0).toUpperCase() + cat.slice(1)
                  }))
                ]}
                size="medium"
                variant="default"
              />
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">{strings.loading?.general || 'Loading...'}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredResources.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-dark-900 rounded-lg shadow-md">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {searchQuery
                ? strings.resources?.noResultsFound || 'No resources found'
                : strings.resources?.noResources || 'No resources available'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {searchQuery
                ? strings.resources?.tryDifferentSearch || 'Try adjusting your search terms'
                : strings.resources?.checkBackLater || 'Check back later for new content'}
            </p>
          </div>
        )}

        {/* Featured Resources */}
        {!loading && featuredResources.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
              {strings.resources?.featured || 'Featured Resources'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {featuredResources.map(resource => (
                <div
                  key={resource.id}
                  className="bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 border-2 border-primary-200 dark:border-primary-700 rounded-lg shadow-lg p-6 hover:shadow-xl transition-all cursor-pointer"
                  onClick={() => router.push(`/resources/${resource.id}`)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary-500 text-white">
                      {strings.resources?.featured || 'Featured'}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {resource.views} {strings.resources?.views || 'views'}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">
                    {resource.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
                    {resource.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {resource.category}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDistanceToNow(new Date(resource.publishedAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Regular Resources */}
        {!loading && regularResources.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
              {strings.resources?.allResources || 'All Resources'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {regularResources.map(resource => (
                <div
                  key={resource.id}
                  className="bg-white dark:bg-dark-900 rounded-lg shadow-md hover:shadow-lg transition-all cursor-pointer"
                  onClick={() => router.push(`/resources/${resource.id}`)}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                        {resource.category}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {resource.views} {strings.resources?.views || 'views'}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
                      {resource.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-4 line-clamp-3">
                      {resource.description}
                    </p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {resource.tags?.slice(0, 3).map(tag => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDistanceToNow(new Date(resource.publishedAt), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}