/**
 * useQuizAutoSave Hook
 *
 * Provides localStorage-based auto-save for quiz progress with:
 * - Debounced saves (500ms delay)
 * - User-isolated storage keys
 * - 48-hour expiration
 * - Auto-restore on mount
 * - Clear on submission
 *
 * Pattern: Follows existing UserStorageService pattern
 */

import { useCallback, useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'

interface QuizProgress {
  answers: Record<number, number | string>
  currentQuestion: number
  totalQuestions: number
  timestamp: number
}

interface UseQuizAutoSaveOptions {
  contentType: 'story' | 'comic'
  contentId: string
  enabled?: boolean
  expirationHours?: number
}

const DEBOUNCE_DELAY = 500 // ms
const DEFAULT_EXPIRATION_HOURS = 48

export function useQuizAutoSave({
  contentType,
  contentId,
  enabled = true,
  expirationHours = DEFAULT_EXPIRATION_HOURS,
}: UseQuizAutoSaveOptions) {
  const { user } = useAuth()
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Generate storage key
  const getStorageKey = useCallback(() => {
    const userId = user?.uid || 'anonymous'
    return `moshimoshi_quiz_progress_${contentType}_${contentId}_${userId}`
  }, [contentType, contentId, user?.uid])

  /**
   * Save quiz progress to localStorage (debounced)
   */
  const saveProgress = useCallback(
    (progress: Omit<QuizProgress, 'timestamp'>) => {
      if (!enabled) return

      // Clear existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      // Debounce the save operation
      debounceTimerRef.current = setTimeout(() => {
        try {
          const key = getStorageKey()
          const data: QuizProgress = {
            ...progress,
            timestamp: Date.now(),
          }

          localStorage.setItem(key, JSON.stringify(data))
        } catch (error) {
          console.error('[useQuizAutoSave] Failed to save progress:', error)
        }
      }, DEBOUNCE_DELAY)
    },
    [enabled, getStorageKey]
  )

  /**
   * Restore quiz progress from localStorage
   */
  const restoreProgress = useCallback((): QuizProgress | null => {
    if (!enabled) return null

    try {
      const key = getStorageKey()
      const saved = localStorage.getItem(key)

      if (!saved) return null

      const data: QuizProgress = JSON.parse(saved)

      // Check if expired
      const now = Date.now()
      const expirationMs = expirationHours * 60 * 60 * 1000
      const isExpired = now - data.timestamp > expirationMs

      if (isExpired) {
        localStorage.removeItem(key)
        return null
      }

      return data
    } catch (error) {
      console.error('[useQuizAutoSave] Failed to restore progress:', error)
      return null
    }
  }, [enabled, expirationHours, getStorageKey])

  /**
   * Clear saved progress
   */
  const clearProgress = useCallback(() => {
    if (!enabled) return

    try {
      const key = getStorageKey()
      localStorage.removeItem(key)
    } catch (error) {
      console.error('[useQuizAutoSave] Failed to clear progress:', error)
    }
  }, [enabled, getStorageKey])

  /**
   * Cleanup debounce timer on unmount
   */
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  /**
   * Clear expired quiz data on mount (cleanup)
   */
  useEffect(() => {
    if (!enabled) return

    try {
      const prefix = 'moshimoshi_quiz_progress_'
      const now = Date.now()
      const expirationMs = expirationHours * 60 * 60 * 1000

      // Iterate through all localStorage keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)

        if (key && key.startsWith(prefix)) {
          const item = localStorage.getItem(key)

          if (item) {
            try {
              const data: QuizProgress = JSON.parse(item)
              const isExpired = now - data.timestamp > expirationMs

              if (isExpired) {
                localStorage.removeItem(key)
              }
            } catch {
              // Invalid JSON, remove it
              localStorage.removeItem(key)
            }
          }
        }
      }
    } catch (error) {
      console.error('[useQuizAutoSave] Failed to cleanup expired progress:', error)
    }
  }, [enabled, expirationHours])

  return {
    saveProgress,
    restoreProgress,
    clearProgress,
  }
}
