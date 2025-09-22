'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ReviewableContent 
} from '@/lib/review-engine/core/interfaces'
import { 
  ReviewMode
} from '@/lib/review-engine/core/types'
import {
  ReviewEngineConfig
} from '@/lib/review-engine/core/config.types'
import {
  ReviewSession,
  SessionStatistics,
  ReviewSessionItem
} from '@/lib/review-engine/core/session.types'
import ReviewCard from './ReviewCard'
import AnswerInput from './AnswerInput'
import ProgressBar from './ProgressBar'
import SessionSummary from './SessionSummary'
import { useReviewEngine } from '@/hooks/useReviewEngine'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { IndexedDBStorage } from '@/lib/review-engine/offline/indexed-db'
import { SyncQueue } from '@/lib/review-engine/offline/sync-queue'
import { useI18n } from '@/i18n/I18nContext'

interface ReviewEngineProps {
  content: ReviewableContent[]
  contentPool?: ReviewableContent[]  // Optional pool for generating distractors
  mode?: ReviewMode
  onComplete: (statistics: SessionStatistics) => void
  onCancel: () => void
  onProgressUpdate?: (progress: any) => void
  config?: ReviewEngineConfig
  userId: string
}

export default function ReviewEngine({
  content,
  contentPool,
  mode = 'recognition',
  onComplete,
  onCancel,
  onProgressUpdate,
  config,
  userId
}: ReviewEngineProps) {
  const { t } = useI18n()
  const [currentMode, setCurrentMode] = useState<ReviewMode>(mode)
  const [currentItem, setCurrentItem] = useState<ReviewSessionItem | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<ReviewSession | null>(null)
  const [statistics, setStatistics] = useState<SessionStatistics | null>(null)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  
  const storageRef = useRef<IndexedDBStorage | null>(null)
  const syncQueueRef = useRef<SyncQueue | null>(null)
  const { playSound, vibrate, playAudio } = useReviewEngine(config)
  
  // Initialize session and offline storage
  useEffect(() => {
    initializeSession()
    
    // Listen for online/offline changes
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      
      // Save session state before unmount
      if (session?.status === 'active') {
        saveSessionState()
      }
    }
  }, [])
  
  const initializeSession = async () => {
    try {
      setIsLoading(true)
      
      // Initialize offline storage (always enabled)
      storageRef.current = new IndexedDBStorage()
      await storageRef.current.initialize()
      
      // Cache content for offline access
      await storageRef.current.cacheContent(content)
      
      // Create session
      const newSession: ReviewSession = {
        id: generateSessionId(),
        userId,
        mode: currentMode,
        items: content.map(c => ({
          content: c,
          presentedAt: new Date(),
          attempts: 0,
          hintsUsed: 0,
          skipped: false,
          baseScore: 100,
          finalScore: 100
        })),
        currentIndex: 0,
        startedAt: new Date(),
        lastActivityAt: new Date(),
        status: 'active',
        config: {
          mode: currentMode,
          showPrimary: true,
          showSecondary: true,
          showTertiary: false,
          showMedia: false,
          inputType: 'text',
          optionCount: 4,
          allowHints: true,
          hintPenalty: 0.1,
          timeLimit: 0,
          autoPlayAudio: false,
          repeatLimit: 3
        },
        source: 'manual'
      }
      
      setSession(newSession)
      setCurrentItem(newSession.items[0])
      
      // Save session to offline storage
      if (storageRef.current) {
        await storageRef.current.saveSession(newSession)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initialize session')
    } finally {
      setIsLoading(false)
    }
  }
  
  const saveSessionState = async () => {
    if (!session || !storageRef.current) return
    
    try {
      await storageRef.current.saveSession({
        ...session,
        lastActivityAt: new Date()
      })
    } catch (error) {
      console.error('Failed to save session state:', error)
    }
  }
  
  // Handle answer submission
  const handleAnswer = useCallback(async (answer: string, confidence?: 1 | 2 | 3 | 4 | 5) => {
    if (!session || !currentItem || showAnswer) return
    
    try {
      // Validate answer (simplified - would use adapter in real implementation)
      const correct = answer.toLowerCase() === currentItem.content.primaryAnswer.toLowerCase()
      
      // Record attempt
      // Update attempt count
      currentItem.attempts += 1
      currentItem.userAnswer = answer
      currentItem.correct = correct
      currentItem.confidence = confidence
      currentItem.answeredAt = new Date()
      currentItem.responseTime = Date.now() - (currentItem.presentedAt ? currentItem.presentedAt.getTime() : Date.now())
      
      // Update session
      const updatedSession = {
        ...session,
        lastActivityAt: new Date()
      }
      setSession(updatedSession)
      
      // Save to offline storage
      if (storageRef.current) {
        await storageRef.current.saveSession(updatedSession)
      }
      
      setShowAnswer(true)
      
      // Play feedback sound
      if (correct) {
        playSound('correct')
      } else {
        playSound('incorrect')
        vibrate([100, 50, 100])
      }
      
      // Could add auto-advance logic here if needed
    } catch (err: any) {
      setError(err.message)
    }
  }, [currentItem, session, showAnswer, config, playSound, vibrate])
  
  // Move to next item
  const handleNext = useCallback(async () => {
    if (!session) return
    
    setShowAnswer(false)
    setError(null)
    
    const nextIndex = currentIndex + 1
    
    if (nextIndex < session.items.length) {
      setCurrentIndex(nextIndex)
      setCurrentItem(session.items[nextIndex])
      
      // Update session
      const updatedSession = {
        ...session,
        currentIndex: nextIndex,
        lastActivityAt: new Date()
      }
      setSession(updatedSession)
      
      // Save to offline storage
      if (storageRef.current) {
        await storageRef.current.saveSession(updatedSession)
      }
    } else {
      // Session complete
      completeSession()
    }
  }, [session, currentIndex])
  
  // Auto-play audio for listening mode
  useEffect(() => {
    if (currentMode === 'listening' && currentItem && !showAnswer) {
      const audioUrl = currentItem.content.audioUrl
      if (audioUrl) {
        // Play audio after a short delay to ensure UI is ready
        const timer = setTimeout(() => {
          playAudio(audioUrl).catch(err => {
            console.error('Failed to play audio:', err)
            // If auto-play fails (browser policy), user can click the speaker icon
          })
        }, 500)
        
        return () => clearTimeout(timer)
      }
    }
  }, [currentMode, currentItem, showAnswer, playAudio])
  
  const completeSession = async () => {
    if (!session) return

    // Calculate statistics
    const stats = calculateStatistics(session)

    // Update session
    const completedSession = {
      ...session,
      status: 'completed' as const,
      endedAt: new Date(),
      stats: stats
    }

    setSession(completedSession)
    setStatistics(stats)

    // Save to offline storage
    if (storageRef.current) {
      await storageRef.current.saveSession(completedSession)
      await storageRef.current.saveStatistics(session.id, stats)
    }

    // Record daily activity for streak tracking (both study and review sessions)
    try {
      const today = new Date().toISOString().split('T')[0]
      const activities = JSON.parse(
        localStorage.getItem(`activities_${session.userId}`) || '{}'
      )
      activities[today] = true
      localStorage.setItem(`activities_${session.userId}`, JSON.stringify(activities))
    } catch (error) {
      console.error('Failed to record daily activity:', error)
    }

    onComplete(stats)
  }
  
  const calculateStatistics = (session: ReviewSession): SessionStatistics => {
    const completedItems = session.items.filter(item => item.attempts > 0)
    const correctItems = session.items.filter(item => item.correct === true)
    const skippedItems = session.items.filter(item => item.skipped)
    
    const totalResponseTime = session.items
      .filter(item => item.responseTime !== undefined)
      .reduce((sum, item) => sum + (item.responseTime || 0), 0)
    
    const totalHintsUsed = session.items.reduce((sum, item) => sum + item.hintsUsed, 0)
    
    // Calculate streaks
    let currentStreak = 0
    let bestStreak = 0
    let tempStreak = 0
    
    for (const item of session.items) {
      if (item.correct === true) {
        tempStreak++
        currentStreak = tempStreak
        bestStreak = Math.max(bestStreak, tempStreak)
      } else if (item.attempts > 0) {
        tempStreak = 0
      }
    }
    
    // Calculate total time
    const totalTime = session.endedAt 
      ? session.endedAt.getTime() - session.startedAt.getTime()
      : Date.now() - session.startedAt.getTime()
    
    // Calculate total score
    const totalScore = session.items.reduce((sum, item) => sum + item.finalScore, 0)
    const maxPossibleScore = session.items.length * 100
    
    // Calculate performance by difficulty
    const performanceByDifficulty = {
      easy: { correct: 0, total: 0, avgTime: 0 },
      medium: { correct: 0, total: 0, avgTime: 0 },
      hard: { correct: 0, total: 0, avgTime: 0 }
    }
    
    session.items.forEach(item => {
      const difficulty = item.content.difficulty
      const level = difficulty < 0.33 ? 'easy' : difficulty < 0.67 ? 'medium' : 'hard'
      performanceByDifficulty[level].total++
      if (item.correct) performanceByDifficulty[level].correct++
      if (item.responseTime) {
        performanceByDifficulty[level].avgTime = 
          (performanceByDifficulty[level].avgTime * (performanceByDifficulty[level].total - 1) + item.responseTime) / 
          performanceByDifficulty[level].total
      }
    })
    
    return {
      sessionId: session.id,
      totalItems: session.items.length,
      completedItems: completedItems.length,
      correctItems: correctItems.length,
      incorrectItems: completedItems.length - correctItems.length,
      skippedItems: skippedItems.length,
      accuracy: completedItems.length > 0 ? (correctItems.length / completedItems.length) * 100 : 0,
      averageResponseTime: completedItems.length > 0 ? totalResponseTime / completedItems.length : 0,
      totalTime,
      currentStreak,
      bestStreak,
      performanceByDifficulty,
      performanceByMode: {
        [session.mode]: {
          correct: correctItems.length,
          total: completedItems.length,
          avgTime: completedItems.length > 0 ? totalResponseTime / completedItems.length : 0
        }
      },
      totalScore,
      maxPossibleScore,
      totalHintsUsed,
      averageHintsPerItem: session.items.length > 0 ? totalHintsUsed / session.items.length : 0
    }
  }
  
  // Skip current item
  const handleSkip = useCallback(async () => {
    if (!session || !currentItem) return
    
    currentItem.skipped = true
    await handleNext()
  }, [session, currentItem, handleNext])
  
  // Use hint
  const handleHint = useCallback(async () => {
    if (!session || !currentItem) return
    
    currentItem.hintsUsed++
    // Show hint in UI (implementation would depend on content adapter)
    alert(`Hint: ${currentItem.content.primaryAnswer.substring(0, 2)}...`)
  }, [session, currentItem])
  
  // Change review mode
  const handleModeChange = useCallback((newMode: ReviewMode) => {
    setCurrentMode(newMode)
    
    if (session) {
      const updatedSession = {
        ...session,
        mode: newMode
      }
      setSession(updatedSession)
    }
  }, [session])
  
  // Keyboard shortcuts
  useKeyboardShortcuts({
    'Enter': () => !showAnswer && (document.querySelector('[data-submit]') as HTMLElement)?.click(),
    'Space': () => showAnswer && handleNext(),
    'ArrowRight': () => showAnswer && handleNext(),
    's': () => handleSkip(),
    'h': () => handleHint(),
    '1': () => handleModeChange('recognition'),
    '2': () => handleModeChange('recall'),
    '3': () => handleModeChange('listening'),
    'Escape': () => onCancel()
  })
  
  const generateSessionId = () => {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
  
  // Render loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            {t('review.preparingSession')}
          </p>
        </div>
      </div>
    )
  }
  
  // Render error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold mb-2">{t('review.errorOccurred')}</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={onCancel}
            className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
          >
            {t('common.back')}
          </button>
        </div>
      </div>
    )
  }
  
  // Render session summary
  if (statistics) {
    return <SessionSummary statistics={statistics} onClose={onCancel} />
  }
  
  // Render review interface
  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light to-japanese-mizu/10 dark:from-dark-850 dark:to-dark-900">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-dark-800/80 backdrop-blur-md border-b border-gray-200 dark:border-dark-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Mode selector */}
            <div className="flex gap-2">
              {(['recognition', 'recall', 'listening'] as ReviewMode[]).map(m => {
                const isSupported = currentItem?.content.supportedModes?.includes(m) ?? true
                return (
                  <button
                    key={m}
                    onClick={() => isSupported && handleModeChange(m)}
                    disabled={!isSupported}
                    className={`
                      px-3 py-1 rounded-lg text-sm transition-colors
                      ${currentMode === m
                        ? 'bg-primary-500 text-white'
                        : isSupported
                          ? 'bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600'
                          : 'bg-gray-100 dark:bg-dark-700 opacity-50 cursor-not-allowed'
                      }
                    `}
                  >
                    {t(`review.modes.${m}`)}
                  </button>
                )
              })}
            </div>
            
            {/* Status indicators */}
            <div className="flex items-center gap-4">
              {isOffline && (
                <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200 rounded">
                  {t('review.offlineMode')}
                </span>
              )}
              <button
                onClick={handleHint}
                className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                title={t('review.hint')}
              >
                💡
              </button>
              <button
                onClick={onCancel}
                className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                title={t('common.exit')}
              >
                ✕
              </button>
            </div>
          </div>
          
          {/* Progress bar */}
          {session && (
            <ProgressBar
              current={currentIndex + 1}
              total={session.items.length}
              correct={session.items.filter(item => item.correct === true).length}
              streak={0}
            />
          )}
        </div>
      </div>
      
      {/* Main content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <AnimatePresence mode="wait">
          {currentItem && (
            <motion.div
              key={currentItem.content.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Review card */}
              <ReviewCard
                content={currentItem.content}
                mode={currentMode}
                showAnswer={showAnswer}
                onAudioPlay={() => {
                  if (currentItem.content.audioUrl) {
                    playAudio(currentItem.content.audioUrl).catch(err => {
                      console.error('Failed to play audio:', err)
                    })
                  }
                }}
              />
              
              {/* Answer input */}
              <AnswerInput
                mode={currentMode}
                content={currentItem.content}
                contentPool={contentPool || session?.items.map(item => item.content) || []}
                onAnswer={(answer, confidence) => handleAnswer(answer, confidence as 1 | 2 | 3 | 4 | 5 | undefined)}
                disabled={showAnswer}
                showAnswer={showAnswer}
              />
              
              {/* Action buttons */}
              <div className="mt-8 flex justify-center gap-4">
                {showAnswer ? (
                  <button
                    onClick={handleNext}
                    className="px-8 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 font-medium transition-colors"
                    data-submit
                  >
                    {t('common.next')}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleSkip}
                      className="px-6 py-3 bg-gray-200 dark:bg-dark-700 rounded-lg hover:bg-gray-300 dark:hover:bg-dark-600 transition-colors"
                    >
                      {t('review.skip')}
                    </button>
                    <button
                      onClick={() => setShowAnswer(true)}
                      className="px-6 py-3 bg-japanese-zen text-white rounded-lg hover:bg-japanese-zenDark transition-colors"
                    >
                      {t('review.showAnswer')}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}