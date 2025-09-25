# Module 5: UI Components

**Status**: 🔴 Not Started  
**Priority**: HIGH  
**Owner**: Agent 5  
**Dependencies**: Core Interfaces (Module 1), Session Management (Module 3)  
**Estimated Time**: 5-6 hours  

## Overview
Build React components for the review engine UI, including the main ReviewEngine component, ReviewCard variants for different content types, various AnswerInput components, and progress displays.

## Deliverables

### 1. Main ReviewEngine Component

```typescript
// components/review-engine/ReviewEngine.tsx

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ReviewableContent, 
  ReviewMode, 
  ReviewSession,
  SessionStatistics 
} from '@/lib/review-engine/core/interfaces'
import { SessionManager } from '@/lib/review-engine/session/manager'
import { AdapterRegistry } from '@/lib/review-engine/adapters/registry'
import ReviewCard from './ReviewCard'
import AnswerInput from './AnswerInput'
import ProgressBar from './ProgressBar'
import SessionSummary from './SessionSummary'
import { useReviewEngine } from '@/hooks/useReviewEngine'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

interface ReviewEngineProps {
  content: ReviewableContent[]
  mode?: ReviewMode
  onComplete: (statistics: SessionStatistics) => void
  onCancel: () => void
  onProgressUpdate?: (progress: any) => void
  config?: ReviewEngineConfig
}

export default function ReviewEngine({
  content,
  mode = 'recognition',
  onComplete,
  onCancel,
  onProgressUpdate,
  config
}: ReviewEngineProps) {
  const [currentMode, setCurrentMode] = useState<ReviewMode>(mode)
  const [currentItem, setCurrentItem] = useState<ReviewSessionItem | null>(null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<ReviewSession | null>(null)
  const [statistics, setStatistics] = useState<SessionStatistics | null>(null)
  
  const sessionManager = useRef<SessionManager | null>(null)
  const { playSound, vibrate } = useReviewEngine(config)
  
  // Initialize session
  useEffect(() => {
    initializeSession()
    
    return () => {
      // Cleanup on unmount
      if (sessionManager.current && session?.status === 'active') {
        sessionManager.current.pauseSession()
      }
    }
  }, [])
  
  const initializeSession = async () => {
    try {
      setIsLoading(true)
      
      // Initialize adapters
      AdapterRegistry.initialize(config?.contentConfigs || {})
      
      // Create session manager
      sessionManager.current = new SessionManager(
        storage,
        analytics
      )
      
      // Subscribe to events
      sessionManager.current.on('progress.updated', handleProgressUpdate)
      sessionManager.current.on('achievement.unlocked', handleAchievement)
      sessionManager.current.on('error.occurred', handleError)
      
      // Start session
      const newSession = await sessionManager.current.startSession(
        userId,
        content,
        currentMode,
        config?.modeConfigs?.[currentMode]
      )
      
      setSession(newSession)
      setCurrentItem(sessionManager.current.getCurrentItem())
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }
  
  // Handle answer submission
  const handleAnswer = useCallback(async (answer: string, confidence?: number) => {
    if (!sessionManager.current || !currentItem || showAnswer) return
    
    try {
      const result = await sessionManager.current.submitAnswer(answer, confidence)
      
      setShowAnswer(true)
      
      // Play feedback sound
      if (result.correct) {
        playSound('correct')
      } else {
        playSound('incorrect')
        vibrate([100, 50, 100]) // Haptic feedback for wrong answer
      }
      
      // Auto-advance after delay
      if (config?.autoAdvance) {
        setTimeout(() => handleNext(), config.autoAdvanceDelay || 2000)
      }
    } catch (err) {
      setError(err.message)
    }
  }, [currentItem, showAnswer, config])
  
  // Move to next item
  const handleNext = useCallback(async () => {
    if (!sessionManager.current) return
    
    setShowAnswer(false)
    setError(null)
    
    const nextItem = await sessionManager.current.nextItem()
    
    if (nextItem) {
      setCurrentItem(nextItem)
    } else {
      // Session complete
      const stats = await sessionManager.current.completeSession()
      setStatistics(stats)
      onComplete(stats)
    }
  }, [onComplete])
  
  // Skip current item
  const handleSkip = useCallback(async () => {
    if (!sessionManager.current) return
    
    await sessionManager.current.skipItem()
    handleNext()
  }, [handleNext])
  
  // Use hint
  const handleHint = useCallback(async () => {
    if (!sessionManager.current || !currentItem) return
    
    const hint = await sessionManager.current.useHint()
    // Display hint in UI
  }, [currentItem])
  
  // Change review mode
  const handleModeChange = useCallback((newMode: ReviewMode) => {
    setCurrentMode(newMode)
    
    if (currentItem) {
      // Prepare content for new mode
      const adapter = AdapterRegistry.getAdapter(currentItem.content.contentType)
      const prepared = adapter.prepareForMode(currentItem.content, newMode)
      setCurrentItem({
        ...currentItem,
        content: prepared
      })
    }
  }, [currentItem])
  
  // Keyboard shortcuts
  useKeyboardShortcuts({
    'Enter': () => !showAnswer && document.querySelector('[data-submit]')?.click(),
    'Space': () => showAnswer && handleNext(),
    'ArrowRight': () => handleAnswer('correct'),
    'ArrowLeft': () => handleAnswer('incorrect'),
    's': () => handleSkip(),
    'h': () => handleHint(),
    '1': () => handleModeChange('recognition'),
    '2': () => handleModeChange('recall'),
    '3': () => handleModeChange('listening'),
    'Escape': () => onCancel()
  })
  
  // Handle progress updates
  const handleProgressUpdate = useCallback((data: any) => {
    if (onProgressUpdate) {
      onProgressUpdate(data)
    }
  }, [onProgressUpdate])
  
  // Handle achievements
  const handleAchievement = useCallback((achievement: any) => {
    // Show achievement notification
  }, [])
  
  // Handle errors
  const handleError = useCallback((error: any) => {
    setError(error.message)
  }, [])
  
  // Render loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Preparing your review session...
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
          <h2 className="text-xl font-bold mb-2">Oops! Something went wrong</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={onCancel}
            className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
          >
            Go Back
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
    <div className="min-h-screen bg-gradient-to-br from-background-light to-japanese-mizu/10 dark:from-dark-900 dark:to-dark-800">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-dark-800/80 backdrop-blur-md border-b border-gray-200 dark:border-dark-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Mode selector */}
            <div className="flex gap-2">
              {(['recognition', 'recall', 'listening'] as ReviewMode[]).map(m => {
                const isSupported = currentItem?.content.supportedModes?.includes(m)
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
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                )
              })}
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-4">
              <button
                onClick={handleHint}
                className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                title="Get hint (H)"
              >
                💡
              </button>
              <button
                onClick={onCancel}
                className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                title="Exit (Esc)"
              >
                ✕
              </button>
            </div>
          </div>
          
          {/* Progress bar */}
          {session && (
            <ProgressBar
              current={session.currentIndex + 1}
              total={session.items.length}
              correct={statistics?.correctItems || 0}
              streak={statistics?.currentStreak || 0}
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
                onAudioPlay={() => playSound('audio')}
              />
              
              {/* Answer input */}
              <AnswerInput
                mode={currentMode}
                content={currentItem.content}
                onAnswer={handleAnswer}
                disabled={showAnswer}
                showAnswer={showAnswer}
              />
              
              {/* Action buttons */}
              <div className="mt-8 flex justify-center gap-4">
                {showAnswer ? (
                  <button
                    onClick={handleNext}
                    className="px-8 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 font-medium"
                    data-submit
                  >
                    Next (Space)
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleSkip}
                      className="px-6 py-3 bg-gray-200 dark:bg-dark-700 rounded-lg hover:bg-gray-300 dark:hover:bg-dark-600"
                    >
                      Skip (S)
                    </button>
                    <button
                      onClick={() => setShowAnswer(true)}
                      className="px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
                    >
                      Show Answer
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
```

