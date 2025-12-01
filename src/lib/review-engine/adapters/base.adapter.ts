/**
 * Base adapter class for transforming content types into ReviewableContent
 */

import { ReviewableContent } from '../core/interfaces';
import { ReviewMode, ContentTypeConfig } from '../core/types';

/**
 * Abstract base class for all content adapters
 *
 * Subclasses should implement at minimum:
 * - transform() to convert raw content to ReviewableContent
 *
 * Optional overrides for advanced features:
 * - generateOptions() for multiple choice
 * - getSupportedModes() for mode selection
 * - prepareForMode() for mode-specific display
 * - calculateDifficulty() for SRS integration
 * - generateHints() for hint system
 */
export abstract class BaseContentAdapter<T = any> {
  protected config?: ContentTypeConfig;

  constructor(config?: ContentTypeConfig) {
    this.config = config;
  }

  /**
   * Transform raw content into ReviewableContent
   * This is the primary method subclasses must implement
   */
  abstract transform(rawContent: T): ReviewableContent;

  /**
   * Alias for transform() - for backwards compatibility
   */
  adapt(rawContent: T): ReviewableContent {
    return this.transform(rawContent);
  }

  /**
   * Batch transform multiple items
   */
  adaptBatch(items: T[]): ReviewableContent[] {
    return items.map(item => this.transform(item));
  }

  /**
   * Generate multiple choice options for recognition mode
   * Override in subclass for custom option generation
   */
  generateOptions(
    content: ReviewableContent,
    pool: T[],
    count: number = 4
  ): ReviewableContent[] {
    // Default: return random items from pool
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map(item => this.transform(item));
  }

  /**
   * Determine which review modes are supported
   * Override in subclass for content-specific modes
   */
  getSupportedModes(): ReviewMode[] {
    return ['recognition', 'recall'];
  }

  /**
   * Prepare content for specific review mode
   * Override in subclass for mode-specific transformations
   */
  prepareForMode(
    content: ReviewableContent,
    mode: ReviewMode
  ): ReviewableContent {
    return content; // Default: return unchanged
  }

  /**
   * Calculate difficulty based on content characteristics
   * Override in subclass for content-specific difficulty calculation
   */
  calculateDifficulty(content: T): number {
    return 0.5; // Default: medium difficulty
  }

  /**
   * Generate hints for the content
   * Override in subclass for content-specific hints
   */
  generateHints(content: ReviewableContent): string[] {
    return []; // Default: no hints
  }
  
  /**
   * Validate if raw content can be adapted
   */
  protected validate(content: T): boolean {
    return content !== null && content !== undefined;
  }
  
  /**
   * Common utility for similarity scoring using Levenshtein distance
   */
  protected calculateSimilarity(a: string, b: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    const distance = matrix[b.length][a.length];
    const maxLength = Math.max(a.length, b.length);
    return 1 - (distance / maxLength);
  }
}