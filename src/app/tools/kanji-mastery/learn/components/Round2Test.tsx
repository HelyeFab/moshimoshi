'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { KanjiWithExamples } from '../LearnContent'

interface Round2TestProps {
  kanji: KanjiWithExamples
  currentIndex: number
  totalKanji: number
  onComplete: (results: Array<{ type: string; correct: boolean; userAnswer?: string }>) => void
}

type TestType = 'meaning' | 'onyomi' | 'kunyomi' | 'recognition'

export default function Round2Test({ kanji, currentIndex, totalKanji, onComplete }: Round2TestProps) {
  const [currentTest, setCurrentTest] = useState(0)
  const [results, setResults] = useState<Array<{ type: string; correct: boolean; userAnswer?: string }>>([])
  const [userInput, setUserInput] = useState('')
  const [showResult, setShowResult] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)

  // Define test sequence
  const tests: Array<{ type: TestType; question: string; answer: string | string[] }> = [
    {
      type: 'meaning',
      question: `What is the meaning of ${kanji.kanji}?`,
      answer: kanji.meaning.toLowerCase()
    },
    {
      type: 'onyomi',
      question: `What is the on'yomi reading of ${kanji.kanji}?`,
      answer: kanji.onyomi || []
    },
    {
      type: 'kunyomi',
      question: `What is the kun'yomi reading of ${kanji.kanji}?`,
      answer: kanji.kunyomi || []
    },
    {
      type: 'recognition',
      question: `Which kanji means "${kanji.meaning}"?`,
      answer: kanji.kanji
    }
  ].filter(test => {
    // Skip tests that don't have answers
    if (test.type === 'onyomi' && (!kanji.onyomi || kanji.onyomi.length === 0)) return false
    if (test.type === 'kunyomi' && (!kanji.kunyomi || kanji.kunyomi.length === 0)) return false
    return true
  })

  const currentTestData = tests[currentTest]

  const checkAnswer = () => {
    if (!currentTestData) return

    let correct = false
    const normalizedInput = userInput.trim().toLowerCase()

    if (currentTestData.type === 'meaning') {
      // Check if the meaning matches (allow partial matches)
      correct = normalizedInput === currentTestData.answer ||
                currentTestData.answer.toString().includes(normalizedInput) ||
                normalizedInput.includes(currentTestData.answer.toString())
    } else if (currentTestData.type === 'recognition') {
      correct = userInput.trim() === currentTestData.answer
    } else {
      // For readings, check if input matches any of the readings
      const answers = Array.isArray(currentTestData.answer) ? currentTestData.answer : [currentTestData.answer]
      correct = answers.some(answer =>
        answer.toLowerCase() === normalizedInput ||
        answer.replace(/[-.]/g, '') === normalizedInput.replace(/[-.]/g, '')
      )
    }

    setIsCorrect(correct)
    setShowResult(true)

    const newResult = {
      type: currentTestData.type,
      correct,
      userAnswer: userInput
    }

    setResults([...results, newResult])
  }

  const handleNext = () => {
    if (currentTest < tests.length - 1) {
      setCurrentTest(currentTest + 1)
      setUserInput('')
      setShowResult(false)
      setIsCorrect(false)
    } else {
      // Complete this kanji's tests
      onComplete(results)
    }
  }

  const handleSkip = () => {
    const newResult = {
      type: currentTestData.type,
      correct: false,
      userAnswer: 'skipped'
    }
    setResults([...results, newResult])
    handleNext()
  }

  if (currentTestData.type === 'recognition') {
    // Multiple choice for kanji recognition
    const options = generateKanjiOptions(kanji.kanji, 4)

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Round 2: Test
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Kanji {currentIndex + 1} of {totalKanji} • Test {currentTest + 1} of {tests.length}
          </p>
        </div>

        <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100 mb-6">
              {currentTestData.question}
            </h3>

            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
              {options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setUserInput(option)
                    setIsCorrect(option === kanji.kanji)
                    setShowResult(true)
                    setResults([...results, {
                      type: currentTestData.type,
                      correct: option === kanji.kanji,
                      userAnswer: option
                    }])
                  }}
                  disabled={showResult}
                  className={`
                    p-6 text-4xl font-bold rounded-lg transition-all
                    ${showResult
                      ? option === kanji.kanji
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-2 border-green-500'
                        : userInput === option
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-2 border-red-500'
                        : 'bg-gray-100 dark:bg-dark-700 text-gray-400 dark:text-gray-600'
                      : 'bg-gray-100 dark:bg-dark-700 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-dark-600'
                    }
                  `}
                  style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}
                >
                  {option}
                </button>
              ))}
            </div>

            {showResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6"
              >
                <p className={`text-lg font-medium ${isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {isCorrect ? '✅ Correct!' : '❌ Incorrect'}
                </p>
                {!isCorrect && (
                  <p className="text-gray-600 dark:text-gray-400 mt-2">
                    The correct answer is: {kanji.kanji}
                  </p>
                )}
              </motion.div>
            )}
          </div>

          {showResult && (
            <div className="flex justify-end">
              <button
                onClick={handleNext}
                className="px-6 py-3 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 transition-colors"
              >
                {currentTest < tests.length - 1 ? 'Next Test →' : 'Continue →'}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    )
  }

  // Text input for other test types
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Round 2: Test
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Kanji {currentIndex + 1} of {totalKanji} • Test {currentTest + 1} of {tests.length}
        </p>
      </div>

      <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          {currentTestData.type !== 'recognition' && (
            <div className="text-6xl font-bold text-gray-900 dark:text-gray-100 mb-6"
                 style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}>
              {kanji.kanji}
            </div>
          )}

          <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100 mb-6">
            {currentTestData.question}
          </h3>

          <div className="max-w-md mx-auto">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && userInput.trim()) {
                  checkAnswer()
                }
              }}
              disabled={showResult}
              placeholder="Type your answer..."
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-primary-500 disabled:bg-gray-100 dark:disabled:bg-dark-600"
              autoFocus
            />
          </div>

          {!showResult && (
            <div className="flex justify-center gap-4 mt-6">
              <button
                onClick={checkAnswer}
                disabled={!userInput.trim()}
                className="px-6 py-2 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 disabled:bg-gray-300 dark:disabled:bg-dark-600 disabled:text-gray-500 transition-colors"
              >
                Check Answer
              </button>
              <button
                onClick={handleSkip}
                className="px-6 py-2 bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-dark-600 transition-colors"
              >
                Skip
              </button>
            </div>
          )}

          {showResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6"
            >
              <p className={`text-lg font-medium ${isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {isCorrect ? '✅ Correct!' : '❌ Incorrect'}
              </p>
              {!isCorrect && (
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  The correct answer is: {
                    Array.isArray(currentTestData.answer)
                      ? currentTestData.answer.join(', ')
                      : currentTestData.answer
                  }
                </p>
              )}
            </motion.div>
          )}
        </div>

        {showResult && (
          <div className="flex justify-end">
            <button
              onClick={handleNext}
              className="px-6 py-3 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 transition-colors"
            >
              {currentTest < tests.length - 1 ? 'Next Test →' : 'Continue →'}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// Helper function to generate kanji options for multiple choice
function generateKanjiOptions(correct: string, count: number): string[] {
  // This would ideally pull from a pool of similar kanji
  // For now, just using some common kanji as distractors
  const distractors = ['水', '火', '木', '金', '土', '日', '月', '山', '川', '田', '人', '大', '小', '中', '上', '下']
    .filter(k => k !== correct)

  const shuffled = distractors.sort(() => Math.random() - 0.5).slice(0, count - 1)
  const options = [correct, ...shuffled]

  return options.sort(() => Math.random() - 0.5)
}