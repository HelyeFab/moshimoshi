'use client'

import React, { useState, useEffect } from 'react'
import { Volume2, Play, Pause, Square, ListMusic, Repeat, ChevronDown, Lock } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { useI18n } from '@/i18n/I18nContext'

interface AudioControlMenuProps {
  // Audio state
  isPlayingPage: boolean
  isPlayingFullStory: boolean
  isStoryLoopEnabled: boolean
  isScreenLocked?: boolean
  isArticleLoopEnabled?: boolean
  repeatCount?: number
  currentRepeat?: number

  // Status info
  currentPage: number
  totalPages: number

  // Handlers
  onPlayPage: () => void
  onPlayFullStory: () => void
  onStopFullStory: () => void
  onRestartFullStory: () => void
  onToggleLoop: () => void
  onToggleLock?: () => void
  onToggleArticleLoop?: () => void
  onRepeatCountChange?: (value: number) => void
  showArticleLoopControls?: boolean

  // UI customization
  className?: string
  disabled?: boolean
}

export default function AudioControlMenu({
  isPlayingPage,
  isPlayingFullStory,
  isStoryLoopEnabled,
  isScreenLocked = false,
  isArticleLoopEnabled = false,
  repeatCount = 1,
  currentRepeat = 1,
  currentPage,
  totalPages,
  onPlayPage,
  onPlayFullStory,
  onStopFullStory,
  onRestartFullStory,
  onToggleLoop,
  onToggleLock,
  onToggleArticleLoop,
  onRepeatCountChange,
  showArticleLoopControls = false,
  className = '',
  disabled = false,
}: AudioControlMenuProps) {
  const { t } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const getLabel = (key: string, fallback: string) => {
    const value = t(key)
    return value === key ? fallback : value
  }

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Determine current status
  const getStatus = () => {
    if (isPlayingFullStory) {
      const key = isPlayingPage
        ? (isStoryLoopEnabled ? 'story.playingPageLoop' : 'story.playingPage')
        : (isStoryLoopEnabled ? 'story.pausedPageLoop' : 'story.pausedPage')

      return {
        text: t(key, { current: currentPage + 1, total: totalPages }),
        color: isPlayingPage ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400',
        dot: isPlayingPage ? 'bg-green-500' : 'bg-amber-500',
        animate: isPlayingPage
      }
    }
    return {
      text: t('story.pageCount', { current: currentPage + 1, total: totalPages }),
      color: 'text-gray-500 dark:text-gray-400',
      dot: 'bg-gray-400',
      animate: false
    }
  }

  const status = getStatus()

  const menuContent = (
    <div className="space-y-4">
      {/* Status Indicator */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
        <div className={`w-2 h-2 rounded-full ${status.dot} ${status.animate ? 'animate-pulse' : ''}`} />
        <span className={`text-sm font-medium ${status.color}`}>
          {status.text}
        </span>
      </div>

      {/* Simple Controls - Just Pause and Restart */}
      <div className="space-y-2">
        {/* Pause */}
        <button
          onClick={() => {
            onPlayPage()
            setIsOpen(false)
          }}
          disabled={disabled}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Pause className="w-4 h-4 text-primary-500" />
          <div className="flex-1 text-left">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {t('common.pause')}
            </div>
          </div>
        </button>

        {/* Restart */}
        <button
          onClick={() => {
            onRestartFullStory()
            setIsOpen(false)
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-all duration-200 hover:scale-[1.02] active:scale-95 shadow-md"
        >
          <Repeat className="w-4 h-4" />
          <div className="flex-1 text-left">
            <div className="text-sm font-medium">
              {t('common.restart')}
            </div>
          </div>
        </button>
      </div>

      {/* Article Loop + Repeat + Lock (TTS/VOICEVOX only) */}
      {showArticleLoopControls && onToggleArticleLoop && onRepeatCountChange && (
        <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => {
              onToggleArticleLoop()
              setIsOpen(false)
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
              isArticleLoopEnabled
                ? 'bg-primary-500 text-white'
                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-500'
            }`}
          >
            <Repeat className="w-4 h-4" />
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">
                {getLabel('story.loop', 'Loop Full Audio')}
              </div>
            </div>
          </button>

          <div className={`${isArticleLoopEnabled ? '' : 'opacity-50 pointer-events-none'}`}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {getLabel('youtubeShadowing.form.repeatLabel', 'Repeat count (1-10)')}
            </label>

            {/* Stepper controls */}
            <div className="flex items-center justify-center gap-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              <button
                onClick={() => onRepeatCountChange?.(Math.max(1, repeatCount - 1))}
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors active:scale-95"
                disabled={!isArticleLoopEnabled || repeatCount <= 1}
              >
                <span className="text-xl font-semibold text-gray-700 dark:text-gray-300">−</span>
              </button>

              <div className="flex flex-col items-center gap-1">
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={repeatCount}
                  disabled={!isArticleLoopEnabled}
                  onChange={(e) => {
                    const value = Math.max(1, Math.min(10, Number(e.target.value)));
                    onRepeatCountChange?.(value);
                  }}
                  className="w-16 px-2 py-2 text-center text-lg font-semibold border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {currentRepeat}/{repeatCount}
                </span>
              </div>

              <button
                onClick={() => onRepeatCountChange?.(Math.min(10, repeatCount + 1))}
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors active:scale-95"
                disabled={!isArticleLoopEnabled || repeatCount >= 10}
              >
                <span className="text-xl font-semibold text-gray-700 dark:text-gray-300">+</span>
              </button>
            </div>
          </div>

          {onToggleLock && (
            <button
              onClick={() => {
                if (!isArticleLoopEnabled) return
                onToggleLock()
                setIsOpen(false)
              }}
              disabled={!isArticleLoopEnabled}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Lock className="w-4 h-4 text-primary-500" />
              <div className="flex-1 text-left">
                <div className="text-sm font-medium">
                  {isScreenLocked
                    ? getLabel('story.unlock', 'Unlock Screen')
                    : getLabel('story.lock', 'Lock Screen')}
                </div>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  )

  // Mobile: Centered Modal
  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setIsOpen(true)}
          disabled={disabled}
          className={`flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500 hover:bg-primary-600 text-white transition-all duration-200 hover:scale-105 active:scale-95 shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        >
          {isPlayingPage ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
          <span className="text-sm font-medium">{t('common.audio')}</span>
        </button>

        <Modal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title={`🎧 ${t('common.audioControls')}`}
          size="md"
          closeOnOverlayClick={true}
          closeOnEsc={true}
          showCloseButton={true}
        >
          {menuContent}
        </Modal>
      </>
    )
  }

  // Desktop: Dropdown Menu
  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500 hover:bg-primary-600 text-white transition-all duration-200 hover:scale-105 active:scale-95 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPlayingPage ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Volume2 className="w-4 h-4" />
        )}
        <span className="text-sm font-medium">{t('common.audio')}</span>
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Menu */}
          <div
            className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {menuContent}
          </div>
        </>
      )}
    </div>
  )
}
