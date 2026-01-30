import type { BlastLessonProgressRecord, BlastStep, BlastStepAnswer } from './types'

export const DEFAULT_LESSON_SIZE = 5

export function splitIntoLessons(kanjiIds: string[], lessonSize: number = DEFAULT_LESSON_SIZE): string[][] {
  if (lessonSize <= 0) return []
  const lessons: string[][] = []
  for (let i = 0; i < kanjiIds.length; i += lessonSize) {
    lessons.push(kanjiIds.slice(i, i + lessonSize))
  }
  return lessons
}

export function getLessonSlice(
  kanjiIds: string[],
  lessonIndex: number,
  lessonSize: number = DEFAULT_LESSON_SIZE
): string[] {
  if (lessonIndex < 0) return []
  const start = lessonIndex * lessonSize
  return kanjiIds.slice(start, start + lessonSize)
}

export function getLessonId(userId: string, level: string, lessonIndex: number): string {
  return `blast-lesson:${userId}:${level}:${lessonIndex}`
}

export function getNextLessonIndex(
  records: BlastLessonProgressRecord[],
  totalLessons: number
): number {
  if (totalLessons <= 0) return 0
  const completed = new Set(
    records.filter(record => record.completed).map(record => record.lessonIndex)
  )
  for (let i = 0; i < totalLessons; i++) {
    if (!completed.has(i)) return i
  }
  return Math.max(totalLessons - 1, 0)
}

export function getMistakeSteps(steps: BlastStep[], answers: BlastStepAnswer[]): BlastStep[] {
  const answerMap = new Map(answers.map(answer => [answer.stepIndex, answer]))
  const mistakeSteps = steps.filter((_, index) => {
    const answer = answerMap.get(index)
    return !answer || !answer.correct
  })
  return mistakeSteps.length > 0 ? mistakeSteps : steps
}
