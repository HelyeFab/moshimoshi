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
}

function getLevelHref(locale: string, level: string) {
  return level === 'n5'
    ? `/${locale}/learn/grammar`
    : `/${locale}/learn/grammar/${level}`
}

export default function GrammarPageClient({
  indexData,
  locale,
  currentLevel,
  levels,
  chapters,
  categoryLabels,
}: GrammarPageClientProps) {
  const { t } = useI18n()
  const { user } = useAuth()
  const hasMultipleLevels = levels.length > 1
  const [groupBy, setGroupBy] = useState<'chapter' | 'category'>('chapter')

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
          `Chapter ${chapter.order}`
        const points = chapter.points
          .map((id) => pointsById.get(id))
          .filter((point): point is GrammarPointIndex => Boolean(point))
        return {
          id: chapter.id,
          title: localizedTitle,
          points,
        }
      })
  }, [chapters, locale, pointsById])

  const hasChapterData = chapterSections.length > 0
  const sections = groupBy === 'chapter' && hasChapterData ? chapterSections : categorySections

  useEffect(() => {
    if (!hasChapterData && groupBy === 'chapter') {
      setGroupBy('category')
    }
  }, [groupBy, hasChapterData])

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
          <span className="hidden sm:inline-flex items-center px-4 py-2 rounded-lg bg-primary-600 dark:bg-primary-500 text-white text-sm font-medium">
            {t('grammarStall.jlptBadge', { level: indexData.jlptLevel })}
          </span>
        )}
      />
      <div className="sm:hidden px-4 -mt-2 mb-4">
        <span className="inline-flex items-center px-4 py-2 rounded-lg bg-primary-600 dark:bg-primary-500 text-white text-sm font-medium">
          {t('grammarStall.jlptBadge', { level: indexData.jlptLevel })}
        </span>
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
                      href={getLevelHref(locale, levelInfo.level)}
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
              <GrammarPointGrid points={section.points} locale={locale} />
            </div>
          ))}
        </div>
      </div>

      <MobileNavSpacer />
    </div>
  )
}
