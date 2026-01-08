/**
 * Type definitions for Cloudflare R2 Backup System
 *
 * This file defines all types related to the R2 backup and restore feature
 * for Anki deck imports. See: 01_PRODUCTION_DOCS/3-Features/ANKI_R2_BACKUP_MVP.md
 */

/**
 * Manifest file stored in R2 alongside media files
 * Location: users/{userId}/decks/{deckId}/manifest.json
 */
export interface R2Manifest {
  deckId: string
  userId: string
  createdAt: string  // ISO 8601 timestamp
  files: R2ManifestFile[]
}

/**
 * Individual file entry in the manifest
 * Used for integrity verification during restore
 */
export interface R2ManifestFile {
  type: 'package' | 'media'
  name: string
  size: number        // Bytes
  sha256: string      // Hex-encoded SHA-256 hash
}

/**
 * Metadata document stored in Firestore
 * Collection: "anki_r2_backups"
 * Document ID: deckId
 *
 * This is a small metadata-only doc (<1MB) that references R2 objects.
 * Does NOT contain actual media or card data.
 */
export interface R2Metadata {
  deckId: string
  userId: string
  name: string
  cardCount: number
  hasMedia: boolean
  totalBytes: number
  r2: {
    packageKey: string    // R2 object key for package.apkg
    manifestKey: string   // R2 object key for manifest.json
    mediaPrefix: string   // R2 prefix for media files
  }
  originalFilename?: string
  updatedAt: number      // Unix timestamp (server-generated)
}

/**
 * Upload job stored in IndexedDB syncQueue
 * Reuses existing syncQueue store from AnkiMediaStore (src/lib/anki/mediaStore.ts:78-85)
 */
export interface R2UploadJob {
  id: string              // UUID
  deckId: string
  userId: string
  key: string             // R2 object key (e.g., "users/{uid}/decks/{did}/media/audio.mp3")
  type: 'package' | 'media' | 'manifest'
  status: 'pending' | 'uploading' | 'completed' | 'failed'
  retryCount: number
  maxRetries: number      // Default: 5
  scheduledFor: number    // Unix timestamp for next attempt
  error?: string          // Last error message
  progress?: number       // 0-100 for UI display
  createdAt: number       // Unix timestamp
  updatedAt?: number      // Unix timestamp for last status update
}

/**
 * Restore progress state for UI feedback
 */
export interface RestoreProgress {
  phase: 'fetching-metadata' | 'downloading-manifest' | 'downloading-media' | 'hydrating-deck' | 'complete' | 'error'
  filesDownloaded: number
  totalFiles: number
  currentFile?: string
  progress?: number
  bytesDownloaded?: number
  totalBytes?: number
  error?: string
}

/**
 * Backup info for listing available backups
 * Used by GET /api/anki/r2/backups endpoint
 */
export interface BackupInfo {
  deckId: string
  name: string
  cardCount: number
  hasMedia: boolean
  lastBackup: Date
  r2Keys: {
    manifestKey: string
    packageKey?: string
  }
}

/**
 * Request body for POST /api/anki/r2/upload-url
 */
export interface R2UploadUrlRequest {
  deckId: string
  key: string           // Must match pattern: users/{userId}/decks/{deckId}/...
  contentType: string   // MIME type (e.g., "image/jpeg", "audio/mpeg")
}

/**
 * Response from POST /api/anki/r2/upload-url
 */
export interface R2UploadUrlResponse {
  url: string           // Pre-signed S3 upload URL
  expiresIn: number     // Seconds until URL expires (typically 300 = 5 minutes)
  key: string           // Echo back the R2 object key for confirmation
}

/**
 * Request body for POST /api/anki/r2/download-url
 */
export interface R2DownloadUrlRequest {
  deckId: string
  key: string           // Must match pattern: users/{userId}/decks/{deckId}/...
}

/**
 * Response from POST /api/anki/r2/download-url
 */
export interface R2DownloadUrlResponse {
  url: string           // Pre-signed S3 download URL
  expiresIn: number     // Seconds until URL expires (typically 600 = 10 minutes)
  key: string           // Echo back the R2 object key
}

/**
 * Request body for POST /api/anki/r2/metadata
 */
export interface R2MetadataRequest {
  deckId: string
  name: string
  cardCount: number
  hasMedia: boolean
  totalBytes: number
  r2: {
    packageKey: string
    manifestKey: string
    mediaPrefix: string
  }
  originalFilename?: string
}

/**
 * Queue status summary for UI
 */
export interface R2QueueStatus {
  pending: number       // Jobs not yet started
  uploading: number     // Jobs currently in progress
  completed: number     // Successfully uploaded jobs
  failed: number        // Failed jobs (max retries exceeded)
  totalBytes: number    // Total bytes across all jobs
  uploadedBytes: number // Bytes successfully uploaded
}

/**
 * R2 client configuration
 */
export interface R2Config {
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  endpoint: string
  accountId: string
}
