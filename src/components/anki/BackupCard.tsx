'use client'

import React from 'react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { BackupInfo } from '@/types/r2'
import { useTranslations } from 'next-intl'

interface BackupCardProps {
  backup: BackupInfo
  onRestore: () => void
  disabled: boolean
}

export function BackupCard({ backup, onRestore, disabled }: BackupCardProps) {
  const t = useTranslations('flashcards.restore')

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('default', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <CardTitle className="text-lg">{backup.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <span className="font-medium">{backup.cardCount}</span>
            <span>{t('cards')}</span>
          </div>
          {backup.hasMedia && (
            <div className="flex items-center gap-2">
              <span className="text-lg">📎</span>
              <span>{t('withMedia')}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 dark:text-gray-500">{t('lastBackup')}:</span>
            <span>{formatDate(backup.lastBackup)}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={onRestore} disabled={disabled} className="w-full">
          {t('restoreButton')}
        </Button>
      </CardFooter>
    </Card>
  )
}
