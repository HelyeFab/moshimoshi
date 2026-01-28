'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { useI18n } from '@/i18n/I18nContext'
import { LoadingOverlay } from '@/components/ui/Loading'
import Dialog from '@/components/ui/Dialog'
import { motion } from 'framer-motion'
import { kanjiService } from '@/services/kanjiService'
import { Kanji } from '@/types/kanji'
import SessionCompleteModal from '../components/SessionCompleteModal'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { useFeature } from '@/hooks/useFeature'
import { useUserStorage } from '@/hooks/useUserStorage'
import { KanjiMasteryProgressManager } from '@/lib/review-engine/progress/KanjiMasteryProgressManager'
import { initializeEventHub, getEventHub } from '@/lib/review-engine/core/event-hub'
import { ReviewEventType } from '@/lib/review-engine/core/events'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'
import { kanjiMasteryEvents } from '../events'
import { kanjiMasteryDB } from '@/lib/kanji-mastery/kanjiMasteryDB'
import { selectKanjiSmartly, selectKanjiMixed } from './kanjiSelection'
import { useLocalePath } from '@/i18n/I18nContext'
import { useGamificationStore } from '@/state/userGamification'
import type { TestType } from './testOrder'

// Import round components
import Round1Learn from './components/Round1Learn'
import Round2Test from './components/Round2Test'
import Round3Evaluate from './components/Round3Evaluate'

// Types for the learning session
// Note: Kanji already has examples: KanjiExample[], so we only extend with sentences
export interface KanjiWithExamples extends Kanji {
  sentences?: Array<{
    japanese: string
    english: string
  }>
}

export interface KanjiProgress {
  kanjiId: string
  round1Completed: boolean
  round2Results: Array<{
    type: TestType
    correct: boolean
    userAnswer?: string
  }>
  round2Accuracy: number
  round3Rating?: number
}

export interface SessionState {
  kanji: KanjiWithExamples[]
  currentRound: number
  currentIndex: number
  progress: Map<string, KanjiProgress>
  reviewAgainPile: Set<string>
  sessionId: string
  startTime: Date
  level: string
  mode: 'jlpt' | 'grade' | 'mixed'
}

