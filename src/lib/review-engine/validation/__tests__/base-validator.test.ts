/**
 * BaseValidator Tests
 * Agent 2: Core Systems Tester
 * 
 * Testing core validation functionality, normalization, and fuzzy matching
 */

import { BaseValidator, ValidationResult, ValidationOptions, ValidationRule } from '../base-validator';

// Concrete implementation for testing
class TestValidator extends BaseValidator {
  validate(
    userAnswer: string,
    correctAnswer: string | string[],
    context?: any
  ): ValidationResult {
    const answers = Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer];
    
    // Check exact match
    if (this.matchesAny(userAnswer, answers)) {
      return {
        isCorrect: true,
        confidence: 1.0,
        feedback: 'Perfect!'
      };
    }
    
    // Check fuzzy match
    const bestMatch = answers.reduce((best, answer) => {
      const similarity = this.calculateSimilarity(userAnswer, answer);
      return similarity > best.similarity ? { answer, similarity } : best;
    }, { answer: answers[0], similarity: 0 });
    
    if (bestMatch.similarity >= (this.options.fuzzyThreshold || 0.85)) {
      return {
        isCorrect: true,
        confidence: bestMatch.similarity,
        partialCredit: bestMatch.similarity,
        feedback: this.generateFeedback(userAnswer, bestMatch.answer, bestMatch.similarity),
        corrections: this.identifyCorrections(userAnswer, bestMatch.answer)
      };
    }
    
    // Apply custom rules
    const { passed, failed } = this.applyCustomRules(userAnswer, answers[0]);
    
    if (passed.length > 0 && failed.length === 0) {
      return {
        isCorrect: true,
        confidence: 0.8,
        feedback: 'Correct (custom rule)'
      };
    }
    
    // Incorrect
    return {
      isCorrect: false,
      confidence: bestMatch.similarity,
      feedback: this.generateFeedback(userAnswer, bestMatch.answer, bestMatch.similarity),
      corrections: this.identifyCorrections(userAnswer, bestMatch.answer)
    };
  }
}

