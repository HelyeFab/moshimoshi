# Module 6: Validation System

**Status**: 🔴 Not Started  
**Priority**: HIGH  
**Owner**: Agent 6  
**Dependencies**: Core Interfaces (Module 1), Content Adapters (Module 2)  
**Estimated Time**: 3-4 hours  

## Overview
Implement a flexible answer validation framework that supports exact matching, fuzzy matching, and custom validation rules for different content types. This ensures accurate assessment of user answers across various input methods.

## Deliverables

### 1. Validator Interface

```typescript
// lib/review-engine/validation/interface.ts

import { ReviewableContent } from '../core/interfaces';

export interface ValidationResult {
  correct: boolean;
  score: number;          // 0.0 to 1.0
  expectedAnswer: string;
  feedback?: string;
  corrections?: string[]; // Specific corrections for the user
  partialCredit?: boolean;
}

export interface ValidatorOptions {
  caseSensitive?: boolean;
  ignoreSpaces?: boolean;
  ignorePunctuation?: boolean;
  allowTypos?: boolean;
  typoThreshold?: number;  // 0.0 to 1.0
  allowSynonyms?: boolean;
  synonymDatabase?: Map<string, string[]>;
  customRules?: ValidationRule[];
}

export interface ValidationRule {
  name: string;
  test: (userAnswer: string, expectedAnswer: string) => boolean;
  feedback?: string;
}

export abstract class BaseValidator {
  protected options: ValidatorOptions;
  
  constructor(options: ValidatorOptions = {}) {
    this.options = {
      caseSensitive: false,
      ignoreSpaces: false,
      ignorePunctuation: true,
      allowTypos: true,
      typoThreshold: 0.8,
      allowSynonyms: false,
      ...options
    };
  }
  
  abstract validate(
    userAnswer: string,
    content: ReviewableContent
  ): ValidationResult;
  
  protected normalize(text: string): string {
    let normalized = text.trim();
    
    if (!this.options.caseSensitive) {
      normalized = normalized.toLowerCase();
    }
    
    if (this.options.ignoreSpaces) {
      normalized = normalized.replace(/\s+/g, '');
    }
    
    if (this.options.ignorePunctuation) {
      normalized = normalized.replace(/[.,!?;:'"]/g, '');
    }
    
    return normalized;
  }
  
  protected calculateSimilarity(a: string, b: string): number {
    const matrix: number[][] = [];
    const aLen = a.length;
    const bLen = b.length;
    
    if (aLen === 0) return bLen === 0 ? 1 : 0;
    if (bLen === 0) return 0;
    
    // Initialize matrix
    for (let i = 0; i <= bLen; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= aLen; j++) {
      matrix[0][j] = j;
    }
    
    // Calculate Levenshtein distance
    for (let i = 1; i <= bLen; i++) {
      for (let j = 1; j <= aLen; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
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
    
    const distance = matrix[bLen][aLen];
    const maxLength = Math.max(aLen, bLen);
    return 1 - (distance / maxLength);
  }
}
```

### 2. Exact Validator

```typescript
// lib/review-engine/validation/exact.validator.ts

export class ExactValidator extends BaseValidator {
  validate(
    userAnswer: string,
    content: ReviewableContent
  ): ValidationResult {
    const normalizedUser = this.normalize(userAnswer);
    const normalizedExpected = this.normalize(content.primaryAnswer);
    
    // Check primary answer
    if (normalizedUser === normalizedExpected) {
      return {
        correct: true,
        score: 1.0,
        expectedAnswer: content.primaryAnswer,
        feedback: 'Perfect!'
      };
    }
    
    // Check alternative answers
    if (content.alternativeAnswers) {
      for (const alt of content.alternativeAnswers) {
        if (normalizedUser === this.normalize(alt)) {
          return {
            correct: true,
            score: 0.95, // Slightly lower score for alternatives
            expectedAnswer: content.primaryAnswer,
            feedback: `Correct! Also accepted: ${alt}`
          };
        }
      }
    }
    
    // Check custom rules
    if (this.options.customRules) {
      for (const rule of this.options.customRules) {
        if (rule.test(userAnswer, content.primaryAnswer)) {
          return {
            correct: true,
            score: 0.9,
            expectedAnswer: content.primaryAnswer,
            feedback: rule.feedback || 'Correct!'
          };
        }
      }
    }
    
    return {
      correct: false,
      score: 0,
      expectedAnswer: content.primaryAnswer,
      feedback: `The correct answer is: ${content.primaryAnswer}`
    };
  }
}
```

