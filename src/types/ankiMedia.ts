/**
 * Anki Media Type Definitions
 *
 * Data structures for Anki media storage and synchronization.
 * Follows the same patterns as userLists.ts for consistency.
 */

/**
 * Stored media in IndexedDB
 */
export interface StoredMedia {
  // Primary key
  id: string              // Filename from Anki (e.g., "paste-1234.jpg")

  // Media data
  blob: Blob              // Actual media file
  type: string            // MIME type (e.g., "image/jpeg", "audio/mpeg")
  size: number            // Bytes

  // Ownership (NEW)
  userId: string          // Owner's user ID
  deckId: string          // Parent deck ID

  // Sync tracking (NEW)
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed'
  firebaseUrl?: string    // Firebase Storage URL (after sync)

  // Retry tracking (NEW)
  retryCount: number      // Number of sync attempts
  lastSyncAttempt?: Date  // Last sync attempt timestamp
  syncError?: string      // Last error message

  // Timestamps
  createdAt: Date         // When stored locally
  updatedAt: Date         // Last modified
}

/**
 * Sync queue job for background processing
 */
export interface MediaSyncJob {
  // Primary key
  id: string              // UUID for this job

  // Job details
  action: 'upload' | 'delete'
  userId: string
  deckId: string
  filename: string        // References StoredMedia.id

  // Status
  status: 'pending' | 'processing' | 'failed'

  // Retry logic
  retryCount: number
  maxRetries: number      // Default: 5
  scheduledFor: Date      // Next attempt time (for exponential backoff)

  // Timestamps
  createdAt: Date
  lastAttempt?: Date

  // Error tracking
  error?: string
}

/**
 * Sync status for UI display
 */
export interface MediaSyncStatus {
  isOnline: boolean
  syncState: 'idle' | 'syncing' | 'synced' | 'error'
  pendingCount: number
  failedCount: number
  syncedCount: number      // Number of successfully synced files
  totalCount: number       // Total files in IndexedDB
  lastSyncTime: Date | null
  lastError: string | null
}

/**
 * Storage statistics
 */
export interface MediaStorageStats {
  totalFiles: number
  totalSize: number       // Bytes
  syncedFiles: number
  pendingFiles: number
  failedFiles: number
  oldestPendingDate?: Date
}
