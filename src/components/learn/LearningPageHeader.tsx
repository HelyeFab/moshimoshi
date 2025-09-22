'use client'

import { motion } from 'framer-motion'
import DoshiMascot from '@/components/ui/DoshiMascot'
import { useI18n } from '@/i18n/I18nContext'

type ViewMode = 'browse' | 'study' | 'review'

interface LearningPageHeaderProps {
  // Header content
  title: string
  description: string
  subtitle?: string

  // Statistics
  stats?: {
    total: number
    learned: number
    daily?: {
      used: number
      limit: number
    }
  }

  // Mode controls
  mode: ViewMode
  onModeChange: (mode: ViewMode) => void

  // Selection controls
  selectionMode?: boolean
  onToggleSelection?: () => void
  selectedCount?: number
  onSelectAll?: () => void
  onClearSelection?: () => void

  // Action handlers
  onStartStudy?: () => void
  onStartReview?: () => void
  onAddToReview?: () => void
  canAddMore?: boolean

  // Customization
  mascot?: 'doshi' | 'none'
  className?: string
}

export default function LearningPageHeader({
  title,
  description,
  subtitle,
  stats,
  mode,
  onModeChange,
  selectionMode = false,
  onToggleSelection,
  selectedCount = 0,
  onSelectAll,
  onClearSelection,
  onStartStudy,
  onStartReview,
  onAddToReview,
  canAddMore = true,
  mascot = 'doshi',
  className = ''
}: LearningPageHeaderProps) {
  const { t } = useI18n()

  // Calculate progress percentage
  const progressPercentage = stats
    ? stats.total > 0
      ? Math.round((stats.learned / stats.total) * 100)
      : 0
    : 0

  return (
    <div className={`bg-gray-50/80 dark:bg-dark-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-dark-700 ${className}`}>
      <div className="container mx-auto px-4 py-6">
        {/* Header Section with Mascot */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Mascot */}
            {mascot === 'doshi' && (
              <DoshiMascot
                size="large"
                variant="animated"
                className="flex-shrink-0"
              />
            )}

            {/* Title and Description */}
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary-500 to-primary-700 dark:from-primary-400 dark:to-primary-600 bg-clip-text text-transparent mb-2">
                {title}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                {description}
              </p>
              {subtitle && (
                <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">
                  {subtitle}
                </p>
              )}

              {/* Stats Row */}
              {stats && (
                <div className="mt-4 flex flex-wrap gap-4 text-sm">
                  {/* Progress */}
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 dark:text-gray-400">Progress:</span>
                    <span className="font-medium text-primary-600 dark:text-primary-400">
                      {stats.learned}/{stats.total} ({progressPercentage}%)
                    </span>
                  </div>

                  {/* Daily Limit (if applicable) */}
                  {stats.daily && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 dark:text-gray-400">Daily Add Limit:</span>
                      <span className={`font-medium ${
                        stats.daily.used < stats.daily.limit
                          ? 'text-primary-600 dark:text-primary-400'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {stats.daily.used}/{stats.daily.limit}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {stats && (
            <div className="mt-4">
              <div className="h-2 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercentage}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-primary-400 to-primary-600"
                />
              </div>
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="space-y-4">
          {/* Mode Selector */}
          <div className="flex bg-gray-100 dark:bg-dark-800 rounded-lg p-1">
            {(['browse', 'study', 'review'] as ViewMode[]).map((viewMode) => (
              <button
                key={viewMode}
                onClick={() => onModeChange(viewMode)}
                className={`flex-1 px-4 py-2 rounded-md font-medium transition-all capitalize ${
                  mode === viewMode
                    ? 'bg-gray-50 dark:bg-dark-700 text-primary-600 dark:text-primary-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {viewMode}
              </button>
            ))}
          </div>

          {/* Actions based on mode */}
          {mode === 'browse' && (
            <div className="text-center text-gray-600 dark:text-gray-400 py-2">
              Browse mode - Explore and learn at your own pace
            </div>
          )}

          {mode === 'study' && (
            <div className="space-y-3">
              {/* Selection controls */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  {selectedCount > 0 && (
                    <span className="px-3 py-1.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm font-medium">
                      {selectedCount} selected
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  {onSelectAll && (
                    <button
                      onClick={onSelectAll}
                      className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors"
                    >
                      Select All
                    </button>
                  )}

                  {onClearSelection && selectedCount > 0 && (
                    <button
                      onClick={onClearSelection}
                      className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Study button */}
              {selectedCount > 0 ? (
                <button
                  onClick={onStartStudy}
                  className="w-full px-4 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium shadow-sm transition-all"
                >
                  Start Study Session ({selectedCount} items)
                </button>
              ) : (
                <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                  Select items to begin studying
                </div>
              )}
            </div>
          )}

          {mode === 'review' && (
            <div className="space-y-3">
              {/* Selection controls */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  {selectedCount > 0 && (
                    <span className="px-3 py-1.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm font-medium">
                      {selectedCount} selected
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  {onSelectAll && (
                    <button
                      onClick={onSelectAll}
                      className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors"
                    >
                      Select All
                    </button>
                  )}

                  {onClearSelection && selectedCount > 0 && (
                    <button
                      onClick={onClearSelection}
                      className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Review button */}
              {selectedCount > 0 ? (
                <button
                  onClick={onStartReview}
                  className="w-full px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium shadow-sm transition-all"
                >
                  Start Review Session ({selectedCount} items)
                </button>
              ) : (
                <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                  Select items to begin reviewing
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}