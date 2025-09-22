/**
 * Sentence-specific validator
 * Handles full sentence validation with grammar checking
 */

import { BaseValidator, ValidationResult, ValidationOptions } from './base-validator';

interface SentenceValidationOptions extends ValidationOptions {
  checkGrammar?: boolean;
  allowMinorErrors?: boolean;
  requirePunctuation?: boolean;
  checkWordOrder?: boolean;
}

interface SentenceContext {
  sentence: string;
  translation?: string;
  keywords?: string[];
  grammarPoints?: string[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}

export class SentenceValidator extends BaseValidator {
  private sentenceOptions: SentenceValidationOptions;
  
  constructor(options: SentenceValidationOptions = {}) {
    super(options);
    this.sentenceOptions = {
      checkGrammar: true,
      allowMinorErrors: true,
      requirePunctuation: true,
      checkWordOrder: true,
      ...options
    };
  }
  
  validate(
    userAnswer: string,
    correctAnswer: string | string[],
    context?: SentenceContext
  ): ValidationResult {
    const correctAnswers = Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer];
    const normalizedUser = this.normalizeSentence(userAnswer);
    
    // Check exact match
    for (const answer of correctAnswers) {
      if (this.isExactMatch(normalizedUser, answer)) {
        return {
          isCorrect: true,
          confidence: 1.0,
          feedback: "Perfect sentence!"
        };
      }
    }
    
    // Check with minor variations allowed
    if (this.sentenceOptions.allowMinorErrors) {
      for (const answer of correctAnswers) {
        const similarity = this.calculateSentenceSimilarity(normalizedUser, answer);
        if (similarity >= 0.95) {
          return {
            isCorrect: true,
            confidence: similarity,
            feedback: "Excellent! (Minor variation accepted)"
          };
        }
      }
    }
    
    // Check if translation is attempted (for translation exercises)
    if (context?.translation) {
      return this.validateTranslation(normalizedUser, context.translation, context);
    }
    
    // Analyze sentence structure
    const analysis = this.analyzeSentence(normalizedUser, correctAnswers[0], context);
    
    if (analysis.score >= 0.8) {
      return {
        isCorrect: false,
        confidence: analysis.score,
        partialCredit: analysis.score * 0.6,
        feedback: analysis.feedback,
        corrections: analysis.corrections,
        hints: this.generateSentenceHints(correctAnswers[0], context)
      };
    }
    
    return {
      isCorrect: false,
      confidence: analysis.score,
      feedback: "Incorrect sentence structure.",
      corrections: [`Correct: ${correctAnswers[0]}`],
      hints: this.generateSentenceHints(correctAnswers[0], context)
    };
  }
  
  private normalizeSentence(sentence: string): string {
    let normalized = sentence.trim();
    
    // Normalize Japanese punctuation
    normalized = normalized.replace(/。/g, '.');
    normalized = normalized.replace(/、/g, ',');
    normalized = normalized.replace(/！/g, '!');
    normalized = normalized.replace(/？/g, '?');
    normalized = normalized.replace(/「|」/g, '"');
    normalized = normalized.replace(/『|』/g, "'");
    
    // Normalize spaces (Japanese doesn't typically use spaces)
    if (this.isJapanese(normalized)) {
      normalized = normalized.replace(/\s+/g, '');
    } else {
      normalized = normalized.replace(/\s+/g, ' ');
    }
    
    return normalized;
  }
  
  private calculateSentenceSimilarity(sentence1: string, sentence2: string): number {
    // Use word-level comparison for better sentence matching
    const words1 = this.tokenizeSentence(sentence1);
    const words2 = this.tokenizeSentence(sentence2);
    
    if (words1.length === 0 || words2.length === 0) {
      return 0;
    }
    
    // Calculate Jaccard similarity
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    const jaccardSimilarity = intersection.size / union.size;
    
    // Calculate order similarity
    const orderSimilarity = this.calculateOrderSimilarity(words1, words2);
    
    // Weighted average
    return jaccardSimilarity * 0.6 + orderSimilarity * 0.4;
  }
  
  private tokenizeSentence(sentence: string): string[] {
    if (this.isJapanese(sentence)) {
      // Simple Japanese tokenization (in production, use a proper tokenizer like MeCab)
      return this.tokenizeJapanese(sentence);
    } else {
      // English tokenization
      return sentence.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    }
  }
  
