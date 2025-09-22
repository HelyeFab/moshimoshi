/**
 * Type definitions for the Review Dashboard
 */

export type ContentType = 'kana' | 'kanji' | 'vocabulary' | 'sentence'
export type ReviewStatus = 'new' | 'learning' | 'review' | 'mastered'
export type FilterType = 'all' | ContentType

export interface ReviewItem {
  id: string
  contentType: ContentType
  primaryDisplay: string
  secondaryDisplay?: string
  status: ReviewStatus
  lastReviewedAt?: Date
  nextReviewAt?: Date
  srsLevel?: number
  accuracy: number
  reviewCount: number
  correctCount: number
  incorrectCount?: number
  tags?: string[]
  source?: string
  interval?: number
  easeFactor?: number
  streak?: number
}

export interface ReviewStats {
  totalStudied: number
  totalLearned: number
  totalMastered: number
  dueNow: number
  dueToday: number
  dueTomorrow: number
  dueThisWeek: number
  streakDays?: number
  totalReviewTime?: number
  averageAccuracy?: number
  contentBreakdown?: {
    [key in ContentType]?: {
      studied: number
      learned: number
      mastered: number
    }
  }
}

export interface ReviewTimeInfo {
  text: string
  color: string
  priority: 'high' | 'medium' | 'low'
}

export interface ProgressApiResponse {
  items: ReviewItem[]
  total: number
  timestamp: string
}

export interface StatsApiResponse extends ReviewStats {
  lastUpdated?: string
}

export interface ReviewScheduleGroup {
  label: string
  items: ReviewItem[]
  icon?: string
  color?: string
}