'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, X } from 'lucide-react'
import { BlastItem, BlastStep, BlastStepAnswer, BlastSessionStats } from '@/lib/blast-mode/types'
import BlastStepRenderer from './BlastStepRenderer'
import Dialog from '@/components/ui/Dialog'
import { initializeEventHub, getEventHub } from '@/lib/review-engine/core/event-hub'
import { ReviewEventType, SessionCompletedPayload } from '@/lib/review-engine/core/events'
import { useLocalePath } from '@/i18n/I18nContext'
import { useTranslation } from '@/hooks/useTranslation'

interface BlastSessionProps {
  items: BlastItem[]
  steps: BlastStep[]
  userId: string
  sessionId: string
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
  onComplete
}: BlastSessionProps) {
  const router = useRouter()
  const { getLocalePath } = useLocalePath()
  const { t } = useTranslation()
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [answers, setAnswers] = useState<BlastStepAnswer[]>([])
  const [isAnswered, setIsAnswered] = useState(false)
  const [wasCorrect, setWasCorrect] = useState(false)
  const [sessionStartTime] = useState(Date.now())
  const [stepStartTime, setStepStartTime] = useState(Date.now())
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const eventHubInitialized = useRef(false)

  // Initialize Event Hub
  useEffect(() => {
    if (!eventHubInitialized.current && userId) {
      initializeEventHub(userId)
      eventHubInitialized.current = true
    }
  }, [userId])

  // Guard against empty steps
  if (steps.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850 flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">{t('blastMode.session.noSteps')}</p>
      </div>
    )
  }

  const currentStep = steps[currentStepIndex]
  const isLastStep = currentStepIndex === steps.length - 1

  // Handle user answer
  const handleAnswer = (answer: string | string[], correct: boolean) => {
    const responseTime = Date.now() - stepStartTime

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
      setStepStartTime(Date.now())
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
      totalSteps: steps.length,
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

    // Emit SESSION_COMPLETED event via Event Hub
    try {
      const eventHub = getEventHub()

      const payload: SessionCompletedPayload = {
        sessionId,
        statistics: {
          sessionId,
          totalItems: steps.length,
          completedItems: answers.length,
          correctItems: stats.correctSteps,
          incorrectItems: stats.incorrectSteps,
          skippedItems: steps.length - answers.length,
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
          maxPossibleScore: steps.length * 100,
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

  // Progress percentage
  const progress = ((currentStepIndex + 1) / steps.length) * 100

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
              {currentStepIndex + 1} / {steps.length}
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
              totalSteps={steps.length}
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
      {showCompletionModal && (
        <CompletionModal
          stats={calculateStats()}
          onClose={() => router.push(getLocalePath('/tools/blast-mode'))}
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
