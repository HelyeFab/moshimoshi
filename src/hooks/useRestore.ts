'use client'

import { useState, useEffect } from 'react'
import { RestoreOrchestrator } from '@/lib/r2/RestoreOrchestrator'
import type { BackupInfo, RestoreProgress } from '@/types/r2'
import { useAuth } from './useAuth'

export function useRestore() {
  const { user } = useAuth()
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [restoring, setRestoring] = useState(false)
  const [progress, setProgress] = useState<RestoreProgress | null>(null)

  // Fetch available backups
  useEffect(() => {
    async function fetchBackups() {
      if (!user) {
        setLoading(false)
        return
      }

      try {
        const response = await fetch('/api/anki/r2/backups')

        if (!response.ok) {
          throw new Error('Failed to fetch backups')
        }

        const data = await response.json()
        setBackups(data.backups || [])
      } catch (error) {
        console.error('[useRestore] Failed to fetch backups:', error)
        setBackups([])
      } finally {
        setLoading(false)
      }
    }

    fetchBackups()
  }, [user])

  // Restore a deck
  const restore = async (backup: BackupInfo) => {
    if (!user) {
      console.error('[useRestore] No user authenticated')
      return
    }

    setRestoring(true)
    setProgress({
      phase: 'fetching-metadata',
      filesDownloaded: 0,
      totalFiles: 0,
    })

    try {
      const orchestrator = new RestoreOrchestrator(user.uid)

      orchestrator.on('progress', (data: RestoreProgress) => {
        setProgress(data)
      })

      await orchestrator.restoreDeck(backup)

      setProgress({
        phase: 'complete',
        filesDownloaded: 1,
        totalFiles: 1,
      })

      // Refresh the page after 2 seconds to show the restored deck
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (error: any) {
      console.error('[useRestore] Restore failed:', error)
      setProgress({
        phase: 'error',
        filesDownloaded: 0,
        totalFiles: 0,
        error: error.message || 'Restore failed',
      })
    } finally {
      setRestoring(false)
    }
  }

  return { backups, loading, restore, restoring, progress }
}
