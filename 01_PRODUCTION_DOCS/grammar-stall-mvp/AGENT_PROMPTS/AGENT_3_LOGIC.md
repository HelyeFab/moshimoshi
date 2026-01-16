# Agent 3 - Logic Engineer

**Role**: Exercise Engine & Validation Specialist
**Project**: Grammar Stall MVP
**Timeline**: Days 6-8
**Branch**: `grammar-stall-mvp-agent3-logic`

---

## 🎯 Your Mission

You are the **Logic Engineer** responsible for building the interactive exercise system. Your deliverables:

1. **Exercise Validator** - Check answers and provide feedback
2. **Exercise Engine** - Manage exercise state and flow
3. **Exercise Components** - UI for 3 exercise types (multiple choice, fill-in-blank, matching)
4. **Exercise Container** - Orchestrate the exercise experience
5. **Practice Page** - Route for exercise mode

**Total**: ~3 logic files + ~4 React components + 1 page file

---

## 📚 Required Reading

**READ THESE FIRST**:
1. `../MVP_SPECIFICATION.md` - Section: "Feature 3: Interactive Exercises"
2. `../TECHNICAL_DESIGN.md` - Sections: "Exercise Container" and "Answer Validation Logic"
3. `../DATA_SCHEMA.md` - Section: "Schema 3: Exercises"
4. Agent 1's output: `/public/data/grammar/exercises/` - Real exercise data
5. Agent 2's components: Review UI patterns they established

---

## 📅 Your Schedule

### Day 6: Validation Logic

**Morning**:
- [ ] Create `exerciseValidator.ts` - Answer validation
- [ ] Create `exerciseEngine.ts` - State management
- [ ] Write tests for normalization logic

**Afternoon**:
- [ ] Test with real exercise data
- [ ] Handle edge cases (extra spaces, case sensitivity)
- [ ] Submit for review

**Deliverable**: Working validation logic

---

### Day 7: Exercise Components

**Morning**:
- [ ] Create `MultipleChoice.tsx` - Multiple choice UI
- [ ] Create `FillInBlank.tsx` - Fill-in-blank UI
- [ ] Test both components with sample data

**Afternoon**:
- [ ] Create `SentenceMatching.tsx` - Matching UI
- [ ] Create `ExerciseFeedback.tsx` - Feedback display
- [ ] Create `ExerciseProgress.tsx` - Progress indicator
- [ ] Submit for review

**Deliverable**: All 3 exercise types working

---

### Day 8: Integration & Polish

**Morning**:
- [ ] Create `ExerciseContainer.tsx` - Exercise orchestrator
- [ ] Create practice page route
- [ ] Integrate all components

**Afternoon**:
- [ ] Handle completion (show results summary)
- [ ] Add loading states
- [ ] Test full exercise flow (10 questions)
- [ ] Submit for final review

**Deliverable**: Complete exercise system

---

## 📁 Files You'll Create

```
/src/lib/grammar/
├── exerciseValidator.ts          # YOU CREATE - Answer validation
├── exerciseEngine.ts             # YOU CREATE - Exercise state machine
└── types.ts                      # Agent 1 created, you may extend

/src/components/grammar/
├── ExerciseContainer.tsx         # YOU CREATE - Exercise orchestrator
├── ExerciseFeedback.tsx          # YOU CREATE - Feedback UI
├── ExerciseProgress.tsx          # YOU CREATE - Progress bar
└── exercises/
    ├── MultipleChoice.tsx        # YOU CREATE - MC exercise
    ├── FillInBlank.tsx           # YOU CREATE - Fill-in exercise
    └── SentenceMatching.tsx      # YOU CREATE - Matching exercise

/src/app/[locale]/learn/grammar/[pointId]/practice/
└── page.tsx                      # YOU CREATE - Practice route
```

---

## 🔧 Step-by-Step Implementation

### Step 1: Create Exercise Validator

**File**: `/src/lib/grammar/exerciseValidator.ts`

