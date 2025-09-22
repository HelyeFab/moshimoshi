'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n/I18nContext';
import { useStories } from '@/hooks/useStories';
import Navbar from '@/components/layout/Navbar';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { Story, JLPTLevel } from '@/types/story';

interface FilterState {
  jlptLevel: 'all' | JLPTLevel;
  searchTerm: string;
  sortBy: 'newest' | 'popular' | 'progress';
  theme: 'all' | string;
}

export default function StoriesPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const { stories, userProgress, loading, error } = useStories();

  const [filters, setFilters] = useState<FilterState>({
    jlptLevel: 'all',
    searchTerm: '',
    sortBy: 'newest',
    theme: 'all'
  });

  // Get unique themes from stories
  const themes = Array.from(new Set(stories.map(s => s.theme).filter(Boolean)));

  // Filter and sort stories
  const filteredStories = stories
    .filter(story => {
      // JLPT filter
      if (filters.jlptLevel !== 'all' && story.jlptLevel !== filters.jlptLevel) {
        return false;
      }

      // Theme filter
      if (filters.theme !== 'all' && story.theme !== filters.theme) {
        return false;
      }

      // Search filter
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        return (
          story.title.toLowerCase().includes(searchLower) ||
          story.description.toLowerCase().includes(searchLower) ||
          story.tags?.some(tag => tag.toLowerCase().includes(searchLower))
        );
      }

      return true;
    })
    .sort((a, b) => {
      switch (filters.sortBy) {
        case 'newest':
          return new Date(b.publishedAt || b.createdAt).getTime() -
                 new Date(a.publishedAt || a.createdAt).getTime();
        case 'popular':
          return (b.viewCount || 0) - (a.viewCount || 0);
        case 'progress':
          const progressA = userProgress.get(a.id);
          const progressB = userProgress.get(b.id);
          return (progressB?.progress || 0) - (progressA?.progress || 0);
        default:
          return 0;
      }
    });

  const getProgressPercentage = (storyId: string) => {
    const progress = userProgress.get(storyId);
    return progress?.progress || 0;
  };

  const isCompleted = (storyId: string) => {
    const progress = userProgress.get(storyId);
    return progress?.completed || false;
  };

  const handleStoryClick = (storyId: string) => {
    router.push(`/stories/${storyId}`);
  };

  if (loading) {
    return <LoadingOverlay />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background-light via-background to-background-dark dark:from-dark-900 dark:via-dark-850 dark:to-dark-900">
        <Navbar user={user} showUserMenu={true} />
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-background to-background-dark dark:from-dark-900 dark:via-dark-850 dark:to-dark-900">
      <Navbar user={user} showUserMenu={true} />

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white py-12 px-4">
        <div className="container mx-auto">
          <h1 className="text-4xl font-bold mb-4">{t('stories.title')}</h1>
          <p className="text-lg opacity-90 max-w-2xl">
            {t('stories.description')}
          </p>
          <div className="mt-6 flex flex-wrap gap-4 text-sm">
            <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
              📚 {stories.length} {t('stories.totalStories')}
            </div>
            <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
              ✅ {Array.from(userProgress.values()).filter(p => p.completed).length} {t('stories.completed')}
            </div>
            <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
              📖 {Array.from(userProgress.values()).filter(p => !p.completed && p.progress > 0).length} {t('stories.inProgress')}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="container mx-auto px-4 py-6">
        <div className="bg-white dark:bg-dark-800 rounded-lg p-4 mb-6 shadow-sm border border-gray-200 dark:border-dark-700">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <input
                type="text"
                value={filters.searchTerm}
                onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                placeholder={t('common.search')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-foreground dark:text-dark-100"
              />
            </div>

            {/* JLPT Level */}
            <select
              value={filters.jlptLevel}
              onChange={(e) => setFilters(prev => ({ ...prev, jlptLevel: e.target.value as any }))}
              className="px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-foreground dark:text-dark-100"
            >
              <option value="all">{t('common.allLevels')}</option>
              <option value="N5">N5 - {t('levels.beginner')}</option>
              <option value="N4">N4 - {t('levels.elementary')}</option>
              <option value="N3">N3 - {t('levels.intermediate')}</option>
              <option value="N2">N2 - {t('levels.upperIntermediate')}</option>
              <option value="N1">N1 - {t('levels.advanced')}</option>
            </select>

            {/* Theme */}
            <select
              value={filters.theme}
              onChange={(e) => setFilters(prev => ({ ...prev, theme: e.target.value }))}
              className="px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-foreground dark:text-dark-100"
            >
              <option value="all">{t('stories.allThemes')}</option>
              {themes.map(theme => (
                <option key={theme} value={theme}>{theme}</option>
              ))}
            </select>

            {/* Sort */}
            <select
              value={filters.sortBy}
              onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value as any }))}
              className="px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-foreground dark:text-dark-100"
            >
              <option value="newest">{t('common.newest')}</option>
              <option value="popular">{t('common.popular')}</option>
              <option value="progress">{t('stories.byProgress')}</option>
            </select>
          </div>
        </div>

        {/* Stories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredStories.map((story) => {
            const progress = getProgressPercentage(story.id);
            const completed = isCompleted(story.id);

            return (
              <div
                key={story.id}
                onClick={() => handleStoryClick(story.id)}
                className="bg-white dark:bg-dark-800 rounded-lg shadow-md hover:shadow-xl transition-all transform hover:-translate-y-1 cursor-pointer border border-gray-200 dark:border-dark-700 overflow-hidden"
              >
                {/* Cover Image */}
                {story.coverImageUrl && (
                  <div className="relative h-48 bg-gray-200 dark:bg-dark-700">
                    <img
                      src={story.coverImageUrl}
                      alt={story.title}
                      className="w-full h-full object-cover"
                    />
                    {completed && (
                      <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {t('common.completed')}
                      </div>
                    )}
                  </div>
                )}

                <div className="p-4">
                  {/* Title and Level */}
                  <div className="mb-2">
                    <h3 className="font-semibold text-foreground dark:text-dark-100 line-clamp-1">
                      {story.title}
                    </h3>
                    {story.titleJa && (
                      <div
                        className="text-sm text-muted-foreground dark:text-dark-400 font-japanese line-clamp-1"
                        dangerouslySetInnerHTML={{ __html: story.titleJa }}
                      />
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground dark:text-dark-400 mb-3 line-clamp-2">
                    {story.description}
                  </p>

                  {/* Metadata */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded text-xs">
                      {story.jlptLevel}
                    </span>
                    <span className="px-2 py-1 bg-gray-100 dark:bg-dark-700 rounded text-xs">
                      {story.theme}
                    </span>
                    <span className="px-2 py-1 bg-gray-100 dark:bg-dark-700 rounded text-xs">
                      {story.pages.length} {t('stories.pages')}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  {progress > 0 && (
                    <div className="mb-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground dark:text-dark-400">
                          {t('common.progress')}
                        </span>
                        <span className="font-medium">{progress}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground dark:text-dark-400">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        {story.viewCount || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {story.completionCount || 0}
                      </span>
                    </div>
                    {story.averageQuizScore && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        {Math.round(story.averageQuizScore)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredStories.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-xl font-semibold mb-2">{t('stories.noResults')}</h3>
            <p className="text-muted-foreground dark:text-dark-400">
              {filters.searchTerm || filters.jlptLevel !== 'all' || filters.theme !== 'all'
                ? t('stories.tryDifferentFilters')
                : t('stories.noStoriesYet')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}