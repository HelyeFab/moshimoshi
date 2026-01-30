'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n, useLocalePath } from '@/i18n/I18nContext'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { listManager } from '@/lib/lists/ListManager'
import type { UserList } from '@/types/userLists'
import { kanjiService } from '@/services/kanjiService'
import { isFeatureEnabled } from '@/lib/features/featureFlags'
import { LoadingOverlay } from '@/components/ui/Loading'
import Navbar from '@/components/layout/Navbar'
import PageHeader from '@/components/ui/PageHeader'
import { motion } from 'framer-motion'
import { Zap, BookOpen, Target, Sparkles, CheckCircle, Flame, Lock, FileText, Calendar } from 'lucide-react'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'
import { blastSessionManager } from '@/lib/blast-mode/blastSessionManager'
import { blastLessonManager } from '@/lib/blast-mode/blastLessonManager'
import { DEFAULT_LESSON_SIZE, getNextLessonIndex, splitIntoLessons } from '@/lib/blast-mode/lesson-utils'
import type { BlastLessonProgressRecord } from '@/lib/blast-mode/types'

interface BlastModeSettings {
  mode: 'session' | 'lesson'
  contentType: 'kanji' | 'vocabulary' | 'mixed' | 'list'
  sessionSize: number
  jlptLevel: string
  listId?: string
  selectedKanji?: string[]
}