```typescript
import { Exercise, ExerciseResult } from './types'

/**
 * Validate user's answer against correct answer
 */
export function validateAnswer(
  exercise: Exercise,
  userAnswer: string | string[]
): ExerciseResult {
  // Normalize inputs
  const normalized = normalizeAnswer(userAnswer)

  // Get correct answer based on exercise type
  let correctAnswer: string
  let acceptedVariations: string[] = []

  if (exercise.type === 'multiple-choice') {
    correctAnswer = exercise.correctAnswer
  } else if (exercise.type === 'fill-in-blank') {
    correctAnswer = exercise.correctAnswer
    acceptedVariations = exercise.acceptedVariations || []
  } else if (exercise.type === 'sentence-matching') {
    // For matching, we expect array of pairs
    correctAnswer = exercise.pairs.map(p => p.japanese).join('|')
  }

  const normalizedCorrect = normalizeAnswer(correctAnswer)

  // Check exact match
  if (normalized === normalizedCorrect) {
    return {
      isCorrect: true,
      message: exercise.correctFeedback,
      correctAnswer: correctAnswer,
    }
  }

  // Check accepted variations (for fill-in-blank)
  if (acceptedVariations.length > 0) {
    const isAccepted = acceptedVariations.some(
      variation => normalizeAnswer(variation) === normalized
    )
    if (isAccepted) {
      return {
        isCorrect: true,
        message: exercise.correctFeedback,
        correctAnswer: correctAnswer,
      }
    }
  }

  // Incorrect answer
  return {
    isCorrect: false,
    message: exercise.incorrectFeedback,
    correctAnswer: correctAnswer,
    explanation: exercise.explanation,
  }
}

/**
 * Normalize answer for comparison
 * - Trim whitespace
 * - Lowercase for romaji
 * - Remove punctuation
 */
function normalizeAnswer(answer: string | string[]): string {
  if (Array.isArray(answer)) {
    return answer.map(a => normalize Single(a)).join('|')
  }
  return normalizeSingle(answer)
}

function normalizeSingle(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[。、！？!?.,]/g, '') // Remove common punctuation
    .replace(/\s+/g, '') // Remove all whitespace
}

/**
 * Calculate similarity between two strings (for partial credit - future feature)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1

  if (longer.length === 0) return 1.0

  const editDistance = levenshteinDistance(longer, shorter)
  return (longer.length - editDistance) / longer.length
}

/**
 * Levenshtein distance (edit distance between two strings)
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        )
      }
    }
  }

  return matrix[str2.length][str1.length]
}
```

---

### Step 2: Create Exercise Engine

**File**: `/src/lib/grammar/exerciseEngine.ts`

```typescript
import { Exercise } from './types'

/**
 * Exercise session state
 */
export interface ExerciseSession {
  exercises: Exercise[]
  currentIndex: number
  answers: (string | string[])[]
  results: boolean[]
  startTime: Date
  endTime?: Date
}

/**
 * Create a new exercise session
 */
export function createSession(exercises: Exercise[]): ExerciseSession {
  return {
    exercises,
    currentIndex: 0,
    answers: [],
    results: [],
    startTime: new Date(),
  }
}

/**
 * Record an answer and move to next exercise
 */
export function recordAnswer(
  session: ExerciseSession,
  answer: string | string[],
  isCorrect: boolean
): ExerciseSession {
  return {
    ...session,
    answers: [...session.answers, answer],
    results: [...session.results, isCorrect],
    currentIndex: session.currentIndex + 1,
  }
}

/**
 * Complete the session
 */
export function completeSession(session: ExerciseSession): ExerciseSession {
  return {
    ...session,
    endTime: new Date(),
  }
}

/**
 * Calculate session statistics
 */
export function calculateStats(session: ExerciseSession) {
  const totalQuestions = session.exercises.length
  const answeredQuestions = session.answers.length
  const correctAnswers = session.results.filter(r => r).length
  const accuracy = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0

  const duration = session.endTime
    ? session.endTime.getTime() - session.startTime.getTime()
    : 0

  return {
    totalQuestions,
    answeredQuestions,
    correctAnswers,
    incorrectAnswers: totalQuestions - correctAnswers,
    accuracy: Math.round(accuracy),
    durationMs: duration,
    durationSeconds: Math.round(duration / 1000),
  }
}
```

---

### Step 3: Create Exercise Container

