'use client'

import { useState, useEffect } from 'react'
import { Kanji } from '@/types/kanji'
import { kanjiService, KanjiMnemonic } from '@/services/kanjiService'
import Modal from '@/components/ui/Modal'
import { LoadingSpinner } from '@/components/ui/Loading'
import AudioButton from '@/components/ui/AudioButton'
import StrokeOrderModal from './StrokeOrderModal'
import DrawingPracticeModal from '@/components/drawing-practice/DrawingPracticeModal'
import { useFeature } from '@/hooks/useFeature'
import { motion, AnimatePresence } from 'framer-motion'
import { useTTS } from '@/hooks/useTTS'
import { fetchTatoebaSentences, TatoebaSentence } from '@/utils/tatoeba-client'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import KuromojiService from '@/utils/kuromojiService'
import AddToListButton from '@/components/lists/AddToListButton'
import { toRomaji } from 'wanakana'

interface KanjiDetailsModalProps {
  kanji: Kanji | null
  isOpen: boolean
  onClose: () => void
}

export default function KanjiDetailsModal({ kanji, isOpen, onClose }: KanjiDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'readings' | 'examples'>('overview')
  const [strokeCount, setStrokeCount] = useState<number | null>(null)
  const [showStrokeOrder, setShowStrokeOrder] = useState(false)
  const [showDrawingPractice, setShowDrawingPractice] = useState(false)
  const [loadingStrokes, setLoadingStrokes] = useState(false)
  const [exampleSentences, setExampleSentences] = useState<TatoebaSentence[]>([])
  const [loadingSentences, setLoadingSentences] = useState(false)
  const [furiganaTexts, setFuriganaTexts] = useState<Record<string, string>>({})
  const [showFurigana, setShowFurigana] = useState(true)
  const [mnemonic, setMnemonic] = useState<KanjiMnemonic | null>(null)
  const [loadingMnemonic, setLoadingMnemonic] = useState(false)
  const { strings } = useI18n()
  const { user } = useAuth()
  const { subscription } = useSubscription()
  const userPlan = !user ? 'guest' : subscription?.status === 'active' ? 'premium' : 'free'
  const { checkAndTrack } = useFeature('drawing_practice')

  // TTS hook for audio playback
  const { play, preload, loading, playing, currentText } = useTTS({
    cacheFirst: true, // Prioritize cached audio
  })

  // Reset to overview tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab('overview')
    }
  }, [isOpen])

  // Fetch stroke count, example sentences, mnemonic, and preload audio when modal opens
  useEffect(() => {
    if (isOpen && kanji?.kanji) {
      fetchStrokeCount(kanji.kanji)
      fetchExamples(kanji.kanji)
      fetchMnemonic(kanji.kanji, kanji.meaning)

      // Preload all readings for better UX
      const readingsToPreload: string[] = []
      if (kanji.onyomi) readingsToPreload.push(...kanji.onyomi)
      if (kanji.kunyomi) readingsToPreload.push(...kanji.kunyomi)
      if (readingsToPreload.length > 0) {
        preload(readingsToPreload, { voice: '23', speed: 0.85 })
      }
    }
  }, [isOpen, kanji?.kanji])

  useEffect(() => {
    if (!isOpen || exampleSentences.length === 0) return
    const texts = exampleSentences
      .map(sentence => sentence.japanese)
      .filter(Boolean)
      .slice(0, 5)
    if (texts.length > 0) {
      preload(texts, { voice: '23', speed: 0.85 })
    }
  }, [isOpen, exampleSentences, preload])

  const fetchStrokeCount = async (character: string) => {
    setLoadingStrokes(true)
    try {
      const svgText = await kanjiService.getStrokeOrderSVG(character)
      if (svgText) {
        const count = kanjiService.getStrokeCount(svgText)
        setStrokeCount(count)
      } else {
        setStrokeCount(null)
      }
    } catch (error) {
      console.error('Error fetching stroke count:', error)
      setStrokeCount(null)
    } finally {
      setLoadingStrokes(false)
    }
  }

  const fetchExamples = async (character: string) => {
    setLoadingSentences(true)
    try {
      const sentences = await fetchTatoebaSentences(character, 2)
      setExampleSentences(sentences)

      // Generate proper furigana using Kuromoji
      const kuromoji = KuromojiService.getInstance()
      const furiganaMap: Record<string, string> = {}

      for (const sentence of sentences) {
        try {
          const withFurigana = await kuromoji.addFurigana(sentence.japanese)
          furiganaMap[sentence.japanese] = withFurigana
        } catch (error) {
          console.error('Error generating furigana:', error)
          furiganaMap[sentence.japanese] = sentence.japanese
        }
      }

      setFuriganaTexts(furiganaMap)
    } catch (error) {
      console.error('Error fetching example sentences:', error)
      setExampleSentences([])
    } finally {
      setLoadingSentences(false)
    }
  }

  const fetchMnemonic = async (character: string, meaning?: string) => {
    setLoadingMnemonic(true)
    setMnemonic(null)
    try {
      // First try to get from cache
      const cached = await kanjiService.getKanjiMnemonic(character)
      if (cached) {
        setMnemonic(cached)
        return
      }
      // If not cached, generate one (requires auth)
      const generated = await kanjiService.generateKanjiMnemonic(character, meaning)
      if (generated) {
        setMnemonic(generated)
      }
    } catch (error) {
      console.error('Error fetching mnemonic:', error)
    } finally {
      setLoadingMnemonic(false)
    }
  }

  if (!kanji) return null

  // Tab configuration
  const tabs = [
    { id: 'overview', label: strings?.kanji?.overview || 'Overview', icon: '本' },
    { id: 'readings', label: strings?.kanji?.readings || 'Readings', icon: '音' },
    { id: 'examples', label: strings?.kanji?.examples || 'Examples', icon: '文' },
  ]

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title=""
        size="lg"
        showCloseButton={false}
        className="max-h-[90vh] overflow-hidden"
        ariaLabelledBy="kanji-details-title"
        ariaDescribedBy="kanji-details-description"
      >
        {/* Simplified Header */}
        <div className="relative p-6">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 dark:bg-dark-800 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all hover:scale-110"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/* Kanji Display with Essential Info */}
          <div className="text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3, type: 'spring' }}
              className="inline-block"
            >
              <h2
                id="kanji-details-title"
                className="text-7xl sm:text-8xl font-bold text-gray-900 dark:text-gray-100 mb-2"
                style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}
              >
                {kanji.kanji}
              </h2>
            </motion.div>

            <p
              id="kanji-details-description"
              className="text-xl text-gray-700 dark:text-gray-300 font-medium mb-4"
            >
              {kanji.meaning}
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div
          role="tablist"
          aria-label="Kanji information tabs"
          className="flex border-b border-gray-200 dark:border-dark-700 bg-gray-50 dark:bg-dark-800"
        >
          {tabs.map(tab => (
            <button
              key={tab.id}
              role="tab"
              id={`kanji-tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`kanji-tabpanel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all relative
                ${
                  activeTab === tab.id
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
            >
              <span className="hidden sm:inline text-lg" aria-hidden="true">
                {tab.icon}
              </span>
              <span>{tab.label}</span>
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500"
                  initial={false}
                />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div
          role="tabpanel"
          id={`kanji-tabpanel-${activeTab}`}
          aria-labelledby={`kanji-tab-${activeTab}`}
          className="overflow-y-auto max-h-[50vh] p-6 scrollbar-hide"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {/* Tab-specific Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Quick Summary */}
                  <div className="bg-primary-50/50 dark:bg-primary-900/10 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3 uppercase tracking-wider">
                      Quick Summary
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">
                          Primary Meaning
                        </p>
                        <p className="text-base font-medium text-gray-900 dark:text-gray-100">
                          {kanji.meaning}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">
                          Common Reading
                        </p>
                        <p className="text-base font-medium text-gray-900 dark:text-gray-100">
                          {kanji.kunyomi?.[0] || kanji.onyomi?.[0] || 'N/A'}
                        </p>
                      </div>
                      {kanji.jlpt && (
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">
                            JLPT Level
                          </p>
                          <p className="text-base font-medium text-gray-900 dark:text-gray-100">
                            {kanji.jlpt}
                          </p>
                        </div>
                      )}
                      {strokeCount !== null && (
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">
                            Stroke Count
                          </p>
                          <p className="text-base font-medium text-gray-900 dark:text-gray-100">
                            {strokeCount}
                          </p>
                        </div>
                      )}
                      {kanji.grade && (
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">
                            Grade Level
                          </p>
                          <p className="text-base font-medium text-gray-900 dark:text-gray-100">
                            Grade {kanji.grade}
                          </p>
                        </div>
                      )}
                      {kanji.frequency && (
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">Frequency</p>
                          <p className="text-base font-medium text-gray-900 dark:text-gray-100">
                            #{kanji.frequency}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* All Meanings */}
                  {kanji.meanings && kanji.meanings.length > 1 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wider">
                        All Meanings
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {kanji.meanings.map((meaning, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm"
                          >
                            {meaning}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Memory Aid / Mnemonic */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wider flex items-center gap-2">
                      <span className="text-amber-500">💡</span>
                      Memory Aid
                    </h3>
                    {loadingMnemonic ? (
                      <div className="p-4 bg-amber-50/50 dark:bg-amber-900/10 rounded-xl">
                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                          <LoadingSpinner size="small" />
                          <span className="text-sm">Generating memory aid...</span>
                        </div>
                      </div>
                    ) : mnemonic ? (
                      <div className="p-4 bg-amber-50/50 dark:bg-amber-900/10 rounded-xl">
                        <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
                          {mnemonic.mnemonic}
                        </p>
                        {mnemonic.components && mnemonic.components.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-amber-200/50 dark:border-amber-700/30">
                            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-1">Components:</p>
                            <div className="flex flex-wrap gap-2">
                              {mnemonic.components.map((comp, idx) => (
                                <span key={idx} className="text-xs px-2 py-1 bg-amber-100 dark:bg-amber-800/30 text-amber-700 dark:text-amber-300 rounded">
                                  {comp.part} = {comp.meaning}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Attribution for Koohii community mnemonics */}
                        {mnemonic.provider === 'koohii' && mnemonic.author && (
                          <div className="mt-3 pt-2 border-t border-amber-200/30 dark:border-amber-700/20">
                            <p className="text-xs text-amber-500/70 dark:text-amber-400/50">
                              Story by <span className="font-medium">{mnemonic.author}</span>
                              {mnemonic.votes !== undefined && mnemonic.votes > 0 && (
                                <span className="ml-1">({mnemonic.votes} votes)</span>
                              )}
                              {' · '}
                              <a
                                href={`https://kanji.koohii.com/study/kanji/${mnemonic.kanji}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-amber-600 dark:hover:text-amber-300 underline"
                              >
                                Kanji Koohii
                              </a>
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                          Memory aid not available yet
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Readings Tab */}
              {activeTab === 'readings' && (
                <div className="space-y-6">
                  {/* Onyomi */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                      <span className="text-blue-500 dark:text-blue-400">●</span>
                      On'yomi (音読み)
                    </h3>
                    {kanji.onyomi && kanji.onyomi.length > 0 ? (
                      <div className="flex flex-wrap gap-3">
                        {kanji.onyomi.map((reading, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 bg-gray-50 dark:bg-dark-700 rounded-lg px-3 py-2"
                          >
                            <span className="text-base font-medium text-gray-900 dark:text-gray-100">
                              {reading}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {toRomaji(reading)}
                            </span>
                            <AudioButton
                              size="sm"
                              onPlay={() => play(reading, { voice: '23', speed: 0.85 })}
                              loading={loading && currentText === reading}
                              playing={playing && currentText === reading}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-400 dark:text-gray-500 italic">No On'yomi readings</p>
                    )}
                  </div>

                  {/* Kunyomi */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                      <span className="text-green-500 dark:text-green-400">●</span>
                      Kun'yomi (訓読み)
                    </h3>
                    {kanji.kunyomi && kanji.kunyomi.length > 0 ? (
                      <div className="flex flex-wrap gap-3">
                        {kanji.kunyomi.map((reading, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 bg-gray-50 dark:bg-dark-700 rounded-lg px-3 py-2"
                          >
                            <span className="text-base font-medium text-gray-900 dark:text-gray-100">
                              {reading}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {toRomaji(reading)}
                            </span>
                            <AudioButton
                              size="sm"
                              onPlay={() => play(reading, { voice: '23', speed: 0.85 })}
                              loading={loading && currentText === reading}
                              playing={playing && currentText === reading}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-400 dark:text-gray-500 italic">
                        No Kun'yomi readings
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Examples Tab */}
              {activeTab === 'examples' && (
                <div className="space-y-4">
                  {/* Furigana Toggle */}
                  {exampleSentences.length > 0 && (
                    <div className="flex justify-end">
                      <button
                        onClick={() => setShowFurigana(!showFurigana)}
                        className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        {showFurigana ? 'Hide' : 'Show'} Furigana
                      </button>
                    </div>
                  )}

                  {loadingSentences ? (
                    <div className="flex items-center justify-center py-8">
                      <LoadingSpinner size="small" />
                    </div>
                  ) : exampleSentences.length > 0 ? (
                    <div className="space-y-3">
                      {exampleSentences.map((sentence, index) => (
                        <div
                          key={sentence.id || index}
                          className="bg-gray-50 dark:bg-dark-700/50 rounded-xl p-4"
                        >
                          <div className="space-y-3">
                            {/* Japanese with furigana */}
                            <div className="text-lg text-gray-900 dark:text-gray-100 font-medium leading-relaxed">
                              {showFurigana && furiganaTexts[sentence.japanese] ? (
                                <span
                                  dangerouslySetInnerHTML={{
                                    __html: furiganaTexts[sentence.japanese].replace(
                                      new RegExp(`(${kanji.kanji})`, 'g'),
                                      '<span class="text-primary-600 dark:text-primary-400 font-bold bg-primary-50 dark:bg-primary-900/20 px-1 rounded">$1</span>'
                                    ),
                                  }}
                                />
                              ) : (
                                sentence.japanese.split(kanji.kanji).map((part, i, arr) => (
                                  <span key={i}>
                                    {part}
                                    {i < arr.length - 1 && (
                                      <span className="text-primary-600 dark:text-primary-400 font-bold bg-primary-50 dark:bg-primary-900/20 px-1 rounded">
                                        {kanji.kanji}
                                      </span>
                                    )}
                                  </span>
                                ))
                              )}
                            </div>

                            {/* English translation */}
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {sentence.english}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 pt-2">
                              <AudioButton
                                size="sm"
                                onPlay={() =>
                                  play(sentence.japanese, { voice: '23', speed: 0.85 })
                                }
                                loading={loading && currentText === sentence.japanese}
                                playing={playing && currentText === sentence.japanese}
                              />
                              <AddToListButton
                                content={sentence.japanese}
                                type="sentence"
                                metadata={{
                                  meaning: sentence.english,
                                  notes: `Contains ${kanji.kanji}`,
                                }}
                                variant="bookmark"
                                size="small"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-400 dark:text-gray-500">
                        No example sentences available
                      </p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Persistent Action Buttons - Always at bottom */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={() => setShowStrokeOrder(true)}
              className="p-2.5 bg-red-50 dark:bg-red-900/20 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 transition-all hover:scale-110 text-red-500 dark:text-red-400"
              title="Watch stroke order"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>

            <button
              onClick={async () => {
                console.log('[KanjiDetailsModal] Checking drawing_practice entitlement...')
                const allowed = await checkAndTrack({ showUI: true })
                console.log('[KanjiDetailsModal] checkAndTrack result:', allowed)
                if (allowed) {
                  setShowDrawingPractice(true)
                } else {
                  console.log('[KanjiDetailsModal] Access denied, modal should NOT open')
                }
              }}
              className="p-2.5 bg-green-50 dark:bg-green-900/20 rounded-full hover:bg-green-100 dark:hover:bg-green-900/30 transition-all hover:scale-110 text-green-500 dark:text-green-400"
              title="Practice writing"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
            </button>

            <AddToListButton
              content={kanji.kanji}
              type="word"
              metadata={{
                reading: kanji.kunyomi?.[0] || kanji.onyomi?.[0] || '',
                meaning: kanji.meaning,
                jlptLevel: kanji.jlpt ? parseInt(kanji.jlpt.replace('N', ''), 10) : undefined,
              }}
              variant="bookmark"
              size="medium"
              className="!p-2.5 !bg-gray-100 dark:!bg-dark-800 !rounded-full hover:!bg-gray-200 dark:hover:!bg-dark-700 !transition-all hover:!scale-110"
            />
          </div>
        </div>
      </Modal>

      {/* Stroke Order Modal */}
      {showStrokeOrder && kanji && (
        <StrokeOrderModal
          character={kanji.kanji}
          isOpen={showStrokeOrder}
          onClose={() => setShowStrokeOrder(false)}
        />
      )}

      {/* Drawing Practice Modal */}
      {showDrawingPractice && kanji && (
        <DrawingPracticeModal
          character={kanji.kanji}
          isOpen={showDrawingPractice}
          onClose={() => setShowDrawingPractice(false)}
          characterType="kanji"
        />
      )}
    </>
  )
}
