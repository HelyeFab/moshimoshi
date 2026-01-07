import { Buffer } from 'buffer';

// Ensure Buffer is available globally in browser
if (typeof window !== 'undefined' && typeof window.Buffer === 'undefined') {
  (window as any).Buffer = Buffer;
}

/**
 * AnkiParser - Parse Anki .apkg files (both legacy and modern formats)
 *
 * Supported formats:
 * - Legacy 2 (2018+): collection.anki2 - SQLite database (uncompressed)
 * - Modern (2.1.45+): collection.anki21 - SQLite database compressed with zstd
 *
 * Note: Modern Anki versions may include both formats in the .apkg file,
 * with collection.anki2 containing only a compatibility stub.
 * We prioritize collection.anki21 when both are present.
 */

interface ParsedAnkiNote {
  id: string;
  fields: string[];
  tags: string[];
  deckName: string;
}

export interface ProcessedCard {
  id: string;
  noteId: string;
  deckId: string;
  front: string;
  back: string;
  tags: string[];
  fields: string[];
  media?: string[];
  // Rich content fields extracted from Anki
  reading?: string;
  audioFilename?: string;
  imageFilename?: string;
  expression?: string;
  meaning?: string;
  sentence?: string;
  sentenceReading?: string;
  sentenceMeaning?: string;
  noteType?: 'vocabulary' | 'sentence' | 'unknown';
  // Furigana support
  furiganaFront?: string;  // Pre-generated or native furigana HTML for front
  furiganaBack?: string;   // Pre-generated or native furigana HTML for back
  hasNativeFurigana?: boolean; // True if card had furigana in Anki
}

export interface AnkiDeckInfo {
  id: string;
  name: string;
  desc: string;
  cards: ProcessedCard[];
}

interface MediaFile {
  filename: string;
  data: Uint8Array;
}

interface DeckMeta {
  name: string;
}

interface ParsedDeck {
  meta?: DeckMeta;
  notes: Array<{
    id: string;
    guid?: string;
    modelId?: string;
    fields: string[];
    tags: string[];
  }>;
  mediaFiles?: MediaFile[];
}

