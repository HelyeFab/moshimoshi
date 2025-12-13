'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, BookOpen, Tag, Plus, ScrollText, Info, Loader2 } from 'lucide-react'
import { JapaneseWord, isDrillable, getRecommendedListType } from '@/types/vocabulary'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useI18n } from '@/i18n/I18nContext'
import { searchTatoebaExamples, type ExampleSentence } from '@/utils/tatoebaSearch'
import { useTTS } from '@/hooks/useTTS'
import { useSubscription } from '@/hooks/useSubscription'
import { useAuth } from '@/hooks/useAuth'
import { ConjugationDisplay } from '@/components/conjugation/ConjugationDisplay'
import { enhanceWordWithType } from '@/utils/enhancedWordTypeDetection'
import { useKanjiDetails, extractKanjiFromText } from '@/hooks/useKanjiDetails'
import KanjiDetailsModal from '@/components/kanji/KanjiDetailsModal'
import AddToListButton from '@/components/lists/AddToListButton'
import AudioButton from '@/components/ui/AudioButton'
import { useFeature } from '@/hooks/useFeature'
import { useShowEntitlementModal } from '@/hooks/useEntitlementModal'
import type { FeatureId } from '@/types/FeatureId'

const FEATURE_ID = 'word_lookup' as FeatureId

interface WordDetailsModalProps {
  word: JapaneseWord | null
  isOpen: boolean
  onClose: () => void
  user?: any
}

