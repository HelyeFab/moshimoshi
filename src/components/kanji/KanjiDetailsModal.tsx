'use client'

import { useState, useEffect } from 'react'
import { Kanji } from '@/types/kanji'
import {
  kanjiService,
  KanjiMnemonic,
  UserMnemonic,
  RegenerationLimit,
  getUserMnemonic,
  saveUserMnemonic,
  deleteUserMnemonic,
  checkRegenerationLimit,
  regenerateKanjiMnemonic,
} from '@/services/kanjiService'
import Modal from '@/components/ui/Modal'
import { LoadingSpinner } from '@/components/ui/Loading'
import AudioButton from '@/components/ui/AudioButton'
import StrokeOrderModal from './StrokeOrderModal'
import DrawingPracticeModal from '@/components/drawing-practice/DrawingPracticeModal'
import MnemonicDisplay from './MnemonicDisplay'
import MnemonicEditor from './MnemonicEditor'
import ActionMenu from '@/components/ui/ActionMenu'
import { Play, Pencil } from 'lucide-react'
import { useFeature } from '@/hooks/useFeature'
import { motion, AnimatePresence } from 'framer-motion'
import { useTTS } from '@/hooks/useTTS'
import { fetchTatoebaSentences, TatoebaSentence } from '@/utils/tatoeba-client'
import { searchJMdictWords } from '@/utils/jmdictLocalSearch'
import { KanjiExample } from '@/types/kanji'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'

