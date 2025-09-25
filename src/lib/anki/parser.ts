import { Buffer } from 'buffer';

// Ensure Buffer is available globally in browser
if (typeof window !== 'undefined' && typeof window.Buffer === 'undefined') {
  (window as any).Buffer = Buffer;
}

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

      // Process cards
      const processedCards: ProcessedCard[] = mappedNotes.map((note) => {
        const fields = note.fields || [];
        let front = '';
        let back = '';

        // Core 2000 detection - if first field is a number, skip it
        if (fields.length >= 4 && /^\d+$/.test(fields[0]?.trim())) {
          // Core 2000: [index, expression, reading, meaning, ...]
          front = fields[1] || ''; // Expression
          back = fields[3] || ''; // Meaning
        } else if (fields.length >= 2) {
          front = fields[0] || '';
          back = fields[1] || '';
        } else if (fields.length === 1) {
          front = fields[0] || '';
          back = fields[0] || '';
        }

        const media = this.extractMediaReferences(front + ' ' + back);

        return {
          id: note.id,
          noteId: note.id,
          deckId: '1',
          front: this.cleanHtml(front),
          back: this.cleanHtml(back),
          tags: note.tags || [],
          fields: note.fields,
          media
        };
      });

      // Process media
      const media = new Map<string, Blob>();
      if (deck.mediaFiles && Array.isArray(deck.mediaFiles)) {
        deck.mediaFiles.forEach((mediaFile) => {
          if (mediaFile.data) {
            media.set(mediaFile.filename, new Blob([mediaFile.data]));
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

    // Extract collection.anki2
    const collectionFile = zipContent.files['collection.anki2'];
    if (!collectionFile) {
      throw new Error('No collection.anki2 file found in the Anki package');
    }

    const collectionData = await collectionFile.async('arraybuffer');

    // Initialize SQL.js to read the SQLite database
    const SQL = await this.initSQL();
    const db = new SQL.Database(new Uint8Array(collectionData));

    try {
      // Get collection info
      const colResult = db.exec('SELECT decks, models FROM col');
      const decksJson = colResult[0]?.values[0]?.[0] as string;
      const modelsJson = colResult[0]?.values[0]?.[1] as string;

      const decks = JSON.parse(decksJson || '{}');
      const models = JSON.parse(modelsJson || '{}');

      // Get all notes using pagination to avoid issues with large decks
      let offset = 0;
      let allNotes = [];
      let hasMore = true;

      while (hasMore) {
        const pageQuery = db.exec(`SELECT * FROM notes LIMIT 100 OFFSET ${offset}`);
        const pageData = pageQuery[0]?.values || [];

        if (pageData.length === 0) {
          hasMore = false;
        } else {
          // Map raw SQL result to objects
          const columns = pageQuery[0]?.columns || [];
          const mappedPage = pageData.map((row) => {
            const obj: Record<string, any> = {};
            columns.forEach((col, idx) => {
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
}