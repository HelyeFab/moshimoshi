import {
  DEFAULT_LESSON_SIZE,
  getLessonId,
  getLessonSlice,
  getMistakeSteps,
  getNextLessonIndex,
  splitIntoLessons
} from '../lesson-utils'
import type { BlastLessonProgressRecord, BlastStep, BlastStepAnswer } from '../types'

describe('lesson-utils', () => {
  it('splits kanji into fixed-size lessons', () => {
    const kanji = ['日', '月', '火', '水', '木', '金', '土', '山', '川', '田', '人', '口']
    const lessons = splitIntoLessons(kanji, 5)
    expect(lessons).toHaveLength(3)
    expect(lessons[0]).toHaveLength(5)
    expect(lessons[1]).toHaveLength(5)
    expect(lessons[2]).toHaveLength(2)
  })

  it('gets correct lesson slice for index', () => {
    const kanji = ['日', '月', '火', '水', '木', '金', '土']
    const slice = getLessonSlice(kanji, 1, 5)
    expect(slice).toEqual(['金', '土'])
  })

  it('returns deterministic lesson id', () => {
    expect(getLessonId('user-1', 'N5', 2)).toBe('blast-lesson:user-1:N5:2')
  })

  it('finds next incomplete lesson index', () => {
    const records: BlastLessonProgressRecord[] = [
      {
        lessonId: 'a',
        userId: 'user-1',
        level: 'N5',
        lessonIndex: 0,
        lessonSize: DEFAULT_LESSON_SIZE,
        totalLessons: 3,
        kanjiIds: ['日'],
        accuracy: 100,
        completed: true,
        attempts: 1,
        lastAttemptAt: '2026-01-01T00:00:00.000Z',
        completedAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        source: 'blast-lesson'
      }
    ]
    expect(getNextLessonIndex(records, 3)).toBe(1)
  })

  it('returns mistake-only steps from answers', () => {
    const steps: BlastStep[] = [
      { stepType: 'meaning_to_jp_mcq', itemId: '1', prompt: 'a', answer: 'a' },
      { stepType: 'jp_reassemble', itemId: '2', prompt: 'b', answer: 'b' },
      { stepType: 'jp_to_meaning_mcq', itemId: '3', prompt: 'c', answer: 'c' }
    ]
    const answers: BlastStepAnswer[] = [
      { stepIndex: 0, itemId: '1', stepType: 'meaning_to_jp_mcq', userAnswer: 'a', correct: true, responseTime: 100, timestamp: new Date() },
      { stepIndex: 1, itemId: '2', stepType: 'jp_reassemble', userAnswer: 'x', correct: false, responseTime: 120, timestamp: new Date() },
      { stepIndex: 2, itemId: '3', stepType: 'jp_to_meaning_mcq', userAnswer: 'c', correct: true, responseTime: 90, timestamp: new Date() }
    ]

    const mistakes = getMistakeSteps(steps, answers)
    expect(mistakes).toHaveLength(1)
    expect(mistakes[0]?.itemId).toBe('2')
  })
})
