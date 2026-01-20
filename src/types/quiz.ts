/**
 * Unified Quiz Types for Moshimoshi
 *
 * This file defines the unified quiz question interface used across:
 * - Stories (StoryQuizQuestion)
 * - Comics (ComicQuizQuestion)
 * - News Articles (future)
 *
 * BREAKING CHANGE: Unifies correctIndex (legacy stories) and correctAnswer (comics)
 * into a single correctAnswer field that can be either a number (for multiple-choice)
 * or a string (for fill-in-blank questions).
 */

/**
 * Base quiz question interface - unified for all content types
 *
 * This replaces the legacy StoryQuizQuestion.correctIndex field with correctAnswer
 * to match the comic quiz format and support multiple question types.
 */
export interface BaseQuizQuestion {
  /** Unique identifier for the question */
  id: string

  /** Question text in English */
  question: string

  /** Question text in Japanese (optional for lower JLPT levels) */
  questionJa?: string

  /** Array of answer options for multiple-choice questions */
  options: string[]

  /** Array of answer options in Japanese with furigana (optional) */
  optionsJa?: string[]

  /**
   * UNIFIED FIELD: The correct answer
   * - For multiple-choice questions: number (0-based index into options array)
   * - For fill-in-blank questions: string (exact answer text)
   */
  correctAnswer: string | number

  /** Explanation of why this answer is correct (English) */
  explanation?: string

  /** Explanation in Japanese */
  explanationJa?: string

  /** Difficulty level (1-5, where 5 is most difficult) */
  difficulty?: number

  /** Tags for categorization (e.g., 'grammar', 'vocabulary', 'cultural') */
  tags?: string[]

  // === Comic-specific fields (optional) ===

  /** Type of question - used primarily for comics */
  type?: 'multiple-choice' | 'fill-blank' | 'listening' | 'reading-comprehension'

  /** Panel number this question relates to (comics only) */
  relatedPanel?: number

  /** Audio URL for listening comprehension questions */
  audioUrl?: string
}

/**
 * Legacy story quiz question format (pre-migration)
 * Used for backward compatibility and migration utilities
 */
export interface LegacyStoryQuizQuestion {
  id: string
  question: string
  questionJa?: string
  options: string[]
  correctIndex: number  // OLD FIELD - being migrated to correctAnswer
  explanation?: string
  explanationJa?: string
  difficulty?: number
  tags?: string[]
}

/**
 * Type guard to check if a question is multiple-choice (correctAnswer is number)
 *
 * @param question - The quiz question to check
 * @returns True if the question uses numeric answer (index)
 *
 * @example
 * if (isMultipleChoiceQuestion(question)) {
 *   const selectedOption = question.options[question.correctAnswer]
 * }
 */
export function isMultipleChoiceQuestion(
  question: BaseQuizQuestion
): question is BaseQuizQuestion & { correctAnswer: number } {
  return typeof question.correctAnswer === 'number'
}

/**
 * Type guard to check if a question is fill-in-blank (correctAnswer is string)
 *
 * @param question - The quiz question to check
 * @returns True if the question uses string answer
 *
 * @example
 * if (isFillBlankQuestion(question)) {
 *   const isCorrect = userAnswer.trim().toLowerCase() === question.correctAnswer.toLowerCase()
 * }
 */
export function isFillBlankQuestion(
  question: BaseQuizQuestion
): question is BaseQuizQuestion & { correctAnswer: string } {
  return typeof question.correctAnswer === 'string'
}

/**
 * Migrate a legacy story quiz question to the new unified format
 *
 * Converts correctIndex (number) to correctAnswer (number) and adds type field.
 * This is safe because story questions are always multiple-choice.
 *
 * @param legacy - Legacy quiz question with correctIndex field
 * @returns Unified quiz question with correctAnswer field
 *
 * @example
 * const legacyQuestion = {
 *   id: 'q1',
 *   question: 'What is the capital of Japan?',
 *   options: ['Tokyo', 'Osaka', 'Kyoto', 'Nagoya'],
 *   correctIndex: 0
 * }
 * const modernQuestion = migrateLegacyQuizQuestion(legacyQuestion)
 * // modernQuestion.correctAnswer === 0
 * // modernQuestion.type === 'multiple-choice'
 */
export function migrateLegacyQuizQuestion(
  legacy: LegacyStoryQuizQuestion
): BaseQuizQuestion {
  const { correctIndex, ...rest } = legacy

  return {
    ...rest,
    correctAnswer: correctIndex,  // Convert correctIndex to correctAnswer
    type: 'multiple-choice',      // All legacy story questions are multiple-choice
  }
}

/**
 * Validate that a quiz question has the required fields
 *
 * @param question - The question to validate
 * @returns True if the question is valid
 */
export function isValidQuizQuestion(question: BaseQuizQuestion): boolean {
  // Required fields
  if (!question.id || !question.question || !question.options || question.options.length === 0) {
    return false
  }

  // correctAnswer must exist and be either string or number
  if (question.correctAnswer === undefined || question.correctAnswer === null) {
    return false
  }

  // If correctAnswer is a number, it must be a valid index
  if (typeof question.correctAnswer === 'number') {
    if (question.correctAnswer < 0 || question.correctAnswer >= question.options.length) {
      return false
    }
  }

  return true
}

/**
 * Normalize a user's answer for comparison
 *
 * For string answers (fill-in-blank), this trims whitespace and converts to lowercase.
 * For numeric answers, returns as-is.
 *
 * @param answer - The user's answer
 * @returns Normalized answer for comparison
 */
export function normalizeAnswer(answer: string | number): string | number {
  if (typeof answer === 'string') {
    return answer.trim().toLowerCase()
  }
  return answer
}

/**
 * Check if a user's answer is correct
 *
 * @param question - The quiz question
 * @param userAnswer - The user's answer (can be index or string)
 * @returns True if the answer is correct
 *
 * @example
 * // Multiple choice (numeric answer)
 * isAnswerCorrect(question, 2) // true if option index 2 is correct
 *
 * // Fill-in-blank (string answer)
 * isAnswerCorrect(question, "Tokyo") // true if "tokyo" matches (case-insensitive)
 */
export function isAnswerCorrect(
  question: BaseQuizQuestion,
  userAnswer: string | number | null
): boolean {
  if (userAnswer === null || userAnswer === undefined) {
    return false
  }

  // Normalize both answers for comparison
  const normalizedCorrect = normalizeAnswer(question.correctAnswer)
  const normalizedUser = normalizeAnswer(userAnswer)

  return normalizedCorrect === normalizedUser
}
