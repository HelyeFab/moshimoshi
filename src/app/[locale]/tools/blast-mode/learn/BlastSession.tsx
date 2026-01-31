'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, X } from 'lucide-react'
import {
  BlastItem,
  BlastStep,
  BlastStepAnswer,
  BlastLessonInfo,
  BlastLessonProgressRecord,
  BlastSessionRecord,
  BlastSessionStats,
  BlastContentType
} from '@/lib/blast-mode/types'
import BlastStepRenderer from './BlastStepRenderer'
import Dialog from '@/components/ui/Dialog'
import Modal from '@/components/ui/Modal'
import { initializeEventHub, getEventHub } from '@/lib/review-engine/core/event-hub'
import { ReviewEventType, SessionCompletedPayload } from '@/lib/review-engine/core/events'
import { useLocalePath } from '@/i18n/I18nContext'
import { useTranslation } from '@/hooks/useTranslation'
import { blastSessionManager } from '@/lib/blast-mode/blastSessionManager'
import { blastLessonManager } from '@/lib/blast-mode/blastLessonManager'
import { getMistakeSteps } from '@/lib/blast-mode/lesson-utils'

interface BlastSessionProps {
  items: BlastItem[]
  steps: BlastStep[]
  userId: string
  sessionId: string
  contentType: BlastContentType
  level?: string
  listId?: string
  selectedKanji?: string[]
  isPremium: boolean
  mode?: 'session' | 'lesson'
  lesson?: BlastLessonInfo
  onComplete?: (stats: BlastSessionStats) => void
}

/**
 * Blast Session Component
 * Orchestrates step progression, skipping, and completion
 * Emits ReviewEventType.SESSION_COMPLETED on finish
 */
