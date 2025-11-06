/**
 * Type definitions for conjugation error analysis
 */

import type { HelpContent } from '@/data/conjugation-help/help-content';
import type { ExtendedConjugationForms } from '@/types/conjugation';
import type { JapaneseWord } from '@/types/drill';

/**
 * Classification of conjugation errors
 */
export type ErrorType =
  | 'wrong-form'           // Used wrong conjugation form
  | 'wrong-verb-type'      // Applied wrong verb type rules (Godan vs Ichidan)
  | 'special-case'         // Missed special case (行く, いい, etc.)
  | 'okurigana-missing'    // Missing or incorrect okurigana
  | 'partial-correct'      // Partially correct answer
  | 'close-match'          // Very close to correct (typo-level)
  | 'completely-wrong';    // No similarity

/**
 * Analysis result for a single user error
 */
export interface ErrorAnalysis {
  // Input data
  userInput: string;
  correctAnswer: string;
  attemptedForm: keyof ExtendedConjugationForms;
  word: JapaneseWord;

  // Error classification
  errorType: ErrorType;
  confidence: number; // 0-1, how confident we are in the classification

  // Similarity metrics
  levenshteinDistance: number;
  similarityScore: number; // 0-1, higher = more similar

  // Possible alternative interpretations
  possibleInterpretation?: {
    detectedForm: keyof ExtendedConjugationForms;
    explanation: string;
  };

  // Best matching incorrect form (if detected)
  closestWrongForm?: {
    formName: keyof ExtendedConjugationForms;
    value: string;
    similarity: number;
  };
}

/**
 * Ranked help content with relevance score
 */
export interface RankedHelp {
  helpContent: HelpContent;
  relevanceScore: number; // 0-100
  matchReasons: string[]; // Why this help is relevant
}

/**
 * Complete analysis with help suggestions
 */
export interface ConjugationErrorReport {
  analysis: ErrorAnalysis;
  relevantHelp: RankedHelp[];
  quickTip?: string; // Short one-liner hint
  detailedExplanation?: string; // Longer explanation
}

/**
 * Options for error analysis
 */
export interface AnalysisOptions {
  includeHelp?: boolean; // Default: true
  maxHelpItems?: number; // Default: 3
  similarityThreshold?: number; // Default: 0.3 (show help if > threshold)
  considerRomaji?: boolean; // Default: true
}
