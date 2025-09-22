/**
 * Base Validator for answer validation
 * Provides common validation functionality and can be extended for specific content types
 */

export interface ValidationResult {
  isCorrect: boolean;
  confidence: number; // 0-1 score
  partialCredit?: number; // For partial matches
  feedback?: string;
  corrections?: string[];
  hints?: string[];
}

export interface ValidationOptions {
  caseSensitive?: boolean;
  ignoreSpaces?: boolean;
  ignorePunctuation?: boolean;
  allowRomaji?: boolean;
  fuzzyThreshold?: number; // 0-1, where 1 is exact match
  customRules?: ValidationRule[];
}

export interface ValidationRule {
  name: string;
  test: (input: string, expected: string) => boolean;
  weight?: number; // How much this rule affects the final score
}

export abstract class BaseValidator {
  protected options: ValidationOptions;
  
  constructor(options: ValidationOptions = {}) {
    this.options = {
      caseSensitive: false,
      ignoreSpaces: false,
      ignorePunctuation: false,
      allowRomaji: false,
      fuzzyThreshold: 0.85,
      ...options
    };
  }
  
  /**
   * Main validation method - must be implemented by subclasses
   */
  abstract validate(
    userAnswer: string,
    correctAnswer: string | string[],
    context?: any
  ): ValidationResult;
  
  /**
   * Normalize text for comparison
   */
  protected normalize(text: string): string {
    let normalized = text.trim();
    
    if (!this.options.caseSensitive) {
      normalized = normalized.toLowerCase();
    }
    
    if (this.options.ignoreSpaces) {
      normalized = normalized.replace(/\s+/g, '');
    }
    
    if (this.options.ignorePunctuation) {
      normalized = normalized.replace(/[.,!?;:'"、。！？・]/g, '');
    }
    
    return normalized;
  }
  
  /**
   * Check if answer is an exact match
   */
  protected isExactMatch(userAnswer: string, correctAnswer: string): boolean {
    return this.normalize(userAnswer) === this.normalize(correctAnswer);
  }
  
  /**
   * Check if answer matches any in array
   */
  protected matchesAny(userAnswer: string, correctAnswers: string[]): boolean {
    return correctAnswers.some(answer => 
      this.isExactMatch(userAnswer, answer)
    );
  }
  
  /**
   * Calculate similarity between two strings using Levenshtein distance
   */
  protected calculateSimilarity(str1: string, str2: string): number {
    const s1 = this.normalize(str1);
    const s2 = this.normalize(str2);
    
    if (s1 === s2) return 1;
    if (s1.length === 0 || s2.length === 0) return 0;
    
    const matrix: number[][] = [];
    
    // Initialize matrix
    for (let i = 0; i <= s2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= s1.length; j++) {
      matrix[0][j] = j;
    }
    
    // Calculate distances
    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    const maxLength = Math.max(s1.length, s2.length);
    const distance = matrix[s2.length][s1.length];
    return 1 - (distance / maxLength);
  }
  
  /**
   * Apply custom validation rules
   */
  protected applyCustomRules(
    userAnswer: string,
    correctAnswer: string
  ): { passed: ValidationRule[], failed: ValidationRule[] } {
    const passed: ValidationRule[] = [];
    const failed: ValidationRule[] = [];
    
    if (!this.options.customRules) {
      return { passed, failed };
    }
    
    for (const rule of this.options.customRules) {
      if (rule.test(userAnswer, correctAnswer)) {
        passed.push(rule);
      } else {
        failed.push(rule);
      }
    }
    
    return { passed, failed };
  }
  
  /**
   * Calculate weighted score from multiple factors
   */
  protected calculateWeightedScore(factors: { score: number, weight: number }[]): number {
    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const weightedSum = factors.reduce((sum, f) => sum + (f.score * f.weight), 0);
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }
  
  /**
   * Generate feedback based on validation result
   */
  protected generateFeedback(
    userAnswer: string,
    correctAnswer: string,
    similarity: number
  ): string {
    if (similarity >= 0.95) {
      return "Perfect!";
    } else if (similarity >= 0.85) {
      return "Almost correct! Check your spelling.";
    } else if (similarity >= 0.70) {
      return "Close, but there are some mistakes.";
    } else if (similarity >= 0.50) {
      return "Partially correct. Review the correct answer.";
    } else {
      return "Incorrect. Study this item more.";
    }
  }
  
  /**
   * Identify common mistakes and provide corrections
   */
  protected identifyCorrections(
    userAnswer: string,
    correctAnswer: string
  ): string[] {
    const corrections: string[] = [];
    const userNorm = this.normalize(userAnswer);
    const correctNorm = this.normalize(correctAnswer);
    
    // Check for common typos
    if (userNorm.length === correctNorm.length) {
      for (let i = 0; i < userNorm.length; i++) {
        if (userNorm[i] !== correctNorm[i]) {
          corrections.push(
            `Character ${i + 1}: "${userNorm[i]}" should be "${correctNorm[i]}"`
          );
        }
      }
    }
    
    // Check for missing/extra characters
    if (userNorm.length < correctNorm.length) {
      corrections.push(`Missing ${correctNorm.length - userNorm.length} character(s)`);
    } else if (userNorm.length > correctNorm.length) {
      corrections.push(`${userNorm.length - correctNorm.length} extra character(s)`);
    }
    
    return corrections;
  }
}