import Link from 'next/link'
import { GrammarPointIndex } from '@/lib/grammar/types'

interface GrammarPointCardProps {
  point: GrammarPointIndex
  locale: string
  primaryAction?: 'lesson' | 'practice'
  lessonLabel: string
  practiceLabel: string
}

export function GrammarPointCard({
  point,
  locale,
  primaryAction = 'lesson',
  lessonLabel,
  practiceLabel,
}: GrammarPointCardProps) {
  const lessonHref = `/${locale}/learn/grammar/${point.id}`
  const practiceHref = `/${locale}/learn/grammar/${point.id}/practice`
  const primaryHref = primaryAction === 'practice' ? practiceHref : lessonHref
  const secondaryHref = primaryAction === 'practice' ? lessonHref : practiceHref
  const primaryLabel = primaryAction === 'practice' ? practiceLabel : lessonLabel
  const secondaryLabel = primaryAction === 'practice' ? lessonLabel : practiceLabel

  return (
    <div className="bg-white dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-dark-700 p-4 h-full transition-all hover:shadow-lg hover:border-primary-400 dark:hover:border-primary-500">
      <Link
        href={primaryHref}
        className="block group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-dark-800 rounded-lg"
      >
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400">
              {point.title.ja}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {point.title.romaji}
            </p>
          </div>
          <span className="ml-2 flex-shrink-0 inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-primary-600 dark:bg-primary-500 text-white">
            {point.jlptLevel}
          </span>
        </div>

        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {point.title.en}
        </p>

        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
          {point.shortDescription}
        </p>

        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-dark-700">
          <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
            {point.category.replace('-', ' ')}
          </span>
        </div>
      </Link>

      <div className="mt-4 flex items-center gap-2">
        <Link
          href={primaryHref}
          className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-700"
        >
          {primaryLabel}
        </Link>
        <Link
          href={secondaryHref}
          className="inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-dark-700 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 transition hover:border-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
        >
          {secondaryLabel}
        </Link>
      </div>
    </div>
  )
}
