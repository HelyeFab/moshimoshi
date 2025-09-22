/**
 * Vocabulary-specific validator
 * Handles word validation with multiple acceptable forms
 */

import { BaseValidator, ValidationResult, ValidationOptions } from './base-validator';

interface VocabularyValidationOptions extends ValidationOptions {
  acceptAlternativeForms?: boolean;
  acceptSynonyms?: boolean;
  requireParticles?: boolean;
  checkGrammar?: boolean;
}

interface VocabularyContext {
  word: string;
  reading?: string;
  meanings: string[];
  partOfSpeech?: string;
  alternativeForms?: string[];
  synonyms?: string[];
  validationType: 'meaning' | 'reading' | 'kanji' | 'usage';
  exampleSentence?: string;
}

export class VocabularyValidator extends BaseValidator {
  private vocabOptions: VocabularyValidationOptions;
  
  constructor(options: VocabularyValidationOptions = {}) {
    super(options);
    this.vocabOptions = {
      acceptAlternativeForms: true,
      acceptSynonyms: true,
      requireParticles: false,
      checkGrammar: false,
      ...options
    };
  }
  
  validate(
    userAnswer: string,
    correctAnswer: string | string[],
    context?: VocabularyContext
  ): ValidationResult {
    if (!context) {
      // Fallback to basic string comparison
      return this.compareStrings(userAnswer, correctAnswer);
    }
    
    switch (context.validationType) {
      case 'meaning':
        return this.validateMeaning(userAnswer, context);
      case 'reading':
        return this.validateReading(userAnswer, context);
      case 'kanji':
        return this.validateKanji(userAnswer, context);
      case 'usage':
        return this.validateUsage(userAnswer, context);
      default:
        // Fallback to basic string comparison
        return this.compareStrings(userAnswer, correctAnswer);
    }
  }
  
  private validateMeaning(
    userAnswer: string,
    context: VocabularyContext
  ): ValidationResult {
    const normalizedUser = this.normalizeMeaning(userAnswer);
    
    // Check primary meanings
    for (const meaning of context.meanings) {
      const normalizedMeaning = this.normalizeMeaning(meaning);
      if (this.isMeaningMatch(normalizedUser, normalizedMeaning)) {
        return {
          isCorrect: true,
          confidence: 1.0,
          feedback: "Correct!"
        };
      }
    }
    
    // Check synonyms
    if (this.vocabOptions.acceptSynonyms && context.synonyms) {
      for (const synonym of context.synonyms) {
        if (this.isMeaningMatch(normalizedUser, this.normalizeMeaning(synonym))) {
          return {
            isCorrect: true,
            confidence: 0.95,
            feedback: "Correct! (Synonym accepted)"
          };
        }
      }
    }
    
    // Check for partial understanding
    const partialScore = this.assessPartialMeaning(normalizedUser, context.meanings);
    if (partialScore > 0.6) {
      return {
        isCorrect: false,
        confidence: partialScore,
        partialCredit: partialScore * 0.5,
        feedback: this.generateMeaningFeedback(partialScore, context),
        corrections: this.suggestMeaningCorrections(normalizedUser, context.meanings),
        hints: this.generateVocabHints(context)
      };
    }
    
    // Wrong answer
    return {
      isCorrect: false,
      confidence: 0,
      feedback: "Incorrect meaning.",
      corrections: [`Correct meaning: ${context.meanings[0]}`],
      hints: this.generateVocabHints(context)
    };
  }
  
