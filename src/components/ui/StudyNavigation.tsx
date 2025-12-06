'use client'

import { useI18n } from '@/i18n/I18nContext'

interface StudyNavigationProps {
  /** The label to show after "Back to" (e.g., "Characters", "Menu", "List") */
  backToLabel: string
  /** Callback when back button is clicked */
  onBack: () => void
  /** Callback when previous button is clicked */
  onPrevious?: () => void
  /** Callback when next button is clicked */
  onNext?: () => void
  /** Whether to show the prev/next navigation arrows (default: true if callbacks provided) */
  showNavigation?: boolean
  /** Optional className for the container */
  className?: string
}

export default function StudyNavigation({
  backToLabel,
  onBack,
  onPrevious,
  onNext,
  showNavigation = true,
  className = '',
}: StudyNavigationProps) {
  const { strings } = useI18n()

  const hasNavigation = showNavigation && (onPrevious || onNext)

  return (
    <div className={`flex items-center justify-between w-full max-w-2xl ${className}`}>
      <button
        onClick={onBack}
        className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
      >
        ← {strings.common?.backTo || 'Back to'} {backToLabel}
      </button>

      {hasNavigation && (
        <div className="flex items-center gap-4">
          {onPrevious && (
            <button
              onClick={onPrevious}
              className="p-2 rounded-lg bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors"
              aria-label="Previous"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
          )}

          {onNext && (
            <button
              onClick={onNext}
              className="p-2 rounded-lg bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors"
              aria-label="Next"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    </div>
  )
}