**File**: `/src/components/grammar/ExerciseContainer.tsx`

```typescript
'use client'

import { useState } from 'react'
import { Exercise, ExerciseResult } from '@/lib/grammar/types'
import { validateAnswer } from '@/lib/grammar/exerciseValidator'
import { createSession, recordAnswer, completeSession, calculateStats } from '@/lib/grammar/exerciseEngine'
import { MultipleChoice } from './exercises/MultipleChoice'
import { FillInBlank } from './exercises/FillInBlank'
import { SentenceMatching } from './exercises/SentenceMatching'
import { ExerciseFeedback } from './ExerciseFeedback'
import { ExerciseProgress } from './ExerciseProgress'
import Link from 'next/link'

interface ExerciseContainerProps {
  exercises: Exercise[]
  grammarPointId: string
  locale: string
}

export function ExerciseContainer({ exercises, grammarPointId, locale }: ExerciseContainerProps) {
  const [session, setSession] = useState(() => createSession(exercises))
  const [feedback, setFeedback] = useState<ExerciseResult | null>(null)
  const [isComplete, setIsComplete] = useState(false)

  const currentExercise = exercises[session.currentIndex]
  const isLastExercise = session.currentIndex === exercises.length - 1

  const handleAnswer = (userAnswer: string | string[]) => {
    const result = validateAnswer(currentExercise, userAnswer)
    setFeedback(result)

    // Record answer
    const updatedSession = recordAnswer(session, userAnswer, result.isCorrect)
    setSession(updatedSession)
  }

  const handleNext = () => {
    if (isLastExercise) {
      // Complete session
      const completedSession = completeSession(session)
      setSession(completedSession)
      setIsComplete(true)
    } else {
      // Move to next question
      setFeedback(null)
    }
  }

  // Completion screen
  if (isComplete) {
    const stats = calculateStats(session)
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-8 text-center">
          <div className="text-6xl mb-4">
            {stats.accuracy >= 80 ? '🎉' : stats.accuracy >= 60 ? '👍' : '📚'}
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Exercise Complete!</h2>
          <p className="text-gray-600 mb-8">Great work practicing this grammar point.</p>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-3xl font-bold text-green-600">{stats.correctAnswers}</div>
              <div className="text-sm text-gray-600">Correct</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-3xl font-bold text-red-600">{stats.incorrectAnswers}</div>
              <div className="text-sm text-gray-600">Incorrect</div>
            </div>
          </div>

          <div className="mb-8">
            <div className="text-4xl font-bold text-blue-600 mb-1">{stats.accuracy}%</div>
            <div className="text-sm text-gray-600">Accuracy</div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={() => {
                setSession(createSession(exercises))
                setFeedback(null)
                setIsComplete(false)
              }}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              Practice Again
            </button>
            <Link
              href={`/${locale}/learn/grammar/${grammarPointId}`}
              className="block w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
            >
              Back to Grammar Point
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Exercise screen
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <ExerciseProgress current={session.currentIndex + 1} total={exercises.length} />

      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 mt-6">
        {/* Render exercise based on type */}
        {currentExercise.type === 'multiple-choice' && (
          <MultipleChoice
            exercise={currentExercise}
            onAnswer={handleAnswer}
            disabled={feedback !== null}
          />
        )}
        {currentExercise.type === 'fill-in-blank' && (
          <FillInBlank
            exercise={currentExercise}
            onAnswer={handleAnswer}
            disabled={feedback !== null}
          />
        )}
        {currentExercise.type === 'sentence-matching' && (
          <SentenceMatching
            exercise={currentExercise}
            onAnswer={handleAnswer}
            disabled={feedback !== null}
          />
        )}
      </div>

      {/* Feedback */}
      {feedback && (
        <ExerciseFeedback
          result={feedback}
          onNext={handleNext}
          isLastExercise={isLastExercise}
        />
      )}
    </div>
  )
}
```

---

### Step 4: Create Multiple Choice Component

**File**: `/src/components/grammar/exercises/MultipleChoice.tsx`

