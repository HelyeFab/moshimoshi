import EventEmitter from 'events'
import PQueue from 'p-queue'
import type { BackupInfo, R2Manifest, RestoreProgress } from '@/types/r2'
import { hashBlob } from './hashUtils'
import { AnkiParser } from '@/lib/anki/parser'
import { AnkiMediaStore, buildAnkiMediaKey } from '@/lib/anki/mediaStore'
import { flashcardManager } from '@/lib/flashcards/FlashcardManager'
import { AnkiImporter, AnkiDeck, AnkiCard } from '@/lib/anki/importer'

/**
 * Parse an Anki package blob and convert to AnkiDeck with properly typed cards
 * Used during restore flow to hydrate IndexedDB
 */
async function parseAnkiPackage(packageBlob: Blob): Promise<{
  deck: AnkiDeck
  media: Map<string, Blob>
}> {
  // Convert Blob to File (AnkiImporter expects a File)
  const file = new File([packageBlob], 'package.apkg', { type: 'application/zip' })

  // Use AnkiImporter.parsePackage which returns properly typed AnkiCard[]
  const parseResult = await AnkiImporter.parsePackage(file)

  if (!parseResult.decks || parseResult.decks.length === 0) {
    throw new Error('No decks found in package')
  }

  // For restore, we only expect one deck per backup
  const deck = parseResult.decks[0]

  return {
    deck,
    media: parseResult.media,
  }
}

export class RestoreOrchestrator extends EventEmitter {
  private userId: string
  private downloadQueue: PQueue

  constructor(userId: string) {
    super()
    this.userId = userId
    this.downloadQueue = new PQueue({ concurrency: 5 }) // 5 concurrent downloads
  }

