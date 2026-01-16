# Agent 3 - Logic Engineer (Standalone Prompt)

**Role**: Exercise Engine & Validation Specialist
**Project**: Grammar Stall MVP
**Timeline**: Days 6-8
**Branch**: `grammar-stall-mvp-agent3-logic`

---

## 🎯 Your Mission

Build the interactive exercise system. Your deliverables:

1. **Exercise Validator** - Check answers, provide feedback
2. **Exercise Engine** - State management
3. **Exercise Components** - 3 types (MC, fill-in, matching)
4. **Exercise Container** - Orchestrate flow
5. **Practice Page** - Route for exercises

**Total**: 3 logic files + 6 React components + 1 page

---

## 📅 Your Schedule

### Day 6: Validation Logic
- Create `exerciseValidator.ts`
- Create `exerciseEngine.ts`
- Test normalization logic

### Day 7: Components
- Create MultipleChoice component
- Create FillInBlank component
- Create SentenceMatching component
- Create feedback components

### Day 8: Integration
- Create ExerciseContainer
- Create practice page route
- Test full flow
- Handle completion

---

## 📁 Files You'll Create

```
/src/lib/grammar/
├── exerciseValidator.ts      # Answer validation
├── exerciseEngine.ts          # State machine
└── types.ts                   # Agent 1 created

/src/components/grammar/
├── ExerciseContainer.tsx      # Orchestrator
├── ExerciseFeedback.tsx       # Feedback UI
├── ExerciseProgress.tsx       # Progress bar
└── exercises/
    ├── MultipleChoice.tsx     # MC exercise
    ├── FillInBlank.tsx        # Fill-in
    └── SentenceMatching.tsx   # Matching

/src/app/[locale]/learn/grammar/[pointId]/practice/
└── page.tsx                   # Practice route
```

---

## 📊 EXERCISE DATA TYPES

Agent 1 created these. Import from `/src/lib/grammar/types.ts`:

```typescript
export interface ExerciseFile {
  grammarPointId: string
  version: string
  totalExercises: number
  exercises: Exercise[]
}

export type ExerciseType = 'multiple-choice' | 'fill-in-blank' | 'sentence-matching'

export interface BaseExercise {
  id: string
  type: ExerciseType
  question: string
  questionRomaji?: string
  correctFeedback: string
  incorrectFeedback: string
  explanation: string
  difficulty: 'easy' | 'medium' | 'hard'
}

export interface MultipleChoiceExercise extends BaseExercise {
  type: 'multiple-choice'
  options: MultipleChoiceOption[]
  correctAnswer: string // "a", "b", "c", "d"
}

export interface MultipleChoiceOption {
  id: string
  text: string
  romaji?: string
}

export interface FillInBlankExercise extends BaseExercise {
  type: 'fill-in-blank'
  correctAnswer: string
  acceptedVariations?: string[]
  hints?: string[]
}

export interface SentenceMatchingExercise extends BaseExercise {
  type: 'sentence-matching'
  pairs: SentencePair[]
}

export interface SentencePair {
  japanese: string
  romaji: string
  english: string
}

export type Exercise = MultipleChoiceExercise | FillInBlankExercise | SentenceMatchingExercise

export interface ExerciseResult {
  isCorrect: boolean
  message: string
  correctAnswer?: string
  explanation?: string
}
```

---

## 🔧 COMPLETE IMPLEMENTATION

### Step 1: Exercise Validator

**File**: `/src/lib/grammar/exerciseValidator.ts`

This validates user answers against correct answers.

```typescript
import { Exercise, ExerciseResult } from './types'

/**
 * Validate user's answer
 */
export function validateAnswer(
  exercise: Exercise,
  userAnswer: string | string[]
): ExerciseResult {
  const normalized = normalizeAnswer(userAnswer)

  // Get correct answer based on type
  let correctAnswer: string
  let acceptedVariations: string[] = []

  if (exercise.type === 'multiple-choice') {
    correctAnswer = exercise.correctAnswer
  } else if (exercise.type === 'fill-in-blank') {
    correctAnswer = exercise.correctAnswer
    acceptedVariations = exercise.acceptedVariations || []
  } else if (exercise.type === 'sentence-matching') {
    // For matching, auto-correct in MVP
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

  // Check accepted variations
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

  // Incorrect
  return {
    isCorrect: false,
    message: exercise.incorrectFeedback,
    correctAnswer: correctAnswer,
    explanation: exercise.explanation,
  }
}

/**
 * Normalize answer for comparison
 */
function normalizeAnswer(answer: string | string[]): string {
  if (Array.isArray(answer)) {
    return answer.map(a => normalizeSingle(a)).join('|')
  }
  return normalizeSingle(answer)
}

function normalizeSingle(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[。、！？!?.,]/g, '') // Remove punctuation
    .replace(/\s+/g, '') // Remove spaces
}
```

**Key Points**:
- Normalizes both user answer and correct answer
- Handles accepted variations for fill-in-blank
- Returns helpful feedback messages

---

### Step 2: Exercise Engine

**File**: `/src/lib/grammar/exerciseEngine.ts`

This manages exercise session state.