```typescript
'use client'

import { useState } from 'react'
import { MultipleChoiceExercise } from '@/lib/grammar/types'

interface MultipleChoiceProps {
  exercise: MultipleChoiceExercise
  onAnswer: (answer: string) => void
  disabled: boolean
}

export function MultipleChoice({ exercise, onAnswer, disabled }: MultipleChoiceProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null)

  const handleSelect = (optionId: string) => {
    if (disabled) return
    setSelectedOption(optionId)
  }

  const handleSubmit = () => {
    if (!selectedOption) return
    onAnswer(selectedOption)
  }

  return (
    <div>
      {/* Question */}
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">{exercise.question}</h3>
        {exercise.questionRomaji && (
          <p className="text-gray-600">{exercise.questionRomaji}</p>
        )}
      </div>

      {/* Options */}
      <div className="space-y-3 mb-6">
        {exercise.options.map(option => (
          <button
            key={option.id}
            onClick={() => handleSelect(option.id)}
            disabled={disabled}
            className={`w-full text-left p-4 rounded-lg border-2 transition ${
              selectedOption === option.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="flex items-center">
              <span className="flex-shrink-0 w-8 h-8 rounded-full border-2 border-current flex items-center justify-center font-bold mr-3">
                {option.id.toUpperCase()}
              </span>
              <div>
                <div className="font-medium text-gray-900">{option.text}</div>
                {option.romaji && (
                  <div className="text-sm text-gray-600">{option.romaji}</div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Submit Button */}
      {!disabled && (
        <button
          onClick={handleSubmit}
          disabled={!selectedOption}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
        >
          Submit Answer
        </button>
      )}
    </div>
  )
}
```

---

### Step 5: Create Fill-in-Blank Component

**File**: `/src/components/grammar/exercises/FillInBlank.tsx`

```typescript
'use client'

import { useState } from 'react'
import { FillInBlankExercise } from '@/lib/grammar/types'

interface FillInBlankProps {
  exercise: FillInBlankExercise
  onAnswer: (answer: string) => void
  disabled: boolean
}

