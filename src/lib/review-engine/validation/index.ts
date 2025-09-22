/**
 * Validation System - Main exports
 */

export { BaseValidator } from './base-validator';
export type { ValidationResult, ValidationOptions, ValidationRule } from './base-validator';

export { KanaValidator } from './kana-validator';
export { KanjiValidator } from './kanji-validator';
export { VocabularyValidator } from './vocabulary-validator';
export { SentenceValidator } from './sentence-validator';
export { CustomValidator } from './custom-validator';

export { ValidatorFactory } from './validator-factory';
export type { ValidatorType } from './validator-factory';

// Re-export commonly used validation utilities
export { ValidationUtils } from './validation-utils';

// Export preset validation configurations
export { ValidationPresets } from './validation-presets';