export class AnkiParser {
  static async parseApkg(file: File): Promise<{
    cards: ProcessedCard[];
    decks: AnkiDeckInfo[];
    media: Map<string, Blob>;
  }> {
    try {
      // Convert File to Buffer
      const buffer = await file.arrayBuffer();
      const deckBuffer = Buffer.from(buffer);

      // Parse the deck data
      const deck = await this.parseInMemory(deckBuffer);

      // Map notes to our card structure
      const mappedNotes: ParsedAnkiNote[] = deck.notes.map((note) => ({
        id: note.id,
        fields: note.fields,
        tags: note.tags,
        deckName: deck.meta?.name || 'Imported Deck'
      }));

      // Process cards with rich field extraction
      const processedCards: ProcessedCard[] = mappedNotes.map((note, index) => {
        const fields = note.fields || [];

        // Extract all media references from ALL fields BEFORE cleaning
        const allFieldsRaw = fields.join(' ');
        const media = this.extractMediaReferences(allFieldsRaw);

        // Extract audio and image filenames specifically
        const audioFilename = this.extractAudioFilename(allFieldsRaw);
        const imageFilename = this.extractImageFilename(allFieldsRaw);

        // Detect note type and extract fields accordingly
        const extracted = this.extractFieldsByType(fields);

        // Extract furigana from raw HTML BEFORE cleaning
        const furiganaFront = this.extractFurigana(extracted.front);
        const furiganaBack = this.extractFurigana(extracted.back);
        const hasNativeFurigana = !!(furiganaFront || furiganaBack);

        // Log first card for debugging
        if (index === 0) {
          console.log('[AnkiParser] First card extraction:', {
            fieldsCount: fields.length,
            field0: fields[0]?.substring(0, 30),
            field1: fields[1]?.substring(0, 30),
            field2: fields[2]?.substring(0, 30),
            allFieldsRaw: allFieldsRaw.substring(0, 200),
            audioFilename,
            imageFilename,
            extractedReading: extracted.reading,
            extractedExpression: extracted.expression,
            noteType: extracted.noteType,
            hasNativeFurigana,
            furiganaFront: furiganaFront?.substring(0, 50),
          });
        }

        return {
          id: note.id,
          noteId: note.id,
          deckId: '1',
          front: this.cleanHtml(extracted.front),
          back: this.cleanHtml(extracted.back),
          tags: note.tags || [],
          fields: note.fields,
          media,
          // Rich content
          reading: extracted.reading ? this.cleanHtml(extracted.reading) : undefined,
          audioFilename,
          imageFilename,
          expression: extracted.expression ? this.cleanHtml(extracted.expression) : undefined,
          meaning: extracted.meaning ? this.cleanHtml(extracted.meaning) : undefined,
          sentence: extracted.sentence ? this.cleanHtml(extracted.sentence) : undefined,
          sentenceReading: extracted.sentenceReading ? this.cleanHtml(extracted.sentenceReading) : undefined,
          sentenceMeaning: extracted.sentenceMeaning ? this.cleanHtml(extracted.sentenceMeaning) : undefined,
          noteType: extracted.noteType,
          // Furigana
          furiganaFront: furiganaFront || undefined,
          furiganaBack: furiganaBack || undefined,
          hasNativeFurigana,
        };
      });

      // Process media
      const media = new Map<string, Blob>();
      if (deck.mediaFiles && Array.isArray(deck.mediaFiles)) {
        deck.mediaFiles.forEach((mediaFile) => {
          if (mediaFile.data) {
            // Detect MIME type from filename extension
            const mimeType = this.getMimeType(mediaFile.filename);
            media.set(mediaFile.filename, new Blob([mediaFile.data as BlobPart], { type: mimeType }));
          }
        });
      }

      // Create deck info
      const decks = [{
        id: '1',
        name: deck.meta?.name || 'Imported Deck',
        desc: '',
        cards: processedCards
      }];

      return {
        cards: processedCards,
        decks,
        media
      };
    } catch (error) {
      console.error('Error parsing Anki package:', error);
      throw error;
    }
  }

