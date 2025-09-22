/**
 * Base adapter class for transforming content types into ReviewableContent
 */

import { ReviewableContent } from '../core/interfaces';
import { ReviewMode, ContentTypeConfig } from '../core/types';

/**
 * Abstract base class for all content adapters
 */
export abstract class BaseContentAdapter<T = any> {
  protected config: ContentTypeConfig;
  
  constructor(config: ContentTypeConfig) {
    this.config = config;
  }
  
  /**
   * Transform raw content into ReviewableContent
   */
  abstract transform(rawContent: T): ReviewableContent;
  
  /**
   * Generate multiple choice options for recognition mode
   */
  abstract generateOptions(
    content: ReviewableContent, 
    pool: T[], 
    count: number
  ): ReviewableContent[];
  
  /**
   * Determine which review modes are supported
   */
  abstract getSupportedModes(): ReviewMode[];
  
  /**
   * Prepare content for specific review mode
   */
  abstract prepareForMode(
    content: ReviewableContent, 
    mode: ReviewMode
  ): ReviewableContent;
  
  /**
   * Calculate difficulty based on content characteristics
   */
  abstract calculateDifficulty(content: T): number;
  
  /**
   * Generate hints for the content
   */
  abstract generateHints(content: ReviewableContent): string[];
  
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