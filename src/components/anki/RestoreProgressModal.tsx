'use client'

import React from 'react'
import Modal from '@/components/ui/Modal'
import { Progress } from '@/components/ui/progress'
import type { RestoreProgress } from '@/types/r2'
import { useTranslations } from 'next-intl'

interface RestoreProgressModalProps {
  progress: RestoreProgress
  onClose?: () => void
}

export function RestoreProgressModal({ progress, onClose }: RestoreProgressModalProps) {
  const t = useTranslations('flashcards.restore')

  const getPhaseLabel = () => {
    switch (progress.phase) {
      case 'fetching-metadata':
        return t('fetchingMetadata')
      case 'downloading-manifest':
        return t('downloadingManifest')
      case 'downloading-media':
        return t('downloadingMedia')
      case 'hydrating-deck':
        return t('hydratingDeck')
      case 'complete':
        return t('complete')
      case 'error':
        return t('error')
      default:
        return 'Processing...'
    }
  }

  const getProgressPercent = () => {
    if (progress.phase === 'error') return 0
    if (progress.phase === 'complete') return 100

    // Use the progress value directly if available
    if ('progress' in progress && typeof (progress as any).progress === 'number') {
      return (progress as any).progress
    }

    // Fallback to calculating from files
    const total = Math.max(progress.totalFiles, 1)
    return (progress.filesDownloaded / total) * 100
  }

  const isOpen = progress.phase !== 'complete' || !onClose

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose || (() => {})}
      title={t('title')}
      showCloseButton={progress.phase === 'complete' || progress.phase === 'error'}
      closeOnOverlayClick={progress.phase === 'complete' || progress.phase === 'error'}
      closeOnEsc={progress.phase === 'complete' || progress.phase === 'error'}
    >
      <div className="space-y-4">
        <p className="text-gray-700 dark:text-gray-300">{getPhaseLabel()}</p>

        {progress.phase === 'downloading-media' && progress.totalFiles > 0 && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('downloadingFile', {
              current: progress.filesDownloaded,
              total: progress.totalFiles,
              filename: progress.currentFile || '',
            })}
          </p>
        )}

        <Progress value={getProgressPercent()} className="w-full" />

        {progress.phase === 'error' && progress.error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-300">{progress.error}</p>
          </div>
        )}

        {progress.phase === 'complete' && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm text-green-800 dark:text-green-300">{t('success')}</p>
          </div>
        )}
      </div>
    </Modal>
  )
}
