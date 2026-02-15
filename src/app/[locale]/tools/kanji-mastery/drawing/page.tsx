'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n, useLocalePath } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { useFeature } from '@/hooks/useFeature'
import { useSubscription } from '@/hooks/useSubscription'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { LoadingOverlay } from '@/components/ui/Loading'
import Navbar from '@/components/layout/Navbar'
import PageHeader from '@/components/ui/PageHeader'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'
import { Search } from 'lucide-react'
import { kanjiService } from '@/services/kanjiService'
import DrawingPracticeSheet from './DrawingPracticeSheet'
import type { Kanji, JLPTLevel } from '@/types/kanji'

const JLPT_LEVELS: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']

function DrawingPracticeContent() {
  const router = useRouter()
  const { t } = useI18n()
  const { getLocalePath } = useLocalePath()
  const { showToast } = useToast()
  const { user, loading: authLoading, isGuest } = useAuth()
  const { isPremium } = useSubscription()
  const { checkAndTrack } = useFeature('kanji_drawing_practice')

  const [selectedLevel, setSelectedLevel] = useState<JLPTLevel>('N5')
  const [kanjiList, setKanjiList] = useState<Kanji[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Kanji[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedKanji, setSelectedKanji] = useState<Kanji | null>(null)

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user && !isGuest) {
      router.push(getLocalePath('/auth/signin'))
    }
  }, [authLoading, user, isGuest, router, getLocalePath])

  // Load kanji for selected level
  useEffect(() => {
    let cancelled = false
    setLoading(true)

    kanjiService.loadKanjiByLevel(selectedLevel).then(data => {
      if (!cancelled) {
        setKanjiList(data)
        setLoading(false)
      }
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [selectedLevel])

  // Search handler
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)
    if (query.trim()) {
      try {
        setIsSearching(true)
        const results = await kanjiService.searchKanji(query.trim())
        setSearchResults(results)
      } catch {
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    } else {
      setSearchResults([])
      setIsSearching(false)
    }
  }, [])

  // Select a kanji - entitlement check happens here
  const handleKanjiSelect = async (kanji: Kanji) => {
    const allowed = await checkAndTrack({ showUI: true })
    if (!allowed) {
      if (!isPremium) {
        showToast(t('entitlements.messages.limitReached'), 'warning', 5000, {
          label: t('subscription.actions.upgrade'),
          onClick: () => router.push('/pricing'),
        })
      }
      return
    }
    setSelectedKanji(kanji)
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850 flex items-center justify-center">
        <LoadingOverlay isLoading={true} message={t('kanjiMasteryTool.loading')} />
      </div>
    )
  }

  if (!user && !isGuest) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850 flex items-center justify-center">
        <LoadingOverlay isLoading={true} message={t('kanjiMasteryTool.redirecting')} />
      </div>
    )
  }

  const displayKanji = searchQuery.trim() ? searchResults : kanjiList

  return (
    <>
      <div className="hidden sm:block">
        <Navbar user={user} showUserMenu={true} />
      </div>
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850">
        <PageHeader
          title={t('kanjiMasteryTool.drawingApproach.pageTitle')}
          description={t('kanjiMasteryTool.drawingApproach.pageDescription')}
          backHref="/tools/kanji-mastery"
          alwaysUseBackHref={true}
        />

        <div className="container mx-auto px-4 py-6 pb-24 sm:pb-16 max-w-5xl">
          {selectedKanji ? (
            /* Practicing view */
            <DrawingPracticeSheet
              kanji={selectedKanji}
              onBack={() => setSelectedKanji(null)}
            />
          ) : (
            /* Selecting view */
            <div className="space-y-4">
              {/* Search bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder={t('kanjiMasteryTool.drawingApproach.searchPlaceholder')}
                  aria-label={t('kanjiMasteryTool.drawingApproach.searchPlaceholder')}
                  className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-gray-100"
                />
              </div>

              {/* JLPT level tabs */}
              {!searchQuery.trim() && (
                <div className="flex p-1 bg-gray-100 dark:bg-dark-700 rounded-lg" role="tablist" aria-label="JLPT Level">
                  {JLPT_LEVELS.map(level => (
                    <button
                      key={level}
                      onClick={() => setSelectedLevel(level)}
                      role="tab"
                      aria-selected={selectedLevel === level}
                      aria-label={`JLPT ${level}`}
                      className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 ${
                        selectedLevel === level
                          ? 'bg-white dark:bg-dark-600 text-primary-600 dark:text-primary-400 shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              )}

              {/* Kanji grid */}
              {loading || isSearching ? (
                <div className="text-center py-12 text-sm text-gray-500 dark:text-gray-400" role="status">
                  {t('kanjiMasteryTool.drawingApproach.loading')}
                </div>
              ) : displayKanji.length === 0 ? (
                <div className="text-center py-12 text-sm text-gray-400 dark:text-gray-500" role="status">
                  {t('kanjiMasteryTool.drawingApproach.noResults')}
                </div>
              ) : (
                <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2" role="grid" aria-label={t('kanjiMasteryTool.drawingApproach.selectKanji')}>
                  {displayKanji.map((kanjiItem, index) => (
                    <button
                      key={`${kanjiItem.kanji}-${index}`}
                      onClick={() => handleKanjiSelect(kanjiItem)}
                      className="aspect-square flex items-center justify-center bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-lg text-xl font-japanese text-gray-900 dark:text-gray-100 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:border-primary-300 dark:hover:border-primary-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1"
                      title={kanjiItem.meaning}
                      aria-label={`${kanjiItem.kanji} — ${kanjiItem.meaning}`}
                    >
                      {kanjiItem.kanji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <MobileNavSpacer />
    </>
  )
}

export default function DrawingPracticePage() {
  const { t } = useI18n()
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850 flex items-center justify-center">
        <LoadingOverlay isLoading={true} message={t('kanjiMasteryTool.drawingApproach.loading')} />
      </div>
    }>
      <DrawingPracticeContent />
    </Suspense>
  )
}
