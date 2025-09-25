'use client'

import { useState, useEffect, useMemo } from 'react'
import { ReviewableContent } from '@/lib/review-engine/core/interfaces'
import { motion } from 'framer-motion'

interface MultipleChoiceInputProps {
  content: ReviewableContent
  contentPool?: ReviewableContent[]  // Pool of all available content for generating options
  onAnswer: (answer: string, confidence?: number) => void
  disabled: boolean
  showAnswer: boolean
}

export default function MultipleChoiceInput({
  content,
  contentPool = [],
  onAnswer,
  disabled,
  showAnswer
}: MultipleChoiceInputProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null)

  // Generate options using useMemo to prevent reshuffling on every render
  const options = useMemo(() => {
    // Generate options from the content pool
    const correctAnswer = content.primaryAnswer

    // Collect all valid answers for this content (to avoid using them as distractors)
    const validAnswers = new Set([correctAnswer])
    if (content.alternativeAnswers) {
      content.alternativeAnswers.forEach(ans => validAnswers.add(ans))
    }

    // Generate wrong answers from the content pool
    let wrongAnswers: string[] = []

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
          if (wrongAnswers.length >= 3) break

          // Use the kanji character from other items as distractors
          // primaryAnswer contains the kanji character for kanji content
          const kanjiChar = item.primaryAnswer
          if (kanjiChar && !validAnswers.has(kanjiChar)) {
            wrongAnswers.push(kanjiChar)
          }
        }
      } else {
        // For non-kanji content, use the existing logic
        const shuffled = [...otherContent].sort(() => Math.random() - 0.5)
        wrongAnswers = shuffled
          .slice(0, 3)
          .map(item => item.primaryAnswer)
          .filter(ans => !validAnswers.has(ans)) // Still filter out valid answers
      }
    }

    // If we still don't have enough options, add generic distractors
    if (wrongAnswers.length < 3) {
      // For kanji, use common kanji characters as distractors
      if (content.contentType === 'kanji') {
        const genericKanjiDistractors = [
          '人', '水', '火', '土', '山', '川', '木', '日', '月', '金',
          '家', '学', '本', '手', '目', '口', '車', '道', '大', '小',
          '空', '雨', '風', '石', '花', '草', '鳥', '魚', '中', '上',
          '下', '左', '右', '前', '後', '内', '外', '間', '時', '分'
        ].filter(d => !validAnswers.has(d))

        while (wrongAnswers.length < 3 && genericKanjiDistractors.length > 0) {
          const randomIndex = Math.floor(Math.random() * genericKanjiDistractors.length)
          const distractor = genericKanjiDistractors.splice(randomIndex, 1)[0]
          wrongAnswers.push(distractor)
        }
      } else if (content.contentType === 'kana') {
        // For kana in recognition mode, we need romaji options (not kana characters)
        // The correct answer is already the romaji (e.g., 'i' for い)
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

        // Filter out the correct answer and any existing wrong answers
        const availableDistractors = genericRomajiDistractors.filter(d =>
          !validAnswers.has(d) && !wrongAnswers.includes(d)
        )

        while (wrongAnswers.length < 3 && availableDistractors.length > 0) {
          const randomIndex = Math.floor(Math.random() * availableDistractors.length)
          const distractor = availableDistractors.splice(randomIndex, 1)[0]
          wrongAnswers.push(distractor)
        }
      }
    }
    
    // If we STILL don't have enough options (rare edge case)
    // This can happen with very small selections - not a problem since we have fallbacks
    if (wrongAnswers.length < 3) {
      // Only log in development mode to avoid console spam
      if (process.env.NODE_ENV === 'development') {
        console.debug(`Using fallback distractors. Pool size insufficient for 4 unique options.`)
      }
    }
    
    // Combine correct answer with wrong answers and shuffle
    const allOptions = [correctAnswer, ...wrongAnswers]
      .slice(0, 4)  // Ensure we have at most 4 options

    // Shuffle using a stable random based on content ID to prevent re-shuffling
    // Use a simple deterministic shuffle based on the content ID
    const seed = content.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const shuffled = [...allOptions].sort((a, b) => {
      const hashA = (a.charCodeAt(0) + seed) % 100
      const hashB = (b.charCodeAt(0) + seed) % 100
      return hashA - hashB
    })

    return shuffled
  }, [content.id, content.primaryAnswer, content.alternativeAnswers, contentPool])

  // Reset selected option when content changes
  useEffect(() => {
    setSelectedOption(null)
  }, [content.id])
  
  const handleSelect = (option: string) => {
    if (disabled) return
    setSelectedOption(option)
    onAnswer(option, 1.0) // Full confidence for multiple choice
  }
  
  const getOptionClass = (option: string) => {
    if (!showAnswer) {
      return selectedOption === option
        ? 'bg-primary text-white'
        : 'bg-soft-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
    }
    
    const isCorrect = option === content.primaryAnswer
    const isSelected = selectedOption === option
    
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
            key={option}
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
              {option}
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
            <span className="text-green-600 font-semibold">✓ Correct!</span>
          ) : (
            <span className="text-red-600 font-semibold">
              ✗ Incorrect. The answer is: {content.primaryAnswer}
            </span>
          )}
        </motion.div>
      )}
    </div>
  )
}