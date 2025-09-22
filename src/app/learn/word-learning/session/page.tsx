'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LoadingOverlay } from '@/components/ui/Loading'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Volume2, Check, X } from 'lucide-react'
import Link from 'next/link'
import DoshiMascot from '@/components/ui/DoshiMascot'
import { getCommonWordsFromWanikani, getWordsByJLPTLevelFromWanikani, initWanikaniApi } from '@/utils/api'
import { searchJMdictWords, getCommonJMdictWords, loadJMdictData } from '@/utils/jmdictLocalSearch'
import { JapaneseWord } from '@/types/vocabulary'

interface SessionState {
  words: JapaneseWord[]
  currentPhase: 'exposure' | 'practice' | 'production'
  currentWordIndex: number
  phases: string[]
  phaseIndex: number
  results: Map<string, {
    exposure: boolean
    practice?: boolean
    production?: string
  }>
}

function SessionContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const size = parseInt(searchParams.get('size') || '10')
  const mode = searchParams.get('mode') || 'mixed'
  const level = (searchParams.get('level') || 'N5') as 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
  const phases = searchParams.get('phases')?.split(',') || ['exposure', 'practice', 'production']

  const [sessionState, setSessionState] = useState<SessionState>({
    words: [],
    currentPhase: phases[0] as any,
    currentWordIndex: 0,
    phases,
    phaseIndex: 0,
    results: new Map()
  })

  const [loading, setLoading] = useState(true)
  const [showMeaning, setShowMeaning] = useState(false)
  const [practiceOptions, setPracticeOptions] = useState<string[]>([])
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [userInput, setUserInput] = useState('')
  const [showResult, setShowResult] = useState(false)

  useEffect(() => {
    loadWords()
  }, [])

  const loadWords = async () => {
    try {
      setLoading(true)
      initWanikaniApi()
      await loadJMdictData()

      let words: JapaneseWord[] = []

      // Load words based on configuration
      if (level) {
        words = await getWordsByJLPTLevelFromWanikani(level)
      } else {
        words = await getCommonJMdictWords(size * 2)
      }

      // Filter by type if specified
      if (mode !== 'mixed') {
        const typeMap: { [key: string]: string[] } = {
          'verbs': ['Ichidan', 'Godan', 'Irregular'],
          'adjectives': ['i-adjective', 'na-adjective'],
          'nouns': ['noun']
        }
        
        const allowedTypes = typeMap[mode] || []
        words = words.filter(w => w.type && allowedTypes.includes(w.type))
      }

      // Shuffle and take requested amount
      words = words.sort(() => Math.random() - 0.5).slice(0, size)

      // Initialize results map
      const resultsMap = new Map()
      words.forEach(word => {
        resultsMap.set(word.id, { exposure: false })
      })

      setSessionState(prev => ({
        ...prev,
        words,
        results: resultsMap
      }))
    } catch (error) {
      console.error('Failed to load words:', error)
    } finally {
      setLoading(false)
    }
  }

  const currentWord = sessionState.words[sessionState.currentWordIndex]

  const handleSpeak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'ja-JP'
      utterance.rate = 0.9
      window.speechSynthesis.speak(utterance)
    }
  }

  const handleNextWord = () => {
    if (sessionState.currentWordIndex < sessionState.words.length - 1) {
      setSessionState(prev => ({
        ...prev,
        currentWordIndex: prev.currentWordIndex + 1
      }))
      resetPhaseState()
    } else {
      // Move to next phase
      if (sessionState.phaseIndex < sessionState.phases.length - 1) {
        setSessionState(prev => ({
          ...prev,
          phaseIndex: prev.phaseIndex + 1,
          currentPhase: prev.phases[prev.phaseIndex + 1] as any,
          currentWordIndex: 0
        }))
        resetPhaseState()
      } else {
        // Session complete
        router.push('/learn/word-learning/complete?' + searchParams.toString())
      }
    }
  }

  const resetPhaseState = () => {
    setShowMeaning(false)
    setSelectedOption(null)
    setUserInput('')
    setShowResult(false)
    setPracticeOptions([])
  }

  // Generate practice options
  useEffect(() => {
    if (sessionState.currentPhase === 'practice' && currentWord) {
      const otherWords = sessionState.words
        .filter(w => w.id !== currentWord.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
      
      const options = [currentWord, ...otherWords]
        .map(w => w.meaning.split(',')[0].trim())
        .sort(() => Math.random() - 0.5)
      
      setPracticeOptions(options)
    }
  }, [sessionState.currentPhase, sessionState.currentWordIndex])

  const handlePracticeAnswer = (option: string) => {
    setSelectedOption(option)
    setShowResult(true)
    
    const correct = option === currentWord.meaning.split(',')[0].trim()
    const result = sessionState.results.get(currentWord.id) || { exposure: true }
    result.practice = correct
    sessionState.results.set(currentWord.id, result)
  }

  const handleProductionSubmit = () => {
    setShowResult(true)
    const result = sessionState.results.get(currentWord.id) || { exposure: true }
    result.production = userInput
    sessionState.results.set(currentWord.id, result)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingOverlay isLoading={true} message="Loading words..." showDoshi={true} />
      </div>
    )
  }

  if (!currentWord) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">No words loaded</p>
          <Link href="/learn/word-learning" className="text-primary-600 hover:text-primary-700">
            Go Back
          </Link>
        </div>
      </div>
    )
  }

  const progress = ((sessionState.phaseIndex * sessionState.words.length + sessionState.currentWordIndex + 1) / 
                   (sessionState.phases.length * sessionState.words.length)) * 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850">
      {/* Header */}
      <div className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-dark-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <Link
              href="/learn/word-learning"
              className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {sessionState.currentPhase.charAt(0).toUpperCase() + sessionState.currentPhase.slice(1)} Phase
              - Word {sessionState.currentWordIndex + 1} of {sessionState.words.length}
            </div>
          </div>
          <div className="relative h-2 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 bg-primary-500"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <AnimatePresence mode="wait">
          {/* Exposure Phase */}
          {sessionState.currentPhase === 'exposure' && (
            <motion.div
              key="exposure"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white dark:bg-dark-800 rounded-lg shadow-lg p-8"
            >
              <h2 className="text-center text-lg font-medium text-gray-600 dark:text-gray-400 mb-6">
                Learn this word
              </h2>
              
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center gap-3">
                  {currentWord.kanji && (
                    <span className="text-5xl font-bold text-gray-900 dark:text-gray-100"
                          style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}>
                      {currentWord.kanji}
                    </span>
                  )}
                  <button
                    onClick={() => handleSpeak(currentWord.kanji || currentWord.kana)}
                    className="p-3 bg-gray-100 dark:bg-dark-700 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors"
                  >
                    <Volume2 className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
                
                <div className="text-2xl text-gray-700 dark:text-gray-300">
                  {currentWord.kana}
                </div>
                
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: showMeaning ? 1 : 0, height: showMeaning ? 'auto' : 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-4 space-y-2">
                    <p className="text-xl text-gray-800 dark:text-gray-200">
                      {currentWord.meaning}
                    </p>
                    {currentWord.type && (
                      <span className="inline-block px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm">
                        {currentWord.type}
                      </span>
                    )}
                  </div>
                </motion.div>
                
                {!showMeaning ? (
                  <button
                    onClick={() => setShowMeaning(true)}
                    className="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                  >
                    Show Meaning
                  </button>
                ) : (
                  <button
                    onClick={handleNextWord}
                    className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2 mx-auto"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* Practice Phase */}
          {sessionState.currentPhase === 'practice' && (
            <motion.div
              key="practice"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white dark:bg-dark-800 rounded-lg shadow-lg p-8"
            >
              <h2 className="text-center text-lg font-medium text-gray-600 dark:text-gray-400 mb-6">
                What does this mean?
              </h2>
              
              <div className="text-center space-y-6">
                <div className="flex items-center justify-center gap-3">
                  {currentWord.kanji && (
                    <span className="text-5xl font-bold text-gray-900 dark:text-gray-100"
                          style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}>
                      {currentWord.kanji}
                    </span>
                  )}
                  <div className="text-2xl text-gray-700 dark:text-gray-300">
                    ({currentWord.kana})
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  {practiceOptions.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => !showResult && handlePracticeAnswer(option)}
                      disabled={showResult}
                      className={`p-4 rounded-lg transition-colors text-left ${
                        showResult && option === currentWord.meaning.split(',')[0].trim()
                          ? 'bg-green-100 dark:bg-green-900/30 border-2 border-green-500'
                          : showResult && option === selectedOption
                          ? 'bg-red-100 dark:bg-red-900/30 border-2 border-red-500'
                          : 'bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                
                {showResult && (
                  <button
                    onClick={handleNextWord}
                    className="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-2 mx-auto"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* Production Phase */}
          {sessionState.currentPhase === 'production' && (
            <motion.div
              key="production"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white dark:bg-dark-800 rounded-lg shadow-lg p-8"
            >
              <h2 className="text-center text-lg font-medium text-gray-600 dark:text-gray-400 mb-6">
                Type the meaning
              </h2>
              
              <div className="text-center space-y-6">
                <div className="flex items-center justify-center gap-3">
                  {currentWord.kanji && (
                    <span className="text-5xl font-bold text-gray-900 dark:text-gray-100"
                          style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}>
                      {currentWord.kanji}
                    </span>
                  )}
                  <div className="text-2xl text-gray-700 dark:text-gray-300">
                    ({currentWord.kana})
                  </div>
                </div>
                
                {!showResult ? (
                  <form onSubmit={(e) => {
                    e.preventDefault()
                    handleProductionSubmit()
                  }}>
                    <input
                      type="text"
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      placeholder="Type the meaning in English..."
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-700 border border-gray-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={!userInput.trim()}
                      className="mt-4 px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Submit
                    </button>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-100 dark:bg-dark-700 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Your answer:</p>
                      <p className="text-lg text-gray-900 dark:text-gray-100">{userInput}</p>
                    </div>
                    <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <p className="text-sm text-green-600 dark:text-green-400 mb-1">Correct answer:</p>
                      <p className="text-lg text-gray-900 dark:text-gray-100">{currentWord.meaning}</p>
                    </div>
                    <button
                      onClick={handleNextWord}
                      className="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-2 mx-auto"
                    >
                      Next <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Doshi Mascot */}
        <div className="mt-8 flex justify-center">
          <DoshiMascot
            size="medium"
            mood={showResult && selectedOption === currentWord.meaning.split(',')[0].trim() ? 'happy' : 'neutral'}
          />
        </div>
      </div>
    </div>
  )
}

export default function WordLearningSessionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <LoadingOverlay isLoading={true} message="Preparing session..." showDoshi={true} />
      </div>
    }>
      <SessionContent />
    </Suspense>
  )
}