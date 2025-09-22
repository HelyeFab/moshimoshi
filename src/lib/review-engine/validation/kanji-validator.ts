/**
 * Kanji-specific validator
 * Handles kanji readings (on'yomi, kun'yomi) and meanings
 */

import { BaseValidator, ValidationResult, ValidationOptions } from './base-validator';

interface KanjiValidationOptions extends ValidationOptions {
  acceptMultipleReadings?: boolean;
  requireExactOkurigana?: boolean;
  acceptSynonyms?: boolean;
  checkStrokeOrder?: boolean;
}

interface KanjiContext {
  validationType: 'meaning' | 'onyomi' | 'kunyomi' | 'writing';
  kanji: string;
  readings?: {
    onyomi?: string[];
    kunyomi?: string[];
  };
  meanings?: string[];
  synonyms?: string[];
}

export class KanjiValidator extends BaseValidator {
  private kanjiOptions: KanjiValidationOptions;
  
  constructor(options: KanjiValidationOptions = {}) {
    super(options);
    this.kanjiOptions = {
      acceptMultipleReadings: true,
      requireExactOkurigana: false,
      acceptSynonyms: true,
      checkStrokeOrder: false,
      ...options
    };
  }
  
  validate(
    userAnswer: string,
    correctAnswer: string | string[],
    context?: KanjiContext
  ): ValidationResult {
    if (!context) {
      // Fallback to basic string comparison
      return this.compareStrings(userAnswer, correctAnswer);
    }
    
    switch (context.validationType) {
      case 'meaning':
        return this.validateMeaning(userAnswer, correctAnswer, context);
      case 'onyomi':
        return this.validateReading(userAnswer, context.readings?.onyomi || [], 'onyomi');
      case 'kunyomi':
        return this.validateReading(userAnswer, context.readings?.kunyomi || [], 'kunyomi');
      case 'writing':
        return this.validateWriting(userAnswer, context.kanji);
      default:
        // Fallback to basic string comparison
        return this.compareStrings(userAnswer, correctAnswer);
    }
  }
  
  private validateMeaning(
    userAnswer: string,
    correctAnswers: string | string[],
    context: KanjiContext
  ): ValidationResult {
    const answers = Array.isArray(correctAnswers) ? correctAnswers : [correctAnswers];
    const normalizedUser = this.normalize(userAnswer);
    
    // Check exact match
    for (const answer of answers) {
      if (this.isExactMatch(normalizedUser, answer)) {
        return {
          isCorrect: true,
          confidence: 1.0,
          feedback: "Correct!"
        };
      }
    }
    
    // Check synonyms if allowed
    if (this.kanjiOptions.acceptSynonyms && context.synonyms) {
      for (const synonym of context.synonyms) {
        if (this.isExactMatch(normalizedUser, synonym)) {
          return {
            isCorrect: true,
            confidence: 0.95,
            feedback: "Correct! (Synonym accepted)"
          };
        }
      }
    }
    
    // Check for partial matches in meaning
    const partialMatches = this.checkPartialMeaning(normalizedUser, answers);
    if (partialMatches.length > 0) {
      return {
        isCorrect: false,
        confidence: 0.7,
        partialCredit: 0.5,
        feedback: "Partially correct - you got the general idea!",
        corrections: [`More precise: ${partialMatches[0]}`],
        hints: this.generateMeaningHints(answers[0], context)
      };
    }
    
    // Check similarity
    let bestMatch = { answer: '', similarity: 0 };
    for (const answer of answers) {
      const similarity = this.calculateSimilarity(normalizedUser, answer);
      if (similarity > bestMatch.similarity) {
        bestMatch = { answer, similarity };
      }
    }
    
    if (bestMatch.similarity >= 0.7) {
      return {
        isCorrect: false,
        confidence: bestMatch.similarity,
        partialCredit: bestMatch.similarity * 0.3,
        feedback: "Close! Check your spelling.",
        corrections: this.identifyCorrections(normalizedUser, bestMatch.answer),
        hints: this.generateMeaningHints(bestMatch.answer, context)
      };
    }
    
    return {
      isCorrect: false,
      confidence: 0,
      feedback: "Incorrect. Study this kanji's meaning.",
      corrections: [`Correct answer: ${answers[0]}`],
      hints: this.generateMeaningHints(answers[0], context)
    };
  }
  
