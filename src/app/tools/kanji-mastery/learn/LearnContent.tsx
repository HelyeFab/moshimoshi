'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { LoadingOverlay } from '@/components/ui/Loading'
import { motion } from 'framer-motion'
import { kanjiService } from '@/services/kanjiService'
import { Kanji } from '@/types/kanji'
import SessionCompleteModal from '../components/SessionCompleteModal'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { KanjiMasteryProgressManager } from '@/lib/review-engine/progress/KanjiMasteryProgressManager'
import { recordActivityAndSync } from '@/lib/sync/streakSync'
import { StreakActivity } from '@/stores/streakStore'
import { useXP } from '@/hooks/useXP'
import { useAchievementStore } from '@/stores/achievement-store'

// Import round components
import Round1Learn from './components/Round1Learn'
import Round2Test from './components/Round2Test'
import Round3Evaluate from './components/Round3Evaluate'

// Types for the learning session
export interface KanjiWithExamples extends Kanji {
  examples?: Array<{
    word: string
    reading: string
    meaning: string
  }>
  sentences?: Array<{
    japanese: string
    english: string
  }>
}

export interface KanjiProgress {
  kanjiId: string
  round1Completed: boolean
  round2Results: Array<{
    type: string
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
}

export default function LearnContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()
  const { user } = useAuth()
  const { subscription } = useSubscription()
  const { trackXP } = useXP()
  const { updateProgress } = useAchievementStore()

  // Session parameters
  const sessionSize = parseInt(searchParams.get('size') || '5')
  const mode = searchParams.get('mode') as 'jlpt' | 'grade' | 'mixed'
  const level = searchParams.get('level') || 'N5'
  const approach = searchParams.get('approach') as 'smart' | 'linear' || 'smart'

