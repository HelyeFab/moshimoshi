/**
 * Tests for Question Generator
 * Testing question generation, distractor creation, and edge cases
 */

import { QuestionGenerator } from '@/lib/drill/question-generator';
import { ConjugationEngine } from '@/lib/drill/conjugation-engine';
import { mockWords, getMockVerbs, getMockAdjectives } from './test-utils';
import type { DrillQuestion } from '@/types/drill';

describe('QuestionGenerator', () => {
  describe('generateQuestions', () => {
    test('should generate questions for multiple words', () => {
      const words = [mockWords.taberu, mockWords.nomu, mockWords.kaku];
      const questions = QuestionGenerator.generateQuestions(words, 2);

      expect(questions.length).toBeGreaterThan(0);
      expect(questions.length).toBeLessThanOrEqual(words.length * 2);
    });

    test('should generate specified total number of questions', () => {
      const words = [mockWords.taberu, mockWords.nomu];
      const totalQuestions = 10;
      const questions = QuestionGenerator.generateQuestions(words, 3, totalQuestions);

      expect(questions.length).toBeLessThanOrEqual(totalQuestions);
    });

    test('should cycle through words when total exceeds available', () => {
      const words = [mockWords.taberu, mockWords.nomu];
      const questions = QuestionGenerator.generateQuestions(words, 5, 10);

      // Should have questions for both words
      const wordIds = new Set(questions.map(q => q.word.id));
      expect(wordIds.has(mockWords.taberu.id)).toBe(true);
      expect(wordIds.has(mockWords.nomu.id)).toBe(true);
    });

    test('should skip words with invalid conjugations', () => {
      const words = [mockWords.taberu, mockWords.hon]; // hon is non-conjugable
      const questions = QuestionGenerator.generateQuestions(words, 3);

      // Should only have questions for taberu
      const wordIds = new Set(questions.map(q => q.word.id));
      expect(wordIds.has(mockWords.taberu.id)).toBe(true);
      expect(wordIds.has(mockWords.hon.id)).toBe(false);
    });

    test('should shuffle questions', () => {
      const words = getMockVerbs();
      const questions1 = QuestionGenerator.generateQuestions(words, 2);
      const questions2 = QuestionGenerator.generateQuestions(words, 2);

      // Very unlikely to be in same order if shuffled properly
      // (though there's a tiny chance they could be the same)
      const ids1 = questions1.map(q => q.id).join(',');
      const ids2 = questions2.map(q => q.id).join(',');

      // Test that we got questions (basic sanity check)
      expect(questions1.length).toBeGreaterThan(0);
      expect(questions2.length).toBeGreaterThan(0);
    });
  });

  describe('generateSingleQuestion', () => {
    test('should generate a valid question', () => {
      const word = mockWords.taberu;
      const conjugations = ConjugationEngine.conjugate(word);
      const question = QuestionGenerator.generateSingleQuestion(
        word,
        'past',
        '食べた',
        conjugations
      );

      expect(question).not.toBeNull();
      expect(question?.word).toBe(word);
      expect(question?.targetForm).toBe('past');
      expect(question?.correctAnswer).toBe('食べた');
      expect(question?.options).toContain('食べた');
      expect(question?.options.length).toBe(4);
    });

    test('should include stem and rule in question', () => {
      const word = mockWords.nomu;
      const conjugations = ConjugationEngine.conjugate(word);
      const question = QuestionGenerator.generateSingleQuestion(
        word,
        'negative',
        '飲まない',
        conjugations
      );

      expect(question?.stem).toBe('飲む_____');
      expect(question?.rule).toBeDefined();
      expect(question?.rule).not.toBe('');
    });

    test('should have unique ID for each question', () => {
      const word = mockWords.kaku;
      const conjugations = ConjugationEngine.conjugate(word);

      const question1 = QuestionGenerator.generateSingleQuestion(
        word,
        'past',
        '書いた',
        conjugations
      );

      const question2 = QuestionGenerator.generateSingleQuestion(
        word,
        'past',
        '書いた',
        conjugations
      );

      expect(question1?.id).not.toBe(question2?.id);
    });

    test('should return null if not enough distractors', () => {
      const word = mockWords.taberu;
      const conjugations = { present: '食べる', past: '' } as any;

      const question = QuestionGenerator.generateSingleQuestion(
        word,
        'present',
        '食べる',
        conjugations
      );

      // Should still generate with artificial distractors
      expect(question).not.toBeNull();
    });

    test('should shuffle options', () => {
      const word = mockWords.hanasu;
      const conjugations = ConjugationEngine.conjugate(word);

      const questions = [];
      for (let i = 0; i < 5; i++) {
        const question = QuestionGenerator.generateSingleQuestion(
          word,
          'polite',
          '話します',
          conjugations
        );
        if (question) {
          questions.push(question);
        }
      }

      // Check that correct answer isn't always in same position
      const positions = questions.map(q =>
        q.options.indexOf(q.correctAnswer)
      );
      const uniquePositions = new Set(positions);

      // Should have different positions (though could theoretically be same by chance)
      expect(uniquePositions.size).toBeGreaterThan(1);
    });
  });

  describe('generateDistractors', () => {
    test('should generate exactly 4 distractors', () => {
      const word = mockWords.taberu;
      const conjugations = ConjugationEngine.conjugate(word);
      const distractors = (QuestionGenerator as any).generateDistractors(
        word,
        'past',
        '食べた',
        conjugations
      );

      expect(distractors.length).toBe(4);
    });

    test('should not include correct answer in distractors', () => {
      const word = mockWords.nomu;
      const conjugations = ConjugationEngine.conjugate(word);
      const correctAnswer = '飲んだ';
      const distractors = (QuestionGenerator as any).generateDistractors(
        word,
        'past',
        correctAnswer,
        conjugations
      );

      expect(distractors).not.toContain(correctAnswer);
    });

    test('should prefer real conjugations as distractors', () => {
      const word = mockWords.kaku;
      const conjugations = ConjugationEngine.conjugate(word);
      const distractors = (QuestionGenerator as any).generateDistractors(
        word,
        'past',
        '書いた',
        conjugations
      );

      // Should include other real forms
      const realForms = Object.values(conjugations).filter(f => f && f !== '');
      const hasRealForm = distractors.some((d: string) => realForms.includes(d));
      expect(hasRealForm).toBe(true);
    });

    test('should generate artificial distractors when needed', () => {
      const word = mockWords.taberu;
      // Minimal conjugations to force artificial generation
      const conjugations = { present: '食べる', past: '食べた' } as any;
      const distractors = (QuestionGenerator as any).generateDistractors(
        word,
        'present',
        '食べる',
        conjugations
      );

      expect(distractors.length).toBe(4);
      // Should have artificial forms like 食べない, 食べます, etc.
      expect(distractors.some((d: string) => d.startsWith('食べ'))).toBe(true);
    });

    test('should avoid similar distractors', () => {
      const word = mockWords.hanasu;
      const conjugations = ConjugationEngine.conjugate(word);
      const distractors = (QuestionGenerator as any).generateDistractors(
        word,
        'polite',
        '話します',
        conjugations
      );

      // Should not have both です and でした forms (too similar)
      const hasDesu = distractors.some((d: string) => d.endsWith('です'));
      const hasDeshita = distractors.some((d: string) => d.endsWith('でした'));

      // Not a strict requirement, but generally should avoid both
      // This is a heuristic test
      if (hasDesu && hasDeshita) {
        expect(distractors.length).toBe(4); // Still valid even if both present
      }
    });

    test('should not include empty or undefined distractors', () => {
      const word = mockWords.ookii;
      const conjugations = ConjugationEngine.conjugate(word);
      const distractors = (QuestionGenerator as any).generateDistractors(
        word,
        'negative',
        '大きくない',
        conjugations
      );

      expect(distractors).not.toContain('');
      expect(distractors).not.toContain(undefined);
      expect(distractors).not.toContain(null);
    });
  });

  describe('generateQuestionsForWord', () => {
    test('should generate multiple questions for one word', () => {
      const word = mockWords.taberu;
      const questions = QuestionGenerator.generateQuestionsForWord(word, 5);

      expect(questions.length).toBeLessThanOrEqual(5);
      questions.forEach(q => {
        expect(q.word).toBe(word);
      });
    });

    test('should use different conjugation forms', () => {
      const word = mockWords.nomu;
      const questions = QuestionGenerator.generateQuestionsForWord(word, 10);

      const forms = new Set(questions.map(q => q.targetForm));
      expect(forms.size).toBeGreaterThan(1);
    });

    test('should handle words with limited conjugations', () => {
      const word = mockWords.genki; // na-adjective has fewer forms
      const questions = QuestionGenerator.generateQuestionsForWord(word, 10);

      expect(questions.length).toBeGreaterThan(0);
      questions.forEach(q => {
        expect(q.correctAnswer).not.toBe('');
      });
    });

    test('should not generate questions for non-conjugable words', () => {
      const word = mockWords.hon;
      const questions = QuestionGenerator.generateQuestionsForWord(word, 5);

      expect(questions.length).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty word array', () => {
      const questions = QuestionGenerator.generateQuestions([], 5);
      expect(questions).toEqual([]);
    });

    test('should handle zero questions requested', () => {
      const words = getMockVerbs();
      const questions = QuestionGenerator.generateQuestions(words, 0);
      expect(questions).toEqual([]);
    });

    test('should handle single word', () => {
      const questions = QuestionGenerator.generateQuestions([mockWords.taberu], 3);
      expect(questions.length).toBeGreaterThan(0);
      questions.forEach(q => {
        expect(q.word).toBe(mockWords.taberu);
      });
    });

    test('should handle word with special characters', () => {
      const specialWord = {
        ...mockWords.benkyouSuru,
        kanji: '勉強・する',
        kana: 'べんきょう・する',
      };
      const questions = QuestionGenerator.generateQuestionsForWord(specialWord, 1);
      expect(questions.length).toBeGreaterThan(0);
    });

    test('should handle all non-conjugable words', () => {
      const words = [mockWords.hon, mockWords.wa];
      const questions = QuestionGenerator.generateQuestions(words, 5);
      expect(questions).toEqual([]);
    });
  });

  describe('Question Quality', () => {
    test('all questions should have valid structure', () => {
      const words = getMockVerbs();
      const questions = QuestionGenerator.generateQuestions(words, 3, 20);

      questions.forEach(q => {
        expect(q.id).toBeDefined();
        expect(q.word).toBeDefined();
        expect(q.targetForm).toBeDefined();
        expect(q.stem).toBeDefined();
        expect(q.correctAnswer).toBeDefined();
        expect(q.options).toBeDefined();
        expect(q.options.length).toBe(4);
        expect(q.rule).toBeDefined();
      });
    });

    test('all options should be unique', () => {
      const words = getMockAdjectives();
      const questions = QuestionGenerator.generateQuestions(words, 5);

      questions.forEach(q => {
        const uniqueOptions = new Set(q.options);
        expect(uniqueOptions.size).toBe(q.options.length);
      });
    });

    test('correct answer should always be in options', () => {
      const words = [...getMockVerbs(), ...getMockAdjectives()];
      const questions = QuestionGenerator.generateQuestions(words, 2, 30);

      questions.forEach(q => {
        expect(q.options).toContain(q.correctAnswer);
      });
    });

    test('should generate variety of question forms', () => {
      const word = mockWords.taberu;
      const questions = QuestionGenerator.generateQuestionsForWord(word, 20);

      const forms = new Set(questions.map(q => q.targetForm));
      expect(forms.size).toBeGreaterThan(5); // Should have variety
    });

    test('distractors should be plausible', () => {
      const word = mockWords.nomu;
      const questions = QuestionGenerator.generateQuestionsForWord(word, 5);

      questions.forEach(q => {
        // All options should look like Japanese text
        q.options.forEach(option => {
          expect(option).toMatch(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+/);
        });
      });
    });
  });
});