export default function BlastSession({
  items,
  steps,
  userId,
  sessionId,
  contentType,
  level,
  listId,
  selectedKanji,
  isPremium,
  mode = 'session',
  lesson,
  onComplete
}: BlastSessionProps) {
  const router = useRouter()
  const { getLocalePath } = useLocalePath()
  const { t } = useTranslation()
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [answers, setAnswers] = useState<BlastStepAnswer[]>([])
  const [isAnswered, setIsAnswered] = useState(false)
  const [wasCorrect, setWasCorrect] = useState(false)
  const [sessionStartTime, setSessionStartTime] = useState(Date.now())
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [showRetryModal, setShowRetryModal] = useState(false)
  const [lastStats, setLastStats] = useState<BlastSessionStats | null>(null)
  const [attemptCount, setAttemptCount] = useState(1)
  const [activeSteps, setActiveSteps] = useState<BlastStep[]>(steps)
  const eventHubInitialized = useRef(false)
  const initialStepsRef = useRef<BlastStep[]>(steps)
  const isLessonMode = mode === 'lesson' && Boolean(lesson)

  useEffect(() => {
    setActiveSteps(steps)
    initialStepsRef.current = steps
  }, [steps])

  // Initialize Event Hub
  useEffect(() => {
    if (!eventHubInitialized.current && userId) {
      initializeEventHub(userId)
      eventHubInitialized.current = true
    }
  }, [userId])

  // Guard against empty steps
  if (activeSteps.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850 flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">{t('blastMode.session.noSteps')}</p>
      </div>
    )
  }

  const currentStep = activeSteps[currentStepIndex]
  const isLastStep = currentStepIndex === activeSteps.length - 1

  useEffect(() => {
    if (!isAnswered) return
    if (showExitConfirm || showCompletionModal || showRetryModal) return

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target) {
        const tagName = target.tagName?.toLowerCase()
        if (tagName === 'input' || tagName === 'textarea' || target.isContentEditable) {
          return
        }
      }

      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar' || event.key === 'ArrowRight') {
        event.preventDefault()
        handleNext()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        handleBack()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isAnswered, showExitConfirm, showCompletionModal, showRetryModal, currentStepIndex])

  // Handle user answer
  const handleAnswer = (answer: string | string[], correct: boolean, responseTime: number) => {
    // responseTime is now provided by UI screens (captured at selection, not including UI delay)

    const stepAnswer: BlastStepAnswer = {
      stepIndex: currentStepIndex,
      itemId: currentStep.itemId,
      stepType: currentStep.stepType,
      userAnswer: answer,
      correct,
      responseTime,
      timestamp: new Date()
    }

    // Replace existing answer if user went back and re-answered
    setAnswers(prevAnswers => {
      const existingIndex = prevAnswers.findIndex(a => a.stepIndex === currentStepIndex)
      if (existingIndex !== -1) {
        const newAnswers = [...prevAnswers]
        newAnswers[existingIndex] = stepAnswer
        return newAnswers
      }
      return [...prevAnswers, stepAnswer]
    })

    setIsAnswered(true)
    setWasCorrect(correct)
  }

  // Handle next step
  const handleNext = () => {
    if (isLastStep) {
      handleSessionComplete()
    } else {
      setCurrentStepIndex(currentStepIndex + 1)
      setIsAnswered(false)
      setWasCorrect(false)
    }
  }

  // Handle back
  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1)
      // Reset answer state for the previous step
      const previousAnswer = answers[currentStepIndex - 1]
      if (previousAnswer) {
        setIsAnswered(true)
        setWasCorrect(previousAnswer.correct)
      } else {
        setIsAnswered(false)
        setWasCorrect(false)
      }
    }
  }

  // Calculate session statistics
  const calculateStats = (): BlastSessionStats => {
    const totalTime = Date.now() - sessionStartTime
    const correctCount = answers.filter(a => a.correct).length
    const accuracy = answers.length > 0 ? (correctCount / answers.length) * 100 : 0

    // Calculate step type breakdown
    const stepTypeBreakdown: BlastSessionStats['stepTypeBreakdown'] = {}

    answers.forEach(answer => {
      if (!stepTypeBreakdown[answer.stepType]) {
        stepTypeBreakdown[answer.stepType] = {
          total: 0,
          correct: 0,
          avgTime: 0
        }
      }

      const breakdown = stepTypeBreakdown[answer.stepType]!
      breakdown.total += 1
      if (answer.correct) {
        breakdown.correct += 1
      }
      breakdown.avgTime = (breakdown.avgTime * (breakdown.total - 1) + answer.responseTime) / breakdown.total
    })

    const stats: BlastSessionStats = {
      sessionId,
      totalSteps: activeSteps.length,
      completedSteps: answers.length,
      correctSteps: correctCount,
      incorrectSteps: answers.length - correctCount,
      accuracy,
      totalTime,
      averageResponseTime: answers.reduce((sum, a) => sum + a.responseTime, 0) / answers.length || 0,
      stepTypeBreakdown
    }

    return stats
  }

  // Calculate streaks from answers
  const calculateStreaks = () => {
    let currentStreak = 0
    let bestStreak = 0
    let tempStreak = 0

    answers.forEach(answer => {
      if (answer.correct) {
        tempStreak++
        bestStreak = Math.max(bestStreak, tempStreak)
      } else {
        tempStreak = 0
      }
    })

    // Current streak is the last consecutive correct answers
    for (let i = answers.length - 1; i >= 0; i--) {
      if (answers[i].correct) {
        currentStreak++
      } else {
        break
      }
    }

    return { currentStreak, bestStreak }
  }

  // Handle session completion
  const handleSessionComplete = () => {
    const stats = calculateStats()
    const { currentStreak, bestStreak } = calculateStreaks()

    if (isLessonMode && stats.accuracy < 100) {
      setLastStats(stats)
      setShowRetryModal(true)
      return
    }

    // Emit SESSION_COMPLETED event via Event Hub
    try {
      const eventHub = getEventHub()

      const payload: SessionCompletedPayload = {
        sessionId,
        statistics: {
          sessionId,
          totalItems: activeSteps.length,
          completedItems: answers.length,
          correctItems: stats.correctSteps,
          incorrectItems: stats.incorrectSteps,
          skippedItems: activeSteps.length - answers.length,
          accuracy: stats.accuracy,
          averageResponseTime: stats.averageResponseTime,
          totalTime: stats.totalTime,
          currentStreak,
          bestStreak,
          performanceByDifficulty: {
            easy: { correct: 0, total: 0, avgTime: 0 },
            medium: { correct: 0, total: 0, avgTime: 0 },
            hard: { correct: 0, total: 0, avgTime: 0 }
          },
          totalScore: stats.correctSteps * 100,
          maxPossibleScore: activeSteps.length * 100,
          totalHintsUsed: 0,
          averageHintsPerItem: 0
        },
        duration: stats.totalTime
      }

      eventHub.emit(ReviewEventType.SESSION_COMPLETED, payload)
    } catch (error) {
      console.error('Failed to emit SESSION_COMPLETED event:', error)
    }

    // Call onComplete callback
    if (onComplete) {
      onComplete(stats)
    }

    // Save completed session locally and queue Firebase sync if premium
    const completedAt = new Date().toISOString()
    const record: BlastSessionRecord = {
      sessionId,
      userId,
      contentType,
      level,
      listId,
      selectedKanji: isLessonMode ? lesson?.kanjiIds : selectedKanji,
      studiedItems: items.length,
      accuracy: stats.accuracy,
      completedAt,
      source: isLessonMode ? 'blast-lesson' : 'blast-mode',
      mode: isLessonMode ? 'lesson' : 'session'
    }
    blastSessionManager.saveCompletedSession(record, isPremium).catch(error => {
      console.error('[BlastSession] Failed to save session record:', error)
    })

    if (isLessonMode && lesson) {
      const lessonRecord: BlastLessonProgressRecord = {
        lessonId: lesson.lessonId,
        userId,
        level: lesson.level,
        lessonIndex: lesson.lessonIndex,
        lessonSize: lesson.lessonSize,
        totalLessons: lesson.totalLessons,
        kanjiIds: lesson.kanjiIds,
        accuracy: stats.accuracy,
        completed: stats.accuracy >= 100,
        attempts: attemptCount,
        lastAttemptAt: completedAt,
        completedAt: stats.accuracy >= 100 ? completedAt : undefined,
        updatedAt: completedAt,
        source: 'blast-lesson'
      }
      blastLessonManager.saveLessonProgress(lessonRecord, isPremium).catch(error => {
        console.error('[BlastSession] Failed to save lesson progress:', error)
      })
    }

    // Show completion modal
    setShowCompletionModal(true)
  }

  // Handle exit
  const handleExit = () => {
    setShowExitConfirm(true)
  }

  const confirmExit = () => {
    router.push(getLocalePath('/tools/blast-mode'))
  }

  const resetForRetry = (nextSteps: BlastStep[]) => {
    setActiveSteps(nextSteps)
    setCurrentStepIndex(0)
    setAnswers([])
    setIsAnswered(false)
    setWasCorrect(false)
    setAttemptCount(count => count + 1)
    setSessionStartTime(Date.now())
    setShowRetryModal(false)
  }

  const handleRetryMistakes = () => {
    const mistakeSteps = getMistakeSteps(activeSteps, answers)
    resetForRetry(mistakeSteps)
  }

  const handleRetryFull = () => {
    resetForRetry(initialStepsRef.current)
  }

  const handleNextLesson = () => {
    if (!lesson) return
    const nextIndex = lesson.lessonIndex + 1
    if (nextIndex >= lesson.totalLessons) {
      router.push(getLocalePath('/tools/blast-mode'))
      return
    }
    const params = new URLSearchParams({
      mode: 'lesson',
      level: lesson.level,
      lesson: nextIndex.toString()
    })
    router.push(getLocalePath(`/tools/blast-mode/learn?${params.toString()}`))
  }

  // Progress percentage
  const progress = ((currentStepIndex + 1) / activeSteps.length) * 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850">
      {/* Header */}
      <div className="bg-white dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={handleBack}
              disabled={currentStepIndex === 0}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>

            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {currentStepIndex + 1} / {activeSteps.length}
            </div>

            <button
              onClick={handleExit}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
            >
              <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 dark:bg-dark-700 rounded-full h-2 overflow-hidden">
            <motion.div
              className="h-full bg-primary-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStepIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <BlastStepRenderer
              step={currentStep}
              stepIndex={currentStepIndex}
              totalSteps={activeSteps.length}
              onAnswer={handleAnswer}
              isAnswered={isAnswered}
              wasCorrect={wasCorrect}
              savedAnswer={answers.find(a => a.stepIndex === currentStepIndex)}
            />
          </motion.div>
        </AnimatePresence>

        {/* Next Button */}
        {isAnswered && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center mt-8"
          >
            <button
              onClick={handleNext}
              className="px-8 py-3 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 transition-colors"
            >
              {isLastStep ? t('blastMode.buttons.finish') : t('blastMode.buttons.next')}
            </button>
          </motion.div>
        )}
      </div>

      {/* Exit Confirmation Dialog */}
      <Dialog
        isOpen={showExitConfirm}
        onClose={() => setShowExitConfirm(false)}
        title={t('blastMode.session.exitConfirm.title')}
        message={t('blastMode.session.exitConfirm.message')}
        confirmText={t('blastMode.buttons.exit')}
        cancelText={t('blastMode.buttons.continue')}
        onConfirm={confirmExit}
        type="warning"
      />

      {/* Completion Modal */}
      {showCompletionModal && !isLessonMode && (
        <CompletionModal
          stats={calculateStats()}
          onClose={() => router.push(getLocalePath('/tools/blast-mode'))}
        />
      )}

      {showCompletionModal && isLessonMode && lesson && (
        <LessonCompletionModal
          stats={calculateStats()}
          lesson={lesson}
          onNext={handleNextLesson}
          onClose={() => router.push(getLocalePath('/tools/blast-mode'))}
        />
      )}

      {/* Lesson Retry Modal */}
      {showRetryModal && isLessonMode && lastStats && (
        <LessonRetryModal
          stats={lastStats}
          onRetryMistakes={handleRetryMistakes}
          onRetryFull={handleRetryFull}
          onExit={() => router.push(getLocalePath('/tools/blast-mode'))}
        />
      )}
    </div>
  )
}