export default function LearnContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()
  const { t } = useI18n()
  const { user, loading: authLoading, isGuest } = useAuth()
  const { subscription } = useSubscription()
  const { checkOnly } = useFeature('kanji_mastery')
  const { getItem, setItem } = useUserStorage()
  const { getLocalePath } = useLocalePath()
  const enableRandomizedTestOrder = process.env.NEXT_PUBLIC_KANJI_TEST_RANDOMIZE === 'true'

  // Session parameters
  const sessionSize = parseInt(searchParams.get('size') || '5')
  const mode = searchParams.get('mode') as 'jlpt' | 'grade' | 'mixed'
  const level = searchParams.get('level') || 'N5'
  const approach = searchParams.get('approach') as 'smart' | 'linear' || 'smart'
  const testMode = searchParams.get('testMode') === 'choice' ? 'choice' : 'recall'

  // Session state
  const [sessionState, setSessionState] = useState<SessionState>({
    kanji: [],
    currentRound: 1,
    currentIndex: 0,
    progress: new Map(),
    reviewAgainPile: new Set(),
    sessionId: Date.now().toString(),
    startTime: new Date(),
    level,
    mode
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessionComplete, setSessionComplete] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [distractorPool, setDistractorPool] = useState<KanjiWithExamples[]>([])
  const [lastTestType, setLastTestType] = useState<TestType | null>(null)

  const loadAttemptedRef = useRef(false)

  useEffect(() => {
    if (authLoading || loadAttemptedRef.current) return
    loadAttemptedRef.current = true
    loadKanjiData()
  }, [authLoading])

  const loadKanjiData = async () => {
    try {
      setLoading(true)
      setError(null)

      if (!user || isGuest) {
        setError('Sign in required to start a kanji mastery session.')
        router.push(getLocalePath('/auth/signin'))
        return
      }

      const decision = await checkOnly({ failOpen: false })
      if (!decision.allow) {
        showToast('Daily limit reached for Kanji Mastery.', 'warning')
        router.push(getLocalePath('/tools/kanji-mastery'))
        return
      }

      let kanjiData: KanjiWithExamples[] = []

      let sessionLevel = level

      if (mode === 'jlpt') {
        // Load kanji from the service
        const jlptLevel = level as import('@/types/kanji').JLPTLevel
        const levelKanji = await kanjiService.loadKanjiByLevel(jlptLevel)
        kanjiData = levelKanji.map(k => ({
          ...k,
          jlpt: jlptLevel
        }))
      } else if (mode === 'grade') {
        const gradeValue = level === 'S' ? 'S' : Number(level)
        if (gradeValue !== 'S' && !Number.isFinite(gradeValue)) {
          setError('Invalid grade selection')
          return
        }
        kanjiData = await kanjiService.loadKanjiByGrade(gradeValue)
      } else if (mode === 'mixed') {
        sessionLevel = 'mixed'
        const allKanjiByLevel = await kanjiService.loadAllKanji()
        kanjiData = Object.values(allKanjiByLevel).flatMap(list => list || [])
      } else {
        // Handle other modes later
        setError('Only JLPT mode is currently supported')
        return
      }

      let selected: KanjiWithExamples[] = []

      if (approach === 'smart') {
        const recentSessionIds = new Set<string>()
        try {
          const recentSessions = await kanjiMasteryDB.getSessionsByUser(user.uid, 5)
          const lastSameLevel = recentSessions.find(session => session.level === sessionLevel)
          if (lastSameLevel) {
            lastSameLevel.kanji.forEach(item => recentSessionIds.add(item.id))
          }
        } catch (error) {
          console.warn('[KanjiMastery] Failed to load recent sessions for pool rotation:', error)
        }

        if (mode === 'mixed') {
          const progressRecords = await kanjiMasteryDB.getProgressByUser(user.uid)
          selected = selectKanjiMixed(kanjiData, {
            requestedSize: sessionSize,
            progressRecords,
            recentSessionIds
          })
        } else {
          const progressRecords = await kanjiMasteryDB.getProgressByUserAndLevel(user.uid, sessionLevel)
          selected = selectKanjiSmartly(kanjiData, {
            requestedSize: sessionSize,
            progressRecords,
            recentSessionIds
          })
        }
      } else {
        // Linear approach - use saved progress
        const progressData = getItem<Record<string, number>>('kanjiLinearProgress', {}) || {}
        const lastIndex = progressData[sessionLevel] || 0

        if (lastIndex < kanjiData.length) {
          selected = kanjiData.slice(lastIndex, lastIndex + sessionSize)
          // Save new progress
          progressData[sessionLevel] = lastIndex + sessionSize
          setItem('kanjiLinearProgress', progressData)
        } else {
          // Start over from beginning
          selected = kanjiData.slice(0, sessionSize)
          progressData[sessionLevel] = sessionSize
          setItem('kanjiLinearProgress', progressData)
        }
      }

      if (selected.length === 0) {
        setError('No kanji available for this session')
        return
      }

      setDistractorPool(kanjiData)

      // Enrich kanji with examples (we'll implement this later)
      const enrichedKanji = await enrichKanjiData(selected)

      // Initialize progress for each kanji
      const progressMap = new Map<string, KanjiProgress>()
      enrichedKanji.forEach(k => {
        progressMap.set(k.kanji, {
          kanjiId: k.kanji,
          round1Completed: false,
          round2Results: [],
          round2Accuracy: 0
        })
      })

      setSessionState({
        kanji: enrichedKanji,
        currentRound: 1,
        currentIndex: 0,
        progress: progressMap,
        reviewAgainPile: new Set(),
        sessionId: Date.now().toString(),
        startTime: new Date(),
        level: sessionLevel,
        mode
      })
      setLastTestType(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load kanji')
    } finally {
      setLoading(false)
    }
  }

  const enrichKanjiData = async (kanji: KanjiWithExamples[]): Promise<KanjiWithExamples[]> => {
    // The KanjiDetailsModal handles enrichment internally using fetchTatoebaSentences
    // No need to pre-enrich here as it was causing fs module errors in browser
    return kanji
  }

  const handleRound1Complete = async () => {
    const currentKanji = sessionState.kanji[sessionState.currentIndex]
    const progress = sessionState.progress.get(currentKanji.kanji)

    if (progress) {
      progress.round1Completed = true
      sessionState.progress.set(currentKanji.kanji, progress)
    }

    // Emit event for external services (e.g., gamification)
    if (user) {
      await kanjiMasteryEvents.emit('round1:complete', {
        userId: user.uid,
        kanjiId: currentKanji.kanji,
        kanji: currentKanji.kanji,
        round: 1,
        timestamp: Date.now()
      })
    }

    if (sessionState.currentIndex < sessionState.kanji.length - 1) {
      setSessionState(prev => ({
        ...prev,
        currentIndex: prev.currentIndex + 1
      }))
    } else {
      // Move to Round 2
      setSessionState(prev => ({
        ...prev,
        currentRound: 2,
        currentIndex: 0
      }))
    }
  }

  const handleRound2Complete = async (
    results: Array<{ type: TestType; correct: boolean; userAnswer?: string }>,
    finalTestType: TestType | null
  ) => {
    const kanji = sessionState.kanji[sessionState.currentIndex]
    const progress = sessionState.progress.get(kanji.kanji)

    if (progress) {
      progress.round2Results = results
      const correctCount = results.filter(r => r.correct).length
      progress.round2Accuracy = results.length > 0 ? correctCount / results.length : 0
      sessionState.progress.set(kanji.kanji, progress)

      // If accuracy is low, add to review again pile
      if (progress.round2Accuracy < 0.7) {
        sessionState.reviewAgainPile.add(kanji.kanji)
      }
    }

    // Emit event for external services (e.g., gamification)
    if (user && progress) {
      const correctCount = results.filter(r => r.correct).length
      await kanjiMasteryEvents.emit('round2:complete', {
        userId: user.uid,
        kanjiId: kanji.kanji,
        kanji: kanji.kanji,
        round: 2,
        results,
        correctCount,
        totalTests: results.length,
        accuracy: progress.round2Accuracy,
        timestamp: Date.now()
      })
    }

    if (finalTestType) {
      setLastTestType(finalTestType)
    }

    if (sessionState.currentIndex < sessionState.kanji.length - 1) {
      setSessionState(prev => ({
        ...prev,
        currentIndex: prev.currentIndex + 1
      }))
    } else {
      // Move to Round 3
      setSessionState(prev => ({
        ...prev,
        currentRound: 3,
        currentIndex: 0
      }))
    }
  }

  const handleRound3Complete = async (rating: number) => {
    const kanji = sessionState.kanji[sessionState.currentIndex]
    const progress = sessionState.progress.get(kanji.kanji)

    if (progress) {
      progress.round3Rating = rating
      sessionState.progress.set(kanji.kanji, progress)

      // Emit event for external services (e.g., gamification)
      if (user) {
        await kanjiMasteryEvents.emit('round3:complete', {
          userId: user.uid,
          kanjiId: kanji.kanji,
          kanji: kanji.kanji,
          round: 3,
          rating,
          accuracy: progress.round2Accuracy,
          timestamp: Date.now()
        })
      }
    }

    if (sessionState.currentIndex < sessionState.kanji.length - 1) {
      setSessionState(prev => ({
        ...prev,
        currentIndex: prev.currentIndex + 1
      }))
    } else {
      // Session complete!
      setSessionComplete(true)
    }
  }

  // Extract save logic to be reusable
  const saveSession = async (): Promise<boolean> => {
    try {
      // Determine user tier
      const isPremium = subscription?.plan === 'premium_monthly' || subscription?.plan === 'premium_yearly' || false

      // Initialize progress manager
      const progressManager = new KanjiMasteryProgressManager()

      // Convert progress map to proper format
      const progressMap = new Map<string, KanjiProgress>()
      sessionState.progress.forEach((value, key) => {
        progressMap.set(key, {
          kanjiId: key,
          round1Completed: value.round1Completed || false,
          round2Results: value.round2Results || [],
          round2Accuracy: value.round2Accuracy || 0,
          round3Rating: value.round3Rating || 3
        })
      })

      // Update sessionState with proper progress format
      const updatedSessionState = {
        ...sessionState,
        progress: progressMap
      }

      // Track session with the progress manager
      const session = await progressManager.trackSession(
        updatedSessionState,
        user,
        isPremium
      )

      // Emit session complete event for external services (e.g., gamification)
      const accuracyPercent = Math.round(session.sessionStats.averageAccuracy * 100)
      const correctCount = Math.round(session.sessionStats.totalKanji * session.sessionStats.averageAccuracy)
      const durationMs = session.sessionStats.timeSpentSeconds * 1000

      if (user) {
        initializeEventHub(user.uid)
        await kanjiMasteryEvents.emit('session:complete', {
          sessionId: session.sessionId,
          userId: user.uid,
          kanji: session.kanji.map(k => ({
            id: k.id,
            character: k.character,
            finalScore: k.finalScore
          })),
          sessionStats: session.sessionStats,
          isPremium,
          timestamp: Date.now()
        })

        getEventHub().emit(ReviewEventType.SESSION_COMPLETED, {
          data: {
            sessionId: session.sessionId,
            statistics: {
              itemsReviewed: session.sessionStats.totalKanji,
              totalItems: session.sessionStats.totalKanji,
              correctItems: correctCount,
              accuracy: accuracyPercent,
              averageResponseTime:
                session.sessionStats.totalKanji > 0
                  ? Math.round(durationMs / session.sessionStats.totalKanji)
                  : 0,
              bestStreak: session.sessionStats.perfectKanji,
            },
            duration: durationMs,
          },
        })
      }

      if (process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION === 'true') {
        try {
          const store = useGamificationStore.getState()
          store.setLastSessionStats({
            itemsCompleted: session.sessionStats.totalKanji,
            accuracy: accuracyPercent,
            duration: durationMs,
            xpGained: 0,
            contentType: 'flashcard',
            contentTitle: 'Kanji Mastery',
            difficulty: sessionState.level,
            readingTimeMs: durationMs
          })
          store.incrementSessionCount()
        } catch (storeError) {
          console.error('[KanjiMastery] Failed to update gamification store:', storeError)
        }
      }

      if (user) {
        try {
          await fetch('/api/usage/kanji_mastery/increment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idempotencyKey: session.sessionId })
          })
        } catch (error) {
          console.error('Error tracking kanji mastery usage:', error)
        }
      }

      return true
    } catch (error) {
      console.error('Error saving session:', error)
      showToast('Failed to save session progress', 'error')
      return false
    }
  }

  const handleSessionComplete = async () => {
    await saveSession()
    router.push(getLocalePath('/tools/kanji-mastery'))
  }

  const handleGoToDashboard = async () => {
    await saveSession()
    router.push(getLocalePath('/dashboard'))
  }

  const handleStartNewSession = async () => {
    await saveSession()
    // Preserve current search params for new session
    const currentParams = new URLSearchParams(window.location.search)
    router.push(getLocalePath(`/tools/kanji-mastery/learn?${currentParams.toString()}`))
    // Force a refresh to reset state
    router.refresh()
  }

  const handleExitRequest = () => {
    setShowExitConfirm(true)
  }

  const handleExitConfirm = () => {
    router.push(getLocalePath('/tools/kanji-mastery'))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850 flex items-center justify-center">
        <LoadingOverlay isLoading={true} message="Preparing your kanji..." showDoshi={true} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850 flex items-center justify-center">
        <div className="bg-white dark:bg-dark-800 rounded-lg shadow-xl p-8 max-w-md">
          <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-4">Error</h2>
          <p className="text-gray-700 dark:text-gray-300 mb-6">{error}</p>
          <Link
            href="/tools/kanji-mastery"
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            Go Back
          </Link>
        </div>
      </div>
    )
  }

  if (sessionComplete) {
    return (
      <SessionCompleteModal
        sessionState={sessionState}
        onGoToDashboard={handleGoToDashboard}
        onStartNewSession={handleStartNewSession}
      />
    )
  }

  const currentKanji = sessionState.kanji[sessionState.currentIndex]
  const totalKanji = sessionState.kanji.length

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850">
      {/* Progress Header */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-dark-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-center mb-2">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Round {sessionState.currentRound} of 3
            </div>
          </div>

          {/* Progress Bar */}
          <div className="relative h-2 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 bg-primary-500"
              initial={{ width: 0 }}
              animate={{
                width: `${((sessionState.currentIndex + (sessionState.currentRound - 1) * totalKanji) / (totalKanji * 3)) * 100}%`
              }}
              transition={{ duration: 0.3 }}
            />
          </div>

          <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-1">
            <span>Round 1: Learn</span>
            <span>Round 2: Test</span>
            <span>Round 3: Evaluate</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {sessionState.currentRound === 1 && (
          <Round1Learn
            kanji={currentKanji}
            currentIndex={sessionState.currentIndex}
            totalKanji={totalKanji}
            onComplete={handleRound1Complete}
            onExit={handleExitRequest}
          />
        )}

        {sessionState.currentRound === 2 && (
          <Round2Test
            kanji={currentKanji}
            currentIndex={sessionState.currentIndex}
            totalKanji={totalKanji}
            onComplete={handleRound2Complete}
            onExit={handleExitRequest}
            testMode={testMode}
            distractorPool={distractorPool}
            enableRandomizedOrder={enableRandomizedTestOrder}
            lastTestType={lastTestType}
          />
        )}

        {sessionState.currentRound === 3 && (
          <Round3Evaluate
            kanji={currentKanji}
            currentIndex={sessionState.currentIndex}
            totalKanji={totalKanji}
            progress={sessionState.progress.get(currentKanji.kanji)}
            onComplete={handleRound3Complete}
            onExit={handleExitRequest}
          />
        )}
      </div>
      <Dialog
        isOpen={showExitConfirm}
        onClose={() => setShowExitConfirm(false)}
        onConfirm={handleExitConfirm}
        title={t('kanjiMasteryTool.exitConfirmTitle') || 'Exit session?'}
        message={t('kanjiMasteryTool.exitConfirmMessage') || 'Your current kanji mastery session will be lost if you leave now.'}
        confirmText={t('kanjiMasteryTool.exitConfirmConfirm') || 'Exit'}
        cancelText={t('kanjiMasteryTool.exitConfirmCancel') || 'Keep learning'}
        type="warning"
      />
      <MobileNavSpacer />
    </div>
  )
}
