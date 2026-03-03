'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { useFeature } from '@/hooks/useFeature'
import { useSubscription } from '@/hooks/useSubscription'
import Navbar from '@/components/layout/Navbar'
import PageHeader from '@/components/ui/PageHeader'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { useToast } from '@/components/ui/Toast'
import CenteredAlert, { useCenteredAlert } from '@/components/ui/CenteredAlert'
import type { DrillSession, DrillQuestion, DrillSettings, FocusWordSelection } from '@/types/drill'
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
import Modal from '@/components/ui/Modal'
import { ExtendedConjugationEngine } from '@/lib/conjugation/engine'
import { getConjugationUsageNote } from '@/lib/conjugation/usage/getConjugationUsageNote'
import { enhanceWordWithType } from '@/utils/enhancedWordTypeDetection'
import { getConjugatableWordsPractice } from '@/utils/jmdictLocalSearch'
import { searchTatoebaExamples, type ExampleSentence } from '@/utils/tatoebaSearch'
import { useTTS } from '@/hooks/useTTS'
import { Volume2, Loader2 } from 'lucide-react'
import DrillSettingsDrawer, { DrillSettingsSummary } from '@/components/drill/DrillSettingsDrawer'
import { useFeatureUsage, DesktopCircularIndicator, FeatureUsageIndicator } from '@/components/entitlements/FeatureUsageIndicator'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'
import type { FeatureId } from '@/types/FeatureId'

