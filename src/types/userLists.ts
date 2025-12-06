// User Lists Types

export type ListType = 'sentence' | 'word' | 'verbAdj'

/**
 * SRS data for individual list items
 * Compatible with core SRSData interface from review-engine
 */
export interface ListItemSRSData {
  /** Days until next review */
  interval: number
  /** Difficulty factor (1.3 to 2.5) */
  easeFactor: number
  /** Number of consecutive successful reviews */
  repetitions: number
  /** Last review timestamp (ISO string for serialization) */
  lastReviewedAt: string | null
  /** Next scheduled review (ISO string for serialization) */
  nextReviewAt: string
  /** Learning status */
  status: 'new' | 'learning' | 'review' | 'mastered'
  /** Total review count */
  reviewCount: number
  /** Correct answer count */
  correctCount: number
  /** Number of times answer was incorrect (lapses) */
  lapses: number
}

export interface ListItem {
  id: string // UUID for each item
  content: string // The actual text (word, sentence, etc.)
  type: ListType
  metadata?: {
    reading?: string // Hiragana reading for kanji
    meaning?: string // English translation
    notes?: string // User notes
    jlptLevel?: number // JLPT level if applicable
    tags?: string[] // Custom tags
    addedAt: number // Timestamp when added
  }
  /** SRS data for spaced repetition tracking */
  srsData?: ListItemSRSData
}

export interface UserList {
  id: string // UUID for the list
  userId: string // Firebase UID
  name: string // List name
  type: ListType // Type of content in this list
  emoji: string // Custom emoji for the list
  color: string // Theme color (from palette)
  items: ListItem[] // Array of items
  createdAt: number // Timestamp
  updatedAt: number // Timestamp
  isDefault?: boolean // System-created lists
  settings?: {
    reviewEnabled?: boolean // Can be reviewed in Review Engine
    sortOrder?: 'manual' | 'alphabetical' | 'dateAdded'
  }
}

export interface ListStats {
  totalItems: number
  reviewedItems?: number
  masteredItems?: number
  lastReviewed?: number
  lastAdded?: number
}

// Request/Response types for API
export interface CreateListRequest {
  name: string
  type: ListType
  emoji?: string
  color?: string
  firstItem?: {
    content: string
    metadata?: ListItem['metadata']
  }
}

export interface AddItemRequest {
  listId: string
  content: string
  metadata?: ListItem['metadata']
}

export interface UpdateListRequest {
  name?: string
  emoji?: string
  color?: string
  settings?: UserList['settings']
  /** Update list items (for SRS data persistence) */
  items?: ListItem[]
}

export interface ImportListRequest {
  name: string
  type: ListType
  format: 'csv' | 'json' | 'text'
  data: string
  emoji?: string
  color?: string
}

export interface ExportListResponse {
  format: 'csv' | 'json'
  data: string
  filename: string
}

// Color palette for lists (using existing theme colors)
export const LIST_COLORS = [
  'primary', // Sakura pink
  'ocean', // Blue
  'matcha', // Green
  'sunset', // Orange
  'lavender', // Purple
  'monochrome', // Gray
] as const

export type ListColor = (typeof LIST_COLORS)[number]

// Default emojis for list types
export const DEFAULT_LIST_EMOJIS = {
  sentence: '📝',
  word: '📖',
  verbAdj: '🔤',
} as const

// Suggested emojis for lists
export const SUGGESTED_EMOJIS = [
  '📚',
  '📖',
  '📝',
  '✍️',
  '🎯',
  '⭐',
  '🌟',
  '💫',
  '🔥',
  '💡',
  '🧠',
  '📋',
  '📌',
  '🔖',
  '📍',
  '🎨',
  '🌸',
  '🍃',
  '🌊',
  '🏔️',
  '🎌',
  '🗾',
  '⛩️',
  '🏯',
  '🍱',
  '🍜',
  '🍣',
  '🎋',
  '🎍',
  '🌅',
] as const

/**
 * Creates initial SRS data for a new list item
 */
export function createInitialSRSData(): ListItemSRSData {
  const now = new Date()
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  return {
    interval: 1,
    easeFactor: 2.5,
    repetitions: 0,
    lastReviewedAt: null,
    nextReviewAt: tomorrow.toISOString(),
    status: 'new',
    reviewCount: 0,
    correctCount: 0,
    lapses: 0,
  }
}