  private validateReading(
    userAnswer: string,
    correctReadings: string[],
    readingType: 'onyomi' | 'kunyomi'
  ): ValidationResult {
    const normalizedUser = this.normalizeReading(userAnswer);
    
    // Check exact match
    for (const reading of correctReadings) {
      const normalizedReading = this.normalizeReading(reading);
      if (normalizedUser === normalizedReading) {
        return {
          isCorrect: true,
          confidence: 1.0,
          feedback: `Correct ${readingType}!`
        };
      }
    }
    
    // Check without okurigana if allowed
    if (!this.kanjiOptions.requireExactOkurigana && readingType === 'kunyomi') {
      for (const reading of correctReadings) {
        const withoutOkurigana = this.removeOkurigana(reading);
        if (normalizedUser === withoutOkurigana) {
          return {
            isCorrect: true,
            confidence: 0.9,
            feedback: "Correct! (Okurigana omitted is OK)",
            hints: [`Full reading: ${reading}`]
          };
        }
      }
    }
    
    // Check for romaji input
    const hiraganaConverted = this.convertRomajiToHiragana(normalizedUser);
    if (hiraganaConverted) {
      for (const reading of correctReadings) {
        if (hiraganaConverted === this.normalizeReading(reading)) {
          return {
            isCorrect: true,
            confidence: 0.95,
            feedback: "Correct! (Converted from romaji)"
          };
        }
      }
    }
    
    // Check similarity
    let bestMatch = { reading: '', similarity: 0 };
    for (const reading of correctReadings) {
      const similarity = this.calculateSimilarity(normalizedUser, this.normalizeReading(reading));
      if (similarity > bestMatch.similarity) {
        bestMatch = { reading, similarity };
      }
    }
    
    if (bestMatch.similarity >= 0.8) {
      return {
        isCorrect: false,
        confidence: bestMatch.similarity,
        partialCredit: bestMatch.similarity * 0.4,
        feedback: this.generateReadingFeedback(normalizedUser, bestMatch.reading, readingType),
        corrections: this.identifyReadingCorrections(normalizedUser, bestMatch.reading),
        hints: [`Correct ${readingType}: ${bestMatch.reading}`]
      };
    }
    
    return {
      isCorrect: false,
      confidence: 0,
      feedback: `Incorrect ${readingType} reading.`,
      corrections: [`Correct ${readingType}: ${correctReadings.join(', ')}`],
      hints: this.generateReadingHints(correctReadings[0], readingType)
    };
  }
  
  private validateWriting(userAnswer: string, correctKanji: string): ValidationResult {
    // For writing validation, we'd need stroke order data
    // This is a simplified version
    if (userAnswer === correctKanji) {
      return {
        isCorrect: true,
        confidence: 1.0,
        feedback: "Perfect kanji writing!"
      };
    }
    
    return {
      isCorrect: false,
      confidence: 0,
      feedback: "Incorrect kanji.",
      corrections: [`Correct kanji: ${correctKanji}`]
    };
  }
  
  private normalizeReading(reading: string): string {
    let normalized = reading.trim();
    
    // Convert katakana to hiragana for comparison
    normalized = this.katakanaToHiragana(normalized);
    
    // Remove common reading markers
    normalized = normalized.replace(/[-.·]/g, '');
    
    // Remove parentheses content (often okurigana)
    normalized = normalized.replace(/[()（）]/g, '');
    
    return normalized;
  }
  
  private removeOkurigana(reading: string): string {
    // Remove hiragana that comes after kanji reading
    return reading.replace(/\.[ぁ-ん]+$/, '');
  }
  
  private katakanaToHiragana(text: string): string {
    return text.replace(/[\u30A1-\u30FA]/g, (match) => {
      return String.fromCharCode(match.charCodeAt(0) - 0x60);
    });
  }
  
  private convertRomajiToHiragana(text: string): string | null {
    // Simplified romaji to hiragana conversion
    // In production, use wanakana or similar library
    const romajiMap: { [key: string]: string } = {
      'a': 'あ', 'i': 'い', 'u': 'う', 'e': 'え', 'o': 'お',
      'ka': 'か', 'ki': 'き', 'ku': 'く', 'ke': 'け', 'ko': 'こ',
      // ... add more mappings
    };
    
    // This is a placeholder - use proper conversion library
    return null;
  }
  