function BlastModeContent() {
  const router = useRouter()
  const { t } = useI18n()
  const { getLocalePath } = useLocalePath()
  const { showToast } = useToast()
  const { user, loading: authLoading, isGuest } = useAuth()
  const { isPremium } = useSubscription()

  // Redirect to signin if not authenticated
  useEffect(() => {
    if (!authLoading && !user && !isGuest) {
      router.push(getLocalePath('/auth/signin'))
    }
  }, [authLoading, user, isGuest, router, getLocalePath])

  // Feature flag gate
  useEffect(() => {
    if (!isFeatureEnabled('BLAST_MODE')) {
      router.push(getLocalePath('/dashboard'))
    }
  }, [router, getLocalePath])

  // LWW sync on Blast Mode entry (premium users only)
  useEffect(() => {
    if (authLoading) return
    if (!user || isGuest || !isPremium) return

    blastSessionManager.syncOnEntry(user.uid, true, 50).catch(error => {
      console.error('[BlastMode] Session sync failed:', error)
    })
  }, [authLoading, user, isGuest, isPremium])

  const [settings, setSettings] = useState<BlastModeSettings>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('blastModeSettings')
        if (saved) {
          const parsed = JSON.parse(saved)
          return {
            mode: parsed.mode || 'session',
            contentType: parsed.contentType || 'kanji',
            sessionSize: parsed.sessionSize || 10,
            jlptLevel: parsed.jlptLevel || 'N5',
            listId: parsed.listId,
            selectedKanji: parsed.selectedKanji || []
          }
        }
      } catch (error) {
        console.error('Failed to parse saved blast mode settings:', error)
        // Fall through to return default settings
      }
    }
    return {
      mode: 'session',
      contentType: 'kanji',
      sessionSize: 10,
      jlptLevel: 'N5',
      selectedKanji: []
    }
  })

  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userLists, setUserLists] = useState<UserList[]>([])
  const [loadingLists, setLoadingLists] = useState(false)
  const [availableKanji, setAvailableKanji] = useState<string[]>([])
  const [kanjiSearch, setKanjiSearch] = useState('')
  const [loadingKanji, setLoadingKanji] = useState(false)

  const [lessonLoading, setLessonLoading] = useState(false)
  const [lessonError, setLessonError] = useState<string | null>(null)
  const [lessonKanji, setLessonKanji] = useState<string[][]>([])
  const [lessonProgress, setLessonProgress] = useState<BlastLessonProgressRecord[]>([])
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0)
  const [allLessonsComplete, setAllLessonsComplete] = useState(false)

  const isLessonMode = settings.mode === 'lesson'
  const isListMode = settings.contentType === 'list' && !isLessonMode
  const isKanjiMode = settings.contentType === 'kanji' && !isLessonMode

  // Save settings to localStorage when they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('blastModeSettings', JSON.stringify(settings))
    }
  }, [settings])

  useEffect(() => {
    if (settings.mode === 'lesson' && settings.contentType !== 'kanji') {
      setSettings(prev => ({ ...prev, contentType: 'kanji' }))
    }
  }, [settings.mode, settings.contentType])

  useEffect(() => {
    if (!isListMode && settings.listId) {
      setSettings(prev => ({ ...prev, listId: undefined }))
    }
  }, [isListMode, settings.listId])

  useEffect(() => {
    const loadKanji = async () => {
      if (!isKanjiMode) return

      setLoadingKanji(true)
      try {
        if (kanjiSearch.trim()) {
          const results = await kanjiService.searchKanji(
            kanjiSearch.trim(),
            [settings.jlptLevel as any]
          )
          setAvailableKanji(results.map(k => k.kanji))
        } else {
          const levelKanji = await kanjiService.loadKanjiByLevel(settings.jlptLevel as any)
          setAvailableKanji(levelKanji.map(k => k.kanji))
        }
      } catch (err) {
        console.error('Failed to load kanji for picker:', err)
        setAvailableKanji([])
      } finally {
        setLoadingKanji(false)
      }
    }

    loadKanji()
  }, [isKanjiMode, kanjiSearch, settings.jlptLevel])

  useEffect(() => {
    const loadLessonState = async () => {
      if (!isLessonMode) return

      setLessonLoading(true)
      setLessonError(null)
      try {
        const levelKanji = await kanjiService.loadKanjiByLevel(settings.jlptLevel as any)
        const kanjiIds = levelKanji.map(k => k.kanji)
        const lessons = splitIntoLessons(kanjiIds, DEFAULT_LESSON_SIZE)
        setLessonKanji(lessons)

        if (user?.uid) {
          if (isPremium) {
            await blastLessonManager.syncOnEntry(user.uid, true, settings.jlptLevel, 50)
          }
          const progress = await blastLessonManager.getLocalLessons(user.uid, settings.jlptLevel)
          setLessonProgress(progress)

          const nextIndex = getNextLessonIndex(progress, lessons.length)
          setCurrentLessonIndex(nextIndex)
          setAllLessonsComplete(
            lessons.length > 0 &&
              nextIndex === lessons.length - 1 &&
              progress.some(p => p.lessonIndex === nextIndex && p.completed)
          )
        } else {
          setLessonProgress([])
          setCurrentLessonIndex(0)
          setAllLessonsComplete(false)
        }
      } catch (err) {
        console.error('Failed to load lesson progress:', err)
        setLessonError(t('blastMode.lesson.errors.loadFailed'))
      } finally {
        setLessonLoading(false)
      }
    }

    loadLessonState()
  }, [isLessonMode, settings.jlptLevel, user?.uid, isPremium, t])

  // Load user lists when needed
  useEffect(() => {
    const fetchLists = async () => {
      if (!user?.uid || !isListMode) {
        setUserLists([])
        return
      }

      if (!isPremium) {
        setUserLists([])
        return
      }

      try {
        setLoadingLists(true)
        const lists = await listManager.getLists(user.uid, isPremium)
        setUserLists(lists)
      } catch (err) {
        console.error('Failed to load lists:', err)
        setUserLists([])
      } finally {
        setLoadingLists(false)
      }
    }

    fetchLists()
  }, [user?.uid, isPremium, isListMode])

  const handleStartSession = async (lessonOverride?: number) => {
    setIsStarting(true)
    setError(null)

    try {
      if (isLessonMode) {
        const lessonToStart = typeof lessonOverride === 'number' ? lessonOverride : currentLessonIndex
        const params = new URLSearchParams({
          mode: 'lesson',
          level: settings.jlptLevel,
          lesson: lessonToStart.toString()
        })
        router.push(`/tools/blast-mode/learn?${params}`)
        return
      }

      // Navigate to learning flow with settings
      if (isListMode && !settings.listId) {
        setError(t('blastMode.errors.selectList'))
        setIsStarting(false)
        return
      }

      if (isKanjiMode) {
        const selectedCount = settings.selectedKanji?.length || 0
        if (selectedCount > 0 && (selectedCount < 5 || selectedCount > 10)) {
          setError(t('blastMode.errors.kanjiRange'))
          setIsStarting(false)
          return
        }
      }

      const params = new URLSearchParams({
        size: settings.sessionSize.toString(),
        type: settings.contentType,
        level: settings.jlptLevel
      })
      if (settings.listId) {
        params.set('listId', settings.listId)
      }
      if (isKanjiMode && settings.selectedKanji && settings.selectedKanji.length > 0) {
        params.set('kanji', settings.selectedKanji.join(','))
        params.set('size', settings.selectedKanji.length.toString())
      }

      router.push(`/tools/blast-mode/learn?${params}`)
    } catch (err) {
      console.error('Failed to start session:', err)
      setError(t('blastMode.errors.startFailed'))
      setIsStarting(false)
    }
  }

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850 flex items-center justify-center">
        <LoadingOverlay isLoading={true} message={t('blastMode.loading.default')} />
      </div>
    )
  }

  // Don't render if not authenticated (will redirect)
  if (!user && !isGuest) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850 flex items-center justify-center">
        <LoadingOverlay isLoading={true} message={t('blastMode.loading.redirecting')} />
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
          title={t('blastMode.title')}
          description={t('blastMode.description')}
          backHref="/dashboard"
        />

        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="space-y-6">
            {/* Feature Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-dark-800 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('blastMode.features.fast.title')}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{t('blastMode.features.fast.description')}</p>
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
                    <Target className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('blastMode.features.adaptive.title')}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{t('blastMode.features.adaptive.description')}</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white dark:bg-dark-800 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('blastMode.features.engaging.title')}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{t('blastMode.features.engaging.description')}</p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Session Configuration */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white dark:bg-dark-800 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-6"
            >
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                {t('blastMode.configure.title')}
              </h2>

              {/* Mode Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {t('blastMode.configure.mode.label')}
                </label>
                <div className="flex flex-wrap gap-2 p-1 bg-gray-100 dark:bg-dark-700 rounded-lg">
                  <button
                    onClick={() => setSettings({ ...settings, mode: 'session' })}
                    className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                      settings.mode === 'session'
                        ? 'bg-white dark:bg-dark-600 text-primary-600 dark:text-primary-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {t('blastMode.configure.mode.session')}
                  </button>
                  <button
                    onClick={() => setSettings({ ...settings, mode: 'lesson' })}
                    className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                      settings.mode === 'lesson'
                        ? 'bg-white dark:bg-dark-600 text-primary-600 dark:text-primary-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {t('blastMode.configure.mode.lesson')}
                  </button>
                </div>
              </div>

              {/* Content Type Selection */}
              {!isLessonMode && (
                <div className="mb-6">
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {t('blastMode.configure.contentType.label')}
                </label>
                <div className="flex flex-wrap gap-2 p-1 bg-gray-100 dark:bg-dark-700 rounded-lg">
                  <button
                    onClick={() => setSettings({ ...settings, contentType: 'kanji' })}
                    className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                      settings.contentType === 'kanji'
                        ? 'bg-white dark:bg-dark-600 text-primary-600 dark:text-primary-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {t('blastMode.configure.contentType.kanji')}
                  </button>
                  <button
                    onClick={() => setSettings({ ...settings, contentType: 'vocabulary' })}
                    className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                      settings.contentType === 'vocabulary'
                        ? 'bg-white dark:bg-dark-600 text-primary-600 dark:text-primary-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {t('blastMode.configure.contentType.vocabulary')}
                  </button>
                  <button
                    onClick={() => setSettings({ ...settings, contentType: 'mixed' })}
                    className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                      settings.contentType === 'mixed'
                        ? 'bg-white dark:bg-dark-600 text-primary-600 dark:text-primary-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {t('blastMode.configure.contentType.mixed')}
                  </button>
                  <button
                    onClick={() => setSettings({ ...settings, contentType: 'list' })}
                    className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                      settings.contentType === 'list'
                        ? 'bg-white dark:bg-dark-600 text-primary-600 dark:text-primary-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {t('blastMode.configure.contentType.lists')}
                  </button>
                </div>
              </div>
              )}

              {/* List Selector */}
              {isListMode && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    {t('blastMode.configure.selectList.label')}
                  </label>

                  {!isPremium ? (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {t('blastMode.configure.selectList.requiresPremium')}
                    </div>
                  ) : loadingLists ? (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {t('blastMode.configure.selectList.loading')}
                    </div>
                  ) : userLists.length === 0 ? (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {t('blastMode.configure.selectList.noLists')}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {userLists.map(list => {
                          const isSelected = settings.listId === list.id
                          const itemCount = list.items?.length || 0
                          return (
                            <button
                              key={list.id}
                              type="button"
                              onClick={() => setSettings({ ...settings, listId: list.id })}
                              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                                isSelected
                                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                  : 'border-gray-200 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-700'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-base">{list.emoji}</span>
                                <span className="font-medium text-sm truncate">{list.name}</span>
                                <span className="ml-auto text-xs text-gray-600 dark:text-gray-400">
                                  {itemCount} {itemCount === 1 ? t('blastMode.configure.selectList.item') : t('blastMode.configure.selectList.items')}
                                </span>
                              </div>
                            </button>
                          )
                        })}
                    </div>
                  )}
                </div>
              )}

              {/* JLPT Level */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {t('blastMode.configure.jlptLevel')}
                </label>
                <div className="flex gap-2 p-1 bg-gray-100 dark:bg-dark-700 rounded-lg">
                  {['N5', 'N4', 'N3', 'N2', 'N1'].map((level) => (
                    <button
                      key={level}
                      onClick={() => setSettings({ ...settings, jlptLevel: level })}
                      className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                        settings.jlptLevel === level
                          ? 'bg-primary-500 text-white shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lesson Mode Summary */}
              {isLessonMode && (
                <div className="mb-6 rounded-lg border border-gray-200 dark:border-dark-700 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {t('blastMode.lesson.title')}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {t('blastMode.lesson.subtitle', { size: DEFAULT_LESSON_SIZE })}
                      </p>
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      {lessonKanji.length > 0
                        ? t('blastMode.lesson.progress', {
                            current: Math.min(currentLessonIndex + 1, lessonKanji.length),
                            total: lessonKanji.length
                          })
                        : t('blastMode.lesson.progressEmpty')}
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                    {t('blastMode.lesson.perfectNeeded')}
                  </div>

                  {lessonLoading ? (
                    <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                      {t('blastMode.lesson.loading')}
                    </div>
                  ) : lessonError ? (
                    <div className="mt-3 text-sm text-red-600 dark:text-red-400">
                      {lessonError}
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-gray-700 dark:text-gray-300">
                      {lessonKanji[currentLessonIndex]?.length
                        ? t('blastMode.lesson.kanjiCount', { count: lessonKanji[currentLessonIndex].length })
                        : t('blastMode.lesson.noKanji')}
                    </div>
                  )}
                </div>
              )}

              {/* Lesson Progress Panel */}
              {isLessonMode && lessonKanji.length > 0 && (
                <div className="mb-6 rounded-lg border border-gray-200 dark:border-dark-700 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {t('blastMode.lesson.progressTitle')}
                    </h3>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {t('blastMode.lesson.progress', {
                        current: Math.min(currentLessonIndex + 1, lessonKanji.length),
                        total: lessonKanji.length
                      })}
                    </span>
                  </div>

                  <div className="mb-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleStartSession(currentLessonIndex)}
                      className="text-xs px-3 py-2 rounded-lg border border-primary-500 text-primary-600 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                    >
                      {t('blastMode.lesson.resumeLesson', { number: currentLessonIndex + 1 })}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {lessonKanji.map((kanjiList, index) => {
                      const progress = lessonProgress.find(p => p.lessonIndex === index)
                      const isCompleted = Boolean(progress?.completed)
                      const isCurrent = index === currentLessonIndex && !isCompleted
                      const isLocked = index > currentLessonIndex
                      const accuracy = progress ? Math.round(progress.accuracy) : 0
                      const attempts = progress?.attempts ?? 0
                      const lastAttempt = progress?.lastAttemptAt

                      // Alternating gradient directions using palette colors
                      const isEven = index % 2 === 0
                      const gradientClass = isCompleted
                        ? isEven
                          ? 'bg-gradient-to-br from-green-500/10 via-green-600/5 to-transparent'
                          : 'bg-gradient-to-bl from-green-500/10 via-green-600/5 to-transparent'
                        : isCurrent
                          ? isEven
                            ? 'bg-gradient-to-br from-primary-500/15 via-primary-600/8 to-transparent'
                            : 'bg-gradient-to-bl from-primary-500/15 via-primary-600/8 to-transparent'
                          : isEven
                            ? 'bg-gradient-to-br from-gray-500/5 via-gray-600/3 to-transparent dark:from-dark-500/10 dark:via-dark-600/5'
                            : 'bg-gradient-to-bl from-gray-500/5 via-gray-600/3 to-transparent dark:from-dark-500/10 dark:via-dark-600/5'

                      const borderClass = isCompleted
                        ? 'border-green-500/50 dark:border-green-600/50'
                        : isCurrent
                          ? 'border-primary-500/60 dark:border-primary-600/60'
                          : 'border-gray-300/40 dark:border-dark-600/50'

                      // Status icon component
                      const StatusIcon = isCompleted
                        ? CheckCircle
                        : isCurrent
                          ? Flame
                          : isLocked
                            ? Lock
                            : BookOpen

                      const iconColor = isCompleted
                        ? 'text-green-600 dark:text-green-400'
                        : isCurrent
                          ? 'text-primary-600 dark:text-primary-400'
                          : isLocked
                            ? 'text-gray-500 dark:text-gray-500'
                            : 'text-gray-600 dark:text-gray-400'

                      return (
                        <motion.button
                          key={`lesson-${index}`}
                          type="button"
                          onClick={() => {
                            if (isLocked) return
                            handleStartSession(index)
                          }}
                          disabled={isLocked}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05, duration: 0.3 }}
                          whileHover={!isLocked ? { scale: 1.02, y: -2 } : {}}
                          whileTap={!isLocked ? { scale: 0.98 } : {}}
                          className={`
                            relative overflow-hidden rounded-xl border p-4
                            ${gradientClass} ${borderClass}
                            ${isLocked
                              ? 'opacity-50 cursor-not-allowed'
                              : 'cursor-pointer hover:shadow-lg hover:shadow-primary-500/20 dark:hover:shadow-primary-600/10'
                            }
                            transition-all duration-300 ease-out
                            backdrop-blur-sm
                          `}
                        >
                          {/* Glow effect on current lesson */}
                          {isCurrent && (
                            <div className="absolute inset-0 bg-gradient-to-r from-primary-500/5 to-primary-600/5 animate-pulse" />
                          )}

                          {/* Header with status badge */}
                          <div className="relative flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <StatusIcon className={`w-6 h-6 ${iconColor}`} />
                              <div>
                                <div className="text-base font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
                                  {t('blastMode.lesson.lessonLabel', { number: index + 1 })}
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 flex items-center gap-1">
                                  <FileText className="w-3 h-3" />
                                  <span>{kanjiList.length} kanji</span>
                                </div>
                              </div>
                            </div>
                            <span className={`
                              text-xs font-semibold px-2.5 py-1 rounded-full
                              ${isCompleted
                                ? 'bg-green-600 text-white dark:bg-green-500 dark:text-white'
                                : isCurrent
                                  ? 'bg-primary-600 text-white dark:bg-primary-500 dark:text-white'
                                  : 'bg-gray-500/20 text-gray-700 dark:bg-gray-600/30 dark:text-gray-300'
                              }
                            `}>
                              {isCompleted ? '✓ Done' : isCurrent ? 'Current' : isLocked ? 'Locked' : 'Ready'}
                            </span>
                          </div>

                          {/* Progress bar and stats */}
                          {progress && (
                            <div className="space-y-2">
                              {/* Accuracy progress bar */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-600 dark:text-gray-400">Accuracy</span>
                                  <span className={`font-bold ${
                                    accuracy === 100 ? 'text-green-600 dark:text-green-400' :
                                    accuracy >= 80 ? 'text-primary-600 dark:text-primary-400' :
                                    'text-gray-600 dark:text-gray-400'
                                  }`}>
                                    {accuracy}%
                                  </span>
                                </div>
                                <div className="h-1.5 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${accuracy}%` }}
                                    transition={{ delay: index * 0.05 + 0.3, duration: 0.8 }}
                                    className={`h-full rounded-full ${
                                      accuracy === 100 ? 'bg-gradient-to-r from-green-500 to-green-600' :
                                      accuracy >= 80 ? 'bg-gradient-to-r from-primary-500 to-primary-600' :
                                      'bg-gradient-to-r from-gray-400 to-gray-500'
                                    }`}
                                  />
                                </div>
                              </div>

                              {/* Additional stats */}
                              <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                                <span className="flex items-center gap-1">
                                  <Target className="w-3 h-3" />
                                  {attempts} {attempts === 1 ? 'attempt' : 'attempts'}
                                </span>
                                {lastAttempt && (
                                  <span className="flex items-center gap-1 truncate">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(lastAttempt).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Shine effect on hover */}
                          {!isLocked && (
                            <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                            </div>
                          )}
                        </motion.button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Kanji Picker */}
              {isKanjiMode && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    {t('blastMode.configure.kanjiPicker.label')}
                  </label>
                  <input
                    type="text"
                    value={kanjiSearch}
                    onChange={(e) => setKanjiSearch(e.target.value)}
                    placeholder={t('blastMode.configure.kanjiPicker.searchPlaceholder')}
                    className="w-full mb-3 px-3 py-2 rounded-lg border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100"
                  />

                  <div className="mb-3 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>{t('blastMode.configure.kanjiPicker.selected')} {settings.selectedKanji?.length || 0} {t('blastMode.configure.kanjiPicker.outOf')}</span>
                    <button
                      type="button"
                      onClick={() => setSettings(prev => ({ ...prev, selectedKanji: [] }))}
                      disabled={!settings.selectedKanji || settings.selectedKanji.length === 0}
                      className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('blastMode.configure.kanjiPicker.clearAll')}
                    </button>
                  </div>

                  {loadingKanji ? (
                    <div className="text-sm text-gray-600 dark:text-gray-400">{t('blastMode.configure.kanjiPicker.loading')}</div>
                  ) : (
                    <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto scrollbar-hide">
                      {availableKanji.map(kanji => {
                        const selected = settings.selectedKanji?.includes(kanji)
                        const reachedMax = (settings.selectedKanji?.length || 0) >= 10
                        return (
                          <button
                            key={kanji}
                            type="button"
                            onClick={() => {
                              setSettings(prev => {
                                const current = prev.selectedKanji || []
                                if (current.includes(kanji)) {
                                  return { ...prev, selectedKanji: current.filter(k => k !== kanji) }
                                }
                                if (current.length >= 10) return prev
                                return { ...prev, selectedKanji: [...current, kanji] }
                              })
                            }}
                            disabled={!selected && reachedMax}
                            className={`px-4 py-3 rounded-lg border !text-3xl text-primary-600 dark:text-primary-400 min-w-[60px] min-h-[60px] flex items-center justify-center transition-colors ${
                              selected
                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                : 'border-gray-200 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-700'
                            } ${!selected && reachedMax ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {kanji}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                    {t('blastMode.configure.kanjiPicker.note')}
                  </div>
                </div>
              )}

              {/* Session Size */}
              {!isLessonMode && (
                <div className="mb-6">
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                  {t('blastMode.configure.sessionSize.label')}
                </label>
                <div className="flex items-center justify-center gap-3 bg-gray-100 dark:bg-dark-700 rounded-lg p-3">
                  <button
                    onClick={() => setSettings({ ...settings, sessionSize: Math.max(5, settings.sessionSize - 5) })}
                    className="w-10 h-10 rounded-lg bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 hover:bg-gray-100 dark:hover:bg-dark-750 transition-colors flex items-center justify-center text-gray-900 dark:text-gray-100 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={settings.sessionSize <= 5}
                  >
                    -
                  </button>
                  <div className="min-w-[80px] text-center">
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {settings.sessionSize}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {t('blastMode.configure.sessionSize.items')}
                    </div>
                  </div>
                  <button
                    onClick={() => setSettings({ ...settings, sessionSize: Math.min(50, settings.sessionSize + 5) })}
                    className="w-10 h-10 rounded-lg bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 hover:bg-gray-100 dark:hover:bg-dark-750 transition-colors flex items-center justify-center text-gray-900 dark:text-gray-100 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={settings.sessionSize >= 50}
                  >
                    +
                  </button>
                </div>
              </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
                  <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                </div>
              )}

              {/* Start Button */}
              <button
                onClick={() => handleStartSession()}
                disabled={isStarting}
                className="w-full py-3 px-4 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 transition-colors disabled:bg-gray-300 dark:disabled:bg-dark-600 disabled:text-gray-500 dark:disabled:text-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isStarting ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    <span>{t('blastMode.buttons.starting')}</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    <span>
                      {isLessonMode
                        ? allLessonsComplete
                          ? t('blastMode.buttons.reviewLesson')
                          : t('blastMode.buttons.startLesson', { number: currentLessonIndex + 1 })
                        : t('blastMode.buttons.start')}
                    </span>
                  </>
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
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {t('blastMode.howItWorks.title')}
              </h2>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <span className="text-primary-500 font-semibold">1.</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('blastMode.howItWorks.step1.title')}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{t('blastMode.howItWorks.step1.description')}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="text-primary-500 font-semibold">2.</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('blastMode.howItWorks.step2.title')}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{t('blastMode.howItWorks.step2.description')}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="text-primary-500 font-semibold">3.</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('blastMode.howItWorks.step3.title')}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{t('blastMode.howItWorks.step3.description')}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
      <MobileNavSpacer />
    </>
  )
}

function SuspenseFallback() {
  const { t } = useI18n()
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850 flex items-center justify-center">
      <LoadingOverlay isLoading={true} message={t('blastMode.loading.default')} />
    </div>
  )
}

// Wrapper component with Suspense boundary
export default function BlastModeDashboard() {
  return (
    <Suspense fallback={<SuspenseFallback />}>
      <BlastModeContent />
    </Suspense>
  )
}