### 3. Fuzzy Validator

```typescript
// lib/review-engine/validation/fuzzy.validator.ts

export class FuzzyValidator extends BaseValidator {
  validate(
    userAnswer: string,
    content: ReviewableContent
  ): ValidationResult {
    const normalizedUser = this.normalize(userAnswer);
    const normalizedExpected = this.normalize(content.primaryAnswer);
    
    // Calculate similarity score
    const similarity = this.calculateSimilarity(normalizedUser, normalizedExpected);
    
    // Check if it's close enough
    if (similarity >= this.options.typoThreshold!) {
      const corrections = this.getCorrections(userAnswer, content.primaryAnswer);
      
      return {
        correct: similarity === 1.0,
        score: similarity,
        expectedAnswer: content.primaryAnswer,
        feedback: similarity === 1.0 
          ? 'Perfect!' 
          : `Almost correct! Watch out for: ${corrections.join(', ')}`,
        corrections,
        partialCredit: similarity >= 0.8
      };
    }
    
    // Check alternatives with fuzzy matching
    if (content.alternativeAnswers) {
      for (const alt of content.alternativeAnswers) {
        const altSimilarity = this.calculateSimilarity(
          normalizedUser,
          this.normalize(alt)
        );
        
        if (altSimilarity >= this.options.typoThreshold!) {
          return {
            correct: altSimilarity >= 0.95,
            score: altSimilarity * 0.95,
            expectedAnswer: content.primaryAnswer,
            feedback: `Close! The answer was: ${alt}`,
            partialCredit: true
          };
        }
      }
    }
    
    // Check for common mistakes
    const commonMistake = this.checkCommonMistakes(userAnswer, content);
    if (commonMistake) {
      return {
        correct: false,
        score: 0.3,
        expectedAnswer: content.primaryAnswer,
        feedback: commonMistake,
        partialCredit: true
      };
    }
    
    return {
      correct: false,
      score: similarity,
      expectedAnswer: content.primaryAnswer,
      feedback: `Not quite. The correct answer is: ${content.primaryAnswer}`,
      corrections: this.getCorrections(userAnswer, content.primaryAnswer)
    };
  }
  
  private getCorrections(userAnswer: string, expectedAnswer: string): string[] {
    const corrections: string[] = [];
    
    // Check for case errors
    if (userAnswer.toLowerCase() === expectedAnswer.toLowerCase() && 
        userAnswer !== expectedAnswer) {
      corrections.push('capitalization');
    }
    
    // Check for spacing errors
    if (userAnswer.replace(/\s+/g, '') === expectedAnswer.replace(/\s+/g, '') &&
        userAnswer !== expectedAnswer) {
      corrections.push('spacing');
    }
    
    // Check for punctuation errors
    if (userAnswer.replace(/[.,!?;:'"]/g, '') === expectedAnswer.replace(/[.,!?;:'"]/g, '') &&
        userAnswer !== expectedAnswer) {
      corrections.push('punctuation');
    }
    
    // Check for transposed letters
    if (this.hasTransposition(userAnswer, expectedAnswer)) {
      corrections.push('letter order');
    }
    
    return corrections;
  }
  
  private hasTransposition(a: string, b: string): boolean {
    if (Math.abs(a.length - b.length) > 1) return false;
    
    for (let i = 0; i < a.length - 1; i++) {
      const swapped = a.substring(0, i) + a[i + 1] + a[i] + a.substring(i + 2);
      if (swapped === b) return true;
    }
    
    return false;
  }
  
  private checkCommonMistakes(userAnswer: string, content: ReviewableContent): string | null {
    // Content-type specific common mistakes
    if (content.contentType === 'kana') {
      const confusionPairs = [
        ['れ', 'わ'], ['ね', 'れ'], ['る', 'ろ'],
        ['シ', 'ツ'], ['ン', 'ソ'], ['ワ', 'ウ']
      ];
      
      for (const [a, b] of confusionPairs) {
        if (userAnswer.includes(a) && content.primaryAnswer.includes(b)) {
          return `Common confusion: ${a} vs ${b}`;
        }
      }
    }
    
    return null;
  }
}
```

