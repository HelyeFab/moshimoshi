// DeckMarket Types

export const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;

export const DECK_LANGUAGES = [
  { code: 'ja', name: 'Japanese' },
  { code: 'en', name: 'English' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ko', name: 'Korean' }
] as const;

export const MAX_APKG_SIZE_BYTES = 200 * 1024 * 1024; // 200MB

export const ALLOWED_EXTENSIONS = ['.apkg'] as const;

// Input validation limits
export const DECK_LIMITS = {
  TITLE_MAX: 255,
  DESCRIPTION_MAX: 2000,
  TAGS_MAX_COUNT: 10,
  TAG_MAX_LENGTH: 50,
  CHANGELOG_MAX: 500,
  VERSION_LABEL_MAX: 100,
} as const;

export const DECKMARKET_R2_PREFIX = 'deckmarket';
export const DECKMARKET_COLLECTION = 'deckmarket_decks';
export const VERSIONS_SUBCOLLECTION = 'versions';
export const DECKMARKET_NOTES_COLLECTION = 'deckmarket_notes';
export const DECKMARKET_NOTES_R2_PREFIX = 'deckmarket/notes';
export const NOTES_VERSIONS_SUBCOLLECTION = 'versions';
export const MAX_MD_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
export const ALLOWED_MD_EXTENSIONS = ['.md'] as const;

export type JlptLevel = typeof JLPT_LEVELS[number];

/**
 * Firestore document for deckmarket_decks/{deckId}
 */
export interface DeckMarketDeck {
  id: string; // slug like "genki2-lesson-02"
  title: string;
  description: string;
  hasNativeAudio: boolean; // whether deck includes native JP audio in package
  language: string; // default "ja"
  jlpt: string | null; // "N5" | "N4" | "N3" | "N2" | "N1" | null
  tags: string[];
  isPublished: boolean; // default false
  latestVersionId: string | null;
  downloadCount: number; // default 0
  lastDownloadAt: string | null; // ISO date string
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

/**
 * Firestore document for deckmarket_notes/{noteId}
 */
export interface DeckMarketNote {
  id: string; // slug like "lesson-01-notes"
  title: string;
  description: string;
  language: string; // default "ja"
  tags: string[];
  isPublished: boolean; // default false
  latestVersionId: string | null;
  downloadCount: number; // default 0
  lastDownloadAt: string | null; // ISO date string
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

/**
 * Firestore document for deckmarket_decks/{deckId}/versions/{versionId}
 */
export interface DeckMarketVersion {
  id: string; // UUID
  deckId: string;
  versionLabel: string; // "v1", "2026-02-09"
  changelog: string; // default ""
  apkgR2Key: string; // "deckmarket/{deckId}/{versionId}/deck.apkg"
  apkgFilename: string; // sanitised original filename
  sizeBytes: number;
  csvR2Key?: string | null; // optional CSV source key
  csvFilename?: string | null; // optional CSV filename
  csvSizeBytes?: number | null; // optional CSV size
  sha256: string | null; // optional
  createdAt: string; // ISO date string
  createdByUid: string;
}

/**
 * Firestore document for deckmarket_notes/{noteId}/versions/{versionId}
 */
export interface DeckMarketNoteVersion {
  id: string; // UUID
  noteId: string;
  versionLabel: string; // "v1", "2026-02-09"
  changelog: string; // default ""
  pdfR2Key: string; // "deckmarket/notes/{noteId}/{versionId}/notes.pdf"
  pdfFilename: string;
  pdfSizeBytes: number;
  mdR2Key: string; // source markdown
  mdFilename: string;
  mdSizeBytes: number;
  createdAt: string; // ISO date string
  createdByUid: string;
}

// Request/Response types for API

/**
 * Admin request to create a deck
 */
export interface CreateDeckRequest {
  id?: string;
  title: string;
  description: string;
  hasNativeAudio?: boolean;
  language?: string;
  jlpt?: string | null;
  tags?: string[];
}

/**
 * Admin request to update a deck
 */
export interface UpdateDeckRequest {
  title?: string;
  description?: string;
  hasNativeAudio?: boolean;
  language?: string;
  jlpt?: string | null;
  tags?: string[];
  isPublished?: boolean;
}

/**
 * Admin request to create a note
 */
export interface CreateNoteRequest {
  id?: string;
  title: string;
  description: string;
  language?: string;
  tags?: string[];
}

/**
 * Admin request to update a note
 */
export interface UpdateNoteRequest {
  title?: string;
  description?: string;
  language?: string;
  tags?: string[];
  isPublished?: boolean;
}

/**
 * Admin request to upload a new deck version
 */
export interface UploadVersionRequest {
  filename: string;
  fileSize: number;
  versionLabel?: string;
  changelog?: string;
}

/**
 * Admin response for presigned upload
 */
export interface UploadVersionResponse {
  success: true;
  uploadUrl: string;
  versionId: string;
  r2Key: string;
  expiresIn: number;
}

/**
 * Deck list item for catalogue/admin list views
 */
export interface DeckListItem {
  id: string;
  title: string;
  description: string;
  tags: string[];
  jlpt: string | null;
  language: string;
  downloadCount: number;
  updatedAt: string; // ISO date string
}

/**
 * Note list item for catalogue/admin list views
 */
export interface NoteListItem {
  id: string;
  title: string;
  description: string;
  tags: string[];
  language: string;
  downloadCount: number;
  updatedAt: string; // ISO date string
}

/**
 * Paginated deck list response
 */
export interface DeckListResponse {
  success: true;
  data: {
    items: DeckListItem[];
    page: number;
    pageSize: number;
    total: number;
  };
}

/**
 * Paginated note list response
 */
export interface NoteListResponse {
  success: true;
  data: {
    items: NoteListItem[];
    page: number;
    pageSize: number;
    total: number;
  };
}

/**
 * Deck detail response with versions
 */
export interface DeckDetailResponse {
  success: true;
  data: {
    deck: DeckMarketDeck;
    versions: DeckMarketVersion[];
    latestVersion: DeckMarketVersion | null;
  };
}

/**
 * Note detail response with versions
 */
export interface NoteDetailResponse {
  success: true;
  data: {
    note: DeckMarketNote;
    versions: DeckMarketNoteVersion[];
    latestVersion: DeckMarketNoteVersion | null;
  };
}

/**
 * Presigned download response for deck versions
 */
export interface DeckDownloadResponse {
  success: true;
  downloadUrl: string;
  filename: string;
  sizeBytes: number;
  expiresIn: number;
}

export type DeckPreviewFormat = 'apkg' | 'csv';

export interface DeckPreviewResponse {
  success: true;
  format: DeckPreviewFormat;
  downloadUrl: string;
  filename: string;
  sizeBytes: number;
  expiresIn: number;
}
