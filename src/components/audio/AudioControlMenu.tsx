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

  // UI customization
  className?: string
  disabled?: boolean
}

export default function AudioControlMenu({
  isPlayingPage,
  isPlayingFullStory,
  isStoryLoopEnabled,
  isScreenLocked = false,
  currentPage,
  totalPages,
  onPlayPage,
  onPlayFullStory,
  onStopFullStory,
  onRestartFullStory,
  onToggleLoop,
  onToggleLock,
  className = '',
  disabled = false,
}: AudioControlMenuProps) {
  const { t } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

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
