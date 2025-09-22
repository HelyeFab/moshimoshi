/**
 * Kana-specific validator
 * Handles hiragana/katakana validation with romaji support
 */

import { BaseValidator, ValidationResult, ValidationOptions } from './base-validator';
import * as wanakana from 'wanakana';

interface KanaValidationOptions extends ValidationOptions {
  allowAlternateReadings?: boolean;
  acceptHiraganaForKatakana?: boolean;
  acceptKatakanaForHiragana?: boolean;
}

export class KanaValidator extends BaseValidator {
  private kanaOptions: KanaValidationOptions;
  
  constructor(options: KanaValidationOptions = {}) {
    super(options);
    this.kanaOptions = {
      allowAlternateReadings: true,
      acceptHiraganaForKatakana: false,
      acceptKatakanaForHiragana: false,
      ...options
    };
  }
  
  validate(
    userAnswer: string,
    correctAnswer: string | string[],
    context?: { kanaType?: 'hiragana' | 'katakana', romaji?: string }
  ): ValidationResult {
    const correctAnswers = Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer];
    const normalizedUser = this.normalizeKana(userAnswer);
    
    // Check for exact match first
    for (const answer of correctAnswers) {
      if (this.isExactKanaMatch(normalizedUser, answer)) {
        return {
          isCorrect: true,
          confidence: 1.0,
          feedback: "Perfect!"
        };
      }
    }
    
    // Check romaji conversion if allowed
    if (this.kanaOptions.allowRomaji && context?.romaji) {
      const romajiConverted = this.convertRomajiToKana(normalizedUser, context.kanaType);
      if (romajiConverted && correctAnswers.includes(romajiConverted)) {
        return {
          isCorrect: true,
          confidence: 0.95,
          feedback: "Correct! (Converted from romaji)"
        };
      }
    }
    
    // Check alternate script acceptance
    if (this.kanaOptions.acceptHiraganaForKatakana || this.kanaOptions.acceptKatakanaForHiragana) {
      const converted = this.convertKanaScript(normalizedUser, context?.kanaType);
      if (converted && correctAnswers.includes(converted)) {
        return {
          isCorrect: true,
          confidence: 0.9,
          feedback: `Correct! (Accepted ${context?.kanaType === 'hiragana' ? 'katakana' : 'hiragana'})`
        };
      }
    }
    
    // Check for close matches
    let bestMatch = { answer: '', similarity: 0 };
    for (const answer of correctAnswers) {
      const similarity = this.calculateSimilarity(normalizedUser, answer);
      if (similarity > bestMatch.similarity) {
        bestMatch = { answer, similarity };
      }
    }
    
    // Determine if it's close enough for partial credit
    if (bestMatch.similarity >= this.options.fuzzyThreshold!) {
      return {
        isCorrect: false,
        confidence: bestMatch.similarity,
        partialCredit: bestMatch.similarity * 0.5,
        feedback: this.generateKanaFeedback(normalizedUser, bestMatch.answer, bestMatch.similarity),
        corrections: this.identifyKanaCorrections(normalizedUser, bestMatch.answer),
        hints: this.generateKanaHints(bestMatch.answer, context)
      };
    }
    
