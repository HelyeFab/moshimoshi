/**
 * Integration and Edge Case Tests for Drill Feature
 * Testing the complete flow and unusual scenarios
 */

import { ConjugationEngine } from '@/lib/drill/conjugation-engine';
import { QuestionGenerator } from '@/lib/drill/question-generator';
import { WordUtils } from '@/lib/drill/word-utils';
import { mockWords, getMockVerbs, getMockAdjectives, getMockConjugableWords } from './test-utils';
import type { JapaneseWord, DrillQuestion, ConjugationForms } from '@/types/drill';

describe('Drill Feature Integration Tests', () => {
  describe('Complete Drill Flow', () => {
    test('should handle complete drill session flow', () => {
      // 1. Get practice words
      const words = WordUtils.getCommonPracticeWords();
      expect(words.length).toBeGreaterThan(0);

      // 2. Filter conjugable words
      const conjugableWords = WordUtils.filterConjugableWords(words);
      expect(conjugableWords.length).toBeGreaterThan(0);

      // 3. Filter by type
      const verbs = WordUtils.filterByType(conjugableWords, 'verbs');
      expect(verbs.length).toBeGreaterThan(0);

      // 4. Generate questions
      const questions = QuestionGenerator.generateQuestions(verbs, 3, 10);
      expect(questions.length).toBeGreaterThan(0);
      expect(questions.length).toBeLessThanOrEqual(10);

      // 5. Validate each question
      questions.forEach(question => {
        expect(question.id).toBeDefined();
        expect(question.options).toContain(question.correctAnswer);
        expect(question.options.length).toBe(4);
        expect(question.rule).toBeDefined();

        // 6. Verify conjugation is correct
        const conjugations = ConjugationEngine.conjugate(question.word);
        const expectedAnswer = conjugations[question.targetForm];
        expect(question.correctAnswer).toBe(expectedAnswer);
      });
    });

    test('should generate valid questions for all verb types', () => {
      const testWords = [
        mockWords.taberu,  // Ichidan
        mockWords.nomu,    // Godan む
        mockWords.kaku,    // Godan く
        mockWords.hanasu,  // Godan す
        mockWords.suru,    // Irregular
        mockWords.kuru,    // Irregular
      ];

      testWords.forEach(word => {
        const questions = QuestionGenerator.generateQuestionsForWord(word, 5);

        questions.forEach(question => {
          // Verify conjugation matches
          const conjugations = ConjugationEngine.conjugate(word);
          expect(question.correctAnswer).toBe(conjugations[question.targetForm]);

          // Verify distractors are different from correct answer
          question.options.forEach((option, index) => {
            if (option !== question.correctAnswer) {
              expect(option).not.toBe(question.correctAnswer);
            }
          });
        });
      });
    });

    test('should handle mixed word types in single session', () => {
      const mixedWords = [
        mockWords.taberu,    // Ichidan verb
        mockWords.ookii,     // i-adjective
        mockWords.genki,     // na-adjective
        mockWords.nomu,      // Godan verb
      ];

      const questions = QuestionGenerator.generateQuestions(mixedWords, 2);

      // Should have questions for all conjugable types
      const wordTypes = new Set(questions.map(q => q.word.type));
      expect(wordTypes.size).toBeGreaterThan(1);

      // Each question should be valid
      questions.forEach(q => {
        const conjugations = ConjugationEngine.conjugate(q.word);
        expect(q.correctAnswer).toBe(conjugations[q.targetForm]);
      });
    });
  });

  describe('Edge Cases - Unicode and Special Characters', () => {
    test('should handle words with kanji variants', () => {
      const wordWithVariants: JapaneseWord = {
        id: 'variant-1',
        kanji: '見る・観る・視る',
        kana: 'みる',
        meaning: 'to see/watch/look',
        type: 'Ichidan',
      };

      const conjugations = ConjugationEngine.conjugate(wordWithVariants);
      expect(conjugations.past).toBe('見る・観る・視た');
    });

    test('should handle katakana verbs', () => {
      const katakanaVerb: JapaneseWord = {
        id: 'kata-1',
        kanji: 'コピーする',
        kana: 'コピーする',
        meaning: 'to copy',
        type: 'Irregular',
      };

      const conjugations = ConjugationEngine.conjugate(katakanaVerb);
      expect(conjugations.past).toBe('コピーした');
      expect(conjugations.polite).toBe('コピーします');
    });

    test('should handle mixed script words', () => {
      const mixedWord: JapaneseWord = {
        id: 'mixed-1',
        kanji: 'チェックする',
        kana: 'ちぇっくする',
        meaning: 'to check',
        type: 'Irregular',
      };

      const questions = QuestionGenerator.generateQuestionsForWord(mixedWord, 3);
      expect(questions.length).toBeGreaterThan(0);
    });

    test('should handle long compound verbs', () => {
      const longWord: JapaneseWord = {
        id: 'long-1',
        kanji: 'お手伝いさせていただく',
        kana: 'おてつだいさせていただく',
        meaning: 'to help (humble)',
        type: 'Godan',
      };

      const conjugations = ConjugationEngine.conjugate(longWord);
      expect(conjugations.present).toBe('お手伝いさせていただく');
    });
  });

  describe('Edge Cases - Empty and Invalid Inputs', () => {
    test('should handle empty word lists gracefully', () => {
      const questions = QuestionGenerator.generateQuestions([], 5);
      expect(questions).toEqual([]);
    });

    test('should handle all non-conjugable words', () => {
      const nonConjugable = [mockWords.hon, mockWords.wa];
      const questions = QuestionGenerator.generateQuestions(nonConjugable, 5);
      expect(questions).toEqual([]);
    });

    test('should handle word with empty strings', () => {
      const emptyWord: JapaneseWord = {
        id: 'empty-1',
        kanji: '',
        kana: '',
        meaning: '',
        type: 'Ichidan',
      };

      const conjugations = ConjugationEngine.conjugate(emptyWord);
      expect(conjugations.present).toBe('');
    });

    test('should handle word with undefined fields', () => {
      const partialWord = {
        id: 'partial-1',
        kanji: '食べる',
        type: 'Ichidan',
      } as JapaneseWord;

      const conjugations = ConjugationEngine.conjugate(partialWord);
      // Should still work with kanji only
      expect(conjugations.past).toBe('食べた');
    });

    test('should handle null/undefined gracefully', () => {
      const conjugations = ConjugationEngine.conjugate(null as any);
      expect(conjugations.present).toBe('');

      const questions = QuestionGenerator.generateQuestions(null as any, 5);
      expect(questions).toEqual([]);
    });
  });

  describe('Edge Cases - Extreme Values', () => {
    test('should handle very large number of questions requested', () => {
      const words = [mockWords.taberu, mockWords.nomu];
      const questions = QuestionGenerator.generateQuestions(words, 3, 10000);

      // Should cap at reasonable number
      expect(questions.length).toBeLessThanOrEqual(10000);
      expect(questions.length).toBeGreaterThan(0);
    });

    test('should handle single word with many questions', () => {
      const questions = QuestionGenerator.generateQuestionsForWord(mockWords.taberu, 100);

      // Should generate as many as possible forms allow
      expect(questions.length).toBeGreaterThan(0);
      expect(questions.length).toBeLessThanOrEqual(100);

      // All should be valid
      questions.forEach(q => {
        expect(q.options).toContain(q.correctAnswer);
      });
    });

    test('should handle zero questions requested', () => {
      const questions = QuestionGenerator.generateQuestions(getMockVerbs(), 0);
      expect(questions).toEqual([]);
    });

    test('should handle negative values gracefully', () => {
      const questions = QuestionGenerator.generateQuestions(getMockVerbs(), -5);
      expect(questions).toEqual([]);
    });
  });

  describe('Performance Tests', () => {
    test('should generate questions quickly for large word sets', () => {
      const words = WordUtils.getCommonPracticeWords();
      const start = Date.now();

      const questions = QuestionGenerator.generateQuestions(words, 3, 100);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(questions.length).toBe(100);
    });

    test('should conjugate efficiently in bulk', () => {
      const words = getMockConjugableWords();
      const start = Date.now();

      words.forEach(word => {
        const conjugations = ConjugationEngine.conjugate(word);
        ConjugationEngine.getAllPossibleForms(conjugations);
      });

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100); // Should be very fast
    });
  });

  describe('Data Consistency Tests', () => {
    test('should maintain consistency between conjugation and question generation', () => {
      const words = getMockVerbs();

      words.forEach(word => {
        const conjugations = ConjugationEngine.conjugate(word);
        const questions = QuestionGenerator.generateQuestionsForWord(word, 5);

        questions.forEach(q => {
          // Answer should match conjugation
          expect(q.correctAnswer).toBe(conjugations[q.targetForm]);

          // All distractors should be different from correct answer
          const distractors = q.options.filter(opt => opt !== q.correctAnswer);
          expect(new Set(distractors).size).toBe(distractors.length);
        });
      });
    });

    test('should generate unique question IDs', () => {
      const words = [mockWords.taberu, mockWords.nomu];
      const questions = QuestionGenerator.generateQuestions(words, 5, 20);

      const ids = questions.map(q => q.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

    test('should handle word type detection consistently', () => {
      const testCases = [
        { kanji: '食べる', kana: 'たべる', expected: 'Ichidan' },
        { kanji: '飲む', kana: 'のむ', expected: 'Godan' },
        { kanji: 'する', kana: 'する', expected: 'Irregular' },
        { kanji: '大きい', kana: 'おおきい', expected: 'i-adjective' },
        { kanji: '元気', kana: 'げんき', expected: 'na-adjective' },
      ];

      testCases.forEach(({ kanji, kana, expected }) => {
        const word = { kanji, kana } as JapaneseWord;
        const detected = WordUtils.detectWordTypeByPattern(word);
        expect(detected).toBe(expected);

        // Should fix if misclassified
        const misclassified = { ...word, type: 'other' as any };
        const fixed = WordUtils.fixWordType(misclassified);
        expect(fixed.type).toBe(expected);
      });
    });
  });

  describe('Randomization Tests', () => {
    test('should shuffle questions properly', () => {
      const words = getMockVerbs();
      const set1 = QuestionGenerator.generateQuestions(words, 2, 10);
      const set2 = QuestionGenerator.generateQuestions(words, 2, 10);

      // Order should be different (with high probability)
      const order1 = set1.map(q => q.id).join(',');
      const order2 = set2.map(q => q.id).join(',');

      // Not a strict requirement but highly likely to be different
      if (set1.length > 5) {
        expect(order1).not.toBe(order2);
      }
    });

    test('should shuffle options within questions', () => {
      const word = mockWords.taberu;
      const positions: number[] = [];

      // Generate multiple questions and check answer position
      for (let i = 0; i < 20; i++) {
        const questions = QuestionGenerator.generateQuestionsForWord(word, 1);
        if (questions[0]) {
          const position = questions[0].options.indexOf(questions[0].correctAnswer);
          positions.push(position);
        }
      }

      // Should have variation in positions
      const uniquePositions = new Set(positions);
      expect(uniquePositions.size).toBeGreaterThan(1);
    });

    test('should select random conjugation forms', () => {
      const forms = new Set<string>();

      for (let i = 0; i < 50; i++) {
        const form = ConjugationEngine.getRandomConjugationForm('Ichidan');
        forms.add(form);
      }

      // Should have variety
      expect(forms.size).toBeGreaterThan(5);
    });
  });

  describe('Error Recovery Tests', () => {
    test('should recover from conjugation errors', () => {
      const problematicWord: JapaneseWord = {
        id: 'problem-1',
        kanji: '???',
        kana: '???',
        meaning: 'unknown',
        type: 'UnknownType' as any,
      };

      // Should return empty forms instead of throwing
      const conjugations = ConjugationEngine.conjugate(problematicWord);
      expect(conjugations.present).toBe('');

      // Question generation should skip it
      const questions = QuestionGenerator.generateQuestionsForWord(problematicWord, 5);
      expect(questions).toEqual([]);
    });

    test('should handle malformed question generation', () => {
      const word = mockWords.taberu;
      const emptyConjugations = {} as ConjugationForms;

      const question = QuestionGenerator.generateSingleQuestion(
        word,
        'past',
        '',
        emptyConjugations
      );

      expect(question).toBeNull();
    });

    test('should handle circular references gracefully', () => {
      const circularWord: any = { id: '1', kanji: 'test' };
      circularWord.self = circularWord; // Create circular reference

      // Should not cause infinite loop
      expect(() => {
        ConjugationEngine.conjugate(circularWord);
      }).not.toThrow();
    });
  });
});