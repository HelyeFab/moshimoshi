import { AnkiParser, ProcessedCard, AnkiDeckInfo } from './parser'
import { AnkiMediaStore, buildAnkiMediaKey } from './mediaStore'
import { ReviewableContent } from '@/lib/review-engine/core/interfaces'
import { v4 as uuidv4 } from 'uuid'
import type { DeckOrigin } from '@/types/flashcards'

export interface AnkiCard extends ReviewableContent {
  id: string
  front: string
  back: string
  tags: string[]
  deckName: string
  fields?: string[]
  media?: string[]
  // Rich content fields
  reading?: string          // Furigana/hiragana reading
  audioUrl?: string         // Blob URL for audio
  imageUrl?: string         // Blob URL for image
  audioFilename?: string    // Original audio filename
  imageFilename?: string    // Original image filename
  // Additional metadata
  expression?: string       // Original Japanese expression
  meaning?: string          // English meaning
  sentence?: string         // Example sentence if available
  sentenceReading?: string  // Sentence reading
  sentenceMeaning?: string  // Sentence translation
  // Furigana support
  furiganaFront?: string    // Pre-generated or native furigana HTML for front
  furiganaBack?: string     // Pre-generated or native furigana HTML for back
  hasNativeFurigana?: boolean // True if card had furigana in Anki
  // SRS data
  interval?: number
  ease?: number
  reviews?: number
  lapses?: number
}

export interface AnkiDeckSettings {
  newCardsPerDay: number
  reviewsPerDay: number
  autoPlayAudio: boolean
  strictTemplateMode: boolean
}

export const DEFAULT_ANKI_DECK_SETTINGS: AnkiDeckSettings = {
  newCardsPerDay: 20,
  reviewsPerDay: 20,
  autoPlayAudio: true,
  strictTemplateMode: false,
}

export interface AnkiDeck {
  id: string
  name: string
  cards: AnkiCard[]
  description?: string
  origin?: DeckOrigin
  mediaBlobs?: Map<string, Blob>  // Raw blob objects (not URLs) for storage by import modal
  settings?: AnkiDeckSettings
}

export interface ImportOptions {
  onProgress?: (progress: number, message: string) => void
  maxFileSize?: number
  strictTemplateMode?: boolean
}

export interface ImportResult {
  success: boolean
  deck?: AnkiDeck
  cardsImported?: number
  error?: string
  packageFile?: File  // Original .apkg file for R2 backup upload
  media?: Map<string, Blob>  // Media files for R2 backup upload
  r2BackupEnabled?: boolean
}

export class AnkiImporter {
  private static DEFAULT_MAX_FILE_SIZE = 200 * 1024 * 1024 // 200MB

