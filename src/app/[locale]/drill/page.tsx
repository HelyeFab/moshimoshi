'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { useFeature } from '@/hooks/useFeature'
import { useSubscription } from '@/hooks/useSubscription'
import Navbar from '@/components/layout/Navbar'
import PageHeader from '@/components/ui/PageHeader'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { useToast } from '@/components/ui/Toast'
import CenteredAlert, { useCenteredAlert } from '@/components/ui/CenteredAlert'
import type { DrillSession, DrillQuestion, DrillSettings } from '@/types/drill'
import { DrillProgressManager } from '@/lib/review-engine/progress/DrillProgressManager'
import type {
  DrillSessionData,
  QuestionAnswerResult,
} from '@/lib/review-engine/progress/DrillProgressManager'
import { formatDrillDefinition } from '@/utils/textUtils'
import { ConjugationErrorAnalyzer } from '@/lib/conjugation-help'
import { useConjugationHelp } from '@/contexts/ConjugationHelpContext'
import { HelpModal, HelpBanner } from '@/components/conjugation-help'
import { SRSWordSelector } from '@/lib/drill/srs-word-selector'
import { useFeatureUsage, DesktopCircularIndicator, FeatureUsageIndicator } from '@/components/entitlements/FeatureUsageIndicator'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'

