'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { ReviewableContent } from '@/lib/review-engine/core/interfaces'
import { ReviewMode } from '@/lib/review-engine/core/types'
import { motion } from 'framer-motion'
import { useTTS } from '@/hooks/useTTS'
import { Volume2, Loader2 } from 'lucide-react'

interface OptionItem {
  display: string // What to show to the user
  value: string // What to submit as the answer (primaryAnswer)
}

/**
 * Check if a string contains Japanese characters (Hiragana, Katakana, or Kanji)
 */
function containsJapanese(text: string): boolean {
  // Hiragana: \u3040-\u309F
  // Katakana: \u30A0-\u30FF
  // Kanji: \u4E00-\u9FAF
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)
}

/**
 * Check if text is a single character (used to filter out single kanji from TTS)
 */
function isSingleCharacter(text: string): boolean {
  return text.length === 1
}

/**
 * Check if TTS should be enabled for this content type
 * Enabled for: sentences, verbs/adjectives, and multi-character words from My Lists
 * NOT enabled for: kanji browser, kana review (single chars filtered at option level)
 */
function shouldEnableTTS(content: ReviewableContent): boolean {
  // Never enable TTS for kanji content (kanji browser)
  if (content.contentType === 'kanji') {
    return false
  }

  // Never enable TTS for kana content
  if (content.contentType === 'kana') {
    return false
  }

  // For custom content (My Lists), check the list type
  if (content.contentType === 'custom' && content.metadata?.listType) {
    const listType = content.metadata.listType as string
    // Enable for sentences, verbAdj, and words (single chars filtered per-option)
    return listType === 'sentence' || listType === 'verbAdj' || listType === 'word'
  }

  // Default: no TTS
  return false
}

interface MultipleChoiceInputProps {
  content: ReviewableContent
  contentPool?: ReviewableContent[] // Pool of all available content for generating options
  mode?: ReviewMode // Review mode to determine display format
  onAnswer: (answer: string, confidence?: number) => void
  disabled: boolean
  showAnswer: boolean
}