/**
 * Completion Modal
 * Shows session results
 */
function CompletionModal({
  stats,
  onClose
}: {
  stats: BlastSessionStats
  onClose: () => void
}) {
  const { t } = useTranslation()
  const message = t('blastMode.session.completion.message', {
    completedSteps: stats.completedSteps,
    accuracy: Math.round(stats.accuracy)
  })

  return (
    <>
      <Dialog
        isOpen={true}
        onClose={onClose}
        title={t('blastMode.session.completion.title')}
        message={message}
        confirmText={t('blastMode.buttons.done')}
        onConfirm={onClose}
        type="success"
      />
    </>
  )
}

function LessonCompletionModal({
  stats,
  lesson,
  onNext,
  onClose
}: {
  stats: BlastSessionStats
  lesson: BlastLessonInfo
  onNext: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const isLastLesson = lesson.lessonIndex + 1 >= lesson.totalLessons
  const message = t('blastMode.lesson.completion.message', {
    accuracy: Math.round(stats.accuracy),
    current: lesson.lessonIndex + 1,
    total: lesson.totalLessons
  })

  return (
    <Modal isOpen={true} onClose={onClose} size="sm" closeOnOverlayClick={false} closeOnEsc={false} showCloseButton={false}>
      <div className="text-center sm:text-left">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="mx-auto sm:mx-0 flex-shrink-0 text-3xl text-green-500">
            ✅
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {t('blastMode.lesson.completion.title')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {message}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
          >
            {t('blastMode.lesson.completion.back')}
          </button>
          <button
            onClick={isLastLesson ? onClose : onNext}
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
          >
            {isLastLesson
              ? t('blastMode.lesson.completion.done')
              : t('blastMode.lesson.completion.nextLesson')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function LessonRetryModal({
  stats,
  onRetryMistakes,
  onRetryFull,
  onExit
}: {
  stats: BlastSessionStats
  onRetryMistakes: () => void
  onRetryFull: () => void
  onExit: () => void
}) {
  const { t } = useTranslation()
  const accuracy = Math.round(stats.accuracy)

  return (
    <Modal isOpen={true} onClose={onExit} size="sm" closeOnOverlayClick={false} closeOnEsc={false} showCloseButton={false}>
      <div className="text-center p-2">
        <div className="flex flex-col items-center gap-4 mb-6">
          <div className="text-5xl">
            ⚠️
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
              {t('blastMode.lesson.retry.title')}
            </h3>
            <p className="text-base text-gray-600 dark:text-gray-400">
              {t('blastMode.lesson.retry.message', { accuracy })}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={onRetryMistakes}
            className="w-full px-6 py-3 text-base font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
          >
            {t('blastMode.lesson.retry.retryMistakes')}
          </button>
          <button
            onClick={onRetryFull}
            className="w-full px-6 py-3 text-base font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-colors"
          >
            {t('blastMode.lesson.retry.retryFull')}
          </button>
          <button
            onClick={onExit}
            className="w-full px-6 py-3 text-base font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
          >
            {t('blastMode.lesson.retry.exit')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
