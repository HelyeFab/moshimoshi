import EventEmitter from 'events'
import PQueue from 'p-queue'
import { AnkiMediaStore } from '@/lib/anki/mediaStore'
import { flashcardManager } from '@/lib/flashcards/FlashcardManager'
import type { FlashcardDeck } from '@/types/flashcards'

/**
 * User Deck Manifest structure (from R2)
 */
interface UserDeckManifest {
  deckId: string
  userId: string
  createdAt: string
  files: Array<{
    type: 'cards' | 'media' | 'manifest'
    filename: string
    size: number
    hash: string
  }>
}

/**
 * Restore progress tracking
 */
interface RestoreProgress {
  phase: 'fetching-metadata' | 'downloading-cards' | 'downloading-media' | 'hydrating-deck' | 'complete' | 'error'
  progress: number  // 0-100
  filesDownloaded: number
  totalFiles: number
  currentFile?: string
  error?: string
}

/**
 * User deck metadata from Firestore
 */
export interface UserDeckMetadata {
  deckId: string
  userId: string
  name: string
  cardCount: number
  hasMedia: boolean
  totalBytes: number
  r2: {
    cardsKey: string
    manifestKey: string
    mediaPrefix: string
  }
  source: 'user'
  createdAt: { _seconds: number; _nanoseconds: number }
  updatedAt: { _seconds: number; _nanoseconds: number }
}

export class UserDeckRestoreOrchestrator extends EventEmitter {
  readonly userId: string
  private downloadQueue: PQueue
  private abortSignal?: AbortSignal

  constructor(userId: string, abortSignal?: AbortSignal) {
    super()
    this.userId = userId
    this.downloadQueue = new PQueue({ concurrency: 5 }) // 5 concurrent downloads
    this.abortSignal = abortSignal
  }

  /**
   * Restore a user deck from R2
   * @param metadata - Deck metadata from Firestore (via list API)
   * @returns Restored deck ID
   */
  async restoreDeck(metadata: UserDeckMetadata): Promise<string> {
    if (this.abortSignal?.aborted) {
      throw new Error('Restore cancelled')
    }

    this.emit('progress', {
      phase: 'fetching-metadata',
      progress: 0,
      filesDownloaded: 0,
      totalFiles: 0,
    } as RestoreProgress)

    try {
      console.log('[UserDeckRestoreOrchestrator] Starting restore', {
        deckId: metadata.deckId,
        deckName: metadata.name,
      })

      // Check if deck already exists locally
      const existingDeck = await flashcardManager.getDeck(metadata.deckId, this.userId)

      // Step 1: Download manifest (10%)
      const manifest = await this.downloadManifest(metadata.r2.manifestKey)
      if (this.abortSignal?.aborted) {
        throw new Error('Restore cancelled')
      }

      this.emit('progress', {
        phase: 'downloading-cards',
        progress: 10,
        filesDownloaded: 0,
        totalFiles: manifest.files.length,
      } as RestoreProgress)

      // Step 2: Download cards.json to compare versions (10-30%)
      const cardsBlob = await this.downloadFile(metadata.r2.cardsKey)
      if (this.abortSignal?.aborted) {
        throw new Error('Restore cancelled')
      }

      const cardsJson = await cardsBlob.text()
      const remoteDeck = JSON.parse(cardsJson) as FlashcardDeck

      console.log('[UserDeckRestoreOrchestrator] Downloaded cards.json', {
        deckId: remoteDeck.id,
        cardCount: remoteDeck.cards.length,
      })

      const localUpdatedAt = existingDeck?.updatedAt ?? 0
      const remoteUpdatedAt = remoteDeck.updatedAt ?? 0
      const needsDeckHydration =
        !existingDeck ||
        !existingDeck.cards?.length ||
        remoteUpdatedAt > localUpdatedAt

      if (!needsDeckHydration) {
        console.log('[UserDeckRestoreOrchestrator] Local deck is newer - skipping cards.json hydration', {
          localUpdatedAt,
          remoteUpdatedAt,
        })
      }

      this.emit('progress', {
        phase: 'downloading-media',
        progress: 30,
        filesDownloaded: 0,
        totalFiles: manifest.files.filter(f => f.type === 'media').length,
      } as RestoreProgress)

      // Step 3: Download media files (30-80%)
      const mediaFiles = await this.downloadMediaBatch(manifest, metadata)
      if (this.abortSignal?.aborted) {
        throw new Error('Restore cancelled')
      }

      this.emit('progress', {
        phase: 'hydrating-deck',
        progress: 80,
        filesDownloaded: mediaFiles.size,
        totalFiles: mediaFiles.size,
      } as RestoreProgress)

      // Step 4: Hydrate IndexedDB (80-100%)
      if (needsDeckHydration) {
        await this.hydrateIndexedDB(remoteDeck, mediaFiles, metadata)
      } else if (mediaFiles.size > 0) {
        await this.storeMediaFiles(mediaFiles, metadata.deckId)
      }

      this.emit('progress', {
        phase: 'complete',
        progress: 100,
        filesDownloaded: mediaFiles.size,
        totalFiles: mediaFiles.size,
      } as RestoreProgress)

      console.log('[UserDeckRestoreOrchestrator] Restore complete!', {
        deckId: metadata.deckId,
        mediaFiles: mediaFiles.size,
      })

      return metadata.deckId
    } catch (error: any) {
      console.error('[UserDeckRestoreOrchestrator] Restore failed:', error)

      this.emit('progress', {
        phase: 'error',
        progress: 0,
        filesDownloaded: 0,
        totalFiles: 0,
        error: error.message || 'Restore failed',
      } as RestoreProgress)

      throw error
    }
  }