  /**
   * Restore a deck from R2 backup
   * @param backup - Backup info from list endpoint
   * @returns Restored deck ID
   */
  async restoreDeck(backup: BackupInfo): Promise<string> {
    this.emit('progress', {
      phase: 'fetching-metadata',
      progress: 0,
      filesDownloaded: 0,
      totalFiles: 0,
    } as RestoreProgress)

    try {
      // Step 1: Download manifest
      const manifest = await this.downloadManifest(backup.r2Keys.manifestKey)
      this.emit('progress', {
        phase: 'downloading-manifest',
        progress: 10,
        filesDownloaded: 0,
        totalFiles: 0,
      } as RestoreProgress)

      const existingDeck = await flashcardManager.getDeck(backup.deckId, this.userId)
      const needsDeckHydration = !existingDeck || existingDeck.cards?.length === 0

      let packageBlob: Blob | null = null
      if (needsDeckHydration) {
        // Step 2: Download package file
        packageBlob = await this.downloadFile(backup.r2Keys.packageKey!)
        this.emit('progress', {
          phase: 'downloading-media',
          progress: 20,
          filesDownloaded: 0,
          totalFiles: 0,
        } as RestoreProgress)
      } else {
        this.emit('progress', {
          phase: 'downloading-media',
          progress: 20,
          filesDownloaded: 0,
          totalFiles: 0,
        } as RestoreProgress)
      }

      // Step 3: Download media files
      const mediaFiles = await this.downloadMediaBatch(manifest, backup.deckId)
      this.emit('progress', {
        phase: 'hydrating-deck',
        progress: 80,
        filesDownloaded: mediaFiles.size,
        totalFiles: mediaFiles.size,
      } as RestoreProgress)

      if (needsDeckHydration) {
        // Step 4: Write to IndexedDB
        await this.hydrateIndexedDB(packageBlob!, mediaFiles, backup)
      } else if (mediaFiles.size > 0) {
        await this.storeMediaFiles(mediaFiles, backup)
      }
      this.emit('progress', {
        phase: 'complete',
        progress: 100,
        filesDownloaded: mediaFiles.size,
        totalFiles: mediaFiles.size,
      } as RestoreProgress)

      return backup.deckId
    } catch (error: any) {
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

  private async downloadManifest(key: string): Promise<R2Manifest> {
    const url = await this.getSignedDownloadUrl(key)
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error('Failed to download manifest')
    }

    return await response.json()
  }

  private async downloadFile(key: string): Promise<Blob> {
    const url = await this.getSignedDownloadUrl(key)
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Failed to download ${key}`)
    }

    return await response.blob()
  }

  private async downloadMediaBatch(
    manifest: R2Manifest,
    deckId: string
  ): Promise<Map<string, Blob>> {
    const mediaFiles = new Map<string, Blob>()
    const mediaEntries = manifest.files.filter(f => f.type === 'media')
    const mediaStore = AnkiMediaStore.getInstance()
    const existingMedia = await mediaStore.getMediaByDeck(deckId)
    const existingIds = new Set(existingMedia.map(media => media.id))

    let downloaded = 0
    const total = mediaEntries.length

    await this.downloadQueue.addAll(
      mediaEntries.map(entry => async () => {
        const cached = existingIds.has(entry.name) || existingIds.has(buildAnkiMediaKey(deckId, entry.name))

        if (cached) {
          downloaded++
          const progress = total === 0 ? 80 : 20 + (60 * downloaded / total)
          this.emit('progress', {
            phase: 'downloading-media',
            progress,
            currentFile: entry.name,
            filesDownloaded: downloaded,
            totalFiles: total,
          } as RestoreProgress)
          return
        }

        const key = `users/${this.userId}/decks/${deckId}/media/${entry.name}`

        try {
          const blob = await this.downloadFile(key)

          // Verify hash
          const hash = await hashBlob(blob)
          if (hash !== entry.sha256) {
            console.warn(`[RestoreOrchestrator] Hash mismatch for ${entry.name}`)
            // Continue anyway - partial media is OK per Decision 11
          }

          mediaFiles.set(entry.name, blob)
        } catch (error) {
          console.error(`[RestoreOrchestrator] Failed to download ${entry.name}:`, error)
          // Continue - missing media is OK per Decision 11
        }

        downloaded++
        const progress = total === 0 ? 80 : 20 + (60 * downloaded / total)
        this.emit('progress', {
          phase: 'downloading-media',
          progress,
          currentFile: entry.name,
          filesDownloaded: downloaded,
          totalFiles: total,
        } as RestoreProgress)
      })
    )

    return mediaFiles
  }

  private async hydrateIndexedDB(
    packageBlob: Blob,
    mediaFiles: Map<string, Blob>,
    backup: BackupInfo
  ): Promise<void> {
    // Step 1: Parse package file
    const { deck, media } = await parseAnkiPackage(packageBlob)

    // Step 2: Store deck in FlashcardDB
    // Access private initDB method using bracket notation
    const db = await (flashcardManager as any).initDB()

    const flashcardDeck = {
      id: backup.deckId,
      userId: this.userId,
      name: backup.name,
      description: deck.description || '',
      emoji: '📥',
      color: 'primary',
      cardStyle: 'minimal',
      source: 'anki',
      cards: deck.cards,
      settings: {
        studyDirection: 'front-to-back',
        autoPlay: false,
        showHints: true,
        animationSpeed: 'normal',
        soundEffects: true,
        hapticFeedback: true,
        sessionLength: 20,
        reviewMode: 'srs',
        newCardsPerDay: 20,
        reviewsPerDay: 100,
      },
      stats: {
        totalCards: deck.cards.length,
        newCards: deck.cards.length,
        learningCards: 0,
        reviewCards: 0,
        masteredCards: 0,
        totalStudied: 0,
        lastStudied: undefined,
        averageAccuracy: 0,
        currentStreak: 0,
        longestStreak: 0,
        totalTimeSpent: 0,
        heatmapData: {},
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    await db.put('decks', flashcardDeck)

    // Step 3: Store media in ankiMediaDB
    const mediaStore = AnkiMediaStore.getInstance()
    for (const [filename, blob] of mediaFiles.entries()) {
      await mediaStore.storeMedia(filename, blob, {
        userId: this.userId,
        deckId: backup.deckId,
        syncStatus: 'synced', // Already backed up in R2
      })
    }

    console.log(`[RestoreOrchestrator] Restored deck ${backup.deckId}:`, {
      cardCount: deck.cards.length,
      mediaCount: mediaFiles.size,
    })
  }

  private async storeMediaFiles(
    mediaFiles: Map<string, Blob>,
    backup: BackupInfo
  ): Promise<void> {
    const mediaStore = AnkiMediaStore.getInstance()
    for (const [filename, blob] of mediaFiles.entries()) {
      await mediaStore.storeMedia(filename, blob, {
        userId: this.userId,
        deckId: backup.deckId,
        syncStatus: 'synced',
      })
    }
  }

  private async getSignedDownloadUrl(key: string): Promise<string> {
    // Extract deckId from key pattern
    const match = key.match(/decks\/([^/]+)/)
    if (!match) throw new Error('Invalid key format')
    const deckId = match[1]

    const response = await fetch('/api/anki/r2/download-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deckId, key }),
    })

    if (!response.ok) {
      throw new Error('Failed to get download URL')
    }

    const data = await response.json()
    return data.url
  }
}
