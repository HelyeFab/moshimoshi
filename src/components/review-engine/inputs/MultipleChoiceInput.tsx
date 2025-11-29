'use client'

import { useState, useEffect, useMemo } from 'react'
import { ReviewableContent } from '@/lib/review-engine/core/interfaces'
import { ReviewMode } from '@/lib/review-engine/core/types'
import { motion } from 'framer-motion'

interface OptionItem {
  display: string  // What to show to the user
  value: string    // What to submit as the answer (primaryAnswer)
}

interface MultipleChoiceInputProps {
  content: ReviewableContent
  contentPool?: ReviewableContent[]  // Pool of all available content for generating options
  mode?: ReviewMode  // Review mode to determine display format
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
  showAnswer
}: MultipleChoiceInputProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null)

  // Determine if we should show kana characters instead of romaji
  // In listening mode for kana, show the actual kana characters
  const showKanaDisplay = mode === 'listening' && content.contentType === 'kana'

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
          value: item.primaryAnswer
        }))
      }
    }

    // If we still don't have enough options, add generic distractors
    if (wrongOptions.length < 3) {
      // For kanji, use common kanji characters as distractors
      if (content.contentType === 'kanji') {
        const genericKanjiDistractors = [
          '人', '水', '火', '土', '山', '川', '木', '日', '月', '金',
          '家', '学', '本', '手', '目', '口', '車', '道', '大', '小',
          '空', '雨', '風', '石', '花', '草', '鳥', '魚', '中', '上',
          '下', '左', '右', '前', '後', '内', '外', '間', '時', '分'
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
            { display: 'あ', value: 'a' }, { display: 'い', value: 'i' },
            { display: 'う', value: 'u' }, { display: 'え', value: 'e' },
            { display: 'お', value: 'o' }, { display: 'か', value: 'ka' },
            { display: 'き', value: 'ki' }, { display: 'く', value: 'ku' },
            { display: 'け', value: 'ke' }, { display: 'こ', value: 'ko' },
            { display: 'さ', value: 'sa' }, { display: 'し', value: 'shi' },
            { display: 'す', value: 'su' }, { display: 'せ', value: 'se' },
            { display: 'そ', value: 'so' }, { display: 'た', value: 'ta' },
            { display: 'ち', value: 'chi' }, { display: 'つ', value: 'tsu' },
            { display: 'て', value: 'te' }, { display: 'と', value: 'to' },
            { display: 'な', value: 'na' }, { display: 'に', value: 'ni' },
            { display: 'ぬ', value: 'nu' }, { display: 'ね', value: 'ne' },
            { display: 'の', value: 'no' }, { display: 'は', value: 'ha' },
            { display: 'ひ', value: 'hi' }, { display: 'ふ', value: 'fu' },
            { display: 'へ', value: 'he' }, { display: 'ほ', value: 'ho' },
            { display: 'ま', value: 'ma' }, { display: 'み', value: 'mi' },
            { display: 'む', value: 'mu' }, { display: 'め', value: 'me' },
            { display: 'も', value: 'mo' }, { display: 'や', value: 'ya' },
            { display: 'ゆ', value: 'yu' }, { display: 'よ', value: 'yo' },
            { display: 'ら', value: 'ra' }, { display: 'り', value: 'ri' },
            { display: 'る', value: 'ru' }, { display: 'れ', value: 're' },
            { display: 'ろ', value: 'ro' }, { display: 'わ', value: 'wa' },
            { display: 'を', value: 'wo' }, { display: 'ん', value: 'n' }
          ]

          const existingValues = new Set(wrongOptions.map(o => o.value))
          const availableDistractors = genericKanaDistractors.filter(d =>
            !validAnswers.has(d.value) && !existingValues.has(d.value)
          )

          while (wrongOptions.length < 3 && availableDistractors.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableDistractors.length)
            const distractor = availableDistractors.splice(randomIndex, 1)[0]
            wrongOptions.push(distractor)
          }
        } else {
          // For kana in RECOGNITION mode, we need romaji options
          const genericRomajiDistractors = [
            'a', 'i', 'u', 'e', 'o', 'ka', 'ki', 'ku', 'ke', 'ko',
            'sa', 'shi', 'su', 'se', 'so', 'ta', 'chi', 'tsu', 'te', 'to',
            'na', 'ni', 'nu', 'ne', 'no', 'ha', 'hi', 'fu', 'he', 'ho',
            'ma', 'mi', 'mu', 'me', 'mo', 'ya', 'yu', 'yo', 'ra', 'ri',
            'ru', 're', 'ro', 'wa', 'wo', 'n',
            'ga', 'gi', 'gu', 'ge', 'go', 'za', 'ji', 'zu', 'ze', 'zo',
            'da', 'di', 'du', 'de', 'do', 'ba', 'bi', 'bu', 'be', 'bo',
            'pa', 'pi', 'pu', 'pe', 'po'
          ]

          const existingValues = new Set(wrongOptions.map(o => o.value))
          const availableDistractors = genericRomajiDistractors.filter(d =>
            !validAnswers.has(d) && !existingValues.has(d)
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
      value: correctAnswer
    }

    // Combine correct answer with wrong answers and shuffle
    const allOptions = [correctOption, ...wrongOptions]
      .slice(0, 4)  // Ensure we have at most 4 options

    // Shuffle using a stable random based on content ID to prevent re-shuffling
    const seed = content.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const shuffled = [...allOptions].sort((a, b) => {
      const hashA = (a.display.charCodeAt(0) + seed) % 100
      const hashB = (b.display.charCodeAt(0) + seed) % 100
      return hashA - hashB
    })

    return shuffled
  }, [content.id, content.primaryAnswer, content.primaryDisplay, content.alternativeAnswers, contentPool, showKanaDisplay])

  // Reset selected option when content changes
  useEffect(() => {
    setSelectedOption(null)
  }, [content.id])

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
    <div className="mt-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
        {options.map((option, index) => (
          <motion.button
            key={option.value}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => handleSelect(option)}
            disabled={disabled}
            className={`
              p-4 rounded-lg border-2 border-gray-200 dark:border-gray-600
              transition-all duration-200 font-medium
              ${getOptionClass(option)}
              ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <span className="flex items-center justify-center">
              <span className="mr-2 text-gray-400">
                {String.fromCharCode(65 + index)}.
              </span>
              <span className={showKanaDisplay ? 'font-japanese text-2xl' : ''}>
                {option.display}
              </span>
            </span>
          </motion.button>
        ))}
      </div>

      {showAnswer && selectedOption && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center mt-4"
        >
          {selectedOption === content.primaryAnswer ? (
            <span className="text-green-600 font-semibold">Correct!</span>
          ) : (
            <span className="text-red-600 font-semibold">
              Incorrect. The answer is: {showKanaDisplay ? content.primaryDisplay : content.primaryAnswer}
            </span>
          )}
        </motion.div>
      )}
    </div>
  )
}