export function FillInBlank({ exercise, onAnswer, disabled }: FillInBlankProps) {
  const [userAnswer, setUserAnswer] = useState('')
  const [showHints, setShowHints] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!userAnswer.trim()) return
    onAnswer(userAnswer)
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Question */}
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">{exercise.question}</h3>
        {exercise.questionRomaji && (
          <p className="text-gray-600">{exercise.questionRomaji}</p>
        )}
      </div>

      {/* Input */}
      <div className="mb-4">
        <input
          type="text"
          value={userAnswer}
          onChange={e => setUserAnswer(e.target.value)}
          disabled={disabled}
          placeholder="Type your answer here..."
          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed text-lg"
          autoFocus
        />
      </div>

      {/* Hints */}
      {exercise.hints && exercise.hints.length > 0 && !disabled && (
        <div className="mb-6">
          {!showHints ? (
            <button
              type="button"
              onClick={() => setShowHints(true)}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              💡 Show Hints
            </button>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-sm font-semibold text-blue-800 mb-2">Hints:</div>
              <ul className="text-sm text-blue-700 space-y-1">
                {exercise.hints.map((hint, idx) => (
                  <li key={idx}>• {hint}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Submit Button */}
      {!disabled && (
        <button
          type="submit"
          disabled={!userAnswer.trim()}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
        >
          Submit Answer
        </button>
      )}
    </form>
  )
}
```

---

### Step 6: Create Sentence Matching Component (Simplified)

**File**: `/src/components/grammar/exercises/SentenceMatching.tsx`

```typescript
'use client'

import { SentenceMatchingExercise } from '@/lib/grammar/types'

interface SentenceMatchingProps {
  exercise: SentenceMatchingExercise
  onAnswer: (answer: string[]) => void
  disabled: boolean
}

export function SentenceMatching({ exercise, onAnswer, disabled }: SentenceMatchingProps) {
  // For MVP: Display pairs and auto-validate (simplified matching)
  // Future: Add drag-and-drop or click-to-match interaction

  return (
    <div>
      {/* Question */}
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">{exercise.question}</h3>
      </div>

      {/* Pairs */}
      <div className="space-y-4 mb-6">
        {exercise.pairs.map((pair, idx) => (
          <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-semibold text-gray-500 mb-1">Japanese:</div>
                <div className="text-lg font-medium text-gray-900">{pair.japanese}</div>
                <div className="text-sm text-gray-600">{pair.romaji}</div>
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-500 mb-1">English:</div>
                <div className="text-lg text-gray-700">{pair.english}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Auto-submit (simplified for MVP) */}
      {!disabled && (
        <button
          onClick={() => onAnswer(exercise.pairs.map(p => p.japanese))}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
        >
          I understand these sentences
        </button>
      )}

      <p className="text-sm text-gray-500 text-center mt-3">
        Study the pairs above. Click when you're ready to continue.
      </p>
    </div>
  )
}
```

**Note**: This is a simplified matching exercise for MVP. For v2, you can add actual drag-and-drop or click-to-match interaction.

---

### Step 7: Create Exercise Feedback Component

**File**: `/src/components/grammar/ExerciseFeedback.tsx`

```typescript
import { ExerciseResult } from '@/lib/grammar/types'

interface ExerciseFeedbackProps {
  result: ExerciseResult
  onNext: () => void
  isLastExercise: boolean
}

export function ExerciseFeedback({ result, onNext, isLastExercise }: ExerciseFeedbackProps) {
  return (
    <div className="mt-6">
      <div
        className={`rounded-lg p-6 ${
          result.isCorrect
            ? 'bg-green-50 border-2 border-green-500'
            : 'bg-red-50 border-2 border-red-500'
        }`}
      >
        {/* Icon & Title */}
        <div className="flex items-start mb-4">
          <span className="text-3xl mr-3">{result.isCorrect ? '✅' : '❌'}</span>
          <div>
            <h4 className={`text-lg font-bold ${result.isCorrect ? 'text-green-800' : 'text-red-800'}`}>
              {result.isCorrect ? 'Correct!' : 'Not quite...'}
            </h4>
            <p className={`${result.isCorrect ? 'text-green-700' : 'text-red-700'}`}>
              {result.message}
            </p>
          </div>
        </div>

        {/* Show correct answer if wrong */}
        {!result.isCorrect && result.correctAnswer && (
          <div className="bg-white rounded-lg p-4 mb-4">
            <div className="text-sm font-semibold text-gray-600 mb-1">Correct Answer:</div>
            <div className="text-lg font-bold text-gray-900">{result.correctAnswer}</div>
          </div>
        )}

        {/* Explanation */}
        {result.explanation && (
          <div className="bg-white rounded-lg p-4 mb-4">
            <div className="text-sm font-semibold text-gray-600 mb-1">Explanation:</div>
            <p className="text-gray-700">{result.explanation}</p>
          </div>
        )}

        {/* Next Button */}
        <button
          onClick={onNext}
          className="w-full px-6 py-3 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 transition"
        >
          {isLastExercise ? 'See Results →' : 'Next Question →'}
        </button>
      </div>
    </div>
  )
}
```

---

### Step 8: Create Exercise Progress Component

**File**: `/src/components/grammar/ExerciseProgress.tsx`

```typescript
interface ExerciseProgressProps {
  current: number
  total: number
}

export function ExerciseProgress({ current, total }: ExerciseProgressProps) {
  const percentage = (current / total) * 100

  return (
    <div>
      {/* Text */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700">
          Question {current} of {total}
        </span>
        <span className="text-sm font-medium text-gray-700">{Math.round(percentage)}%</span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div
          className="bg-blue-600 h-3 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
```

---

### Step 9: Create Practice Page Route

**File**: `/src/app/[locale]/learn/grammar/[pointId]/practice/page.tsx`

```typescript
'use client'

import { useEffect, useState } from 'react'
import { ExerciseFile } from '@/lib/grammar/types'
import { ExerciseContainer } from '@/components/grammar/ExerciseContainer'
import Link from 'next/link'

export default function PracticePage({
  params,
}: {
  params: { locale: string; pointId: string }
}) {
  const [exerciseData, setExerciseData] = useState<ExerciseFile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/data/grammar/exercises/${params.pointId}.json`)
      .then(res => {
        if (!res.ok) throw new Error('Exercises not found')
        return res.json()
      })
      .then((data: ExerciseFile) => {
        setExerciseData(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [params.pointId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">📚</div>
          <p className="text-gray-600">Loading exercises...</p>
        </div>
      </div>
    )
  }

  if (error || !exerciseData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">😕</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Exercises Not Found</h2>
          <p className="text-gray-600 mb-6">
            We couldn't load the exercises for this grammar point.
          </p>
          <Link
            href={`/${params.locale}/learn/grammar/${params.pointId}`}
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
          >
            Back to Grammar Point
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <ExerciseContainer
        exercises={exerciseData.exercises}
        grammarPointId={params.pointId}
        locale={params.locale}
      />
    </div>
  )
}
```

---

## ✅ Quality Checklist

### Before Submitting

**Validation Logic**:
- [ ] Exact match works
- [ ] Accepted variations work (fill-in-blank)
- [ ] Case-insensitive for romaji
- [ ] Punctuation ignored
- [ ] Extra spaces trimmed
- [ ] Japanese characters preserved correctly

**Exercise Components**:
- [ ] Multiple choice: selecting option works
- [ ] Fill-in-blank: typing answer works
- [ ] Sentence matching: displays pairs correctly
- [ ] All components are client components (`'use client'`)
- [ ] Disabled state prevents interaction after answer

**Feedback**:
- [ ] Shows correct/incorrect message
- [ ] Shows correct answer if wrong
- [ ] Shows explanation
- [ ] "Next" button advances to next question

**Flow**:
- [ ] Progress bar updates
- [ ] 10 questions work end-to-end
- [ ] Completion screen shows stats
- [ ] "Practice Again" resets exercise
- [ ] "Back to Grammar Point" navigates correctly

**Code Quality**:
- [ ] TypeScript strict mode
- [ ] No `any` types
- [ ] No console errors
- [ ] Loading states
- [ ] Error handling

---

## 🧪 Testing Instructions

```bash
# 1. Start dev server
npm run dev

# 2. Navigate to practice page
http://localhost:3000/en/learn/grammar/001-x-wa-y-desu/practice

# 3. Test exercise flow
- [ ] First question loads
- [ ] Progress shows "Question 1 of 10"
- [ ] Multiple choice: select option → submit → see feedback
- [ ] Feedback shows correct/incorrect
- [ ] Click "Next" → goes to question 2
- [ ] Progress updates to "Question 2 of 10"
- [ ] Complete all 10 questions
- [ ] See results screen with stats

# 4. Test answer validation
- [ ] Multiple choice: correct answer shows success
- [ ] Multiple choice: wrong answer shows correct answer
- [ ] Fill-in-blank: exact match works
- [ ] Fill-in-blank: romaji variation works (e.g., "wa" = "は")
- [ ] Fill-in-blank: case insensitive (e.g., "Watashi" = "watashi")
- [ ] Fill-in-blank: extra spaces ignored

# 5. Test edge cases
- [ ] Empty answer → submit button disabled
- [ ] Clicking option after submitting → disabled
- [ ] Completing exercises → shows stats
- [ ] Stats are correct (count correct/incorrect)

# 6. Test mobile
- [ ] Works on iOS Safari
- [ ] Works on Android Chrome
- [ ] Touch targets are large enough
```

---

## 📞 Getting Help

**Questions?**
- Technical Lead: See `TECHNICAL_LEAD.md`
- Validation logic: Re-read `TECHNICAL_DESIGN.md` Answer Validation section
- Exercise data: Check Agent 1's JSON files

**Blockers?**
1. Debug yourself (console.log, React DevTools)
2. Check documentation
3. Ping Technical Lead

---

## 🎯 Success Criteria

You've succeeded when:

- [ ] All 3 exercise types work correctly
- [ ] Answer validation handles all cases
- [ ] Exercise flow is smooth (10 questions → results)
- [ ] Feedback is helpful and educational
- [ ] Mobile works (tested on real device)
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] Code reviewed and approved
- [ ] Integrated with Agent 2's UI

**You're building the interactive heart of the grammar stall. Make it engaging and educational!** 🎓

---

**Document Version**: 1.0.0
**Last Updated**: 2026-01-16