  private tokenizeJapanese(sentence: string): string[] {
    // Simplified tokenization - splits on particles and punctuation
    // In production, use a proper Japanese tokenizer
    const particles = ['は', 'が', 'を', 'に', 'へ', 'で', 'と', 'から', 'まで', 'の'];
    const tokens: string[] = [];
    let current = '';
    
    for (let i = 0; i < sentence.length; i++) {
      const char = sentence[i];
      
      if (particles.includes(char) || /[。、！？]/.test(char)) {
        if (current) {
          tokens.push(current);
          current = '';
        }
        tokens.push(char);
      } else {
        current += char;
      }
    }
    
    if (current) {
      tokens.push(current);
    }
    
    return tokens;
  }
  
  private calculateOrderSimilarity(words1: string[], words2: string[]): number {
    const maxLen = Math.max(words1.length, words2.length);
    let matches = 0;
    
    for (let i = 0; i < Math.min(words1.length, words2.length); i++) {
      if (words1[i] === words2[i]) {
        matches++;
      }
    }
    
    return matches / maxLen;
  }
  
  private validateTranslation(
    userAnswer: string,
    expectedTranslation: string,
    context: SentenceContext
  ): ValidationResult {
    const normalizedExpected = this.normalize(expectedTranslation);
    
    // Check if key concepts are present
    if (context.keywords) {
      const keywordScore = this.checkKeywords(userAnswer, context.keywords);
      if (keywordScore >= 0.8) {
        return {
          isCorrect: true,
          confidence: keywordScore,
          feedback: "Good translation! Key concepts captured."
        };
      }
    }
    
    // Check semantic similarity
    const similarity = this.calculateSimilarity(userAnswer, normalizedExpected);
    
    if (similarity >= 0.7) {
      return {
        isCorrect: false,
        confidence: similarity,
        partialCredit: similarity * 0.5,
        feedback: "Translation captures the general meaning.",
        corrections: this.suggestTranslationImprovements(userAnswer, expectedTranslation),
        hints: [`Expected: ${expectedTranslation}`]
      };
    }
    
    return {
      isCorrect: false,
      confidence: similarity,
      feedback: "Translation needs improvement.",
      corrections: [`Expected: ${expectedTranslation}`],
      hints: this.generateTranslationHints(context)
    };
  }
  
  private analyzeSentence(
    userSentence: string,
    correctSentence: string,
    context?: SentenceContext
  ): { score: number; feedback: string; corrections: string[] } {
    const corrections: string[] = [];
    let score = 0;
    let feedback = '';
    
    // Check punctuation
    if (this.sentenceOptions.requirePunctuation) {
      const userHasPunctuation = /[.!?。！？]$/.test(userSentence);
      const correctHasPunctuation = /[.!?。！？]$/.test(correctSentence);
      
      if (userHasPunctuation === correctHasPunctuation) {
        score += 0.1;
      } else if (correctHasPunctuation) {
        corrections.push("Add punctuation at the end");
      }
    }
    
    // Check grammar points if specified
    if (context?.grammarPoints && this.sentenceOptions.checkGrammar) {
      const grammarScore = this.checkGrammarPoints(userSentence, context.grammarPoints);
      score += grammarScore * 0.3;
      
      if (grammarScore < 1) {
        corrections.push("Review grammar structure");
      }
    }
    
    // Check word order
    if (this.sentenceOptions.checkWordOrder) {
      const orderScore = this.checkWordOrder(userSentence, correctSentence);
      score += orderScore * 0.3;
      
      if (orderScore < 0.7) {
        corrections.push("Check word order");
      }
    }
    
    // Check content similarity
    const similarity = this.calculateSentenceSimilarity(userSentence, correctSentence);
    score += similarity * 0.3;
    
    // Generate feedback
    if (score >= 0.9) {
      feedback = "Almost perfect! Minor adjustments needed.";
    } else if (score >= 0.7) {
      feedback = "Good attempt! Some corrections needed.";
    } else if (score >= 0.5) {
      feedback = "Partial understanding shown.";
    } else {
      feedback = "Significant improvements needed.";
    }
    
    return { score: Math.min(1, score), feedback, corrections };
  }
  