  /**
   * Parse an Anki package file (.apkg) into a deck structure
   */
  static async parsePackage(
    file: File,
    options?: ImportOptions
  ): Promise<{ decks: AnkiDeck[]; media: Map<string, Blob> }> {
    const maxSize = options?.maxFileSize || this.DEFAULT_MAX_FILE_SIZE

    if (file.size > maxSize) {
      throw new Error(
        `File size exceeds ${maxSize / 1024 / 1024}MB limit. File size: ${(file.size / 1024 / 1024).toFixed(2)}MB`
      )
    }

    try {
      const parseResult = await AnkiParser.parseApkg(file, {
        strictTemplateMode: options?.strictTemplateMode
      })
      const mediaStore = AnkiMediaStore.getInstance()

      console.log('[AnkiImporter] Parse result:', {
        deckCount: parseResult.decks.length,
        mediaCount: parseResult.media.size,
        sampleCard: parseResult.decks[0]?.cards[0] ? {
          id: parseResult.decks[0].cards[0].id,
          audioFilename: parseResult.decks[0].cards[0].audioFilename,
          imageFilename: parseResult.decks[0].cards[0].imageFilename,
          reading: parseResult.decks[0].cards[0].reading,
          hasNativeFurigana: parseResult.decks[0].cards[0].hasNativeFurigana,
        } : null,
      })

      // Generate furigana for cards without native furigana
      // STRICT RULE: Never generate furigana for Anki decks
      // Anki decks should preserve their original formatting and content
      console.log('[AnkiImporter] Skipping furigana generation - preserving original Anki content')

      // Return raw media blobs (NOT stored yet - import modal will handle storage with proper metadata)
      const mediaBlobs = parseResult.media
      if (mediaBlobs.size > 0) {
        if (options?.onProgress) {
          options.onProgress(30, `Extracted ${mediaBlobs.size} media files...`)
        }
        console.log('[AnkiImporter] Media extracted:', { totalMedia: mediaBlobs.size })
      }

      // Convert to our deck format
      // Cards will reference media by filename only - useMediaHydration will create blob URLs from IndexedDB
      const decks: AnkiDeck[] = parseResult.decks.map(deckInfo => ({
        id: deckInfo.id,
        name: deckInfo.name,
        description: deckInfo.desc || `Imported from Anki on ${new Date().toLocaleDateString()}`,
        cards: deckInfo.cards.map(card =>
          this.convertCardToReviewable(card, deckInfo.name, deckInfo.id)
        ),
        mediaBlobs,
      }))

      // Log sample converted card
      if (decks[0]?.cards[0]) {
        const sampleCard = decks[0].cards[0]
        console.log('[AnkiImporter] Sample converted card:', {
          id: sampleCard.id,
          front: sampleCard.front?.substring(0, 50),
          reading: sampleCard.reading,
          audioUrl: sampleCard.audioUrl ? 'present' : 'missing',
          imageUrl: sampleCard.imageUrl ? 'present' : 'missing',
          audioFilename: sampleCard.audioFilename,
          imageFilename: sampleCard.imageFilename,
        })
      }

      return { decks, media: parseResult.media }
    } catch (error) {
      console.error('Error parsing Anki package:', error)
      throw error instanceof Error ? error : new Error('Failed to parse Anki package')
    }
  }

