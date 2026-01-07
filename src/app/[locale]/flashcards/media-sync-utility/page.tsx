'use client'

/**
 * Force Media Sync Admin Page
 *
 * Purpose: One-time utility to upload existing IndexedDB media to Firebase Storage
 *
 * Use Case: Decks imported BEFORE Task 6 implementation have media files stuck
 *           in local IndexedDB without Firebase Storage sync.
 *
 * What This Does:
 * 1. Scans IndexedDB for media files with syncStatus='pending'
 * 2. Uploads each file to Firebase Storage via AnkiMediaManager
 * 3. Creates Firestore metadata entries via API
 * 4. Updates quota badge
 *
 * Usage: Navigate to /admin/force-media-sync while signed in
 *
 * DELETE THIS PAGE after running once per user.
 */

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { AnkiMediaStore } from '@/lib/anki/mediaStore'
import { AnkiMediaManager } from '@/lib/anki/AnkiMediaManager'

interface MediaFile {
  id: string
  userId: string
  deckId: string
  size: number
  syncStatus: string
  firebaseUrl?: string
}

interface SyncProgress {
  total: number
  processed: number
  uploaded: number
  failed: number
  current: string
}

interface DeleteResult {
  deckId: string
  deletedCount: number
  queueCount: number
}

export default function ForceMediaSyncPage() {
  const { user } = useAuth()
  const { isPremium } = useSubscription()
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [progress, setProgress] = useState<SyncProgress | null>(null)
  const [complete, setComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteResult, setDeleteResult] = useState<DeleteResult | null>(null)
  const [checkingIndexedDB, setCheckingIndexedDB] = useState(false)
  const [indexedDBCheckResult, setIndexedDBCheckResult] = useState<{
    totalInStorage: number
    existInIndexedDB: number
    missingFromIndexedDB: number
    missingFiles: string[]
  } | null>(null)

  // Step 1: Check IndexedDB for pending media
  const checkIndexedDB = async () => {
    setError(null)
    try {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('ankiMediaDB', 2)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      const tx = db.transaction(['media'], 'readonly')
      const store = tx.objectStore('media')
      const allMedia = await new Promise<MediaFile[]>((resolve, reject) => {
        const request = store.getAll()
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      db.close()

      // Filter for pending uploads only
      const pending = allMedia.filter(file =>
        file.syncStatus === 'pending' || !file.firebaseUrl
      )

      setMediaFiles(pending)

      if (pending.length === 0) {
        setError('No pending media files found. All files are already synced!')
      }

    } catch (err) {
      setError(`Failed to read IndexedDB: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  // Step 2: Force upload all pending files
  const forceUploadAll = async () => {
    if (!user?.uid) {
      setError('You must be signed in to upload media')
      return
    }

    if (mediaFiles.length === 0) {
      setError('No files to upload. Click "Check IndexedDB" first.')
      return
    }

    setError(null)
    setProgress({
      total: mediaFiles.length,
      processed: 0,
      uploaded: 0,
      failed: 0,
      current: ''
    })

    const mediaStore = AnkiMediaStore.getInstance()
    const mediaManager = AnkiMediaManager.getInstance()

    let uploaded = 0
    let failed = 0

    for (let i = 0; i < mediaFiles.length; i++) {
      const file = mediaFiles[i]

      setProgress(prev => ({
        ...prev!,
        processed: i + 1,
        current: file.id
      }))

      try {
        // Get blob from IndexedDB
        const blobUrl = await mediaStore.getMediaUrl(file.id)

        if (!blobUrl) {
          throw new Error(`Media file not found in IndexedDB: ${file.id}`)
        }

        const response = await fetch(blobUrl)
        const blob = await response.blob()

        // Upload to Firebase Storage
        await mediaManager.enqueueUpload(
          file.userId,
          file.deckId,
          file.id,
          blob
        )

        // Force immediate sync instead of waiting for background worker
        await mediaManager.forceSyncAll()

        uploaded++

        setProgress(prev => ({
          ...prev!,
          uploaded
        }))

      } catch (err) {
        console.error(`Failed to upload ${file.id}:`, err)
        failed++

        setProgress(prev => ({
          ...prev!,
          failed
        }))
      }

      // Small delay to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    setProgress(prev => ({
      ...prev!,
      current: 'Complete!'
    }))

    setComplete(true)
  }

  // Step 3: Delete orphaned media files
  const deleteOrphanedMedia = async () => {
    if (mediaFiles.length === 0) {
      setError('No files to delete. Click "Check IndexedDB" first.')
      return
    }

    // Get unique deck IDs from media files
    const deckIds = Array.from(new Set(mediaFiles.map(f => f.deckId)))

    if (deckIds.length === 0) {
      setError('No deck IDs found in media files')
      return
    }

    // Confirm deletion
    const totalFiles = mediaFiles.length
    const totalSizeMB = (mediaFiles.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024).toFixed(2)
    const confirmed = window.confirm(
      `⚠️ Are you sure you want to DELETE all ${totalFiles} orphaned media files (${totalSizeMB} MB)?\n\n` +
      `This will remove them from IndexedDB permanently.\n\n` +
      `Decks affected: ${deckIds.join(', ')}`
    )

    if (!confirmed) {
      return
    }

    setError(null)
    setDeleteResult(null)

    const mediaStore = AnkiMediaStore.getInstance()
    const results: DeleteResult[] = []

    try {
      for (const deckId of deckIds) {
        const deletedCount = await mediaStore.deleteMediaByDeck(deckId)
        results.push({
          deckId,
          deletedCount,
          queueCount: 0 // The method logs queue count but doesn't return it
        })
      }

      // Show results
      const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0)
      setDeleteResult({
        deckId: deckIds.join(', '),
        deletedCount: totalDeleted,
        queueCount: 0
      })

      // Clear media files list
      setMediaFiles([])

      console.log('✅ Deleted orphaned media files:', results)
    } catch (err) {
      setError(`Failed to delete media: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  // Check if Firebase Storage files exist in IndexedDB
  const checkFirebaseFilesInIndexedDB = async () => {
    if (!user?.uid) {
      setError('You must be signed in to check files')
      return
    }

    setCheckingIndexedDB(true)
    setIndexedDBCheckResult(null)
    setError(null)

    try {
      // Get all files from Firebase Storage
      const response = await fetch('/api/anki/media/list', {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to fetch files from Firebase Storage')
      }

      const { files } = await response.json()

      if (!files || files.length === 0) {
        setError('No files found in Firebase Storage')
        setCheckingIndexedDB(false)
        return
      }

      // Open IndexedDB
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('ankiMediaDB', 2)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      const tx = db.transaction(['media'], 'readonly')
      const store = tx.objectStore('media')

      // Check which files exist in IndexedDB
      const missingFiles: string[] = []
      let existCount = 0

      for (const file of files) {
        const filename = file.name.split('/').pop() // Get filename from path

        const exists = await new Promise<boolean>((resolve) => {
          const request = store.get(filename)
          request.onsuccess = () => resolve(!!request.result)
          request.onerror = () => resolve(false)
        })

        if (exists) {
          existCount++
        } else {
          missingFiles.push(filename)
        }
      }

      db.close()

      setIndexedDBCheckResult({
        totalInStorage: files.length,
        existInIndexedDB: existCount,
        missingFromIndexedDB: missingFiles.length,
        missingFiles: missingFiles.slice(0, 20) // Show first 20
      })

    } catch (err) {
      setError(`Failed to check files: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setCheckingIndexedDB(false)
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const totalSize = mediaFiles.reduce((sum, f) => sum + f.size, 0)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">
            📤 Force Media Sync
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            One-time utility to upload existing IndexedDB media to Firebase Storage
          </p>

          {/* User Info */}
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>Signed in as:</strong> {user?.email || 'Not signed in'}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>Premium:</strong> {isPremium ? 'Yes ✅' : 'No ❌'}
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4 mb-6">
            <button
              onClick={checkIndexedDB}
              disabled={!!progress || !!deleteResult}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
            >
              1. Check IndexedDB
            </button>

            <button
              onClick={forceUploadAll}
              disabled={mediaFiles.length === 0 || !!progress || complete || !!deleteResult}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
            >
              2. Upload All to Firebase
            </button>

            <button
              onClick={deleteOrphanedMedia}
              disabled={mediaFiles.length === 0 || !!progress || complete || !!deleteResult}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
            >
              🗑️ Delete Orphaned Files
            </button>

            <button
              onClick={checkFirebaseFilesInIndexedDB}
              disabled={checkingIndexedDB || !!progress}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
            >
              {checkingIndexedDB ? '🔍 Checking...' : '🔍 Check IndexedDB Coverage'}
            </button>
          </div>

          {/* Media Files Summary */}
          {mediaFiles.length > 0 && !progress && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
                Found {mediaFiles.length} pending files
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Total size: {formatBytes(totalSize)}
              </p>

              <div className="max-h-64 overflow-y-auto space-y-2">
                {mediaFiles.slice(0, 20).map(file => (
                  <div key={file.id} className="text-sm font-mono text-gray-700 dark:text-gray-300">
                    • {file.id} ({formatBytes(file.size)})
                  </div>
                ))}
                {mediaFiles.length > 20 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    ... and {mediaFiles.length - 20} more files
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Progress Display */}
          {progress && (
            <div className="mb-6">
              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                  <span>Progress: {progress.processed} / {progress.total}</span>
                  <span>{Math.round((progress.processed / progress.total) * 100)}%</span>
                </div>
                <div className="w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-300"
                    style={{ width: `${(progress.processed / progress.total) * 100}%` }}
                  />
                </div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg font-mono text-sm">
                <p className="text-gray-700 dark:text-gray-300">
                  <strong>Current:</strong> {progress.current}
                </p>
                <p className="text-green-600 dark:text-green-400">
                  <strong>Uploaded:</strong> {progress.uploaded}
                </p>
                {progress.failed > 0 && (
                  <p className="text-red-600 dark:text-red-400">
                    <strong>Failed:</strong> {progress.failed}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Completion Message */}
          {complete && (
            <div className="mb-6 p-6 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <h3 className="text-xl font-bold text-green-700 dark:text-green-400 mb-2">
                🎉 Upload Complete!
              </h3>
              <p className="text-green-600 dark:text-green-300 mb-4">
                Successfully uploaded {progress?.uploaded} / {progress?.total} files
              </p>
              {progress && progress.failed > 0 && (
                <p className="text-orange-600 dark:text-orange-400">
                  {progress.failed} files failed - check console for details
                </p>
              )}
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
                ✅ Refresh your flashcards page to see updated quota badge
              </p>
            </div>
          )}

          {/* Deletion Result Message */}
          {deleteResult && (
            <div className="mb-6 p-6 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <h3 className="text-xl font-bold text-orange-700 dark:text-orange-400 mb-2">
                🗑️ Orphaned Files Deleted
              </h3>
              <p className="text-orange-600 dark:text-orange-300 mb-2">
                Successfully deleted {deleteResult.deletedCount} media files from IndexedDB
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Deck(s): {deleteResult.deckId}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
                ✅ IndexedDB has been cleaned up. You can now re-import your deck with the new sync system.
              </p>
            </div>
          )}

          {/* IndexedDB Check Result */}
          {indexedDBCheckResult && (
            <div className="mb-6 p-6 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <h3 className="text-xl font-bold text-purple-700 dark:text-purple-400 mb-4">
                📊 IndexedDB Coverage Check
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total in Storage</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {indexedDBCheckResult.totalInStorage}
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Exist in IndexedDB</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {indexedDBCheckResult.existInIndexedDB}
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Missing from IndexedDB</p>
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {indexedDBCheckResult.missingFromIndexedDB}
                  </p>
                </div>
              </div>

              {indexedDBCheckResult.missingFromIndexedDB > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold text-purple-700 dark:text-purple-400 mb-2">
                    Missing Files (first 20):
                  </h4>
                  <div className="max-h-48 overflow-y-auto space-y-1 bg-white dark:bg-gray-800 p-3 rounded">
                    {indexedDBCheckResult.missingFiles.map((filename, idx) => (
                      <div key={idx} className="text-sm font-mono text-orange-600 dark:text-orange-400">
                        • {filename}
                      </div>
                    ))}
                    {indexedDBCheckResult.missingFromIndexedDB > 20 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                        ... and {indexedDBCheckResult.missingFromIndexedDB - 20} more files
                      </p>
                    )}
                  </div>
                </div>
              )}

              {indexedDBCheckResult.missingFromIndexedDB === 0 && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-green-700 dark:text-green-400 font-semibold">
                    ✅ All Firebase Storage files exist in IndexedDB!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <h3 className="text-sm font-semibold mb-2 text-gray-900 dark:text-white">
              📋 Instructions:
            </h3>
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-3">
              <div>
                <p className="font-semibold mb-1">Option 1: Upload orphaned files to Firebase (Premium users)</p>
                <ol className="space-y-1 list-decimal list-inside ml-2">
                  <li>Click "Check IndexedDB" to scan for pending media files</li>
                  <li>Review the list of files to be uploaded</li>
                  <li>Click "Upload All to Firebase" to start the sync process</li>
                  <li>Wait for completion (may take a few minutes for large decks)</li>
                  <li>Refresh your flashcards page to verify quota badge shows correct usage</li>
                </ol>
              </div>

              <div>
                <p className="font-semibold mb-1">Option 2: Delete orphaned files and re-import deck</p>
                <ol className="space-y-1 list-decimal list-inside ml-2">
                  <li>Click "Check IndexedDB" to scan for orphaned media files</li>
                  <li>Review the list of files</li>
                  <li>Click "🗑️ Delete Orphaned Files" to clean up IndexedDB</li>
                  <li>Go to flashcards page and delete the deck</li>
                  <li>Re-import your .apkg file (new code will auto-upload media)</li>
                </ol>
              </div>

              <div>
                <p className="font-semibold mb-1">Verify Data Integrity:</p>
                <ol className="space-y-1 list-decimal list-inside ml-2">
                  <li>Click "🔍 Check IndexedDB Coverage" to verify all Firebase files exist locally</li>
                  <li>Review the coverage report showing files in Storage vs IndexedDB</li>
                  <li>If files are missing from IndexedDB, you may need to re-import the deck</li>
                </ol>
              </div>

              <p className="text-xs italic mt-3">
                💡 Option 2 is recommended as it ensures fresh import with the new upload system.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
