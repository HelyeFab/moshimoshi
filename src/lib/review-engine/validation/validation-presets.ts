/**
 * Preset validation configurations for common use cases
 */

import { ValidationOptions } from './base-validator';

export class ValidationPresets {
  /**
   * Strict validation - requires exact match
   */
  static readonly STRICT: ValidationOptions = {
    caseSensitive: true,
    ignoreSpaces: false,
    ignorePunctuation: false,
    allowRomaji: false,
    fuzzyThreshold: 1.0
  };
  
  /**
   * Standard validation - reasonable defaults
   */
  static readonly STANDARD: ValidationOptions = {
    caseSensitive: false,
    ignoreSpaces: false,
    ignorePunctuation: false,
    allowRomaji: true,
    fuzzyThreshold: 0.85
  };
  
  /**
   * Lenient validation - more forgiving
   */
  static readonly LENIENT: ValidationOptions = {
    caseSensitive: false,
    ignoreSpaces: true,
    ignorePunctuation: true,
    allowRomaji: true,
    fuzzyThreshold: 0.75
  };
  
  /**
   * Beginner-friendly validation
   */
  static readonly BEGINNER: ValidationOptions = {
    caseSensitive: false,
    ignoreSpaces: true,
    ignorePunctuation: true,
    allowRomaji: true,
    fuzzyThreshold: 0.70,
    customRules: [
      {
        name: 'allow-common-typos',
        test: (input: string, expected: string) => {
          // Allow common beginner mistakes
          const commonMistakes: { [key: string]: string[] } = {
            'つ': ['tsu', 'tu'],
            'ち': ['chi', 'ti'],
            'し': ['shi', 'si'],
            'ふ': ['fu', 'hu']
          };
          
          for (const [correct, mistakes] of Object.entries(commonMistakes)) {
            for (const mistake of mistakes) {
              if (input.includes(mistake) && expected.includes(correct)) {
                return true;
              }
            }
          }
          
          return false;
        },
        weight: 0.3
      }
    ]
  };
  
  /**
   * Advanced validation - for experienced users
   */
  static readonly ADVANCED: ValidationOptions = {
    caseSensitive: false,
    ignoreSpaces: false,
    ignorePunctuation: false,
    allowRomaji: false,
    fuzzyThreshold: 0.95
  };
  
  /**
   * Listening mode validation - more lenient for audio exercises
   */
  static readonly LISTENING: ValidationOptions = {
    caseSensitive: false,
    ignoreSpaces: true,
    ignorePunctuation: true,
    allowRomaji: true,
    fuzzyThreshold: 0.80,
    customRules: [
      {
        name: 'allow-phonetic-confusion',
        test: (input: string, expected: string) => {
          // Allow confusion between similar sounds
          const phoneticPairs = [
            ['r', 'l'],
            ['b', 'v'],
            ['h', 'f'],
            ['つ', 'す'],
            ['ず', 'づ']
          ];
          
          for (const [sound1, sound2] of phoneticPairs) {
            const pattern1 = new RegExp(sound1, 'g');
            const pattern2 = new RegExp(sound2, 'g');
            
            const normalized1 = input.replace(pattern1, '*').replace(pattern2, '*');
            const normalized2 = expected.replace(pattern1, '*').replace(pattern2, '*');
            
            if (normalized1 === normalized2) {
              return true;
            }
          }
          
          return false;
        },
        weight: 0.4
      }
    ]
  };
  
  /**
   * Writing mode validation - strict for character writing
   */
  static readonly WRITING: ValidationOptions = {
    caseSensitive: true,
    ignoreSpaces: false,
    ignorePunctuation: false,
    allowRomaji: false,
    fuzzyThreshold: 1.0
  };
  
  /**
   * Get preset by difficulty level
   */
  static getByDifficulty(difficulty: 'beginner' | 'intermediate' | 'advanced'): ValidationOptions {
    switch (difficulty) {
      case 'beginner':
        return this.BEGINNER;
      case 'intermediate':
        return this.STANDARD;
      case 'advanced':
        return this.ADVANCED;
      default:
        return this.STANDARD;
    }
  }
  
  /**
   * Get preset by review mode
   */
  static getByMode(mode: 'recognition' | 'recall' | 'listening' | 'writing'): ValidationOptions {
    switch (mode) {
      case 'recognition':
        return this.STANDARD;
      case 'recall':
        return this.STANDARD;
      case 'listening':
        return this.LISTENING;
      case 'writing':
        return this.WRITING;
      default:
        return this.STANDARD;
    }
  }
  
  /**
   * Combine multiple presets
   */
  static combine(...presets: ValidationOptions[]): ValidationOptions {
    return Object.assign({}, ...presets);
  }
  
  /**
   * Create custom preset
   */
  static custom(overrides: Partial<ValidationOptions>): ValidationOptions {
    return {
      ...this.STANDARD,
      ...overrides
    };
  }
}