export default function MultipleChoiceInput({
  content,
  contentPool = [],
  mode = 'recognition',
  onAnswer,
  disabled,
  showAnswer,
}: MultipleChoiceInputProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [playingOptionIndex, setPlayingOptionIndex] = useState<number | null>(null)
  const [loadingOptionIndex, setLoadingOptionIndex] = useState<number | null>(null)

  // TTS hook for playing option audio
  const { play: playTTS, stop: stopTTS, playing: ttsPlaying, loading: ttsLoading, preload } = useTTS({
    cacheFirst: true,
    onEnd: () => {
      setPlayingOptionIndex(null)
    },
    onError: () => {
      setPlayingOptionIndex(null)
      setLoadingOptionIndex(null)
    }
  })

  // Determine if we should show kana characters instead of romaji
  // In listening mode for kana, show the actual kana characters
  const showKanaDisplay = mode === 'listening' && content.contentType === 'kana'

  // For kanji in recognition/listening mode, show kanji characters as large visual options
  const showKanjiDisplay = content.contentType === 'kanji' &&
    (mode === 'recognition' || mode === 'listening')

  // Generate options using useMemo to prevent reshuffling on every render
  const options = useMemo((): OptionItem[] => {
    // Generate options from the content pool
    const correctAnswer = content.primaryAnswer
    const correctDisplay = content.primaryDisplay

    // Collect all valid answers for this content (to avoid using them as distractors)
    const validAnswers = new Set([correctAnswer])
    if (content.alternativeAnswers) {
      content.alternativeAnswers.forEach(ans => validAnswers.add(ans))
    }

    // Generate wrong answers from the content pool
    let wrongOptions: OptionItem[] = []

    if (contentPool.length > 0) {
      // Filter out the current content and get other items from the pool
      const otherContent = contentPool.filter(item => item.id !== content.id)

      // For kanji content in recognition mode, we need kanji characters as options
      if (content.contentType === 'kanji') {
        // In recognition mode, we show the meaning and need kanji characters as options
        // The correct answer is the kanji character (primaryAnswer)
        // We need other kanji characters as distractors
        const shuffled = [...otherContent]
          .filter(item => item.contentType === 'kanji')
          .sort(() => Math.random() - 0.5)

        for (const item of shuffled) {
          if (wrongOptions.length >= 3) break

          // Use the kanji character from other items as distractors
          // primaryAnswer contains the kanji character for kanji content
          const kanjiChar = item.primaryAnswer
          if (kanjiChar && !validAnswers.has(kanjiChar)) {
            wrongOptions.push({ display: kanjiChar, value: kanjiChar })
          }
        }
      } else if (content.contentType === 'kana' && showKanaDisplay) {
        // For kana in LISTENING mode, we need kana characters as options
        const shuffled = [...otherContent]
          .filter(item => item.contentType === 'kana')
          .sort(() => Math.random() - 0.5)

        for (const item of shuffled) {
          if (wrongOptions.length >= 3) break
          if (!validAnswers.has(item.primaryAnswer)) {
            wrongOptions.push({ display: item.primaryDisplay, value: item.primaryAnswer })
          }
        }
      } else {
        // For non-kanji content or recognition mode, use the existing logic (romaji)
        const shuffled = [...otherContent].sort(() => Math.random() - 0.5)
        const filteredOptions = shuffled
          .slice(0, 3)
          .filter(item => !validAnswers.has(item.primaryAnswer))

        wrongOptions = filteredOptions.map(item => ({
          display: item.primaryAnswer,
          value: item.primaryAnswer,
        }))
      }
    }

    // If we still don't have enough options, add generic distractors
    if (wrongOptions.length < 3) {
      // For kanji, use common kanji characters as distractors
      if (content.contentType === 'kanji') {
        const genericKanjiDistractors = [
          '人',
          '水',
          '火',
          '土',
          '山',
          '川',
          '木',
          '日',
          '月',
          '金',
          '家',
          '学',
          '本',
          '手',
          '目',
          '口',
          '車',
          '道',
          '大',
          '小',
          '空',
          '雨',
          '風',
          '石',
          '花',
          '草',
          '鳥',
          '魚',
          '中',
          '上',
          '下',
          '左',
          '右',
          '前',
          '後',
          '内',
          '外',
          '間',
          '時',
          '分',
        ].filter(d => !validAnswers.has(d))

        while (wrongOptions.length < 3 && genericKanjiDistractors.length > 0) {
          const randomIndex = Math.floor(Math.random() * genericKanjiDistractors.length)
          const distractor = genericKanjiDistractors.splice(randomIndex, 1)[0]
          wrongOptions.push({ display: distractor, value: distractor })
        }
      } else if (content.contentType === 'kana') {
        if (showKanaDisplay) {
          // For kana in LISTENING mode, use hiragana characters as distractors
          const genericKanaDistractors = [
            { display: 'あ', value: 'a' },
            { display: 'い', value: 'i' },
            { display: 'う', value: 'u' },
            { display: 'え', value: 'e' },
            { display: 'お', value: 'o' },
            { display: 'か', value: 'ka' },
            { display: 'き', value: 'ki' },
            { display: 'く', value: 'ku' },
            { display: 'け', value: 'ke' },
            { display: 'こ', value: 'ko' },
            { display: 'さ', value: 'sa' },
            { display: 'し', value: 'shi' },
            { display: 'す', value: 'su' },
            { display: 'せ', value: 'se' },
            { display: 'そ', value: 'so' },
            { display: 'た', value: 'ta' },
            { display: 'ち', value: 'chi' },
            { display: 'つ', value: 'tsu' },
            { display: 'て', value: 'te' },
            { display: 'と', value: 'to' },
            { display: 'な', value: 'na' },
            { display: 'に', value: 'ni' },
            { display: 'ぬ', value: 'nu' },
            { display: 'ね', value: 'ne' },
            { display: 'の', value: 'no' },
            { display: 'は', value: 'ha' },
            { display: 'ひ', value: 'hi' },
            { display: 'ふ', value: 'fu' },
            { display: 'へ', value: 'he' },
            { display: 'ほ', value: 'ho' },
            { display: 'ま', value: 'ma' },
            { display: 'み', value: 'mi' },
            { display: 'む', value: 'mu' },
            { display: 'め', value: 'me' },
            { display: 'も', value: 'mo' },
            { display: 'や', value: 'ya' },
            { display: 'ゆ', value: 'yu' },
            { display: 'よ', value: 'yo' },
            { display: 'ら', value: 'ra' },
            { display: 'り', value: 'ri' },
            { display: 'る', value: 'ru' },
            { display: 'れ', value: 're' },
            { display: 'ろ', value: 'ro' },
            { display: 'わ', value: 'wa' },
            { display: 'を', value: 'wo' },
            { display: 'ん', value: 'n' },
          ]

          const existingValues = new Set(wrongOptions.map(o => o.value))
          const availableDistractors = genericKanaDistractors.filter(
            d => !validAnswers.has(d.value) && !existingValues.has(d.value)
          )

          while (wrongOptions.length < 3 && availableDistractors.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableDistractors.length)
            const distractor = availableDistractors.splice(randomIndex, 1)[0]
            wrongOptions.push(distractor)
          }
        } else {
          // For kana in RECOGNITION mode, we need romaji options
          const genericRomajiDistractors = [
            'a',
            'i',
            'u',
            'e',
            'o',
            'ka',
            'ki',
            'ku',
            'ke',
            'ko',
            'sa',
            'shi',
            'su',
            'se',
            'so',
            'ta',
            'chi',
            'tsu',
            'te',
            'to',
            'na',
            'ni',
            'nu',
            'ne',
            'no',
            'ha',
            'hi',
            'fu',
            'he',
            'ho',
            'ma',
            'mi',
            'mu',
            'me',
            'mo',
            'ya',
            'yu',
            'yo',
            'ra',
            'ri',
            'ru',
            're',
            'ro',
            'wa',
            'wo',
            'n',
            'ga',
            'gi',
            'gu',
            'ge',
            'go',
            'za',
            'ji',
            'zu',
            'ze',
            'zo',
            'da',
            'di',
            'du',
            'de',
            'do',
            'ba',
            'bi',
            'bu',
            'be',
            'bo',
            'pa',
            'pi',
            'pu',
            'pe',
            'po',
          ]

          const existingValues = new Set(wrongOptions.map(o => o.value))
          const availableDistractors = genericRomajiDistractors.filter(
            d => !validAnswers.has(d) && !existingValues.has(d)
          )

          while (wrongOptions.length < 3 && availableDistractors.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableDistractors.length)
            const distractor = availableDistractors.splice(randomIndex, 1)[0]
            wrongOptions.push({ display: distractor, value: distractor })
          }
        }
      }
    }

    // If we STILL don't have enough options (rare edge case)
    if (wrongOptions.length < 3) {
      if (process.env.NODE_ENV === 'development') {
        console.debug(`Using fallback distractors. Pool size insufficient for 4 unique options.`)
      }
    }

    // Create correct option with proper display
    const correctOption: OptionItem = {
      display: showKanaDisplay ? correctDisplay : correctAnswer,
      value: correctAnswer,
    }

    // Combine correct answer with wrong answers and shuffle
    const allOptions = [correctOption, ...wrongOptions].slice(0, 4) // Ensure we have at most 4 options

    // Shuffle using a stable random based on content ID to prevent re-shuffling
    const seed = content.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const shuffled = [...allOptions].sort((a, b) => {
      const hashA = (a.display.charCodeAt(0) + seed) % 100
      const hashB = (b.display.charCodeAt(0) + seed) % 100
      return hashA - hashB
    })

    return shuffled
  }, [
    content.id,
    content.primaryAnswer,
    content.primaryDisplay,
    content.alternativeAnswers,
    contentPool,
    showKanaDisplay,
  ])

  // Reset selected option and TTS state when content changes
  useEffect(() => {
    setSelectedOption(null)
    setPlayingOptionIndex(null)
    setLoadingOptionIndex(null)
    stopTTS()
  }, [content.id, stopTTS])

  // Check if TTS should be enabled for this content
  const ttsEnabled = shouldEnableTTS(content)

  // Preload TTS audio for all Japanese options when they're generated (only if TTS enabled)
  // Filter out single characters (single kanji) from preloading
  useEffect(() => {
    if (!ttsEnabled) return

    const japaneseTexts = options
      .filter(opt => containsJapanese(opt.display) && !isSingleCharacter(opt.display))
      .map(opt => opt.display)

    if (japaneseTexts.length > 0) {
      // Preload in background (fire and forget)
      // Don't specify voice - let VOICEVOX use default speaker
      preload(japaneseTexts, { speed: 0.85 }).catch(() => {
        // Silently ignore preload errors
      })
    }
  }, [options, preload, ttsEnabled])

  // Handle TTS play for an option
  const handleTTSPlay = useCallback(async (e: React.MouseEvent, option: OptionItem, index: number) => {
    e.stopPropagation() // Prevent selecting the option

    // If already playing this option, stop it
    if (playingOptionIndex === index) {
      stopTTS()
      setPlayingOptionIndex(null)
      return
    }

    // Stop any currently playing audio
    if (playingOptionIndex !== null) {
      stopTTS()
    }

    setLoadingOptionIndex(index)
    setPlayingOptionIndex(index)

    try {
      await playTTS(option.display, {
        speed: 0.85,
      })
    } catch (error) {
      console.error('TTS playback failed:', error)
    } finally {
      setLoadingOptionIndex(null)
    }
  }, [playingOptionIndex, playTTS, stopTTS])

  const handleSelect = (option: OptionItem) => {
    if (disabled) return
    setSelectedOption(option.value)
    onAnswer(option.value, 1.0) // Full confidence for multiple choice
  }

  const getOptionClass = (option: OptionItem) => {
    if (!showAnswer) {
      return selectedOption === option.value
        ? 'bg-primary text-white'
        : 'bg-soft-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
    }

    const isCorrect = option.value === content.primaryAnswer
    const isSelected = selectedOption === option.value

    if (isCorrect) {
      return 'bg-green-500 text-white'
    } else if (isSelected) {
      return 'bg-red-500 text-white'
    } else {
      return 'bg-gray-100 dark:bg-gray-700 opacity-50'
    }
  }

  return (
    <div className="mt-2 sm:mt-4">
      <div className="grid grid-cols-2 gap-2 sm:gap-4 max-w-2xl mx-auto">
        {options.map((option, index) => (
          <motion.div
            key={option.value}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => !disabled && handleSelect(option)}
            role="button"
            tabIndex={disabled ? -1 : 0}
            onKeyDown={(e) => {
              if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                handleSelect(option)
              }
            }}
            className={`
              relative p-3 sm:p-4 rounded-lg border-2 border-gray-200 dark:border-gray-600
              transition-all duration-200 font-medium min-h-[60px] sm:min-h-[80px]
              ${getOptionClass(option)}
              ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {/* Option letter in top-left corner */}
            <span className={`absolute top-1.5 left-2 sm:top-2 sm:left-3 text-xs sm:text-sm font-semibold opacity-60`}>
              {String.fromCharCode(65 + index)}
            </span>

            {/* TTS speaker icon in top-right corner (only for multi-char Japanese text, not single kanji) */}
            {ttsEnabled && containsJapanese(option.display) && !isSingleCharacter(option.display) && (
              <button
                type="button"
                onClick={(e) => handleTTSPlay(e, option, index)}
                disabled={disabled}
                className={`
                  absolute top-1 right-1 sm:top-1.5 sm:right-1.5 p-1 sm:p-1.5 rounded-full
                  transition-all duration-200 z-10
                  ${loadingOptionIndex === index
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-500'
                    : playingOptionIndex === index
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 scale-110'
                      : 'text-gray-400 hover:text-primary-500 hover:bg-gray-100 dark:hover:bg-gray-700 opacity-70 hover:opacity-100'
                  }
                `}
                aria-label={playingOptionIndex === index ? 'Stop audio' : 'Play audio'}
                title={playingOptionIndex === index ? 'Stop' : 'Play'}
              >
                {loadingOptionIndex === index ? (
                  <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                ) : (
                  <Volume2 className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${playingOptionIndex === index ? 'animate-pulse' : ''}`} />
                )}
              </button>
            )}

            {/* Option content centered - with padding to avoid letter label and audio icon */}
            <span className="flex items-center justify-center w-full h-full pt-5 sm:pt-6 px-2 sm:px-3">
              <span
                className={
                  showKanjiDisplay
                    ? 'font-japanese text-3xl sm:text-4xl'
                    : showKanaDisplay
                      ? 'font-japanese text-xl sm:text-2xl'
                      : 'text-sm sm:text-base'
                }
              >
                {option.display}
              </span>
            </span>
          </motion.div>
        ))}
      </div>

      {showAnswer && selectedOption && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center mt-2 sm:mt-4"
        >
          {selectedOption === content.primaryAnswer ? (
            <span className="text-green-600 font-semibold text-sm sm:text-base">Correct!</span>
          ) : (
            <div className="text-red-600 font-semibold text-sm sm:text-base">
              <div>Incorrect. The answer is:</div>
              <div className={`mt-1 ${showKanjiDisplay ? 'font-japanese text-2xl sm:text-3xl' : showKanaDisplay ? 'font-japanese text-lg sm:text-xl' : 'font-japanese text-lg'}`}>
                {showKanaDisplay ? content.primaryDisplay : content.primaryAnswer}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
