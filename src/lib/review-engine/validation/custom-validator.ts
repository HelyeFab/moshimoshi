/**
 * Custom validator for user-defined content
 * Allows flexible validation rules
 */

import { BaseValidator, ValidationResult, ValidationOptions, ValidationRule } from './base-validator';
import { reviewLogger } from '@/lib/monitoring/logger';

interface CustomValidationOptions extends ValidationOptions {
  validationMode?: 'exact' | 'fuzzy' | 'contains' | 'regex' | 'custom';
  minSimilarity?: number;
  acceptMultipleAnswers?: boolean;
  scoreWeights?: {
    exact?: number;
    fuzzy?: number;
    partial?: number;
    custom?: number;
  };
}

interface CustomContext {
  acceptableAnswers?: string[];
  validationFunction?: (userAnswer: string, correctAnswer: string) => boolean;
  scoringFunction?: (userAnswer: string, correctAnswer: string) => number;
  feedbackFunction?: (userAnswer: string, correctAnswer: string, score: number) => string;
  metadata?: Record<string, any>;
}

export class CustomValidator extends BaseValidator {
  private customOptions: CustomValidationOptions;
  
  constructor(options: CustomValidationOptions = {}) {
    super(options);
    this.customOptions = {
      validationMode: 'fuzzy',
      minSimilarity: 0.85,
      acceptMultipleAnswers: true,
      scoreWeights: {
        exact: 1.0,
        fuzzy: 0.8,
        partial: 0.5,
        custom: 0.7
      },
      ...options
    };
  }
  
  validate(
    userAnswer: string,
    correctAnswer: string | string[],
    context?: CustomContext
  ): ValidationResult {
    const correctAnswers = Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer];
    const allAcceptableAnswers = [
      ...correctAnswers,
      ...(context?.acceptableAnswers || [])
    ];
    
    // Check with custom validation function if provided
    if (context?.validationFunction) {
      for (const answer of allAcceptableAnswers) {
        if (context.validationFunction(userAnswer, answer)) {
          return {
            isCorrect: true,
            confidence: this.customOptions.scoreWeights?.custom || 1.0,
            feedback: context.feedbackFunction?.(userAnswer, answer, 1.0) || "Correct!"
          };
        }
      }
    }
    