export default function DrillPage() {
  const { t, strings } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { subscription, isPremium } = useSubscription()
  const { checkOnly: checkConjugationDrillOnly } = useFeature('conjugation_drill')
  const { checkOnly: checkFocusModeOnly } = useFeature('drill_focus_mode')
  const drillUsageData = useFeatureUsage('conjugation_drill')
  const focusUsageData = useFeatureUsage('drill_focus_mode')
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

  useEffect(() => {
    setIsHydrated(true)
  }, [])

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
  const [isHydrated, setIsHydrated] = useState(false)
  const [lastCompletionDebug, setLastCompletionDebug] = useState<any>(null)
  const [showRulesModal, setShowRulesModal] = useState(false)
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false)
  const [ruleExamples, setRuleExamples] = useState<{
    wordExamples: Array<{ word: string; kana: string; meaning: string; conjugated: string }>
    sentences: ExampleSentence[]
    loading: boolean
  }>({ wordExamples: [], sentences: [], loading: false })

  const debugEnabled = searchParams?.get('debug') === '1'

  // TTS for example sentences and drill options
  const {
    play: playTTS,
    preload: preloadTTS,
    loading: ttsLoading,
    currentText: ttsCurrentText,
    playing: ttsPlaying,
  } = useTTS({ cacheFirst: true })

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

  // Focus word state
  const [focusWordInput, setFocusWordInput] = useState('')
  const [focusWordResults, setFocusWordResults] = useState<FocusWordSelection[]>([])
  const [focusWordLoading, setFocusWordLoading] = useState(false)
  const [selectedFocusWord, setSelectedFocusWord] = useState<FocusWordSelection | null>(null)
  const [showFocusResults, setShowFocusResults] = useState(false)

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

  // Focus word search
  const searchFocusWord = useCallback(async (term: string) => {
    if (term.trim().length === 0) {
      setFocusWordResults([])
      setShowFocusResults(false)
      return
    }

    setFocusWordLoading(true)
    setShowFocusResults(true)
    try {
      const { searchJMdictWords } = await import('@/utils/jmdictLocalSearch')
      const { detectWordType } = await import('@/lib/conjugation/wordTypeDetector')
      const results = await searchJMdictWords(term.trim(), 8)
      const conjugatable: FocusWordSelection[] = results.flatMap((w) => {
        const detected = detectWordType(w.kanji || w.kana, w.kana, w.partsOfSpeech)
        if (!detected.isConjugatable || !detected.conjugationType) return []

        return [{
          id: w.id,
          kanji: w.kanji,
          kana: w.kana,
          meaning: w.meaning,
          type: detected.conjugationType,
          jlpt: w.jlpt as FocusWordSelection['jlpt'],
          partsOfSpeech: w.partsOfSpeech,
        }]
      })
      setFocusWordResults(conjugatable)
    } catch (error) {
      console.error('Focus word search failed:', error)
      setFocusWordResults([])
    } finally {
      setFocusWordLoading(false)
    }
  }, [])

  // Debounce focus word search
  useEffect(() => {
    if (settings.drillMode !== 'focus') return
    const timer = setTimeout(() => {
      searchFocusWord(focusWordInput)
    }, 300)
    return () => clearTimeout(timer)
  }, [focusWordInput, settings.drillMode, searchFocusWord])

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
  const activeEntitlementFeatureId: FeatureId =
    settings.drillMode === 'focus' ? 'drill_focus_mode' : 'conjugation_drill'
  const activeUsageData = settings.drillMode === 'focus' ? focusUsageData : drillUsageData

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

    // Validate focus mode requirements
    if (settings.drillMode === 'focus') {
      if (!selectedFocusWord && focusWordInput.trim().length === 0) {
        showAlert(
          t('drill.focusEnterWord') || 'Please enter a word to practice',
          'error',
          t('drill.focusMode') || 'Focus Word'
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
    const decision = await (
      settings.drillMode === 'focus' ? checkFocusModeOnly : checkConjugationDrillOnly
    )({ failOpen: false })
    if (!decision.allow) {
      const action = !isPremium
        ? {
            label: t('subscription.actions.upgrade'),
            onClick: () => router.push('/pricing')
          }
        : undefined
      const message = decision.reason === 'no_permission'
        ? (t('entitlements.messages.upgradeRequired') || 'Upgrade required')
        : (t('entitlements.messages.limitReached') || 'Limit reached')
      showToast(message, decision.reason === 'no_permission' ? 'error' : 'warning', 5000, action)
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
          focusWord: settings.drillMode === 'focus'
            ? (selectedFocusWord?.kanji || selectedFocusWord?.kana || focusWordInput.trim())
            : undefined,
          focusWordSelection:
            settings.drillMode === 'focus' && selectedFocusWord
              ? {
                  id: selectedFocusWord.id,
                  kanji: selectedFocusWord.kanji,
                  kana: selectedFocusWord.kana,
                  meaning: selectedFocusWord.meaning,
                  type: selectedFocusWord.type,
                  jlpt: selectedFocusWord.jlpt,
                  partsOfSpeech: selectedFocusWord.partsOfSpeech,
                }
              : undefined,
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
      await (settings.drillMode === 'focus' ? checkFocusModeOnly : checkConjugationDrillOnly)({
        failOpen: false,
      })
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
        // Extract word type and conjugation.
        // Focus mode and enhanced detection paths often provide specific types
        // (Godan/Ichidan/Irregular/i-adjective/na-adjective), so don't rely on
        // legacy generic verb/adjective labels only.
        const normalizedTypes = new Set<string>([
          String(question.word.type || ''),
          String((question as any).conjugationType || ''),
        ])

        if (
          normalizedTypes.has('verb') ||
          normalizedTypes.has('Godan') ||
          normalizedTypes.has('Ichidan') ||
          normalizedTypes.has('Irregular')
        ) {
          verbsPracticed.push(question.word.kanji || question.word.kana)
        } else if (
          normalizedTypes.has('adjective') ||
          normalizedTypes.has('i-adjective') ||
          normalizedTypes.has('na-adjective')
        ) {
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

      // 3. Track drill session using DrillProgressManager
      // This automatically handles:
      // - Calling /api/drill/session with action='complete'
      // - Updating Firebase drill_sessions collection
      // - Recording gamification (XP + streak) via coordinator
      // - IndexedDB storage for all users
      // - Firebase sync for premium users
      const completionResult = await drillManager.trackDrillSession(sessionData, user, isPremium)
      if (debugEnabled) {
        setLastCompletionDebug(completionResult)
      }

      // 4. Show success message with stats
      const stats = await drillManager.getDrillStats(user.uid, isPremium)
      showToast(
        `${t('drill.complete')} - ${t('drill.accuracy')}: ${accuracy.toFixed(1)}% | Total Drills: ${stats?.totalDrills || 1}`,
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
    setSelectedFocusWord(null)
    setFocusWordInput('')
    setFocusWordResults([])
  }



  const currentQuestion = session?.questions[currentQuestionIndex]

  // Prefetch TTS for current question options
  useEffect(() => {
    if (!currentQuestion?.options?.length) return
    const uniqueOptions = Array.from(new Set(currentQuestion.options)).filter(Boolean)
    if (uniqueOptions.length === 0) return
    preloadTTS(uniqueOptions)
  }, [currentQuestion?.id, currentQuestion?.options, preloadTTS])

  // Load examples when Rules modal opens
  useEffect(() => {
    async function loadRuleExamples() {
      if (!showRulesModal || !currentQuestion) {
        return
      }

      setRuleExamples({ wordExamples: [], sentences: [], loading: true })

      try {
        const enhancedWord = enhanceWordWithType(currentQuestion.word as any)
        const conjugationType =
          currentQuestion.conjugationType ||
          enhancedWord.conjugationType ||
          currentQuestion.word.type

        // Determine word type filter
        let typeFilter: 'verbs' | 'adjectives' | 'all' = 'all'
        if (conjugationType === 'Ichidan' || conjugationType === 'Godan' || conjugationType === 'Irregular') {
          typeFilter = 'verbs'
        } else if (conjugationType === 'i-adjective' || conjugationType === 'na-adjective') {
          typeFilter = 'adjectives'
        }

        // 1. Get similar words from JMDict (excluding current word)
        const jlptLevel = currentQuestion.word.jlpt || 'N5'
        const mappedLevel = (['N3', 'N2', 'N1'].includes(jlptLevel) ? 'N3+' : jlptLevel) as 'N5' | 'N4' | 'N3+'
        const similarWords = await getConjugatableWordsPractice({
          type: typeFilter,
          jlptLevels: [mappedLevel, 'N4', 'N3+'],
          limit: 5,
          excludeRecent: [currentQuestion.word.id]
        })

        // 2. Conjugate the similar words to show the pattern
        const filteredSimilarWords = similarWords.filter(word => {
          const enhancedSimilar = enhanceWordWithType(word as any)
          const similarType = enhancedSimilar.conjugationType || word.type
          return similarType === conjugationType
        })

        const wordExamplesPromises = filteredSimilarWords.slice(0, 3).map(async (word) => {
          const enhanced = enhanceWordWithType(word as any)
          const forms = await ExtendedConjugationEngine.conjugate(enhanced)
          const conjugatedForm = forms[currentQuestion.targetForm as keyof typeof forms]

          return {
            word: word.kanji || word.kana,
            kana: word.kana,
            meaning: word.meaning,
            conjugated: conjugatedForm || ''
          }
        })

        const rawExamples = await Promise.all(wordExamplesPromises)
        const wordExamples = rawExamples.filter(example => example.conjugated)
        console.log('[Rules Modal] Loaded word examples:', wordExamples)

        // 3. Search Tatoeba for sentences with the exact conjugated form
        // Only show if we find the EXACT form - no base word fallbacks
        let sentences: ExampleSentence[] = []
        if (wordExamples.length > 0 && wordExamples[0].conjugated) {
          try {
            console.log('[Rules Modal] Searching Tatoeba for exact form:', wordExamples[0].conjugated)
            sentences = await searchTatoebaExamples(wordExamples[0].conjugated, 2)
            console.log('[Rules Modal] Found', sentences.length, 'sentences with exact conjugation')
          } catch (error) {
            console.error('Failed to load Tatoeba examples:', error)
          }
        }

        console.log('[Rules Modal] Final state:', { wordExamples: wordExamples.length, sentences: sentences.length })
        setRuleExamples({ wordExamples, sentences, loading: false })
      } catch (error) {
        console.error('Failed to load rule examples:', error)
        setRuleExamples({ wordExamples: [], sentences: [], loading: false })
      }
    }

    loadRuleExamples()
  }, [showRulesModal, currentQuestion])

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
          activeUsageData.hasData ? (
            <DesktopCircularIndicator
              remaining={activeUsageData.remaining}
              limitCount={activeUsageData.limitCount}
              usedCount={activeUsageData.usedCount}
              color={activeUsageData.color}
            />
          ) : null
        }
      />

      <FeatureUsageIndicator featureId={activeEntitlementFeatureId} />

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {!session ? (
            // Setup screen
            <div className="bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-xl shadow-lg p-4 sm:p-6 md:p-8">
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

              {/* Settings Summary + Drawer Trigger */}
              <div className="mb-4 sm:mb-6">
                <DrillSettingsSummary
                  settings={settings}
                  onOpenDrawer={() => setShowSettingsDrawer(true)}
                  t={t}
                />
              </div>

              {/* Practice Mode */}
              <div className="mb-4 sm:mb-6">
                <label className="block text-sm font-medium text-foreground dark:text-dark-foreground mb-2">
                  {t('drill.practiceMode')}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
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
                  <button
                    onClick={() => {
                      setSettings(prev => ({ ...prev, drillMode: 'focus' }))
                      setSelectedFocusWord(null)
                      setFocusWordInput('')
                      setFocusWordResults([])
                    }}
                    className={`px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-lg border transition-colors font-medium ${
                      settings.drillMode === 'focus'
                        ? 'border-orange-500 bg-orange-500 text-white'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-dark-700'
                    }`}
                  >
                    🎯 {t('drill.focusMode') || 'Focus Word'}
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

                {/* Focus Word Input - shown when 'focus' mode is selected */}
                {settings.drillMode === 'focus' && (
                  <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">🎯</span>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-orange-900 dark:text-orange-100">
                          {t('drill.focusMode')}
                        </h3>
                        <p className="text-xs text-orange-700 dark:text-orange-300 mt-0.5">
                          {t('drill.focusDescription')}
                        </p>
                      </div>
                    </div>

                    {/* Search Input */}
                    <div className="relative">
                      <input
                        type="text"
                        value={focusWordInput}
                        onChange={(e) => {
                          setFocusWordInput(e.target.value)
                          setSelectedFocusWord(null)
                        }}
                        placeholder={t('drill.focusPlaceholder')}
                        className="w-full px-4 py-2.5 rounded-lg border border-orange-300 dark:border-orange-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base"
                        autoComplete="off"
                      />
                      {focusWordLoading && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="animate-spin h-4 w-4 border-2 border-orange-500 border-t-transparent rounded-full" />
                        </div>
                      )}
                    </div>

                    {/* Search Results Dropdown */}
                    {showFocusResults && focusWordResults.length > 0 && !selectedFocusWord && (
                      <div className="mt-2 bg-white dark:bg-dark-800 border border-orange-200 dark:border-orange-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {focusWordResults.map((word, idx) => (
                          <button
                            key={word.id || idx}
                            onClick={() => {
                              setSelectedFocusWord(word)
                              setFocusWordInput(word.kanji || word.kana)
                              setShowFocusResults(false)
                            }}
                            className="w-full px-4 py-2.5 text-left hover:bg-orange-50 dark:hover:bg-orange-900/30 transition-colors border-b border-gray-100 dark:border-dark-700 last:border-b-0"
                          >
                            <div className="flex items-baseline gap-2">
                              <span className="text-base font-medium text-gray-900 dark:text-gray-100">
                                {word.kanji || word.kana}
                              </span>
                              {word.kanji && (
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                  {word.kana}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300">
                                {word.type}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {word.meaning}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Selected word confirmation */}
                    {selectedFocusWord && (
                      <div className="mt-3 p-3 bg-white dark:bg-dark-800 border border-orange-300 dark:border-orange-700 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-lg font-medium text-gray-900 dark:text-gray-100">
                                {selectedFocusWord.kanji || selectedFocusWord.kana}
                              </span>
                              {selectedFocusWord.kanji && (
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                  ({selectedFocusWord.kana})
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 font-medium">
                                {selectedFocusWord.type}
                              </span>
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                {selectedFocusWord.meaning}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedFocusWord(null)
                              setFocusWordInput('')
                              setFocusWordResults([])
                            }}
                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors text-gray-500 dark:text-gray-400"
                            aria-label="Clear selection"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="mt-3 text-xs text-orange-600 dark:text-orange-400">
                      {t('drill.focusTip')}
                    </div>
                  </div>
                )}
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
                {debugEnabled && lastCompletionDebug && (
                  <div className="mt-6 text-left border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white/60 dark:bg-gray-900/40">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Drill Debug
                      </span>
                      <button
                        onClick={() => {
                          const payload = JSON.stringify(lastCompletionDebug, null, 2)
                          if (navigator?.clipboard?.writeText) {
                            navigator.clipboard.writeText(payload).catch(() => {})
                          }
                        }}
                        className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        Copy
                      </button>
                    </div>
                    <pre className="text-xs overflow-auto max-h-48 whitespace-pre-wrap break-words">
                      {JSON.stringify(lastCompletionDebug, null, 2)}
                    </pre>
                  </div>
                )}
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
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-2 sm:mb-3">
                  {t('drill.conjugateTo')}:{' '}
                  <span className="text-primary-600">
                    {currentQuestion.rule}
                  </span>
                </h2>

                {/* Rules button - own row on mobile, inline on desktop */}
                {settings.showRules && (
                  <div className="mb-3 sm:mb-4">
                    <button
                      onClick={() => setShowRulesModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg transition-colors border border-blue-200 dark:border-blue-800"
                      aria-label="Show conjugation rules"
                    >
                      <span className="text-base">📖</span>
                      <span>Rules</span>
                    </button>
                  </div>
                )}
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
                {currentQuestion.options.map((option, index) => {
                  const isOptionPlaying =
                    ttsPlaying && ttsCurrentText && ttsCurrentText === option
                  return (
                    <div key={index} className="relative">
                      <button
                        onClick={() => handleAnswer(option)}
                        disabled={showResult}
                        className={`w-full pr-12 sm:pr-14 p-3 sm:p-4 text-base sm:text-lg rounded-lg border-2 transition-all min-h-[60px] sm:min-h-[auto] ${
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
                      <button
                        type="button"
                        aria-label={`Play audio for ${option}`}
                        onClick={async (event) => {
                          event.stopPropagation()
                          try {
                            await playTTS(option)
                          } catch (error) {
                            console.error('[Drill] Option TTS failed:', error)
                          }
                        }}
                        className={`absolute right-2 top-2 sm:right-3 sm:top-3 p-2 rounded-md bg-transparent transition-colors ${
                          isOptionPlaying
                            ? 'text-gray-500 dark:text-gray-400'
                            : 'text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-gray-100'
                        }`}
                      >
                        {ttsLoading && ttsCurrentText === option ? (
                          <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
                        ) : (
                          <Volume2
                            className={`w-4 h-4 ${isOptionPlaying ? 'text-gray-400 animate-pulse' : ''}`}
                          />
                        )}
                      </button>
                    </div>
                  )
                })}
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

      {/* Conjugation Rules Modal */}
      {currentQuestion && (() => {
        // Enhance word with proper conjugation type detection
        const enhancedWord = enhanceWordWithType(currentQuestion.word as any)
        const conjugationType =
          currentQuestion.conjugationType ||
          enhancedWord.conjugationType ||
          currentQuestion.word.type
        const usageNote = getConjugationUsageNote(
          currentQuestion.targetForm as any,
          conjugationType as any
        )

        return (
          <Modal
            isOpen={showRulesModal}
            onClose={() => setShowRulesModal(false)}
            title={`📖 ${currentQuestion.rule}`}
            size="md"
          >
            <div className="space-y-4">
              {/* Word Type Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-100 rounded-lg text-sm font-medium border border-primary-200 dark:border-primary-700">
                <span>🏷️</span>
                <span>{conjugationType || 'Word Type'}</span>
              </div>

              {/* Rule/Pattern */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  📐 Pattern
                </h3>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-base text-gray-900 dark:text-gray-100">
                    {ExtendedConjugationEngine.getConjugationRule(
                      conjugationType as any,
                      currentQuestion.targetForm as any
                    )}
                  </p>
                </div>
              </div>

              {/* Usage / meaning (pedagogical guidance) */}
              {usageNote && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    🧠 When it&apos;s used
                  </h3>
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-sm text-gray-800 dark:text-gray-100 font-medium">
                      {usageNote.summary}
                    </p>
                    <ul className="mt-2 space-y-1">
                      {usageNote.useCases.map((item, idx) => (
                        <li key={`${usageNote.key}-${idx}`} className="text-sm text-gray-700 dark:text-gray-300">
                          • {item}
                        </li>
                      ))}
                    </ul>
                    {usageNote.nuance && (
                      <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
                        {usageNote.nuance}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Your word - no answer given */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  💡 Your word
                </h3>
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xl font-medium text-gray-900 dark:text-gray-100">
                      {currentQuestion.word.kanji || currentQuestion.word.kana}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      ({currentQuestion.word.kana})
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {currentQuestion.word.meaning}
                  </p>
                  <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
                    📝 Now apply the pattern above!
                  </p>
                </div>
              </div>

              {/* Word examples - show pattern in action */}
              {ruleExamples.loading ? (
                <div className="flex items-center justify-center p-4">
                  <div className="animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full"></div>
                  <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading examples...</span>
                </div>
              ) : ruleExamples.wordExamples.length > 0 ? (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    ✨ See the pattern in action
                  </h3>
                  <div className="space-y-2">
                    {ruleExamples.wordExamples.map((example, idx) => (
                      <div key={idx} className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="flex items-baseline gap-2">
                          <span className="text-base font-medium text-gray-900 dark:text-gray-100">
                            {example.word}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400">→</span>
                          <span className="text-base font-bold text-green-700 dark:text-green-300">
                            {example.conjugated}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          ({example.kana}) - {example.meaning}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    No similar word examples found. The pattern above is still applicable!
                  </p>
                </div>
              )}

              {/* Sentence examples - real usage */}
              {!ruleExamples.loading && ruleExamples.sentences.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    📚 This form is used like
                  </h3>
                  <div className="space-y-3">
                    {ruleExamples.sentences.map((sentence) => (
                      <div key={sentence.id} className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                        <div className="flex items-start gap-2">
                          <p className="text-base text-gray-900 dark:text-gray-100 flex-1">
                            {sentence.japanese}
                          </p>
                          <button
                            onClick={() => playTTS(sentence.japanese)}
                            disabled={ttsLoading}
                            className="flex-shrink-0 p-1.5 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
                            aria-label="Play audio"
                          >
                            {ttsLoading ? (
                              <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 3.75a.75.75 0 00-1.264-.546L4.703 7H3.167a.75.75 0 00-.7.48A6.985 6.985 0 002 10c0 .887.165 1.737.468 2.52.111.29.39.48.7.48h1.535l4.033 3.796A.75.75 0 0010 16.25V3.75zM15.95 5.05a.75.75 0 00-1.06 1.061 5.5 5.5 0 010 7.778.75.75 0 001.06 1.06 7 7 0 000-9.899z" />
                                <path d="M13.829 7.172a.75.75 0 00-1.061 1.06 2.5 2.5 0 010 3.536.75.75 0 001.06 1.06 4 4 0 000-5.656z" />
                              </svg>
                            )}
                          </button>
                        </div>
                        {sentence.english && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {sentence.english}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Helpful tip */}
              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <span className="text-lg">💭</span>
                <p className="text-sm text-amber-900 dark:text-amber-100 flex-1">
                  Study the examples above, then apply the same pattern to your word!
                </p>
              </div>
            </div>
          </Modal>
        )
      })()}

      {/* Settings Drawer */}
      <DrillSettingsDrawer
        isOpen={showSettingsDrawer}
        onClose={() => setShowSettingsDrawer(false)}
        settings={settings}
        onSettingsChange={setSettings}
        questionLimits={questionLimits}
        isHydrated={isHydrated}
        isPremium={isPremium ?? false}
        t={t}
        strings={strings}
      />

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
