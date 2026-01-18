'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useI18n, useLocalePath } from '@/i18n/I18nContext'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { useAuth } from '@/hooks/useAuth'
import { useFeature } from '@/hooks/useFeature'
import { useSubscription } from '@/hooks/useSubscription'
import { LoadingOverlay } from '@/components/ui/Loading'
import Navbar from '@/components/layout/Navbar'
import PageHeader from '@/components/ui/PageHeader'
import { motion } from 'framer-motion'
import Dropdown from '@/components/ui/Dropdown'
import { BookOpen, Clock, Settings, Brain, AlertTriangle, Lightbulb } from 'lucide-react'
import KanjiProgressSummary from './components/KanjiProgressSummary'
import ReviewDueAlert from './components/ReviewDueAlert'
import { useUserStorage } from '@/hooks/useUserStorage'
import { useFeatureUsage, DesktopCircularIndicator, FeatureUsageIndicator } from '@/components/entitlements/FeatureUsageIndicator'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'

interface StudySettings {
  sessionSize: number
  jlptLevel: string
  gradeLevel: string
  studyMode: 'jlpt' | 'grade' | 'mixed'
  learningApproach: 'smart' | 'linear'
}

function KanjiMasteryContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { strings, t } = useI18n()
  const { getLocalePath } = useLocalePath()
  const { showToast } = useToast()
  const { user, loading: authLoading, isGuest } = useAuth()
  const { isPremium } = useSubscription()
  const { checkOnly } = useFeature('kanji_mastery')
  const usageData = useFeatureUsage('kanji_mastery')

  // Check if we're in review mode from Review Hub
  const isReviewMode = searchParams.get('mode') === 'review'
  const returnTo = searchParams.get('returnTo') || '/review-hub'

  // Get user storage hook
  const { getItem, setItem } = useUserStorage()

  // Redirect to signin if not authenticated
  useEffect(() => {
    if (!authLoading && !user && !isGuest) {
      router.push(getLocalePath('/auth/signin'))
    }
  }, [authLoading, user, isGuest, router, getLocalePath])

  // Load saved settings from user-specific storage
  const [settings, setSettings] = useState<StudySettings>(() => {
    if (typeof window !== 'undefined') {
      const saved = getItem('kanjiMasterySettings')
      if (saved) {
        return saved
      }
    }
    return {
      sessionSize: 5,
      jlptLevel: 'N5',
      gradeLevel: '1',
      studyMode: 'jlpt',
      learningApproach: 'smart'
    }
  })

  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Save settings to localStorage when they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setItem('kanjiMasterySettings', settings)
    }
  }, [settings])

  const handleStartSession = async () => {
    setIsStarting(true)
    setError(null)

    try {
      const decision = await checkOnly({ failOpen: false })
      if (!decision.allow) {
        const action = !isPremium ? {
          label: t('subscription.actions.upgrade'),
          onClick: () => router.push('/pricing')
        } : undefined
        showToast(t('entitlements.messages.limitReached'), 'warning', 5000, action)
        setIsStarting(false)
        return
      }

      // Navigate to learning flow with settings
      const params = new URLSearchParams({
        size: settings.sessionSize.toString(),
        mode: settings.studyMode,
        level: settings.studyMode === 'jlpt' ? settings.jlptLevel : settings.gradeLevel,
        approach: settings.learningApproach
      })

      // Add review mode parameters if coming from review hub
      if (isReviewMode) {
        params.set('reviewMode', 'true')
        params.set('returnTo', returnTo)
      }

      router.push(`/tools/kanji-mastery/learn?${params}`)
    } catch (err) {
      console.error('Failed to start session:', err)
      setError(t('kanjiMasteryTool.errorStartSession'))
      setIsStarting(false)
    }
  }

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850 flex items-center justify-center">
        <LoadingOverlay isLoading={true} message={t('kanjiMasteryTool.loading')} />
      </div>
    )
  }

  // Don't render if not authenticated (will redirect)
  if (!user && !isGuest) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850 flex items-center justify-center">
        <LoadingOverlay isLoading={true} message={t('kanjiMasteryTool.redirecting')} />
      </div>
    )
  }

  return (
    <>
      <div className="hidden sm:block">
        <Navbar user={user} showUserMenu={true} />
      </div>
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850">
        <PageHeader
          title={isReviewMode ? t('kanjiMasteryTool.titleReview') : t('kanjiMasteryTool.title')}
          description={t('kanjiMasteryTool.description')}
          backHref={isReviewMode ? returnTo : '/dashboard'}
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

        <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Main Content */}
        <div className="space-y-6">
          {/* Reviews Due Alert */}
          {!isReviewMode && <ReviewDueAlert />}

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-dark-800 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{t('kanjiMasteryTool.sessionSize')}</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{settings.sessionSize} {t('kanjiMasteryTool.kanji')}</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-dark-800 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{t('kanjiMasteryTool.estTime')}</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{settings.sessionSize * 2}-{settings.sessionSize * 3} {t('kanjiMasteryTool.min')}</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Linear Progress Indicator (only show in linear mode) */}
          {settings.learningApproach === 'linear' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white dark:bg-dark-800 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('kanjiMasteryTool.linearProgress')}</span>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {(() => {
                    const progressData = getItem<Record<string, number>>('kanjiLinearProgress', {}) || {}
                    const lastIndex = progressData[settings.jlptLevel] || 0
                    const total = settings.studyMode === 'jlpt' ? 80 : 100 // N5 has 80 kanji
                    return `${Math.min(lastIndex, total)}/${total} ${t('kanjiMasteryTool.kanji')}`
                  })()}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-dark-700 rounded-full h-2">
                <div
                  className="bg-primary-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${(() => {
                      const progressData = getItem<Record<string, number>>('kanjiLinearProgress', {}) || {}
                      const lastIndex = progressData[settings.jlptLevel] || 0
                      const total = settings.studyMode === 'jlpt' ? 80 : 100
                      return Math.min((lastIndex / total) * 100, 100)
                    })()}%`
                  }}
                />
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                {t('kanjiMasteryTool.linearProgressDescription')}
              </p>
            </motion.div>
          )}

          {/* Session Configuration */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-dark-800 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-6"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              {t('kanjiMasteryTool.configureSession')}
            </h2>

            {/* Learning Approach Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                {t('kanjiMasteryTool.learningApproach')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSettings({ ...settings, learningApproach: 'smart' })}
                  className={`px-4 py-3 rounded-lg text-sm font-medium transition-all border ${
                    settings.learningApproach === 'smart'
                      ? 'bg-primary-500 text-white border-primary-500 shadow-lg'
                      : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600 border-gray-300 dark:border-dark-600'
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <Brain className="w-5 h-5" />
                    <span>{t('kanjiMasteryTool.smartSelection')}</span>
                    <span className="text-xs opacity-80">{t('kanjiMasteryTool.adaptiveLearning')}</span>
                  </div>
                </button>
                <button
                  onClick={() => setSettings({ ...settings, learningApproach: 'linear' })}
                  className={`px-4 py-3 rounded-lg text-sm font-medium transition-all border ${
                    settings.learningApproach === 'linear'
                      ? 'bg-primary-500 text-white border-primary-500 shadow-lg'
                      : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600 border-gray-300 dark:border-dark-600'
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <BookOpen className="w-5 h-5" />
                    <span>{t('kanjiMasteryTool.linearOrder')}</span>
                    <span className="text-xs opacity-80">{t('kanjiMasteryTool.sequentialStudy')}</span>
                  </div>
                </button>
              </div>
              {settings.learningApproach === 'smart' && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                  {t('kanjiMasteryTool.smartDescription')}
                </p>
              )}
              {settings.learningApproach === 'linear' && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                  {t('kanjiMasteryTool.linearDescription')}
                </p>
              )}
            </div>

            {/* Study Mode Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                {t('kanjiMasteryTool.studyLevel')}
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setSettings({ ...settings, studyMode: 'jlpt' })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    settings.studyMode === 'jlpt'
                      ? 'bg-primary-500 text-white shadow-lg'
                      : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                  }`}
                >
                  {t('kanjiMasteryTool.jlptLevel')}
                </button>
                <button
                  onClick={() => setSettings({ ...settings, studyMode: 'grade' })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    settings.studyMode === 'grade'
                      ? 'bg-primary-500 text-white shadow-lg'
                      : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                  }`}
                >
                  {t('kanjiMasteryTool.schoolGrade')}
                </button>
                <button
                  onClick={() => setSettings({ ...settings, studyMode: 'mixed' })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    settings.studyMode === 'mixed'
                      ? 'bg-primary-500 text-white shadow-lg'
                      : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                  }`}
                >
                  {t('kanjiMasteryTool.mixed')}
                </button>
              </div>
            </div>

            {/* Level Selection */}
            {settings.studyMode === 'jlpt' && (
              <div className="mb-6">
                <Dropdown
                  label={t('kanjiMasteryTool.jlptLevel')}
                  value={settings.jlptLevel}
                  onChange={(value) => setSettings({ ...settings, jlptLevel: value })}
                  options={[
                    { value: 'N5', label: t('kanjiMasteryTool.jlptLevels.n5') },
                    { value: 'N4', label: t('kanjiMasteryTool.jlptLevels.n4') },
                    { value: 'N3', label: t('kanjiMasteryTool.jlptLevels.n3') },
                    { value: 'N2', label: t('kanjiMasteryTool.jlptLevels.n2') },
                    { value: 'N1', label: t('kanjiMasteryTool.jlptLevels.n1') },
                  ]}
                />
              </div>
            )}

            {settings.studyMode === 'grade' && (
              <div className="mb-6">
                <Dropdown
                  label={t('kanjiMasteryTool.schoolGrade')}
                  value={settings.gradeLevel}
                  onChange={(value) => setSettings({ ...settings, gradeLevel: value })}
                  options={[
                    { value: '1', label: t('kanjiMasteryTool.grades.grade1') },
                    { value: '2', label: t('kanjiMasteryTool.grades.grade2') },
                    { value: '3', label: t('kanjiMasteryTool.grades.grade3') },
                    { value: '4', label: t('kanjiMasteryTool.grades.grade4') },
                    { value: '5', label: t('kanjiMasteryTool.grades.grade5') },
                    { value: '6', label: t('kanjiMasteryTool.grades.grade6') },
                    { value: '7', label: t('kanjiMasteryTool.grades.secondary') },
                  ]}
                />
              </div>
            )}

            {/* Session Size */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                {t('kanjiMasteryTool.kanjiPerSession')}
              </label>

              {/* Preset buttons */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[5, 10, 15, 20].map((size) => (
                  <button
                    key={size}
                    onClick={() => setSettings({ ...settings, sessionSize: size })}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      settings.sessionSize === size
                        ? 'bg-primary-500 text-white shadow-lg'
                        : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>

              {/* Stepper control */}
              <div className="flex items-center justify-center gap-3 bg-gray-50 dark:bg-dark-700 rounded-lg p-3">
                <button
                  onClick={() => setSettings({ ...settings, sessionSize: Math.max(1, settings.sessionSize - 1) })}
                  className="w-10 h-10 rounded-lg bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 hover:bg-gray-100 dark:hover:bg-dark-750 transition-colors flex items-center justify-center text-gray-700 dark:text-gray-300 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={settings.sessionSize <= 1}
                >
                  -
                </button>
                <div className="min-w-[80px] text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {settings.sessionSize}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {t('kanjiMasteryTool.kanji')}
                  </div>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, sessionSize: Math.min(50, settings.sessionSize + 1) })}
                  className="w-10 h-10 rounded-lg bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 hover:bg-gray-100 dark:hover:bg-dark-750 transition-colors flex items-center justify-center text-gray-700 dark:text-gray-300 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={settings.sessionSize >= 50}
                >
                  +
                </button>
              </div>

              {settings.sessionSize > 20 && (
                <div className="mt-3 p-3 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span>{t('kanjiMasteryTool.warningLargeSession')}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Error Display */}
            {error && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            {/* Start Button */}
            <button
              onClick={handleStartSession}
              disabled={isStarting}
              className="w-full py-3 px-4 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 transition-colors disabled:bg-gray-300 dark:disabled:bg-dark-600 disabled:text-gray-500 dark:disabled:text-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isStarting ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  <span>{t('kanjiMasteryTool.startingSession')}</span>
                </>
              ) : (
                <span>{t('kanjiMasteryTool.startLearningSession')}</span>
              )}
            </button>
          </motion.div>

          {/* How It Works */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white dark:bg-dark-800 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-6"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <Lightbulb className="w-5 h-5" />
              {t('kanjiMasteryTool.howItWorks')}
            </h2>
            <div className="space-y-3">
              <div className="flex gap-3">
                <span className="text-primary-500 font-semibold">1.</span>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('kanjiMasteryTool.step1Title')}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{t('kanjiMasteryTool.step1Description')}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-primary-500 font-semibold">2.</span>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('kanjiMasteryTool.step2Title')}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{t('kanjiMasteryTool.step2Description')}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-primary-500 font-semibold">3.</span>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('kanjiMasteryTool.step3Title')}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{t('kanjiMasteryTool.step3Description')}</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Progress Summary */}
          <KanjiProgressSummary />
        </div>

        </div>
      </div>
      <MobileNavSpacer />
    </>
  )
}

// Wrapper component with Suspense boundary
export default function KanjiMasteryDashboard() {
  const { t } = useI18n()
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850 flex items-center justify-center">
        <LoadingOverlay isLoading={true} message={t('kanjiMasteryTool.loading')} />
      </div>
    }>
      <KanjiMasteryContent />
    </Suspense>
  )
}