    // Apply validation based on mode
    switch (this.customOptions.validationMode) {
      case 'exact':
        return this.validateExact(userAnswer, allAcceptableAnswers, context);
      
      case 'fuzzy':
        return this.validateFuzzy(userAnswer, allAcceptableAnswers, context);
      
      case 'contains':
        return this.validateContains(userAnswer, allAcceptableAnswers, context);
      
      case 'regex':
        return this.validateRegex(userAnswer, allAcceptableAnswers, context);
      
      case 'custom':
        return this.validateCustom(userAnswer, allAcceptableAnswers, context);
      
      default:
        return this.validateFuzzy(userAnswer, allAcceptableAnswers, context);
    }
  }
  
  private validateExact(
    userAnswer: string,
    correctAnswers: string[],
    context?: CustomContext
  ): ValidationResult {
    const normalizedUser = this.normalize(userAnswer);
    
    for (const answer of correctAnswers) {
      if (this.isExactMatch(normalizedUser, answer)) {
        const score = this.customOptions.scoreWeights?.exact || 1.0;
        return {
          isCorrect: true,
          confidence: score,
          feedback: context?.feedbackFunction?.(userAnswer, answer, score) || "Perfect match!"
        };
      }
    }
    
    // Not exact, check how close
    const bestMatch = this.findBestMatch(normalizedUser, correctAnswers);
    
    return {
      isCorrect: false,
      confidence: bestMatch.similarity,
      feedback: context?.feedbackFunction?.(userAnswer, bestMatch.answer, bestMatch.similarity) 
        || `Incorrect. Expected exact match.`,
      corrections: [`Correct answer: ${bestMatch.answer}`],
      hints: this.generateCustomHints(bestMatch.answer, context)
    };
  }
  
  private validateFuzzy(
    userAnswer: string,
    correctAnswers: string[],
    context?: CustomContext
  ): ValidationResult {
    const normalizedUser = this.normalize(userAnswer);
    const bestMatch = this.findBestMatch(normalizedUser, correctAnswers);
    
    // Use custom scoring function if provided
    let score = bestMatch.similarity;
    if (context?.scoringFunction) {
      score = context.scoringFunction(userAnswer, bestMatch.answer);
    }
    
    const isCorrect = score >= (this.customOptions.minSimilarity || 0.85);
    
    if (isCorrect) {
      return {
        isCorrect: true,
        confidence: score * (this.customOptions.scoreWeights?.fuzzy || 0.8),
        feedback: context?.feedbackFunction?.(userAnswer, bestMatch.answer, score) 
          || (score >= 0.95 ? "Excellent!" : "Correct!")
      };
    }
    
    // Partial credit for close answers
    const partialCredit = score > 0.6 ? score * 0.5 : 0;
    
    return {
      isCorrect: false,
      confidence: score,
      partialCredit,
      feedback: context?.feedbackFunction?.(userAnswer, bestMatch.answer, score) 
        || this.generateFeedback(userAnswer, bestMatch.answer, score),
      corrections: this.identifyCorrections(userAnswer, bestMatch.answer),
      hints: this.generateCustomHints(bestMatch.answer, context)
    };
  }
  
  private validateContains(
    userAnswer: string,
    correctAnswers: string[],
    context?: CustomContext
  ): ValidationResult {
    const normalizedUser = this.normalize(userAnswer);
    
    for (const answer of correctAnswers) {
      const normalizedAnswer = this.normalize(answer);
      
      if (normalizedUser.includes(normalizedAnswer) || normalizedAnswer.includes(normalizedUser)) {
        const score = this.customOptions.scoreWeights?.partial || 0.7;
        return {
          isCorrect: true,
          confidence: score,
          feedback: context?.feedbackFunction?.(userAnswer, answer, score) 
            || "Correct! (Contains expected content)"
        };
      }
    }
    
    // Check for partial containment
    const bestMatch = this.findBestContainmentMatch(normalizedUser, correctAnswers);
    
    if (bestMatch.containmentScore > 0.5) {
      return {
        isCorrect: false,
        confidence: bestMatch.containmentScore,
        partialCredit: bestMatch.containmentScore * 0.4,
        feedback: "Partially correct - some content matches",
        corrections: [`Expected to contain: ${bestMatch.answer}`],
        hints: this.generateCustomHints(bestMatch.answer, context)
      };
    }
    
    return {
      isCorrect: false,
      confidence: 0,
      feedback: "Incorrect - doesn't contain expected content",
      corrections: [`Should contain: ${correctAnswers[0]}`],
      hints: this.generateCustomHints(correctAnswers[0], context)
    };
  }
  
  private validateRegex(
    userAnswer: string,
    patterns: string[],
    context?: CustomContext
  ): ValidationResult {
    for (const pattern of patterns) {
      try {
        const regex = new RegExp(pattern, this.options.caseSensitive ? '' : 'i');
        if (regex.test(userAnswer)) {
          const score = this.customOptions.scoreWeights?.exact || 1.0;
          return {
            isCorrect: true,
            confidence: score,
            feedback: context?.feedbackFunction?.(userAnswer, pattern, score) 
              || "Correct! Matches expected pattern."
          };
        }
      } catch (e) {
        reviewLogger.error(`Invalid regex pattern: ${pattern}`, e);
      }
    }
    
    return {
      isCorrect: false,
      confidence: 0,
      feedback: "Doesn't match expected pattern",
      corrections: ["Review the required format"],
      hints: this.generateRegexHints(patterns[0])
    };
  }
  
  private validateCustom(
    userAnswer: string,
    correctAnswers: string[],
    context?: CustomContext
  ): ValidationResult {
    // Apply all custom rules if defined
    if (this.options.customRules && this.options.customRules.length > 0) {
      const results = this.applyCustomRules(userAnswer, correctAnswers[0]);
      
      const totalWeight = this.options.customRules.reduce((sum, rule) => 
        sum + (rule.weight || 1), 0
      );
      
      const passedWeight = results.passed.reduce((sum, rule) => 
        sum + (rule.weight || 1), 0
      );
      
      const score = totalWeight > 0 ? passedWeight / totalWeight : 0;
      
      if (score >= (this.customOptions.minSimilarity || 0.85)) {
        return {
          isCorrect: true,
          confidence: score,
          feedback: `Passed ${results.passed.length}/${this.options.customRules.length} rules`
        };
      }
      
      const failedRuleNames = results.failed.map(r => r.name).join(', ');
      
      return {
        isCorrect: false,
        confidence: score,
        partialCredit: score * 0.5,
        feedback: `Failed rules: ${failedRuleNames}`,
        corrections: this.generateRuleCorrections(results.failed),
        hints: [`Passed: ${results.passed.map(r => r.name).join(', ')}`]
      };
    }
    
    // Fallback to fuzzy matching
    return this.validateFuzzy(userAnswer, correctAnswers, context);
  }
  
  private findBestMatch(
    userAnswer: string,
    correctAnswers: string[]
  ): { answer: string; similarity: number } {
    let bestMatch = { answer: correctAnswers[0], similarity: 0 };
    
    for (const answer of correctAnswers) {
      const similarity = this.calculateSimilarity(userAnswer, answer);
      if (similarity > bestMatch.similarity) {
        bestMatch = { answer, similarity };
      }
    }
    
    return bestMatch;
  }
  
  private findBestContainmentMatch(
    userAnswer: string,
    correctAnswers: string[]
  ): { answer: string; containmentScore: number } {
    let bestMatch = { answer: correctAnswers[0], containmentScore: 0 };
    
    for (const answer of correctAnswers) {
      const normalizedAnswer = this.normalize(answer);
      const words = normalizedAnswer.split(/\s+/);
      const foundWords = words.filter(word => 
        userAnswer.includes(word) && word.length > 2
      );
      
      const score = words.length > 0 ? foundWords.length / words.length : 0;
      
      if (score > bestMatch.containmentScore) {
        bestMatch = { answer, containmentScore: score };
      }
    }
    
    return bestMatch;
  }
  
  private generateCustomHints(correctAnswer: string, context?: CustomContext): string[] {
    const hints: string[] = [];
    
    // Length hint
    hints.push(`Length: ${correctAnswer.length} characters`);
    
    // First/last character hints
    if (correctAnswer.length > 0) {
      hints.push(`Starts with: ${correctAnswer[0]}`);
      if (correctAnswer.length > 1) {
        hints.push(`Ends with: ${correctAnswer[correctAnswer.length - 1]}`);
      }
    }
    
    // Custom metadata hints
    if (context?.metadata) {
      if (context.metadata.category) {
        hints.push(`Category: ${context.metadata.category}`);
      }
      if (context.metadata.hint) {
        hints.push(context.metadata.hint);
      }
    }
    
    return hints;
  }
  
  private generateRegexHints(pattern: string): string[] {
    const hints: string[] = [];
    
    // Analyze pattern for hints
    if (pattern.includes('^')) {
      hints.push("Must start with specific characters");
    }
    if (pattern.includes('$')) {
      hints.push("Must end with specific characters");
    }
    if (pattern.includes('\\d')) {
      hints.push("Should contain numbers");
    }
    if (pattern.includes('\\w')) {
      hints.push("Should contain letters or numbers");
    }
    if (pattern.includes('+') || pattern.includes('*')) {
      hints.push("Can have multiple characters");
    }
    if (pattern.includes('?')) {
      hints.push("Some parts are optional");
    }
    
    return hints;
  }
  
  private generateRuleCorrections(failedRules: ValidationRule[]): string[] {
    return failedRules.map(rule => `Fix: ${rule.name}`);
  }
}