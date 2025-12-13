'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { ankiDeckManager, StoredAnkiDeck } from '@/lib/anki/AnkiDeckManager'
import {
  ankiStudyManager,
  AnkiDailyProgress,
  AnkiCardWithSRS,
} from '@/lib/anki/AnkiStudyManager'
import { AnkiCard } from '@/lib/anki/importer'

/**
 * Session statistics tracked during study
 */
export interface AnkiSessionStats {
  cardsStudied: number
  correctAnswers: number
  incorrectAnswers: number
  totalTimeMs: number
  averageResponseTimeMs: number
}

/**
 * Return type for useAnkiStudy hook
 */
interface UseAnkiStudyReturn {
  // State
  deck: StoredAnkiDeck | null
  isLoading: boolean
  error: string | null

  // Due cards
  newCards: AnkiCard[]
  reviewCards: AnkiCard[]

  // Progress
  todayProgress: AnkiDailyProgress | null
  remainingNew: number
  remainingReviews: number

  // Session
  sessionCards: AnkiCard[] // Combined cards for study session
  currentCardIndex: number
  sessionStartTime: number | null
  sessionStats: AnkiSessionStats

  // Actions
  loadDeck: () => Promise<void>
  startSession: () => void
  recordAnswer: (
    cardId: string,
    result: {
      correct: boolean
      responseTime: number
      confidence?: 1 | 2 | 3 | 4 | 5
    }
  ) => Promise<void>
  nextCard: () => void
  endSession: () => Promise<{ cardsStudied: number; timeSpent: number; accuracy: number }>
  resetSession: () => void
}

/**
 * Hook for managing Anki study sessions
 *
 * This hook handles:
 * - Loading deck data from AnkiDeckManager
 * - Getting due cards from AnkiStudyManager respecting daily limits
 * - Managing session state (current card, time tracking)
 * - Recording answers and updating SRS data
 * - Tracking session statistics
 */
