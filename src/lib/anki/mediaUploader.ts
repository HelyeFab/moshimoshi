/**
 * Server-Side Media Upload Handler for Anki Media Files
 *
 * Uploads media via server-side API endpoint (NOT direct to Storage).
 * Follows the same pattern as ALL other premium features in the app.
 *
 * Why server-side?
 * - Storage rules with firestore.get() are unreliable for client uploads
 * - Consistent with flashcard sync, achievements, and all other premium features
 * - Server validates premium status using getStorageDecision()
 * - Admin SDK upload bypasses Storage rule complexity
 *
 * Storage Path: /anki-media/{userId}/{deckId}/{filename}
 *
 * Features:
 * - Server-side premium validation
 * - Upload via API endpoint
 * - Delete via Admin SDK
 * - Error handling for network, permissions, quota
 * - Content-type preservation
 */

export class AnkiMediaUploader {
  /**
   * Upload single media file via server-side API endpoint
   *
   * Server validates premium status and uploads to Firebase Storage via Admin SDK.
   * This follows the same pattern as ALL other premium features in the app.
   *
   * @param userId - Owner user ID (for validation)
   * @param deckId - Parent deck ID (for organization)
   * @param filename - Original Anki filename (e.g., "paste-1234.jpg")
   * @param blob - Media file as Blob
   * @returns Firebase Storage download URL
   *
   * @throws Error if upload fails due to network, permissions, or quota
   *
   * @example
   * const uploader = new AnkiMediaUploader()
   * const url = await uploader.uploadMedia('user123', 'deck456', 'paste-1234.jpg', blob)
   * // Returns: 'https://storage.googleapis.com/...'
   */
  async uploadMedia(
    userId: string,
    deckId: string,
    filename: string,
    blob: Blob
  ): Promise<string> {
    try {
      // Validate inputs
      if (!userId || !deckId || !filename) {
        throw new Error('Missing required parameters: userId, deckId, and filename are required')
      }

      if (!blob || blob.size === 0) {
        throw new Error('Invalid blob: blob is empty or null')
      }

      console.log(`[AnkiMediaUploader] Uploading to server: ${filename} (${blob.size} bytes, ${blob.type})`)

      // Create form data for multipart upload
      const formData = new FormData()
      formData.append('userId', userId)
      formData.append('deckId', deckId)
      formData.append('filename', filename)
      formData.append('file', blob, filename)

      // Upload via server-side API endpoint
      const response = await fetch('/api/anki/media/upload', {
        method: 'POST',
        credentials: 'include', // Include session cookie
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }))

        if (response.status === 401) {
          throw new Error('Not authenticated. Please sign in again.')
        }

        if (response.status === 403) {
          throw new Error('Premium subscription required for cloud sync.')
        }

        if (response.status === 413) {
          throw new Error('File too large (max 50MB per file)')
        }

        throw new Error(errorData.error || `Upload failed with status ${response.status}`)
      }

      const result = await response.json()

      console.log(`[AnkiMediaUploader] ✓ Upload successful: ${filename}`)

      return result.downloadURL

    } catch (error: unknown) {
      // Network or other errors
      if (error instanceof Error) {
        throw new Error(`Upload failed: ${error.message}`)
      }

      throw new Error('Upload failed: Unknown error')
    }
  }

  /**
   * Delete media file from Firebase Storage
   *
   * @param userId - Owner user ID
   * @param deckId - Parent deck ID
   * @param filename - File to delete
   *
   * @throws Error if deletion fails (except for file-not-found, which is ignored)
   *
   * @example
   * const uploader = new AnkiMediaUploader()
   * await uploader.deleteMedia('user123', 'deck456', 'paste-1234.jpg')
   */
  async deleteMedia(
    userId: string,
    deckId: string,
    filename: string
  ): Promise<void> {
    try {
      // Validate inputs
      if (!userId || !deckId || !filename) {
        throw new Error('Missing required parameters: userId, deckId, and filename are required')
      }

      // Sanitize filename
      const sanitizedFilename = this.sanitizeFilename(filename)

      // Construct storage path (must match upload path)
      const path = `anki-media/${userId}/${deckId}/${sanitizedFilename}`
      console.log(`[AnkiMediaUploader] Deleting: ${path}`)

      // Create storage reference
      const storageRef = ref(storage, path)

      // Delete the file
      await deleteObject(storageRef)

      console.log(`[AnkiMediaUploader] ✓ Delete successful: ${sanitizedFilename}`)

    } catch (error: unknown) {
      // Handle Firebase Storage errors
      if (error && typeof error === 'object' && 'code' in error) {
        const firebaseError = error as { code: string; message: string }

        // Silently ignore "file not found" errors (already deleted)
        if (firebaseError.code === 'storage/object-not-found') {
          console.log(`[AnkiMediaUploader] File already deleted: ${filename}`)
          return
        }

        if (firebaseError.code === 'storage/unauthorized') {
          throw new Error('Permission denied. User may not be premium or not authenticated.')
        }

        // Generic Firebase Storage error
        throw new Error(`Delete failed: ${firebaseError.message}`)
      }

      // Network or other errors
      if (error instanceof Error) {
        throw new Error(`Delete failed: ${error.message}`)
      }

      throw new Error('Delete failed: Unknown error')
    }
  }

  /**
   * Sanitize filename to prevent path traversal and invalid characters
   *
   * @param filename - Original filename
   * @returns Sanitized filename
   *
   * @example
   * sanitizeFilename('../../../etc/passwd') // Returns 'etc-passwd'
   * sanitizeFilename('hello world.jpg')      // Returns 'hello world.jpg'
   * sanitizeFilename('image<>:"|?.jpg')      // Returns 'image.jpg'
   */
  private sanitizeFilename(filename: string): string {
    // Remove path separators and traversal patterns
    let sanitized = filename.replace(/\.\./g, '').replace(/[/\\]/g, '-')

    // Remove invalid characters for Firebase Storage
    // Firebase Storage doesn't allow: #, [, ], *, ?
    sanitized = sanitized.replace(/[#[\]*?]/g, '')

    // Remove Windows reserved characters
    sanitized = sanitized.replace(/[<>:"|]/g, '')

    // Remove leading/trailing whitespace and dots
    sanitized = sanitized.trim().replace(/^\.+|\.+$/g, '')

    // Ensure filename is not empty after sanitization
    if (!sanitized) {
      throw new Error('Invalid filename: filename is empty after sanitization')
    }

    return sanitized
  }
}