  private validateReading(
    userAnswer: string,
    context: VocabularyContext
  ): ValidationResult {
    if (!context.reading) {
      return {
        isCorrect: false,
        confidence: 0,
        feedback: "No reading available for this word."
      };
    }
    
    const normalizedUser = this.normalizeJapanese(userAnswer);
    const normalizedReading = this.normalizeJapanese(context.reading);
    
    // Exact match
    if (normalizedUser === normalizedReading) {
      return {
        isCorrect: true,
        confidence: 1.0,
        feedback: "Perfect reading!"
      };
    }
    
    // Check without particles if allowed
    if (!this.vocabOptions.requireParticles) {
      const withoutParticles = this.removeParticles(normalizedUser);
      if (withoutParticles === this.removeParticles(normalizedReading)) {
        return {
          isCorrect: true,
          confidence: 0.95,
          feedback: "Correct! (Particles optional)"
        };
      }
    }
    
    // Check alternative forms
    if (this.vocabOptions.acceptAlternativeForms && context.alternativeForms) {
      for (const altForm of context.alternativeForms) {
        if (normalizedUser === this.normalizeJapanese(altForm)) {
          return {
            isCorrect: true,
            confidence: 0.9,
            feedback: "Correct! (Alternative form accepted)"
          };
        }
      }
    }
    
    // Calculate similarity
    const similarity = this.calculateSimilarity(normalizedUser, normalizedReading);
    if (similarity >= 0.8) {
      return {
        isCorrect: false,
        confidence: similarity,
        partialCredit: similarity * 0.4,
        feedback: "Almost correct! Check your spelling.",
        corrections: this.identifyReadingErrors(normalizedUser, normalizedReading),
        hints: [`Correct reading: ${context.reading}`]
      };
    }
    
    return {
      isCorrect: false,
      confidence: 0,
      feedback: "Incorrect reading.",
      corrections: [`Correct reading: ${context.reading}`],
      hints: this.generateReadingHints(context)
    };
  }
  
  private validateKanji(
    userAnswer: string,
    context: VocabularyContext
  ): ValidationResult {
    const normalizedUser = this.normalize(userAnswer);
    const normalizedWord = this.normalize(context.word);
    
    if (normalizedUser === normalizedWord) {
      return {
        isCorrect: true,
        confidence: 1.0,
        feedback: "Perfect!"
      };
    }
    
    // Check alternative forms
    if (this.vocabOptions.acceptAlternativeForms && context.alternativeForms) {
      for (const altForm of context.alternativeForms) {
        if (normalizedUser === this.normalize(altForm)) {
          return {
            isCorrect: true,
            confidence: 0.95,
            feedback: "Correct! (Alternative kanji form)"
          };
        }
      }
    }
    
    // Check if only kana was used (when kanji expected)
    if (this.isOnlyKana(normalizedUser) && this.hasKanji(context.word)) {
      return {
        isCorrect: false,
        confidence: 0.3,
        feedback: "Use kanji, not just kana",
        corrections: [`Write in kanji: ${context.word}`],
        hints: this.generateKanjiHints(context)
      };
    }
    
    return {
      isCorrect: false,
      confidence: 0,
      feedback: "Incorrect kanji.",
      corrections: [`Correct: ${context.word}`],
      hints: this.generateKanjiHints(context)
    };
  }
  
  private validateUsage(
    userAnswer: string,
    context: VocabularyContext
  ): ValidationResult {
    if (!context.exampleSentence) {
      return {
        isCorrect: false,
        confidence: 0,
        feedback: "No example sentence available."
      };
    }
    
    const normalizedUser = this.normalizeJapanese(userAnswer);
    
    // Check if the word is used correctly in context
    if (!normalizedUser.includes(context.word) && !normalizedUser.includes(context.reading || '')) {
      return {
        isCorrect: false,
        confidence: 0,
        feedback: "The word is not used in your sentence.",
        hints: [`Use "${context.word}" in your sentence`]
      };
    }
    
    // Check grammar if enabled
    if (this.vocabOptions.checkGrammar) {
      const grammarScore = this.assessGrammar(normalizedUser, context);
      if (grammarScore < 0.7) {
        return {
          isCorrect: false,
          confidence: grammarScore,
          partialCredit: grammarScore * 0.3,
          feedback: "Grammar needs improvement.",
          corrections: this.suggestGrammarCorrections(normalizedUser, context),
          hints: [`Example: ${context.exampleSentence}`]
        };
      }
    }
    
    return {
      isCorrect: true,
      confidence: 1.0,
      feedback: "Great usage!"
    };
  }
  
