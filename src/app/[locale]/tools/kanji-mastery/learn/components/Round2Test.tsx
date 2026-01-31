'use client'

import React, { useMemo, useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { KanjiWithExamples } from '../LearnContent'
import { CheckCircle, XCircle } from 'lucide-react'
import { buildRound2TestSequence, type TestDefinition, type TestType } from '../testOrder'
import { useI18n } from '@/i18n/I18nContext'

interface Round2TestProps {
  kanji: KanjiWithExamples
  currentIndex: number
  totalKanji: number
  onComplete: (
    results: Array<{ type: TestType; correct: boolean; userAnswer?: string }>,
    lastTestType: TestType | null
  ) => void
  onExit: () => void
  testMode: 'recall' | 'choice'
  distractorPool?: KanjiWithExamples[]
  enableRandomizedOrder: boolean
  lastTestType?: TestType | null
}

export default function Round2Test({
  kanji,
  currentIndex,
  totalKanji,
  onComplete,
  onExit,
  testMode,
  distractorPool = [],
  enableRandomizedOrder,
  lastTestType = null
}: Round2TestProps) {
  const { t } = useI18n()
  type Round2Result = { type: TestType; correct: boolean; userAnswer?: string }
  const [currentTest, setCurrentTest] = useState(0)
  const [results, setResults] = useState<Round2Result[]>([])
  const [userInput, setUserInput] = useState('')
  const [showResult, setShowResult] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [recognitionOptions, setRecognitionOptions] = useState<string[]>([])
  const [choiceOptions, setChoiceOptions] = useState<string[]>([])
  const [showShortcuts, setShowShortcuts] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const isDesktopShortcutsEnabled = () => {
    if (typeof window === 'undefined') return false
    if (window.matchMedia) {
      return window.matchMedia('(hover: hover) and (pointer: fine)').matches
    }
    return window.innerWidth >= 768
  }

  // Reset state when kanji changes
  useEffect(() => {
    setCurrentTest(0)
    setResults([])
    setUserInput('')
    setShowResult(false)
    setIsCorrect(false)
    setRecognitionOptions([])
    setChoiceOptions([])
  }, [kanji.kanji])

  const legacyTests: TestDefinition[] = useMemo(() => {
    const allTests: TestDefinition[] = [
      {
        type: 'meaning',
        question: t('kanjiMasteryTool.round2Questions.meaning', { kanji: kanji.kanji }),
        answer: kanji.meaning.toLowerCase()
      },
      {
        type: 'onyomi',
        question: t('kanjiMasteryTool.round2Questions.onyomi', { kanji: kanji.kanji }),
        answer: kanji.onyomi || []
      },
      {
        type: 'kunyomi',
        question: t('kanjiMasteryTool.round2Questions.kunyomi', { kanji: kanji.kanji }),
        answer: kanji.kunyomi || []
      },
      {
        type: 'recognition',
        question: t('kanjiMasteryTool.round2Questions.recognition', { meaning: kanji.meaning }),
        answer: kanji.kanji
      }
    ]

    return allTests.filter(test => {
      if (test.type === 'onyomi' && (!kanji.onyomi || kanji.onyomi.length === 0)) return false
      if (test.type === 'kunyomi' && (!kanji.kunyomi || kanji.kunyomi.length === 0)) return false
      return true
    })
  }, [kanji.kanji, kanji.kunyomi, kanji.meaning, kanji.onyomi, t])

  const tests = useMemo(() => {
    if (!enableRandomizedOrder) {
      return legacyTests
    }
    return buildRound2TestSequence(kanji, {
      lastTestType,
      forbidOnKunAdjacency: true,
      questionOverrides: {
        meaning: t('kanjiMasteryTool.round2Questions.meaning', { kanji: kanji.kanji }),
        onyomi: t('kanjiMasteryTool.round2Questions.onyomi', { kanji: kanji.kanji }),
        kunyomi: t('kanjiMasteryTool.round2Questions.kunyomi', { kanji: kanji.kanji }),
        recognition: t('kanjiMasteryTool.round2Questions.recognition', { meaning: kanji.meaning })
      }
    })
  }, [enableRandomizedOrder, kanji, lastTestType, legacyTests, t])

  const currentTestData = tests[currentTest]

  useEffect(() => {
    if (currentTestData?.type === 'recognition') {
      const options = generateKanjiOptions(kanji.kanji, 4, distractorPool)
      if (process.env.NODE_ENV !== 'production') {
        const correctIndex = options.indexOf(kanji.kanji)
        console.log('[Round2Test] recognition options', {
          kanji: kanji.kanji,
          options,
          correctIndex
        })
      }
      setRecognitionOptions(options)
    } else if (testMode === 'choice' && currentTestData?.type) {
      setChoiceOptions(buildMultipleChoiceOptions(currentTestData.type, kanji, distractorPool, 4))
    }
  }, [currentTestData?.type, kanji, distractorPool, testMode])

  const shouldUseMultipleChoice = testMode === 'choice'
  const multipleChoiceOptions = shouldUseMultipleChoice ? choiceOptions : []
  const useMultipleChoice = shouldUseMultipleChoice && multipleChoiceOptions.length === 4
  const recognitionChoices = currentTestData?.type === 'recognition'
    ? (recognitionOptions.length > 0
      ? recognitionOptions
      : generateKanjiOptions(kanji.kanji, 4, distractorPool))
    : []

  useEffect(() => {
    if (!currentTestData) return
    if (currentTestData.type === 'recognition') return
    if (useMultipleChoice) return

    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }, [currentTest, currentTestData?.type, useMultipleChoice])

  const checkAnswer = (inputOverride?: string) => {
    if (!currentTestData) return

    let correct = false
    const normalizedInput = (inputOverride ?? userInput).trim().toLowerCase()

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
      const finalTestType = tests[tests.length - 1]?.type ?? null
      onComplete(results, finalTestType)
    }
  }

  const handleSkip = () => {
    if (!currentTestData) return
    const newResult = {
      type: currentTestData.type,
      correct: false,
      userAnswer: 'skipped'
    }
    setResults([...results, newResult])
    handleNext()
  }

  const handleOptionSelect = (option: string) => {
    if (!currentTestData || showResult) return

    if (currentTestData.type === 'recognition') {
      const correct = option === kanji.kanji
      setUserInput(option)
      setIsCorrect(correct)
      setShowResult(true)
      setResults([...results, {
        type: currentTestData.type,
        correct,
        userAnswer: option
      }])
      return
    }

    setUserInput(option)
    checkAnswer(option)
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isDesktopShortcutsEnabled()) return

      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return
      }

      if (!showResult && (currentTestData?.type === 'recognition' || useMultipleChoice)) {
        const options = currentTestData?.type === 'recognition'
          ? recognitionChoices
          : multipleChoiceOptions
        if (options.length === 4 && /^[1-4]$/.test(e.key)) {
          e.preventDefault()
          const index = Number(e.key) - 1
          const option = options[index]
          if (option) {
            handleOptionSelect(option)
          }
          return
        }
      }

      switch (e.key) {
        case 'Enter':
        case ' ':
        case 'ArrowRight':
          if (showResult) {
            e.preventDefault()
            handleNext()
            return
          }

          if (userInput.trim()) {
            e.preventDefault()
            checkAnswer()
          }
          break
        case 'Escape':
          e.preventDefault()
          if (showShortcuts) {
            setShowShortcuts(false)
          } else {
            onExit()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [checkAnswer, currentTestData?.type, handleNext, handleOptionSelect, multipleChoiceOptions, onExit, recognitionChoices, showResult, showShortcuts, useMultipleChoice, userInput])

  // Close shortcuts panel when clicking outside
  useEffect(() => {
    if (!showShortcuts) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.shortcuts-panel') && !target.closest('.shortcuts-badge')) {
        setShowShortcuts(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showShortcuts])

  const shortcutsBadge = (
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
                  <span className="text-gray-700 dark:text-gray-300">Select option</span>
                  <div className="flex gap-1">
                    <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-dark-700 border border-gray-300 dark:border-dark-600 rounded text-xs font-mono">1</kbd>
                    <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-dark-700 border border-gray-300 dark:border-dark-600 rounded text-xs font-mono">2</kbd>
                    <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-dark-700 border border-gray-300 dark:border-dark-600 rounded text-xs font-mono">3</kbd>
                    <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-dark-700 border border-gray-300 dark:border-dark-600 rounded text-xs font-mono">4</kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300">Exit</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-dark-700 border border-gray-300 dark:border-dark-600 rounded text-xs font-mono">Esc</kbd>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )

  if (!currentTestData) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="text-center relative">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Round 2: Test
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Kanji {currentIndex + 1} of {totalKanji}
          </p>
          {shortcutsBadge}
        </div>

        <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl p-8 text-center text-gray-600 dark:text-gray-400">
          No valid tests for this kanji.
        </div>
      </motion.div>
    )
  }

  if (currentTestData.type === 'recognition') {
    // Multiple choice for kanji recognition
    const options = recognitionChoices

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="text-center relative">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Round 2: Test
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Kanji {currentIndex + 1} of {totalKanji} • Test {currentTest + 1} of {tests.length}
          </p>
          {shortcutsBadge}
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
                  onClick={() => handleOptionSelect(option)}
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
                  style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans CJK JP", sans-serif' }}
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
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={onExit}
                className="p-2 bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-300 dark:hover:bg-dark-600 transition-all hover:scale-110"
                aria-label="Exit session"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
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
      <div className="text-center relative">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Round 2: Test
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Kanji {currentIndex + 1} of {totalKanji} • Test {currentTest + 1} of {tests.length}
        </p>
        {shortcutsBadge}
      </div>

      <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          {/* Kanji display for meaning/reading tests (not recognition - that's handled above with early return) */}
          <div className="text-6xl font-bold text-gray-900 dark:text-gray-100 mb-6"
               style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans CJK JP", sans-serif' }}>
            {kanji.kanji}
          </div>

          <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100 mb-6">
            {currentTestData.question}
          </h3>

          {useMultipleChoice ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto">
              {multipleChoiceOptions.map((option, idx) => (
                <button
                  key={`${option}-${idx}`}
                  onClick={() => handleOptionSelect(option)}
                  disabled={showResult}
                  className={`p-3 sm:p-4 rounded-lg border-2 transition-all text-sm sm:text-base ${
                    showResult && option === userInput
                      ? isCorrect
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-500'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-500'
                      : 'bg-white/50 dark:bg-dark-700 border-gray-300 dark:border-dark-600 hover:bg-gray-100 dark:hover:bg-dark-600'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : (
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
                ref={inputRef}
                className="w-full px-4 py-3 text-lg border-2 border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-primary-500 disabled:bg-gray-100 dark:disabled:bg-dark-600"
                autoFocus
              />
            </div>
          )}

          {!showResult && !useMultipleChoice && (
            <div className="flex justify-center gap-3 mt-6">
              <button
                onClick={onExit}
                className="p-2 bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-300 dark:hover:bg-dark-600 transition-all hover:scale-110"
                aria-label="Exit session"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
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
                onClick={() => checkAnswer()}
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

          {!showResult && useMultipleChoice && (
            <div className="flex justify-center gap-3 mt-6">
              <button
                onClick={onExit}
                className="p-2 bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-300 dark:hover:bg-dark-600 transition-all hover:scale-110"
                aria-label="Exit session"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <button
                onClick={handleSkip}
                className="p-2 bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-300 dark:hover:bg-dark-600 transition-all hover:scale-110"
                aria-label="Skip"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
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
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              onClick={onExit}
              className="p-2 bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-300 dark:hover:bg-dark-600 transition-all hover:scale-110"
              aria-label="Exit session"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
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
function generateKanjiOptions(
  correct: string,
  count: number,
  pool: KanjiWithExamples[]
): string[] {
  const poolCandidates = pool
    .map(item => item.kanji)
    .filter(k => k && k !== correct)

  const fallback = ['水', '火', '木', '金', '土', '日', '月', '山', '川', '田', '人', '大', '小', '中', '上', '下']
    .filter(k => k !== correct)

  const candidates = Array.from(new Set([...poolCandidates, ...fallback]))
  const distractors = shuffleArray(candidates).slice(0, count - 1)
  const options = [correct, ...distractors]

  return shuffleArray(options)
}

function buildMultipleChoiceOptions(
  type: TestType,
  kanji: KanjiWithExamples,
  pool: KanjiWithExamples[],
  count: number
): string[] {
  let correct = ''
  let candidates: string[] = []

  if (type === 'meaning') {
    correct = kanji.meaning
    candidates = pool.map(item => item.meaning)
  } else if (type === 'onyomi') {
    correct = pickRandom(kanji.onyomi || [])
    candidates = pool.flatMap(item => item.onyomi || [])
  } else if (type === 'kunyomi') {
    correct = pickRandom(kanji.kunyomi || [])
    candidates = pool.flatMap(item => item.kunyomi || [])
  }

  if (!correct) return []

  const uniqueCandidates = Array.from(new Set(candidates))
    .filter(option => option && option !== correct)

  if (uniqueCandidates.length < count - 1) {
    return []
  }

  const distractors = shuffleArray(uniqueCandidates).slice(0, count - 1)
  return shuffleArray([correct, ...distractors])
}

function shuffleArray<T>(items: T[]): T[] {
  const array = [...items]
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }
  return array
}

function pickRandom(items: string[]): string {
  if (!items || items.length === 0) return ''
  return items[Math.floor(Math.random() * items.length)]
}
