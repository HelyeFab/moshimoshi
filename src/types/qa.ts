/**
 * Q&A System Types
 * Adapted from DevTalks blog system
 *
 * IMPORTANT: Q&A features are available to ALL users (free and premium)
 * No subscription checks should be added to Q&A functionality
 */

export interface QAAuthor {
  uid: string
  name: string
  email: string
  avatar?: string
  // User level/XP could be displayed but doesn't affect access
  level?: number
}

export interface Question {
  id: string
  title: string
  content: string // Markdown format
  tags: string[] // Topics like "grammar", "kanji", "vocabulary"
  author: QAAuthor

  // Engagement metrics
  upvotes: number
  downvotes: number
  answerCount: number
  viewCount: number
  hasAcceptedAnswer: boolean
  acceptedAnswerId?: string

  // Moderation
  moderationStatus: 'pending' | 'approved' | 'rejected'
  moderationReason?: string
  moderatedAt?: string

  // Timestamps
  createdAt: string
  updatedAt: string

  // Optional metadata
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  relatedArticleId?: string // Link to NHK article if relevant
}

export interface Answer {
  id: string
  questionId: string
  content: string // Markdown format
  author: QAAuthor

  // Engagement
  upvotes: number
  downvotes: number
  accepted: boolean // Marked as best answer by question author

  // Moderation
  moderationStatus: 'pending' | 'approved' | 'rejected'
  moderationReason?: string
  moderatedAt?: string

  // Timestamps
  createdAt: string
  updatedAt: string
}

export interface QuestionVote {
  id: string
  questionId: string
  userId: string
  voteType: 'upvote' | 'downvote'
  createdAt: string
}

export interface AnswerVote {
  id: string
  answerId: string
  userId: string
  voteType: 'upvote' | 'downvote'
  createdAt: string
}

// API response types
export interface CreateQuestionInput {
  title: string
  content: string
  tags: string[]
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  relatedArticleId?: string
}

export interface CreateAnswerInput {
  questionId: string
  content: string
}

export interface ModerationResult {
  approved: boolean
  reason?: string
  confidence: number
  flaggedTerms?: string[]
}

// Filter and sort options
export type QuestionSortBy = 'recent' | 'popular' | 'unanswered' | 'trending'
export type QuestionFilter = {
  tags?: string[]
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  hasAcceptedAnswer?: boolean
  authorId?: string
}

// Firestore collection names
export const QA_COLLECTIONS = {
  QUESTIONS: 'qa_questions',
  ANSWERS: 'qa_answers',
  QUESTION_VOTES: 'qa_question_votes',
  ANSWER_VOTES: 'qa_answer_votes',
} as const
