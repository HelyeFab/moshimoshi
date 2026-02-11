'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '@/i18n/I18nContext'
import { useTTS } from '@/hooks/useTTS'
import {
  ChevronLeftIcon,
  SpeakerWaveIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { TextbookVocabProgressData } from '@/utils/textbookVocabularyProgressManager'
import { ValidationUtils } from '@/lib/review-engine/validation/validation-utils'
import { Select } from '@/components/ui/Select'
import KanjiDetailsModal from '@/components/kanji/KanjiDetailsModal'
import { kanjiService } from '@/services/kanjiService'
import type { Kanji } from '@/types/kanji'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { useFeature } from '@/hooks/useFeature'
import { hasSeenKanjiLookup } from '@/utils/kanjiLookupSeen'
import { useSubscription } from '@/hooks/useSubscription'

export interface VocabularyItem {
  id: string
  japanese: string
  reading: string
  meaning: string
  jlptLevel?: string
  partOfSpeech?: string[]
  examples?: Array<{
    japanese: string
    reading: string
    english: string
  }>
  lesson?: number
  chapter?: number
  textbook?: string
}

/**
 * Strip HTML tags from a string
 * Used to sanitize corrupted textbook data that contains HTML markup
 */
function stripHtmlTags(str: string): string {
  if (!str || typeof str !== 'string') return str
  // Remove HTML tags and decode common HTML entities
  return str
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/<br\s*\/?>/gi, '') // Remove <br> tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
    .replace(/&amp;/g, '&') // Decode &amp;
    .replace(/&lt;/g, '<') // Decode &lt;
    .replace(/&gt;/g, '>') // Decode &gt;
    .trim()
}

/**
 * Sanitize a vocabulary item by stripping HTML from text fields
 */
function sanitizeVocabularyItem(item: VocabularyItem): VocabularyItem {
  return {
    ...item,
    japanese: stripHtmlTags(item.japanese),
    reading: stripHtmlTags(item.reading),
    meaning: stripHtmlTags(item.meaning),
  }
}

interface VocabularyDisplayProps {
  textbookId: string
  onBack: () => void
  // Selection mode props
  selectionMode?: boolean
  selectedItems?: Set<string>
  onToggleSelection?: (id: string) => void
  // Progress tracking
  progressMap?: Map<string, TextbookVocabProgressData>
  // Expose vocabulary data to parent
  onVocabularyLoaded?: (vocabulary: VocabularyItem[]) => void
  onFilteredVocabularyChange?: (filtered: VocabularyItem[]) => void
  onLessonChange?: (lesson: number | 'all') => boolean | Promise<boolean>
  allowAllLessons?: boolean
}

