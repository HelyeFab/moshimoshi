'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import PageHeader from '@/components/ui/PageHeader'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'
import { GrammarPointGrid } from '@/components/grammar/GrammarPointGrid'
import {
  GrammarCategoryLabelsFile,
  GrammarChaptersFile,
  GrammarIndexFile,
  GrammarPointIndex,
  GrammarSearchIndexFile,
} from '@/lib/grammar/types'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'

interface GrammarLevelSummary {
  level: string
  jlptLevel: string
  totalPoints: number
}

interface GrammarPageClientProps {
  indexData: GrammarIndexFile
  locale: string
  currentLevel: string
  levels: GrammarLevelSummary[]
  chapters?: GrammarChaptersFile | null
  categoryLabels?: GrammarCategoryLabelsFile | null
  searchIndex?: GrammarSearchIndexFile | null
  primaryAction?: 'lesson' | 'practice'
}

function getLevelHref(locale: string, level: string, mode: 'lesson' | 'practice') {
  if (mode === 'practice') {
    return level === 'n5'
      ? `/${locale}/learn/grammar/practice`
      : `/${locale}/learn/grammar/practice/${level}`
  }
  return level === 'n5' ? `/${locale}/learn/grammar` : `/${locale}/learn/grammar/${level}`
}

export default function GrammarPageClient({
  indexData,
  locale,
  currentLevel,
  levels,
  chapters,
  categoryLabels,
  searchIndex,
  primaryAction = 'lesson',
}: GrammarPageClientProps) {
  const { t } = useI18n()
  const { user } = useAuth()
  const hasMultipleLevels = levels.length > 1
  const [groupBy, setGroupBy] = useState<'chapter' | 'category'>('chapter')
  const [query, setQuery] = useState('')
  const mode = primaryAction === 'practice' ? 'practice' : 'lesson'
  const modeToggleHref =
    mode === 'practice'
      ? getLevelHref(locale, currentLevel, 'lesson')
      : getLevelHref(locale, currentLevel, 'practice')
  const modeToggleLabel =
    mode === 'practice' ? t('grammarStall.lessonMode') : t('grammarStall.practiceMode')

  const pointsById = useMemo(() => {
    return new Map(indexData.points.map((point) => [point.id, point]))
  }, [indexData.points])

  const categorySections = useMemo(() => {
    const order: string[] = []
    const grouped: Record<string, GrammarPointIndex[]> = {}
    for (const point of indexData.points) {
      const category = point.category || 'uncategorized'
      if (!grouped[category]) {
        grouped[category] = []
        order.push(category)
      }
      grouped[category].push(point)
    }
    return order.map((category) => ({
      id: category,
      title:
        categoryLabels?.labels?.[category]?.[locale] ||
        categoryLabels?.labels?.[category]?.en ||
        category.replace(/-/g, ' '),
      points: grouped[category],
    }))
  }, [categoryLabels?.labels, indexData.points, locale])

  const chapterSections = useMemo(() => {
    if (!chapters?.chapters?.length) return []
    return chapters.chapters
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((chapter) => {
        const localizedTitle =
          chapter.title?.[locale] ||
          chapter.title?.en ||
          chapter.title?.ja ||
          t('grammarStall.chapterFallback', { order: chapter.order })
        const points = chapter.points
          .map((id) => pointsById.get(id))
          .filter((point): point is GrammarPointIndex => Boolean(point))
        return {
          id: chapter.id,
          title: localizedTitle,
          points,
        }
      })
  }, [chapters, locale, pointsById, t])

  const hasChapterData = chapterSections.length > 0
  const sections = groupBy === 'chapter' && hasChapterData ? chapterSections : categorySections

  useEffect(() => {
    if (!hasChapterData && groupBy === 'chapter') {
      setGroupBy('category')
    }
  }, [groupBy, hasChapterData])

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || !searchIndex?.entries?.length) return []
    return searchIndex.entries.filter((entry) => entry.searchText.includes(q))
  }, [query, searchIndex?.entries])

  const groupedSearchResults = useMemo(() => {
    if (!searchResults.length) return []
    const grouped: Record<string, typeof searchResults> = {}
    for (const entry of searchResults) {
      if (!grouped[entry.level]) grouped[entry.level] = []
      grouped[entry.level].push(entry)
    }
    const order = ['n5', 'n4', 'n3', 'n2', 'n1']
    return order
      .filter((level) => grouped[level]?.length)
      .map((level) => ({
        level,
        jlptLevel: grouped[level][0].jlptLevel,
        entries: grouped[level],
      }))
  }, [searchResults])

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850">
      <div className="hidden sm:block">
        <Navbar user={user} showUserMenu={true} />
      </div>

      <PageHeader
        title={t('grammarStall.title', { level: indexData.jlptLevel })}
        description={t('grammarStall.description', { count: indexData.totalPoints })}
        backHref="/dashboard"
        actions={(
          <div className="hidden sm:flex items-center gap-2">
            <Link
              href={modeToggleHref}
              className="inline-flex items-center rounded-lg border border-gray-200 dark:border-dark-700 bg-white/70 dark:bg-dark-800/70 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 transition hover:border-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
            >
              {modeToggleLabel}
            </Link>
            <span className="inline-flex items-center px-4 py-2 rounded-lg bg-primary-600 dark:bg-primary-500 text-white text-sm font-medium">
              {t('grammarStall.jlptBadge', { level: indexData.jlptLevel })}
            </span>
          </div>
        )}
      />
      <div className="sm:hidden px-4 -mt-2 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={modeToggleHref}
            className="inline-flex items-center rounded-lg border border-gray-200 dark:border-dark-700 bg-white/70 dark:bg-dark-800/70 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 transition hover:border-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
          >
            {modeToggleLabel}
          </Link>
          <span className="inline-flex items-center px-4 py-2 rounded-lg bg-primary-600 dark:bg-primary-500 text-white text-sm font-medium">
            {t('grammarStall.jlptBadge', { level: indexData.jlptLevel })}
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          {hasMultipleLevels && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {t('grammarStall.levelSelectorLabel')}
              </span>
              <div className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 dark:border-dark-700 bg-white/70 dark:bg-dark-800/70 p-2">
                {levels.map((levelInfo) => {
                  const isActive = levelInfo.level === currentLevel
                  return (
                    <Link
                      key={levelInfo.level}
                      href={getLevelHref(locale, levelInfo.level, mode)}
                      className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                        isActive
                          ? 'bg-primary-600 text-white shadow-sm'
                          : 'text-gray-700 dark:text-gray-200 hover:bg-primary-50 dark:hover:bg-dark-700'
                      }`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {t('grammarStall.levelOption', {
                        level: levelInfo.jlptLevel,
                        count: levelInfo.totalPoints,
                      })}
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {t('grammarStall.groupByLabel')}
            </span>
            <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-dark-700 bg-white/70 dark:bg-dark-800/70 p-1">
              <button
                type="button"
                onClick={() => setGroupBy('chapter')}
                className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                  groupBy === 'chapter'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-primary-50 dark:hover:bg-dark-700'
                }`}
              >
                {t('grammarStall.groupByChapter')}
              </button>
              <button
                type="button"
                onClick={() => setGroupBy('category')}
                className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                  groupBy === 'category'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-primary-50 dark:hover:bg-dark-700'
                }`}
              >
                {t('grammarStall.groupByCategory')}
              </button>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {t('grammarStall.searchLabel')}
          </label>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('grammarStall.searchPlaceholder')}
            className="w-full rounded-lg border border-gray-200 dark:border-dark-700 bg-white/80 dark:bg-dark-800/80 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {t('grammarStall.searchHelper')}
          </p>
        </div>

        {query.trim() && searchIndex ? (
          <div className="space-y-8">
            {groupedSearchResults.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {t('grammarStall.searchEmpty')}
              </div>
            ) : (
              groupedSearchResults.map((group) => (
                <div key={group.level}>
                  <div className="flex items-center gap-3 mb-3">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      {t('grammarStall.searchGroupLabel', { level: group.jlptLevel })}
                    </h2>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {group.entries.length}
                    </span>
                  </div>
                  <div className="divide-y divide-gray-200 dark:divide-dark-700 rounded-lg border border-gray-200 dark:border-dark-700 bg-white/70 dark:bg-dark-800/70">
                {group.entries.map((entry) => (
                  <Link
                        key={entry.id}
                        href={
                          mode === 'practice'
                            ? `/${locale}/learn/grammar/${entry.id}/practice`
                            : `/${locale}/learn/grammar/${entry.id}`
                        }
                        className="flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-primary-50 dark:hover:bg-dark-700"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {entry.title.ja}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {entry.title.romaji}
                          </span>
                          <span className="ml-auto inline-flex items-center rounded bg-primary-600 px-2 py-0.5 text-xs font-semibold text-white">
                            {entry.jlptLevel}
                          </span>
                        </div>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {entry.title.en}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                          {entry.shortDescription}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-10">
            {sections.map((section) => (
                <div key={section.id}>
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                      {section.title}
                    </h2>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {section.points.length}
                    </span>
                  </div>
                <GrammarPointGrid
                  points={section.points}
                  locale={locale}
                  primaryAction={primaryAction}
                  lessonLabel={t('grammarStall.lessonAction')}
                  practiceLabel={t('grammarStall.practiceAction')}
                />
                </div>
            ))}
          </div>
        )}
      </div>

      <MobileNavSpacer />
    </div>
  )
}