```typescript
import { Exercise } from './types'

export interface ExerciseSession {
  exercises: Exercise[]
  currentIndex: number
  answers: (string | string[])[]
  results: boolean[]
  startTime: Date
  endTime?: Date
}

/**
 * Create new session
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
 * Record answer and advance
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
 * Complete session
 */
export function completeSession(session: ExerciseSession): ExerciseSession {
  return {
    ...session,
    endTime: new Date(),
  }
}

/**
 * Calculate statistics
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

### Step 3: Exercise Container

**File**: `/src/components/grammar/ExerciseContainer.tsx`

This orchestrates the entire exercise flow.

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
    const updatedSession = recordAnswer(session, userAnswer, result.isCorrect)
    setSession(updatedSession)
  }

  const handleNext = () => {
    if (isLastExercise) {
      const completedSession = completeSession(session)
      setSession(completedSession)
      setIsComplete(true)
    } else {
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
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Exercise Complete!
          </h2>
          <p className="text-gray-600 mb-8">
            Great work practicing this grammar point.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-3xl font-bold text-green-600">
                {stats.correctAnswers}
              </div>
              <div className="text-sm text-gray-600">Correct</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-3xl font-bold text-red-600">
                {stats.incorrectAnswers}
              </div>
              <div className="text-sm text-gray-600">Incorrect</div>
            </div>
          </div>

          <div className="mb-8">
            <div className="text-4xl font-bold text-blue-600 mb-1">
              {stats.accuracy}%
            </div>
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

### Step 4: Multiple Choice Component

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
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          {exercise.question}
        </h3>
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

      {/* Submit */}
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

### Step 5: Fill-in-Blank Component

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
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          {exercise.question}
        </h3>
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
              <div className="text-sm font-semibold text-blue-800 mb-2">
                Hints:
              </div>
              <ul className="text-sm text-blue-700 space-y-1">
                {exercise.hints.map((hint, idx) => (
                  <li key={idx}>• {hint}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Submit */}
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

### Step 6: Sentence Matching Component (Simplified MVP)

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
  return (
    <div>
      {/* Question */}
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          {exercise.question}
        </h3>
      </div>

      {/* Pairs */}
      <div className="space-y-4 mb-6">
        {exercise.pairs.map((pair, idx) => (
          <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-semibold text-gray-500 mb-1">
                  Japanese:
                </div>
                <div className="text-lg font-medium text-gray-900">
                  {pair.japanese}
                </div>
                <div className="text-sm text-gray-600">{pair.romaji}</div>
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-500 mb-1">
                  English:
                </div>
                <div className="text-lg text-gray-700">{pair.english}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Submit (simplified) */}
      {!disabled && (
        <button
          onClick={() => onAnswer(exercise.pairs.map(p => p.japanese))}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
        >
          I understand these sentences
        </button>
      )}

      <p className="text-sm text-gray-500 text-center mt-3">
        Study the pairs above. Click when ready to continue.
      </p>
    </div>
  )
}
```

**Note**: Simplified for MVP. V2 can add drag-and-drop.

---

### Step 7: Exercise Feedback Component

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
          <span className="text-3xl mr-3">
            {result.isCorrect ? '✅' : '❌'}
          </span>
          <div>
            <h4 className={`text-lg font-bold ${result.isCorrect ? 'text-green-800' : 'text-red-800'}`}>
              {result.isCorrect ? 'Correct!' : 'Not quite...'}
            </h4>
            <p className={result.isCorrect ? 'text-green-700' : 'text-red-700'}>
              {result.message}
            </p>
          </div>
        </div>

        {/* Correct answer if wrong */}
        {!result.isCorrect && result.correctAnswer && (
          <div className="bg-white rounded-lg p-4 mb-4">
            <div className="text-sm font-semibold text-gray-600 mb-1">
              Correct Answer:
            </div>
            <div className="text-lg font-bold text-gray-900">
              {result.correctAnswer}
            </div>
          </div>
        )}

        {/* Explanation */}
        {result.explanation && (
          <div className="bg-white rounded-lg p-4 mb-4">
            <div className="text-sm font-semibold text-gray-600 mb-1">
              Explanation:
            </div>
            <p className="text-gray-700">{result.explanation}</p>
          </div>
        )}

        {/* Next */}
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

### Step 8: Exercise Progress Component

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
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700">
          Question {current} of {total}
        </span>
        <span className="text-sm font-medium text-gray-700">
          {Math.round(percentage)}%
        </span>
      </div>
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

### Step 9: Practice Page Route

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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Exercises Not Found
          </h2>
          <p className="text-gray-600 mb-6">
            We couldn't load exercises for this grammar point.
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

## ✅ QUALITY CHECKLIST

**Validation Logic**:
- [ ] Exact match works
- [ ] Accepted variations work
- [ ] Case-insensitive for romaji
- [ ] Punctuation ignored
- [ ] Japanese characters preserved

**Exercise Components**:
- [ ] MC: selecting option works
- [ ] Fill-in: typing works
- [ ] Matching: displays pairs
- [ ] Client components (`'use client'`)
- [ ] Disabled state prevents interaction

**Flow**:
- [ ] Progress bar updates
- [ ] 10 questions work
- [ ] Completion screen shows stats
- [ ] "Practice Again" resets
- [ ] Navigation works

**Code Quality**:
- [ ] TypeScript strict
- [ ] No `any` types
- [ ] No console errors
- [ ] Loading states
- [ ] Error handling

---

## 🧪 TESTING

```bash
npm run dev

# Test
http://localhost:3000/en/learn/grammar/001-x-wa-y-desu/practice

# Checklist
- [ ] First question loads
- [ ] Progress: "Question 1 of 10"
- [ ] MC: select → submit → feedback
- [ ] Fill-in: type → submit → feedback
- [ ] Feedback shows correct/incorrect
- [ ] "Next" advances
- [ ] Complete all 10
- [ ] See results with stats
- [ ] "Practice Again" works
```

---

## 🎯 SUCCESS CRITERIA

- [ ] All 3 exercise types work
- [ ] Answer validation handles all cases
- [ ] Exercise flow is smooth
- [ ] Feedback is helpful
- [ ] Mobile works
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] Integrated with Agent 2's UI

**Make it engaging and educational!** 🎓

---

**Document Version**: 2.0.0 (Standalone)
**Last Updated**: 2026-01-16
