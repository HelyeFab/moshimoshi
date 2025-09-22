'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTheme } from '@/lib/theme/ThemeContext'
import { useI18n } from '@/i18n/I18nContext'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { LoadingOverlay } from '@/components/ui/Loading'
import DoshiMascot from '@/components/ui/DoshiMascot'
import { motion } from 'framer-motion'
import KanjiProgressSummary from './components/KanjiProgressSummary'
import ReviewDueAlert from './components/ReviewDueAlert'

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
  const { strings } = useI18n()
  const { showToast } = useToast()
  const { resolvedTheme } = useTheme()

  // Check if we're in review mode from Review Hub
  const isReviewMode = searchParams.get('mode') === 'review'
  const returnTo = searchParams.get('returnTo') || '/review-hub'

  // Load saved settings from localStorage
  const [settings, setSettings] = useState<StudySettings>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kanjiMasterySettings')
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch {}
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
      localStorage.setItem('kanjiMasterySettings', JSON.stringify(settings))
    }
  }, [settings])

  const handleStartSession = async () => {
    setIsStarting(true)
    setError(null)

    try {
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
      setError('Failed to start session. Please try again.')
      setIsStarting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850">
      {/* Header */}
      <div className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm border-b border-primary-200 dark:border-dark-700">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={isReviewMode ? returnTo : '/dashboard'}
                className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
              >
                ← Back
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {isReviewMode ? 'Kanji Mastery Review' : 'Kanji Mastery'}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Master kanji with spaced repetition
                </p>
              </div>
            </div>
            <DoshiMascot size="small" mood="happy" />
          </div>
        </div>
      </div>

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
                  <span className="text-lg">📚</span>
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Session Size</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{settings.sessionSize} kanji</p>
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
                  <span className="text-lg">⏱️</span>
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Est. Time</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{settings.sessionSize * 2}-{settings.sessionSize * 3} min</p>
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
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Linear Progress</span>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {(() => {
                    const storageKey = `kanjiLinearProgress_${settings.jlptLevel}`
                    const lastIndex = parseInt(
                      typeof window !== 'undefined'
                        ? localStorage.getItem(storageKey) || '0'
                        : '0'
                    )
                    const total = settings.studyMode === 'jlpt' ? 80 : 100 // N5 has 80 kanji
                    return `${Math.min(lastIndex, total)}/${total} kanji`
                  })()}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-dark-700 rounded-full h-2">
                <div
                  className="bg-primary-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${(() => {
                      const storageKey = `kanjiLinearProgress_${settings.jlptLevel}`
                      const lastIndex = parseInt(
                        typeof window !== 'undefined'
                          ? localStorage.getItem(storageKey) || '0'
                          : '0'
                      )
                      const total = settings.studyMode === 'jlpt' ? 80 : 100
                      return Math.min((lastIndex / total) * 100, 100)
                    })()}%`
                  }}
                />
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                Study kanji in traditional order. Progress saves automatically.
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
              <span>⚙️</span>
              Configure Your Study Session
            </h2>

            {/* Learning Approach Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                Learning Approach
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
                    <span className="text-lg">🧠</span>
                    <span>Smart Selection</span>
                    <span className="text-xs opacity-80">Adaptive learning</span>
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
                    <span className="text-lg">📚</span>
                    <span>Linear Order</span>
                    <span className="text-xs opacity-80">Sequential study</span>
                  </div>
                </button>
              </div>
              {settings.learningApproach === 'smart' && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                  Prioritizes new kanji, due reviews, and areas you struggle with
                </p>
              )}
              {settings.learningApproach === 'linear' && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                  Study kanji in traditional order, perfect for textbook learning
                </p>
              )}
            </div>

            {/* Study Mode Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                Study Level
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
                  JLPT Level
                </button>
                <button
                  onClick={() => setSettings({ ...settings, studyMode: 'grade' })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    settings.studyMode === 'grade'
                      ? 'bg-primary-500 text-white shadow-lg'
                      : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                  }`}
                >
                  School Grade
                </button>
                <button
                  onClick={() => setSettings({ ...settings, studyMode: 'mixed' })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    settings.studyMode === 'mixed'
                      ? 'bg-primary-500 text-white shadow-lg'
                      : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                  }`}
                >
                  Mixed
                </button>
              </div>
            </div>

            {/* Level Selection */}
            {settings.studyMode === 'jlpt' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  JLPT Level
                </label>
                <select
                  value={settings.jlptLevel}
                  onChange={(e) => setSettings({ ...settings, jlptLevel: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="N5">N5 - Beginner</option>
                  <option value="N4">N4 - Elementary</option>
                  <option value="N3">N3 - Intermediate</option>
                  <option value="N2">N2 - Advanced</option>
                  <option value="N1">N1 - Expert</option>
                </select>
              </div>
            )}

            {settings.studyMode === 'grade' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  School Grade
                </label>
                <select
                  value={settings.gradeLevel}
                  onChange={(e) => setSettings({ ...settings, gradeLevel: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  {[1, 2, 3, 4, 5, 6].map(grade => (
                    <option key={grade} value={grade}>Grade {grade}</option>
                  ))}
                  <option value="7">Secondary School</option>
                </select>
              </div>
            )}

            {/* Session Size */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                Kanji per Session: {settings.sessionSize}
              </label>
              <input
                type="range"
                min="1"
                max="50"
                value={settings.sessionSize}
                onChange={(e) => setSettings({ ...settings, sessionSize: parseInt(e.target.value) })}
                className="w-full accent-primary-500"
              />
              <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-1">
                <span>1</span>
                <span className="font-medium">Recommended: 5-10</span>
                <span>50</span>
              </div>

              {settings.sessionSize > 20 && (
                <div className="mt-2 p-3 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                    <span>⚠️</span>
                    <span>Studying more than 20 kanji per session may reduce retention. Consider smaller, more frequent sessions.</span>
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
                  <span>Starting Session...</span>
                </>
              ) : (
                <span>Start Learning Session</span>
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
              <span>💡</span>
              How It Works
            </h2>
            <div className="space-y-3">
              <div className="flex gap-3">
                <span className="text-primary-500 font-semibold">1.</span>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Configure Your Session</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Choose JLPT level and number of kanji to study</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-primary-500 font-semibold">2.</span>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Learn with Examples</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Each kanji comes with vocabulary and sentences</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-primary-500 font-semibold">3.</span>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Spaced Repetition</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">AI-powered scheduling optimizes your retention</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Progress Summary */}
          <KanjiProgressSummary />
        </div>
      </div>
    </div>
  )
}

// Wrapper component with Suspense boundary
export default function KanjiMasteryDashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850 flex items-center justify-center">
        <LoadingOverlay isLoading={true} message="Loading Kanji Mastery..." />
      </div>
    }>
      <KanjiMasteryContent />
    </Suspense>
  )
}