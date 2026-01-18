'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useMoodBoards } from '@/hooks/useMoodBoards'
import { MoodBoard as MoodBoardType, BoardProgress } from '@/types/moodboard'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import Navbar from '@/components/layout/Navbar'
import LearningPageHeader from '@/components/learn/LearningPageHeader'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import KanjiDetailsModal from '@/components/kanji/KanjiDetailsModal'
import { Kanji } from '@/types/kanji'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { kanjiService } from '@/services/kanjiService'
import { useFeature } from '@/hooks/useFeature'
import { moodBoardProgressManager } from '@/utils/moodBoardProgressManager'
import { motion, AnimatePresence } from 'framer-motion'
import { IoCheckmarkCircle, IoInformationCircle, IoClose } from 'react-icons/io5'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'

export default function MoodBoardDetailPage() {
  const router = useRouter()
  const params = useParams()
  const boardId = params.boardId as string

  const { t } = useI18n()
  const { showToast } = useToast()
  const { user } = useAuth()
  const { isPremium } = useSubscription()
  const { moodBoards, loading } = useMoodBoards()
  const { checkAndTrack } = useFeature('kanji_mood_board')

  const [board, setBoard] = useState<MoodBoardType | null>(null)
  const [progress, setProgress] = useState<BoardProgress | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'study' | 'list'>('grid')
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [showCompleted, setShowCompleted] = useState(true)
  const [selectedKanji, setSelectedKanji] = useState<Kanji | null>(null)
  const [enrichedKanjiMap, setEnrichedKanjiMap] = useState<Map<string, Kanji>>(new Map())
  const [entitlementChecked, setEntitlementChecked] = useState(false)
  const [isFlipped, setIsFlipped] = useState(false)

  // Find the board
  useEffect(() => {
    if (!loading && moodBoards.length > 0) {
      const foundBoard = moodBoards.find(b => b.id === boardId)
      if (foundBoard) {
        setBoard(foundBoard)
      } else {
        showToast(`${t('error.notFound')}: ${t('moodboards.boardNotFound')}`, 'error')
        router.push('/kanji-moods')
      }
    }
  }, [boardId, moodBoards, loading, router, showToast, t])

  useEffect(() => {
    const checkAccess = async () => {
      if (!boardId) return
      const allowed = await checkAndTrack({ showUI: true, metadata: { boardId } })
      setEntitlementChecked(true)
      if (!allowed) {
        router.push('/kanji-moods')
      }
    }

    checkAccess()
  }, [boardId, checkAndTrack, router])

  useEffect(() => {
    let isActive = true

    const loadProgress = async () => {
      if (!user?.uid || !board) {
        if (isActive) setProgress(null)
        return
      }

      try {
        await moodBoardProgressManager.migrateFromLocalStorage(user, isPremium ?? false)
        const boardProgress = await moodBoardProgressManager.getBoardProgress(
          user,
          isPremium ?? false,
          boardId,
          board.kanji.length
        )
        if (isActive) setProgress(boardProgress)
      } catch (error) {
        console.error('Error loading progress:', error)
      }
    }

    loadProgress()

    return () => {
      isActive = false
    }
  }, [user?.uid, isPremium, board, boardId])

  // Enrich moodboard kanji with local kanji data (readings, examples, etc.)
  useEffect(() => {
    if (!board || board.kanji.length === 0) return

    const enrichKanji = async () => {
      const kanjiChars = board.kanji.map(k => k.char)
      const enrichedData = await kanjiService.getMultipleKanjiDetails(kanjiChars)
      setEnrichedKanjiMap(enrichedData)
    }

    enrichKanji()
  }, [board])

  // Reset flip state when card changes
  useEffect(() => {
    setIsFlipped(false)
  }, [currentCardIndex])

  const handleToggleKanji = async (kanjiChar: string) => {
    if (!board || !user?.uid) return

    await moodBoardProgressManager.toggleKanjiLearned(
      boardId,
      kanjiChar,
      user,
      isPremium ?? false
    )

    const newProgress = await moodBoardProgressManager.getBoardProgress(
      user,
      isPremium ?? false,
      boardId,
      board.kanji.length
    )
    setProgress(newProgress)

    if (newProgress.progressPercentage === 100 && newProgress.completedAt) {
      showToast(`${t('congratulations')}: ${t('moodboards.boardCompleted')}`, 'success')
    }
  }

  const learnedSet = useMemo(
    () => new Set(progress?.learnedKanji || []),
    [progress]
  )

  const isKanjiLearned = useCallback(
    (kanjiChar: string) => learnedSet.has(kanjiChar),
    [learnedSet]
  )

  const handleStudyMode = () => {
    setViewMode('study')
    // Start with first unlearned kanji
    const firstUnlearnedIndex = board?.kanji.findIndex(k => !isKanjiLearned(k.char)) ?? 0
    setCurrentCardIndex(firstUnlearnedIndex === -1 ? 0 : firstUnlearnedIndex)
  }

  const handleNextCard = () => {
    if (!board) return
    setCurrentCardIndex(prev => (prev + 1) % board.kanji.length)
  }

  const handlePreviousCard = () => {
    if (!board) return
    setCurrentCardIndex(prev => (prev - 1 + board.kanji.length) % board.kanji.length)
  }

  // Transform moodboard kanji to standard Kanji interface
  // Merge with enriched local data for readings, examples, etc.
  // NOTE: This must be before the early return to maintain hook order
  const transformedKanji: Kanji[] = useMemo(() => {
    if (!board) return []
    return board.kanji.map(k => {
      // Get enriched data from local kanji database if available
      const enriched = enrichedKanjiMap.get(k.char)

      // Prefer enriched data for readings and examples, fallback to moodboard data
      return {
        kanji: k.char,
        meaning: k.meaning,
        meanings: enriched?.meanings || [k.meaning],
        onyomi: enriched?.onyomi || k.onyomi || k.readings?.on || [],
        kunyomi: enriched?.kunyomi || k.kunyomi || k.readings?.kun || [],
        strokeCount: enriched?.strokeCount || k.strokeCount || 0,
        jlpt: (k.jlpt || board?.jlpt || 'N5') as import('@/types/kanji').JLPTLevel,
        grade: enriched?.grade,
        frequency: enriched?.frequency,
        examples:
          enriched?.examples ||
          k.examples?.map(ex => ({
            word: typeof ex === 'string' ? ex : ex.sentence,
            reading: '',
            meaning: typeof ex === 'string' ? '' : ex.translation || '',
          })) ||
          [],
      }
    })
  }, [board, enrichedKanjiMap])

  // Filter kanji based on show completed setting
  const displayKanji = useMemo(() => {
    if (!board) return []
    return showCompleted
      ? transformedKanji
      : transformedKanji.filter(k => !isKanjiLearned(k.kanji))
  }, [board, showCompleted, transformedKanji, boardId])

  if (loading || !board || !entitlementChecked) {
    return <LoadingOverlay />
  }

  const learnedCount = progress?.learnedKanji.length || 0
  const totalCount = board.kanji.length
  const progressPercentage = progress?.progressPercentage || 0
  const isCompleted = progressPercentage === 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-background to-background-dark dark:from-dark-900 dark:via-dark-850 dark:to-dark-900">
      {/* Top Navigation */}
      <Navbar user={user} showUserMenu={true} />

      {/* Learning Page Header */}
      <LearningPageHeader
        title={`${board.emoji} ${board.title}`}
        description={board.description}
        stats={{
          total: totalCount,
          learned: learnedCount,
        }}
        backHref="/kanji-moods"
      />

      {/* Action Controls */}
      <div className="container mx-auto px-4 py-4 space-y-3">
        {/* View mode tabs */}
        <div className="flex gap-1 bg-white dark:bg-dark-700 rounded-lg p-1 w-fit">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 rounded-md text-sm transition-all ${
              viewMode === 'grid'
                ? 'bg-primary-500 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-600'
            }`}
          >
            {t('moodboards.viewModes.grid')}
          </button>
          <button
            onClick={handleStudyMode}
            className={`px-3 py-1.5 rounded-md text-sm transition-all ${
              viewMode === 'study'
                ? 'bg-primary-500 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-600'
            }`}
          >
            {t('moodboards.viewModes.study')}
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-md text-sm transition-all ${
              viewMode === 'list'
                ? 'bg-primary-500 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-600'
            }`}
          >
            {t('moodboards.viewModes.list')}
          </button>
        </div>

        {/* Show completed toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={e => setShowCompleted(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
          />
          <span className="text-sm">{t('moodboards.showCompleted')}</span>
        </label>
      </div>

      {/* Content area */}
      <div className="container mx-auto px-4 py-8">
        {viewMode === 'grid' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {displayKanji.map(kanji => {
              const isLearned = isKanjiLearned(kanji.kanji)
              return (
                <div
                  key={kanji.kanji}
                  onClick={() => setSelectedKanji(kanji)}
                  className={`
                    relative p-6 bg-white dark:bg-dark-800 rounded-lg shadow-md
                    hover:shadow-xl transition-all cursor-pointer
                    ${isLearned ? 'ring-2 ring-green-500 bg-green-50 dark:bg-green-900/20' : ''}
                  `}
                >
                  {/* Learned indicator */}
                  {isLearned && (
                    <div className="absolute top-2 right-2">
                      <svg
                        className="w-5 h-5 text-green-600 dark:text-green-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}

                  {/* Kanji character */}
                  <div className="text-4xl font-bold text-center mb-3 font-japanese">
                    {kanji.kanji}
                  </div>

                  {/* Meaning */}
                  <div className="text-sm text-center text-gray-600 dark:text-gray-400">
                    {kanji.meaning}
                  </div>

                  {/* JLPT Level */}
                  <div className="text-xs text-center mt-2 text-gray-500 dark:text-gray-500">
                    {kanji.jlpt}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {viewMode === 'study' && displayKanji.length > 0 && (
          <div className="min-h-[calc(100vh-400px)] flex flex-col items-center justify-center p-4 relative">
            {/* Exit Button - Top Right */}
            <button
              onClick={() => setViewMode('grid')}
              className="absolute top-4 right-4 p-3 rounded-xl bg-gray-100 dark:bg-dark-700
                       hover:bg-gray-200 dark:hover:bg-dark-600
                       text-gray-600 dark:text-gray-400
                       transition-all transform hover:scale-105 active:scale-95 z-10"
              title="Exit Study"
            >
              <IoClose className="w-6 h-6" />
            </button>

            {/* Progress Indicator */}
            <div className="w-full max-w-2xl mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {currentCardIndex + 1} / {displayKanji.length}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {isKanjiLearned(displayKanji[currentCardIndex].kanji) ? 'Learned' : 'Not Started'}
                </span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all duration-300"
                  style={{ width: `${((currentCardIndex + 1) / displayKanji.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Main Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="relative"
            >
              <div
                className="relative w-80 h-80 md:w-96 md:h-96 cursor-pointer"
                onClick={() => setIsFlipped(!isFlipped)}
              >
                <AnimatePresence mode="wait">
                  {!isFlipped ? (
                    <motion.div
                      key="front"
                      initial={{ rotateY: 0 }}
                      animate={{ rotateY: 0 }}
                      exit={{ rotateY: 90 }}
                      transition={{ duration: 0.3 }}
                      className="absolute inset-0 bg-white dark:bg-dark-800 rounded-2xl shadow-2xl
                               border-2 border-gray-200 dark:border-dark-600
                               flex flex-col items-center justify-center p-8
                               hover:scale-[1.02] transition-transform duration-200"
                    >
                      {/* Kanji Display */}
                      <div className="text-8xl font-bold text-gray-800 dark:text-gray-200 mb-4"
                           style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}>
                        {displayKanji[currentCardIndex].kanji}
                      </div>

                      <p className="absolute bottom-4 text-xs text-gray-400 dark:text-gray-600">
                        Tap to flip
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="back"
                      initial={{ rotateY: -90 }}
                      animate={{ rotateY: 0 }}
                      exit={{ rotateY: 90 }}
                      transition={{ duration: 0.3 }}
                      className="absolute inset-0 bg-gradient-to-br from-primary-50 to-primary-100
                               dark:bg-gradient-to-br dark:from-surface-dark dark:to-background-darkElevated
                               rounded-2xl shadow-2xl border-2 border-primary-200 dark:border-primary-400
                               p-8 overflow-y-auto scrollbar-hide"
                      style={{
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none'
                      }}
                    >
                      {/* Kanji in top-right corner */}
                      <div className="absolute top-6 right-6 text-5xl font-bold text-gray-800 dark:text-gray-200"
                           style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}>
                        {displayKanji[currentCardIndex].kanji}
                      </div>

                      {/* Content */}
                      <div className="space-y-6">
                        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">
                          Information:
                        </h3>

                        {/* Meaning pill */}
                        <div className="space-y-2">
                          <div className="text-sm text-gray-600 dark:text-gray-300">Meaning</div>
                          <div className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800
                                       border border-slate-200 dark:border-slate-600">
                            <span className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                              {displayKanji[currentCardIndex].meaning}
                            </span>
                          </div>
                        </div>

                        {/* Onyomi pill */}
                        {displayKanji[currentCardIndex].onyomi && displayKanji[currentCardIndex].onyomi.length > 0 && displayKanji[currentCardIndex].onyomi[0] !== '' && (
                          <div className="space-y-2">
                            <div className="text-sm text-gray-600 dark:text-gray-300">On'yomi</div>
                            <div className="w-full px-4 py-3 rounded-xl bg-sky-50 dark:bg-sky-900/30
                                         border border-sky-200 dark:border-sky-800">
                              <div className="flex flex-wrap gap-2 justify-center items-center">
                                {displayKanji[currentCardIndex].onyomi.filter(r => r).map((reading, idx) => (
                                  <span key={idx} className="text-lg font-semibold text-sky-800 dark:text-sky-200">
                                    {reading}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Kunyomi pill */}
                        {displayKanji[currentCardIndex].kunyomi && displayKanji[currentCardIndex].kunyomi.length > 0 && displayKanji[currentCardIndex].kunyomi[0] !== '' && (
                          <div className="space-y-2">
                            <div className="text-sm text-gray-600 dark:text-gray-300">Kun'yomi</div>
                            <div className="w-full px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/30
                                         border border-emerald-200 dark:border-emerald-800">
                              <div className="flex flex-wrap gap-2 justify-center items-center">
                                {displayKanji[currentCardIndex].kunyomi.filter(r => r).map((reading, idx) => (
                                  <span key={idx} className="text-lg font-semibold text-emerald-800 dark:text-emerald-200">
                                    {reading}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* Action Buttons - Icon only */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedKanji(displayKanji[currentCardIndex])
                }}
                className="p-4 rounded-xl bg-purple-100 dark:bg-purple-900/30
                         hover:bg-purple-200 dark:hover:bg-purple-900/40
                         border border-purple-200 dark:border-purple-800
                         text-purple-700 dark:text-purple-400
                         transition-all transform hover:scale-105 active:scale-95"
                title="Details"
              >
                <IoInformationCircle className="w-6 h-6" />
              </button>

              <button
                onClick={() => {
                  handleToggleKanji(displayKanji[currentCardIndex].kanji)
                  setTimeout(handleNextCard, 500)
                }}
                className={`p-4 rounded-xl transition-all shadow-lg transform hover:scale-105 active:scale-95 ${
                  isKanjiLearned(displayKanji[currentCardIndex].kanji)
                    ? 'bg-green-500 text-white shadow-green-500/30'
                    : 'bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-900/40 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400'
                }`}
                title={isKanjiLearned(displayKanji[currentCardIndex].kanji) ? 'Learned' : 'Mark as Learned'}
              >
                <IoCheckmarkCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Navigation */}
            {displayKanji.length > 1 && (
              <div className="flex items-center justify-center gap-4 w-full max-w-2xl mt-8">
                <button
                  onClick={handlePreviousCard}
                  className="p-3 rounded-xl bg-gray-100 dark:bg-dark-700
                           hover:bg-gray-200 dark:hover:bg-dark-600
                           transition-all transform hover:scale-105 active:scale-95"
                  title="Previous"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <button
                  onClick={handleNextCard}
                  className="p-3 rounded-xl bg-gray-100 dark:bg-dark-700
                           hover:bg-gray-200 dark:hover:bg-dark-600
                           transition-all transform hover:scale-105 active:scale-95"
                  title="Next"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}

        {viewMode === 'list' && (
          <div className="max-w-4xl mx-auto space-y-2">
            {displayKanji.map(kanji => (
              <div
                key={kanji.kanji}
                className="flex items-center gap-4 p-4 bg-white dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-dark-700 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedKanji(kanji)}
              >
                <button
                  onClick={e => {
                    e.stopPropagation()
                    handleToggleKanji(kanji.kanji)
                  }}
                  className={`p-2 rounded-full transition-colors ${
                    isKanjiLearned(kanji.kanji)
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                      : 'bg-gray-100 dark:bg-dark-700 text-gray-400 dark:text-dark-400'
                  }`}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                <div className="text-3xl font-bold font-japanese">{kanji.kanji}</div>

                <div className="flex-1">
                  <p className="font-medium">{kanji.meaning}</p>
                  <div className="flex gap-4 text-sm text-muted-foreground dark:text-dark-400">
                    {kanji.onyomi.length > 0 && <span>On: {kanji.onyomi.join('、')}</span>}
                    {kanji.kunyomi.length > 0 && <span>Kun: {kanji.kunyomi.join('、')}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {displayKanji.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-xl font-semibold">{t('moodboards.allLearned')}</h3>
            <p className="text-muted-foreground dark:text-dark-400 mt-2">
              {t('moodboards.toggleShowCompleted')}
            </p>
          </div>
        )}

        <MobileNavSpacer />
      </div>

      {/* Kanji Details Modal */}
      {selectedKanji && (
        <KanjiDetailsModal
          kanji={selectedKanji}
          isOpen={!!selectedKanji}
          onClose={() => setSelectedKanji(null)}
        />
      )}
    </div>
  )
}