  private checkPartialMeaning(userAnswer: string, meanings: string[]): string[] {
    const matches: string[] = [];
    
    for (const meaning of meanings) {
      const meaningWords = meaning.toLowerCase().split(/\s+/);
      const userWords = userAnswer.toLowerCase().split(/\s+/);
      
      // Check if user answer contains key words from the meaning
      const commonWords = userWords.filter(word => 
        meaningWords.includes(word) && word.length > 3
      );
      
      if (commonWords.length > 0) {
        matches.push(meaning);
      }
    }
    
    return matches;
  }
  
  private generateMeaningHints(meaning: string, context: KanjiContext): string[] {
    const hints: string[] = [];
    
    // Add word type hint
    if (meaning.includes('to ')) {
      hints.push("This is a verb");
    } else if (meaning.match(/\b(a|an)\b/)) {
      hints.push("This is a noun");
    }
    
    // Add category hints based on kanji components
    // This would need a proper radical/component database
    if (context.kanji) {
      if (context.kanji.includes('水') || context.kanji.includes('氵')) {
        hints.push("Related to water");
      } else if (context.kanji.includes('火') || context.kanji.includes('灬')) {
        hints.push("Related to fire");
      } else if (context.kanji.includes('木')) {
        hints.push("Related to trees/wood");
      }
    }
    
    return hints;
  }
  
  private generateReadingFeedback(
    userAnswer: string,
    correctReading: string,
    readingType: string
  ): string {
    const userLen = userAnswer.length;
    const correctLen = correctReading.length;
    
    if (userLen < correctLen) {
      return `Too short - the ${readingType} has ${correctLen} syllables`;
    } else if (userLen > correctLen) {
      return `Too long - the ${readingType} has ${correctLen} syllables`;
    } else {
      return `Close! Check each syllable carefully`;
    }
  }
  
  private identifyReadingCorrections(userAnswer: string, correctReading: string): string[] {
    const corrections: string[] = [];
    
    // Check for common reading mistakes
    if (userAnswer.includes('つ') && correctReading.includes('っ')) {
      corrections.push("Use small っ (double consonant)");
    }
    
    if (userAnswer.includes('や') && correctReading.includes('ゃ')) {
      corrections.push("Use small ゃ for 'ya' sound");
    }
    
    if (userAnswer.includes('ゆ') && correctReading.includes('ゅ')) {
      corrections.push("Use small ゅ for 'yu' sound");
    }
    
    if (userAnswer.includes('よ') && correctReading.includes('ょ')) {
      corrections.push("Use small ょ for 'yo' sound");
    }
    
    return corrections;
  }
  
  private generateReadingHints(reading: string, readingType: string): string[] {
    const hints: string[] = [];
    
    if (readingType === 'onyomi') {
      hints.push("On'yomi (Chinese reading) - often used in compounds");
      if (reading.length <= 2) {
        hints.push("Short reading (1-2 syllables)");
      }
    } else {
      hints.push("Kun'yomi (Japanese reading) - often used alone");
      if (reading.includes('.')) {
        hints.push("Has okurigana (hiragana ending)");
      }
    }
    
    // Syllable count hint
    const syllableCount = reading.replace(/[ゃゅょぁぃぅぇぉ]/g, '').length;
    hints.push(`${syllableCount} syllable${syllableCount !== 1 ? 's' : ''}`);
    
    return hints;
  }
  
  private compareStrings(userAnswer: string, correctAnswer: string | string[]): ValidationResult {
    const normalizedUser = this.normalize(userAnswer);
    const correctAnswers = Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer];
    
    for (const answer of correctAnswers) {
      const normalizedCorrect = this.normalize(answer);
      if (normalizedUser === normalizedCorrect) {
        return {
          isCorrect: true,
          confidence: 1,
          feedback: 'Correct!'
        };
      }
    }
    
    return {
      isCorrect: false,
      confidence: 0,
      feedback: `Expected: ${correctAnswers.join(' or ')}`
    };
  }
}