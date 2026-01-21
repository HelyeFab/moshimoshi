/**
 * Drill Zod Schemas
 *
 * Runtime validation for drill session data structures.
 */

import { z } from 'zod'
import { ISODateTimeStringSchema } from './gamification.schema'

/**
 * Word type schema
 */
export const WordTypeSchema = z.enum([
  'Ichidan',
  'Godan',
  'Irregular',
  'i-adjective',
  'na-adjective',
  'noun',
  'adverb',
  'particle',
  'other'
])

export type WordType = z.infer<typeof WordTypeSchema>

/**
 * JLPT level schema
 */
export const JLPTLevelSchema = z.enum(['N5', 'N4', 'N3', 'N2', 'N1'])

export type JLPTLevel = z.infer<typeof JLPTLevelSchema>

/**
 * Japanese word schema
 */
export const JapaneseWordSchema = z.object({
  id: z.string(),
  kanji: z.string(),
  kana: z.string(),
  romaji: z.string().optional(),
  meaning: z.string(),
  english: z.string().optional(),
  type: WordTypeSchema,
  jlpt: JLPTLevelSchema.optional(),
  tags: z.array(z.string()).optional(),
  frequency: z.number().optional(),
  examples: z.array(z.string()).optional()
})

export type JapaneseWord = z.infer<typeof JapaneseWordSchema>

/**
 * Drill question schema
 */
export const DrillQuestionSchema = z.object({
  id: z.string(),
  word: JapaneseWordSchema,
  conjugationType: WordTypeSchema.optional(),
  targetForm: z.string(),
  stem: z.string(),
  correctAnswer: z.string(),
  options: z.array(z.string()),
  rule: z.string().optional()
})

export type DrillQuestion = z.infer<typeof DrillQuestionSchema>

/**
 * Drill mode schema
 */
export const DrillModeSchema = z.enum(['random', 'lists', 'srs'])

export type DrillMode = z.infer<typeof DrillModeSchema>

/**
 * Word type filter schema
 */
export const WordTypeFilterSchema = z.enum(['all', 'verbs', 'adjectives'])

export type WordTypeFilter = z.infer<typeof WordTypeFilterSchema>

/**
 * Drill session schema
 */
export const DrillSessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  questions: z.array(DrillQuestionSchema),
  currentQuestionIndex: z.number().int().min(0),
  score: z.number().int().min(0),
  startedAt: ISODateTimeStringSchema,
  completedAt: ISODateTimeStringSchema.optional(),
  mode: DrillModeSchema,
  wordTypeFilter: WordTypeFilterSchema,
  version: z.number().int().min(0),
  updatedAt: ISODateTimeStringSchema
})

export type DrillSession = z.infer<typeof DrillSessionSchema>

/**
 * Drill session create request schema
 */
export const DrillSessionCreateRequestSchema = z.object({
  mode: DrillModeSchema,
  wordTypeFilter: WordTypeFilterSchema,
  selectedLists: z.array(z.string()).optional(),
  questionsCount: z.number().int().min(1).max(50).optional()
})

export type DrillSessionCreateRequest = z.infer<typeof DrillSessionCreateRequestSchema>

/**
 * Drill session answer request schema
 */
export const DrillSessionAnswerRequestSchema = z.object({
  sessionId: z.string(),
  action: z.literal('answer'),
  answer: z.string()
})

export type DrillSessionAnswerRequest = z.infer<typeof DrillSessionAnswerRequestSchema>

/**
 * Per-question answer result (for SRS tracking)
 */
export const QuestionAnswerResultSchema = z.object({
  questionId: z.string(),
  wordId: z.string(),
  targetForm: z.string(),
  correct: z.boolean(),
  userAnswer: z.string(),
  correctAnswer: z.string(),
  responseTime: z.number().optional() // milliseconds
})

export type QuestionAnswerResult = z.infer<typeof QuestionAnswerResultSchema>

/**
 * Drill session complete request schema
 */
export const DrillSessionCompleteRequestSchema = z.object({
  sessionId: z.string(),
  action: z.literal('complete'),
  finalScore: z.number().int().min(0).optional(),
  accuracy: z.number().min(0).max(100).optional(),
  questionResults: z.array(QuestionAnswerResultSchema).optional() // NEW: For SRS tracking
})

export type DrillSessionCompleteRequest = z.infer<typeof DrillSessionCompleteRequestSchema>

/**
 * Drill results schema
 */
export const DrillResultsSchema = z.object({
  totalQuestions: z.number().int().min(0),
  correctAnswers: z.number().int().min(0),
  accuracy: z.number().min(0).max(100),
  timeSpent: z.number().min(0),
  wordsStudied: z.array(z.string())
})

export type DrillResults = z.infer<typeof DrillResultsSchema>

/**
 * Drill settings schema
 */
export const DrillSettingsSchema = z.object({
  questionsPerSession: z.number().int().min(1).max(50),
  autoAdvance: z.boolean(),
  showRules: z.boolean(),
  wordTypeFilter: WordTypeFilterSchema,
  drillMode: DrillModeSchema,
  selectedLists: z.array(z.string()).optional()
})

export type DrillSettings = z.infer<typeof DrillSettingsSchema>

/**
 * Validation helpers
 */
export const DrillValidator = {
  /**
   * Validate drill session
   */
  validateSession(data: unknown): DrillSession {
    return DrillSessionSchema.parse(data)
  },

  /**
   * Validate drill question
   */
  validateQuestion(data: unknown): DrillQuestion {
    return DrillQuestionSchema.parse(data)
  },

  /**
   * Check if accuracy matches score/total
   */
  checkAccuracyIntegrity(
    score: number,
    total: number,
    accuracy: number
  ): boolean {
    const expected = (score / total) * 100
    return Math.abs(expected - accuracy) < 0.1 // Allow small floating point errors
  }
}
