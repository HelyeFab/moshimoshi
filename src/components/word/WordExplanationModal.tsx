/**
 * Word Explanation Modal
 * AI-powered word lookup with Tatoeba examples and translation context
 */

'use client'

import React, { useState, useCallback, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import type { WordExplanation } from '@/lib/ai/types'
import { useTTS } from '@/hooks/useTTS'
import { TranslationResult } from '@/lib/ai/processors/TranslationProcessor'
import { useContentTranslation } from '@/hooks/useContentTranslation'
import {
  SpeakerWaveIcon,
  GlobeAsiaAustraliaIcon,
  AcademicCapIcon,
  LightBulbIcon,
  ExclamationCircleIcon,
  BookmarkIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'
import { searchTatoebaExamples, type ExampleSentence } from '@/utils/tatoebaSearch'
import AddToListButton from '@/components/lists/AddToListButton'
import CompactConjugationTable from '@/components/conjugation/CompactConjugationTable'
import KanjiDetailsModal from '@/components/kanji/KanjiDetailsModal'
import { kanjiService } from '@/services/kanjiService'
import type { Kanji } from '@/types/kanji'

// ============================================
// Modal Props
// ============================================

export interface WordExplanationModalProps {
  isOpen: boolean
  onClose: () => void
  word: string | null
  explanation: WordExplanation | null
  loading: boolean
  error: string | null

  // Translation integration
  translationContext?: {
    sentence?: string
    translationResult?: TranslationResult
    userLevel?: 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
  }

  // Vocabulary integration
  onAddToVocabulary?: (word: string, translation: string) => void
  onWordLookup?: (word: string) => void

  // Enhanced features
  showTranslationContext?: boolean
  enableRelatedTranslations?: boolean

  // TTS voice consistency
  ttsVoice?: string  // Voice ID for VOICEVOX (default: '23' - energetic female)
}

// ============================================
// Word Explanation Modal Component
// ============================================

export default function WordExplanationModal({
  isOpen,
  onClose,
  word,
  explanation,
  loading,
  error,
  translationContext,
  onAddToVocabulary,
  onWordLookup,
  showTranslationContext = true,
  enableRelatedTranslations = true,
  ttsVoice = '23',  // Default to voice 23 (energetic female)
}: WordExplanationModalProps) {
  // ============================================
  // State and Hooks
  // ============================================

  const [activeTab, setActiveTab] = useState<'explanation' | 'conjugation' | 'context' | 'related'>('explanation')
  const [relatedTranslations, setRelatedTranslations] = useState<TranslationResult | null>(null)
  const [tatoebaExamples, setTatoebaExamples] = useState<ExampleSentence[]>([])
  const [loadingTatoeba, setLoadingTatoeba] = useState(false)
  const [selectedKanji, setSelectedKanji] = useState<Kanji | null>(null)
  const [kanjiModalOpen, setKanjiModalOpen] = useState(false)

  const { play, preload, playing, currentText } = useTTS()
  const {
    translateText,
    isLoading: translationLoading,
    error: translationError,
    addToVocabulary,
  } = useContentTranslation({
    mode: 'learning',
    userLevel: translationContext?.userLevel || 'N5',
  })

  // ============================================
  // Handlers
  // ============================================

  const handlePlayExample = useCallback(
    async (text: string) => {
      try {
        await play(text, { voice: ttsVoice })
      } catch (error) {
        console.error('TTS playback failed:', error)
      }
    },
    [play, ttsVoice]
  )

  const handlePlayWord = useCallback(async () => {
    if (explanation?.audioUrl) {
      try {
        const audio = new Audio(explanation.audioUrl)
        await audio.play()
        return
      } catch (err) {
        console.warn('Audio playback failed, falling back to TTS', err)
      }
    }
    if (explanation?.word) {
      await handlePlayExample(explanation.word)
    }
  }, [explanation?.audioUrl, explanation?.word, handlePlayExample])

  const handleRelatedWordClick = useCallback(
    (relatedWord: string) => {
      if (onWordLookup) {
        onWordLookup(relatedWord)
      }
    },
    [onWordLookup]
  )

  const handleTranslateSentence = useCallback(async () => {
    if (translationContext?.sentence) {
      const result = await translateText(translationContext.sentence, 'learning')
      if (result) {
        setRelatedTranslations(result)
        setActiveTab('related')
      }
    }
  }, [translationContext?.sentence, translateText])

  const handleKanjiClick = useCallback(async (kanjiChar: string) => {
    try {
      const details = await kanjiService.getKanjiDetails(kanjiChar)
      if (details) {
        setSelectedKanji(details)
        setKanjiModalOpen(true)
      } else {
        console.warn(`[WordExplanationModal] No kanji details found for: ${kanjiChar}`)
      }
    } catch (error) {
      console.error('[WordExplanationModal] Error fetching kanji details:', error)
    }
  }, [])

  // Helper to check if a character is actually kanji (not hiragana/katakana)
  const isKanji = useCallback((char: string): boolean => {
    if (!char || char.length === 0) return false
    const code = char.charCodeAt(0)
    // CJK Unified Ideographs: U+4E00 to U+9FFF
    return code >= 0x4e00 && code <= 0x9fff
  }, [])

  // ============================================
  // Effects
  // ============================================

  useEffect(() => {
    // Reset state when modal opens with new word
    if (isOpen && word) {
      setActiveTab('explanation')
      setRelatedTranslations(null)
      setTatoebaExamples([])

      // Load Tatoeba examples
      const loadTatoebaExamples = async () => {
        setLoadingTatoeba(true)
        try {
          const examples = await searchTatoebaExamples(word, 5)
          setTatoebaExamples(examples)
        } catch (error) {
          console.error('Failed to load Tatoeba examples:', error)
          setTatoebaExamples([])
        } finally {
          setLoadingTatoeba(false)
        }
      }

      loadTatoebaExamples()
    }
  }, [isOpen, word])

  useEffect(() => {
    if (!isOpen || tatoebaExamples.length === 0) return
    const texts = tatoebaExamples
      .map(example => example.japanese)
      .filter(Boolean)
      .slice(0, 5)
    if (texts.length > 0) {
      preload(texts, { voice: ttsVoice, speed: 0.85 })
    }
  }, [isOpen, tatoebaExamples, preload, ttsVoice])

  // ============================================
  // Render Helpers
  // ============================================

  // Check if word is potentially conjugatable (verb or adjective)
  const isConjugatable = explanation?.partOfSpeech?.toLowerCase().match(
    /verb|ichidan|godan|suru|する|adjective|形容詞|形容動詞|adj/
  )

  const renderTabButtons = () => {
    const tabs = [
      { id: 'explanation', label: 'Word Details', icon: BookmarkIcon },
      ...(isConjugatable
        ? [{ id: 'conjugation' as const, label: 'Conjugations', icon: TableCellsIcon }]
        : []),
      ...(showTranslationContext && translationContext
        ? [{ id: 'context' as const, label: 'Context', icon: GlobeAsiaAustraliaIcon }]
        : []),
      ...(enableRelatedTranslations
        ? [{ id: 'related' as const, label: 'Related', icon: AcademicCapIcon }]
        : []),
    ]

    return (
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'explanation' | 'conjugation' | 'context' | 'related')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>
    )
  }

  const renderTranslationContext = () => {
    if (!translationContext) return null

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        {/* Original Sentence */}
        {translationContext.sentence && (
          <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg p-5">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
              <LightBulbIcon className="w-5 h-5 mr-2 text-green-600 dark:text-green-400" />
              Context Sentence
            </h4>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <button
                  onClick={() => handlePlayExample(translationContext.sentence!)}
                  className="p-2 rounded-full hover:bg-white/50 dark:hover:bg-black/20 transition-colors"
                  title="Play sentence audio"
                >
                  <SpeakerWaveIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                </button>
                <div className="flex-1">
                  <p className="text-lg text-gray-900 dark:text-white mb-2">
                    {translationContext.sentence}
                  </p>
                  {translationContext.translationResult && (
                    <p className="text-gray-600 dark:text-gray-400">
                      {translationContext.translationResult.translatedText}
                    </p>
                  )}
                </div>
              </div>

              {/* Translate Sentence Button */}
              <button
                onClick={handleTranslateSentence}
                disabled={translationLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors disabled:opacity-50"
              >
                <GlobeAsiaAustraliaIcon className="w-4 h-4" />
                {translationLoading ? 'Analyzing...' : 'Analyze Full Context'}
              </button>

              {translationError && (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                  <ExclamationCircleIcon className="w-4 h-4" />
                  {translationError}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Word in Context */}
        {explanation && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Word Usage in This Context
            </h4>
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {explanation.word}
              </div>
              <div className="text-gray-600 dark:text-gray-400 mb-2">
                {explanation.reading} ({explanation.romaji})
              </div>
              <p className="text-gray-900 dark:text-white">{explanation.meaning}</p>

              {/* Context-specific meaning if available */}
              {translationContext.translationResult?.keyVocabulary &&
                (() => {
                  const contextWord = translationContext.translationResult.keyVocabulary.find(
                    v => v.word === word
                  )
                  return contextWord && contextWord.meaning !== explanation.meaning ? (
                    <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <div className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                        In this context:
                      </div>
                      <div className="text-yellow-700 dark:text-yellow-300">
                        {contextWord.meaning}
                      </div>
                    </div>
                  ) : null
                })()}
            </div>
          </div>
        )}
      </motion.div>
    )
  }

  const renderRelatedTranslations = () => {
    if (!relatedTranslations) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            No related translations loaded yet.
          </p>
          {translationContext?.sentence && (
            <button
              onClick={handleTranslateSentence}
              disabled={translationLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <GlobeAsiaAustraliaIcon className="w-4 h-4" />
              {translationLoading ? 'Loading...' : 'Analyze Context'}
            </button>
          )}
        </div>
      )
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        {/* Grammar Notes */}
        {relatedTranslations.grammarNotes && relatedTranslations.grammarNotes.length > 0 && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Grammar Context
            </h4>
            <div className="space-y-3">
              {relatedTranslations.grammarNotes.map((note, idx) => (
                <div key={idx} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                  <div className="font-medium text-gray-900 dark:text-white mb-1">
                    {note.pattern}
                  </div>
                  <div className="text-gray-600 dark:text-gray-400 text-sm">{note.explanation}</div>
                  {note.example && (
                    <div className="text-gray-500 dark:text-gray-500 text-sm italic mt-2">
                      Example: {note.example}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Related Vocabulary */}
        {relatedTranslations.keyVocabulary && relatedTranslations.keyVocabulary.length > 0 && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Related Vocabulary
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {relatedTranslations.keyVocabulary
                .filter(vocab => vocab.word !== word)
                .slice(0, 8)
                .map((vocab, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleRelatedWordClick(vocab.word)}
                    className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="font-medium text-gray-900 dark:text-white">{vocab.word}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {vocab.reading} - {vocab.meaning}
                    </div>
                    {vocab.jlptLevel && (
                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {vocab.jlptLevel} • {vocab.difficulty}
                      </div>
                    )}
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Learning Points */}
        {relatedTranslations.learningPoints && relatedTranslations.learningPoints.length > 0 && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Learning Points
            </h4>
            <ul className="space-y-2">
              {relatedTranslations.learningPoints.map((point, idx) => (
                <li key={idx} className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                  <span className="text-blue-500 mt-1">•</span>
                  <span className="text-sm">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </motion.div>
    )
  }

  const renderMainExplanation = () => {
    if (!explanation) return null

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        {/* Basic Info with Enhanced Actions */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-5">
          <div className="flex justify-between items-start mb-3">
            <div className="space-y-1">
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white">
                {explanation.word}
              </h3>
              <div className="text-lg text-gray-600 dark:text-gray-400">{explanation.reading}</div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{explanation.romaji}</p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 items-center">
              <button
                onClick={handlePlayWord}
                className="p-2 rounded-full hover:bg-white/50 dark:hover:bg-black/20 transition-colors"
                title="Play pronunciation"
              >
                <SpeakerWaveIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </button>
              <AddToListButton
                content={explanation.word}
                type={explanation.partOfSpeech?.toLowerCase().includes('verb') ||
                      explanation.partOfSpeech?.toLowerCase().includes('adjective')
                        ? 'verbAdj'
                        : 'word'}
                metadata={{
                  reading: explanation.reading,
                  meaning: explanation.meaning,
                  jlptLevel: explanation.jlptLevel ? parseInt(explanation.jlptLevel.replace('N', '')) : undefined,
                }}
                variant="icon"
              />
            </div>
          </div>

          <p className="text-lg text-gray-900 dark:text-white font-medium mb-3">
            {explanation.meaning}
          </p>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
              {explanation.partOfSpeech}
            </span>
            {explanation.jlptLevel && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
                {explanation.jlptLevel}
              </span>
            )}
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
              {explanation.formality}
            </span>
          </div>
        </div>

        {/* Rest of the original content */}
        {/* Kanji Breakdown */}
        {explanation.kanjiBreakdown && explanation.kanjiBreakdown.length > 0 && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <svg
                className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
              </svg>
              Kanji Breakdown
            </h4>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-3 italic">
              💡 Tap any kanji to see full details, stroke order, and practice writing
            </div>
            <div className="space-y-3">
              {explanation.kanjiBreakdown.map((kanji, idx) => {
                const isActualKanji = isKanji(kanji.kanji)

                // Render as button if it's kanji, otherwise as static div
                return isActualKanji ? (
                  <button
                    key={idx}
                    onClick={() => handleKanjiClick(kanji.kanji)}
                    className="w-full bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 border-2 border-transparent transition-all duration-200 cursor-pointer group"
                    title={`Click to see full details for ${kanji.kanji}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="text-4xl font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {kanji.kanji}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-base font-medium text-gray-900 dark:text-white mb-2">
                          {kanji.meaning}
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {kanji.kunYomi && kanji.kunYomi.length > 0 && (
                            <div>
                              <span className="font-medium text-gray-700 dark:text-gray-300">
                                Kun:
                              </span>
                              <span className="ml-2 text-gray-600 dark:text-gray-400">
                                {kanji.kunYomi.join(', ')}
                              </span>
                            </div>
                          )}
                          {kanji.onYomi && kanji.onYomi.length > 0 && (
                            <div>
                              <span className="font-medium text-gray-700 dark:text-gray-300">
                                On:
                              </span>
                              <span className="ml-2 text-gray-600 dark:text-gray-400">
                                {kanji.onYomi.join(', ')}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Click indicator */}
                      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </button>
                ) : (
                  <div
                    key={idx}
                    className="w-full bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border-2 border-transparent opacity-75"
                  >
                    <div className="flex items-start gap-4">
                      <div className="text-4xl font-bold text-gray-900 dark:text-white">
                        {kanji.kanji}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-base font-medium text-gray-900 dark:text-white mb-2">
                          {kanji.meaning}
                        </p>
                        <div className="text-xs text-gray-500 dark:text-gray-400 italic">
                          (okurigana - grammatical ending)
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Conjugation Table */}
        {explanation.conjugation && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <svg
                className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              Conjugations
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(() => {
                // Handle both flat format and nested "forms" format from hybrid processor
                const conjugation = explanation.conjugation as unknown as Record<string, unknown>
                const forms = conjugation.forms && typeof conjugation.forms === 'object'
                  ? conjugation.forms as Record<string, string>
                  : conjugation as Record<string, string>

                // Define preferred order: present before past, positive before negative
                const preferredOrder = [
                  'present', 'past', 'negative', 'negativePast',
                  'te', 'teForm', 'potential', 'passive', 'causative',
                  'imperative', 'volitional', 'conditional', 'provisional'
                ]

                const sortedEntries = Object.entries(forms).sort(([a], [b]) => {
                  const aLower = a.toLowerCase()
                  const bLower = b.toLowerCase()
                  const aIndex = preferredOrder.findIndex(p => aLower.includes(p.toLowerCase()))
                  const bIndex = preferredOrder.findIndex(p => bLower.includes(p.toLowerCase()))
                  if (aIndex === -1 && bIndex === -1) return 0
                  if (aIndex === -1) return 1
                  if (bIndex === -1) return -1
                  return aIndex - bIndex
                })

                return sortedEntries.map(([form, value]) =>
                  value && typeof value === 'string' && (
                    <div key={form} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                        {form.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                      <div className="text-base font-medium text-gray-900 dark:text-white">
                        {value}
                      </div>
                    </div>
                  )
                )
              })()}
            </div>
          </div>
        )}

        {/* Pitch Accent */}
        {explanation.pitchAccent && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
              <svg
                className="w-5 h-5 mr-2 text-green-600 dark:text-green-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
              </svg>
              Pitch Accent
            </h4>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Pattern:
                </span>
                <span className="text-base text-gray-900 dark:text-white font-mono">
                  {explanation.pitchAccent.pattern}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Notation:
                </span>
                <span className="text-lg text-gray-900 dark:text-white">
                  {explanation.pitchAccent.notation}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Related Words */}
        {explanation.relatedWords && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <svg
                className="w-5 h-5 mr-2 text-orange-600 dark:text-orange-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
              Related Words
            </h4>
            <div className="space-y-3">
              {explanation.relatedWords.synonyms &&
                explanation.relatedWords.synonyms.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Synonyms
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {explanation.relatedWords.synonyms.map((relWord, idx) => {
                        const label =
                          typeof relWord === 'string'
                            ? relWord
                            : (relWord as any)?.word ||
                              (relWord as any)?.meaning ||
                              (relWord as any)?.reading ||
                              JSON.stringify(relWord)
                        return (
                          <span
                            key={idx}
                            className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                          >
                            {label}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
              {explanation.relatedWords.antonyms &&
                explanation.relatedWords.antonyms.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Antonyms
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {explanation.relatedWords.antonyms.map((relWord, idx) => {
                        const label =
                          typeof relWord === 'string'
                            ? relWord
                            : (relWord as any)?.word ||
                              (relWord as any)?.meaning ||
                              (relWord as any)?.reading ||
                              JSON.stringify(relWord)
                        return (
                          <span
                            key={idx}
                            className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"
                          >
                            {label}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
              {explanation.relatedWords.compounds &&
                explanation.relatedWords.compounds.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Compounds
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {explanation.relatedWords.compounds.map((relWord, idx) => {
                        const label =
                          typeof relWord === 'string'
                            ? relWord
                            : (relWord as any)?.word ||
                              (relWord as any)?.meaning ||
                              (relWord as any)?.reading ||
                              JSON.stringify(relWord)
                        return (
                          <span
                            key={idx}
                            className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                          >
                            {label}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
            </div>
          </div>
        )}

        {/* Usage Notes */}
        {(explanation.usageNotes || explanation.contextSentence || explanation.contextTranslation) && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
              <svg
                className="w-5 h-5 mr-2 text-yellow-600 dark:text-yellow-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              Usage Notes & Context
            </h4>
            {explanation.usageNotes && (
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
                {explanation.usageNotes}
              </p>
            )}
            {(explanation.contextSentence || explanation.contextTranslation) && (
              <div className="space-y-1">
                {explanation.contextSentence && (
                  <p className="text-sm text-gray-900 dark:text-gray-100">
                    {explanation.contextSentence}
                  </p>
                )}
                {explanation.contextTranslation && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {explanation.contextTranslation}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Examples with Enhanced Audio */}
        {explanation.examples && explanation.examples.length > 0 && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <svg
                className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z"
                  clipRule="evenodd"
                />
              </svg>
              Example Sentences
            </h4>
            <div className="space-y-4">
              {explanation.examples.map((example, idx) => (
                <div key={idx} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                  <div className="flex items-start gap-3 mb-2">
                    <button
                      onClick={() => handlePlayExample(example.japanese)}
                      disabled={playing && currentText === example.japanese}
                      className="flex-shrink-0 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                      title="Play audio"
                    >
                      <SpeakerWaveIcon
                        className={`w-5 h-5 ${
                          playing && currentText === example.japanese
                            ? 'text-indigo-600 dark:text-indigo-400 animate-pulse'
                            : 'text-indigo-600 dark:text-indigo-400'
                        }`}
                      />
                    </button>
                    <div className="flex-1 text-lg text-gray-900 dark:text-white font-medium">
                      {example.furigana}
                    </div>
                    <AddToListButton
                      content={example.japanese}
                      type="sentence"
                      metadata={{
                        reading: example.furigana,
                        meaning: example.translation,
                        notes: example.notes,
                      }}
                      size="small"
                    />
                  </div>
                  <div className="text-base text-gray-700 dark:text-gray-300 mb-2">
                    {example.translation}
                  </div>
                  {example.notes && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                      {example.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Real-World Examples from Tatoeba */}
        {(tatoebaExamples.length > 0 || loadingTatoeba) && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <svg
                className="w-5 h-5 mr-2 text-teal-600 dark:text-teal-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
              </svg>
              Real-World Examples
            </h4>
            {loadingTatoeba ? (
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-teal-500 border-t-transparent" />
                <span className="text-sm">Loading examples from Tatoeba...</span>
              </div>
            ) : (
              <div className="space-y-4">
                {tatoebaExamples.map((example, idx) => (
                  <div key={example.id || idx} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                    <div className="flex items-start gap-3 mb-2">
                      <button
                        onClick={() => handlePlayExample(example.japanese)}
                        disabled={playing && currentText === example.japanese}
                        className="flex-shrink-0 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                        title="Play audio"
                      >
                        <SpeakerWaveIcon
                          className={`w-5 h-5 ${
                            playing && currentText === example.japanese
                              ? 'text-teal-600 dark:text-teal-400 animate-pulse'
                              : 'text-teal-600 dark:text-teal-400'
                          }`}
                        />
                      </button>
                      <div className="flex-1 text-lg text-gray-900 dark:text-white font-medium">
                        {example.japanese}
                      </div>
                      <AddToListButton
                        content={example.japanese}
                        type="sentence"
                        metadata={{
                          meaning: example.english || undefined,
                        }}
                        size="small"
                      />
                    </div>
                    {example.english && (
                      <div className="text-base text-gray-700 dark:text-gray-300 ml-11">
                        {example.english}
                      </div>
                    )}
                  </div>
                ))}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Examples from Tatoeba
                </p>
              </div>
            )}
          </div>
        )}
      </motion.div>
    )
  }

  // ============================================
  // Main Render
  // ============================================

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="xl"
      closeOnOverlayClick={true}
      closeOnEsc={true}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {word ? `Word: ${word}` : 'Word Explanation'}
          </h2>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400" />
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Analyzing word...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-start">
              <ExclamationCircleIcon className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  Error loading explanation
                </h3>
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        {explanation && !loading && !error && (
          <>
            {/* Tab Navigation */}
            {(showTranslationContext || enableRelatedTranslations || isConjugatable) && renderTabButtons()}

            {/* Tab Content */}
            <AnimatePresence mode="wait">
              {activeTab === 'explanation' && (
                <motion.div key="explanation">{renderMainExplanation()}</motion.div>
              )}

              {activeTab === 'conjugation' && isConjugatable && (
                <motion.div
                  key="conjugation"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <CompactConjugationTable explanation={explanation} />
                </motion.div>
              )}

              {activeTab === 'context' && showTranslationContext && (
                <motion.div key="context">{renderTranslationContext()}</motion.div>
              )}

              {activeTab === 'related' && enableRelatedTranslations && (
                <motion.div key="related">{renderRelatedTranslations()}</motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Nested Kanji Details Modal */}
      <KanjiDetailsModal
        kanji={selectedKanji}
        isOpen={kanjiModalOpen}
        onClose={() => setKanjiModalOpen(false)}
      />
    </Modal>
  )
}
