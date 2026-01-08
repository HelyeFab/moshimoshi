import { useEffect, useMemo, useState } from 'react'
import type { R2QueueStatus } from '@/types/r2'
import { getR2UploadQueue } from '@/lib/r2/R2UploadQueue'
import { useAuth } from '@/hooks/useAuth'

type UploadStatus = 'idle' | 'uploading' | 'completed' | 'failed'

function deriveStatus(status: R2QueueStatus): UploadStatus {
  if (status.uploading > 0 || status.pending > 0) return 'uploading'
  if (status.failed > 0) return 'failed'
  if (status.completed > 0) return 'completed'
  return 'idle'
}

export function useR2Upload(deckId: string) {
  const { user } = useAuth()
  const userId = user?.uid

  const queue = useMemo(() => {
    if (!userId) return null
    return getR2UploadQueue(userId)
  }, [userId])

  const [status, setStatus] = useState<UploadStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [queueStatus, setQueueStatus] = useState<R2QueueStatus | null>(null)

  useEffect(() => {
    let mounted = true
    let pollTimer: NodeJS.Timeout | null = null
    if (!queue || !deckId) return

    const updateFromQueue = async () => {
      const queueStatus = await queue.getStatus(deckId)
      if (!mounted) return
      setQueueStatus(queueStatus)
      setStatus(deriveStatus(queueStatus))
      const total = queueStatus.totalBytes || 0
      const uploaded = queueStatus.uploadedBytes || 0
      setProgress(total > 0 ? Math.round((uploaded / total) * 100) : 0)
    }

    updateFromQueue()
    queue.start().catch(() => {})

    // Poll every 2 seconds for status updates
    pollTimer = setInterval(() => {
      if (mounted) {
        updateFromQueue()
      }
    }, 2000)

    const handleProgress = (data: any) => {
      if (data.deckId !== deckId) return
      const nextStatus = data.status as R2QueueStatus
      setQueueStatus(nextStatus)
      setStatus(deriveStatus(nextStatus))
      const total = nextStatus.totalBytes || 0
      const uploaded = nextStatus.uploadedBytes || 0
      setProgress(total > 0 ? Math.round((uploaded / total) * 100) : 0)
    }

    const handleError = (data: any) => {
      if (data.deckId !== deckId) return
      setStatus('failed')
      setError(data.error || 'Upload failed')
    }

    queue.on('progress', handleProgress)
    queue.on('error', handleError)

    return () => {
      mounted = false
      if (pollTimer) clearInterval(pollTimer)
      queue.off('progress', handleProgress)
      queue.off('error', handleError)
    }
  }, [queue, deckId])

  const startUpload = async (packageBlob: Blob, mediaFiles: Map<string, Blob>) => {
    if (!queue) return
    setError(null)
    setStatus('uploading')
    await queue.queueDeckUpload(deckId, packageBlob, mediaFiles)
    await queue.start()
  }

  const retry = async () => {
    if (!queue) return
    setError(null)
    await queue.retryFailed(deckId)
    await queue.start()
  }

  return { status, progress, error, queueStatus, startUpload, retry }
}
