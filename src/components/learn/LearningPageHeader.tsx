'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import DoshiMascot from '@/components/ui/DoshiMascot'
import { useI18n } from '@/i18n/I18nContext'
import { useTheme } from '@/lib/theme/ThemeContext'

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

  // Mode controls (optional for pages that don't need mode switching)
  mode?: ViewMode
  onModeChange?: (mode: ViewMode) => void

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
  const { resolvedTheme } = useTheme()
  const [isExpanded, setIsExpanded] = useState(false)

  // Calculate progress percentage
  const progressPercentage = stats
    ? stats.total > 0
      ? Math.round((stats.learned / stats.total) * 100)
      : 0
    : 0


  const isLightTheme = resolvedTheme === 'light'

  const headerClasses = isLightTheme
    ? `relative overflow-hidden ${className}`
    : `bg-gray-50/80 dark:bg-dark-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-dark-700 ${className}`

  const titleClasses = isLightTheme
    ? 'text-white [text-shadow:_1px_1px_3px_rgb(0_0_0_/_40%)]'
    : 'bg-gradient-to-r from-primary-500 to-primary-700 dark:from-primary-400 dark:to-primary-600 bg-clip-text text-transparent'

  const descriptionClasses = isLightTheme ? 'text-white/95 [text-shadow:_1px_1px_2px_rgb(0_0_0_/_35%)]' : 'text-gray-600 dark:text-gray-400'
  const subtitleClasses = isLightTheme ? 'text-white/90 [text-shadow:_1px_1px_2px_rgb(0_0_0_/_35%)]' : 'text-gray-500 dark:text-gray-500'

  return (<>
    {/* Mobile Version - Collapsible */}
    <div className="sm:hidden">
    <div
      className={headerClasses}
      style={isLightTheme ? {
        background: `linear-gradient(135deg,
          rgb(var(--palette-primary-200)) 0%,
          rgb(var(--palette-primary-50)) 50%,
          rgb(var(--palette-primary-100)) 100%)`
      } : undefined}
    >
      {/* Beautiful background pattern for light theme - only primary colors */}
      {isLightTheme && (
        <>
          {/* Semi-transparent overlay for better text readability */}
          <div className="absolute inset-0 bg-black/10" />
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at top left,
                rgba(var(--palette-primary-500), 0.15) 0%,
                transparent 50%)`
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at bottom right,
                rgba(var(--palette-primary-700), 0.1) 0%,
                transparent 50%)`
            }}
          />
        </>
      )}
      <div className="container mx-auto px-4 py-4 relative z-10">
        {/* Compact Header */}
        <div className="relative">
          <div className="flex items-center gap-4">
            {mascot === 'doshi' && (
              <DoshiMascot
                size="medium"
                variant="animated"
                className="flex-shrink-0"
              />
            )}
            <div className="flex-1">
              <h1 className={`text-2xl font-bold ${titleClasses}`}>
                {title}
              </h1>
              {stats && (
                <p className={`text-sm mt-1 ${descriptionClasses}`}>
                  {stats.learned}/{stats.total} ({progressPercentage}%)
                </p>
              )}
            </div>

            {/* Expand/Collapse Button */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`p-2 rounded-full shadow-md transition-all ${
                isLightTheme
                  ? 'bg-white/50 hover:bg-white/70 backdrop-blur'
                  : 'bg-gray-200 dark:bg-dark-700 hover:bg-gray-300 dark:hover:bg-dark-600'
              }`}
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.3 }}
              >
                <ChevronDown className={`w-5 h-5 ${
                  isLightTheme ? 'text-gray-700' : 'text-gray-700 dark:text-gray-300'
                }`} />
              </motion.div>
            </button>
          </div>

          {/* Progress Bar - Always visible on mobile */}
          {stats && (
            <div className="mt-3">
              <div className={`h-2 rounded-full overflow-hidden ${isLightTheme ? 'bg-white/30' : 'bg-gray-200 dark:bg-dark-700'}`}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercentage}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className={isLightTheme
                    ? 'h-full bg-white/90'
                    : 'h-full bg-gradient-to-r from-primary-400 to-primary-600'
                  }
                />
              </div>
            </div>
          )}
        </div>

        {/* Expandable Content */}
        <AnimatePresence mode="wait">
          {isExpanded && (
            <motion.div
              initial={{
                height: 0,
                opacity: 0,
                scale: 0.95
              }}
              animate={{
                height: 'auto',
                opacity: 1,
                scale: 1,
                transition: {
                  height: {
                    type: "spring",
                    damping: 20,
                    stiffness: 100,
                    duration: 1.2
                  },
                  opacity: {
                    duration: 0.8,
                    ease: "easeOut"
                  },
                  scale: {
                    type: "spring",
                    damping: 15,
                    stiffness: 150,
                    delay: 0.2
                  }
                }
              }}
              exit={{
                height: 0,
                opacity: 0,
                scale: 0.95,
                transition: {
                  height: {
                    type: "spring",
                    damping: 25,
                    stiffness: 300,
                    duration: 0.4
                  },
                  opacity: {
                    duration: 0.2,
                    ease: "easeIn"
                  },
                  scale: {
                    duration: 0.2
                  }
                }
              }}
              className="overflow-hidden"
            >
              <div className="pt-4 space-y-4">
                {/* Full Description */}
                <div>
                  <p className={`text-base ${descriptionClasses}`}>
                    {description}
                  </p>
                  {subtitle && (
                    <p className={`text-sm mt-2 ${subtitleClasses}`}>
                      {subtitle}
                    </p>
                  )}
                </div>

                {/* Stats Row */}
                {stats && stats.daily && (
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span className={isLightTheme ? 'text-white/90' : 'text-gray-600 dark:text-gray-400'}>
                        Daily Add Limit:
                      </span>
                      <span className={`font-medium ${
                        stats.daily.used < stats.daily.limit
                          ? isLightTheme ? 'text-white' : 'text-primary-600 dark:text-primary-400'
                          : isLightTheme ? 'text-white/80' : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {stats.daily.used}/{stats.daily.limit}
                      </span>
                    </div>
                  </div>
                )}

                {/* Action Bar */}
                <div className="space-y-4">
                  {/* Mode Selector - only show if mode is provided */}
                  {mode && onModeChange && (
                    <div className={`flex rounded-lg p-1 ${isLightTheme ? 'bg-white/20 backdrop-blur-sm' : 'bg-gray-100 dark:bg-dark-800'}`}>
                      {(['browse', 'study', 'review'] as ViewMode[]).map((viewMode) => (
                        <button
                          key={viewMode}
                          onClick={() => onModeChange(viewMode)}
                          className={`flex-1 px-4 py-2 rounded-md font-medium transition-all capitalize ${
                            mode === viewMode
                              ? isLightTheme
                                ? 'bg-white/90 text-primary-600 shadow-sm'
                                : 'bg-gray-50 dark:bg-dark-700 text-primary-600 dark:text-primary-400 shadow-sm'
                              : isLightTheme
                                ? 'text-white/90 hover:text-white hover:bg-white/10'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                          }`}
                        >
                          {viewMode}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Actions based on mode */}
                  {mode === 'browse' && (
                    <div className={`text-center py-2 ${isLightTheme ? 'text-white/90' : 'text-gray-600 dark:text-gray-400'}`}>
                      Browse mode - Explore and learn at your own pace
                    </div>
                  )}

                  {mode === 'study' && (
                    <div className="space-y-3">
                      {/* Selection controls */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          {selectedCount > 0 && (
                            <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                              isLightTheme
                                ? 'bg-white/90 text-primary-700'
                                : 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                            }`}>
                              {selectedCount} selected
                            </span>
                          )}
                        </div>

                        <div className="flex gap-2">
                          {onSelectAll && (
                            <button
                              onClick={onSelectAll}
                              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                                isLightTheme
                                  ? 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'
                                  : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                              }`}
                            >
                              Select All
                            </button>
                          )}

                          {onClearSelection && selectedCount > 0 && (
                            <button
                              onClick={onClearSelection}
                              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                                isLightTheme
                                  ? 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'
                                  : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                              }`}
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
                          className={`w-full px-4 py-3 rounded-lg font-medium shadow-sm transition-all ${
                            isLightTheme
                              ? 'bg-white/90 text-primary-600 hover:bg-white'
                              : 'bg-primary-500 hover:bg-primary-600 text-white'
                          }`}
                        >
                          Start Study Session ({selectedCount} items)
                        </button>
                      ) : (
                        <div className={`text-center py-4 ${isLightTheme ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
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
                            <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                              isLightTheme
                                ? 'bg-white/90 text-primary-700'
                                : 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                            }`}>
                              {selectedCount} selected
                            </span>
                          )}
                        </div>

                        <div className="flex gap-2">
                          {onSelectAll && (
                            <button
                              onClick={onSelectAll}
                              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                                isLightTheme
                                  ? 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'
                                  : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                              }`}
                            >
                              Select All
                            </button>
                          )}

                          {onClearSelection && selectedCount > 0 && (
                            <button
                              onClick={onClearSelection}
                              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                                isLightTheme
                                  ? 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'
                                  : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                              }`}
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
                          className={`w-full px-4 py-3 rounded-lg font-medium shadow-sm transition-all ${
                            isLightTheme
                              ? 'bg-white/90 text-primary-700 hover:bg-white'
                              : 'bg-primary-600 hover:bg-primary-700 text-white'
                          }`}
                        >
                          Start Review Session ({selectedCount} items)
                        </button>
                      ) : (
                        <div className={`text-center py-4 ${isLightTheme ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                          Select items to begin reviewing
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
    </div>

    {/* Desktop Version - Original Full Layout */}
    <div className="hidden sm:block">
    <div
      className={headerClasses}
      style={isLightTheme ? {
        background: `linear-gradient(135deg,
          rgb(var(--palette-primary-200)) 0%,
          rgb(var(--palette-primary-50)) 50%,
          rgb(var(--palette-primary-100)) 100%)`
      } : undefined}
    >
      {/* Beautiful background pattern for light theme - only primary colors */}
      {isLightTheme && (
        <>
          {/* Semi-transparent overlay for better text readability */}
          <div className="absolute inset-0 bg-black/10" />
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at top left,
                rgba(var(--palette-primary-500), 0.15) 0%,
                transparent 50%)`
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at bottom right,
                rgba(var(--palette-primary-700), 0.1) 0%,
                transparent 50%)`
            }}
          />
        </>
      )}
      <div className="container mx-auto px-4 py-6 relative z-10">
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {mascot === 'doshi' && (
              <DoshiMascot
                size="large"
                variant="animated"
                className="flex-shrink-0"
              />
            )}
            <div className="flex-1 text-center sm:text-left">
              <h1 className={`text-3xl sm:text-4xl font-bold mb-2 ${titleClasses}`}>
                {title}
              </h1>
              <p className={`text-lg ${descriptionClasses}`}>
                {description}
              </p>
              {subtitle && (
                <p className={`text-sm mt-2 ${subtitleClasses}`}>
                  {subtitle}
                </p>
              )}

              {/* Stats Row */}
              {stats && (
                <div className="mt-4 flex flex-wrap gap-4 text-sm">
                  {/* Progress */}
                  <div className="flex items-center gap-2">
                    <span className={isLightTheme ? 'text-white/90' : 'text-gray-600 dark:text-gray-400'}>
                      {t('common.progress')}:
                    </span>
                    <span className={`font-medium ${isLightTheme ? 'text-white' : 'text-primary-600 dark:text-primary-400'}`}>
                      {stats.learned}/{stats.total} ({progressPercentage}%)
                    </span>
                  </div>

                  {/* Daily Limit (if applicable) */}
                  {stats.daily && (
                    <div className="flex items-center gap-2">
                      <span className={isLightTheme ? 'text-white/90' : 'text-gray-600 dark:text-gray-400'}>
                        Daily Add Limit:
                      </span>
                      <span className={`font-medium ${
                        stats.daily.used < stats.daily.limit
                          ? isLightTheme ? 'text-white' : 'text-primary-600 dark:text-primary-400'
                          : isLightTheme ? 'text-white/80' : 'text-gray-600 dark:text-gray-400'
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
              <div className={`h-2 rounded-full overflow-hidden ${isLightTheme ? 'bg-white/30' : 'bg-gray-200 dark:bg-dark-700'}`}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercentage}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className={isLightTheme
                    ? 'h-full bg-white/90'
                    : 'h-full bg-gradient-to-r from-primary-400 to-primary-600'
                  }
                />
              </div>
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="space-y-4">
          {/* Mode Selector - only show if mode is provided */}
          {mode && onModeChange && (
            <div className={`flex rounded-lg p-1 ${isLightTheme ? 'bg-white/20 backdrop-blur-sm' : 'bg-gray-100 dark:bg-dark-800'}`}>
              {(['browse', 'study', 'review'] as ViewMode[]).map((viewMode) => (
                <button
                  key={viewMode}
                  onClick={() => onModeChange(viewMode)}
                  className={`flex-1 px-4 py-2 rounded-md font-medium transition-all capitalize ${
                    mode === viewMode
                      ? isLightTheme
                        ? 'bg-white/90 text-primary-600 shadow-sm'
                        : 'bg-gray-50 dark:bg-dark-700 text-primary-600 dark:text-primary-400 shadow-sm'
                      : isLightTheme
                        ? 'text-white/90 hover:text-white hover:bg-white/10'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  {viewMode}
                </button>
              ))}
            </div>
          )}

          {/* Actions based on mode */}
          {mode === 'browse' && (
            <div className={`text-center py-2 ${isLightTheme ? 'text-white/90' : 'text-gray-600 dark:text-gray-400'}`}>
              Browse mode - Explore and learn at your own pace
            </div>
          )}

          {mode === 'study' && (
            <div className="space-y-3">
              {/* Selection controls */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  {selectedCount > 0 && (
                    <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                      isLightTheme
                        ? 'bg-white/90 text-primary-700'
                        : 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    }`}>
                      {selectedCount} selected
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  {onSelectAll && (
                    <button
                      onClick={onSelectAll}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        isLightTheme
                          ? 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'
                          : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                      }`}
                    >
                      Select All
                    </button>
                  )}

                  {onClearSelection && selectedCount > 0 && (
                    <button
                      onClick={onClearSelection}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        isLightTheme
                          ? 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'
                          : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                      }`}
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
                  className={`w-full px-4 py-3 rounded-lg font-medium shadow-sm transition-all ${
                    isLightTheme
                      ? 'bg-white/90 text-primary-600 hover:bg-white'
                      : 'bg-primary-500 hover:bg-primary-600 text-white'
                  }`}
                >
                  Start Study Session ({selectedCount} items)
                </button>
              ) : (
                <div className={`text-center py-4 ${isLightTheme ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
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
                    <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                      isLightTheme
                        ? 'bg-white/90 text-primary-700'
                        : 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    }`}>
                      {selectedCount} selected
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  {onSelectAll && (
                    <button
                      onClick={onSelectAll}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        isLightTheme
                          ? 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'
                          : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                      }`}
                    >
                      Select All
                    </button>
                  )}

                  {onClearSelection && selectedCount > 0 && (
                    <button
                      onClick={onClearSelection}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        isLightTheme
                          ? 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'
                          : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                      }`}
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
                  className={`w-full px-4 py-3 rounded-lg font-medium shadow-sm transition-all ${
                    isLightTheme
                      ? 'bg-white/90 text-primary-700 hover:bg-white'
                      : 'bg-primary-600 hover:bg-primary-700 text-white'
                  }`}
                >
                  Start Review Session ({selectedCount} items)
                </button>
              ) : (
                <div className={`text-center py-4 ${isLightTheme ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                  Select items to begin reviewing
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  </>
  )
}
