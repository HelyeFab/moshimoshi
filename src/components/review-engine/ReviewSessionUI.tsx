/**
 * ReviewSessionUI - Clean wrapper component for URE architecture
 *
 * This component replaces the legacy ReviewEngine.tsx by using the proper
 * URE architecture through the useSessionManager hook. It handles:
 * - Event hub initialization for gamification
 * - Session lifecycle via hook
 * - Composing existing UI components
 * - Automatic gamification (no manual event emission needed)
 *
 * IMPORTANT: This component does NOT:
 * - Create its own EventEmitter
 * - Manually emit SESSION_COMPLETED events
 * - Directly instantiate SessionManager
 * - Handle business logic (that's in SessionManager)
 */

'use client'

import { useEffect, useState } from 'react'
import { useSessionManager } from '@/hooks/useSessionManager'
import { initializeEventHub } from '@/lib/review-engine/core/event-hub'
import { ReviewableContent } from '@/lib/review-engine/core/interfaces'
import { ReviewMode } from '@/lib/review-engine/core/types'
import { SessionStatistics } from '@/lib/review-engine/core/session.types'
import ReviewCard from './ReviewCard'
import AnswerInput from './AnswerInput'
import ProgressBar from './ProgressBar'
import SessionSummary from './SessionSummary'

export interface ReviewSessionUIProps {
  /** Content to review (already adapted to ReviewableContent format) */
  content: ReviewableContent[]

  /** Optional pool for generating multiple choice distractors */
  contentPool?: ReviewableContent[]

  /** User ID for session tracking */
  userId: string

  /** Review mode */
  mode?: ReviewMode

  /** Callbacks */
  onComplete: (statistics: SessionStatistics) => void
  onCancel: () => void
  onProgressUpdate?: (progress: {
    current: number
    total: number
    percentage: number
    correct: number
    incorrect: number
    skipped: number
  }) => void

  /** Configuration */
  config?: {
    showHints?: boolean
    enableConfidence?: boolean
    shuffleAnswers?: boolean
  }
  shuffle?: boolean
}

/**
 * ReviewSessionUI Component
 *
 * Clean, simple wrapper that uses proper URE architecture.
 * All business logic is in SessionManager (via hook).
 * Event Hub handles gamification automatically.
 */
export default function ReviewSessionUI({
  content,
  contentPool,
  userId,
  mode = 'recognition',
  onComplete,
  onCancel,
  onProgressUpdate,
  config,
  shuffle = false
}: ReviewSessionUIProps) {
  const [showAnswer, setShowAnswer] = useState(false)
  const [isAnswered, setIsAnswered] = useState(false)

  // Initialize event hub once for gamification
  // This connects to gamificationListener automatically
  useEffect(() => {
    if (userId) {
      initializeEventHub(userId)
    }
  }, [userId])

  // Use SessionManager hook - this is the heart of URE
  const {
    state,
    startSession,
    submitAnswer,
    nextItem,
    skipItem
  } = useSessionManager({
    userId,
    mode,
    content,
    onComplete: (stats) => {
      // SessionManager emits SESSION_COMPLETED event automatically
      // Event Hub forwards it to gamificationListener
      // We just handle UI logic here
      onComplete(stats)
    },
    onError: (error) => {
      console.error('[ReviewSessionUI] Error:', error)
      // Could show error toast here
    },
    shuffle,
    autoStart: true // ✅ Let hook handle session start after proper initialization
  })

  // autoStart in useSessionManager handles initialization race condition
  // No manual startSession needed - prevents "SessionManager not initialized" errors

  // Report progress updates to parent
  useEffect(() => {
    if (onProgressUpdate && state.progress) {
      onProgressUpdate(state.progress)
    }
  }, [state.progress, onProgressUpdate])

  // Handle answer submission
  const handleAnswer = async (answer: string, confidence?: number) => {
    if (isAnswered) return // Prevent double submission

    setIsAnswered(true)
    setShowAnswer(true)

    try {
      // Submit answer to SessionManager
      // It handles validation, SRS calculation, statistics, and event emission
      const validConfidence = confidence !== undefined && confidence >= 1 && confidence <= 5
        ? (confidence as 1 | 2 | 3 | 4 | 5)
        : undefined
      await submitAnswer(answer, validConfidence)
      // User must click Next to proceed (no auto-advance)
    } catch (error) {
      console.error('[ReviewSessionUI] Error submitting answer:', error)
      setIsAnswered(false)
      setShowAnswer(false)
    }
  }

  // Handle manual next navigation
  const handleNext = async () => {
    try {
      console.log('[ReviewSessionUI] Next clicked, current:', state.progress.current, 'total:', state.progress.total)
      const next = await nextItem()
      console.log('[ReviewSessionUI] Next item:', next ? 'exists' : 'null (session should complete)')
      setShowAnswer(false)
      setIsAnswered(false)
    } catch (error) {
      console.error('[ReviewSessionUI] Error moving to next item:', error)
    }
  }

  // Handle skip
  const handleSkip = async () => {
    try {
      await skipItem()
      setShowAnswer(false)
      setIsAnswered(false)
    } catch (error) {
      console.error('[ReviewSessionUI] Error skipping item:', error)
    }
  }

  // Loading state
  if (!state.isActive && !state.isCompleted) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Starting session...</p>
        </div>
      </div>
    )
  }

  // Completed state
  if (state.isCompleted && state.statistics) {
    return (
      <SessionSummary
        statistics={state.statistics}
        onClose={onCancel}
      />
    )
  }

  // Active session
  const currentItem = state.currentItem
  if (!currentItem) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-600 dark:text-gray-400">No items to review</p>
      </div>
    )
  }

  return (
    <div className="review-session-container max-w-2xl mx-auto p-4 space-y-6">
      {/* Progress Bar */}
      <ProgressBar
        current={state.progress.current}
        total={state.progress.total}
        correct={state.progress.correct}
        streak={state.statistics?.currentStreak || 0}
      />

      {/* Review Card */}
      <ReviewCard
        content={currentItem.content}
        mode={mode}
        showAnswer={showAnswer}
        onAudioPlay={() => {
          // Could track audio plays
        }}
      />

      {/* Answer Input */}
      <AnswerInput
        mode={mode}
        content={currentItem.content}
        contentPool={contentPool}
        onAnswer={handleAnswer}
        disabled={isAnswered}
        showAnswer={showAnswer}
      />

      {/* Action Buttons */}
      <div className="flex justify-between items-center pt-4">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          Cancel
        </button>

        <div className="flex gap-2">
          {!isAnswered && (
            <button
              onClick={handleSkip}
              className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Skip
            </button>
          )}

          {isAnswered && (
            <button
              onClick={handleNext}
              className="px-6 py-2 text-sm bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors font-medium"
            >
              {state.progress?.current >= state.progress?.total ? 'Finish' : 'Next >'}
            </button>
          )}
        </div>
      </div>

    </div>
  )
}