    // Completely wrong
    return {
      isCorrect: false,
      confidence: bestMatch.similarity,
      feedback: "Incorrect. Review this character.",
      corrections: [`Correct answer: ${bestMatch.answer}`],
      hints: this.generateKanaHints(bestMatch.answer, context)
    };
  }
  
  private normalizeKana(text: string): string {
    let normalized = this.normalize(text);
    
    // Remove any spaces between kana characters
    normalized = normalized.replace(/([ぁ-んァ-ン])\s+([ぁ-んァ-ン])/g, '$1$2');
    
    // Normalize iteration marks
    normalized = normalized.replace(/ゝ/g, 'ゞ');
    normalized = normalized.replace(/ヽ/g, 'ヾ');
    
    return normalized;
  }
  
  private isExactKanaMatch(userAnswer: string, correctAnswer: string): boolean {
    const normalizedCorrect = this.normalizeKana(correctAnswer);
    return userAnswer === normalizedCorrect;
  }
  
  private convertRomajiToKana(
    text: string,
    targetType?: 'hiragana' | 'katakana'
  ): string | null {
    try {
      // Check if it's actually romaji
      if (!wanakana.isRomaji(text)) {
        return null;
      }
      
      if (targetType === 'katakana') {
        return wanakana.toKatakana(text);
      } else {
        return wanakana.toHiragana(text);
      }
    } catch {
      return null;
    }
  }
  
  private convertKanaScript(
    text: string,
    targetType?: 'hiragana' | 'katakana'
  ): string | null {
    try {
      if (targetType === 'hiragana' && wanakana.isKatakana(text)) {
        return wanakana.toHiragana(text);
      } else if (targetType === 'katakana' && wanakana.isHiragana(text)) {
        return wanakana.toKatakana(text);
      }
      return null;
    } catch {
      return null;
    }
  }
  
  private generateKanaFeedback(
    userAnswer: string,
    correctAnswer: string,
    similarity: number
  ): string {
    // Check for common kana confusion
    const confusionPairs = [
      ['ね', 'れ', 'わ'],
      ['ぬ', 'め'],
      ['は', 'ほ'],
      ['ろ', 'る'],
      ['シ', 'ツ'],
      ['ソ', 'ン'],
      ['ク', 'ケ', 'タ']
    ];
    
    for (const group of confusionPairs) {
      if (group.includes(userAnswer) && group.includes(correctAnswer)) {
        return `Careful! These characters look similar: ${group.join(', ')}`;
      }
    }
    
    return this.generateFeedback(userAnswer, correctAnswer, similarity);
  }
  
  private identifyKanaCorrections(userAnswer: string, correctAnswer: string): string[] {
    const corrections: string[] = [];
    
    // Check if wrong script was used
    if (wanakana.isHiragana(userAnswer) && wanakana.isKatakana(correctAnswer)) {
      corrections.push("Use katakana, not hiragana");
    } else if (wanakana.isKatakana(userAnswer) && wanakana.isHiragana(correctAnswer)) {
      corrections.push("Use hiragana, not katakana");
    }
    
    // Check for dakuten/handakuten mistakes
    const hasDakuten = (char: string) => /[がぎぐげござじずぜぞだぢづでどばびぶべぼガギグゲゴザジズゼゾダヂヅデドバビブベボ]/.test(char);
    const hasHandakuten = (char: string) => /[ぱぴぷぺぽパピプペポ]/.test(char);
    
    if (hasDakuten(correctAnswer) && !hasDakuten(userAnswer)) {
      corrections.push("Missing dakuten (゛)");
    } else if (hasHandakuten(correctAnswer) && !hasHandakuten(userAnswer)) {
      corrections.push("Missing handakuten (゜)");
    }
    
    return corrections;
  }
  
  private generateKanaHints(
    correctAnswer: string,
    context?: { kanaType?: 'hiragana' | 'katakana', romaji?: string }
  ): string[] {
    const hints: string[] = [];
    
    if (context?.romaji) {
      hints.push(`Romaji: ${context.romaji}`);
    }
    
    // Add stroke count hint for complex characters
    const complexKana = ['ぬ', 'め', 'あ', 'お', 'ヌ', 'メ', 'ア', 'オ'];
    if (complexKana.includes(correctAnswer)) {
      hints.push("This character has multiple strokes");
    }
    
    // Add shape hints
    if (['ま', 'も', 'マ', 'モ'].includes(correctAnswer)) {
      hints.push("Look for horizontal lines");
    } else if (['く', 'へ', 'ク', 'ヘ'].includes(correctAnswer)) {
      hints.push("Simple angular shape");
    }
    
    return hints;
  }
}