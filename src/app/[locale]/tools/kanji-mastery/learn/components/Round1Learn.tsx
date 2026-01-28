'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { KanjiWithExamples } from '../LearnContent'
import { useTTS } from '@/hooks/useTTS'
import AudioButton from '@/components/ui/AudioButton'
import { getKanjiSentences, type CachedSentence } from '@/services/kanjiSentenceCache'
import { searchJMdictWords } from '@/utils/jmdictLocalSearch'
import { KanjiExample } from '@/types/kanji'
import { toRomaji } from 'wanakana'
import { kanjiService, KanjiMnemonic } from '@/services/kanjiService'
import AddToListButton from '@/components/lists/AddToListButton'

// Helper to check if text is a single kanji (TTS can't pronounce without context)
const isSingleKanji = (text: string): boolean => {
  if (text.length !== 1) return false
  const code = text.charCodeAt(0)
  // Kanji range: U+4E00 - U+9FAF
  return code >= 0x4e00 && code <= 0x9faf
}

const exampleCache = new Map<string, KanjiExample[]>()
const EXAMPLE_CACHE_PREFIX = 'kanji_examples_v1:'

interface Round1LearnProps {
  kanji: KanjiWithExamples
  currentIndex: number
  totalKanji: number
  onComplete: () => void
  onExit: () => void
}

