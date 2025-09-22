/**
 * Study List Types for Custom User Lists
 * Supports flashcards, drillable items (verbs/adjectives), and sentences
 */

import type { VocabularyWord } from './vocabulary';
import type { KanjiData } from './kanji';

// List types - determines what content can be added
export type StudyListType = 'flashcard' | 'drillable' | 'sentence';

// Content types that can be saved to lists
export type StudyItemType = 'word' | 'kanji' | 'sentence' | 'phrase';

// Predefined color palette matching theme system
export const STUDY_LIST_COLORS = [
  'primary-500',    // Theme primary
  'accent-500',     // Theme accent
  'success-500',    // Green
  'warning-500',    // Yellow
  'danger-500',     // Red
  'purple-500',     // Purple
  'indigo-500',     // Indigo
  'teal-500',       // Teal
  'orange-500',     // Orange
  'pink-500',       // Pink
] as const;

export type StudyListColor = typeof STUDY_LIST_COLORS[number];

/**
 * Main Study List Interface
 * Represents a user-created collection of learning items
 */
export interface StudyList {
  id: string;                    // UUID
  userId: string;                 // Owner's user ID
  name: string;                   // User-defined name
  description?: string;           // Optional description
  type: StudyListType;           // List type (determines allowed content)
  itemIds: string[];             // Array of SavedStudyItem IDs
  color: StudyListColor;         // Theme-aware color
  icon?: string;                 // Optional emoji or icon name

  // Metadata
  createdAt: number;             // Unix timestamp
  updatedAt: number;             // Unix timestamp
  lastReviewedAt?: number;       // Last review session timestamp

  // Statistics
  stats?: {
    totalReviews: number;        // Total review sessions
    averageAccuracy: number;     // Overall accuracy (0-100)
    masteredCount: number;       // Items with mastery status
    learningCount: number;       // Items currently being learned
  };

  // Sync metadata
  syncedAt?: number;             // Last cloud sync timestamp
  version: number;               // For conflict resolution
  deleted?: boolean;             // Soft delete flag
}

/**
 * Saved Study Item Interface
 * Represents an individual item saved to one or more lists
 */
export interface SavedStudyItem {
  id: string;                    // UUID
  userId: string;                // Owner's user ID
  itemType: StudyItemType;      // Type of content

  // Content references (only one will be populated based on itemType)
  wordId?: string;               // Reference to vocabulary word
  kanjiId?: string;              // Reference to kanji
  sentenceId?: string;           // Reference to sentence

  // Embedded content for quick access (denormalized)
  content: {
    primary: string;             // Main content (word, kanji, sentence)
    reading?: string;            // Furigana/reading
    meaning: string;             // English meaning
    audio?: string;              // Audio URL if available
    partOfSpeech?: string[];     // For words: ['verb', 'ichidan']
    jlptLevel?: string;          // JLPT level if applicable
    frequency?: number;          // Usage frequency ranking
  };

  // List associations
  listIds: string[];             // Many-to-many with StudyList

  // Timestamps
  savedAt: number;               // When first saved
  lastModified: number;          // Last update

  // Review data (syncs with Review Engine)
  reviewData?: {
    nextReviewDate: number;      // Next scheduled review
    interval: number;            // Current SRS interval (days)
    easeFactor: number;          // SRS ease factor
    reviewCount: number;         // Total reviews
    correctCount: number;        // Correct answers
    lastReviewedAt?: number;     // Last review timestamp
    mastered: boolean;           // Mastery status
  };

  // User notes
  notes?: string;                // Personal notes/mnemonics
  tags?: string[];               // User-defined tags

  // Sync metadata
  syncedAt?: number;             // Last cloud sync
  version: number;               // Version for conflicts
}

/**
 * Study List Creation Input
 */
export interface CreateStudyListInput {
  name: string;
  description?: string;
  type: StudyListType;
  color?: StudyListColor;
  icon?: string;
}

/**
 * Study List Update Input
 */
export interface UpdateStudyListInput {
  name?: string;
  description?: string;
  color?: StudyListColor;
  icon?: string;
}

/**
 * Add Item to List Input
 */
export interface AddToListInput {
  itemType: StudyItemType;
  itemId: string;                 // ID of the word/kanji/sentence
  listIds: string[];              // Lists to add to
  notes?: string;
  tags?: string[];
}

/**
 * Study List Filter Options
 */
export interface StudyListFilters {
  type?: StudyListType;
  hasReviewItems?: boolean;       // Has items due for review
  minItemCount?: number;
  maxItemCount?: number;
  searchQuery?: string;           // Search in name/description
  sortBy?: 'name' | 'created' | 'updated' | 'itemCount';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Study Item Filter Options
 */
export interface StudyItemFilters {
  itemType?: StudyItemType;
  listId?: string;                // Filter by specific list
  jlptLevel?: string;
  mastered?: boolean;
  dueForReview?: boolean;
  searchQuery?: string;
  tags?: string[];
  sortBy?: 'saved' | 'reviewed' | 'accuracy';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Validation result for adding items
 */
export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  incompatibleLists?: string[];   // List IDs that can't accept this item
}

/**
 * Sync status for cloud operations
 */
export interface SyncStatus {
  isSyncing: boolean;
  lastSyncAt?: number;
  pendingChanges: number;
  error?: string;
}

/**
 * User's list quota information
 */
export interface ListQuota {
  used: number;                   // Current list count
  limit: number;                  // Max allowed (-1 for unlimited)
  canCreate: boolean;
  isUnlimited: boolean;
}