  // Parse in memory without filesystem
  private static async parseInMemory(buffer: Buffer): Promise<ParsedDeck> {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    // Load the zip content
    const zipContent = await zip.loadAsync(buffer);

    // Log all files in the zip
    console.log('[AnkiParser] Files in .apkg:', Object.keys(zipContent.files));

    // Try modern format first (collection.anki21), then fallback to legacy (collection.anki2)
    let collectionFile = zipContent.files['collection.anki21'];
    let isModernFormat = false;

    if (collectionFile) {
      isModernFormat = true;
      console.log('[AnkiParser] Detected modern Anki format (collection.anki21)');
    } else {
      collectionFile = zipContent.files['collection.anki2'];
      if (!collectionFile) {
        throw new Error('No collection.anki2 or collection.anki21 file found in the Anki package');
      }
      console.log('[AnkiParser] Detected legacy Anki format (collection.anki2)');
    }

    let collectionData = await collectionFile.async('arraybuffer');
    console.log('[AnkiParser] Raw collection data size:', collectionData.byteLength);

    // Log first 16 bytes of raw data
    const rawBytes = new Uint8Array(collectionData);
    console.log('[AnkiParser] First 16 bytes (hex):',
      Array.from(rawBytes.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ')
    );
    console.log('[AnkiParser] First 16 bytes (text):',
      new TextDecoder().decode(rawBytes.slice(0, 16))
    );

    // Decompress if modern format (uses zstd compression)
    if (isModernFormat) {
      try {
        const rawData = new Uint8Array(collectionData);

        // Check if file is already SQLite (uncompressed)
        // Some collection.anki21 files are already uncompressed SQLite databases
        const rawHeader = new TextDecoder().decode(rawData.slice(0, 16));
        const isAlreadySQLite = rawHeader.startsWith('SQLite format 3');

        // Check if file is zstd compressed (magic bytes: 0x28 0xB5 0x2F 0xFD)
        const isZstdCompressed = rawData[0] === 0x28 && rawData[1] === 0xB5 &&
                                 rawData[2] === 0x2F && rawData[3] === 0xFD;

        console.log('[AnkiParser] Format detection:');
        console.log('[AnkiParser]   - Already SQLite:', isAlreadySQLite);
        console.log('[AnkiParser]   - Zstd compressed:', isZstdCompressed);

        if (isAlreadySQLite) {
          // File is already uncompressed SQLite - skip decompression
          console.log('[AnkiParser] collection.anki21 is already uncompressed SQLite');
          console.log('[AnkiParser] Skipping decompression step');
          // collectionData is already set correctly, no changes needed
        } else if (isZstdCompressed) {
          // File is zstd compressed - decompress it
          console.log('[AnkiParser] collection.anki21 is zstd compressed - decompressing');

          const { ZSTDDecoder } = await import('zstddec');
          const decoder = new ZSTDDecoder();
          await decoder.init();

          console.log('[AnkiParser] Compressed data size:', rawData.length);
          console.log('[AnkiParser] First 16 bytes (hex):',
            Array.from(rawData.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ')
          );

          // ZSTDDecoder requires uncompressed size, but we can pass undefined to let it auto-detect
          const decompressed = decoder.decode(rawData);

          if (!decompressed) {
            throw new Error('Failed to decompress collection.anki21 file');
          }

          console.log('[AnkiParser] Decompressed data size:', decompressed.length);
          console.log('[AnkiParser] First 16 bytes of decompressed (hex):',
            Array.from(decompressed.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ')
          );

          // Check if decompression resulted in valid SQLite
          const sqliteHeader = new TextDecoder().decode(decompressed.slice(0, 16));
          console.log('[AnkiParser] Decompressed header:', sqliteHeader);

          if (!sqliteHeader.startsWith('SQLite format 3')) {
            console.warn('[AnkiParser] Non-standard SQLite header detected (possibly anki21b format)');
            console.warn('[AnkiParser] Header:', sqliteHeader);
            console.warn('[AnkiParser] Attempting to parse anyway - anki21b files are still SQLite databases');
            // Don't throw - many anki21b files are valid SQLite with non-standard headers
            // We'll attempt to parse and let sql.js handle any actual incompatibilities
          }

          // Create a new ArrayBuffer from the decompressed data
          const newBuffer = new ArrayBuffer(decompressed.length);
          const newView = new Uint8Array(newBuffer);
          newView.set(decompressed);
          collectionData = newBuffer;

          console.log('[AnkiParser] Successfully decompressed collection.anki21 (' +
            `${rawData.length} bytes -> ${decompressed.length} bytes)`);
        } else {
          // Unknown format - log warning and attempt to use as-is
          console.warn('[AnkiParser] Unknown collection.anki21 format (not SQLite, not zstd)');
          console.warn('[AnkiParser] Header:', rawHeader);
          console.warn('[AnkiParser] Attempting to parse anyway');
        }
      } catch (error) {
        console.error('[AnkiParser] Failed to decompress collection.anki21:', error);

        // Re-throw our specific error messages
        if (error instanceof Error && error.message.includes('Protocol Buffers')) {
          throw error;
        }

        throw new Error(
          'Failed to decompress modern Anki file. This may be a corrupted or encrypted deck. ' +
          'Please try exporting the deck again from Anki.'
        );
      }
    }

    // Initialize SQL.js to read the SQLite database
    const SQL = await this.initSQL();
    let db;

    // Final check before opening database
    const finalData = new Uint8Array(collectionData);
    console.log('[AnkiParser] Final data size before SQL.js:', finalData.length);
    console.log('[AnkiParser] Final data first 16 bytes (hex):',
      Array.from(finalData.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ')
    );
    const finalHeader = new TextDecoder().decode(finalData.slice(0, 16));
    console.log('[AnkiParser] Final data header:', JSON.stringify(finalHeader));

    if (!finalHeader.startsWith('SQLite format 3')) {
      throw new Error(
        `Invalid data format. Expected SQLite database but got: "${finalHeader.replace(/\0/g, '\\0')}". ` +
        `This file may be using an unsupported Anki format (anki21b/protobuf). ` +
        `Please export from Anki using legacy format: File → Export → Legacy support: "Anki 2.1.50+"`
      );
    }

    try {
      db = new SQL.Database(finalData);
    } catch (error) {
      console.error('[AnkiParser] Failed to open SQLite database:', error);

      // Provide helpful error messages based on common issues
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (errorMsg.includes('encrypted')) {
        throw new Error(
          'This Anki deck is password-protected. Please remove the password in Anki and export again.'
        );
      }

      if (errorMsg.includes('not a database')) {
        throw new Error(
          'Invalid Anki file format. The file may be corrupted or not a valid .apkg file.'
        );
      }

      throw new Error(`Failed to read Anki database: ${errorMsg}`);
    }

    try {
      // First, check what tables exist in the database
      const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
      const tables = tablesResult[0]?.values.flat() || [];
      console.log('[AnkiParser] Available tables:', tables);

      // Check if the 'col' table exists
      if (!tables.includes('col')) {
        throw new Error(
          `Invalid Anki database schema. Expected 'col' table but found: ${tables.join(', ')}. ` +
          'This may be an unsupported Anki version or corrupted file.'
        );
      }

      // Get collection info
      const colResult = db.exec('SELECT decks, models FROM col');
      const decksJson = colResult[0]?.values[0]?.[0] as string;
      const modelsJson = colResult[0]?.values[0]?.[1] as string;

      const decks = JSON.parse(decksJson || '{}');
      const models = JSON.parse(modelsJson || '{}');

      // Get all notes using pagination to avoid issues with large decks
      let offset = 0;
      let allNotes: Record<string, any>[] = [];
      let hasMore = true;

      while (hasMore) {
        const pageQuery = db.exec(`SELECT * FROM notes LIMIT 100 OFFSET ${offset}`);
        const pageData = pageQuery[0]?.values || [];

        if (pageData.length === 0) {
          hasMore = false;
        } else {
          // Map raw SQL result to objects
          const columns: string[] = pageQuery[0]?.columns || [];
          const mappedPage = pageData.map((row: any[]) => {
            const obj: Record<string, any> = {};
            columns.forEach((col: string, idx: number) => {
              obj[col] = row[idx];
            });
            return obj;
          });
          allNotes = allNotes.concat(mappedPage);
          offset += pageData.length;
        }

        // Safety limit
        if (offset > 10000) break;
      }

      // Map notes to our format
      const notes = allNotes.map((noteRow) => {
        const fields = noteRow.flds ? noteRow.flds.split('\x1f') : [];
        const tags = noteRow.tags ? noteRow.tags.split(' ').filter(Boolean) : [];

        return {
          id: String(noteRow.id),
          guid: noteRow.guid,
          modelId: noteRow.mid,
          fields,
          tags
        };
      });

      // Get deck metadata
      const deckEntries = Object.entries(decks);
      const mainDeck = deckEntries.length > 0 ? deckEntries[0][1] : { name: 'Imported Deck' };

      // Process media
      const mediaFiles: MediaFile[] = [];
      const mediaFile = zipContent.files['media'];
      if (mediaFile) {
        try {
          const mediaJson = await mediaFile.async('string');
          const mediaMap = JSON.parse(mediaJson);

          for (const [idx, filename] of Object.entries(mediaMap)) {
            const mediaFileInZip = zipContent.files[idx];
            if (mediaFileInZip) {
              const data = await mediaFileInZip.async('uint8array');
              mediaFiles.push({ filename: filename as string, data });
            }
          }
        } catch (e) {
          console.warn('Failed to process media files:', e);
        }
      }

      return {
        meta: {
          name: (mainDeck as Record<string, any>).name || 'Imported Deck'
        },
        notes,
        mediaFiles
      };
    } finally {
      db.close();
    }
  }

  private static async initSQL() {
    // @ts-ignore - sql.js doesn't have type declarations
    const initSqlJs = (await import('sql.js')).default;
    return await initSqlJs({
      locateFile: (file: string) => {
        if (file.endsWith('.wasm')) {
          return '/sql-wasm.wasm';
        }
        return `/${file}`;
      }
    });
  }

  /**
   * Extract furigana HTML from raw field content
   * Returns null if no furigana exists, otherwise returns the HTML with ruby tags
   */
  private static extractFurigana(html: string): string | null {
    if (!html) return null;

    // Check if the HTML contains ruby tags
    const hasRubyTags = /<ruby>.*?<rt>.*?<\/rt><\/ruby>/gi.test(html);

    if (!hasRubyTags) {
      return null;
    }

    // Return the HTML with ruby tags preserved
    // Clean up entities and normalize spacing
    let furiganaHtml = html
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // Remove audio/image references
    furiganaHtml = furiganaHtml.replace(/\[sound:[^\]]+\]/g, '');
    furiganaHtml = furiganaHtml.replace(/<img[^>]+>/g, '');

    // Remove non-ruby formatting tags but preserve content
    furiganaHtml = furiganaHtml.replace(/<\/?(?!ruby|rt|rp)(div|p|span|b|i|u|strong|em|font)[^>]*>/gi, '');

    return furiganaHtml.trim();
  }

  private static cleanHtml(html: string): string {
    if (!html) return '';

    let cleaned = html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // Extract furigana
    cleaned = cleaned.replace(/<ruby>(.*?)<rt>(.*?)<\/rt><\/ruby>/gi, '$1($2)');

    // Clean audio/image references but keep markers
    cleaned = cleaned.replace(/\[sound:[^\]]+\]/g, '[audio]');
    cleaned = cleaned.replace(/<img[^>]+>/g, '[image]');

    // Remove HTML tags but preserve content
    cleaned = cleaned.replace(/<\/?(div|p|span|b|i|u|strong|em|font)[^>]*>/gi, '');

    return cleaned.trim();
  }

  private static extractMediaReferences(content: string): string[] {
    const mediaRefs: string[] = [];

    // Match [sound:filename.mp3] format
    const soundMatches = content.match(/\[sound:([^\]]+)\]/g) || [];
    for (const match of soundMatches) {
      const filename = match.replace(/\[sound:|]/g, '');
      mediaRefs.push(filename);
    }

    // Match <img src="filename.jpg"> format
    const imgMatches = content.match(/<img[^>]+src="([^"]+)"/g) || [];
    for (const match of imgMatches) {
      const filename = match.match(/src="([^"]+)"/)?.[1];
      if (filename && !filename.startsWith('http')) {
        mediaRefs.push(filename);
      }
    }