  /**
   * Download manifest.json
   */
  private async downloadManifest(key: string): Promise<UserDeckManifest> {
    const url = await this.getSignedDownloadUrl(key)
    const response = await fetch(url, { signal: this.abortSignal })

    if (!response.ok) {
      throw new Error('Failed to download manifest')
    }

    return await response.json()
  }

  /**
   * Download a single file from R2
   */
  private async downloadFile(key: string): Promise<Blob> {
    const url = await this.getSignedDownloadUrl(key)
    const response = await fetch(url, { signal: this.abortSignal })

    if (!response.ok) {
      throw new Error(`Failed to download ${key}`)
    }

    return await response.blob()
  }

  /**
   * Download media files in batch with progress tracking
   */
  private async downloadMediaBatch(
    manifest: UserDeckManifest,
    metadata: UserDeckMetadata
  ): Promise<Map<string, Blob>> {
    if (this.abortSignal?.aborted) {
      throw new Error('Restore cancelled')
    }

    const mediaFiles = new Map<string, Blob>()
    const mediaEntries = manifest.files.filter(f => f.type === 'media')
    const mediaStore = AnkiMediaStore.getInstance()

    // Check which media files already exist in IndexedDB
    const existingMedia = new Set<string>()
    for (const entry of mediaEntries) {
      const exists = await mediaStore.getMediaUrl(entry.filename)
      if (exists) {
        existingMedia.add(entry.filename)
      }
    }

    let downloaded = 0
    const total = mediaEntries.length

    console.log('[UserDeckRestoreOrchestrator] Downloading media', {
      total,
      alreadyCached: existingMedia.size,
      toDownload: total - existingMedia.size,
    })

    await this.downloadQueue.addAll(
      mediaEntries.map(entry => async () => {
        if (this.abortSignal?.aborted) {
          return
        }

        // Skip if already cached
        if (existingMedia.has(entry.filename)) {
          downloaded++
          const progress = total === 0 ? 80 : 30 + (50 * downloaded / total)
          this.emit('progress', {
            phase: 'downloading-media',
            progress,
            currentFile: entry.filename,
            filesDownloaded: downloaded,
            totalFiles: total,
          } as RestoreProgress)
          return
        }

        // Build R2 key
        const key = `${metadata.r2.mediaPrefix}${entry.filename}`

        try {
          const blob = await this.downloadFile(key)
          mediaFiles.set(entry.filename, blob)

          console.log('[UserDeckRestoreOrchestrator] Downloaded media', {
            filename: entry.filename,
            size: Math.round(blob.size / 1024) + ' KB',
          })
        } catch (error) {
          console.error(`[UserDeckRestoreOrchestrator] Failed to download ${entry.filename}:`, error)
          // Continue - missing media is OK (user can re-upload)
        }

        downloaded++
        const progress = total === 0 ? 80 : 30 + (50 * downloaded / total)
        this.emit('progress', {
          phase: 'downloading-media',
          progress,
          currentFile: entry.filename,
          filesDownloaded: downloaded,
          totalFiles: total,
        } as RestoreProgress)
      })
    )

    return mediaFiles
  }