### 4. Japanese-Specific Validators

```typescript
// lib/review-engine/validation/japanese.validator.ts

export class JapaneseValidator extends FuzzyValidator {
  validate(
    userAnswer: string,
    content: ReviewableContent
  ): ValidationResult {
    // Handle different Japanese input methods
    const convertedAnswer = this.convertInput(userAnswer);
    
    // Check for hiragana/katakana mix-ups
    if (content.contentType === 'kana') {
      const hiraganaAnswer = this.toHiragana(userAnswer);
      const katakanaAnswer = this.toKatakana(userAnswer);
      
      if (hiraganaAnswer === content.primaryAnswer || 
          katakanaAnswer === content.primaryAnswer) {
        return {
          correct: true,
          score: 0.95,
          expectedAnswer: content.primaryAnswer,
          feedback: 'Correct! Watch the script type (hiragana vs katakana)'
        };
      }
    }
    
    // Handle kanji readings
    if (content.contentType === 'kanji') {
      return this.validateKanjiReading(userAnswer, content);
    }
    
    // Handle particles
    if (content.contentType === 'sentence') {
      return this.validateSentence(userAnswer, content);
    }
    
    return super.validate(convertedAnswer, content);
  }
  
  private convertInput(input: string): string {
    // Convert romaji to hiragana if needed
    if (this.isRomaji(input)) {
      return this.romajiToHiragana(input);
    }
    
    // Convert full-width to half-width
    return input.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => {
      return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
    });
  }
  
  private validateKanjiReading(
    userAnswer: string,
    content: ReviewableContent
  ): ValidationResult {
    const metadata = content.metadata as any;
    
    // Check onyomi readings
    if (metadata?.onyomi?.includes(userAnswer)) {
      return {
        correct: true,
        score: 1.0,
        expectedAnswer: content.primaryAnswer,
        feedback: `Correct! 音読み: ${userAnswer}`
      };
    }
    
    // Check kunyomi readings
    if (metadata?.kunyomi?.includes(userAnswer)) {
      return {
        correct: true,
        score: 1.0,
        expectedAnswer: content.primaryAnswer,
        feedback: `Correct! 訓読み: ${userAnswer}`
      };
    }
    
    // Check if they gave reading instead of meaning
    const allReadings = [...(metadata?.onyomi || []), ...(metadata?.kunyomi || [])];
    if (allReadings.some(r => this.calculateSimilarity(userAnswer, r) > 0.8)) {
      return {
        correct: false,
        score: 0.3,
        expectedAnswer: content.primaryAnswer,
        feedback: 'You provided the reading, but we need the meaning in English',
        partialCredit: true
      };
    }
    
    return super.validate(userAnswer, content);
  }
  
  private validateSentence(
    userAnswer: string,
    content: ReviewableContent
  ): ValidationResult {
    // Remove or normalize particles for comparison
    const normalizedUser = userAnswer
      .replace(/[はがをにへでとも]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const normalizedExpected = content.primaryAnswer
      .replace(/[はがをにへでとも]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const similarity = this.calculateSimilarity(normalizedUser, normalizedExpected);
    
    if (similarity >= 0.9) {
      return {
        correct: true,
        score: similarity,
        expectedAnswer: content.primaryAnswer,
        feedback: 'Excellent sentence construction!'
      };
    }
    
    if (similarity >= 0.7) {
      return {
        correct: false,
        score: similarity,
        expectedAnswer: content.primaryAnswer,
        feedback: 'Good attempt! Check your particles and word order',
        partialCredit: true
      };
    }
    
    return super.validate(userAnswer, content);
  }
  
  private isRomaji(text: string): boolean {
    return /^[a-zA-Z\s]+$/.test(text);
  }
  
  private romajiToHiragana(romaji: string): string {
    // Implement romaji to hiragana conversion
    // This would use a mapping table
    return romaji; // Placeholder
  }
  
  private toHiragana(text: string): string {
    // Convert katakana to hiragana
    return text.replace(/[\u30A1-\u30FA]/g, (match) => {
      return String.fromCharCode(match.charCodeAt(0) - 0x60);
    });
  }
  
  private toKatakana(text: string): string {
    // Convert hiragana to katakana
    return text.replace(/[\u3041-\u309F]/g, (match) => {
      return String.fromCharCode(match.charCodeAt(0) + 0x60);
    });
  }
}
```

