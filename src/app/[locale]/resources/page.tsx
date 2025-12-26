'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/I18nContext';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Clock, Eye, Sparkles, ArrowRight } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import MobileNavSpacer from '@/components/layout/MobileNavSpacer';
import PageHeader from '@/components/ui/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import Dropdown from '@/components/ui/Dropdown';
import { getGradientForBook } from '@/lib/utils/gradients';

interface Resource {
  id: string;
  title: string;
  description: string;
  excerpt?: string;
  content: string;
  imageUrl?: string;
  imageAlt?: string;
  status: 'published' | 'draft' | 'scheduled';
  category: string;
  tags: string[];
  featured: boolean;
  views: number;
  readingTimeMinutes?: number;
  publishedAt: Date;
  updatedAt: Date;
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
      ) as string[];
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
      {/* Desktop Navbar */}
      <div className="hidden sm:block">
        <Navbar user={user} showUserMenu={true} />
      </div>

      <PageHeader
        title={t('resources.title') || 'Resources'}
        description={t('resources.description') || 'Useful Japanese learning resources'}
        backHref="/dashboard"
      />

      {/* Search and Filters */}
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/70 dark:bg-dark-900/70 backdrop-blur-xl rounded-2xl shadow-xl p-6 mb-8 border border-white/20"
        >
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder={t('resources.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 pl-12 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-dark-850 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
              />
              <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
            {categories.length > 0 && (
              <Dropdown
                value={selectedCategory}
                onChange={setSelectedCategory}
                placeholder={t('resources.allCategories')}
                options={[
                  { value: 'all', label: t('resources.allCategories') },
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
        </motion.div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"
            />
            <p className="text-gray-600 dark:text-gray-400">{t('loading.default', 'Loading...')}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredResources.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-12 bg-white/70 dark:bg-dark-900/70 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20"
          >
            <BookOpen className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {searchQuery
                ? t('resources.noResultsFound')
                : t('resources.noResources')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {searchQuery
                ? t('resources.tryDifferentSearch')
                : t('resources.checkBackLater')}
            </p>
          </motion.div>
        )}

        {/* Featured Resources */}
        <AnimatePresence>
          {!loading && featuredResources.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              className="mb-16"
            >
              <div className="flex items-center gap-3 mb-8">
                <Sparkles className="w-8 h-8 text-primary-500" />
                <h2 className="text-3xl font-bold bg-gradient-to-r from-primary-600 via-primary-500 to-primary-400 bg-clip-text text-transparent">
                  {t('resources.featured') || 'Featured'}
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {featuredResources.map((resource, index) => (
                  <FeaturedResourceCard key={resource.id} resource={resource} index={index} router={router} t={t} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Regular Resources */}
        {!loading && regularResources.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
              {t('resources.allResources')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {regularResources.map((resource, index) => (
                <ResourceCard key={resource.id} resource={resource} index={index} router={router} t={t} />
              ))}
            </div>
          </motion.div>
        )}
      </div>
      <MobileNavSpacer />
    </div>
  );
}

// Featured Resource Card Component
function FeaturedResourceCard({ resource, index, router, t }: any) {
  const gradient = getGradientForBook(resource.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ y: -8, transition: { duration: 0.3 } }}
      onClick={() => router.push(`/resources/${resource.id}`)}
      className="group relative cursor-pointer overflow-hidden rounded-3xl shadow-2xl hover:shadow-3xl transition-all duration-500"
    >
      {/* Background Image or Gradient */}
      <div className="relative h-64 overflow-hidden">
        {resource.imageUrl ? (
          <>
            <img
              src={resource.imageUrl}
              alt={resource.imageAlt || resource.title}
              className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          </>
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} relative`}>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            {/* Decorative Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-4 right-4 w-32 h-32 border-8 border-white rounded-full" />
              <div className="absolute bottom-4 left-4 w-24 h-24 border-8 border-white rotate-45" />
            </div>
          </div>
        )}

        {/* Featured Badge */}
        <div className="absolute top-4 left-4 z-10">
          <div className="flex items-center gap-2 px-4 py-2 bg-white/95 dark:bg-dark-900/95 backdrop-blur-xl rounded-full shadow-xl">
            <Sparkles className="w-4 h-4 text-primary-500" />
            <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
              {t('resources.featured') || 'Featured'}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/95 dark:bg-dark-900/95 backdrop-blur-xl rounded-full shadow-lg">
            <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">{resource.views}</span>
          </div>
          {resource.readingTimeMinutes && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/95 dark:bg-dark-900/95 backdrop-blur-xl rounded-full shadow-lg">
              <Clock className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {resource.readingTimeMinutes}m
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="relative bg-white dark:bg-dark-900 p-6">
        {/* Category */}
        {resource.category && (
          <span className="inline-block px-3 py-1 mb-3 text-xs font-semibold rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
            {resource.category}
          </span>
        )}

        {/* Title */}
        <h3 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-2">
          {resource.title}
        </h3>

        {/* Description */}
        <p className="text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
          {resource.description || resource.excerpt}
        </p>

        {/* Tags */}
        {resource.tags && resource.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {resource.tags.slice(0, 3).map((tag: string) => (
              <span
                key={tag}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {formatPublishedDate(resource.publishedAt)}
          </span>
          <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-medium group-hover:gap-3 transition-all">
            <span className="text-sm">{t('common.readMore') || 'Read More'}</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Regular Resource Card Component
function ResourceCard({ resource, index, router, t }: any) {
  const gradient = getGradientForBook(resource.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      onClick={() => router.push(`/resources/${resource.id}`)}
      className="group relative cursor-pointer overflow-hidden rounded-2xl bg-white/70 dark:bg-dark-900/70 backdrop-blur-xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-white/20"
    >
      {/* Image or Gradient Header */}
      <div className="relative h-48 overflow-hidden">
        {resource.imageUrl ? (
          <>
            <img
              src={resource.imageUrl}
              alt={resource.imageAlt || resource.title}
              className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          </>
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} relative`}>
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            {/* Decorative circles */}
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-2 right-2 w-20 h-20 border-4 border-white rounded-full" />
              <div className="absolute bottom-2 left-2 w-16 h-16 border-4 border-white rounded-full" />
            </div>
          </div>
        )}

        {/* Stats Overlay */}
        <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2.5 py-1 bg-white/95 dark:bg-dark-900/95 backdrop-blur-xl rounded-full shadow-lg">
              <Eye className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
              <span className="text-xs font-medium text-gray-900 dark:text-white">{resource.views}</span>
            </div>
            {resource.readingTimeMinutes && (
              <div className="flex items-center gap-1 px-2.5 py-1 bg-white/95 dark:bg-dark-900/95 backdrop-blur-xl rounded-full shadow-lg">
                <Clock className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
                <span className="text-xs font-medium text-gray-900 dark:text-white">
                  {resource.readingTimeMinutes}m
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Category */}
        {resource.category && (
          <span className="inline-block px-2.5 py-1 mb-3 text-xs font-semibold rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
            {resource.category}
          </span>
        )}

        {/* Title */}
        <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-2">
          {resource.title}
        </h3>

        {/* Description */}
        <p className="text-gray-600 dark:text-gray-300 text-sm mb-3 line-clamp-2">
          {resource.description || resource.excerpt}
        </p>

        {/* Tags */}
        {resource.tags && resource.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {resource.tags.slice(0, 2).map((tag: string) => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="text-xs text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-200 dark:border-gray-700">
          {formatPublishedDate(resource.publishedAt)}
        </div>
      </div>
    </motion.div>
  );
}