    return mediaRefs;
  }

  /**
   * Extract audio filename from content
   */
  private static extractAudioFilename(content: string): string | undefined {
    const match = content.match(/\[sound:([^\]]+)\]/);
    return match ? match[1] : undefined;
  }

  /**
   * Extract image filename from content
   */
  private static extractImageFilename(content: string): string | undefined {
    const match = content.match(/<img[^>]+src="([^"]+)"/);
    if (match && match[1] && !match[1].startsWith('http')) {
      return match[1];
    }
    return undefined;
  }

  /**
   * Smart field extraction based on note type detection
   */
  private static extractFieldsByType(fields: string[]): {
    front: string;
    back: string;
    reading?: string;
    expression?: string;
    meaning?: string;
    sentence?: string;
    sentenceReading?: string;
    sentenceMeaning?: string;
    noteType: 'vocabulary' | 'sentence' | 'unknown';
  } {
    // Default result
    const result: ReturnType<typeof this.extractFieldsByType> = {
      front: fields[0] || '',
      back: fields[1] || '',
      noteType: 'unknown',
    };

    if (fields.length === 0) return result;

    // iKnow! format detection (7 fields: Expression, Meaning, Reading, Audio, Image_URI, iKnowID, iKnowType)
    if (fields.length >= 7) {
      const lastField = fields[6]?.toLowerCase() || '';
      if (lastField === 'item' || lastField === 'sentence') {
        // This is iKnow! format
        const isVocab = lastField === 'item';
        result.noteType = isVocab ? 'vocabulary' : 'sentence';
        result.expression = fields[0];
        result.meaning = fields[1];
        result.reading = fields[2];
        // fields[3] = Audio, fields[4] = Image_URI - handled separately
        // fields[5] = iKnowID, fields[6] = iKnowType

        if (isVocab) {
          result.front = fields[0]; // Expression
          result.back = fields[1];  // Meaning
        } else {
          // Sentence type - expression contains the sentence
          result.sentence = fields[0];
          result.sentenceReading = fields[2];
          result.sentenceMeaning = fields[1];
          result.front = fields[0];
          result.back = fields[1];
        }
        return result;
      }
    }

    // Core 2000 format detection (first field is numeric index)
    if (fields.length >= 4 && /^\d+$/.test(fields[0]?.trim())) {
      // Core 2000: [index, expression, reading, meaning, ...]
      result.noteType = 'vocabulary';
      result.expression = fields[1];
      result.reading = fields[2];
      result.meaning = fields[3];
      result.front = fields[1];
      result.back = fields[3];
      return result;
    }

    // Generic Japanese vocab format (Expression, Reading, Meaning or similar)
    if (fields.length >= 3) {
      const field0 = fields[0] || '';
      const field1 = fields[1] || '';
      const field2 = fields[2] || '';

      // Check if field1 looks like a reading (all hiragana/katakana)
      const isReadingField = /^[\u3040-\u309F\u30A0-\u30FF\s]+$/.test(field1.replace(/<[^>]+>/g, ''));

      if (isReadingField) {
        // Format: Expression, Reading, Meaning
        result.noteType = 'vocabulary';
        result.expression = field0;
        result.reading = field1;
        result.meaning = field2;
        result.front = field0;
        result.back = field2;
        return result;
      }

      // Check if it's Expression, Meaning, Reading order
      const isField2Reading = /^[\u3040-\u309F\u30A0-\u30FF\s]+$/.test(field2.replace(/<[^>]+>/g, ''));
      if (isField2Reading) {
        result.noteType = 'vocabulary';
        result.expression = field0;
        result.meaning = field1;
        result.reading = field2;
        result.front = field0;
        result.back = field1;
        return result;
      }
    }

    // Standard 2-field format
    if (fields.length >= 2) {
      result.front = fields[0];
      result.back = fields[1];
      result.noteType = 'vocabulary';
    } else if (fields.length === 1) {
      result.front = fields[0];
      result.back = fields[0];
    }

    return result;
  }

  /**
   * Detect MIME type from filename extension
   * @param filename - Original Anki filename
   * @returns MIME type string
   */
  private static getMimeType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop() || '';

    // Audio formats
    if (ext === 'mp3') return 'audio/mpeg';
    if (ext === 'wav') return 'audio/wav';
    if (ext === 'ogg') return 'audio/ogg';
    if (ext === 'm4a') return 'audio/mp4';
    if (ext === 'aac') return 'audio/aac';
    if (ext === 'flac') return 'audio/flac';

    // Image formats
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    if (ext === 'png') return 'image/png';
    if (ext === 'gif') return 'image/gif';
    if (ext === 'webp') return 'image/webp';
    if (ext === 'svg') return 'image/svg+xml';
    if (ext === 'bmp') return 'image/bmp';

    // Video formats
    if (ext === 'mp4') return 'video/mp4';
    if (ext === 'webm') return 'video/webm';
    if (ext === 'ogv') return 'video/ogg';
    if (ext === 'avi') return 'video/x-msvideo';
    if (ext === 'mov') return 'video/quicktime';

    // Default to application/octet-stream for unknown types
    console.warn(`[AnkiParser] Unknown file extension: ${ext}, defaulting to application/octet-stream`);
    return 'application/octet-stream';
  }
}