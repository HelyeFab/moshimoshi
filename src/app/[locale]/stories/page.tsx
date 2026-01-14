'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { useI18n } from '@/i18n/I18nContext'
import { useStories } from '@/hooks/useStories'
import { useStoryCache } from '@/hooks/useStoryCache'
import Navbar from '@/components/layout/Navbar'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import LearningPageHeader from '@/components/learn/LearningPageHeader'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'
import { Select } from '@/components/ui/Select'
import { Story, JLPTLevel } from '@/types/story'
import { FeatureUsageIndicator } from '@/components/entitlements/FeatureUsageIndicator'

interface FilterState {
  jlptLevel: 'all' | JLPTLevel
  searchTerm: string
  sortBy: 'newest' | 'popular' | 'progress'
  theme: 'all' | string
}

export default function StoriesPage() {
  const { user } = useAuth()
  const { t } = useI18n()
  const router = useRouter()
  const { isPremium } = useSubscription()
  const {
    stories,
    userProgress,
    loading,
    error,
    page,
    hasMore,
    totalCount,
    filters,
    updateFilters,
    nextPage,
    previousPage
  } = useStories()

  // Offline caching
  const { prefetchStories } = useStoryCache()
  const [prefetchStatus, setPrefetchStatus] = useState<'idle' | 'prefetching' | 'done'>('idle')

  // Get unique themes from stories
  const themes = Array.from(new Set(stories.map(s => s.theme).filter(Boolean)))

  // Auto-prefetch current page + next page for offline use (24 stories total)
  useEffect(() => {
    if (!isPremium) return
    if (stories.length > 0 && prefetchStatus === 'idle' && !loading) {
      setPrefetchStatus('prefetching')

      // Prefetch current page stories
      prefetchStories(stories, { skipCached: true })
        .then(results => {
          console.log('[StoriesPage] Current page prefetch complete:', results)

          // If there's a next page, prefetch it too
          if (hasMore) {
            const nextPageOffset = (page + 1) * 12
            const params = new URLSearchParams({
              limit: '12',
              offset: nextPageOffset.toString(),
              jlptLevel: filters.jlptLevel,
              theme: filters.theme,
              sortBy: filters.sortBy,
              search: filters.searchTerm
            })

            fetch(`/api/stories?${params}`)
              .then(res => res.json())
              .then(data => {
                if (data.stories?.length > 0) {
                  return prefetchStories(data.stories, { skipCached: true })
                }
              })
              .then(() => {
                console.log('[StoriesPage] Next page prefetch complete')
              })
              .catch(err => console.warn('[StoriesPage] Next page prefetch failed:', err))
          }

          setPrefetchStatus('done')
        })
        .catch(error => {
          console.warn('[StoriesPage] Prefetch failed:', error)
          setPrefetchStatus('done')
        })
    }
  }, [stories, prefetchStatus, loading, hasMore, page, filters, prefetchStories, isPremium])

  const getProgressPercentage = (storyId: string) => {
    const progress = userProgress.get(storyId)
    return progress?.progress || 0
  }

  const isCompleted = (storyId: string) => {
    const progress = userProgress.get(storyId)
    return progress?.completed || false
  }

  const handleStoryClick = (slug: string) => {
    router.push(`/stories/${slug}`)
  }

  if (loading) {
    return <LoadingOverlay />
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background-light via-background to-background-dark dark:from-dark-900 dark:via-dark-850 dark:to-dark-900">
        {/* Desktop Navbar */}
        <div className="hidden sm:block">
          <Navbar user={user} showUserMenu={true} />
        </div>
        <div className="container mx-auto px-4 py-16 text-center">
          <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
            {t('stories.errorLoading')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-background to-background-dark dark:from-dark-900 dark:via-dark-850 dark:to-dark-900">
      {/* Desktop Navbar */}
      <div className="hidden sm:block">
        <Navbar user={user} showUserMenu={true} />
      </div>

      {/* LearningPageHeader with only required props */}
      <LearningPageHeader title={t('stories.title')} description={t('stories.description')} mascot="none" />

      <FeatureUsageIndicator featureId="story" />

      {/* Filters */}
      <div className="container mx-auto px-4 py-6">
        <div className="bg-white dark:bg-dark-800 rounded-lg p-4 mb-6 shadow-sm border border-gray-200 dark:border-dark-700">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <input
                type="text"
                value={filters.searchTerm}
                onChange={e => updateFilters({ searchTerm: e.target.value })}
                placeholder={t('common.search')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-foreground dark:text-dark-100"
              />
            </div>

            {/* JLPT Level */}
            <Select
              value={filters.jlptLevel}
              onChange={value => updateFilters({ jlptLevel: value as any })}
              options={[
                { value: 'all', label: t('common.allLevels') },
                { value: 'N5', label: `N5 - ${t('levels.beginner')}` },
                { value: 'N4', label: `N4 - ${t('levels.elementary')}` },
                { value: 'N3', label: `N3 - ${t('levels.intermediate')}` },
                { value: 'N2', label: `N2 - ${t('levels.upperIntermediate')}` },
                { value: 'N1', label: `N1 - ${t('levels.advanced')}` },
              ]}
              placeholder={t('common.selectLevel')}
            />

            {/* Theme */}
            <Select
              value={filters.theme}
              onChange={value => updateFilters({ theme: value })}
              options={[
                { value: 'all', label: t('stories.allThemes') },
                ...themes.map(theme => ({ value: theme, label: theme })),
              ]}
              placeholder={t('stories.selectTheme')}
            />

            {/* Sort */}
            <Select
              value={filters.sortBy}
              onChange={value => updateFilters({ sortBy: value as any })}
              options={[
                { value: 'newest', label: t('common.newest') },
                { value: 'popular', label: t('common.popular') },
                { value: 'progress', label: t('stories.byProgress') },
              ]}
              placeholder={t('common.sortBy')}
            />
          </div>
        </div>

        {/* Stories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {stories.map(story => {
            const progress = getProgressPercentage(story.id)
            const completed = isCompleted(story.id)

            return (
              <div
                key={story.id}
                onClick={() => handleStoryClick(story.slug)}
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
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
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
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                        {story.viewCount || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        {story.completionCount || 0}
                      </span>
                    </div>
                    {story.averageQuizScore && (
                      <span className="flex items-center gap-1">
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                          />
                        </svg>
                        {Math.round(story.averageQuizScore)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {stories.length === 0 && !loading && (
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

        {/* Pagination Controls */}
        {!loading && (page > 0 || hasMore) && (
          <div className="mt-8 mb-6 flex justify-center items-center gap-4">
            {/* Previous Button */}
            {page > 0 && (
              <button
                onClick={previousPage}
                className="group flex items-center gap-2 px-4 py-3 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 text-foreground dark:text-dark-100 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-750 transition-all shadow-sm hover:shadow-md"
                aria-label={t('common.previous')}
              >
                <svg
                  className="w-5 h-5 transition-transform group-hover:-translate-x-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                <span className="hidden sm:inline">{t('common.previous')}</span>
              </button>
            )}

            {/* Page Indicator */}
            <span className="text-sm text-muted-foreground dark:text-dark-400 px-4">
              {t('stories.page')} {page + 1}
              {totalCount > 0 && (
                <span className="ml-2 text-xs">
                  ({page * 12 + 1}-{Math.min((page + 1) * 12, totalCount)} / {totalCount})
                </span>
              )}
            </span>

            {/* Next Button */}
            {hasMore && (
              <button
                onClick={nextPage}
                className="group flex items-center gap-2 px-4 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-all shadow-sm hover:shadow-md"
                aria-label={t('common.next')}
              >
                <span className="hidden sm:inline">{t('common.next')}</span>
                <svg
                  className="w-5 h-5 transition-transform group-hover:translate-x-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            )}
          </div>
        )}

        <MobileNavSpacer />
      </div>
    </div>
  )
}
