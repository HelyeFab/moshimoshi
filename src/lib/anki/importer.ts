import { AnkiParser, ProcessedCard, AnkiDeckInfo } from './parser';
import { AnkiMediaStore } from './mediaStore';
import { ReviewableContent } from '@/lib/review-engine/core/interfaces';
import { v4 as uuidv4 } from 'uuid';

export interface AnkiCard extends ReviewableContent {
  id: string;
  front: string;
  back: string;
  tags: string[];
  deckName: string;
  fields?: string[];
  media?: string[];
  // SRS data
  interval?: number;
  ease?: number;
  reviews?: number;
  lapses?: number;
}

export interface AnkiDeck {
  id: string;
  name: string;
  cards: AnkiCard[];
  description?: string;
  mediaUrls?: Map<string, string>;
}

export interface ImportOptions {
  onProgress?: (progress: number, message: string) => void;
  maxFileSize?: number;
}

export interface ImportResult {
  success: boolean;
  deck?: AnkiDeck;
  cardsImported?: number;
  error?: string;
}

export class AnkiImporter {
  private static DEFAULT_MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

  /**
   * Parse an Anki package file (.apkg) into a deck structure
   */
  static async parsePackage(
    file: File,
    options?: ImportOptions
  ): Promise<{ decks: AnkiDeck[], media: Map<string, Blob> }> {
    const maxSize = options?.maxFileSize || this.DEFAULT_MAX_FILE_SIZE;

    if (file.size > maxSize) {
      throw new Error(`File size exceeds ${maxSize / 1024 / 1024}MB limit. File size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
    }

    try {
      const parseResult = await AnkiParser.parseApkg(file);
      const mediaStore = AnkiMediaStore.getInstance();

      // Store media files locally
      const mediaUrls = new Map<string, string>();
      if (parseResult.media.size > 0) {
        if (options?.onProgress) {
          options.onProgress(30, `Processing ${parseResult.media.size} media files...`);
        }

        for (const [filename, blob] of parseResult.media) {
          try {
            const blobUrl = await mediaStore.storeMedia(filename, blob);
            mediaUrls.set(filename, blobUrl);
          } catch (error) {
            console.warn(`Failed to store media file ${filename}:`, error);
          }
        }
      }

      // Convert to our deck format
      const decks: AnkiDeck[] = parseResult.decks.map(deckInfo => ({
        id: deckInfo.id,
        name: deckInfo.name,
        description: deckInfo.desc || `Imported from Anki on ${new Date().toLocaleDateString()}`,
        cards: deckInfo.cards.map(card => this.convertCardToReviewable(card, deckInfo.name, mediaUrls)),
        mediaUrls
      }));

      return { decks, media: parseResult.media };
    } catch (error) {
      console.error('Error parsing Anki package:', error);
      throw error instanceof Error ? error : new Error('Failed to parse Anki package');
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
    // Process media references
    let processedFront = card.front;
    let processedBack = card.back;

    if (card.media) {
      for (const mediaRef of card.media) {
        const url = mediaUrls.get(mediaRef);
        if (url) {
          // Replace sound references
          processedFront = processedFront.replace(`[audio]`, `<audio controls src="${url}" class="anki-audio" />`);
          processedBack = processedBack.replace(`[audio]`, `<audio controls src="${url}" class="anki-audio" />`);

          // Replace image references
          processedFront = processedFront.replace(`[image]`, `<img src="${url}" class="anki-image" />`);
          processedBack = processedBack.replace(`[image]`, `<img src="${url}" class="anki-image" />`);
        }
      }
    }

    return {
      id: card.id,
      type: 'anki-card',
      content: {
        front: processedFront,
        back: processedBack,
        originalFront: card.front,
        originalBack: card.back
      },
      front: processedFront,
      back: processedBack,
      tags: card.tags,
      deckName,
      fields: card.fields,
      media: card.media,
      metadata: {
        source: 'anki',
        noteId: card.noteId,
        deckId: card.deckId,
        importedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Import an Anki deck from a file
   */
  static async importDeck(
    file: File,
    options?: ImportOptions
  ): Promise<ImportResult> {
    try {
      if (options?.onProgress) {
        options.onProgress(10, 'Parsing Anki package...');
      }

      const { decks } = await this.parsePackage(file, options);

      if (decks.length === 0) {
        return { success: false, error: 'No decks found in the package' };
      }

      // For now, import the first deck (most Anki packages have one main deck)
      const deck = decks[0];

      if (deck.cards.length === 0) {
        return { success: false, error: 'Selected deck has no cards' };
      }

      if (options?.onProgress) {
        options.onProgress(100, `Import complete! ${deck.cards.length} cards imported.`);
      }

      return {
        success: true,
        deck,
        cardsImported: deck.cards.length
      };
    } catch (error) {
      console.error('Import failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Validate an .apkg file
   */
  static validateFile(file: File): { valid: boolean; error?: string } {
    if (!file.name.endsWith('.apkg')) {
      return { valid: false, error: 'File must be an .apkg file' };
    }

    if (file.size > this.DEFAULT_MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File size exceeds ${this.DEFAULT_MAX_FILE_SIZE / 1024 / 1024}MB limit`
      };
    }

    return { valid: true };
  }

  /**
   * Get media storage statistics
   */
  static async getMediaStats() {
    const mediaStore = AnkiMediaStore.getInstance();
    return await mediaStore.getStats();
  }

  /**
   * Clear all stored media
   */
  static async clearAllMedia() {
    const mediaStore = AnkiMediaStore.getInstance();
    await mediaStore.deleteAllMedia();
  }
}