### 2. ReviewCard Component

```typescript
// components/review-engine/ReviewCard.tsx

import { ReviewableContent, ReviewMode } from '@/lib/review-engine/core/interfaces'
import { motion } from 'framer-motion'

interface ReviewCardProps {
  content: ReviewableContent
  mode: ReviewMode
  showAnswer: boolean
  onAudioPlay?: () => void
}

export default function ReviewCard({
  content,
  mode,
  showAnswer,
  onAudioPlay
}: ReviewCardProps) {
  // Render different layouts based on content type
  const renderContent = () => {
    switch (content.contentType) {
      case 'kana':
        return <KanaCard {...props} />
      case 'kanji':
        return <KanjiCard {...props} />
      case 'vocabulary':
        return <VocabularyCard {...props} />
      case 'sentence':
        return <SentenceCard {...props} />
      default:
        return <CustomCard {...props} />
    }
  }
  
  return (
    <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl p-8">
      {renderContent()}
    </div>
  )
}

// Specialized card components for each content type...
```

### 3. AnswerInput Component

```typescript
// components/review-engine/AnswerInput.tsx

interface AnswerInputProps {
  mode: ReviewMode
  content: ReviewableContent
  onAnswer: (answer: string, confidence?: number) => void
  disabled: boolean
  showAnswer: boolean
}

export default function AnswerInput({
  mode,
  content,
  onAnswer,
  disabled,
  showAnswer
}: AnswerInputProps) {
  switch (mode) {
    case 'recognition':
      return <MultipleChoiceInput {...props} />
    case 'recall':
      return <TextInput {...props} />
    case 'listening':
      return <MultipleChoiceInput {...props} />
    default:
      return null
  }
}
```

## Testing Requirements

```typescript
describe('ReviewEngine', () => {
  it('should initialize session correctly')
  it('should handle mode switching')
  it('should submit answers')
  it('should show progress')
  it('should handle keyboard shortcuts')
  it('should complete session')
})
```

## Acceptance Criteria

- [ ] Responsive design for all screen sizes
- [ ] Smooth animations and transitions
- [ ] Accessibility (ARIA labels, keyboard nav)
- [ ] Error handling with user feedback
- [ ] Loading states
- [ ] Offline mode indication
- [ ] 90% test coverage