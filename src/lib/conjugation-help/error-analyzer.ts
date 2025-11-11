/**
 * Conjugation Error Analyzer
 *
 * Main entry point for conjugation error analysis.
 * Analyzes user conjugation errors and provides smart help suggestions.
 */

import { ExtendedConjugationEngine } from '@/lib/conjugation/engine';
import { ConjugationErrorClassifier } from './error-classifier';
import { HelpRelevanceScorer } from './relevance-scorer';
import type {
  ConjugationErrorReport,
  AnalysisOptions,
  ErrorAnalysis,
  RankedHelp
} from './types';
import type { ExtendedConjugationForms } from '@/types/conjugation';
import type { JapaneseWord } from '@/types/drill';
import type { EnhancedJapaneseWord } from '@/utils/enhancedWordTypeDetection';

/**
 * Main entry point for conjugation error analysis
 * Analyzes user conjugation errors and provides smart help suggestions
 */
export class ConjugationErrorAnalyzer {
  /**
   * Analyze a conjugation error and generate help suggestions
   */
  static analyzeError(
    userInput: string,
    correctAnswer: string,
    attemptedForm: keyof ExtendedConjugationForms,
    word: JapaneseWord,
    options: AnalysisOptions = {}
  ): ConjugationErrorReport {
    // Merge with default options
    const opts: Required<AnalysisOptions> = {
      includeHelp: true,
      maxHelpItems: 1, // Only show THE MOST relevant help
      similarityThreshold: 0.3,
      considerRomaji: true,
      ...options
    };

    // Get all conjugations for this word
    const enhancedWord: EnhancedJapaneseWord = {
      ...word,
      conjugationType: word.type,
      isConjugatable: this.isConjugatable(word.type),
      typeConfidence: 'high'
    };

    const allConjugations = ExtendedConjugationEngine.conjugate(enhancedWord);

    // Classify the error
    const analysis = ConjugationErrorClassifier.classifyError(
      userInput,
      correctAnswer,
      attemptedForm,
      word,
      allConjugations
    );

    // Generate help suggestions if requested
    let relevantHelp: RankedHelp[] = [];
    let quickTip: string | undefined;
    let detailedExplanation: string | undefined;

    if (opts.includeHelp && analysis.similarityScore < 1.0) {
      relevantHelp = HelpRelevanceScorer.getRelevantHelp(analysis, opts.maxHelpItems);

      // Generate quick tip
      quickTip = this.generateQuickTip(analysis);

      // Generate detailed explanation
      detailedExplanation = this.generateDetailedExplanation(analysis, relevantHelp);
    }

    return {
      analysis,
      relevantHelp,
      quickTip,
      detailedExplanation
    };
  }

  /**
   * Generate a quick one-liner tip
   */
  private static generateQuickTip(analysis: ErrorAnalysis): string {
    switch (analysis.errorType) {
      case 'wrong-form':
        if (analysis.possibleInterpretation) {
          return `Hint: You used ${analysis.possibleInterpretation.detectedForm} form. Try ${analysis.attemptedForm} instead.`;
        }
        return `Hint: Double-check which conjugation form is needed for ${analysis.attemptedForm}.`;

      case 'wrong-verb-type':
        return `Hint: Check if this is a ${analysis.word.type} verb. The conjugation rules differ between Ichidan and Godan!`;

      case 'special-case':
        if (analysis.possibleInterpretation) {
          return `Hint: This word is a special exception! ${analysis.possibleInterpretation.explanation}`;
        }
        return `Hint: This word has a special conjugation rule. Check the exceptions!`;

      case 'okurigana-missing':
        return `Hint: Check the ${analysis.attemptedForm} form pattern for ${analysis.word.type} verbs.`;

      case 'close-match':
        if (analysis.similarityScore >= 0.9) {
          return `Almost perfect! You're very close. Double-check the ${analysis.attemptedForm} form.`;
        }
        return `Close! Review how to form ${analysis.attemptedForm} for ${analysis.word.type} verbs.`;

      case 'partial-correct':
        return `You're on the right track! Focus on the ${analysis.attemptedForm} form pattern.`;

      case 'completely-wrong':
        return `Study how ${analysis.word.type} verbs form the ${analysis.attemptedForm}.`;

      default:
        return `Review conjugation rules for ${analysis.word.type} verbs.`;
    }
  }

  /**
   * Generate detailed explanation with help content
   */
  private static generateDetailedExplanation(
    analysis: ErrorAnalysis,
    relevantHelp: RankedHelp[]
  ): string {
    const parts: string[] = [];

    // Add error-specific explanation
    if (analysis.possibleInterpretation) {
      parts.push(analysis.possibleInterpretation.explanation);
    }

    // Add similarity info for close matches
    if (analysis.errorType === 'close-match' && analysis.similarityScore >= 0.8) {
      parts.push(`Your answer was ${Math.round(analysis.similarityScore * 100)}% correct.`);
    }

    // Add help content titles
    if (relevantHelp.length > 0) {
      const helpTitles = relevantHelp.map((help, i) =>
        `${i + 1}. ${help.helpContent.emoji} ${help.helpContent.title}`
      ).join('\n');

      parts.push(`\nRelated help topics:\n${helpTitles}`);
    }

    return parts.join('\n\n');
  }

  /**
   * Check if word type is conjugatable
   */
  private static isConjugatable(type: string): boolean {
    return ['Ichidan', 'Godan', 'Irregular', 'i-adjective', 'na-adjective'].includes(type);
  }

  /**
   * Quick validation check - returns true if answer is correct
   */
  static isCorrect(userInput: string, correctAnswer: string): boolean {
    const normalizedInput = userInput.trim().toLowerCase();
    const normalizedCorrect = correctAnswer.trim().toLowerCase();
    return normalizedInput === normalizedCorrect;
  }
}

// Export for convenience
export { ConjugationErrorClassifier } from './error-classifier';
export { HelpRelevanceScorer } from './relevance-scorer';
export * from './types';
