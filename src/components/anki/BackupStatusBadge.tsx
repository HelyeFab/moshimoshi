'use client'

import { CheckCircle, CloudOff, Loader2, RotateCcw } from 'lucide-react'
import { useR2Upload } from '@/hooks/useR2Upload'

export function BackupStatusBadge({ deckId }: { deckId: string }) {
  const { status, progress, retry, queueStatus } = useR2Upload(deckId)

  if (status === 'idle') return null

  if (status === 'uploading') {
    const totalFiles = queueStatus ?
      queueStatus.pending + queueStatus.uploading + queueStatus.completed + queueStatus.failed : 0
    const uploadedFiles = queueStatus?.completed || 0
    const progressPercent = totalFiles > 0
      ? Math.round((uploadedFiles / totalFiles) * 100)
      : progress
    const isPending = queueStatus && queueStatus.pending > 0 && queueStatus.uploading === 0

    return (
      <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>
          {isPending ? (
            totalFiles > 0 ? `Queuing ${totalFiles} files...` : 'Preparing backup...'
          ) : (
            <>
              {progressPercent}% backed up
              {totalFiles > 0 && ` (${uploadedFiles}/${totalFiles} files)`}
            </>
          )}
        </span>
      </div>
    )
  }

  if (status === 'completed') {
    return (
      <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
        <CheckCircle className="w-3 h-3" />
        <span>Backed up</span>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={retry}
      className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 hover:text-red-500"
    >
      <CloudOff className="w-3 h-3" />
      <span>Backup failed</span>
      <RotateCcw className="w-3 h-3" />
    </button>
  )
}