  private checkKeywords(sentence: string, keywords: string[]): number {
    const normalizedSentence = this.normalize(sentence);
    let foundCount = 0;
    
    for (const keyword of keywords) {
      if (normalizedSentence.includes(this.normalize(keyword))) {
        foundCount++;
      }
    }
    
    return foundCount / keywords.length;
  }
  
  private checkGrammarPoints(sentence: string, grammarPoints: string[]): number {
    // Simplified grammar checking
    // In production, use a proper grammar checker
    let score = 0;
    
    for (const point of grammarPoints) {
      switch (point) {
        case 'past-tense':
          if (sentence.includes('た') || sentence.includes('した') || sentence.includes('だった')) {
            score++;
          }
          break;
        case 'negative':
          if (sentence.includes('ない') || sentence.includes('ません') || sentence.includes('じゃない')) {
            score++;
          }
          break;
        case 'question':
          if (sentence.includes('か') || sentence.includes('？')) {
            score++;
          }
          break;
        case 'polite':
          if (sentence.includes('です') || sentence.includes('ます')) {
            score++;
          }
          break;
      }
    }
    
    return grammarPoints.length > 0 ? score / grammarPoints.length : 1;
  }
  
  private checkWordOrder(userSentence: string, correctSentence: string): number {
    const userWords = this.tokenizeSentence(userSentence);
    const correctWords = this.tokenizeSentence(correctSentence);
    
    // Find longest common subsequence
    const lcs = this.findLCS(userWords, correctWords);
    
    return lcs.length / Math.max(userWords.length, correctWords.length);
  }
  
  private findLCS(arr1: string[], arr2: string[]): string[] {
    const m = arr1.length;
    const n = arr2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (arr1[i - 1] === arr2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }
    
    // Backtrack to find the LCS
    const lcs: string[] = [];
    let i = m, j = n;
    
    while (i > 0 && j > 0) {
      if (arr1[i - 1] === arr2[j - 1]) {
        lcs.unshift(arr1[i - 1]);
        i--;
        j--;
      } else if (dp[i - 1][j] > dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }
    
    return lcs;
  }
  
  private isJapanese(text: string): boolean {
    return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
  }
  
  private suggestTranslationImprovements(
    userTranslation: string,
    expectedTranslation: string
  ): string[] {
    const suggestions: string[] = [];
    
    const userWords = new Set(userTranslation.toLowerCase().split(/\s+/));
    const expectedWords = new Set(expectedTranslation.toLowerCase().split(/\s+/));
    
    const missing = [...expectedWords].filter(w => !userWords.has(w) && w.length > 3);
    const extra = [...userWords].filter(w => !expectedWords.has(w) && w.length > 3);
    
    if (missing.length > 0) {
      suggestions.push(`Consider including: ${missing.slice(0, 3).join(', ')}`);
    }
    
    if (extra.length > 0) {
      suggestions.push(`Possibly unnecessary: ${extra.slice(0, 3).join(', ')}`);
    }
    
    return suggestions;
  }
  
  private generateSentenceHints(correctSentence: string, context?: SentenceContext): string[] {
    const hints: string[] = [];
    
    // Word count hint
    const wordCount = this.tokenizeSentence(correctSentence).length;
    hints.push(`${wordCount} words/segments`);
    
    // Grammar hints
    if (context?.grammarPoints && context.grammarPoints.length > 0) {
      hints.push(`Uses: ${context.grammarPoints.join(', ')}`);
    }
    
    // Difficulty hint
    if (context?.difficulty) {
      hints.push(`Difficulty: ${context.difficulty}`);
    }
    
    // Structural hints
    if (correctSentence.includes('は')) {
      hints.push("Topic marker は is used");
    }
    
    if (correctSentence.includes('を')) {
      hints.push("Direct object marker を is used");
    }
    
    return hints;
  }
  
  private generateTranslationHints(context: SentenceContext): string[] {
    const hints: string[] = [];
    
    if (context.keywords && context.keywords.length > 0) {
      hints.push(`Key concepts: ${context.keywords.slice(0, 3).join(', ')}`);
    }
    
    if (context.sentence) {
      const firstWord = context.sentence.split(/[\s。、]/)[0];
      hints.push(`Starts with: ${firstWord}`);
    }
    
    return hints;
  }
}