  /**
   * Convert a processed card to ReviewableContent format
   *
   * STRICT RULES FOR ANKI IMPORTS:
   * 1. Audio: Use Anki deck audio ONLY. Never generate TTS for Anki cards.
   * 2. Furigana: Never generate furigana. Preserve original Anki content.
   * 3. Images: Always import and replace img src with blob URLs.
   */
  private static convertCardToReviewable(
    card: ProcessedCard,
    deckName: string,
    deckId: string
  ): AnkiCard {
    // Don't create blob URLs here - useMediaHydration will handle that at render time
    // This prevents premature garbage collection of blob URLs
    const audioUrl = undefined  // Will be hydrated from IndexedDB using audioFilename
    const imageUrl = undefined  // Will be hydrated from IndexedDB using imageFilename

    // STRICT RULE #1: Audio Priority
    // Use Anki deck audio if available. TTS should ONLY be used for non-Anki content.
    // Audio will be hydrated from IndexedDB at render time using audioFilename.

    // Build display content with embedded media
    let processedFront = card.front
    let processedBack = card.back

    // Remove [audio] and [image] placeholders - media will be hydrated by useMediaHydration hook
    processedFront = processedFront.replace(/\[audio\]/g, '')
    processedBack = processedBack.replace(/\[audio\]/g, '')
    processedFront = processedFront.replace(/\[image\]/g, '')
    processedBack = processedBack.replace(/\[image\]/g, '')

    // DON'T replace image filenames with blob URLs in stored HTML
    // Blob URLs are ephemeral and become invalid after page reload
    // Instead, we'll hydrate them dynamically when rendering cards
    // Just ensure images have a data-anki-media attribute for hydration
    const markMediaImages = (html: string, side: string): string => {
      let imageCount = 0
      const result = html.replace(/<img([^>]+)src="([^"]+)"([^>]*)>/gi, (match, before, filename, after) => {
        imageCount++

        // Skip URLs that are already absolute (http/https/blob)
        if (filename.startsWith('http') || filename.startsWith('blob:')) {
          console.log(`[AnkiImporter] ${side} - Skipping absolute URL #${imageCount}: ${filename.substring(0, 50)}`)
          return match
        }

        // Add data-anki-media attribute to mark this as Anki media
        // Remove any existing data-anki-media to avoid duplicates
        const cleanBefore = before.replace(/\s*data-anki-media="[^"]*"/g, '')
        const cleanAfter = after.replace(/\s*data-anki-media="[^"]*"/g, '')

        const mediaKey = buildAnkiMediaKey(deckId, filename)

        console.log(`[AnkiImporter] ${side} - Marking image #${imageCount} for hydration: "${filename}"`)

        return `<img${cleanBefore}src="${filename}" data-anki-media="${mediaKey}"${cleanAfter}>`
      })

      if (imageCount > 0) {
        console.log(`[AnkiImporter] ${side} - Total images marked: ${imageCount}`)
      }
      return result
    }

    processedFront = markMediaImages(processedFront, 'FRONT')
    processedBack = markMediaImages(processedBack, 'BACK')

    // Debug first card conversion
    if (card.id.endsWith('1') || card.id === '1') {
      console.log('[AnkiImporter.convertCardToReviewable] First card:', {
        cardFrontLength: card.front.length,
        cardBackLength: card.back.length,
        processedFrontLength: processedFront.length,
        processedBackLength: processedBack.length,
        frontPreview: processedFront.substring(0, 100),
        backPreview: processedBack.substring(0, 200),
        frontEqualsBack: processedFront === processedBack,
      });
    }

    const audioKey = card.audioFilename ? buildAnkiMediaKey(deckId, card.audioFilename) : undefined
    const imageKey = card.imageFilename ? buildAnkiMediaKey(deckId, card.imageFilename) : undefined
    const mediaKeys = card.media?.map(filename => buildAnkiMediaKey(deckId, filename))

    // Return AnkiCard with all rich content preserved
    return {
      id: card.id,
      contentType: 'custom', // Anki cards use custom content type
      primaryDisplay: processedFront,
      primaryAnswer: processedBack,
      difficulty: 0.5,
      supportedModes: ['recognition', 'recall'],
      front: processedFront,
      back: processedBack,
      tags: card.tags,
      deckName,
      fields: card.fields,
      media: mediaKeys,
      // Rich content fields
      reading: card.reading,
      audioUrl,
      imageUrl,
      audioFilename: audioKey,
      imageFilename: imageKey,
      expression: card.expression,
      meaning: card.meaning,
      sentence: card.sentence,
      sentenceReading: card.sentenceReading,
      sentenceMeaning: card.sentenceMeaning,
      // Furigana support
      furiganaFront: card.furiganaFront,
      furiganaBack: card.furiganaBack,
      hasNativeFurigana: card.hasNativeFurigana,
      metadata: {
        source: 'anki',
        noteId: card.noteId,
        deckId: card.deckId,
        noteType: card.noteType,
        importedAt: new Date().toISOString(),
        // STRICT FLAGS: Prevent system from modifying Anki content
        noTTSGeneration: true,  // Never generate TTS for Anki cards
        noFuriganaGeneration: true,  // Never generate furigana for Anki cards
        preserveOriginalContent: true,  // Keep original formatting
      },
    } as AnkiCard
  }

  /**
   * Import an Anki deck from a file
   */
  static async importDeck(file: File, options?: ImportOptions): Promise<ImportResult> {
    try {
      if (options?.onProgress) {
        options.onProgress(10, 'Parsing Anki package...')
      }

      const { decks } = await this.parsePackage(file, options)

      if (decks.length === 0) {
        return { success: false, error: 'No decks found in the package' }
      }

      // For now, import the first deck (most Anki packages have one main deck)
      const deck = decks[0]

      if (deck.cards.length === 0) {
        return { success: false, error: 'Selected deck has no cards' }
      }

      if (options?.onProgress) {
        options.onProgress(100, `Import complete! ${deck.cards.length} cards imported.`)
      }

      return {
        success: true,
        deck,
        cardsImported: deck.cards.length,
      }
    } catch (error) {
      console.error('Import failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  /**
   * Validate an .apkg file
   */
  static validateFile(file: File): { valid: boolean; error?: string } {
    if (!file.name.endsWith('.apkg')) {
      return { valid: false, error: 'File must be an .apkg file' }
    }

    if (file.size > this.DEFAULT_MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File size exceeds ${this.DEFAULT_MAX_FILE_SIZE / 1024 / 1024}MB limit`,
      }
    }

    return { valid: true }
  }

  /**
   * Get media storage statistics
   */
  static async getMediaStats() {
    const mediaStore = AnkiMediaStore.getInstance()
    return await mediaStore.getStats()
  }

  /**
   * Clear all stored media
   */
  static async clearAllMedia() {
    const mediaStore = AnkiMediaStore.getInstance()
    await mediaStore.deleteAllMedia()
  }
}