  /**
   * Hydrate IndexedDB with deck + media
   */
  private async hydrateIndexedDB(
    deck: FlashcardDeck,
    mediaFiles: Map<string, Blob>,
    metadata: UserDeckMetadata
  ): Promise<void> {
    console.log('[UserDeckRestoreOrchestrator] Hydrating IndexedDB', {
      deckId: deck.id,
      cards: deck.cards.length,
      mediaFiles: mediaFiles.size,
    })

    // Store media files in AnkiMediaStore
    const mediaStore = AnkiMediaStore.getInstance()
    for (const [filename, blob] of mediaFiles.entries()) {
      await mediaStore.storeMedia(filename, blob)
    }

    // Create blob URLs for card media
    const hydratedCards = deck.cards.map(card => {
      const frontFilename = typeof card.front !== 'string' ? card.front.media?.filename : undefined
      const backFilename = typeof card.back !== 'string' ? card.back.media?.filename : undefined

      let frontUrl: string | undefined
      let backUrl: string | undefined

      if (frontFilename && mediaFiles.has(frontFilename)) {
        frontUrl = URL.createObjectURL(mediaFiles.get(frontFilename)!)
      }

      if (backFilename && mediaFiles.has(backFilename)) {
        backUrl = URL.createObjectURL(mediaFiles.get(backFilename)!)
      }

      return {
        ...card,
        front: typeof card.front === 'string' ? card.front : {
          ...card.front,
          media: frontUrl && card.front.media?.type ? {
            type: card.front.media.type,
            filename: card.front.media.filename,
            url: frontUrl,
            alt: card.front.media.alt,
          } : card.front.media
        },
        back: typeof card.back === 'string' ? card.back : {
          ...card.back,
          media: backUrl && card.back.media?.type ? {
            type: card.back.media.type,
            filename: card.back.media.filename,
            url: backUrl,
            alt: card.back.media.alt,
          } : card.back.media
        },
      }
    })

    // Ensure source is set to 'user'
    const hydratedDeck: FlashcardDeck = {
      ...deck,
      cards: hydratedCards,
      source: 'user',
      userId: this.userId,
      r2: {
        cardsKey: metadata.r2.cardsKey,
        manifestKey: metadata.r2.manifestKey,
        mediaPrefix: metadata.r2.mediaPrefix,
        uploadedAt: Date.now(),
      },
    }

    // Save to IndexedDB via FlashcardManager
    // Use createDeck if doesn't exist, otherwise update
    const existingDeck = await flashcardManager.getDeck(deck.id, this.userId)

    if (!existingDeck) {
      // Create new deck (will NOT trigger R2 upload since isPremium=false)
      await flashcardManager.createDeck({
        id: hydratedDeck.id,
        name: hydratedDeck.name,
        description: hydratedDeck.description,
        emoji: hydratedDeck.emoji,
        color: hydratedDeck.color,
        cardStyle: hydratedDeck.cardStyle,
        settings: hydratedDeck.settings,
        source: 'user',
        initialCards: hydratedDeck.cards,
      }, this.userId, false) // isPremium=false to prevent upload loop
    } else {
      // Update existing deck
      await flashcardManager.updateFullDeck(deck.id, {
        name: hydratedDeck.name,
        description: hydratedDeck.description,
        emoji: hydratedDeck.emoji,
        color: hydratedDeck.color,
        cardStyle: hydratedDeck.cardStyle,
        settings: hydratedDeck.settings,
        initialCards: hydratedDeck.cards,
      }, this.userId, false) // isPremium=false to prevent upload loop
    }

    console.log('[UserDeckRestoreOrchestrator] IndexedDB hydration complete')
  }

  /**
   * Store media files only (deck already exists)
   */
  private async storeMediaFiles(mediaFiles: Map<string, Blob>, deckId: string): Promise<void> {
    console.log('[UserDeckRestoreOrchestrator] Storing media files only', {
      deckId,
      count: mediaFiles.size,
    })

    const mediaStore = AnkiMediaStore.getInstance()
    for (const [filename, blob] of mediaFiles.entries()) {
      await mediaStore.storeMedia(filename, blob)
    }
  }

  /**
   * Get signed download URL from API
   */
  private async getSignedDownloadUrl(key: string): Promise<string> {
    // Extract deckId from key (format: users/{userId}/flashcards/{deckId}/...)
    const parts = key.split('/')
    const deckId = parts[3] // users/[userId]/flashcards/[deckId]

    const response = await fetch(`/api/flashcards/r2/${deckId}`, {
      method: 'GET',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to get download URL')
    }

    const data = await response.json() as {
      metadata: UserDeckMetadata
      downloadUrls: {
        cards: string
        manifest: string
        media: Array<{ filename: string; url: string; size: number }>
      }
    }

    // Determine which URL to return based on key
    if (key.includes('/cards.json')) {
      return data.downloadUrls.cards
    } else if (key.includes('/manifest.json')) {
      return data.downloadUrls.manifest
    } else {
      // Media file - find by filename
      const filename = key.split('/').pop()!
      const mediaUrl = data.downloadUrls.media.find(m => m.filename === filename)
      if (!mediaUrl) {
        throw new Error(`Media URL not found for ${filename}`)
      }
      return mediaUrl.url
    }
  }
}

// Singleton instance getter
let orchestratorInstance: UserDeckRestoreOrchestrator | null = null

export function getUserDeckRestoreOrchestrator(userId: string, abortSignal?: AbortSignal): UserDeckRestoreOrchestrator {
  if (!orchestratorInstance || orchestratorInstance.userId !== userId) {
    orchestratorInstance = new UserDeckRestoreOrchestrator(userId, abortSignal)
  }
  return orchestratorInstance
}
