/**
 * Factory for creating appropriate validators based on content type
 */

import { BaseValidator, ValidationOptions } from './base-validator';
import { KanaValidator } from './kana-validator';
import { KanjiValidator } from './kanji-validator';
import { VocabularyValidator } from './vocabulary-validator';
import { SentenceValidator } from './sentence-validator';
import { CustomValidator } from './custom-validator';
import { KanjiMasteryValidator } from './KanjiMasteryValidator';

export type ValidatorType = 'kana' | 'kanji' | 'vocabulary' | 'sentence' | 'custom' | 'kanji_mastery';

export class ValidatorFactory {
  private static validators: Map<string, BaseValidator> = new Map();
  
  /**
   * Get or create a validator for the specified type
   */
  static getValidator(
    type: ValidatorType,
    options?: ValidationOptions
  ): BaseValidator {
    const key = `${type}-${JSON.stringify(options || {})}`;
    
    if (!this.validators.has(key)) {
      this.validators.set(key, this.createValidator(type, options));
    }
    
    return this.validators.get(key)!;
  }
  
  /**
   * Create a new validator instance
   */
  private static createValidator(
    type: ValidatorType,
    options?: ValidationOptions
  ): BaseValidator {
    switch (type) {
      case 'kana':
        return new KanaValidator(options);

      case 'kanji':
        return new KanjiValidator(options);

      case 'vocabulary':
        return new VocabularyValidator(options);

      case 'sentence':
        return new SentenceValidator(options);

      case 'custom':
        return new CustomValidator(options);

      case 'kanji_mastery':
        return new KanjiMasteryValidator(options);

      default:
        // Default to custom validator for unknown types
        return new CustomValidator(options);
    }
  }
  
  /**
   * Clear cached validators
   */
  static clearCache(): void {
    this.validators.clear();
  }
  
  /**
   * Register a custom validator class
   */
  static registerValidator(
    type: string,
    validatorClass: new (options?: ValidationOptions) => BaseValidator
  ): void {
    // Allow extending with custom validator types
    const key = `custom-${type}`;
    this.validators.set(key, new validatorClass());
  }
}