### 5. Custom Validators

```typescript
// lib/review-engine/validation/custom.validator.ts

export class CustomValidator extends BaseValidator {
  private validators: Map<string, (answer: string, content: ReviewableContent) => ValidationResult>;
  
  constructor(options: ValidatorOptions = {}) {
    super(options);
    this.validators = new Map();
    this.registerDefaultValidators();
  }
  
  registerValidator(
    contentType: string,
    validator: (answer: string, content: ReviewableContent) => ValidationResult
  ) {
    this.validators.set(contentType, validator);
  }
  
  validate(
    userAnswer: string,
    content: ReviewableContent
  ): ValidationResult {
    const customValidator = this.validators.get(content.contentType);
    
    if (customValidator) {
      return customValidator(userAnswer, content);
    }
    
    // Fallback to fuzzy validation
    return new FuzzyValidator(this.options).validate(userAnswer, content);
  }
  
  private registerDefaultValidators() {
    // Number validator
    this.registerValidator('number', (answer, content) => {
      const userNum = parseFloat(answer);
      const expectedNum = parseFloat(content.primaryAnswer);
      
      if (isNaN(userNum)) {
        return {
          correct: false,
          score: 0,
          expectedAnswer: content.primaryAnswer,
          feedback: 'Please enter a valid number'
        };
      }
      
      const tolerance = 0.01; // 1% tolerance
      const difference = Math.abs(userNum - expectedNum);
      const isCorrect = difference <= expectedNum * tolerance;
      
      return {
        correct: isCorrect,
        score: isCorrect ? 1.0 : Math.max(0, 1 - difference / expectedNum),
        expectedAnswer: content.primaryAnswer,
        feedback: isCorrect ? 'Correct!' : `Close! The answer is ${expectedNum}`
      };
    });
    
    // Date validator
    this.registerValidator('date', (answer, content) => {
      // Parse various date formats
      const formats = [
        /(\d{4})-(\d{2})-(\d{2})/,
        /(\d{2})\/(\d{2})\/(\d{4})/,
        /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i
      ];
      
      // Validate and compare dates
      // Implementation details...
    });
  }
}
```

### 6. Validator Registry

```typescript
// lib/review-engine/validation/registry.ts

export class ValidatorRegistry {
  private static validators = new Map<string, BaseValidator>();
  
  static initialize() {
    this.validators.set('exact', new ExactValidator());
    this.validators.set('fuzzy', new FuzzyValidator());
    this.validators.set('japanese', new JapaneseValidator());
    this.validators.set('custom', new CustomValidator());
  }
  
  static getValidator(strategy: string): BaseValidator {
    const validator = this.validators.get(strategy);
    if (!validator) {
      console.warn(`Validator ${strategy} not found, using fuzzy validator`);
      return this.validators.get('fuzzy')!;
    }
    return validator;
  }
  
  static validate(
    userAnswer: string,
    content: ReviewableContent,
    strategy: string = 'fuzzy'
  ): ValidationResult {
    const validator = this.getValidator(strategy);
    return validator.validate(userAnswer, content);
  }
}
```

## Testing Requirements

```typescript
// __tests__/validation/validators.test.ts

describe('Validation System', () => {
  describe('ExactValidator', () => {
    it('should match exact answers');
    it('should handle case sensitivity option');
    it('should ignore punctuation when configured');
  });
  
  describe('FuzzyValidator', () => {
    it('should detect typos within threshold');
    it('should identify common corrections');
    it('should give partial credit');
  });
  
  describe('JapaneseValidator', () => {
    it('should handle hiragana/katakana conversion');
    it('should validate kanji readings');
    it('should handle romaji input');
    it('should validate particles in sentences');
  });
  
  describe('CustomValidator', () => {
    it('should use registered validators');
    it('should fallback to fuzzy validation');
  });
});
```

## Acceptance Criteria

- [ ] Accurate validation for all content types
- [ ] Configurable validation options
- [ ] Helpful feedback messages
- [ ] Partial credit support
- [ ] Japanese-specific handling
- [ ] Custom validation rules
- [ ] 95% test coverage
- [ ] Performance: <50ms validation time