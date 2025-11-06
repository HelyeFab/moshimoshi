/**
 * Conjugation Error Classifier
 *
 * Classifies conjugation errors into specific types and detects
 * what the user might have been attempting.
 */

import { ValidationUtils } from '@/lib/review-engine/validation/validation-utils';
import type {
  ErrorType,
  ErrorAnalysis
} from './types';
import type { ExtendedConjugationForms } from '@/types/conjugation';
import type { JapaneseWord } from '@/types/drill';

/**
 * Classifies conjugation errors into specific types
 */
export class ConjugationErrorClassifier {
  /**
   * Classify the type of error made by the user
   */
  static classifyError(
    userInput: string,
    correctAnswer: string,
    attemptedForm: keyof ExtendedConjugationForms,
    word: JapaneseWord,
    allConjugations: ExtendedConjugationForms
  ): ErrorAnalysis {
    // Normalize inputs for comparison
    const normalizedInput = this.normalizeJapanese(userInput);
    const normalizedCorrect = this.normalizeJapanese(correctAnswer);

    // Calculate similarity metrics
    const distance = ValidationUtils.editDistance(normalizedInput, normalizedCorrect);
    const similarity = ValidationUtils.similarity(normalizedInput, normalizedCorrect);

    // Check for exact match (user is correct!)
    if (normalizedInput === normalizedCorrect) {
      return {
        userInput,
        correctAnswer,
        attemptedForm,
        word,
        errorType: 'close-match',
        confidence: 1.0,
        levenshteinDistance: 0,
        similarityScore: 1.0
      };
    }

    // Check for special case errors FIRST (行く, いい, ある, etc.)
    // These take precedence over other error types
    const specialCase = this.detectSpecialCaseError(normalizedInput, normalizedCorrect, word);
    if (specialCase) {
      return {
        userInput,
        correctAnswer,
        attemptedForm,
        word,
        errorType: 'special-case',
        confidence: 0.85,
        levenshteinDistance: distance,
        similarityScore: similarity,
        possibleInterpretation: specialCase
      };
    }

    // Check if user entered a different valid conjugation form
    const detectedForm = this.detectConjugationForm(normalizedInput, allConjugations);
    if (detectedForm) {
      return {
        userInput,
        correctAnswer,
        attemptedForm,
        word,
        errorType: 'wrong-form',
        confidence: 0.9,
        levenshteinDistance: distance,
        similarityScore: similarity,
        possibleInterpretation: {
          detectedForm: detectedForm.formName,
          explanation: `You entered the ${detectedForm.formName} form instead of ${attemptedForm}`
        },
        closestWrongForm: detectedForm
      };
    }

    // Check for verb type confusion
    if (this.isVerbTypeConfusion(normalizedInput, word, attemptedForm)) {
      return {
        userInput,
        correctAnswer,
        attemptedForm,
        word,
        errorType: 'wrong-verb-type',
        confidence: 0.8,
        levenshteinDistance: distance,
        similarityScore: similarity
      };
    }

    // Check for okurigana issues
    if (this.hasOkuriganaIssue(normalizedInput, normalizedCorrect)) {
      return {
        userInput,
        correctAnswer,
        attemptedForm,
        word,
        errorType: 'okurigana-missing',
        confidence: 0.75,
        levenshteinDistance: distance,
        similarityScore: similarity
      };
    }

    // Close match (typo-level error)
    if (similarity >= 0.7) {
      return {
        userInput,
        correctAnswer,
        attemptedForm,
        word,
        errorType: 'close-match',
        confidence: 0.7,
        levenshteinDistance: distance,
        similarityScore: similarity
      };
    }

    // Partial correctness
    if (similarity >= 0.4) {
      return {
        userInput,
        correctAnswer,
        attemptedForm,
        word,
        errorType: 'partial-correct',
        confidence: 0.6,
        levenshteinDistance: distance,
        similarityScore: similarity
      };
    }

    // Completely wrong
    return {
      userInput,
      correctAnswer,
      attemptedForm,
      word,
      errorType: 'completely-wrong',
      confidence: 0.5,
      levenshteinDistance: distance,
      similarityScore: similarity
    };
  }

