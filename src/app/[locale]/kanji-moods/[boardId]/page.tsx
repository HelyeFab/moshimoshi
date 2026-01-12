'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useMoodBoards } from '@/hooks/useMoodBoards'
import { MoodBoard as MoodBoardType } from '@/types/moodboard'
import { getBoardProgress, toggleKanjiLearned, isKanjiLearned } from '@/utils/moodBoardProgress'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import Navbar from '@/components/layout/Navbar'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'
import LearningPageHeader from '@/components/learn/LearningPageHeader'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import KanjiDetailsModal from '@/components/kanji/KanjiDetailsModal'
import { Kanji } from '@/types/kanji'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { kanjiService } from '@/services/kanjiService'
import { useFeature } from '@/hooks/useFeature'

export default function MoodBoardDetailPage() {
  const router = useRouter()
  const params = useParams()
  const boardId = params.boardId as string

  const { t } = useI18n()
  const { showToast } = useToast()
  const { user } = useAuth()
  const { moodBoards, loading } = useMoodBoards()
  const { checkAndTrack } = useFeature('kanji_mood_board')

  const [board, setBoard] = useState<MoodBoardType | null>(null)
  const [progress, setProgress] = useState(getBoardProgress(boardId))
  const [viewMode, setViewMode] = useState<'grid' | 'study' | 'list'>('grid')
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [showCompleted, setShowCompleted] = useState(true)
  const [selectedKanji, setSelectedKanji] = useState<Kanji | null>(null)
  const [enrichedKanjiMap, setEnrichedKanjiMap] = useState<Map<string, Kanji>>(new Map())
  const [entitlementChecked, setEntitlementChecked] = useState(false)

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
      const allowed = await checkAndTrack({ showUI: true })
      setEntitlementChecked(true)
      if (!allowed) {
        router.push('/kanji-moods')
      }
    }

    checkAccess()
  }, [boardId, checkAndTrack, router])

  // Update progress when board changes
  useEffect(() => {
    setProgress(getBoardProgress(boardId))
  }, [boardId])

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

  const handleToggleKanji = (kanjiChar: string) => {
    if (!board) return
    const newProgress = toggleKanjiLearned(boardId, kanjiChar, board.kanji.length)
    setProgress(newProgress)

    // Show toast on completion
    if (newProgress.progressPercentage === 100 && newProgress.completedAt) {
      showToast(`${t('congratulations')}: ${t('moodboards.boardCompleted')}`, 'success')
    }
  }

  const handleStudyMode = () => {
    setViewMode('study')
    // Start with first unlearned kanji
    const firstUnlearnedIndex = board?.kanji.findIndex(k => !isKanjiLearned(boardId, k.char)) ?? 0
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
      : transformedKanji.filter(k => !isKanjiLearned(boardId, k.kanji))
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
              const isLearned = isKanjiLearned(boardId, kanji.kanji)
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
          <div className="max-w-lg mx-auto">
            <div className="mb-4 text-center">
              <span className="text-sm text-muted-foreground dark:text-dark-400">
                {t('common.card')} {currentCardIndex + 1} / {displayKanji.length}
              </span>
            </div>

            {/* Study Card */}
            <div
              className="bg-white dark:bg-dark-800 rounded-lg shadow-xl p-8 cursor-pointer"
              onClick={() => setSelectedKanji(displayKanji[currentCardIndex])}
            >
              <div className="text-6xl font-bold text-center mb-4 font-japanese">
                {displayKanji[currentCardIndex].kanji}
              </div>
              <div className="text-xl text-center text-gray-700 dark:text-gray-300 mb-4">
                {displayKanji[currentCardIndex].meaning}
              </div>
              <div className="space-y-2">
                {displayKanji[currentCardIndex].onyomi.length > 0 && (
                  <div className="text-center">
                    <span className="text-sm text-gray-500">On: </span>
                    <span className="font-japanese">
                      {displayKanji[currentCardIndex].onyomi.join('、')}
                    </span>
                  </div>
                )}
                {displayKanji[currentCardIndex].kunyomi.length > 0 && (
                  <div className="text-center">
                    <span className="text-sm text-gray-500">Kun: </span>
                    <span className="font-japanese">
                      {displayKanji[currentCardIndex].kunyomi.join('、')}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={e => {
                  e.stopPropagation()
                  handleToggleKanji(displayKanji[currentCardIndex].kanji)
                }}
                className={`mt-4 w-full py-2 px-4 rounded-lg transition-colors ${
                  isKanjiLearned(boardId, displayKanji[currentCardIndex].kanji)
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-gray-200 dark:bg-dark-700 hover:bg-gray-300 dark:hover:bg-dark-600'
                }`}
              >
                {isKanjiLearned(boardId, displayKanji[currentCardIndex].kanji)
                  ? t('common.learned')
                  : t('common.markAsLearned')}
              </button>
            </div>

            <div className="flex justify-between items-center mt-6">
              <button
                onClick={handlePreviousCard}
                className="px-4 py-2 bg-gray-100 dark:bg-dark-700 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600"
              >
                {t('common.previous')}
              </button>

              <div className="flex gap-1">
                {board.kanji.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentCardIndex(index)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentCardIndex ? 'bg-primary-600' : 'bg-gray-300 dark:bg-dark-600'
                    }`}
                    aria-label={`Go to card ${index + 1}`}
                  />
                ))}
              </div>

              <button
                onClick={handleNextCard}
                className="px-4 py-2 bg-gray-100 dark:bg-dark-700 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600"
              >
                {t('common.next')}
              </button>
            </div>
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
                    isKanjiLearned(boardId, kanji.kanji)
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
      </div>

      {/* Kanji Details Modal */}
      {selectedKanji && (
        <KanjiDetailsModal
          kanji={selectedKanji}
          isOpen={!!selectedKanji}
          onClose={() => setSelectedKanji(null)}
        />
      )}
      <MobileNavSpacer />
    </div>
  )
}
