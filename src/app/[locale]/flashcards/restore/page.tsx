'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import { useRestore } from '@/hooks/useRestore'
import { BackupCard } from '@/components/anki/BackupCard'
import { RestoreProgressModal } from '@/components/anki/RestoreProgressModal'
import { LoadingSpinner } from '@/components/ui/Loading'

export default function RestorePage() {
  const t = useTranslations('flashcards.restore')
  const { backups, loading, restore, restoring, progress } = useRestore()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {t('title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">{t('description')}</p>
      </div>

      {backups.length === 0 && (
        <div className="text-center py-12">
          <div className="mb-4 text-6xl">📦</div>
          <p className="text-gray-600 dark:text-gray-400">{t('noBackups')}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {backups.map(backup => (
          <BackupCard
            key={backup.deckId}
            backup={backup}
            onRestore={() => restore(backup)}
            disabled={restoring}
          />
        ))}
      </div>

      {restoring && progress && <RestoreProgressModal progress={progress} />}
    </div>
  )
}