export function VocabularyDisplay({
  textbookId,
  onBack,
  selectionMode = false,
  selectedItems = new Set(),
  onToggleSelection,
  progressMap = new Map(),
  onVocabularyLoaded,
  onFilteredVocabularyChange,
  onLessonChange,
  allowAllLessons = true,
}: VocabularyDisplayProps) {
  const { strings, t } = useI18n()
  const { showToast } = useToast()
  const { checkOnly: checkKanjiLookupOnly } = useFeature('kanji_lookup')
  const { isPremium } = useSubscription()
  const router = useRouter()
  const { play, isPlaying, preload } = useTTS({ cacheFirst: true })
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([])
  const [filteredVocab, setFilteredVocab] = useState<VocabularyItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedLesson, setSelectedLesson] = useState<number | 'all'>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'cards'>('grid')
  const [selectedWord, setSelectedWord] = useState<VocabularyItem | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedKanji, setSelectedKanji] = useState<Kanji | null>(null)
  const [kanjiModalOpen, setKanjiModalOpen] = useState(false)

  // Load vocabulary data
  useEffect(() => {
    const loadVocabulary = async () => {
      setIsLoading(true)
      try {
        // Dynamic import based on textbook ID
        const module = await import(`@/data/textbooks/${textbookId}/all.json`)
        const rawData = module.default || []
        // Sanitize data to remove any HTML tags from corrupted entries
        const vocabData = rawData.map(sanitizeVocabularyItem)
        setVocabulary(vocabData)
        onVocabularyLoaded?.(vocabData)
      } catch (error) {
        console.error('Failed to load textbook data:', error)
        setVocabulary([])
        onVocabularyLoaded?.([])
      } finally {
        setIsLoading(false)
      }
    }

    loadVocabulary()
  }, [textbookId, onVocabularyLoaded])

  // Filter vocabulary based on lesson and search
  useEffect(() => {
    let filtered = vocabulary

    if (!allowAllLessons && selectedLesson === 'all') {
      filtered = []
    }

    // Filter by lesson
    if (selectedLesson !== 'all') {
      filtered = filtered.filter(item => item.lesson === selectedLesson)
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.trim().toLowerCase()
      if (query) {
        const hasRomaji = /[a-z]/i.test(query)
        const romajiToHiragana = hasRomaji ? ValidationUtils.romajiToHiragana(query) : ''
        const romajiToKatakana = hasRomaji ? ValidationUtils.romajiToKatakana(query) : ''

        filtered = filtered.filter(item => {
          const japanese = item.japanese || ''
          const reading = item.reading || ''
          const meaning = item.meaning || ''

          if (
            japanese.includes(query) ||
            reading.toLowerCase().includes(query) ||
            meaning.toLowerCase().includes(query)
          ) {
            return true
          }

          if (!hasRomaji) return false

          const japaneseHiragana = ValidationUtils.katakanaToHiragana(japanese)
          const readingHiragana = ValidationUtils.katakanaToHiragana(reading)

          return (
            japaneseHiragana.includes(romajiToHiragana) ||
            readingHiragana.includes(romajiToHiragana) ||
            japanese.includes(romajiToKatakana) ||
            reading.includes(romajiToKatakana)
          )
        })
      }
    }

    setFilteredVocab(filtered)
    onFilteredVocabularyChange?.(filtered)
  }, [vocabulary, selectedLesson, searchQuery, onFilteredVocabularyChange])

  // Preload audio for visible vocabulary items
  useEffect(() => {
    if (filteredVocab.length === 0) return

    // Preload first 20 visible items based on view mode
    const visibleCount = viewMode === 'grid' ? 20 : viewMode === 'list' ? 15 : 10
    const visibleItems = filteredVocab.slice(0, visibleCount)

    const textsToPreload: string[] = []
    visibleItems.forEach(item => {
      textsToPreload.push(item.japanese)
      if (item.reading && item.reading !== item.japanese) {
        textsToPreload.push(item.reading)
      }
    })

    // Preload in chunks of 10 to avoid overwhelming API
    const chunkSize = 10
    for (let i = 0; i < textsToPreload.length; i += chunkSize) {
      const chunk = textsToPreload.slice(i, i + chunkSize)
      const chunkIndex = i / chunkSize

      // Stagger requests by 1s to be gentle on the API
      setTimeout(() => {
        preload(chunk).catch(err => {
          console.warn('[VocabularyDisplay] Preload failed:', err)
        })
      }, chunkIndex * 1000)
    }
  }, [filteredVocab, viewMode, preload])

  // Handle lesson change
  const handleLessonChange = useCallback(async (lesson: number | 'all') => {
    const allowed = (await onLessonChange?.(lesson)) !== false
    if (!allowed) return
    setSelectedLesson(lesson)
  }, [onLessonChange])

  // Handle item click - either toggle selection or show details
  const handleItemClick = useCallback((item: VocabularyItem) => {
    if (selectionMode && onToggleSelection) {
      onToggleSelection(item.id)
    } else {
      setSelectedWord(item)
    }
  }, [selectionMode, onToggleSelection])

  // Check if item is selected
  const isItemSelected = useCallback((id: string) => {
    return selectedItems.has(id)
  }, [selectedItems])

  // Check if item is learned
  const isItemLearned = useCallback((id: string) => {
    const progress = progressMap.get(id)
    return progress?.status === 'learned' || progress?.status === 'mastered'
  }, [progressMap])

  // Get unique lessons
  const lessons = Array.from(new Set(vocabulary.map(item => item.lesson).filter(Boolean))).sort((a, b) => (a || 0) - (b || 0))

  const handlePlayAudio = async (text: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    await play(text)
  }

  const handleWordClick = (word: VocabularyItem) => {
    setSelectedWord(word)
  }

  const handleKanjiClick = useCallback(async (kanjiChar: string) => {
    if (!hasSeenKanjiLookup(kanjiChar)) {
      const decision = await checkKanjiLookupOnly({ failOpen: false })
      if (!decision.allow) {
        const upgradeAction = !isPremium
          ? {
              label: t('subscription.actions.upgrade'),
              onClick: () => router.push('/pricing'),
            }
          : undefined
        showToast(t('entitlements.messages.lookupLimitReached'), 'warning', 5000, upgradeAction)
        return
      }
    }
    try {
      const details = await kanjiService.getKanjiDetails(kanjiChar)
      if (details) {
        setSelectedKanji(details)
        setKanjiModalOpen(true)
      } else {
        console.warn(`[VocabularyDisplay] No kanji details found for: ${kanjiChar}`)
      }
    } catch (error) {
      console.error('[VocabularyDisplay] Error fetching kanji details:', error)
    }
  }, [checkKanjiLookupOnly, isPremium, router, showToast, t])

  const getKanjiChars = (text: string) => {
    const matches = text.match(/[\u4e00-\u9faf]/g)
    return matches ? [...new Set(matches)] : []
  }

  const isKanji = (char: string) => {
    if (!char || char.length === 0) return false
    const code = char.charCodeAt(0)
    return code >= 0x4e00 && code <= 0x9fff
  }

  if (isLoading) {
    return <LoadingOverlay />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
        >
          <ChevronLeftIcon className="h-5 w-5" />
          {strings.common?.back || 'Back'}
        </button>

        <div className="flex items-center gap-4">
          {/* View Mode Selector */}
          <div className="flex gap-2 bg-gray-100 dark:bg-dark-800 rounded-lg p-1">
            {(['grid', 'list', 'cards'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 rounded-md transition-colors ${viewMode === mode
                  ? 'bg-white dark:bg-dark-700 text-primary-600 dark:text-primary-400 shadow'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
              >
                {mode === 'grid' && '⚏'}
                {mode === 'list' && '☰'}
                {mode === 'cards' && '▢'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4">
        {/* Lesson Filter */}
        {lessons.length > 0 && (
          <Select
            value={String(selectedLesson)}
            onChange={(value) => handleLessonChange(value === 'all' ? 'all' : Number(value))}
            options={[
              ...(allowAllLessons ? [{ value: 'all', label: strings.common?.allLessons || 'All Lessons' }] : []),
              ...lessons.map(lesson => ({
                value: String(lesson),
                label: `${strings.common?.lesson || 'Lesson'} ${lesson}`
              }))
            ]}
            className="w-full md:w-auto md:min-w-[200px]"
          />
        )}

        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder={strings.common?.searchPlaceholder || 'Search romaji, kana, kanji, or meaning...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 py-2 pl-9 pr-10 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-dark-700"
                aria-label={strings.common?.clear || 'Clear search'}
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-white dark:bg-dark-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-dark-700">
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400">
            {strings.common?.showing || 'Showing'} {filteredVocab.length} {strings.common?.of || 'of'} {vocabulary.length} {strings.common?.words || 'words'}
          </span>
          <button
            onClick={() => setFilteredVocab([...filteredVocab].sort(() => Math.random() - 0.5))}
            className="flex items-center gap-2 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
          >
            <ArrowPathIcon className="h-4 w-4" />
            {strings.common?.shuffle || 'Shuffle'}
          </button>
        </div>
      </div>

      {/* Vocabulary Display */}
      <AnimatePresence mode="wait">
        {viewMode === 'grid' && (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
          >
            {filteredVocab.map((item, index) => {
              const selected = isItemSelected(item.id)
              const learned = isItemLearned(item.id)
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  onClick={() => handleItemClick(item)}
                  className={`relative bg-white dark:bg-dark-800 rounded-lg p-4 shadow hover:shadow-lg transition-all cursor-pointer group border-2 ${
                    selected
                      ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-primary-800'
                      : learned
                        ? 'border-green-500 dark:border-green-600'
                        : 'border-gray-200 dark:border-dark-700'
                  }`}
                >
                  {/* Selection indicator */}
                  {selectionMode && selected && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg">
                      📌
                    </div>
                  )}
                  {/* Learned indicator */}
                  {learned && !selectionMode && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg">
                      ✓
                    </div>
                  )}
                  {/* JLPT Level badge */}
                  {item.jlptLevel && (
                    <span className="absolute top-2 right-2 px-1.5 py-0.5 text-[10px] bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded">
                      {item.jlptLevel}
                    </span>
                  )}
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      {item.japanese}
                    </h3>
                    <button
                      onClick={(e) => handlePlayAudio(item.japanese, e)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-100 dark:hover:bg-dark-700"
                      disabled={isPlaying}
                    >
                      <SpeakerWaveIcon className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    {item.reading}
                  </p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {item.meaning}
                  </p>
                </motion.div>
              )
            })}
          </motion.div>
        )}

        {viewMode === 'list' && (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-white dark:bg-dark-800 rounded-lg shadow overflow-hidden border border-gray-200 dark:border-dark-700"
          >
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-dark-700">
                <tr>
                  {selectionMode && (
                    <th className="px-4 py-3 w-10"></th>
                  )}
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {strings.common?.japanese || 'Japanese'}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {strings.common?.reading || 'Reading'}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {strings.common?.meaning || 'Meaning'}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {strings.common?.level || 'Level'}
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                {filteredVocab.map(item => {
                  const selected = isItemSelected(item.id)
                  const learned = isItemLearned(item.id)
                  return (
                    <tr
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className={`cursor-pointer transition-colors ${
                        selected
                          ? 'bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30'
                          : learned
                            ? 'bg-green-50 dark:bg-green-900/10 hover:bg-green-100 dark:hover:bg-green-900/20'
                            : 'hover:bg-gray-50 dark:hover:bg-dark-700'
                      }`}
                    >
                      {selectionMode && (
                        <td className="px-4 py-3 text-center">
                          {selected ? '📌' : learned ? '✓' : '○'}
                        </td>
                      )}
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {item.japanese}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {item.reading}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {item.meaning}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {item.jlptLevel && (
                          <span className="px-2 py-1 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded">
                            {item.jlptLevel}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => handlePlayAudio(item.japanese, e)}
                          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-dark-700"
                          disabled={isPlaying}
                        >
                          <SpeakerWaveIcon className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </motion.div>
        )}

        {viewMode === 'cards' && (
          <motion.div
            key="cards"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {filteredVocab.map((item, index) => {
              const selected = isItemSelected(item.id)
              const learned = isItemLearned(item.id)
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleItemClick(item)}
                  className={`relative bg-white dark:bg-dark-800 rounded-lg p-6 shadow hover:shadow-lg transition-all cursor-pointer border-2 ${
                    selected
                      ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-primary-800'
                      : learned
                        ? 'border-green-500 dark:border-green-600'
                        : 'border-gray-200 dark:border-dark-700'
                  }`}
                >
                  {/* Selection/Learned indicator */}
                  {(selectionMode && selected) || learned ? (
                    <div className={`absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg ${
                      selected ? 'bg-primary-500' : 'bg-green-500'
                    }`}>
                      {selected ? '📌' : '✓'}
                    </div>
                  ) : null}
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                        {item.japanese}
                      </h3>
                      <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
                        {item.reading}
                      </p>
                      <p className="text-base font-medium text-gray-900 dark:text-gray-100 mb-4">
                        {item.meaning}
                      </p>
                      {item.examples && item.examples.length > 0 && (
                        <div className="border-t border-gray-200 dark:border-dark-700 pt-4">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                            {strings.common?.examples || 'Examples'}:
                          </p>
                          {item.examples.slice(0, 2).map((ex, i) => (
                            <div key={i} className="mb-2">
                              <p className="text-sm text-gray-900 dark:text-gray-100">{ex.japanese}</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">{ex.english}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <button
                        onClick={(e) => handlePlayAudio(item.japanese, e)}
                        className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30 hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors"
                        disabled={isPlaying}
                      >
                        <SpeakerWaveIcon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                      </button>
                      {item.jlptLevel && (
                        <span className="px-2 py-1 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded">
                          {item.jlptLevel}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Word Detail Modal */}
      <AnimatePresence>
        {selectedWord && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedWord(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-dark-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-gray-200 dark:border-dark-700"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {selectedWord.japanese}
                </h2>
                <button
                  onClick={() => handlePlayAudio(selectedWord.japanese)}
                  className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30 hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors"
                  disabled={isPlaying}
                >
                  <SpeakerWaveIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                </button>
              </div>

              <p className="text-xl text-gray-600 dark:text-gray-400 mb-2">
                {selectedWord.reading}
              </p>
              <p className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-4">
                {selectedWord.meaning}
              </p>

              {selectedWord.partOfSpeech && selectedWord.partOfSpeech.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    {strings.common?.partOfSpeech || 'Part of Speech'}:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedWord.partOfSpeech.map((pos, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 text-xs bg-gray-100 dark:bg-dark-700 text-gray-900 dark:text-gray-100 rounded"
                      >
                        {pos}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedWord.examples && selectedWord.examples.length > 0 && (
                <div className="border-t border-gray-200 dark:border-dark-700 pt-4">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {strings.common?.examples || 'Examples'}:
                  </p>
                  {selectedWord.examples.map((ex, i) => (
                    <div key={i} className="mb-3">
                      <p className="text-base text-gray-900 dark:text-gray-100">{ex.japanese}</p>
                      {ex.reading && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">{ex.reading}</p>
                      )}
                      <p className="text-sm text-gray-600 dark:text-gray-400">{ex.english}</p>
                    </div>
                  ))}
                </div>
              )}

              {selectedWord.japanese && getKanjiChars(selectedWord.japanese).length > 0 && (
                <div className="border-t border-gray-200 dark:border-dark-700 pt-4">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Kanji Breakdown
                  </p>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-3 italic">
                    Tap a kanji to see stroke order and writing practice
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {getKanjiChars(selectedWord.japanese).map((kanjiChar) => {
                      const clickable = isKanji(kanjiChar)
                      return clickable ? (
                        <button
                          key={kanjiChar}
                          onClick={() => handleKanjiClick(kanjiChar)}
                          className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-dark-700 bg-gray-50 dark:bg-dark-700/40 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
                          title={`Open details for ${kanjiChar}`}
                        >
                          <span className="text-lg">{kanjiChar}</span>
                        </button>
                      ) : (
                        <div
                          key={kanjiChar}
                          className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-dark-700 bg-gray-50 dark:bg-dark-700/30 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 opacity-70"
                        >
                          <span className="text-lg">{kanjiChar}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setSelectedWord(null)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                >
                  {strings.common?.close || 'Close'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <KanjiDetailsModal
        kanji={selectedKanji}
        isOpen={kanjiModalOpen}
        onClose={() => setKanjiModalOpen(false)}
      />
    </div>
  )
}
