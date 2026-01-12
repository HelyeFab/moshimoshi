'use client'

import { useState, useEffect, useCallback } from 'react'
import { MoodBoard } from '@/types/moodboard'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { useAuth } from '@/hooks/useAuth'
import { getMoodBoardCacheManager } from '@/lib/moodboards/MoodBoardCacheManager'

interface UseMoodBoardsReturn {
  moodBoards: MoodBoard[]
  loading: boolean
  error: string | null
  refreshMoodBoards: () => Promise<void>
  createMoodBoard: (board: Omit<MoodBoard, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>
  updateMoodBoard: (id: string, updates: Partial<MoodBoard>) => Promise<void>
  deleteMoodBoard: (id: string) => Promise<void>
  toggleMoodBoardStatus: (id: string, isActive: boolean) => Promise<void>
}

// Convert API response to MoodBoard
function convertApiMoodBoard(data: any): MoodBoard {
  return {
    id: data.id,
    title: data.title || 'Untitled',
    emoji: data.emoji || '🎨',
    jlpt: data.jlpt || 'N5',
    background: data.background || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    description: data.description || '',
    kanji: data.kanji || [],
    createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
    updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined,
    createdBy: data.createdBy || 'admin',
    isActive: data.isActive ?? true,
    sortOrder: data.sortOrder || 0,
  }
}

/**
 * Hook for moodboard data - uses API routes (consistent with stories pattern)
 * Admin users get all moodboards via /api/admin/moodboards
 * Regular users get active moodboards via /api/moodboards
 */
export function useMoodBoards(): UseMoodBoardsReturn {
  const [moodBoards, setMoodBoards] = useState<MoodBoard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()
  const { user } = useAuth()
  const cacheManager = getMoodBoardCacheManager()
  const offlineLimit = 5

  const fetchMoodBoards = useCallback(async () => {
    try {
      setError(null)

      // Use admin endpoint if user is admin, otherwise use public endpoint
      const endpoint = user?.isAdmin ? '/api/admin/moodboards' : '/api/moodboards'

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const cachedBoards = await cacheManager.getAll()
        if (cachedBoards.length > 0) {
          const converted = cachedBoards.map(convertApiMoodBoard)
          converted.sort((a: MoodBoard, b: MoodBoard) => {
            const aSortOrder = a.sortOrder || 0
            const bSortOrder = b.sortOrder || 0
            if (aSortOrder !== bSortOrder) {
              return aSortOrder - bSortOrder
            }
            return b.createdAt.getTime() - a.createdAt.getTime()
          })
          setMoodBoards(converted.slice(0, offlineLimit))
          setLoading(false)
          return
        }
      }

      const response = await fetch(endpoint, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch moodboards: ${response.status}`)
      }

      const data = await response.json()
      const fetchedMoodBoards = (data.moodboards || []).map(convertApiMoodBoard)

      // Sort by sortOrder first, then by createdAt
      fetchedMoodBoards.sort((a: MoodBoard, b: MoodBoard) => {
        const aSortOrder = a.sortOrder || 0
        const bSortOrder = b.sortOrder || 0
        if (aSortOrder !== bSortOrder) {
          return aSortOrder - bSortOrder
        }
        return b.createdAt.getTime() - a.createdAt.getTime()
      })

      setMoodBoards(fetchedMoodBoards)
      setLoading(false)

      if (fetchedMoodBoards.length > 0) {
        cacheManager
          .prefetchMoodBoards(fetchedMoodBoards.slice(0, offlineLimit), { skipCached: true })
          .catch((prefetchError) => {
            console.warn('[useMoodBoards] Offline prefetch failed:', prefetchError)
          })
      }
    } catch (err) {
      console.error('Error fetching mood boards:', err)
      const cachedBoards = await cacheManager.getAll()
      if (cachedBoards.length > 0) {
        const converted = cachedBoards.map(convertApiMoodBoard)
        converted.sort((a: MoodBoard, b: MoodBoard) => {
          const aSortOrder = a.sortOrder || 0
          const bSortOrder = b.sortOrder || 0
          if (aSortOrder !== bSortOrder) {
            return aSortOrder - bSortOrder
          }
          return b.createdAt.getTime() - a.createdAt.getTime()
        })
        setMoodBoards(converted.slice(0, offlineLimit))
        setError(null)
        setLoading(false)
        return
      }
      setError(err instanceof Error ? err.message : 'Failed to fetch mood boards')
      setMoodBoards([])
      setLoading(false)
    }
  }, [user?.isAdmin, cacheManager, offlineLimit])

  const refreshMoodBoards = useCallback(async () => {
    setLoading(true)
    await fetchMoodBoards()
  }, [fetchMoodBoards])

  const createMoodBoard = async (
    board: Omit<MoodBoard, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> => {
    try {
      const response = await fetch('/api/admin/moodboards', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(board),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create mood board')
      }

      const data = await response.json()

      showToast(`Mood board "${board.title}" created successfully`, 'success')

      await refreshMoodBoards()
      return data.id
    } catch (err) {
      console.error('Error creating mood board:', err)
      showToast(err instanceof Error ? err.message : 'Failed to create mood board', 'error')
      throw err
    }
  }

  const updateMoodBoard = async (id: string, updates: Partial<MoodBoard>): Promise<void> => {
    try {
      const response = await fetch('/api/admin/moodboards', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, ...updates }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update mood board')
      }

      showToast('Mood board updated successfully', 'success')

      await refreshMoodBoards()
    } catch (err) {
      console.error('Error updating mood board:', err)
      showToast(err instanceof Error ? err.message : 'Failed to update mood board', 'error')
      throw err
    }
  }

  const deleteMoodBoard = async (id: string): Promise<void> => {
    try {
      // Get mood board details for toast message
      const boardToDelete = moodBoards.find(board => board.id === id)

      const response = await fetch(`/api/admin/moodboards?id=${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete mood board')
      }

      showToast(`Mood board "${boardToDelete?.title || 'Unknown'}" deleted successfully`, 'success')

      await refreshMoodBoards()
    } catch (err) {
      console.error('Error deleting mood board:', err)
      showToast(err instanceof Error ? err.message : 'Failed to delete mood board', 'error')
      throw err
    }
  }

  const toggleMoodBoardStatus = async (id: string, isActive: boolean): Promise<void> => {
    try {
      const board = moodBoards.find(b => b.id === id)

      await updateMoodBoard(id, { isActive })

      showToast(
        `Mood board "${board?.title || 'Unknown'}" ${isActive ? 'activated' : 'deactivated'}`,
        'success'
      )
    } catch (err) {
      // Error already shown by updateMoodBoard
      throw err
    }
  }

  // Fetch on mount and when user changes
  useEffect(() => {
    fetchMoodBoards()
  }, [fetchMoodBoards])

  return {
    moodBoards,
    loading,
    error,
    refreshMoodBoards,
    createMoodBoard,
    updateMoodBoard,
    deleteMoodBoard,
    toggleMoodBoardStatus,
  }
}

// Utility function to search mood boards
export function searchMoodBoards(moodBoards: MoodBoard[], query: string): MoodBoard[] {
  if (!query.trim()) return moodBoards

  const searchTerm = query.toLowerCase()
  return moodBoards.filter(
    board =>
      board.title.toLowerCase().includes(searchTerm) ||
      board.emoji.includes(searchTerm) ||
      board.description?.toLowerCase().includes(searchTerm) ||
      board.kanji.some(
        k => k.char.includes(searchTerm) || k.meaning?.toLowerCase().includes(searchTerm)
      )
  )
}

// Utility function to filter mood boards by JLPT level
export function filterMoodBoardsByJLPT(
  moodBoards: MoodBoard[],
  jlpt: 'all' | 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
): MoodBoard[] {
  if (jlpt === 'all') return moodBoards
  return moodBoards.filter(board => board.jlpt === jlpt)
}