export default function DrillPage() {
  const { t, strings } = useI18n()
  const router = useRouter()
  const { user } = useAuth()
  const { subscription, isPremium } = useSubscription()
  const { checkOnly } = useFeature('conjugation_drill')
  const usageData = useFeatureUsage('conjugation_drill')
  const { showToast } = useToast()
  const { alert, showAlert, closeAlert } = useCenteredAlert()
  const { showMultipleHelps } = useConjugationHelp()
  const drillManager = DrillProgressManager.getInstance()

  // Debug logging
  useEffect(() => {
    console.log('[Drill Page] Subscription:', subscription)
  }, [subscription])

  // Initialize DrillProgressManager
  useEffect(() => {
    if (user?.uid) {
      drillManager.initializeDrillProgress(user.uid)
    }
  }, [user?.uid])

  // Drill state
  const [loading, setLoading] = useState(false)
  const [session, setSession] = useState<DrillSession | null>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [score, setScore] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [drillStats, setDrillStats] = useState<any>(null)
  const [currentErrorReport, setCurrentErrorReport] = useState<any>(null)

  // Settings state with question count slider
  const [settings, setSettings] = useState<DrillSettings>({
    questionsPerSession: 10, // Default 10 questions
    autoAdvance: false,
    showRules: true,
    wordTypeFilter: 'all',
    drillMode: 'random',
    selectedLists: [],
    jlptLevels: ['N5', 'N4'], // Default to N5 + N4
    conjugationForms: [], // Empty = all forms
  })

  // User lists state
  const [userLists, setUserLists] = useState<any[]>([])
  const [loadingLists, setLoadingLists] = useState(false)

  // SRS state
  const [srsWordCounts, setSrsWordCounts] = useState<{
    total: number
    due: number
    learning: number
    new: number
  } | null>(null)
  const [loadingSRSStats, setLoadingSRSStats] = useState(false)

  // Question results tracking for SRS (per-question data)
  const [questionResults, setQuestionResults] = useState<QuestionAnswerResult[]>([])
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now())

  // Helper: Check if a list is potentially drillable
  const isListDrillable = (
    list: any
  ): { drillable: boolean; reason?: string; warning?: string } => {
    if (!list.items || list.items.length === 0) {
      return { drillable: false, reason: 'No items' }
    }

    // Only 'word' and 'verbAdj' types can contain drillable content
    if (list.type !== 'word' && list.type !== 'verbAdj') {
      return { drillable: false, reason: 'Only word/verb lists can be drilled' }
    }

    // Note: We can't determine exact conjugatability client-side without full word type detection
    // The API will filter out non-conjugatable words (nouns, particles, etc.)
    // But we can warn if the list type suggests it might have mixed content
    if (list.type === 'word') {
      return {
        drillable: true,
        warning: 'May contain non-conjugatable words (nouns, etc.)',
      }
    }

    return { drillable: true }
  }

  // Question count limits based on user plan
  const getQuestionLimits = () => {
    if (!user) return { min: 5, max: 10, default: 5 } // Guest

    // Get actual subscription plan
    const plan = subscription?.plan || 'free'
    switch (plan) {
      case 'premium_monthly':
      case 'premium_yearly':
        return { min: 5, max: 50, default: 20 } // Premium
      case 'free':
        return { min: 5, max: 20, default: 10 } // Free
      default:
        return { min: 5, max: 10, default: 5 } // Guest
    }
  }

  const questionLimits = getQuestionLimits()

  // Initialize settings with plan defaults
  useEffect(() => {
    setSettings(prev => ({
      ...prev,
      questionsPerSession: questionLimits.default,
    }))
  }, [user])

  // Load drill stats on mount and after completion
  useEffect(() => {
    const loadStats = async () => {
      if (user?.uid) {
        const isPremium = subscription?.plan?.includes('premium')
        const stats = await drillManager.getDrillStats(user.uid, isPremium || false)
        setDrillStats(stats)
      }
    }
    loadStats()
  }, [user?.uid, subscription, isComplete])

  // Fetch user lists when authenticated (premium users only)
  useEffect(() => {
    const fetchLists = async () => {
      if (!user?.uid) {
        setUserLists([])
        return
      }

      // Only fetch lists for premium users
      const isPremiumUser = subscription?.plan?.includes('premium') || false
      if (!isPremiumUser) {
        setUserLists([])
        setLoadingLists(false)
        return
      }

      setLoadingLists(true)
      try {
        const response = await fetch('/api/lists')
        if (response.ok) {
          const data = await response.json()
          setUserLists(data.lists || [])
        }
      } catch (error) {
        console.error('Failed to fetch user lists:', error)
      } finally {
        setLoadingLists(false)
      }
    }

    fetchLists()
  }, [user?.uid, subscription])

  // Fetch SRS word counts when authenticated
  useEffect(() => {
    const fetchSRSCounts = async () => {
      if (!user?.uid) {
        setSrsWordCounts(null)
        return
      }

      setLoadingSRSStats(true)
      try {
        const isPremium = subscription?.plan?.includes('premium') || false
        const counts = await SRSWordSelector.getWordCounts(user.uid, isPremium)
        setSrsWordCounts(counts)
      } catch (error) {
        console.error('Failed to fetch SRS stats:', error)
      } finally {
        setLoadingSRSStats(false)
      }
    }

    fetchSRSCounts()
  }, [user?.uid, subscription])

  const startDrill = async () => {
    // Validate SRS mode requirements
    if (settings.drillMode === 'srs') {
      if (!srsWordCounts || srsWordCounts.total === 0) {
        showAlert(
          'No SRS words yet! Practice in Random or My Lists mode first to build your review queue.',
          'info',
          '🧠 SRS Mode'
        )
        return
      }

      if (srsWordCounts.due === 0) {
        showAlert(
          'No words due for review yet. Your words are scheduled for later. Try Random mode for now!',
          'info',
          '🧠 SRS Mode'
        )
        return
      }
    }

    // Validate list selection for 'lists' mode
    if (
      settings.drillMode === 'lists' &&
      (!settings.selectedLists || settings.selectedLists.length === 0)
    ) {
      showAlert(
        t('drill.selectListsError') || 'Please select at least one list to practice',
        'error',
        'Select Lists'
      )
      return
    }

    // Additional validation: Check if selected lists are drillable
    if (
      settings.drillMode === 'lists' &&
      settings.selectedLists &&
      settings.selectedLists.length > 0
    ) {
      const selectedListsData = userLists.filter(list => settings.selectedLists?.includes(list.id))
      const nonDrillableLists = selectedListsData.filter(list => !isListDrillable(list).drillable)

      if (nonDrillableLists.length > 0) {
        const listNames = nonDrillableLists.map(l => l.name).join(', ')
        showAlert(
          `Cannot drill these lists: ${listNames}. Only word and verb/adjective lists can be drilled.`,
          'error',
          'Invalid Lists'
        )
        return
      }

      // Check if all selected lists are empty
      const hasItems = selectedListsData.some(list => list.items && list.items.length > 0)
      if (!hasItems) {
        showAlert('Selected lists have no items to drill', 'error', 'Empty Lists')
        return
      }
    }

    // Check entitlement
    const decision = await checkOnly({ failOpen: false })
    if (!decision.allow) {
      showAlert(t('entitlements.messages.limitReached'), 'error', 'Limit reached')
      return
    }

    setLoading(true)
    try {
      // Create session via API
      const response = await fetch('/api/drill/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: settings.drillMode,
          wordTypeFilter: settings.wordTypeFilter,
          selectedLists: settings.selectedLists,
          questionsCount: settings.questionsPerSession,
          jlptLevels: settings.jlptLevels,
          conjugationForms:
            (settings.conjugationForms?.length ?? 0) > 0 ? settings.conjugationForms : undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Enhanced error messages based on API response
        if (data.error?.code === 'NO_QUESTIONS') {
          showAlert(
            'Could not generate questions. The selected lists may not contain conjugatable words (verbs or adjectives).',
            'error',
            'No Questions Available'
          )
        } else {
          showAlert(
            data.error?.message || t('drill.startError') || 'Failed to start drill',
            'error',
            'Drill Error'
          )
        }
        return
      }

      const sessionData = data.data?.session || data.session
      setSession(sessionData)
      setCurrentQuestionIndex(0)
      setScore(0)
      setIsComplete(false)
      // Reset SRS tracking for new session
      setQuestionResults([])
      setQuestionStartTime(Date.now())
      await checkOnly({ failOpen: false })
    } catch (error) {
      console.error('Error starting drill:', error)
      showAlert(
        t('drill.startError') || 'Failed to start drill session',
        'error',
        'Connection Error'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleAnswer = (answer: string) => {
    if (!session || showResult) return

    setSelectedAnswer(answer)
    setShowResult(true)

    const currentQuestion = session.questions[currentQuestionIndex]
    const isCorrect = answer === currentQuestion.correctAnswer

    // Record answer for SRS tracking
    const responseTime = Date.now() - questionStartTime
    const wordId = `${currentQuestion.word.kanji || currentQuestion.word.kana}:${currentQuestion.word.kana}`

    setQuestionResults(prev => [
      ...prev,
      {
        questionId: currentQuestion.id,
        wordId: wordId,
        targetForm: currentQuestion.targetForm,
        correct: isCorrect,
        userAnswer: answer,
        correctAnswer: currentQuestion.correctAnswer,
        responseTime: responseTime,
      },
    ])

    let hasRelevantHelp = false

    if (isCorrect) {
      setScore(score + 1)
      setCurrentErrorReport(null) // Clear any previous error report
    } else {
      // Smart mode: Analyze the error and store it
      try {
        const errorReport = ConjugationErrorAnalyzer.analyzeError(
          answer,
          currentQuestion.correctAnswer,
          currentQuestion.targetForm as any,
          currentQuestion.word
        )

        // Check if we have relevant help to show
        const report = errorReport as { relevantHelp?: any[] }
        hasRelevantHelp = !!(report.relevantHelp && report.relevantHelp.length > 0)

        // Store error report to show help banner (don't auto-open modal!)
        setCurrentErrorReport(errorReport)
      } catch (error) {
        console.error('Error analyzing conjugation mistake:', error)
        setCurrentErrorReport(null)
        // Don't break the drill flow if error analysis fails
      }
    }

    // Auto-advance after delay if enabled
    // BUT: Don't auto-advance if there's an error with relevant help (let user read it!)
    if (settings.autoAdvance && !hasRelevantHelp) {
      // Only auto-advance for correct answers or errors without help
      setTimeout(() => nextQuestion(), 1500)
    }
    // If there's help to show, user must manually click "Next" to proceed
  }

  const handleDrillComplete = async () => {
    if (!session || !user) return

    const isPremium =
      subscription?.plan === 'premium_monthly' || subscription?.plan === 'premium_yearly'
    const accuracy = (score / session.questions.length) * 100

    try {
      // 1. Extract practiced words from session
      const verbsPracticed: string[] = []
      const adjectivesPracticed: string[] = []
      const conjugationTypes: string[] = []

      session.questions.forEach(question => {
        // Extract word type and conjugation
        const wordType = question.word.type as string
        if (wordType === 'verb') {
          verbsPracticed.push(question.word.kanji || question.word.kana)
        } else if (wordType === 'adjective') {
          adjectivesPracticed.push(question.word.kanji || question.word.kana)
        }
        conjugationTypes.push(question.targetForm)
      })

      // 2. Create session data object
      const sessionData: DrillSessionData = {
        sessionId: session.id,
        userId: user.uid,
        startedAt: new Date(session.startedAt),
        completedAt: new Date(),
        questions: session.questions.length,
        correctAnswers: score,
        accuracy: accuracy,
        mode: session.mode || 'random',
        wordTypeFilter: session.wordTypeFilter || 'all',
        verbsPracticed: [...new Set(verbsPracticed)], // Remove duplicates
        adjectivesPracticed: [...new Set(adjectivesPracticed)],
        conjugationTypes: [...new Set(conjugationTypes)],
        questionResults: questionResults, // NEW: For SRS tracking
      }

      // DEBUG: Log question results to verify SRS tracking data
      console.log('[Drill Complete] Question results for SRS:', {
        count: questionResults.length,
        sample: questionResults[0],
        allResults: questionResults,
      })

      // 3. Track drill session using DrillProgressManager
      // This automatically handles:
      // - Calling /api/drill/session with action='complete'
      // - Updating Firebase drill_sessions collection
      // - Recording gamification (XP + streak) via coordinator
      // - IndexedDB storage for all users
      // - Firebase sync for premium users
      await drillManager.trackDrillSession(sessionData, user, isPremium)

      // 4. Show success message with stats
      const stats = await drillManager.getDrillStats(user.uid, isPremium)
      showToast(
        `${t('drill.complete')} - ${t('common.accuracy')}: ${accuracy.toFixed(1)}% | Total Drills: ${stats?.totalDrills || 1}`,
        'success'
      )
    } catch (error) {
      console.error('Error tracking drill completion:', error)
      // Still show basic completion even if tracking fails
      showToast(t('drill.complete'), 'success')
    }
  }

  const nextQuestion = async () => {
    if (!session) return

    if (currentQuestionIndex < session.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
      setSelectedAnswer(null)
      setShowResult(false)
      setCurrentErrorReport(null) // Clear error report for next question
      setQuestionStartTime(Date.now()) // Reset timer for next question
    } else {
      // Complete the drill and track progress
      setIsComplete(true)
      await handleDrillComplete()
    }
  }

  const resetDrill = () => {
    setSession(null)
    setCurrentQuestionIndex(0)
    setSelectedAnswer(null)
    setShowResult(false)
    setScore(0)
    setIsComplete(false)
  }

  // Helper function to check if two arrays contain the same elements
  const arraysEqual = (a: string[] | undefined, b: string[]) => {
    if (!a || a.length !== b.length) return false
    return a.every(item => b.includes(item)) && b.every(item => a.includes(item))
  }

  const currentQuestion = session?.questions[currentQuestionIndex]

  if (loading) {
    return <LoadingOverlay message={t('drill.loading')} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light to-background-DEFAULT dark:from-dark-850 dark:to-dark-900">
      {/* Desktop Navbar */}
      <div className="hidden sm:block">
        <Navbar user={user} showUserMenu={true} />
      </div>

      {/* Page Header - Mobile */}
      <PageHeader
        title={strings.drill?.title || 'Conjugation Drill'}
        description={strings.drill?.description || 'Practice verb and adjective conjugations'}
        showDoshi
        doshiMood="studying"
        actions={
          usageData.hasData ? (
            <DesktopCircularIndicator
              remaining={usageData.remaining}
              limitCount={usageData.limitCount}
              usedCount={usageData.usedCount}
              color={usageData.color}
            />
          ) : null
        }
      />

      <FeatureUsageIndicator featureId="conjugation_drill" />

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {!session ? (
            // Setup screen
            <div className="bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-xl shadow-lg p-4 sm:p-6 md:p-8">
              <h2 className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6">
                {t('drill.settings')}
              </h2>

              {/* Drill Stats Display */}
              {drillStats && drillStats.totalDrills > 0 && (
                <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                  <h3 className="font-semibold mb-2 text-sm sm:text-base">
                    {t('drill.yourProgress') || 'Your Progress'}
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">
                        {t('drill.totalDrills') || 'Total Drills'}
                      </span>
                      <span className="font-bold text-lg">{drillStats.totalDrills}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">
                        {t('drill.accuracy') || 'Accuracy'}
                      </span>
                      <span className="font-bold text-lg">
                        {drillStats.averageAccuracy?.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">
                        {t('drill.perfectDrills') || 'Perfect'}
                      </span>
                      <span className="font-bold text-lg">{drillStats.perfectDrills}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">
                        {t('drill.wordsStudied') || 'Words'}
                      </span>
                      <span className="font-bold text-lg">
                        {(drillStats.verbsStudied?.size || 0) +
                          (drillStats.adjectivesStudied?.size || 0)}
                      </span>
                    </div>
                  </div>
                  {drillStats.status && (
                    <div className="mt-2 text-xs text-primary-600 dark:text-primary-400">
                      Status: {drillStats.status}
                    </div>
                  )}
                </div>
              )}

              {/* Question Count Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-foreground dark:text-dark-foreground mb-2">
                  {t('drill.questionsPerSession')}
                </label>

                {/* Quick select buttons */}
                <div className={`grid grid-cols-3 gap-2 mb-3 ${
                  (() => {
                    const presets = [5, 10, 15, 20, questionLimits.max];
                    const uniquePresets = [...new Set(presets.filter(p => p >= questionLimits.min && p <= questionLimits.max))].sort((a, b) => a - b);
                    return uniquePresets.length === 4 ? 'sm:grid-cols-4' :
                           uniquePresets.length === 3 ? 'sm:grid-cols-3' :
                           uniquePresets.length === 2 ? 'sm:grid-cols-2' :
                           'sm:grid-cols-1';
                  })()
                }`}>
                  {(() => {
                    const presets = [5, 10, 15, 20, questionLimits.max];
                    const uniquePresets = [...new Set(presets.filter(p => p >= questionLimits.min && p <= questionLimits.max))].sort((a, b) => a - b);
                    return uniquePresets.map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setSettings(prev => ({
                          ...prev,
                          questionsPerSession: preset
                        }))}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          settings.questionsPerSession === preset
                            ? 'bg-primary-500 text-white'
                            : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                        }`}
                      >
                        {preset}
                      </button>
                    ));
                  })()}
                </div>

                {/* Stepper controls */}
                <div className="flex items-center justify-center gap-4 p-3 bg-gray-100 dark:bg-dark-800 rounded-lg">
                  <button
                    onClick={() => setSettings(prev => ({
                      ...prev,
                      questionsPerSession: Math.max(questionLimits.min, prev.questionsPerSession - 1)
                    }))}
                    className="w-10 h-10 flex items-center justify-center rounded-lg bg-white dark:bg-dark-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-dark-600 transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={settings.questionsPerSession <= questionLimits.min}
                  >
                    <span className="text-xl font-semibold text-gray-700 dark:text-gray-300">−</span>
                  </button>

                  <div className="flex flex-col items-center gap-1">
                    <input
                      type="number"
                      min={questionLimits.min}
                      max={questionLimits.max}
                      value={settings.questionsPerSession}
                      onChange={(e) => {
                        const value = Math.max(questionLimits.min, Math.min(questionLimits.max, Number(e.target.value)));
                        setSettings(prev => ({
                          ...prev,
                          questionsPerSession: value
                        }));
                      }}
                      className="w-16 px-2 py-2 text-center text-lg font-semibold border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      of {questionLimits.max}
                    </span>
                  </div>

                  <button
                    onClick={() => setSettings(prev => ({
                      ...prev,
                      questionsPerSession: Math.min(questionLimits.max, prev.questionsPerSession + 1)
                    }))}
                    className="w-10 h-10 flex items-center justify-center rounded-lg bg-white dark:bg-dark-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-dark-600 transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={settings.questionsPerSession >= questionLimits.max}
                  >
                    <span className="text-xl font-semibold text-gray-700 dark:text-gray-300">+</span>
                  </button>
                </div>

                {subscription?.plan === 'free' && (
                  <p className="text-xs text-muted-foreground mt-2">{t('drill.upgradeForMore')}</p>
                )}
              </div>

              {/* Word Type Filter */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-foreground dark:text-dark-foreground mb-2">
                  {t('drill.wordTypeFilter')}
                </label>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  <button
                    onClick={() => setSettings(prev => ({ ...prev, wordTypeFilter: 'all' }))}
                    className={`px-1.5 sm:px-4 py-2 rounded-lg border transition-colors text-xs sm:text-base font-medium ${
                      settings.wordTypeFilter === 'all'
                        ? 'border-primary-500 bg-primary-500 text-white'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-dark-700'
                    }`}
                  >
                    {t('drill.allTypes')}
                  </button>
                  <button
                    onClick={() => setSettings(prev => ({ ...prev, wordTypeFilter: 'verbs' }))}
                    className={`px-1.5 sm:px-4 py-2 rounded-lg border transition-colors text-xs sm:text-base font-medium ${
                      settings.wordTypeFilter === 'verbs'
                        ? 'border-primary-500 bg-primary-500 text-white'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-dark-700'
                    }`}
                  >
                    {t('drill.verbs')}
                  </button>
                  <button
                    onClick={() => setSettings(prev => ({ ...prev, wordTypeFilter: 'adjectives' }))}
                    className={`px-1.5 sm:px-4 py-2 rounded-lg border transition-colors text-xs sm:text-base font-medium ${
                      settings.wordTypeFilter === 'adjectives'
                        ? 'border-primary-500 bg-primary-500 text-white'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-dark-700'
                    }`}
                  >
                    {t('drill.adjectives')}
                  </button>
                </div>
              </div>

              {/* JLPT Level Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-foreground dark:text-dark-foreground mb-2">
                  JLPT Levels{' '}
                  <span className="text-xs text-muted-foreground">(Select one or more)</span>
                </label>
                <div className="flex gap-1.5 sm:gap-2 flex-wrap">
                  {(['N5', 'N4', 'N3', 'N2', 'N1'] as const).map(level => (
                    <button
                      key={level}
                      onClick={() => {
                        setSettings(prev => {
                          const current = prev.jlptLevels || []
                          const isSelected = current.includes(level)
                          if (isSelected) {
                            // Deselect - but keep at least one selected
                            const newLevels = current.filter(l => l !== level)
                            return {
                              ...prev,
                              jlptLevels: newLevels.length > 0 ? newLevels : [level],
                            }
                          } else {
                            // Select
                            return { ...prev, jlptLevels: [...current, level] }
                          }
                        })
                      }}
                      className={`px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-lg border transition-colors font-medium ${
                        settings.jlptLevels?.includes(level)
                          ? 'border-primary-500 bg-primary-500 text-white'
                          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-dark-700'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conjugation Forms Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-foreground dark:text-dark-foreground mb-2">
                  Conjugation Forms{' '}
                  <span className="text-xs text-muted-foreground">(Leave empty for all forms)</span>
                </label>
                <div className="space-y-2">
                  {/* Quick presets */}
                  <div className="flex gap-1.5 sm:gap-2 flex-wrap">
                    <button
                      onClick={() => setSettings(prev => ({ ...prev, conjugationForms: [] }))}
                      className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border text-xs sm:text-sm transition-colors font-medium ${
                        settings.conjugationForms?.length === 0
                          ? 'border-primary-500 bg-primary-500 text-white'
                          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-dark-700'
                      }`}
                    >
                      All Forms
                    </button>
                    <button
                      onClick={() =>
                        setSettings(prev => ({
                          ...prev,
                          conjugationForms: ['present', 'past', 'negative', 'pastNegative'],
                        }))
                      }
                      className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border text-xs sm:text-sm transition-colors ${
                        arraysEqual(settings.conjugationForms, [
                          'present',
                          'past',
                          'negative',
                          'pastNegative',
                        ])
                          ? 'border-primary-500 bg-primary-500 text-white'
                          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-dark-700'
                      }`}
                    >
                      Basic Only
                    </button>
                    <button
                      onClick={() =>
                        setSettings(prev => ({
                          ...prev,
                          conjugationForms: [
                            'polite',
                            'politePast',
                            'politeNegative',
                            'politePastNegative',
                          ],
                        }))
                      }
                      className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border text-xs sm:text-sm transition-colors ${
                        arraysEqual(settings.conjugationForms, [
                          'polite',
                          'politePast',
                          'politeNegative',
                          'politePastNegative',
                        ])
                          ? 'border-primary-500 bg-primary-500 text-white'
                          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-dark-700'
                      }`}
                    >
                      Polite Only
                    </button>
                    <button
                      onClick={() =>
                        setSettings(prev => ({
                          ...prev,
                          conjugationForms: ['teForm', 'negativeTeForm', 'naiDeForm'],
                        }))
                      }
                      className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border text-xs sm:text-sm transition-colors ${
                        arraysEqual(settings.conjugationForms, [
                          'teForm',
                          'negativeTeForm',
                          'naiDeForm',
                        ])
                          ? 'border-primary-500 bg-primary-500 text-white'
                          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-dark-700'
                      }`}
                    >
                      Te-Forms
                    </button>
                    <button
                      onClick={() =>
                        setSettings(prev => ({
                          ...prev,
                          conjugationForms: [
                            'potential',
                            'potentialNegative',
                            'potentialPast',
                            'potentialPastNegative',
                          ],
                        }))
                      }
                      className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border text-xs sm:text-sm transition-colors ${
                        arraysEqual(settings.conjugationForms, [
                          'potential',
                          'potentialNegative',
                          'potentialPast',
                          'potentialPastNegative',
                        ])
                          ? 'border-primary-500 bg-primary-500 text-white'
                          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-dark-700'
                      }`}
                    >
                      Potential
                    </button>
                    <button
                      onClick={() =>
                        setSettings(prev => ({
                          ...prev,
                          conjugationForms: [
                            'passive',
                            'passiveNegative',
                            'passivePast',
                            'passivePastNegative',
                          ],
                        }))
                      }
                      className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border text-xs sm:text-sm transition-colors ${
                        arraysEqual(settings.conjugationForms, [
                          'passive',
                          'passiveNegative',
                          'passivePast',
                          'passivePastNegative',
                        ])
                          ? 'border-primary-500 bg-primary-500 text-white'
                          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-dark-700'
                      }`}
                    >
                      Passive
                    </button>
                    <button
                      onClick={() =>
                        setSettings(prev => ({
                          ...prev,
                          conjugationForms: [
                            'causative',
                            'causativeNegative',
                            'causativePast',
                            'causativePastNegative',
                          ],
                        }))
                      }
                      className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border text-xs sm:text-sm transition-colors ${
                        arraysEqual(settings.conjugationForms, [
                          'causative',
                          'causativeNegative',
                          'causativePast',
                          'causativePastNegative',
                        ])
                          ? 'border-primary-500 bg-primary-500 text-white'
                          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-dark-700'
                      }`}
                    >
                      Causative
                    </button>
                  </div>
                  {settings.conjugationForms && settings.conjugationForms.length > 0 && (
                    <div className="text-xs text-primary-600 dark:text-primary-400">
                      Selected: {settings.conjugationForms.length} form
                      {settings.conjugationForms.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>

              {/* Practice Mode */}
              <div className="mb-4 sm:mb-6">
                <label className="block text-sm font-medium text-foreground dark:text-dark-foreground mb-2">
                  {t('drill.practiceMode')}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-2">
                  <button
                    onClick={() => setSettings(prev => ({ ...prev, drillMode: 'random' }))}
                    className={`px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-lg border transition-colors font-medium ${
                      settings.drillMode === 'random'
                        ? 'border-primary-500 bg-primary-500 text-white'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-dark-700'
                    }`}
                  >
                    {t('drill.randomWords')}
                  </button>
                  <button
                    onClick={() => {
                      if (!isPremium) {
                        showToast(
                          t('entitlements.messages.upgradeRequired') || 'Upgrade to Premium to use custom lists',
                          'info',
                          5000,
                          {
                            label: t('subscription.actions.viewPlans') || 'View Plans',
                            onClick: () => router.push('/pricing')
                          }
                        )
                        return
                      }
                      setSettings(prev => ({ ...prev, drillMode: 'lists' }))
                    }}
                    className={`px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-lg border transition-colors font-medium ${
                      settings.drillMode === 'lists'
                        ? 'border-primary-500 bg-primary-500 text-white'
                        : isPremium
                          ? 'border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-dark-700'
                          : 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-dark-900 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                    }`}
                  >
                    {t('drill.myLists')}
                  </button>
                  <button
                    onClick={() => {
                      if (!isPremium) {
                        showToast(
                          t('entitlements.messages.upgradeRequired') || 'Upgrade to Premium to use SRS mode',
                          'info',
                          5000,
                          {
                            label: t('subscription.actions.viewPlans') || 'View Plans',
                            onClick: () => router.push('/pricing')
                          }
                        )
                        return
                      }
                      setSettings(prev => ({ ...prev, drillMode: 'srs' }))
                    }}
                    className={`px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-lg border transition-colors font-medium relative ${
                      settings.drillMode === 'srs'
                        ? 'border-purple-500 bg-purple-500 text-white'
                        : isPremium
                          ? 'border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-dark-700'
                          : 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-dark-900 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-1">
                      🧠 SRS
                      {srsWordCounts && srsWordCounts.due > 0 && (
                        <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
                          settings.drillMode === 'srs'
                            ? 'bg-white text-purple-500'
                            : 'bg-purple-500 text-white'
                        }`}>
                          {srsWordCounts.due}
                        </span>
                      )}
                    </span>
                  </button>
                </div>

                {/* List Selector - shown when 'lists' mode is selected */}
                {settings.drillMode === 'lists' && user && (
                  <div className="mt-4 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
                    <label className="block text-sm font-medium text-foreground dark:text-dark-foreground mb-2">
                      {t('drill.selectLists') || 'Select Lists to Practice'}
                    </label>

                    {loadingLists ? (
                      <div className="text-sm text-muted-foreground">
                        {t('common.loading') || 'Loading lists...'}
                      </div>
                    ) : userLists.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        {t('drill.noLists') ||
                          'You have no lists yet. Create one from the vocabulary page!'}
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-hide">
                        {userLists.map(list => {
                          const isSelected = settings.selectedLists?.includes(list.id)
                          const itemCount = list.items?.length || 0
                          const drillableCheck = isListDrillable(list)
                          const isDrillable = drillableCheck.drillable

                          return (
                            <label
                              key={list.id}
                              className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                                isDrillable
                                  ? 'hover:bg-primary-100 dark:hover:bg-primary-900/30 cursor-pointer'
                                  : 'opacity-60 cursor-not-allowed bg-gray-50 dark:bg-gray-900/20'
                              }`}
                              title={!isDrillable ? drillableCheck.reason : drillableCheck.warning}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={!isDrillable}
                                onChange={e => {
                                  if (!isDrillable) return
                                  setSettings(prev => {
                                    const currentLists = prev.selectedLists || []
                                    if (e.target.checked) {
                                      return { ...prev, selectedLists: [...currentLists, list.id] }
                                    } else {
                                      return {
                                        ...prev,
                                        selectedLists: currentLists.filter(id => id !== list.id),
                                      }
                                    }
                                  })
                                }}
                                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-base">{list.emoji}</span>
                                  <span className="font-medium text-sm truncate">{list.name}</span>
                                  {!isDrillable ? (
                                    <span className="ml-auto px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full whitespace-nowrap">
                                      ✖ {drillableCheck.reason}
                                    </span>
                                  ) : drillableCheck.warning ? (
                                    <span className="ml-auto px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full whitespace-nowrap flex items-center gap-1">
                                      <span className="text-xs">ℹ️</span>
                                      <span className="hidden sm:inline">Mixed content</span>
                                    </span>
                                  ) : null}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {itemCount} {itemCount === 1 ? 'item' : 'items'}
                                  {isDrillable && list.type && (
                                    <span className="ml-2 text-primary-600 dark:text-primary-400">
                                      •{' '}
                                      {list.type === 'verbAdj'
                                        ? 'Verbs/Adj'
                                        : list.type === 'word'
                                          ? 'Words'
                                          : list.type}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    )}

                    {settings.selectedLists && settings.selectedLists.length > 0 && (
                      <div className="mt-3 text-xs text-primary-600 dark:text-primary-400 font-medium">
                        ✓ {settings.selectedLists.length}{' '}
                        {settings.selectedLists.length === 1 ? 'list' : 'lists'} selected
                      </div>
                    )}
                  </div>
                )}

                {/* SRS Info Panel - shown when 'srs' mode is selected */}
                {settings.drillMode === 'srs' && user && (
                  <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">🧠</span>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-100">
                          Spaced Repetition System (SRS)
                        </h3>
                        <p className="text-xs text-purple-700 dark:text-purple-300 mt-0.5">
                          Smart learning algorithm that shows words when you need to review them
                        </p>
                      </div>
                    </div>

                    {loadingSRSStats ? (
                      <div className="text-sm text-purple-600 dark:text-purple-400">
                        Loading SRS data...
                      </div>
                    ) : srsWordCounts && srsWordCounts.total > 0 ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-white dark:bg-gray-800 p-2 rounded-lg">
                            <div className="text-xs text-muted-foreground">Due Today</div>
                            <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                              {srsWordCounts.due}
                            </div>
                          </div>
                          <div className="bg-white dark:bg-gray-800 p-2 rounded-lg">
                            <div className="text-xs text-muted-foreground">Total Studied</div>
                            <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                              {srsWordCounts.total}
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                          💡 SRS shows words from ANY drill mode you've practiced before
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-sm text-purple-700 dark:text-purple-300">
                          <strong>No SRS data yet!</strong>
                        </div>
                        <div className="text-xs text-purple-600 dark:text-purple-400 space-y-1">
                          <p>• Practice in Random or My Lists mode first</p>
                          <p>• Words you study will automatically appear here</p>
                          <p>• Come back when you have words to review</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Auto-advance toggle */}
              <div className="mb-6 sm:mb-8">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.autoAdvance}
                    onChange={e =>
                      setSettings(prev => ({ ...prev, autoAdvance: e.target.checked }))
                    }
                    className="mr-2 w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-foreground dark:text-dark-foreground">
                    {t('drill.autoAdvance')}
                  </span>
                </label>
              </div>

              {/* Start Button - More prominent with spacing */}
              <button
                onClick={startDrill}
                className="w-full py-3 px-6 bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white rounded-lg font-medium transition-colors shadow-sm hover:shadow-md"
              >
                {t('drill.startDrill')}
              </button>
            </div>
          ) : isComplete ? (
            // Results screen - Styled like SessionSummary for perfect mobile centering
            <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 fixed inset-0 z-50">
              <div className="bg-soft-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
                <h2 className="text-3xl font-bold mb-4">{t('drill.complete')}</h2>
                <div className="text-6xl mb-4">
                  {score >= session.questions.length * 0.8
                    ? '🏆'
                    : score >= session.questions.length * 0.6
                      ? '✨'
                      : '💪'}
                </div>
                <p className="text-2xl mb-2">
                  {score} / {session.questions.length}
                </p>
                <p className="text-muted-foreground dark:text-dark-muted mb-6">
                  {Math.round((score / session.questions.length) * 100)}% {t('drill.accuracy')}
                </p>
                <div className="flex gap-4 justify-center flex-wrap">
                  <button
                    onClick={resetDrill}
                    className="flex-1 min-w-[120px] px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors"
                  >
                    {t('drill.newDrill')}
                  </button>
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="flex-1 min-w-[120px] px-6 py-3 bg-gray-200 dark:bg-gray-700 text-foreground dark:text-dark-foreground rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    {t('drill.backToDashboard')}
                  </button>
                </div>
              </div>
            </div>
          ) : currentQuestion ? (
            // Question screen
            <div className="bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-xl shadow-lg p-4 sm:p-6 md:p-8">
              {/* Progress bar */}
              <div className="mb-4 sm:mb-6">
                <div className="flex justify-between text-xs sm:text-sm text-muted-foreground dark:text-dark-muted mb-2">
                  <span>
                    {t('drill.question')} {currentQuestionIndex + 1} / {session.questions.length}
                  </span>
                  <span>
                    {t('drill.score')}: {score}
                  </span>
                </div>
                <div className="w-full bg-primary-100 dark:bg-dark-700 rounded-full h-2">
                  <div
                    className="bg-primary-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${((currentQuestionIndex + 1) / session.questions.length) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Question */}
              <div className="mb-6 sm:mb-8">
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-3 sm:mb-4">
                  {t('drill.conjugateTo')}:{' '}
                  <span className="text-primary-600 block sm:inline mt-1 sm:mt-0">
                    {currentQuestion.rule}
                  </span>
                </h2>
                <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-4 mb-2">
                  <span className="text-2xl sm:text-3xl font-medium">
                    {currentQuestion.word.kanji}
                  </span>
                  <span className="text-lg sm:text-xl text-muted-foreground dark:text-dark-muted">
                    {currentQuestion.word.kana}
                  </span>
                </div>
                <p
                  className="text-sm sm:text-base text-muted-foreground dark:text-dark-muted"
                  title={currentQuestion.word.meaning}
                >
                  {formatDrillDefinition(currentQuestion.word.meaning, 80)}
                </p>
              </div>

              {/* Answer options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-4 sm:mb-6">
                {currentQuestion.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleAnswer(option)}
                    disabled={showResult}
                    className={`p-3 sm:p-4 text-base sm:text-lg rounded-lg border-2 transition-all min-h-[60px] sm:min-h-[auto] ${
                      showResult && option === currentQuestion.correctAnswer
                        ? 'bg-green-500 text-white border-green-600 dark:bg-green-600 dark:border-green-700'
                        : showResult &&
                            option === selectedAnswer &&
                            option !== currentQuestion.correctAnswer
                          ? 'bg-red-500 text-white border-red-600 dark:bg-red-600 dark:border-red-700'
                          : option === selectedAnswer
                            ? 'bg-primary-100 border-primary-500 dark:bg-primary-900/30 dark:border-primary-400'
                            : 'bg-white/50 dark:bg-dark-700 border-primary-200 dark:border-dark-600 hover:bg-primary-50 dark:hover:bg-dark-600 hover:border-primary-300'
                    } ${!showResult && !selectedAnswer ? 'hover:border-primary-400 active:scale-[0.98]' : ''}`}
                  >
                    {option}
                  </button>
                ))}
              </div>

              {/* Help banner - shows contextual help when user makes a mistake */}
              {showResult && currentErrorReport && (
                <HelpBanner
                  errorReport={currentErrorReport}
                  onDismiss={() => {
                    setCurrentErrorReport(null)
                    // If auto-advance is enabled, proceed to next question after dismissing help
                    if (settings.autoAdvance) {
                      setTimeout(() => nextQuestion(), 500) // Short delay after dismissal
                    }
                  }}
                />
              )}

              {/* Next button */}
              {showResult && !settings.autoAdvance && (
                <button
                  onClick={nextQuestion}
                  className="w-full py-3 px-6 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors"
                >
                  {currentQuestionIndex < session.questions.length - 1
                    ? t('drill.nextQuestion')
                    : t('drill.showResults')}
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Smart help modal */}
      <HelpModal />

      {/* Centered error alert */}
      <CenteredAlert
        type={alert.type}
        title={alert.title}
        message={alert.message}
        isOpen={alert.isOpen}
        onClose={closeAlert}
        showIcon={true}
        action={alert.action}
      />

      <MobileNavSpacer />
    </div>
  )
}
