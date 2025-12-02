/**
 * Book Summary Types
 * For the Toshokan (Library) feature - condensed book summaries
 */

import { JLPTLevel } from './ai-story';

// Re-export JLPTLevel for convenience
export type { JLPTLevel };

export interface Book {
  id: string;

  // Book Information
  title: string;                    // Condensed version title (English)
  titleJa: string;                  // Condensed version title (Japanese)
  bookName: string;                 // Original book name
  author?: string;                  // Original book author

  // Content
  content: string;                  // Condensed Japanese text (continuous, not paginated)
  summary: string;                  // Brief summary/description

  // Media
  coverImageUrl?: string;           // Book cover image (uploaded or AI-generated)
  audioUrl?: string;                // Pre-cached TTS audio URL

  // Classification
  jlptLevel: JLPTLevel;             // JLPT level for the condensed version
  category?: string;                // Genre (fiction, non-fiction, self-help, etc.)
  tags?: string[];                  // Additional tags

  // Metadata
  createdAt: string;                // Creation timestamp (ISO 8601)
  updatedAt?: string;               // Last update timestamp (ISO 8601)
  createdBy: string;                // Admin user ID who created it
  status: 'draft' | 'published';    // Publication status

  // Statistics
  viewCount?: number;               // Number of views
  readCount?: number;               // Number of complete reads

  // Additional metadata
  metadata?: {
    wordCount?: number;             // Word count of condensed version
    readingTime?: number;           // Estimated reading time (minutes)
    originalBookIsbn?: string;      // ISBN of original book
    generationModel?: string;       // AI model used for generation
    coverGenerated?: boolean;       // Whether cover was AI-generated
    audioCached?: boolean;          // Whether audio has been pre-generated
    audioGeneratedAt?: string;        // When audio was generated (ISO 8601)
  };
}

/**
 * Book generation request (admin creates book)
 */
export interface BookGenerationRequest {
  bookName: string;                 // Name of the book to condense
  author?: string;                  // Author name
  jlptLevel: JLPTLevel;             // Target JLPT level
  coverImageFile?: File;            // Optional: uploaded cover image
  generateCover?: boolean;          // Whether to AI-generate cover
  category?: string;                // Book genre/category
  additionalContext?: string;       // Optional context for AI
}

/**
 * Book draft (during generation)
 */
export interface BookDraft {
  id: string;
  bookName: string;
  author?: string;
  jlptLevel: JLPTLevel;
  title?: string;
  titleJa?: string;
  content?: string;
  summary?: string;
  coverImageUrl?: string;
  category?: string;
  status: 'generating' | 'draft' | 'error';
  createdAt: string;                // Creation timestamp (ISO 8601)
  createdBy: string;
  error?: string;
  metadata?: {
    generationStep?: 'title' | 'summary' | 'content' | 'cover' | 'audio' | 'complete';
    progress?: number;
  };
}

/**
 * Book list filters (for library page)
 */
export interface BookFilters {
  jlptLevel?: JLPTLevel | 'all';
  category?: string | 'all';
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Book list response
 */
export interface BookListResponse {
  success: boolean;
  books: Book[];
  totalCount: number;
  hasMore: boolean;
  meta?: {
    offset: number;
    limit: number;
    cached?: boolean;
  };
}