  private normalizeMeaning(text: string): string {
    let normalized = this.normalize(text);
    
    // Remove articles
    normalized = normalized.replace(/\b(a|an|the)\b/g, '');
    
    // Remove "to" from verb infinitives
    normalized = normalized.replace(/^to\s+/, '');
    
    // Trim and collapse spaces
    normalized = normalized.replace(/\s+/g, ' ').trim();
    
    return normalized;
  }
  
  private normalizeJapanese(text: string): string {
    let normalized = text.trim();
    
    // Convert full-width characters to half-width
    normalized = normalized.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => {
      return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
    });
    
    // Normalize long vowel marks
    normalized = normalized.replace(/ー/g, 'ー');
    
    return normalized;
  }
  
  private isMeaningMatch(userAnswer: string, meaning: string): boolean {
    // Exact match after normalization
    if (userAnswer === meaning) return true;
    
    // Check if all key words are present
    const meaningWords = meaning.split(' ').filter(w => w.length > 2);
    const userWords = userAnswer.split(' ');
    
    const matchedWords = meaningWords.filter(word => 
      userWords.some(userWord => 
        userWord === word || 
        (userWord.length > 3 && word.includes(userWord)) ||
        (word.length > 3 && userWord.includes(word))
      )
    );
    
    return matchedWords.length >= meaningWords.length * 0.7;
  }
  
  private assessPartialMeaning(userAnswer: string, meanings: string[]): number {
    let bestScore = 0;
    
    for (const meaning of meanings) {
      const meaningWords = meaning.toLowerCase().split(' ').filter(w => w.length > 2);
      const userWords = userAnswer.toLowerCase().split(' ');
      
      // Calculate overlap
      const commonWords = userWords.filter(word => 
        meaningWords.some(mWord => 
          word === mWord || 
          (word.length > 3 && mWord.includes(word)) ||
          (mWord.length > 3 && word.includes(mWord))
        )
      );
      
      const score = commonWords.length / Math.max(meaningWords.length, userWords.length);
      bestScore = Math.max(bestScore, score);
    }
    
    return bestScore;
  }
  
  private removeParticles(text: string): string {
    // Remove common Japanese particles
    const particles = ['は', 'が', 'を', 'に', 'へ', 'で', 'と', 'から', 'まで', 'より', 'の'];
    let result = text;
    
    for (const particle of particles) {
      result = result.replace(new RegExp(particle, 'g'), '');
    }
    
    return result;
  }
  
  private isOnlyKana(text: string): boolean {
    return /^[ぁ-んァ-ヶー]+$/.test(text);
  }
  
  private hasKanji(text: string): boolean {
    return /[\u4E00-\u9FAF]/.test(text);
  }
  
  private identifyReadingErrors(userAnswer: string, correctReading: string): string[] {
    const errors: string[] = [];
    
    // Check for common particle errors
    if (userAnswer.includes('わ') && correctReading.includes('は')) {
      errors.push("Use は (wa) as particle, not わ");
    }
    
    if (userAnswer.includes('お') && correctReading.includes('を')) {
      errors.push("Use を (wo) as particle, not お");
    }
    
    // Check for long vowel errors
    if (userAnswer.includes('う') && correctReading.includes('ー')) {
      errors.push("Use ー for long vowels in katakana");
    }
    
    return errors;
  }
  
  private assessGrammar(sentence: string, context: VocabularyContext): number {
    // Simplified grammar assessment
    // In production, use a proper Japanese grammar checker
    
    let score = 1.0;
    
    // Check for basic sentence structure
    if (!sentence.match(/[。！？]$/)) {
      score -= 0.1; // Missing punctuation
    }
    
    // Check particle usage based on part of speech
    if (context.partOfSpeech === 'verb' && !sentence.match(/[をがは]/)) {
      score -= 0.2; // Missing particles for verb usage
    }
    
    // Check word order (simplified)
    const wordPosition = sentence.indexOf(context.word);
    const sentenceLength = sentence.length;
    
    if (context.partOfSpeech === 'verb' && wordPosition < sentenceLength * 0.5) {
      score -= 0.2; // Verb should typically be later in sentence
    }
    
    return Math.max(0, score);
  }
  
  private suggestMeaningCorrections(userAnswer: string, meanings: string[]): string[] {
    const corrections: string[] = [];
    
    // Find the closest meaning
    let closestMeaning = meanings[0];
    let highestSimilarity = 0;
    
    for (const meaning of meanings) {
      const similarity = this.calculateSimilarity(userAnswer, meaning);
      if (similarity > highestSimilarity) {
        highestSimilarity = similarity;
        closestMeaning = meaning;
      }
    }
    
    corrections.push(`Did you mean: ${closestMeaning}?`);
    
    if (meanings.length > 1) {
      corrections.push(`Other meanings: ${meanings.slice(1).join(', ')}`);
    }
    
    return corrections;
  }
  
  private suggestGrammarCorrections(sentence: string, context: VocabularyContext): string[] {
    const corrections: string[] = [];
    
    if (!sentence.match(/[。！？]$/)) {
      corrections.push("Add punctuation at the end");
    }
    
    if (context.partOfSpeech === 'verb' && !sentence.includes('を')) {
      corrections.push("Consider using を particle with this verb");
    }
    
    return corrections;
  }
  
  private generateMeaningFeedback(score: number, context: VocabularyContext): string {
    if (score >= 0.9) return "Almost perfect! Just a minor detail missing.";
    if (score >= 0.8) return "Very close! You understand the concept.";
    if (score >= 0.7) return "Good understanding, but not quite precise.";
    if (score >= 0.6) return "Partial understanding. Review the exact meaning.";
    return "Review this word's meaning carefully.";
  }
  
  private generateVocabHints(context: VocabularyContext): string[] {
    const hints: string[] = [];
    
    if (context.partOfSpeech) {
      hints.push(`Part of speech: ${context.partOfSpeech}`);
    }
    
    if (context.meanings.length > 0) {
      const firstLetter = context.meanings[0].charAt(0).toUpperCase();
      hints.push(`Starts with: ${firstLetter}...`);
    }
    
    if (context.word.length) {
      hints.push(`${context.word.length} characters long`);
    }
    
    return hints;
  }
  
  private generateReadingHints(context: VocabularyContext): string[] {
    const hints: string[] = [];
    
    if (context.reading) {
      const syllableCount = context.reading.replace(/[ゃゅょ]/g, '').length;
      hints.push(`${syllableCount} syllables`);
      
      if (context.reading.includes('っ')) {
        hints.push("Contains a double consonant (っ)");
      }
      
      if (context.reading.match(/[ゃゅょ]/)) {
        hints.push("Contains a contracted sound (ゃ/ゅ/ょ)");
      }
    }
    
    return hints;
  }
  
  private generateKanjiHints(context: VocabularyContext): string[] {
    const hints: string[] = [];
    
    const kanjiCount = (context.word.match(/[\u4E00-\u9FAF]/g) || []).length;
    if (kanjiCount > 0) {
      hints.push(`Contains ${kanjiCount} kanji character${kanjiCount !== 1 ? 's' : ''}`);
    }
    
    const kanaCount = (context.word.match(/[ぁ-んァ-ヶ]/g) || []).length;
    if (kanaCount > 0) {
      hints.push(`Contains ${kanaCount} kana character${kanaCount !== 1 ? 's' : ''}`);
    }
    
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