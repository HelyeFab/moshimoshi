'use client'

import { useState, useMemo, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '@/i18n/I18nContext'
import { useAnkiStudy } from '@/hooks/useAnkiStudy'
import { useAuth } from '@/hooks/useAuth'
import ReviewEngine from '@/components/review-engine/ReviewEngine'
import { AnkiAdapter } from '@/lib/review-engine/adapters/AnkiAdapter'
import { ReviewableContent } from '@/lib/review-engine/core/interfaces'
import { SessionStatistics } from '@/lib/review-engine/core/session.types'
import {
  ArrowLeft,
  Clock,
  BookOpen,
  RefreshCw,
  Play,
  Loader2,
  AlertCircle,
  CheckCircle,
  Sparkles,
  Target,
} from 'lucide-react'

type SessionState = 'preview' | 'studying' | 'complete'

interface SessionResult {
  cardsStudied: number
  timeSpent: number
  accuracy: number
}

interface PageProps {
  params: Promise<{ deckId: string; locale: string }>
}

function AnkiStudyContent({ deckId, locale }: { deckId: string; locale: string }) {
  const { t } = useI18n()
  const router = useRouter()
  const { user } = useAuth()

  const {
    deck,
    isLoading,
    error,
    newCards,
    reviewCards,
    remainingNew,
    remainingReviews,
    sessionCards,
    sessionStats,
    sessionStartTime,
    loadDeck,
    startSession,
    recordAnswer,
    nextCard,
    endSession,
    resetSession,
  } = useAnkiStudy(deckId)

  const [sessionState, setSessionState] = useState<SessionState>('preview')
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null)

  const userId = user?.uid || 'guest'

  // Create AnkiAdapter instance
  const ankiAdapter = useMemo(() => new AnkiAdapter(), [])

  // Transform session cards to ReviewableContent format for ReviewEngine
  const reviewableContent = useMemo(() => {
    if (!sessionCards.length) return []
    return sessionCards.map(card => ankiAdapter.transform(card))
  }, [sessionCards, ankiAdapter])

  // Handle starting the study session
  const handleStartSession = useCallback(() => {
    startSession()
    setSessionState('studying')
  }, [startSession])

  // Handle review completion from ReviewEngine
  const handleReviewComplete = useCallback(
    async (statistics: SessionStatistics) => {
      // Process each item result to update SRS data
      if (statistics.itemResults) {
        for (const result of statistics.itemResults) {
          await recordAnswer(result.itemId, {
            correct: result.correct,
            responseTime: result.responseTime,
          })
        }
      }

      // End session and get summary
      const result = await endSession()
      setSessionResult(result)
      setSessionState('complete')
    },
    [recordAnswer, endSession]
  )

  // Handle canceling the review
  const handleCancelReview = useCallback(() => {
    // If studying, end session first
    if (sessionState === 'studying') {
      endSession().then(result => {
        setSessionResult(result)
        setSessionState('complete')
      })
    } else {
      router.push(`/${locale}/anki-import`)
    }
  }, [sessionState, endSession, router, locale])

  // Handle going back to deck list
  const handleBackToDecks = useCallback(() => {
    router.push(`/${locale}/anki-import`)
  }, [router, locale])

  // Handle starting another session
  const handleStudyAgain = useCallback(() => {
    resetSession()
    setSessionResult(null)
    setSessionState('preview')
  }, [resetSession])

  // Format time display
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    }
    return `${seconds}s`
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background-light to-primary-50 dark:from-dark-850 dark:to-dark-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary-500 mx-auto mb-4" />
          <p className="text-text-secondary dark:text-dark-text-secondary">
            {t('anki.loadingDeck')}
          </p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !deck) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background-light to-primary-50 dark:from-dark-850 dark:to-dark-900">
        <div className="text-center max-w-md p-8">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-text-primary dark:text-dark-text-primary mb-2">
            {t('anki.errorLoadingDeck')}
          </h2>
          <p className="text-text-secondary dark:text-dark-text-secondary mb-6">
            {error || t('anki.deckNotFound')}
          </p>
          <button onClick={handleBackToDecks} className="btn btn-primary">
            {t('anki.backToDecks')}
          </button>
        </div>
      </div>
    )
  }

  // Preview screen - show stats and start button
  if (sessionState === 'preview') {
    const totalDue = newCards.length + reviewCards.length

    return (
      <div className="min-h-screen bg-gradient-to-br from-background-light to-primary-50 dark:from-dark-850 dark:to-dark-900">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          {/* Back button */}
          <button
            onClick={handleBackToDecks}
            className="flex items-center gap-2 text-text-muted dark:text-dark-text-muted hover:text-text-primary dark:hover:text-dark-text-primary mb-8 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('anki.backToDecks')}
          </button>

          {/* Deck header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-soft-white dark:bg-dark-800 rounded-2xl p-8 shadow-lg mb-6"
          >
            <h1 className="text-3xl font-bold text-text-primary dark:text-dark-text-primary mb-2">
              {deck.name}
            </h1>
            {deck.description && (
              <p className="text-text-secondary dark:text-dark-text-secondary mb-6">
                {deck.description}
              </p>
            )}

            {/* Card counts */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {newCards.length}
                </div>
                <div className="text-sm text-blue-600/70 dark:text-blue-400/70">
                  {t('anki.newCards')}
                </div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {reviewCards.length}
                </div>
                <div className="text-sm text-green-600/70 dark:text-green-400/70">
                  {t('anki.reviewCards')}
                </div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {deck.cardCount || deck.cards?.length || 0}
                </div>
                <div className="text-sm text-purple-600/70 dark:text-purple-400/70">
                  {t('anki.totalCards')}
                </div>
              </div>
            </div>

            {/* Start button */}
            {totalDue > 0 ? (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleStartSession}
                className="w-full btn btn-primary btn-lg flex items-center justify-center gap-3 py-4"
              >
                <Play className="w-6 h-6" />
                <span className="text-lg">
                  {t('anki.startStudy')} ({totalDue} {t('anki.cards')})
                </span>
              </motion.button>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-text-primary dark:text-dark-text-primary mb-2">
                  {t('anki.noCardsDue')}
                </h3>
                <p className="text-text-secondary dark:text-dark-text-secondary">
                  {t('anki.comeBackLater')}
                </p>
              </div>
            )}
          </motion.div>

          {/* Daily limits info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-soft-white dark:bg-dark-800 rounded-xl p-6 shadow-sm"
          >
            <h3 className="font-semibold text-text-primary dark:text-dark-text-primary mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-primary-500" />
              {t('anki.dailyLimits')}
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-text-secondary dark:text-dark-text-secondary">
                  {t('anki.newCardsToday')}
                </span>
                <span className="font-medium text-text-primary dark:text-dark-text-primary">
                  {newCards.length} / {deck.settings?.newCardsPerDay || 20}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary dark:text-dark-text-secondary">
                  {t('anki.reviewsToday')}
                </span>
                <span className="font-medium text-text-primary dark:text-dark-text-primary">
                  {reviewCards.length} / {deck.settings?.reviewsPerDay || 100}
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  // Studying screen - render ReviewEngine
  if (sessionState === 'studying' && reviewableContent.length > 0) {
    return (
      <ReviewEngine
        content={reviewableContent}
        contentPool={reviewableContent}
        mode="recognition"
        onComplete={handleReviewComplete}
        onCancel={handleCancelReview}
        userId={userId}
      />
    )
  }

  // Complete screen - show session summary
  if (sessionState === 'complete' && sessionResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background-light to-primary-50 dark:from-dark-850 dark:to-dark-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-soft-white dark:bg-dark-800 rounded-2xl shadow-2xl p-8 max-w-md w-full"
        >
          {/* Success header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
            >
              <Sparkles className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            </motion.div>
            <h2 className="text-2xl font-bold text-text-primary dark:text-dark-text-primary">
              {t('anki.sessionComplete')}
            </h2>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-gray-50 dark:bg-dark-700 rounded-xl p-4 text-center">
              <BookOpen className="w-6 h-6 text-primary-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-text-primary dark:text-dark-text-primary">
                {sessionResult.cardsStudied}
              </div>
              <div className="text-sm text-text-muted dark:text-dark-text-muted">
                {t('anki.cardsStudied')}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-dark-700 rounded-xl p-4 text-center">
              <Clock className="w-6 h-6 text-blue-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-text-primary dark:text-dark-text-primary">
                {formatTime(sessionResult.timeSpent)}
              </div>
              <div className="text-sm text-text-muted dark:text-dark-text-muted">
                {t('anki.timeSpent')}
              </div>
            </div>
            <div className="col-span-2 bg-gray-50 dark:bg-dark-700 rounded-xl p-4 text-center">
              <Target className="w-6 h-6 text-green-500 mx-auto mb-2" />
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                {sessionResult.accuracy}%
              </div>
              <div className="text-sm text-text-muted dark:text-dark-text-muted">
                {t('anki.accuracy')}
              </div>
            </div>
          </div>

          {/* Motivational message */}
          <div className="text-center mb-8 text-text-secondary dark:text-dark-text-secondary">
            {sessionResult.accuracy >= 90 && t('anki.excellentWork')}
            {sessionResult.accuracy >= 70 && sessionResult.accuracy < 90 && t('anki.greatJob')}
            {sessionResult.accuracy < 70 && t('anki.keepPracticing')}
          </div>

          {/* Action buttons */}
          <div className="flex gap-4">
            <button
              onClick={handleBackToDecks}
              className="flex-1 btn btn-secondary flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              {t('anki.backToDecks')}
            </button>
            {newCards.length + reviewCards.length > 0 && (
              <button
                onClick={handleStudyAgain}
                className="flex-1 btn btn-primary flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-5 h-5" />
                {t('anki.studyMore')}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    )
  }

  // Fallback - should not reach here
  return null
}

export default function AnkiStudyPage({ params }: PageProps) {
  const resolvedParams = use(params)
  const { deckId, locale } = resolvedParams

  return <AnkiStudyContent deckId={deckId} locale={locale} />
}
