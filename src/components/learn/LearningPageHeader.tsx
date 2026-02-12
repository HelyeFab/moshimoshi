'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, CheckSquare, Square } from 'lucide-react'
import DoshiMascot from '@/components/ui/DoshiMascot'
import PillBackButton from '@/components/common/PillBackButton'
import { useI18n } from '@/i18n/I18nContext'
import { useTheme } from '@/lib/theme/ThemeContext'
import FeatureReminderToggle from '@/components/notifications/FeatureReminderToggle'
import type { FeatureReminderKey } from '@/lib/notifications/feature-reminders'

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
  // Extra content to render in mobile expandable section
  mobileExtra?: React.ReactNode
  // Back navigation
  backHref?: string
  // Hide bottom control bar (e.g., when search is focused on mobile)
  hideBottomBar?: boolean
  featureReminderKey?: FeatureReminderKey
  showFeatureReminderToggle?: boolean
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
  className = '',
  mobileExtra,
  backHref = '/dashboard',
  hideBottomBar = false,
  featureReminderKey,
  showFeatureReminderToggle = true,
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

  const descriptionClasses = isLightTheme
    ? 'text-white/95 [text-shadow:_1px_1px_2px_rgb(0_0_0_/_35%)]'
    : 'text-gray-600 dark:text-gray-400'
  const subtitleClasses = isLightTheme
    ? 'text-white/90 [text-shadow:_1px_1px_2px_rgb(0_0_0_/_35%)]'
    : 'text-gray-500 dark:text-gray-500'

  const renderModeSelector = () => {
    if (!mode || !onModeChange) return null

    return (
      <div className="flex p-1 bg-gray-100 dark:bg-dark-700 rounded-lg">
        {(['browse', 'study', 'review'] as ViewMode[]).map(viewMode => (
          <button
            key={viewMode}
            onClick={() => onModeChange(viewMode)}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all capitalize ${
              mode === viewMode
                ? 'bg-white dark:bg-dark-600 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {viewMode}
          </button>
        ))}
      </div>
    )
  }

  const renderModeActions = () => {
    if (!mode) return null

    // Browse mode: no additional actions needed
    if (mode === 'browse') {
      return null
    }

    // Study/Review modes: only show expanded content when items are selected
    if (mode === 'study' || mode === 'review') {
      const allSelected = stats?.total && selectedCount >= stats.total
      const isStudy = mode === 'study'

      // Only render if items are selected
      if (selectedCount === 0) return null

      return (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-2.5 overflow-hidden"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
              {selectedCount} selected
            </span>
          </div>

          <button
            onClick={isStudy ? onStartStudy : onStartReview}
            className="w-full px-3.5 py-2 rounded-md text-sm font-semibold shadow-sm transition-all bg-primary-500 hover:bg-primary-600 text-white"
          >
            Start {isStudy ? 'Study' : 'Review'} Session ({selectedCount} items)
          </button>
        </motion.div>
      )
    }

    return null
  }

  const showBottomModeBar = Boolean(mode)

  return (
    <>
      {/* Mobile Version - Collapsible */}
      <div className="sm:hidden mb-6">
        <div
          className={headerClasses}
          style={
            isLightTheme
              ? {
                  background: `linear-gradient(135deg,
          rgb(var(--palette-primary-200)) 0%,
          rgb(var(--palette-primary-50)) 50%,
          rgb(var(--palette-primary-100)) 100%)`,
                }
              : undefined
          }
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
                transparent 50%)`,
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background: `radial-gradient(ellipse at bottom right,
                rgba(var(--palette-primary-700), 0.1) 0%,
                transparent 50%)`,
                }}
              />
            </>
          )}
          <div className="container mx-auto px-4 py-4 relative z-10">
            {/* Compact Header */}
            <div className="relative">
              <div className="flex items-center gap-4">
                {/* Remove Doshi mascot on mobile */}
                <div className="flex-1">
                  <h1 className={`text-2xl font-bold ${titleClasses}`}>{title}</h1>
                  {stats && (
                    <p className={`text-sm mt-1 ${descriptionClasses}`}>
                      <span
                        className={
                          stats.learned > 0
                            ? isLightTheme
                              ? 'text-green-100 font-semibold'
                              : 'text-green-500 dark:text-green-400 font-semibold'
                            : ''
                        }
                      >
                        {stats.learned}
                      </span>
                      /{stats.total} ({progressPercentage}%)
                    </p>
                  )}
                  {showFeatureReminderToggle && (
                    <div className="mt-2">
                      <FeatureReminderToggle featureKey={featureReminderKey} />
                    </div>
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
                  aria-label={isExpanded ? 'Collapse header details' : 'Expand header details'}
                  aria-expanded={isExpanded}
                  aria-controls="learning-header-expandable-content"
                >
                  <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ChevronDown
                      className={`w-5 h-5 ${
                        isLightTheme ? 'text-gray-700' : 'text-gray-700 dark:text-gray-300'
                      }`}
                    />
                  </motion.div>
                </button>

                {/* Back Button */}
                <PillBackButton fallbackHref={backHref} />
              </div>

              {/* Progress Bar - Always visible on mobile */}
              {stats && (
                <div className="mt-3">
                  <div
                    className={`h-2 rounded-full overflow-hidden ${isLightTheme ? 'bg-white/30' : 'bg-gray-200 dark:bg-dark-700'}`}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercentage}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className={
                        stats.learned > 0
                          ? isLightTheme
                            ? 'h-full bg-gradient-to-r from-green-200 to-green-100'
                            : 'h-full bg-gradient-to-r from-green-500 to-green-400'
                          : isLightTheme
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
                  id="learning-header-expandable-content"
                  initial={{
                    height: 0,
                    opacity: 0,
                    scale: 0.95,
                  }}
                  animate={{
                    height: 'auto',
                    opacity: 1,
                    scale: 1,
                    transition: {
                      height: {
                        type: 'spring',
                        damping: 20,
                        stiffness: 100,
                        duration: 1.2,
                      },
                      opacity: {
                        duration: 0.8,
                        ease: 'easeOut',
                      },
                      scale: {
                        type: 'spring',
                        damping: 15,
                        stiffness: 150,
                        delay: 0.2,
                      },
                    },
                  }}
                  exit={{
                    height: 0,
                    opacity: 0,
                    scale: 0.95,
                    transition: {
                      height: {
                        type: 'spring',
                        damping: 25,
                        stiffness: 300,
                        duration: 0.4,
                      },
                      opacity: {
                        duration: 0.2,
                        ease: 'easeIn',
                      },
                      scale: {
                        duration: 0.2,
                      },
                    },
                  }}
                  className="overflow-hidden"
                >
                  <div className="pt-4 space-y-4">
                    {/* Mobile Extra Content (e.g., filters) */}
                    {mobileExtra && <div className="pb-2">{mobileExtra}</div>}

                    {/* Full Description */}
                    <div>
                      <p className={`text-base ${descriptionClasses}`}>{description}</p>
                      {subtitle && <p className={`text-sm mt-2 ${subtitleClasses}`}>{subtitle}</p>}
                    </div>

                    {/* Stats Row */}
                    {stats && stats.daily && (
                      <div className="flex flex-wrap gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              isLightTheme ? 'text-white/90' : 'text-gray-600 dark:text-gray-400'
                            }
                          >
                            Daily Add Limit:
                          </span>
                          <span
                            className={`font-medium ${
                              stats.daily.used < stats.daily.limit
                                ? isLightTheme
                                  ? 'text-white'
                                  : 'text-primary-600 dark:text-primary-400'
                                : isLightTheme
                                  ? 'text-white/80'
                                  : 'text-gray-600 dark:text-gray-400'
                            }`}
                          >
                            {stats.daily.used}/{stats.daily.limit}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Actions moved to bottom control bar */}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Desktop Version - Original Full Layout */}
      <div className="hidden sm:block mb-6">
        <div
          className={headerClasses}
          style={
            isLightTheme
              ? {
                  background: `linear-gradient(135deg,
          rgb(var(--palette-primary-200)) 0%,
          rgb(var(--palette-primary-50)) 50%,
          rgb(var(--palette-primary-100)) 100%)`,
                }
              : undefined
          }
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
                transparent 50%)`,
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background: `radial-gradient(ellipse at bottom right,
                rgba(var(--palette-primary-700), 0.1) 0%,
                transparent 50%)`,
                }}
              />
            </>
          )}
          <div className="container mx-auto px-4 py-6 relative z-10">
            {/* Back button - top left */}
            <div className="mb-4">
              <PillBackButton fallbackHref={backHref} />
            </div>

            <div className="mb-6">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                {mascot === 'doshi' && (
                  <DoshiMascot size="large" variant="animated" className="flex-shrink-0" />
                )}
                <div className="flex-1 text-center sm:text-left">
                  <h1 className={`text-3xl sm:text-4xl font-bold mb-2 ${titleClasses}`}>{title}</h1>
                  <p className={`text-lg ${descriptionClasses}`}>{description}</p>
                  {subtitle && <p className={`text-sm mt-2 ${subtitleClasses}`}>{subtitle}</p>}
                  {showFeatureReminderToggle && (
                    <div className="mt-3">
                      <FeatureReminderToggle featureKey={featureReminderKey} />
                    </div>
                  )}

                  {/* Stats Row */}
                  {stats && (
                    <div className="mt-4 flex flex-wrap gap-4 text-sm">
                      {/* Progress */}
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            isLightTheme ? 'text-white/90' : 'text-gray-600 dark:text-gray-400'
                          }
                        >
                          {t('common.progress')}:
                        </span>
                        <span
                          className={`font-medium ${isLightTheme ? 'text-white' : 'text-primary-600 dark:text-primary-400'}`}
                        >
                          <span
                            className={
                              stats.learned > 0
                                ? isLightTheme
                                  ? 'text-green-100 font-bold'
                                  : 'text-green-600 dark:text-green-400 font-bold'
                                : ''
                            }
                          >
                            {stats.learned}
                          </span>
                          /{stats.total} ({progressPercentage}%)
                        </span>
                      </div>

                      {/* Daily Limit (if applicable) */}
                      {stats.daily && (
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              isLightTheme ? 'text-white/90' : 'text-gray-600 dark:text-gray-400'
                            }
                          >
                            Daily Add Limit:
                          </span>
                          <span
                            className={`font-medium ${
                              stats.daily.used < stats.daily.limit
                                ? isLightTheme
                                  ? 'text-white'
                                  : 'text-primary-600 dark:text-primary-400'
                                : isLightTheme
                                  ? 'text-white/80'
                                  : 'text-gray-600 dark:text-gray-400'
                            }`}
                          >
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
                  <div
                    className={`h-2 rounded-full overflow-hidden ${isLightTheme ? 'bg-white/30' : 'bg-gray-200 dark:bg-dark-700'}`}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercentage}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className={
                        stats.learned > 0
                          ? isLightTheme
                            ? 'h-full bg-gradient-to-r from-green-200 to-green-100'
                            : 'h-full bg-gradient-to-r from-green-500 to-green-400'
                          : isLightTheme
                            ? 'h-full bg-white/90'
                            : 'h-full bg-gradient-to-r from-primary-400 to-primary-600'
                      }
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Actions moved to bottom control bar */}
          </div>
        </div>
      </div>

      {/* Global bottom control bar (always visible where LearningPageHeader is used) */}
      {/* Hidden on mobile when search is focused to avoid keyboard pushing it up */}
      {showBottomModeBar && !hideBottomBar && (
        <>
          <div className="h-24 sm:h-20" aria-hidden="true" />
          <div className="fixed left-1/2 -translate-x-1/2 bottom-[6rem] sm:bottom-8 w-[calc(100%-2.5rem)] max-w-[420px] z-50 pointer-events-none">
            <div
              className="pointer-events-auto rounded-[22px] px-3.5 py-2.5 shadow-xl shadow-black/10 dark:shadow-black/40 backdrop-blur-2xl border bg-dark-900/90 border-white/10"
            >
              {mode === 'browse' ? (
                // Browse mode: just tabs (single row, minimal)
                <div>
                  {renderModeSelector()}
                </div>
              ) : (
                // Study/Review modes: tabs + controls (compact when empty, expands when selected)
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      {renderModeSelector()}
                    </div>
                    {(onSelectAll || onClearSelection) && (
                      <button
                        onClick={() => {
                          const allSelected = stats?.total && selectedCount >= stats.total
                          if (allSelected) {
                            onClearSelection?.()
                          } else {
                            onSelectAll?.()
                          }
                        }}
                        className="p-2 rounded-md transition-colors bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600"
                        aria-label={stats?.total && selectedCount >= stats.total ? 'Deselect all' : 'Select all'}
                      >
                        {stats?.total && selectedCount >= stats.total ? (
                          <CheckSquare className="w-5 h-5 text-primary-500" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    )}
                  </div>
                  {renderModeActions()}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