describe('BaseValidator', () => {
  let validator: TestValidator;

  beforeEach(() => {
    validator = new TestValidator();
  });

  describe('Text Normalization', () => {
    it('should normalize case by default', () => {
      const result = validator.validate('HELLO', 'hello');
      expect(result.isCorrect).toBe(true);
    });

    it('should respect case sensitivity option', () => {
      validator = new TestValidator({ caseSensitive: true });
      
      const result1 = validator.validate('HELLO', 'hello');
      expect(result1.isCorrect).toBe(false);
      
      const result2 = validator.validate('hello', 'hello');
      expect(result2.isCorrect).toBe(true);
    });

    it('should trim whitespace', () => {
      const result = validator.validate('  hello  ', 'hello');
      expect(result.isCorrect).toBe(true);
    });

    it('should ignore spaces when option is set', () => {
      validator = new TestValidator({ ignoreSpaces: true });
      
      const result = validator.validate('h e l l o', 'hello');
      expect(result.isCorrect).toBe(true);
    });

    it('should ignore punctuation when option is set', () => {
      validator = new TestValidator({ ignorePunctuation: true });
      
      const result1 = validator.validate('hello!', 'hello');
      expect(result1.isCorrect).toBe(true);
      
      const result2 = validator.validate('hello, world!', 'hello world');
      expect(result2.isCorrect).toBe(true);
    });

    it('should handle Japanese punctuation', () => {
      validator = new TestValidator({ ignorePunctuation: true });
      
      const result = validator.validate('こんにちは。', 'こんにちは');
      expect(result.isCorrect).toBe(true);
    });

    it('should combine multiple normalization options', () => {
      validator = new TestValidator({
        caseSensitive: false,
        ignoreSpaces: true,
        ignorePunctuation: true
      });
      
      const result = validator.validate('H E L L O !', 'hello');
      expect(result.isCorrect).toBe(true);
    });
  });

  describe('Exact Matching', () => {
    it('should match single correct answer', () => {
      const result = validator.validate('test', 'test');
      expect(result.isCorrect).toBe(true);
      expect(result.confidence).toBe(1.0);
    });

    it('should match any in array of answers', () => {
      const result1 = validator.validate('cat', ['dog', 'cat', 'bird']);
      expect(result1.isCorrect).toBe(true);
      
      const result2 = validator.validate('fish', ['dog', 'cat', 'bird']);
      expect(result2.isCorrect).toBe(false);
    });

    it('should handle empty strings', () => {
      const result1 = validator.validate('', 'test');
      expect(result1.isCorrect).toBe(false);
      
      const result2 = validator.validate('test', '');
      expect(result2.isCorrect).toBe(false);
      
      const result3 = validator.validate('', '');
      expect(result3.isCorrect).toBe(true);
    });
  });

  describe('Fuzzy Matching (Levenshtein Distance)', () => {
    it('should calculate similarity correctly', () => {
      // Exact match
      expect(validator['calculateSimilarity']('test', 'test')).toBe(1);
      
      // One character difference
      expect(validator['calculateSimilarity']('test', 'tost')).toBeCloseTo(0.75, 2);
      
      // Two character difference
      expect(validator['calculateSimilarity']('test', 'tast')).toBeCloseTo(0.5, 2);
      
      // Completely different
      expect(validator['calculateSimilarity']('test', 'abcd')).toBe(0);
      
      // Different lengths
      expect(validator['calculateSimilarity']('test', 'testing')).toBeCloseTo(0.428, 2);
    });

    it('should accept close matches above threshold', () => {
      validator = new TestValidator({ fuzzyThreshold: 0.8 });
      
      const result = validator.validate('tost', 'test'); // 0.75 similarity
      expect(result.isCorrect).toBe(false);
      
      const result2 = validator.validate('testt', 'test'); // 0.8 similarity
      expect(result2.isCorrect).toBe(true);
      expect(result2.partialCredit).toBeCloseTo(0.8, 1);
    });

    it('should use custom fuzzy threshold', () => {
      validator = new TestValidator({ fuzzyThreshold: 0.5 });
      
      const result = validator.validate('tast', 'test'); // 0.5 similarity
      expect(result.isCorrect).toBe(true);
      expect(result.partialCredit).toBe(0.5);
    });

    it('should handle case normalization in fuzzy matching', () => {
      const similarity = validator['calculateSimilarity']('TEST', 'test');
      expect(similarity).toBe(1); // Should be exact match with case normalization
    });
  });

  describe('Custom Validation Rules', () => {
    it('should apply custom rules', () => {
      const customRule: ValidationRule = {
        name: 'starts-with-t',
        test: (input, expected) => input.startsWith('t'),
        weight: 1.0
      };
      
      validator = new TestValidator({
        customRules: [customRule]
      });
      
      const result = validator.validate('totally-wrong', 'correct-answer');
      expect(result.isCorrect).toBe(true);
      expect(result.feedback).toBe('Correct (custom rule)');
    });

    it('should handle multiple custom rules', () => {
      const rules: ValidationRule[] = [
        {
          name: 'length-check',
          test: (input, expected) => input.length === expected.length,
          weight: 0.5
        },
        {
          name: 'first-char',
          test: (input, expected) => input[0] === expected[0],
          weight: 0.5
        }
      ];
      
      validator = new TestValidator({ customRules: rules });
      
      const result1 = validator.validate('test', 'task'); // Both rules pass
      expect(result1.isCorrect).toBe(true);
      
      const result2 = validator.validate('test', 'tasks'); // Length rule fails
      expect(result2.isCorrect).toBe(false);
    });

    it('should calculate weighted scores', () => {
      const factors = [
        { score: 1.0, weight: 0.5 },
        { score: 0.5, weight: 0.3 },
        { score: 0.8, weight: 0.2 }
      ];
      
      const weightedScore = validator['calculateWeightedScore'](factors);
      expect(weightedScore).toBeCloseTo(0.81, 2); // (1*0.5 + 0.5*0.3 + 0.8*0.2) / 1
    });

    it('should handle empty custom rules', () => {
      validator = new TestValidator({ customRules: [] });
      
      const result = validator.validate('wrong', 'correct');
      expect(result.isCorrect).toBe(false);
    });
  });

  describe('Feedback Generation', () => {
    it('should generate appropriate feedback based on similarity', () => {
      expect(validator['generateFeedback']('test', 'test', 1.0))
        .toBe('Perfect!');
      
      expect(validator['generateFeedback']('test', 'tost', 0.9))
        .toBe('Almost correct! Check your spelling.');
      
      expect(validator['generateFeedback']('test', 'tast', 0.75))
        .toBe('Close, but there are some mistakes.');
      
      expect(validator['generateFeedback']('test', 'task', 0.6))
        .toBe('Partially correct. Review the correct answer.');
      
      expect(validator['generateFeedback']('test', 'abcd', 0.2))
        .toBe('Incorrect. Study this item more.');
    });

    it('should identify specific corrections', () => {
      const corrections = validator['identifyCorrections']('tost', 'test');
      
      expect(corrections).toContain('Character 2: "o" should be "e"');
    });

    it('should identify missing characters', () => {
      const corrections = validator['identifyCorrections']('tes', 'test');
      
      expect(corrections).toContain('Missing 1 character(s)');
    });

    it('should identify extra characters', () => {
      const corrections = validator['identifyCorrections']('tests', 'test');
      
      expect(corrections).toContain('1 extra character(s)');
    });

    it('should handle completely different strings', () => {
      const corrections = validator['identifyCorrections']('abc', 'xyz');
      
      expect(corrections).toHaveLength(3);
      expect(corrections[0]).toContain('Character 1');
      expect(corrections[1]).toContain('Character 2');
      expect(corrections[2]).toContain('Character 3');
    });
  });

  describe('Complex Validation Scenarios', () => {
    it('should handle mixed case and punctuation', () => {
      validator = new TestValidator({
        caseSensitive: false,
        ignorePunctuation: true
      });
      
      const result = validator.validate("It's a test!", 'its a test');
      expect(result.isCorrect).toBe(true);
    });

    it('should prioritize exact match over fuzzy match', () => {
      const result = validator.validate('test', ['tost', 'test', 'tast']);
      
      expect(result.isCorrect).toBe(true);
      expect(result.confidence).toBe(1.0);
      expect(result.feedback).toBe('Perfect!');
    });

    it('should find best fuzzy match from array', () => {
      const result = validator.validate('tost', ['abcd', 'wxyz', 'test']);
      
      expect(result.isCorrect).toBe(false); // Below default threshold
      expect(result.confidence).toBeCloseTo(0.75, 2);
      expect(result.corrections).toContain('Character 2: "o" should be "e"');
    });

    it('should handle Unicode characters', () => {
      const result1 = validator.validate('こんにちは', 'こんにちは');
      expect(result1.isCorrect).toBe(true);
      
      const result2 = validator.validate('こんにちわ', 'こんにちは');
      expect(result2.isCorrect).toBe(false);
      expect(result2.confidence).toBeCloseTo(0.8, 1);
    });

    it('should handle emojis', () => {
      const result = validator.validate('👍', '👍');
      expect(result.isCorrect).toBe(true);
      
      const result2 = validator.validate('👍', '👎');
      expect(result2.isCorrect).toBe(false);
    });
  });

  describe('Performance Considerations', () => {
    it('should handle long strings efficiently', () => {
      const longString = 'a'.repeat(1000);
      const start = Date.now();
      
      validator.validate(longString, longString);
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100); // Should complete within 100ms
    });

    it('should handle many alternative answers', () => {
      const alternatives = Array.from({ length: 100 }, (_, i) => `answer${i}`);
      
      const start = Date.now();
      const result = validator.validate('answer50', alternatives);
      
      const duration = Date.now() - start;
      expect(result.isCorrect).toBe(true);
      expect(duration).toBeLessThan(50);
    });

    it('should cache normalized strings during comparison', () => {
      // This is more of an implementation detail test
      const spy = jest.spyOn(validator as any, 'normalize');
      
      validator.validate('TEST', ['test', 'Test', 'TEST']);
      
      // Should normalize input once, and each answer once
      expect(spy).toHaveBeenCalledTimes(4);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null/undefined gracefully', () => {
      // @ts-expect-error - Testing runtime behavior
      const result1 = validator.validate(null, 'test');
      expect(result1.isCorrect).toBe(false);
      
      // @ts-expect-error - Testing runtime behavior
      const result2 = validator.validate('test', null);
      expect(result2.isCorrect).toBe(false);
    });

    it('should handle special regex characters', () => {
      const result = validator.validate('test.*', 'test.*');
      expect(result.isCorrect).toBe(true);
    });

    it('should handle strings with only whitespace', () => {
      const result1 = validator.validate('   ', 'test');
      expect(result1.isCorrect).toBe(false);
      
      validator = new TestValidator({ ignoreSpaces: true });
      const result2 = validator.validate('   ', '');
      expect(result2.isCorrect).toBe(true);
    });

    it('should handle very similar strings', () => {
      const result = validator.validate('test1', 'test2');
      expect(result.isCorrect).toBe(false);
      expect(result.confidence).toBeCloseTo(0.8, 1);
    });
  });

  describe('Options Validation', () => {
    it('should use default options', () => {
      validator = new TestValidator();
      
      expect(validator['options']).toMatchObject({
        caseSensitive: false,
        ignoreSpaces: false,
        ignorePunctuation: false,
        allowRomaji: false,
        fuzzyThreshold: 0.85
      });
    });

    it('should merge custom options with defaults', () => {
      validator = new TestValidator({
        caseSensitive: true,
        fuzzyThreshold: 0.7
      });
      
      expect(validator['options']).toMatchObject({
        caseSensitive: true,
        ignoreSpaces: false,
        ignorePunctuation: false,
        fuzzyThreshold: 0.7
      });
    });

    it('should handle invalid threshold values', () => {
      validator = new TestValidator({ fuzzyThreshold: 1.5 });
      
      // Should still work, just won't match fuzzy
      const result = validator.validate('tost', 'test');
      expect(result.isCorrect).toBe(false);
    });
  });
});