  // Session state
  const [sessionState, setSessionState] = useState<SessionState>({
    kanji: [],
    currentRound: 1,
    currentIndex: 0,
    progress: new Map(),
    reviewAgainPile: new Set(),
    sessionId: Date.now().toString(),
    startTime: new Date()
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessionComplete, setSessionComplete] = useState(false)

  useEffect(() => {
    loadKanjiData()
  }, [])

  const loadKanjiData = async () => {
    try {
      setLoading(true)
      setError(null)

      let kanjiData: KanjiWithExamples[] = []

      if (mode === 'jlpt') {
        // Load kanji from the service
        const jlptLevel = level.replace('N', '') // Convert N5 to 5
        const levelKanji = await kanjiService.loadKanjiByLevel(level as any)
        kanjiData = levelKanji.map(k => ({
          ...k,
          jlpt: level
        }))
      } else {
        // Handle other modes later
        setError('Only JLPT mode is currently supported')
        return
      }

      let selected: KanjiWithExamples[] = []

      if (approach === 'smart') {
        selected = await selectKanjiSmartly(kanjiData, sessionSize)
      } else {
        // Linear approach - use saved progress
        const storageKey = `kanjiLinearProgress_${level}`
        const lastIndex = parseInt(localStorage.getItem(storageKey) || '0')

        if (lastIndex < kanjiData.length) {
          selected = kanjiData.slice(lastIndex, lastIndex + sessionSize)
          // Save new progress
          localStorage.setItem(storageKey, (lastIndex + sessionSize).toString())
        } else {
          // Start over from beginning
          selected = kanjiData.slice(0, sessionSize)
          localStorage.setItem(storageKey, sessionSize.toString())
        }
      }

      if (selected.length === 0) {
        setError('No kanji available for this session')
        return
      }

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
        startTime: new Date()
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load kanji')
    } finally {
      setLoading(false)
    }
  }

  const selectKanjiSmartly = async (allKanji: KanjiWithExamples[], requestedSize: number): Promise<KanjiWithExamples[]> => {
    // Load progress from localStorage
    const progressKey = `kanjiMasteryProgress_${level}`
    const storedProgress = localStorage.getItem(progressKey)
    const progress = storedProgress ? JSON.parse(storedProgress) : {}

    const newKanji: KanjiWithExamples[] = []
    const dueForReview: KanjiWithExamples[] = []
    const struggling: KanjiWithExamples[] = []
    const now = new Date()

    for (const kanji of allKanji) {
      const kanjiProgress = progress[kanji.kanji]

      if (!kanjiProgress) {
        newKanji.push(kanji)
      } else if (kanjiProgress.nextReview && new Date(kanjiProgress.nextReview) <= now) {
        dueForReview.push(kanji)
      } else if (kanjiProgress.accuracy < 60) {
        struggling.push(kanji)
      }
    }

    const selected: KanjiWithExamples[] = []

    // Prioritize due reviews
    if (dueForReview.length > 0) {
      const reviewsToAdd = Math.min(dueForReview.length, Math.floor(requestedSize * 0.5))
      selected.push(...dueForReview.slice(0, reviewsToAdd))
    }

    // Add struggling kanji
    if (selected.length < requestedSize && struggling.length > 0) {
      const remainingSlots = requestedSize - selected.length
      const strugglingToAdd = Math.min(struggling.length, Math.floor(remainingSlots * 0.3))
      selected.push(...struggling.slice(0, strugglingToAdd))
    }

    // Fill with new kanji
    if (selected.length < requestedSize && newKanji.length > 0) {
      const remainingSlots = requestedSize - selected.length
      const newToAdd = Math.min(newKanji.length, remainingSlots)
      selected.push(...newKanji.slice(0, newToAdd))
    }

    // If still not enough, just take random kanji
    if (selected.length < requestedSize) {
      const remaining = allKanji.filter(k => !selected.includes(k))
      const shuffled = remaining.sort(() => Math.random() - 0.5)
      selected.push(...shuffled.slice(0, requestedSize - selected.length))
    }

    return selected.slice(0, requestedSize)
  }

  const enrichKanjiData = async (kanji: KanjiWithExamples[]): Promise<KanjiWithExamples[]> => {
    // The KanjiDetailsModal handles enrichment internally using fetchTatoebaSentences
    // No need to pre-enrich here as it was causing fs module errors in browser
    return kanji
  }

  const handleRound1Complete = async () => {
    // Track round completion for streak
    if (user) {
      const isPremium = subscription?.plan === 'premium_monthly' || subscription?.plan === 'premium_yearly'
      await recordActivityAndSync(
        StreakActivity.KANJI_MASTERY_ROUND,
        isPremium || false,
        Date.now()
      )
    }

    const progress = sessionState.progress.get(sessionState.kanji[sessionState.currentIndex].kanji)
    if (progress) {
      progress.round1Completed = true
      sessionState.progress.set(sessionState.kanji[sessionState.currentIndex].kanji, progress)
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

  const handleRound2Complete = async (results: any) => {
    // Track round completion
    if (user) {
      const isPremium = subscription?.plan === 'premium_monthly' || subscription?.plan === 'premium_yearly'
      await recordActivityAndSync(
        StreakActivity.KANJI_MASTERY_ROUND,
        isPremium || false,
        Date.now()
      )

      // Award XP for round 2 completion
      const correctCount = results.filter((r: any) => r.correct).length
      const xp = 10 + (correctCount * 5) // Base 10 + 5 per correct
      await trackXP('kanji_round_2', xp, 'Kanji Round 2', {
        correct: correctCount,
        total: results.length
      })
    }

    const kanji = sessionState.kanji[sessionState.currentIndex]
    const progress = sessionState.progress.get(kanji.kanji)

    if (progress) {
      progress.round2Results = results
      progress.round2Accuracy = results.filter((r: any) => r.correct).length / results.length * 100
      sessionState.progress.set(kanji.kanji, progress)

      // If accuracy is low, add to review again pile
      if (progress.round2Accuracy < 70) {
        sessionState.reviewAgainPile.add(kanji.kanji)
      }
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
    // Track round completion
    if (user) {
      const isPremium = subscription?.plan === 'premium_monthly' || subscription?.plan === 'premium_yearly'
      await recordActivityAndSync(
        StreakActivity.KANJI_MASTERY_ROUND,
        isPremium || false,
        Date.now()
      )

      // Award XP based on self-assessment
      const xp = rating * 3 // 3-15 XP based on rating
      await trackXP('kanji_round_3', xp, 'Kanji Round 3', {
        rating
      })
    }

    const kanji = sessionState.kanji[sessionState.currentIndex]
    const progress = sessionState.progress.get(kanji.kanji)

    if (progress) {
      progress.round3Rating = rating
      sessionState.progress.set(kanji.kanji, progress)

      // Save progress to localStorage
      const progressKey = `kanjiMasteryProgress_${level}`
      const storedProgress = localStorage.getItem(progressKey)
      const allProgress = storedProgress ? JSON.parse(storedProgress) : {}

      allProgress[kanji.kanji] = {
        lastStudied: new Date().toISOString(),
        accuracy: progress.round2Accuracy,
        rating: rating,
        nextReview: calculateNextReview(rating)
      }

      localStorage.setItem(progressKey, JSON.stringify(allProgress))
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

  const calculateNextReview = (rating: number): string => {
    // Simple spaced repetition calculation
    const days = rating <= 2 ? 1 : rating <= 3 ? 3 : rating <= 4 ? 7 : 21
    const nextDate = new Date()
    nextDate.setDate(nextDate.getDate() + days)
    return nextDate.toISOString()
  }

  const handleSessionComplete = async () => {
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
          round2Accuracy: (value.round2Accuracy || 0) / 100, // Convert percentage to decimal
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

      // Calculate and award XP
      const xp = progressManager.calculateSessionXP(updatedSessionState, session.sessionStats)
      if (user) {
        await trackXP('kanji_mastery', xp, 'Kanji Mastery Session', {
          sessionId: session.sessionId,
          kanjiCount: session.kanji.length,
          accuracy: session.sessionStats.averageAccuracy
        })
      }

      // Update streak for authenticated users
      if (user) {
        await recordActivityAndSync(
          StreakActivity.KANJI_MASTERY_SESSION,
          isPremium,
          Date.now()
        )
      }

      // Check achievements
      if (user) {
        // Track basic progress
        await updateProgress({
          type: 'kanji_mastery',
          kanjiMasterySessions: 1,
          kanjiMastered: session.sessionStats.totalKanji,
          kanjiPerfectSession: session.sessionStats.averageAccuracy === 1,
          kanjiSpeedSession: session.sessionStats.timeSpentSeconds < 600 && session.kanji.length === 5,
          perfectReadings: session.kanji.filter(k => k.rounds.round2Accuracy === 1).length,
          exampleSentencesMastered: session.kanji.length * 2 // Rough estimate
        })
      }

      // Save session to API (respects user tiers)
      if (user) {
        try {
          const response = await fetch('/api/kanji-mastery/session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(session)
          })

          const result = await response.json()
          if (result.success) {
            showToast({
              title: 'Session Complete!',
              description: `+${xp} XP earned! ${result.message}`,
              variant: 'success'
            })
          }
        } catch (error) {
          console.error('Error saving session:', error)
          // Continue even if API fails
        }
      } else {
        showToast({
          title: 'Session Complete!',
          description: 'Sign in to save your progress and earn XP!',
          variant: 'info'
        })
      }

      // Navigate back to main page
      router.push('/tools/kanji-mastery')
    } catch (error) {
      console.error('Error completing session:', error)
      showToast({
        title: 'Error',
        description: 'Failed to save session progress',
        variant: 'error'
      })
      router.push('/tools/kanji-mastery')
    }
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
    return <SessionCompleteModal sessionState={sessionState} onClose={handleSessionComplete} />
  }

  const currentKanji = sessionState.kanji[sessionState.currentIndex]
  const totalKanji = sessionState.kanji.length

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850">
      {/* Progress Header */}
      <div className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-dark-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <Link
              href="/tools/kanji-mastery"
              className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
            >
              ← Exit Session
            </Link>
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
          />
        )}

        {sessionState.currentRound === 2 && (
          <Round2Test
            kanji={currentKanji}
            currentIndex={sessionState.currentIndex}
            totalKanji={totalKanji}
            onComplete={handleRound2Complete}
          />
        )}

        {sessionState.currentRound === 3 && (
          <Round3Evaluate
            kanji={currentKanji}
            currentIndex={sessionState.currentIndex}
            totalKanji={totalKanji}
            progress={sessionState.progress.get(currentKanji.kanji)}
            onComplete={handleRound3Complete}
          />
        )}
      </div>
    </div>
  )
}