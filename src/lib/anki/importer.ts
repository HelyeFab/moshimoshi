import { AnkiParser, ProcessedCard, AnkiDeckInfo } from './parser'
import { AnkiMediaStore } from './mediaStore'
import { ReviewableContent } from '@/lib/review-engine/core/interfaces'
import { v4 as uuidv4 } from 'uuid'

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
}

export const DEFAULT_ANKI_DECK_SETTINGS: AnkiDeckSettings = {
  newCardsPerDay: 20,
  reviewsPerDay: 100,
  autoPlayAudio: true,
}

export interface AnkiDeck {
  id: string
  name: string
  cards: AnkiCard[]
  description?: string
  mediaUrls?: Map<string, string>
  settings?: AnkiDeckSettings
}

export interface ImportOptions {
  onProgress?: (progress: number, message: string) => void
  maxFileSize?: number
}

export interface ImportResult {
  success: boolean
  deck?: AnkiDeck
  cardsImported?: number
  error?: string
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
      const parseResult = await AnkiParser.parseApkg(file)
      const mediaStore = AnkiMediaStore.getInstance()

      console.log('[AnkiImporter] Parse result:', {
        deckCount: parseResult.decks.length,
        mediaCount: parseResult.media.size,
        sampleCard: parseResult.decks[0]?.cards[0] ? {
          id: parseResult.decks[0].cards[0].id,
          audioFilename: parseResult.decks[0].cards[0].audioFilename,
          imageFilename: parseResult.decks[0].cards[0].imageFilename,
          reading: parseResult.decks[0].cards[0].reading,
        } : null,
      })

      // Store media files locally
      const mediaUrls = new Map<string, string>()
      if (parseResult.media.size > 0) {
        if (options?.onProgress) {
          options.onProgress(30, `Processing ${parseResult.media.size} media files...`)
        }

        let storedCount = 0
        for (const [filename, blob] of parseResult.media) {
          try {
            const blobUrl = await mediaStore.storeMedia(filename, blob)
            mediaUrls.set(filename, blobUrl)
            storedCount++
          } catch (error) {
            console.warn(`Failed to store media file ${filename}:`, error)
          }
        }
        console.log('[AnkiImporter] Media stored:', { storedCount, totalMedia: parseResult.media.size })
      }

      // Convert to our deck format
      const decks: AnkiDeck[] = parseResult.decks.map(deckInfo => ({
        id: deckInfo.id,
        name: deckInfo.name,
        description: deckInfo.desc || `Imported from Anki on ${new Date().toLocaleDateString()}`,
        cards: deckInfo.cards.map(card =>
          this.convertCardToReviewable(card, deckInfo.name, mediaUrls)
        ),
        mediaUrls,
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
   */
  private static convertCardToReviewable(
    card: ProcessedCard,
    deckName: string,
    mediaUrls: Map<string, string>
  ): AnkiCard {
    // Get media URLs using the extracted filenames
    const audioUrl = card.audioFilename ? mediaUrls.get(card.audioFilename) : undefined
    const imageUrl = card.imageFilename ? mediaUrls.get(card.imageFilename) : undefined

    // Build display content with embedded media
    let processedFront = card.front
    let processedBack = card.back

    // Replace [audio] placeholder with actual audio element if we have a URL
    if (audioUrl) {
      processedFront = processedFront.replace(/\[audio\]/g, '')
      processedBack = processedBack.replace(/\[audio\]/g, '')
    }

    // Replace [image] placeholder with actual image if we have a URL
    if (imageUrl) {
      processedFront = processedFront.replace(/\[image\]/g, `<img src="${imageUrl}" class="anki-image" />`)
      processedBack = processedBack.replace(/\[image\]/g, `<img src="${imageUrl}" class="anki-image" />`)
    }

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
      media: card.media,
      // Rich content fields
      reading: card.reading,
      audioUrl,
      imageUrl,
      audioFilename: card.audioFilename,
      imageFilename: card.imageFilename,
      expression: card.expression,
      meaning: card.meaning,
      sentence: card.sentence,
      sentenceReading: card.sentenceReading,
      sentenceMeaning: card.sentenceMeaning,
      metadata: {
        source: 'anki',
        noteId: card.noteId,
        deckId: card.deckId,
        noteType: card.noteType,
        importedAt: new Date().toISOString(),
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
