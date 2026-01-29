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
import { Zap, BookOpen, Target, Sparkles } from 'lucide-react'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'

interface BlastModeSettings {
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

  const [settings, setSettings] = useState<BlastModeSettings>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('blastModeSettings')
      if (saved) {
        return JSON.parse(saved)
      }
    }
    return {
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

  const isListMode = settings.contentType === 'list'
  const isKanjiMode = settings.contentType === 'kanji'

  // Save settings to localStorage when they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('blastModeSettings', JSON.stringify(settings))
    }
  }, [settings])

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

  const handleStartSession = async () => {
    setIsStarting(true)
    setError(null)

    try {
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

              {/* Content Type Selection */}
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
                    <span>{t('blastMode.buttons.starting')}</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    <span>{t('blastMode.buttons.start')}</span>
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
