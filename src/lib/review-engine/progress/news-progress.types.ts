/**
 * News Progress Types
 * Types for tracking reading progress and XP for news articles
 */

/**
 * Active reading session state (client-side only, held in memory)
 */
export interface NewsReadingSession {
  sessionId: string
  articleId: string
  userId: string
  difficulty: string // N5, N4, N3, N2, N1
  startedAt: number // timestamp ms
  activeTimeMs: number // accumulated active reading time
  lastActiveAt: number // last activity timestamp
  isPaused: boolean
  pausedAt?: number // when paused
}

/**
 * Persisted progress data (stored in Firebase)
 */
export interface NewsProgressData {
  odcId: string // composite key: `${userId}_${articleId}`
  userId: string
  articleId: string
  difficulty: string
  firstReadAt: string // ISO string
  lastReadAt: string // ISO string
  totalReadTimeMs: number // cumulative across all sessions
  completed: boolean
  xpEarned: number // total XP earned from this article
  version: number
}

/**
 * Request payload for completing a news reading session
 */
export interface NewsProgressCompleteRequest {
  articleId: string
  readingTimeMs: number
  difficulty: string
}

/**
 * Response from news progress completion
 */
export interface NewsProgressCompleteResponse {
  success: boolean
  data?: {
    xpEarned: number
    newTotalXP: number
    newLevel: number
    streakIncremented: boolean
    currentStreak: number
    bestStreak: number
    alreadyCompleted?: boolean
  }
  error?: {
    code: string
    message: string
  }
}
