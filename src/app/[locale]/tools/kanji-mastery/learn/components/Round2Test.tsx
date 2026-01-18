'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { KanjiWithExamples } from '../LearnContent'
import { CheckCircle, XCircle } from 'lucide-react'

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

  // Reset state when kanji changes
  useEffect(() => {
    setCurrentTest(0)
    setResults([])
    setUserInput('')
    setShowResult(false)
    setIsCorrect(false)
  }, [kanji.kanji])

  // Define test sequence
  const allTests: Array<{ type: TestType; question: string; answer: string | string[] }> = [
    {
      type: 'meaning' as const,
      question: `What is the meaning of ${kanji.kanji}?`,
      answer: kanji.meaning.toLowerCase()
    },
    {
      type: 'onyomi' as const,
      question: `What is the on'yomi reading of ${kanji.kanji}?`,
      answer: kanji.onyomi || []
    },
    {
      type: 'kunyomi' as const,
      question: `What is the kun'yomi reading of ${kanji.kanji}?`,
      answer: kanji.kunyomi || []
    },
    {
      type: 'recognition' as const,
      question: `Which kanji means "${kanji.meaning}"?`,
      answer: kanji.kanji
    }
  ]

  const tests = allTests.filter(test => {
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
      // Support both Japanese (hiragana) and romanji input
      const answers = Array.isArray(currentTestData.answer) ? currentTestData.answer : [currentTestData.answer]

      // Convert romanji to hiragana if the input contains romanji
      const hiraganaInput = /[a-z]/i.test(normalizedInput) ? romajiToHiragana(normalizedInput) : normalizedInput

      correct = answers.some(answer => {
        const normalizedAnswer = answer.toLowerCase().replace(/[-.]/g, '')
        const cleanInput = normalizedInput.replace(/[-.]/g, '')
        const cleanHiraganaInput = hiraganaInput.replace(/[-.]/g, '')

        // Convert katakana to hiragana for comparison (on'yomi are in katakana)
        const answerInHiragana = katakanaToHiragana(normalizedAnswer)

        // Check: original input OR hiragana-converted input against both katakana and hiragana
        return normalizedAnswer === cleanInput ||
               normalizedAnswer === cleanHiraganaInput ||
               answerInHiragana === cleanHiraganaInput
      })
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
                <p className={`text-lg font-medium flex items-center justify-center gap-2 ${isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {isCorrect ? <><CheckCircle className="w-5 h-5" /> Correct!</> : <><XCircle className="w-5 h-5" /> Incorrect</>}
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
            <div className="flex justify-center mt-4">
              <button
                onClick={handleNext}
                className="p-2 bg-primary-500 text-white rounded-full hover:bg-primary-600 transition-all hover:scale-110"
                aria-label="Continue"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
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
          {/* Kanji display for meaning/reading tests (not recognition - that's handled above with early return) */}
          <div className="text-6xl font-bold text-gray-900 dark:text-gray-100 mb-6"
               style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}>
            {kanji.kanji}
          </div>

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
            <div className="flex justify-center gap-3 mt-6">
              <button
                onClick={handleSkip}
                className="p-2 bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-300 dark:hover:bg-dark-600 transition-all hover:scale-110"
                aria-label="Skip"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
              <button
                onClick={checkAnswer}
                disabled={!userInput.trim()}
                className="p-2 bg-green-500 text-white rounded-full hover:bg-green-600 disabled:bg-gray-300 dark:disabled:bg-dark-600 disabled:text-gray-500 transition-all hover:scale-110 disabled:hover:scale-100"
                aria-label="Check answer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </div>
          )}

          {showResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6"
            >
              <p className={`text-lg font-medium flex items-center justify-center gap-2 ${isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {isCorrect ? <><CheckCircle className="w-5 h-5" /> Correct!</> : <><XCircle className="w-5 h-5" /> Incorrect</>}
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
          <div className="flex justify-center mt-4">
            <button
              onClick={handleNext}
              className="p-2 bg-primary-500 text-white rounded-full hover:bg-primary-600 transition-all hover:scale-110"
              aria-label="Continue"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// Helper function to convert katakana to hiragana
function katakanaToHiragana(input: string): string {
  return input.replace(/[\u30A1-\u30F6]/g, (match) => {
    const code = match.charCodeAt(0) - 0x60
    return String.fromCharCode(code)
  })
}

// Helper function to convert romanji to hiragana
function romajiToHiragana(input: string): string {
  if (!/[a-z]/.test(input)) return input

  const map: Record<string, string> = {
    kya: 'きゃ', kyu: 'きゅ', kyo: 'きょ',
    gya: 'ぎゃ', gyu: 'ぎゅ', gyo: 'ぎょ',
    sha: 'しゃ', shu: 'しゅ', sho: 'しょ',
    ja: 'じゃ', ju: 'じゅ', jo: 'じょ',
    cha: 'ちゃ', chu: 'ちゅ', cho: 'ちょ',
    nya: 'にゃ', nyu: 'にゅ', nyo: 'にょ',
    hya: 'ひゃ', hyu: 'ひゅ', hyo: 'ひょ',
    mya: 'みゃ', myu: 'みゅ', myo: 'みょ',
    rya: 'りゃ', ryu: 'りゅ', ryo: 'りょ',
    bya: 'びゃ', byu: 'びゅ', byo: 'びょ',
    pya: 'ぴゃ', pyu: 'ぴゅ', pyo: 'ぴょ',
    shi: 'し', chi: 'ち', tsu: 'つ', fu: 'ふ',
    ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ',
    sa: 'さ', su: 'す', se: 'せ', so: 'そ',
    ta: 'た', te: 'て', to: 'と',
    na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の',
    ha: 'は', hi: 'ひ', he: 'へ', ho: 'ほ',
    ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も',
    ya: 'や', yu: 'ゆ', yo: 'よ',
    ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ',
    wa: 'わ', wo: 'を',
    ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
    za: 'ざ', ji: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ',
    da: 'だ', de: 'で', do: 'ど',
    ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ',
    pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ',
    a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
  }

  let result = ''
  let i = 0
  const text = input.toLowerCase()

  while (i < text.length) {
    const three = text.slice(i, i + 3)
    const two = text.slice(i, i + 2)
    const current = text[i]
    const next = text[i + 1]

    // Double consonant -> っ
    if (next && current === next && !'aeiou'.includes(current) && current !== 'n') {
      result += 'っ'
      i += 1
      continue
    }

    // Try 3-char match
    if (map[three]) {
      result += map[three]
      i += 3
      continue
    }

    // Try 2-char match
    if (map[two]) {
      result += map[two]
      i += 2
      continue
    }

    // Handle 'n' -> ん
    if (current === 'n') {
      const following = text[i + 1]
      if (!following || !'aeiouy'.includes(following)) {
        result += 'ん'
        i += 1
        continue
      }
    }

    // Try 1-char match
    if (map[current]) {
      result += map[current]
      i += 1
      continue
    }

    // Keep as-is
    result += current
    i += 1
  }

  return result
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