export default function Round1Learn({ kanji, currentIndex, totalKanji, onComplete, onExit }: Round1LearnProps) {
  const [showExamples, setShowExamples] = useState(false)
  const [showSentences, setShowSentences] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [sentences, setSentences] = useState<CachedSentence[]>([])
  const [fallbackExamples, setFallbackExamples] = useState<KanjiExample[]>([])
  const [mnemonic, setMnemonic] = useState<KanjiMnemonic | null>(null)
  const { play, preload, loading: ttsLoading, playing: ttsPlaying, currentText } = useTTS({ cacheFirst: true })
  const resolvedExamples = kanji.examples && kanji.examples.length > 0 ? kanji.examples : fallbackExamples

  useEffect(() => {
    let cancelled = false

    const loadFallbackExamples = async () => {
      if (!kanji.kanji) return
      if (kanji.examples && kanji.examples.length > 0) {
        setFallbackExamples([])
        return
      }

      const cacheKey = `${EXAMPLE_CACHE_PREFIX}${kanji.kanji}`
      const cachedInMemory = exampleCache.get(kanji.kanji)
      if (cachedInMemory) {
        setFallbackExamples(cachedInMemory)
        return
      }

      if (typeof window !== 'undefined') {
        const cachedRaw = localStorage.getItem(cacheKey)
        if (cachedRaw) {
          try {
            const parsed = JSON.parse(cachedRaw) as KanjiExample[]
            exampleCache.set(kanji.kanji, parsed)
            setFallbackExamples(parsed)
            return
          } catch (error) {
            console.warn('[Round1Learn] Failed to parse cached examples:', error)
            localStorage.removeItem(cacheKey)
          }
        }
      }

      try {
        const results = await searchJMdictWords(kanji.kanji, 40)
        const filtered = results.filter(result =>
          (result.kanji || result.kana || '').includes(kanji.kanji)
        )
        const mapped = filtered
          .map(result => ({
            word: result.kanji || result.kana || '',
            reading: result.kana || '',
            meaning: result.meaning || '',
          }))
          .filter(example => example.word)
          .slice(0, 5)

        if (!cancelled) {
          exampleCache.set(kanji.kanji, mapped)
          setFallbackExamples(mapped)
          if (typeof window !== 'undefined') {
            localStorage.setItem(cacheKey, JSON.stringify(mapped))
          }
        }
      } catch (error) {
        console.error('[Round1Learn] Failed to load fallback examples:', error)
        if (!cancelled) {
          setFallbackExamples([])
        }
      }
    }

    loadFallbackExamples()
    return () => {
      cancelled = true
    }
  }, [kanji.kanji, kanji.examples])

  // Prefetch all audio when kanji loads for instant playback
  useEffect(() => {
    const prefetchAllAudio = async () => {
      console.log(`%c[Round1Learn] 🎯 Starting audio prefetch for kanji: ${kanji.kanji}`, 'color: #00bfff; font-weight: bold')

      const textsToPreload: string[] = []

      // Priority 1: Readings (most likely to be played first)
      if (kanji.onyomi && kanji.onyomi.length > 0) {
        textsToPreload.push(...kanji.onyomi)
        console.log(`[Round1Learn] 📘 Onyomi readings to prefetch:`, kanji.onyomi)
      }
      if (kanji.kunyomi && kanji.kunyomi.length > 0) {
        textsToPreload.push(...kanji.kunyomi)
        console.log(`[Round1Learn] 📗 Kunyomi readings to prefetch:`, kanji.kunyomi)
      }

      // Priority 2: Example words (shown when user clicks "Show Examples")
      if (kanji.examples && kanji.examples.length > 0) {
        const exampleWords = kanji.examples
          .map(ex => ex.word)
          .filter(word => !isSingleKanji(word)) // Skip single kanji (TTS can't pronounce without context)
          .slice(0, 5)
        textsToPreload.push(...exampleWords)
        console.log(`[Round1Learn] 📝 Example words to prefetch (${exampleWords.length}):`, exampleWords)
      }

      // Preload readings + example words immediately
      if (textsToPreload.length > 0) {
        console.log(`%c[Round1Learn] ⚡ Starting immediate prefetch of ${textsToPreload.length} items...`, 'color: #ffa500; font-weight: bold')
        try {
          await preload(textsToPreload, { voice: '23', speed: 0.85 })
          console.log(`%c[Round1Learn] ✅ Completed prefetch of ${textsToPreload.length} items (readings + examples)`, 'color: #00c853; font-weight: bold')
        } catch (error) {
          console.error('[Round1Learn] ❌ Failed to prefetch readings/examples:', error)
        }
      }

      // Priority 3: Sentences (load in background with lower priority)
      try {
        console.log(`[Round1Learn] 📚 Loading sentences for kanji: ${kanji.kanji}`)
        const sentenceResults = await getKanjiSentences(kanji.kanji, 5)
        setSentences(sentenceResults)
        console.log(`[Round1Learn] ✓ Loaded ${sentenceResults.length} sentences`)

        // Prefetch sentence audio (delayed to prioritize readings/examples)
        const sentenceTexts = sentenceResults
          .map(s => s.japanese)
          .filter(Boolean)
          .slice(0, 5)

        if (sentenceTexts.length > 0) {
          // Delay sentence prefetch by 500ms to prioritize readings/examples
          setTimeout(async () => {
            console.log(`%c[Round1Learn] ⏱️  Starting delayed prefetch of ${sentenceTexts.length} sentences...`, 'color: #9c27b0; font-weight: bold')
            try {
              await preload(sentenceTexts, { voice: '23', speed: 0.85 })
              console.log(`%c[Round1Learn] ✅ Completed prefetch of ${sentenceTexts.length} sentences`, 'color: #00c853; font-weight: bold')
              console.log(`%c[Round1Learn] 🎉 ALL AUDIO PREFETCHED for kanji: ${kanji.kanji}`, 'color: #00ff00; font-weight: bold; font-size: 14px')
            } catch (error) {
              console.error('[Round1Learn] ❌ Failed to prefetch sentences:', error)
            }
          }, 500)
        }
      } catch (error) {
        console.error('[Round1Learn] ❌ Failed to load/prefetch sentences:', error)
      }
    }

    prefetchAllAudio()
  }, [kanji.kanji, kanji.onyomi, kanji.kunyomi, kanji.examples, preload])

  useEffect(() => {
    if (kanji.examples && kanji.examples.length > 0) return
    if (!resolvedExamples || resolvedExamples.length === 0) return

    const exampleWords = resolvedExamples.map(ex => ex.word).slice(0, 5)
    preload(exampleWords, { voice: '23', speed: 0.85 }).catch(error => {
      console.error('[Round1Learn] ❌ Failed to prefetch fallback examples:', error)
    })
  }, [kanji.examples, resolvedExamples, preload])

  // Fetch mnemonic for current kanji
  useEffect(() => {
    if (!kanji.kanji) return
    setMnemonic(null) // Reset for new kanji

    kanjiService.getKanjiMnemonic(kanji.kanji)
      .then(setMnemonic)
      .catch(error => {
        console.error('[Round1Learn] Failed to fetch mnemonic:', error)
      })
  }, [kanji.kanji])

  const loadSentences = useCallback(() => {
    // Sentences are already loaded and prefetched in useEffect
    // This just toggles visibility
    setShowSentences(true)
  }, [])

  const handleContinue = () => {
    // Reset states for next kanji
    setShowExamples(false)
    setShowSentences(false)
    setSentences([])
    setMnemonic(null)
    onComplete()
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts if user is typing in an input or textarea
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return
      }

      switch (e.key) {
        case 'Enter':
        case ' ':
        case 'ArrowRight':
          e.preventDefault()
          handleContinue()
          break
        case 'Escape':
          e.preventDefault()
          // Close shortcuts panel first if open, otherwise exit
          if (showShortcuts) {
            setShowShortcuts(false)
          } else {
            onExit()
          }
          break
        case 'e':
        case 'E':
          e.preventDefault()
          setShowExamples(prev => !prev)
          break
        case 's':
        case 'S':
          e.preventDefault()
          setShowSentences(prev => !prev)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleContinue, onExit, showShortcuts])

  // Close shortcuts panel when clicking outside
  useEffect(() => {
    if (!showShortcuts) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // Check if click is outside the shortcuts panel
      if (!target.closest('.shortcuts-panel') && !target.closest('.shortcuts-badge')) {
        setShowShortcuts(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showShortcuts])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="text-center relative">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Round 1: Learn
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Kanji {currentIndex + 1} of {totalKanji}
        </p>

        {/* Keyboard Shortcuts Badge - Desktop Only */}
        <div className="hidden md:block absolute top-0 right-0">
          <button
            onClick={() => setShowShortcuts(!showShortcuts)}
            className="shortcuts-badge flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors text-sm font-medium shadow-sm"
            aria-label="Toggle keyboard shortcuts"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <span>Shortcuts</span>
          </button>

          {/* Shortcuts Panel */}
          {showShortcuts && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="shortcuts-panel absolute top-full right-0 mt-2 bg-white dark:bg-dark-800 rounded-xl shadow-2xl border border-gray-200 dark:border-dark-700 p-4 w-80 z-50"
            >
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Keyboard Shortcuts
              </h3>
              <div className="space-y-2">
                {/* Navigation */}
                <div className="border-b border-gray-200 dark:border-dark-700 pb-2 mb-2">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Navigation</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">Continue</span>
                      <div className="flex gap-1">
                        <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-dark-700 border border-gray-300 dark:border-dark-600 rounded text-xs font-mono">Enter</kbd>
                        <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-dark-700 border border-gray-300 dark:border-dark-600 rounded text-xs font-mono">Space</kbd>
                        <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-dark-700 border border-gray-300 dark:border-dark-600 rounded text-xs font-mono">→</kbd>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">Exit</span>
                      <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-dark-700 border border-gray-300 dark:border-dark-600 rounded text-xs font-mono">Esc</kbd>
                    </div>
                  </div>
                </div>

                {/* Toggle Sections */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Toggle Sections</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">Examples</span>
                      <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-dark-700 border border-gray-300 dark:border-dark-600 rounded text-xs font-mono">E</kbd>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">Sentences</span>
                      <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-dark-700 border border-gray-300 dark:border-dark-600 rounded text-xs font-mono">S</kbd>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Main Kanji Card */}
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl p-8"
      >
        <div className="text-center mb-8">
          {/* Large Kanji Display */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="text-8xl font-bold text-gray-900 dark:text-gray-100 mb-4"
            style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans CJK JP", sans-serif' }}
          >
            {kanji.kanji}
          </motion.div>

          {/* Meaning */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-2xl font-medium text-primary-600 dark:text-primary-400 mb-6"
          >
            {kanji.meaning}
          </motion.div>

          {/* Memory Aid / Mnemonic */}
          {mnemonic && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mb-6 p-4 bg-amber-50/80 dark:bg-amber-900/20 rounded-xl border border-amber-200/50 dark:border-amber-800/30"
            >
              <div className="flex items-start gap-2">
                <span className="text-amber-500 text-lg flex-shrink-0">💡</span>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">
                    Memory Aid
                  </h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
                    {mnemonic.mnemonic}
                  </p>
                  {mnemonic.components && mnemonic.components.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {mnemonic.components.map((comp, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-800/30 rounded text-xs text-amber-700 dark:text-amber-300"
                        >
                          <span className="font-medium">{comp.part}</span>
                          <span className="opacity-70">({comp.meaning})</span>
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Attribution for Koohii community mnemonics */}
                  {mnemonic.provider === 'koohii' && mnemonic.author && (
                    <p className="mt-2 text-xs text-amber-500/60 dark:text-amber-400/40">
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
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Readings Section */}
          <div className="space-y-4 mb-6">
              {/* Onyomi */}
              {kanji.onyomi && kanji.onyomi.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wider flex items-center gap-2">
                    <span className="text-blue-500 dark:text-blue-400">●</span>
                    On'yomi (音読み)
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {kanji.onyomi.map((reading, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 bg-gray-50 dark:bg-dark-700 rounded-lg px-3 py-2"
                      >
                        <span className="text-lg font-medium text-gray-900 dark:text-gray-100">
                          {reading}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {toRomaji(reading)}
                        </span>
                        <AudioButton
                          size="sm"
                          onPlay={() => play(reading, { voice: '23', speed: 0.85 })}
                          loading={ttsLoading && currentText === reading}
                          playing={ttsPlaying && currentText === reading}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Kunyomi */}
              {kanji.kunyomi && kanji.kunyomi.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wider flex items-center gap-2">
                    <span className="text-green-500 dark:text-green-400">●</span>
                    Kun'yomi (訓読み)
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {kanji.kunyomi.map((reading, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 bg-gray-50 dark:bg-dark-700 rounded-lg px-3 py-2"
                      >
                        <span className="text-lg font-medium text-gray-900 dark:text-gray-100">
                          {reading}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {toRomaji(reading)}
                        </span>
                        <AudioButton
                          size="sm"
                          onPlay={() => play(reading, { voice: '23', speed: 0.85 })}
                          loading={ttsLoading && currentText === reading}
                          playing={ttsPlaying && currentText === reading}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
        </div>

        {/* Examples Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="border-t border-gray-200 dark:border-dark-700 pt-6"
        >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Example Words
              </h3>
              {showExamples && (
                <button
                  onClick={() => setShowExamples(false)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-dark-600 rounded transition-colors"
                  aria-label="Hide examples"
                >
                  <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {!showExamples ? (
              <button
                onClick={() => setShowExamples(true)}
                className="px-6 py-2 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/30 transition-colors"
              >
                Show Examples <span className="text-xs opacity-60">(E)</span>
              </button>
            ) : (
              <div className="space-y-3">
                {resolvedExamples.length > 0 ? (
                  resolvedExamples.map((example, idx) => (
                    <motion.div
                      key={`${example.word}-${idx}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="bg-gray-50 dark:bg-dark-700 rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-lg font-medium text-gray-900 dark:text-gray-100">
                            {example.word}
                          </span>
                          {!isSingleKanji(example.word) && (
                            <AudioButton
                              size="sm"
                              onPlay={() => play(example.word, { voice: '23', speed: 0.85 })}
                              loading={ttsLoading && currentText === example.word}
                              playing={ttsPlaying && currentText === example.word}
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
                    </motion.div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                    No example words found for this kanji.
                  </p>
                )}
              </div>
            )}
          </motion.div>

        {/* Sentences Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="border-t border-gray-200 dark:border-dark-700 pt-6 mt-6"
        >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Example Sentences
              </h3>
              {showSentences && (
                <button
                  onClick={() => setShowSentences(false)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-dark-600 rounded transition-colors"
                  aria-label="Hide sentences"
                >
                  <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {!showSentences ? (
              <button
                onClick={loadSentences}
                className="px-6 py-2 bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/30 transition-colors"
              >
                Show Sentences <span className="text-xs opacity-60">(S)</span>
              </button>
            ) : (
              <div className="space-y-4">
                {sentences.length > 0 ? (
                  sentences.map((sentence, idx) => (
                    <motion.div
                      key={sentence.id || idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="bg-gray-50 dark:bg-dark-700 rounded-lg p-4"
                    >
                      <div className="flex items-start gap-2 mb-2">
                        <div className="flex-1 text-lg text-gray-900 dark:text-gray-100"
                             style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans CJK JP", sans-serif' }}>
                          {sentence.japanese}
                        </div>
                        <AudioButton
                          size="sm"
                          onPlay={() => play(sentence.japanese, { voice: '23', speed: 0.85 })}
                          loading={ttsLoading && currentText === sentence.japanese}
                          playing={ttsPlaying && currentText === sentence.japanese}
                        />
                        <AddToListButton
                          content={sentence.japanese}
                          type="sentence"
                          metadata={{
                            meaning: sentence.english || '',
                            notes: `Contains ${kanji.kanji}`,
                          }}
                          variant="bookmark"
                          size="small"
                        />
                      </div>
                      {sentence.english && (
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {sentence.english}
                        </div>
                      )}
                    </motion.div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                    No example sentences found for this kanji.
                  </p>
                )}
              </div>
            )}
          </motion.div>
      </motion.div>

      {/* Navigation Buttons */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex items-center justify-center gap-3"
      >
        <button
          onClick={onExit}
          className="p-2 bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-300 dark:hover:bg-dark-600 transition-all hover:scale-110"
          aria-label="Exit session (Esc)"
          title="Exit session (Esc)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <button
          onClick={handleContinue}
          className="p-2 bg-primary-500 text-white rounded-full hover:bg-primary-600 transition-all hover:scale-110"
          aria-label={currentIndex < totalKanji - 1 ? 'Next kanji (Enter)' : 'Continue to testing (Enter)'}
          title={currentIndex < totalKanji - 1 ? 'Next kanji (Enter)' : 'Continue to testing (Enter)'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </motion.div>
    </motion.div>
  )
}
