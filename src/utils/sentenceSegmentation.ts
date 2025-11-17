/**
 * Utility functions for smart sentence segmentation
 * Handles long Japanese sentences by breaking them at natural clause boundaries
 */

export interface SentenceSegment {
  text: string;
  isSegmented: boolean;
  originalLength: number;
}

/**
 * Segments a long Japanese sentence at natural clause boundaries (、)
 * @param text - The sentence to segment
 * @param maxLength - Maximum length before segmentation kicks in (default: 120)
 * @returns Array of text segments
 */
export function segmentLongSentence(text: string, maxLength: number = 120): string[] {
  // If sentence is short enough, return as-is
  if (text.length <= maxLength) {
    return [text];
  }

  // Split at Japanese commas (、) while preserving them
  const clauses = text.split(/(?<=、)/);

  // If no commas found, return the whole text (can't segment)
  if (clauses.length === 1) {
    return [text];
  }

  const segments: string[] = [];
  let currentSegment = '';

  for (let i = 0; i < clauses.length; i++) {
    const clause = clauses[i];

    // If adding this clause would exceed maxLength and we have content, push current segment
    if (currentSegment && (currentSegment + clause).length > maxLength) {
      segments.push(currentSegment.trim());
      currentSegment = clause;
    } else {
      currentSegment += clause;
    }
  }

  // Add remaining content
  if (currentSegment.trim()) {
    segments.push(currentSegment.trim());
  }

  // If we only got one segment, return original text
  return segments.length > 1 ? segments : [text];
}

/**
 * Analyzes a sentence and returns segmentation info
 * @param text - The sentence to analyze
 * @param maxLength - Maximum length before segmentation kicks in
 * @returns Segment information
 */
export function analyzeSentence(text: string, maxLength: number = 120): SentenceSegment {
  const segments = segmentLongSentence(text, maxLength);

  return {
    text,
    isSegmented: segments.length > 1,
    originalLength: text.length
  };
}

/**
 * Checks if a sentence should be segmented
 * @param text - The sentence to check
 * @param maxLength - Maximum length threshold
 * @returns true if sentence should be segmented
 */
export function shouldSegment(text: string, maxLength: number = 120): boolean {
  return text.length > maxLength && text.includes('、');
}