export default function WordDetailsModal({ word, isOpen, onClose, user }: WordDetailsModalProps) {
  const [examples, setExamples] = useState<ExampleSentence[]>([])
  const [loadingExamples, setLoadingExamples] = useState(false)
  const [activeTab, setActiveTab] = useState<'details' | 'conjugations'>('details')
  const { strings, t } = useI18n()
  const {
    play,
    preload,
    loading: ttsLoading,
    playing: ttsPlaying,
    currentText,
  } = useTTS({ cacheFirst: true })
  const { user: authUser } = useAuth()
  const { subscription, isPremium } = useSubscription()
  const { modalKanji, openKanjiDetails, closeKanjiDetails } = useKanjiDetails()

  // Entitlement check
  const { checkAndTrack, remaining } = useFeature(FEATURE_ID)
  const showEntitlementModal = useShowEntitlementModal()
  const [isCheckingEntitlement, setIsCheckingEntitlement] = useState(false)
  const [isAllowed, setIsAllowed] = useState(false)
  const checkedWordsRef = useRef<Set<string>>(new Set())

  // Check if word is conjugatable
  const isConjugatable = useMemo(() => {
    if (!word) return false
    const enhanced = enhanceWordWithType(word)
    return enhanced.isConjugatable
  }, [word])

  // Generate a unique key for the word
  const wordKey = useMemo(() => {
    if (!word) return null
    return `${word.kanji || ''}:${word.kana}`
  }, [word])

  // Entitlement check when modal opens
  useEffect(() => {
    if (!isOpen || !word || !wordKey) {
      setIsAllowed(false)
      return
    }

    // If already checked this word in this session, skip tracking
    if (checkedWordsRef.current.has(wordKey)) {
      setIsAllowed(true)
      return
    }

    const checkEntitlement = async () => {
      setIsCheckingEntitlement(true)
      try {
        const allowed = await checkAndTrack({ showUI: false })
        if (allowed) {
          setIsAllowed(true)
          checkedWordsRef.current.add(wordKey)
        } else {
          setIsAllowed(false)
          // Show entitlement modal and close this modal
          showEntitlementModal(
            {
              allow: false,
              remaining: 0,
              reason: 'limit_reached',
              policyVersion: 1,
            },
            FEATURE_ID
          )
          onClose()
        }
      } catch (error) {
        console.error('[WordDetailsModal] Entitlement check failed:', error)
        // Allow on error (fail open for better UX)
        setIsAllowed(true)
        checkedWordsRef.current.add(wordKey)
      } finally {
        setIsCheckingEntitlement(false)
      }
    }

    checkEntitlement()
  }, [isOpen, word, wordKey, checkAndTrack, showEntitlementModal, onClose])

  useEffect(() => {
    if (word && isOpen && isAllowed) {
      loadExamples()

      // Preload audio for better UX
      const textsToPreload: string[] = []
      if (word.kanji) textsToPreload.push(word.kanji)
      if (word.kana) textsToPreload.push(word.kana)

      if (textsToPreload.length > 0) {
        preload(textsToPreload, { voice: '23', speed: 0.85 })
      }
    }
  }, [word, isOpen, isAllowed])

  const loadExamples = async () => {
    if (!word) return

    setLoadingExamples(true)
    try {
      // Build a list of search terms to try (most specific to least specific)
      const searchTerms: string[] = []

      if (word.kanji) {
        // 1. Try full kanji word first (e.g., "食べる")
        searchTerms.push(word.kanji)

        // 2. Try removing verb endings (る, す, etc.) for dictionary forms
        const verbStem = word.kanji.replace(/[るすくぐむぶぬつう]$/, '')
        if (verbStem && verbStem !== word.kanji) {
          searchTerms.push(verbStem)
        }

        // 3. Extract individual kanji characters and try each
        const kanjiChars = word.kanji.match(/[\u4e00-\u9faf]/g)
        if (kanjiChars) {
          // Try combinations of kanji (for compound words)
          if (kanjiChars.length >= 2) {
            searchTerms.push(kanjiChars.join(''))
          }
          // Try individual kanji
          kanjiChars.forEach(k => searchTerms.push(k))
        }
      }

      // 4. Try kana
      if (word.kana) {
        searchTerms.push(word.kana)
      }

      // Search with each term until we find examples
      let foundExamples: ExampleSentence[] = []
      const seenIds = new Set<string>()

      for (const term of searchTerms) {
        if (foundExamples.length >= 5) break

        const results = await searchTatoebaExamples(term, 5 - foundExamples.length)
        for (const ex of results) {
          if (!seenIds.has(ex.id)) {
            foundExamples.push(ex)
            seenIds.add(ex.id)
          }
        }
      }

      setExamples(foundExamples)
    } catch (error) {
      console.error('Failed to load examples:', error)
      setExamples([])
    } finally {
      setLoadingExamples(false)
    }
  }

  if (!word) return null

  // Show loading state while checking entitlement
  if (isCheckingEntitlement) {
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={onClose}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-x-4 top-1/2 transform -translate-y-1/2 max-w-md mx-auto bg-white dark:bg-dark-800 rounded-xl shadow-2xl z-50 p-8"
            >
              <div className="flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                <p className="text-gray-600 dark:text-gray-400">{t('common.loading')}</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    )
  }

  // Don't render content if not allowed
  if (!isAllowed) return null

  const handleSpeak = async (text: string) => {
    try {
      await play(text, {
        voice: '23',
        speed: 0.85,
      })
    } catch (error) {
      console.error('TTS failed, falling back to browser speech:', error)
      // Fallback to browser speech synthesis
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = 'ja-JP'
        utterance.rate = 0.9
        window.speechSynthesis.speak(utterance)
      }
    }
  }

  const handleSpeakExample = async (text: string, index: number) => {
    try {
      await play(text, {
        voice: '23',
        speed: 0.85,
      })
    } catch (error) {
      console.error('TTS failed, falling back to browser speech:', error)
      // Fallback to browser speech synthesis
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = 'ja-JP'
        utterance.rate = 0.9
        window.speechSynthesis.speak(utterance)
      }
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Ichidan':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
      case 'Godan':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
      case 'Irregular':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
      case 'i-adjective':
        return 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300'
      case 'na-adjective':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
      case 'noun':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
      default:
        return 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300'
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 top-1/2 transform -translate-y-1/2 max-w-2xl mx-auto bg-white dark:bg-dark-800 rounded-xl shadow-2xl z-50 max-h-[90vh] overflow-y-auto"
          >
            <div className="sticky top-0 bg-white dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700 p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-2">
                    {word.kanji && (
                      <div className="flex items-center gap-2">
                        <span
                          className="text-4xl font-bold text-gray-900 dark:text-gray-100"
                          style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}
                        >
                          {word.kanji.split('').map((char, idx) => {
                            const isKanjiChar = /[\u4e00-\u9faf]/.test(char)
                            return isKanjiChar ? (
                              <span
                                key={idx}
                                className="cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 transition-colors inline-block hover:scale-110"
                                onClick={() => openKanjiDetails(char)}
                                title={`View details for ${char}`}
                              >
                                {char}
                              </span>
                            ) : (
                              <span key={idx}>{char}</span>
                            )
                          })}
                        </span>
                        <AudioButton
                          size="sm"
                          onPlay={() => handleSpeak(word.kanji!)}
                          loading={ttsLoading && currentText === word.kanji}
                          playing={ttsPlaying && currentText === word.kanji}
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <span className="text-2xl text-gray-700 dark:text-gray-300">{word.kana}</span>
                      <AudioButton
                        size="sm"
                        onPlay={() => handleSpeak(word.kana)}
                        loading={ttsLoading && currentText === word.kana}
                        playing={ttsPlaying && currentText === word.kana}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {word.type && (
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${getTypeColor(word.type)}`}
                      >
                        {word.type}
                      </span>
                    )}
                    {isDrillable(word) && (
                      <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm font-medium flex items-center gap-1">
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        {t('lists.labels.drillable')}
                      </span>
                    )}
                    {word.jlpt && (
                      <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium">
                        {word.jlpt}
                      </span>
                    )}
                    {word.wanikaniLevel && (
                      <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm font-medium">
                        WK Lvl {word.wanikaniLevel}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <AddToListButton
                    content={word.kanji || word.kana}
                    type={isConjugatable ? 'verbAdj' : 'word'}
                    metadata={{
                      reading: word.kana,
                      meaning: word.meaning || '',
                      jlptLevel: word.jlpt ? parseInt(word.jlpt.replace('N', '')) : undefined,
                    }}
                    variant="bookmark"
                    size="medium"
                  />
                  <button
                    onClick={onClose}
                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Tab navigation - only show if word is conjugatable */}
            {isConjugatable && (
              <div className="border-b border-gray-200 dark:border-dark-700">
                <div className="flex">
                  <button
                    onClick={() => setActiveTab('details')}
                    className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'details'
                        ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    <Info className="w-4 h-4" />
                    {t('vocabulary.tabs.details')}
                  </button>
                  <button
                    onClick={() => setActiveTab('conjugations')}
                    className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'conjugations'
                        ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    <ScrollText className="w-4 h-4" />
                    {t('vocabulary.tabs.conjugations')}
                  </button>
                </div>
              </div>
            )}

            {/* Tab content */}
            <div className="p-6">
              {activeTab === 'conjugations' && isConjugatable ? (
                <ConjugationDisplay word={word} showFurigana={false} />
              ) : (
                <div className="space-y-6">
                  {/* Meaning */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      {(strings.reviewPrompts?.vocabulary as any)?.wordMeaning || 'Meaning'}
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300">{word.meaning}</p>
                  </div>

                  {/* Romaji */}
                  {word.romaji && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        {(strings.reviewPrompts?.vocabulary as any)?.wordRomaji || 'Romaji'}
                      </h3>
                      <p className="text-gray-700 dark:text-gray-300">{word.romaji}</p>
                    </div>
                  )}

                  {/* Tags */}
                  {word.tags && word.tags.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                        <Tag className="w-4 h-4" />
                        {(strings.reviewPrompts?.vocabulary as any)?.wordTags || 'Tags'}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {word.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded-full text-sm"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Example Sentences */}
                  <div className="pt-4 border-t border-gray-200 dark:border-dark-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      {(strings.reviewPrompts?.vocabulary as any)?.wordExampleSentences ||
                        'Example Sentences'}
                    </h3>

                    {loadingExamples ? (
                      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-500 border-t-transparent" />
                        <span className="text-sm">{strings.common?.loading || 'Loading...'}</span>
                      </div>
                    ) : examples.length > 0 ? (
                      <div className="space-y-3">
                        {examples.map((example, index) => (
                          <div
                            key={example.id || index}
                            className="p-3 bg-gray-50 dark:bg-dark-700 rounded-lg"
                          >
                            <div className="flex items-start gap-2">
                              <div className="flex-1">
                                <p
                                  className="text-gray-900 dark:text-gray-100 font-medium mb-1"
                                  style={{
                                    fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif',
                                  }}
                                >
                                  {example.japanese}
                                </p>
                                {example.english && (
                                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                                    {example.english}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <AddToListButton
                                  content={example.japanese}
                                  type="sentence"
                                  metadata={{
                                    meaning: example.english || '',
                                    notes: `Example for ${word.kanji || word.kana}`,
                                  }}
                                  variant="bookmark"
                                  size="small"
                                />
                                <AudioButton
                                  size="sm"
                                  onPlay={() => handleSpeakExample(example.japanese, index)}
                                  loading={ttsLoading && currentText === example.japanese}
                                  playing={ttsPlaying && currentText === example.japanese}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          Examples from Tatoeba
                        </p>
                      </div>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 text-sm italic">
                        {(strings.reviewPrompts?.vocabulary as any)?.noExamplesFound ||
                          'No examples found for this word'}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Kanji Details Modal */}
          <KanjiDetailsModal kanji={modalKanji} isOpen={!!modalKanji} onClose={closeKanjiDetails} />
        </>
      )}
    </AnimatePresence>
  )
}