  /**
   * Detect which conjugation form the user actually entered
   */
  private static detectConjugationForm(
    userInput: string,
    allConjugations: ExtendedConjugationForms
  ): { formName: keyof ExtendedConjugationForms; value: string; similarity: number } | null {
    let bestMatch: { formName: keyof ExtendedConjugationForms; value: string; similarity: number } | null = null;
    let highestSimilarity = 0;

    // Check all conjugation forms
    for (const [formName, value] of Object.entries(allConjugations)) {
      if (!value || typeof value !== 'string') continue;

      const normalized = this.normalizeJapanese(value);
      const similarity = ValidationUtils.similarity(userInput, normalized);

      // Exact match
      if (similarity === 1.0) {
        return {
          formName: formName as keyof ExtendedConjugationForms,
          value,
          similarity: 1.0
        };
      }

      // Track best match
      if (similarity > highestSimilarity && similarity >= 0.85) {
        highestSimilarity = similarity;
        bestMatch = {
          formName: formName as keyof ExtendedConjugationForms,
          value,
          similarity
        };
      }
    }

    return bestMatch;
  }

  /**
   * Check if error is due to verb type confusion (Godan vs Ichidan)
   */
  private static isVerbTypeConfusion(
    userInput: string,
    word: JapaneseWord,
    attemptedForm: keyof ExtendedConjugationForms
  ): boolean {
    // Check for common Godan/Ichidan confusion patterns
    const godanPatterns = ['わない', 'いない', 'える', 'った', 'いて'];
    const ichidanPatterns = ['ない', 'られる', 'た', 'て'];

    // If it's an Ichidan verb and user used Godan pattern
    if (word.type === 'Ichidan' && godanPatterns.some(p => userInput.includes(p))) {
      return true;
    }

    // If it's a Godan verb and user used Ichidan pattern
    if (word.type === 'Godan' && ichidanPatterns.some(p => userInput.endsWith(p))) {
      // Make sure it's not just a coincidence (e.g., negative form ending in ない)
      // Check if the stem is wrong
      const stem = userInput.replace(/ない$|られる$|た$|て$/, '');
      if (stem && stem.length > 0) {
        return true;
      }
    }

    return false;
  }

  /**
   * Detect special case errors (行く, いい, ある, etc.)
   */
  private static detectSpecialCaseError(
    userInput: string,
    correctAnswer: string,
    word: JapaneseWord
  ): { detectedForm: string; explanation: string } | null {
    // 行く exception (te-form and past)
    if (word.kanji === '行く' || word.kana === 'いく') {
      if (userInput.includes('行いて') || userInput.includes('いいて') ||
          userInput.includes('行きて') || userInput.includes('いきて')) {
        return {
          detectedForm: 'teForm',
          explanation: '行く is a special exception! Use 行って (not 行いて or 行きて)'
        };
      }
      if (userInput.includes('行いた') || userInput.includes('いいた') ||
          userInput.includes('行きた') || userInput.includes('いきた')) {
        return {
          detectedForm: 'past',
          explanation: '行く has an irregular past form! Use 行った (not 行いた or 行きた)'
        };
      }
    }

    // いい exception
    if (word.kanji === 'いい' || word.kanji === '良い' || word.kana === 'いい') {
      if (userInput.includes('いかった')) {
        return {
          detectedForm: 'past',
          explanation: 'いい is irregular! Use よかった (not いかった)'
        };
      }
      if (userInput.includes('いくない')) {
        return {
          detectedForm: 'negative',
          explanation: 'いい is irregular! Use よくない (not いくない)'
        };
      }
      if (userInput.includes('いくて')) {
        return {
          detectedForm: 'teForm',
          explanation: 'いい is irregular! Use よくて (not いくて)'
        };
      }
    }

    // ある no ている form
    if (word.kana === 'ある' || word.kanji === 'ある') {
      if (userInput.includes('あっている') || userInput.includes('あってる')) {
        return {
          detectedForm: 'progressive',
          explanation: 'ある doesn\'t use ている form (it already means "exists")'
        };
      }
    }

    return null;
  }

  /**
   * Check for okurigana issues
   */
  private static hasOkuriganaIssue(userInput: string, correctAnswer: string): boolean {
    // Check if the kanji part matches but kana part differs
    const userKanji = this.extractKanji(userInput);
    const correctKanji = this.extractKanji(correctAnswer);

    // Same kanji, different kana = likely okurigana issue
    if (userKanji && correctKanji && userKanji === correctKanji && userInput !== correctAnswer) {
      return true;
    }

    return false;
  }

  /**
   * Extract kanji from text
   */
  private static extractKanji(text: string): string {
    return text.match(/[\u4E00-\u9FAF]+/g)?.join('') || '';
  }

  /**
   * Normalize Japanese text for comparison
   */
  private static normalizeJapanese(text: string): string {
    return ValidationUtils.normalizeJapanese(text);
  }
}
