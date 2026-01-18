import { Exercise } from './types'

export interface ExerciseSession {
  exercises: Exercise[]
  currentIndex: number
  answers: (string | string[])[]
  results: boolean[]
  startTime: Date
  endTime?: Date
}

export function createSession(exercises: Exercise[]): ExerciseSession {
  return {
    exercises,
    currentIndex: 0,
    answers: [],
    results: [],
    startTime: new Date(),
  }
}

export function recordAnswer(
  session: ExerciseSession,
  answer: string | string[],
  isCorrect: boolean
): ExerciseSession {
  return {
    ...session,
    answers: [...session.answers, answer],
    results: [...session.results, isCorrect],
  }
}

export function advanceSession(session: ExerciseSession): ExerciseSession {
  return {
    ...session,
    currentIndex: session.currentIndex + 1,
  }
}

export function completeSession(session: ExerciseSession): ExerciseSession {
  return {
    ...session,
    endTime: new Date(),
  }
}

export function calculateStats(session: ExerciseSession) {
  const totalQuestions = session.exercises.length
  const answeredQuestions = session.answers.length
  const correctAnswers = session.results.filter(result => result).length
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