export function useAnkiStudy(deckId: string): UseAnkiStudyReturn {
  const { user } = useAuth()
  const { isPremium } = useSubscription()

  // State
  const [deck, setDeck] = useState<StoredAnkiDeck | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Due cards
  const [newCards, setNewCards] = useState<AnkiCard[]>([])
  const [reviewCards, setReviewCards] = useState<AnkiCard[]>([])

  // Progress
  const [todayProgress, setTodayProgress] = useState<AnkiDailyProgress | null>(null)
  const [remainingNew, setRemainingNew] = useState(0)
  const [remainingReviews, setRemainingReviews] = useState(0)

  // Session state
  const [sessionCards, setSessionCards] = useState<AnkiCard[]>([])
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null)
  const [sessionStats, setSessionStats] = useState<AnkiSessionStats>({
    cardsStudied: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    totalTimeMs: 0,
    averageResponseTimeMs: 0,
  })

  // Track which cards were new at session start
  const newCardIdsRef = useRef<Set<string>>(new Set())

  const userId = user?.uid || 'guest'
  const isPremiumUser = isPremium === true

  /**
   * Load deck and due cards
   */
  const loadDeck = useCallback(async () => {
    if (!deckId || !userId) {
      setError('Missing deck ID or user ID')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Load deck from AnkiDeckManager
      const loadedDeck = await ankiDeckManager.getDeck(deckId, userId)

      if (!loadedDeck) {
        setError('Deck not found')
        setIsLoading(false)
        return
      }

      setDeck(loadedDeck)

      // Get due cards respecting daily limits
      const dueResult = await ankiStudyManager.getDueCards(loadedDeck, userId)

      setNewCards(dueResult.newCards)
      setReviewCards(dueResult.reviewCards)
      setRemainingNew(dueResult.remainingNew + dueResult.newCards.length)
      setRemainingReviews(dueResult.remainingReviews + dueResult.reviewCards.length)

      // Get today's progress
      const progress = await ankiStudyManager.getTodayProgress(deckId, userId)
      setTodayProgress(progress)

      // Track new card IDs
      newCardIdsRef.current = new Set(dueResult.newCards.map(c => c.id))
    } catch (err) {
      console.error('[useAnkiStudy] Error loading deck:', err)
      setError(err instanceof Error ? err.message : 'Failed to load deck')
    } finally {
      setIsLoading(false)
    }
  }, [deckId, userId])

  /**
   * Start a study session
   */
  const startSession = useCallback(() => {
    // Combine new cards and review cards for session
    // Interleave: add review cards first, then new cards
    const combined = [...reviewCards, ...newCards]

    if (combined.length === 0) {
      setError('No cards available for study')
      return
    }

    setSessionCards(combined)
    setCurrentCardIndex(0)
    setSessionStartTime(Date.now())
    setSessionStats({
      cardsStudied: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      totalTimeMs: 0,
      averageResponseTimeMs: 0,
    })
  }, [newCards, reviewCards])

  /**
   * Record an answer and update SRS data
   */
  const recordAnswer = useCallback(
    async (
      cardId: string,
      result: {
        correct: boolean
        responseTime: number
        confidence?: 1 | 2 | 3 | 4 | 5
      }
    ) => {
      if (!deck) {
        console.error('[useAnkiStudy] No deck loaded')
        return
      }

      try {
        // Find the card
        const card = sessionCards.find(c => c.id === cardId)
        if (!card) {
          console.error('[useAnkiStudy] Card not found:', cardId)
          return
        }

        // Check if this was a new card
        const isNew = newCardIdsRef.current.has(cardId)

        // Process the review result using AnkiStudyManager
        const updatedCard = ankiStudyManager.processReviewResult(card, result)

        // Save the updated card SRS data to the deck
        await ankiStudyManager.updateCardInDeck(deck.id, updatedCard, userId, isPremiumUser)

        // Record that the card was studied today
        await ankiStudyManager.recordCardStudied(deck.id, cardId, userId, isNew)

        // Update session stats
        setSessionStats(prev => {
          const newTotal = prev.totalTimeMs + result.responseTime
          const newCount = prev.cardsStudied + 1
          return {
            cardsStudied: newCount,
            correctAnswers: prev.correctAnswers + (result.correct ? 1 : 0),
            incorrectAnswers: prev.incorrectAnswers + (result.correct ? 0 : 1),
            totalTimeMs: newTotal,
            averageResponseTimeMs: Math.round(newTotal / newCount),
          }
        })

        // Update today's progress
        const updatedProgress = await ankiStudyManager.getTodayProgress(deck.id, userId)
        setTodayProgress(updatedProgress)

        // If this was a new card, remove it from new card tracking
        if (isNew) {
          newCardIdsRef.current.delete(cardId)
          setRemainingNew(prev => Math.max(0, prev - 1))
        } else {
          setRemainingReviews(prev => Math.max(0, prev - 1))
        }

        console.log('[useAnkiStudy] Answer recorded:', {
          cardId,
          correct: result.correct,
          responseTime: result.responseTime,
          newStatus: (updatedCard as AnkiCardWithSRS).srsData?.status,
        })
      } catch (err) {
        console.error('[useAnkiStudy] Error recording answer:', err)
        setError(err instanceof Error ? err.message : 'Failed to record answer')
      }
    },
    [deck, sessionCards, userId, isPremiumUser]
  )

  /**
   * Move to next card
   */
  const nextCard = useCallback(() => {
    setCurrentCardIndex(prev => prev + 1)
  }, [])

  /**
   * End the session and return summary
   */
  const endSession = useCallback(async () => {
    const timeSpent = sessionStartTime ? Date.now() - sessionStartTime : 0

    // Add study time to progress
    if (deck && timeSpent > 0) {
      await ankiStudyManager.addStudyTime(deck.id, userId, timeSpent)
    }

    const accuracy =
      sessionStats.cardsStudied > 0
        ? Math.round((sessionStats.correctAnswers / sessionStats.cardsStudied) * 100)
        : 0

    // Clear session state
    setSessionCards([])
    setCurrentCardIndex(0)
    setSessionStartTime(null)

    return {
      cardsStudied: sessionStats.cardsStudied,
      timeSpent,
      accuracy,
    }
  }, [deck, sessionStartTime, sessionStats, userId])

  /**
   * Reset session to initial state
   */
  const resetSession = useCallback(() => {
    setSessionCards([])
    setCurrentCardIndex(0)
    setSessionStartTime(null)
    setSessionStats({
      cardsStudied: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      totalTimeMs: 0,
      averageResponseTimeMs: 0,
    })
    // Reload deck data
    loadDeck()
  }, [loadDeck])

  // Load deck on mount and when deckId changes
  useEffect(() => {
    if (userId && deckId) {
      loadDeck()
    }
  }, [deckId, userId, loadDeck])

  return {
    // State
    deck,
    isLoading,
    error,

    // Due cards
    newCards,
    reviewCards,

    // Progress
    todayProgress,
    remainingNew,
    remainingReviews,

    // Session
    sessionCards,
    currentCardIndex,
    sessionStartTime,
    sessionStats,

    // Actions
    loadDeck,
    startSession,
    recordAnswer,
    nextCard,
    endSession,
    resetSession,
  }
}