// Helper to check if text is a single kanji (TTS can't pronounce without context)
const isSingleKanji = (text: string): boolean => {
  if (text.length !== 1) return false
  const code = text.charCodeAt(0)
  // Kanji range: U+4E00 - U+9FAF
  return code >= 0x4e00 && code <= 0x9faf
}
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
  const [exampleWords, setExampleWords] = useState<KanjiExample[]>([])
  const [loadingWords, setLoadingWords] = useState(false)
  const [furiganaTexts, setFuriganaTexts] = useState<Record<string, string>>({})
  const [showFurigana, setShowFurigana] = useState(true)
  const [mnemonic, setMnemonic] = useState<KanjiMnemonic | null>(null)
  const [loadingMnemonic, setLoadingMnemonic] = useState(false)
  const [userMnemonic, setUserMnemonic] = useState<UserMnemonic | null>(null)
  const [mnemonicView, setMnemonicView] = useState<'ai' | 'user'>('ai')
  const [regenerating, setRegenerating] = useState(false)
  const [regenLimit, setRegenLimit] = useState<RegenerationLimit | null>(null)
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


  // Fetch stroke count, example sentences, example words, mnemonic, and preload audio when modal opens
  useEffect(() => {
    if (isOpen && kanji?.kanji) {
      fetchStrokeCount(kanji.kanji)
      fetchExamples(kanji.kanji)
      fetchExampleWords(kanji.kanji)
      fetchMnemonic(kanji.kanji, kanji.meaning)

      // Fetch user mnemonic and regen limit if authenticated
      if (user) {
        fetchUserMnemonic(kanji.kanji)
        fetchRegenLimit(kanji.kanji)
      } else {
        setUserMnemonic(null)
        setRegenLimit(null)
        setMnemonicView('ai')
      }

      // Preload readings for better UX (skip single characters - TTS can't pronounce them without context)
      const readingsToPreload: string[] = []
      if (kanji.onyomi) readingsToPreload.push(...kanji.onyomi.filter(r => r.length > 1))
      if (kanji.kunyomi) readingsToPreload.push(...kanji.kunyomi.filter(r => r.length > 1))
      if (readingsToPreload.length > 0) {
        preload(readingsToPreload, { voice: '23', speed: 0.85 })
      }
    }
  }, [isOpen, kanji?.kanji, user])

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

  const fetchExampleWords = async (character: string) => {
    setLoadingWords(true)
    try {
      const results = await searchJMdictWords(character, 40)
      const filtered = results.filter(result =>
        (result.kanji || result.kana || '').includes(character)
      )
      const mapped = filtered
        .map(result => ({
          word: result.kanji || result.kana || '',
          reading: result.kana || '',
          meaning: result.meaning || '',
        }))
        .filter(example => example.word)

      // Deduplicate by word to prevent multiple buttons matching same currentText
      const seen = new Set<string>()
      const deduped = mapped.filter(example => {
        if (seen.has(example.word)) return false
        seen.add(example.word)
        return true
      }).slice(0, 5)

      setExampleWords(deduped)

      // Preload audio for example words
      if (deduped.length > 0) {
        const wordsToPreload = deduped.map(ex => ex.word)
        preload(wordsToPreload, { voice: '23', speed: 0.85 })
      }
    } catch (error) {
      console.error('Error fetching example words:', error)
      setExampleWords([])
    } finally {
      setLoadingWords(false)
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

  const fetchUserMnemonic = async (character: string) => {
    try {
      const userMnemonicData = await getUserMnemonic(character)
      setUserMnemonic(userMnemonicData)
      // If user has their own mnemonic, default to showing it
      if (userMnemonicData) {
        setMnemonicView('user')
      } else {
        setMnemonicView('ai')
      }
    } catch (error) {
      console.error('Error fetching user mnemonic:', error)
    }
  }

  const fetchRegenLimit = async (character: string) => {
    try {
      const limit = await checkRegenerationLimit(character)
      setRegenLimit(limit)
    } catch (error) {
      console.error('[KanjiDetailsModal] Error fetching regen limit:', error)
    }
  }

  const handleRegenerate = async () => {
    if (!kanji || regenerating) return

    // If regenLimit hasn't loaded yet, try to fetch it first
    if (!regenLimit) {
      await fetchRegenLimit(kanji.kanji)
      return
    }

    if (!regenLimit.allowed) return

    setRegenerating(true)
    try {
      const result = await regenerateKanjiMnemonic(kanji.kanji, kanji.meaning)

      if (result.success && result.mnemonic) {
        setMnemonic(result.mnemonic)
        setRegenLimit({
          allowed: (result.remaining ?? 0) > 0,
          remaining: result.remaining ?? 0,
          resetAtUtc: result.resetAtUtc ?? new Date().toISOString(),
        })
      } else if (result.error) {
        console.error('[KanjiDetailsModal] Regeneration failed:', result.error)
      }
    } catch (error) {
      console.error('[KanjiDetailsModal] Error regenerating mnemonic:', error)
    } finally {
      setRegenerating(false)
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
          {/* Action Menu - Top Left */}
          <div className="absolute top-4 left-4">
            <ActionMenu
              position="left"
              size="md"
              layout="stacked"
              buttonClassName="bg-gray-100 dark:bg-dark-800 rounded-full hover:scale-110"
              items={[
                {
                  label: 'Stroke Order',
                  icon: <Play className="w-5 h-5 text-red-500" />,
                  onClick: () => setShowStrokeOrder(true),
                },
                {
                  label: 'Practice',
                  icon: <Pencil className="w-5 h-5 text-green-500" />,
                  onClick: async () => {
                    const allowed = await checkAndTrack({ showUI: true })
                    if (allowed) {
                      setShowDrawingPractice(true)
                    }
                  },
                },
              ]}
            />
          </div>

          {/* Top Right Actions: Bookmark + Close */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
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
              className="!p-2 !bg-gray-100 dark:!bg-dark-800 !rounded-full hover:!bg-gray-200 dark:hover:!bg-dark-700 !transition-all hover:!scale-110"
            />
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-gray-100 dark:bg-dark-800 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all hover:scale-110"
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
          </div>

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
                style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans CJK JP", sans-serif' }}
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
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <span className="text-amber-500">💡</span>
                        Memory Aid
                      </h3>
                      {/* Toggle only visible for authenticated users */}
                      {user && (
                        <div className="flex gap-1 bg-gray-100 dark:bg-dark-700 rounded-lg p-0.5">
                          <button
                            onClick={() => setMnemonicView('ai')}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                              mnemonicView === 'ai'
                                ? 'bg-white dark:bg-dark-600 text-amber-600 dark:text-amber-400 shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                          >
                            AI
                          </button>
                          <button
                            onClick={() => setMnemonicView('user')}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                              mnemonicView === 'user'
                                ? 'bg-white dark:bg-dark-600 text-purple-600 dark:text-purple-400 shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                          >
                            Mine
                          </button>
                        </div>
                      )}
                    </div>

                    {/* AI Mnemonic View */}
                    {mnemonicView === 'ai' && (
                      <MnemonicDisplay
                        mnemonic={mnemonic}
                        loading={loadingMnemonic}
                        regeneration={
                          user
                            ? {
                                limit: regenLimit,
                                inProgress: regenerating,
                                onRegenerate: handleRegenerate,
                              }
                            : undefined
                        }
                      />
                    )}

                    {/* User Mnemonic View */}
                    {mnemonicView === 'user' && user && (
                      <MnemonicEditor
                        mnemonic={userMnemonic}
                        onSave={async (text) => {
                          if (!kanji) return
                          const success = await saveUserMnemonic(kanji.kanji, text)
                          if (success) {
                            setUserMnemonic({
                              kanji: kanji.kanji,
                              mnemonic: text,
                              isPublic: false,
                              createdAt: new Date().toISOString(),
                              updatedAt: new Date().toISOString(),
                            })
                          }
                        }}
                        onDelete={async () => {
                          if (!kanji) return
                          const success = await deleteUserMnemonic(kanji.kanji)
                          if (success) {
                            setUserMnemonic(null)
                            setMnemonicView('ai')
                          }
                        }}
                      />
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
                <div className="space-y-6">
                  {/* Example Words Section */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3 uppercase tracking-wider">
                      Example Words
                    </h3>
                    {loadingWords ? (
                      <div className="flex items-center justify-center py-4">
                        <LoadingSpinner size="small" />
                      </div>
                    ) : exampleWords.length > 0 ? (
                      <div className="space-y-2">
                        {exampleWords.map((example, idx) => (
                          <div
                            key={`${example.word}-${idx}`}
                            className="bg-gray-50 dark:bg-dark-700 rounded-lg p-3"
                          >
                            <div className="flex items-center justify-between">
                              <div
                              className="flex items-center gap-2 flex-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                                <span className="text-lg font-medium text-gray-900 dark:text-gray-100">
                                  {example.word}
                                </span>
                                {!isSingleKanji(example.word) && (
                                  <AudioButton
                                    size="sm"
                                    onPlay={() => play(example.word, { voice: '23', speed: 0.85 })}
                                    loading={loading && currentText === example.word}
                                    playing={playing && currentText === example.word}
                                  />
                                )}
                                <AddToListButton
                                  content={example.word}
                                  type="word"
                                  metadata={{
                                    reading: example.reading,
                                    meaning: example.meaning,
                                    notes: `Contains ${kanji.kanji}`,
                                  }}
                                  variant="bookmark"
                                  size="small"
                                />
                              </div>
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                {example.reading}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {example.meaning}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-400 dark:text-gray-500 text-sm italic">
                        No example words available
                      </p>
                    )}
                  </div>

                  {/* Example Sentences Section */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Example Sentences
                      </h3>
                      {/* Furigana Toggle */}
                      {exampleSentences.length > 0 && (
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
                      )}
                    </div>

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
                </div>
              )}
            </motion.div>
          </AnimatePresence>

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
