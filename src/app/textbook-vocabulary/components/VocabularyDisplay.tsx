'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '@/i18n/I18nContext'
import { useTTS } from '@/hooks/useTTS'
import { ChevronLeftIcon, SpeakerWaveIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'

interface VocabularyItem {
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
  textbook?: string
}

interface VocabularyDisplayProps {
  textbookId: string
  onBack: () => void
}

export function VocabularyDisplay({ textbookId, onBack }: VocabularyDisplayProps) {
  const { strings } = useI18n()
  const { play, isPlaying } = useTTS()
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([])
  const [filteredVocab, setFilteredVocab] = useState<VocabularyItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedLesson, setSelectedLesson] = useState<number | 'all'>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'cards'>('grid')
  const [selectedWord, setSelectedWord] = useState<VocabularyItem | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Load vocabulary data
  useEffect(() => {
    const loadVocabulary = async () => {
      setIsLoading(true)
      try {
        // Dynamic import based on textbook ID
        const module = await import(`@/data/textbooks/${textbookId}/all.json`)
        setVocabulary(module.default || [])
      } catch (error) {
        console.error('Failed to load textbook data:', error)
        setVocabulary([])
      } finally {
        setIsLoading(false)
      }
    }

    loadVocabulary()
  }, [textbookId])

  // Filter vocabulary based on lesson and search
  useEffect(() => {
    let filtered = vocabulary

    // Filter by lesson
    if (selectedLesson !== 'all') {
      filtered = filtered.filter(item => item.lesson === selectedLesson)
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(item =>
        item.japanese.includes(query) ||
        item.reading.toLowerCase().includes(query) ||
        item.meaning.toLowerCase().includes(query)
      )
    }

    setFilteredVocab(filtered)
  }, [vocabulary, selectedLesson, searchQuery])

  // Get unique lessons
  const lessons = Array.from(new Set(vocabulary.map(item => item.lesson).filter(Boolean))).sort((a, b) => (a || 0) - (b || 0))

  const handlePlayAudio = async (text: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    await play(text, { voice: 'ja-JP' })
  }

  const handleWordClick = (word: VocabularyItem) => {
    setSelectedWord(word)
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
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="flex-1">
          <input
            type="text"
            placeholder={strings.common?.searchPlaceholder || 'Search vocabulary...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Lesson Filter */}
        {lessons.length > 0 && (
          <select
            value={selectedLesson}
            onChange={(e) => setSelectedLesson(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">{strings.common?.allLessons || 'All Lessons'}</option>
            {lessons.map(lesson => (
              <option key={lesson} value={lesson}>
                {strings.common?.lesson || 'Lesson'} {lesson}
              </option>
            ))}
          </select>
        )}
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
            {filteredVocab.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                onClick={() => handleWordClick(item)}
                className="bg-white dark:bg-dark-800 rounded-lg p-4 shadow hover:shadow-lg transition-shadow cursor-pointer group border border-gray-200 dark:border-dark-700"
              >
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
                {item.jlptLevel && (
                  <span className="inline-block mt-2 px-2 py-1 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded">
                    {item.jlptLevel}
                  </span>
                )}
              </motion.div>
            ))}
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
                {filteredVocab.map(item => (
                  <tr
                    key={item.id}
                    onClick={() => handleWordClick(item)}
                    className="hover:bg-gray-50 dark:hover:bg-dark-700 cursor-pointer"
                  >
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
                ))}
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
            {filteredVocab.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleWordClick(item)}
                className="bg-white dark:bg-dark-800 rounded-lg p-6 shadow hover:shadow-lg transition-shadow cursor-pointer border border-gray-200 dark:border-dark-700"
              >
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
            ))}
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
    </div>
  )
}