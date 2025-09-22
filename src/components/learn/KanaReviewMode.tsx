'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { KanaCharacter, kanaData, playKanaAudio } from '@/data/kanaData'
import { useI18n } from '@/i18n/I18nContext'
import { useToast } from '@/components/ui/Toast/ToastContext'

type ReviewMode = 'recognition' | 'recall' | 'listening'

interface ReviewResult {
  characterId: string
  correct: boolean
  responseTime: number
  mode: ReviewMode
}

interface KanaReviewModeProps {
  characters: KanaCharacter[]
  displayScript: 'hiragana' | 'katakana'
  onComplete: (results: ReviewResult[]) => void
  onCancel: () => void
}

export default function KanaReviewMode({
  characters,
  displayScript,
  onComplete,
  onCancel
}: KanaReviewModeProps) {
  const { t } = useI18n()
  const { showToast } = useToast()
  
  const [currentIndex, setCurrentIndex] = useState(0)
  const [reviewMode, setReviewMode] = useState<ReviewMode>('recognition')
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [results, setResults] = useState<ReviewResult[]>([])
  const [options, setOptions] = useState<KanaCharacter[]>([])
  const [startTime, setStartTime] = useState(Date.now())
  const [userInput, setUserInput] = useState('')
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  
  
  
  const currentCharacter = characters[currentIndex]
  
  // Generate random options for multiple choice
  useEffect(() => {
    if (reviewMode === 'recognition' || reviewMode === 'listening') {
      // Use the full kana dataset for more variety if we don't have enough characters
      const availablePool = characters.length >= 4 ? characters : kanaData
      const otherChars = availablePool.filter(c => c.id !== currentCharacter.id)
      const randomOptions = otherChars
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
      
      const allOptions = [currentCharacter, ...randomOptions]
        .sort(() => Math.random() - 0.5)
      
      setOptions(allOptions)
    }
  }, [currentCharacter, reviewMode, characters])
  
  // Reset state when moving to next question
  useEffect(() => {
    setSelectedAnswer(null)
    setShowAnswer(false)
    setUserInput('')
    setIsCorrect(null)
    setStartTime(Date.now())
  }, [currentIndex, reviewMode])
  
  
  
  // Play audio for listening mode
  useEffect(() => {
    if (reviewMode === 'listening' && !showAnswer) {
      const playAudio = async () => {
        try {
          await playKanaAudio(currentCharacter.id, displayScript)
        } catch (err) {
          console.error('Audio playback error:', err)
          showToast(t('kana.messages.audioNotAvailable'), 'warning')
        }
      }
      
      // Small delay to ensure UI updates first
      const timer = setTimeout(playAudio, 300)
      
      return () => clearTimeout(timer)
    }
  }, [reviewMode, currentIndex, showAnswer, displayScript, currentCharacter.id, showToast, t])
  
  const handleAnswer = useCallback((answer: string) => {
    const responseTime = Date.now() - startTime
    let correct = false
    
    // Handle different modes
    if (reviewMode === 'recall') {
      // For recall mode, we use special markers from handleRecallSubmit
      correct = answer === '_recall_correct_'
    } else {
      // For recognition and listening modes, check if answer matches character id or romaji
      correct = answer === currentCharacter.romaji || answer === currentCharacter.id
    }
    
    setIsCorrect(correct)
    setShowAnswer(true)
    
    const result: ReviewResult = {
      characterId: currentCharacter.id,
      correct,
      responseTime,
      mode: reviewMode
    }
    
    setResults(prev => [...prev, result])
    
    if (!correct) {
      showToast(t('kana.review.incorrect'), 'error')
    } else {
      showToast(t('kana.review.correct'), 'success')
    }
  }, [currentCharacter, startTime, reviewMode, showToast, t])
  
  const handleNext = useCallback(() => {
    if (currentIndex < characters.length - 1) {
      setCurrentIndex(currentIndex + 1)
      // Audio will play automatically via useEffect for listening mode
    } else {
      // Review complete
      onComplete(results)
    }
  }, [currentIndex, characters, results, onComplete])
  
  const handleSkip = useCallback(() => {
    const result: ReviewResult = {
      characterId: currentCharacter.id,
      correct: false,
      responseTime: Date.now() - startTime,
      mode: reviewMode
    }
    setResults(prev => [...prev, result])
    handleNext()
  }, [currentCharacter, startTime, reviewMode, handleNext])
  
  const handleRecallSubmit = useCallback(() => {
    // For recall mode, we want to check if the user typed the actual hiragana/katakana
    const trimmedInput = userInput.trim()
    const correct = trimmedInput === currentCharacter.hiragana || trimmedInput === currentCharacter.katakana
    
    // Pass a special marker to indicate this is a recall answer
    if (correct) {
      handleAnswer('_recall_correct_')
    } else {
      handleAnswer('_recall_incorrect_')
    }
  }, [userInput, currentCharacter, handleAnswer])
  
  const calculateStats = () => {
    const correct = results.filter(r => r.correct).length
    const total = results.length
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0
    const avgTime = total > 0 
      ? Math.round(results.reduce((sum, r) => sum + r.responseTime, 0) / total / 1000)
      : 0
    
    return { correct, total, accuracy, avgTime }
  }
  
  const stats = calculateStats()
  
  // Check if we have enough characters for review mode
  if (characters.length < 4 && reviewMode !== 'recall') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background-light to-japanese-mizu/10 dark:from-dark-900 dark:to-dark-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-dark-800 rounded-xl shadow-lg p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Not Enough Items for Review
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You need at least 4 items to use review mode. Please add more characters to your study list.
          </p>
          <button
            onClick={onCancel}
            className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
          >
            Back to Characters
          </button>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light to-japanese-mizu/10 dark:from-dark-900 dark:to-dark-800 flex flex-col items-center p-4">
      {/* Header */}
      <div className="w-full max-w-3xl mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {t('kana.review.reviewMode')}
            </h2>
            <div className="flex gap-2">
              {(['recognition', 'recall', 'listening'] as ReviewMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setReviewMode(mode)}
                  className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                    reviewMode === mode
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600'
                  }`}
                >
                  {t(`kana.review.${mode}`)}
                </button>
              ))}
            </div>
          </div>
          
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>
        
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              Question {currentIndex + 1} of {characters.length}
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              {stats.correct}/{stats.total} {t('kana.review.correct').toLowerCase()}
            </span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / characters.length) * 100}%` }}
            />
          </div>
        </div>
      </div>
      
      {/* Review Content */}
      <div className="w-full max-w-3xl flex-1 flex items-center justify-center">
        <div className="w-full">
        <AnimatePresence mode="wait">
          {/* Recognition Mode */}
          {reviewMode === 'recognition' && (
            <motion.div
              key="recognition"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center mb-12">
                <div className="text-7xl sm:text-8xl md:text-9xl font-japanese font-bold text-gray-800 dark:text-gray-200 mb-6">
                  {currentCharacter.hiragana}
                </div>
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  {t('kana.review.selectAnswer')}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-6 max-w-lg mx-auto">
                {options.map(option => (
                  <button
                    key={option.id}
                    onClick={() => !showAnswer && handleAnswer(option.id)}
                    disabled={showAnswer}
                    className={`
                      p-4 rounded-xl border-2 transition-all
                      ${selectedAnswer === option.id && isCorrect === true
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : selectedAnswer === option.id && isCorrect === false
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                        : showAnswer && option.id === currentCharacter.id
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-gray-200 dark:border-dark-600 hover:border-primary-400'
                      }
                      ${!showAnswer && 'hover:shadow-lg cursor-pointer'}
                    `}
                  >
                    <div className="text-2xl sm:text-3xl font-bold">{option.romaji}</div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
          
          {/* Recall Mode */}
          {reviewMode === 'recall' && (
            <motion.div
              key="recall"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center">
                <div className="text-4xl font-bold text-gray-800 dark:text-gray-200 mb-4">
                  {currentCharacter.romaji}
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  {t('kana.review.typeAnswer')} (Hiragana)
                </p>
              </div>
              
              <div className="flex flex-col items-center space-y-4">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRecallSubmit()}
                  disabled={showAnswer}
                  className="w-full max-w-xs px-4 py-3 text-center text-2xl font-japanese
                           border-2 border-gray-300 dark:border-dark-600 rounded-xl
                           focus:border-primary-500 focus:ring-2 focus:ring-primary-200
                           dark:bg-dark-700 dark:text-gray-100"
                  placeholder="Type hiragana..."
                  autoFocus
                />
                
                {showAnswer && (
                  <div className={`text-center p-4 rounded-xl ${
                    isCorrect 
                      ? 'bg-green-100 dark:bg-green-900/30' 
                      : 'bg-red-100 dark:bg-red-900/30'
                  }`}>
                    <div className="text-6xl font-japanese font-bold mb-2">
                      {currentCharacter.hiragana}
                    </div>
                    <div className="text-xl">{currentCharacter.romaji}</div>
                  </div>
                )}
                
                {!showAnswer && (
                  <button
                    onClick={handleRecallSubmit}
                    className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                  >
                    Submit
                  </button>
                )}
              </div>
            </motion.div>
          )}
          
          {/* Listening Mode */}
          {reviewMode === 'listening' && (
            <motion.div
              key="listening"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center mb-12">
                <button
                  onClick={() => {
                    playKanaAudio(currentCharacter.id, displayScript).catch(err => {
                      console.error('Failed to replay audio:', err)
                      showToast(t('kana.messages.audioNotAvailable'), 'warning')
                    })
                  }}
                  className="p-10 sm:p-12 bg-blue-100 dark:bg-blue-900/30 rounded-full hover:bg-blue-200 
                           dark:hover:bg-blue-900/50 transition-colors mx-auto relative group"
                >
                  <svg className="w-20 h-20 sm:w-24 sm:h-24 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400 bg-white dark:bg-dark-800 px-2 py-1 rounded mt-32">
                      Click to replay
                    </span>
                  </div>
                </button>
                <p className="text-lg text-gray-600 dark:text-gray-400 mt-6">
                  Listen and select the correct character
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-6 max-w-lg mx-auto">
                {options.map(option => (
                  <button
                    key={option.id}
                    onClick={() => !showAnswer && handleAnswer(option.id)}
                    disabled={showAnswer}
                    className={`
                      p-4 rounded-xl border-2 transition-all
                      ${selectedAnswer === option.id && isCorrect === true
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : selectedAnswer === option.id && isCorrect === false
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                        : showAnswer && option.id === currentCharacter.id
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-gray-200 dark:border-dark-600 hover:border-primary-400'
                      }
                      ${!showAnswer && 'hover:shadow-lg cursor-pointer'}
                    `}
                  >
                    <div className="text-3xl sm:text-4xl font-japanese font-bold">{option.hiragana}</div>
                    {showAnswer && (
                      <div className="text-lg text-gray-600 dark:text-gray-400 mt-1">
                        {option.romaji}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>
        
      {/* Action Buttons */}
      <div className="w-full max-w-3xl mt-8 mb-20 sm:mb-8">
        <div className="flex items-center justify-center gap-4">
          {showAnswer ? (
            <>
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
              >
                {currentIndex < characters.length - 1 
                  ? t('kana.review.nextQuestion')
                  : t('kana.review.endReview')
                }
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleSkip}
                className="px-6 py-2 bg-gray-200 dark:bg-dark-700 rounded-lg hover:bg-gray-300 dark:hover:bg-dark-600"
              >
                {t('kana.review.skipQuestion')}
              </button>
              <button
                onClick={() => setShowAnswer(true)}
                className="px-6 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
              >
                {t('kana.review.showAnswer')}
              </button>
            </>
          )}
        </div>
      </div>
      
      {/* Stats Summary (shown at bottom) */}
      {results.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 sm:right-auto bg-white dark:bg-dark-800 rounded-lg shadow-lg p-3 sm:p-4 z-10 max-w-xs">
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">{t('kana.review.accuracy')}:</span>
              <span className="ml-2 font-bold">{stats.accuracy}%</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Avg Time:</span>
              <span className="ml-2 font-bold">{stats.avgTime}s</span>
            </div>
          </div>
        </div>
      )}
      
    </div>
  )
}