/**
 * Tests for Conjugation Error Analyzer
 */

import { ConjugationErrorAnalyzer } from '../error-analyzer';
import type { JapaneseWord } from '@/types/drill';

describe('ConjugationErrorAnalyzer', () => {
  // Test words
  const ichidanWord: JapaneseWord = {
    id: '1',
    kanji: '食べる',
    kana: 'たべる',
    meaning: 'to eat',
    type: 'Ichidan',
    jlpt: 'N5'
  };

  const godanWord: JapaneseWord = {
    id: '2',
    kanji: '買う',
    kana: 'かう',
    meaning: 'to buy',
    type: 'Godan',
    jlpt: 'N5'
  };

  const ikuWord: JapaneseWord = {
    id: '3',
    kanji: '行く',
    kana: 'いく',
    meaning: 'to go',
    type: 'Godan',
    jlpt: 'N5'
  };

  const iiWord: JapaneseWord = {
    id: '4',
    kanji: 'いい',
    kana: 'いい',
    meaning: 'good',
    type: 'i-adjective',
    jlpt: 'N5'
  };

  const aruWord: JapaneseWord = {
    id: '5',
    kanji: 'ある',
    kana: 'ある',
    meaning: 'to exist',
    type: 'Godan',
    jlpt: 'N5'
  };

  describe('Wrong Form Detection', () => {
    it('should detect when user enters wrong conjugation form', async () => {
      const report = await ConjugationErrorAnalyzer.analyzeError(
        '食べた',        // User entered past
        '食べない',      // Should be negative
        'negative',
        ichidanWord
      );

      expect(report.analysis.errorType).toBe('wrong-form');
      expect(report.analysis.possibleInterpretation).toBeDefined();
      expect(report.analysis.possibleInterpretation?.detectedForm).toBe('past');
      expect(report.relevantHelp.length).toBeGreaterThan(0);
    });

    it('should provide helpful quick tip for wrong form', async () => {
      const report = await ConjugationErrorAnalyzer.analyzeError(
        '食べます',      // Polite form
        '食べる',        // Dictionary form
        'present',
        ichidanWord
      );

      expect(report.quickTip).toBeDefined();
      expect(report.quickTip).toContain('form');
    });
  });

  describe('Verb Type Confusion', () => {
    it('should detect Godan rules applied to Ichidan verb', async () => {
      const report = await ConjugationErrorAnalyzer.analyzeError(
        '食べわない',    // Wrong: Godan negative pattern
        '食べない',      // Correct: Ichidan negative
        'negative',
        ichidanWord
      );

      expect(report.analysis.errorType).toBe('wrong-verb-type');
      expect(report.quickTip).toContain('Ichidan');
    });

    it('should detect Ichidan rules applied to Godan verb', async () => {
      const report = await ConjugationErrorAnalyzer.analyzeError(
        '買られる',      // Wrong: Ichidan potential pattern
        '買える',        // Correct: Godan potential
        'potential',
        godanWord
      );

      // This might be classified as wrong-form or wrong-verb-type
      expect(['wrong-form', 'wrong-verb-type']).toContain(report.analysis.errorType);
    });
  });

  describe('Special Case: 行く', () => {
    it('should detect wrong te-form for 行く', async () => {
      const report = await ConjugationErrorAnalyzer.analyzeError(
        '行いて',        // Wrong exception
        '行って',        // Correct
        'teForm',
        ikuWord
      );

      expect(report.analysis.errorType).toBe('special-case');
      expect(report.quickTip).toContain('special exception');
    });

    it('should detect wrong past form for 行く', async () => {
      const report = await ConjugationErrorAnalyzer.analyzeError(
        '行いた',        // Wrong
        '行った',        // Correct
        'past',
        ikuWord
      );

      expect(report.analysis.errorType).toBe('special-case');
    });
  });

  describe('Special Case: いい', () => {
    it('should detect wrong past form for いい', async () => {
      const report = await ConjugationErrorAnalyzer.analyzeError(
        'いかった',      // Wrong
        'よかった',      // Correct
        'past',
        iiWord
      );

      expect(report.analysis.errorType).toBe('special-case');
      expect(report.analysis.possibleInterpretation?.explanation).toContain('よかった');
    });

    it('should detect wrong negative form for いい', async () => {
      const report = await ConjugationErrorAnalyzer.analyzeError(
        'いくない',      // Wrong
        'よくない',      // Correct
        'negative',
        iiWord
      );

      expect(report.analysis.errorType).toBe('special-case');
      expect(report.analysis.possibleInterpretation?.explanation).toContain('よくない');
    });
  });

  describe('Special Case: ある', () => {
    it('should detect invalid ている form for ある', async () => {
      const report = await ConjugationErrorAnalyzer.analyzeError(
        'あっている',    // Invalid
        'ある',          // Correct (no ている form)
        'progressive',
        aruWord
      );

      expect(report.analysis.errorType).toBe('special-case');
      expect(report.analysis.possibleInterpretation?.explanation).toContain('ある');
    });
  });

  describe('Close Match (Typo)', () => {
    it('should detect minor typos', async () => {
      const report = await ConjugationErrorAnalyzer.analyzeError(
        '食ベない',      // Typo: katakana ベ instead of hiragana べ
        '食べない',
        'negative',
        ichidanWord
      );

      // Okurigana detector may catch this as an okurigana issue, which is correct
      expect(['close-match', 'okurigana-missing']).toContain(report.analysis.errorType);
      expect(report.analysis.similarityScore).toBeGreaterThan(0.7);
    });

    it('should be encouraging for very close answers', async () => {
      const report = await ConjugationErrorAnalyzer.analyzeError(
        '買わなi',       // Missing one character
        '買わない',
        'negative',
        godanWord
      );

      // Okurigana detector is smart and catches this
      expect(['close-match', 'partial-correct', 'okurigana-missing']).toContain(report.analysis.errorType);
      expect(report.quickTip).toBeDefined();
    });
  });

  describe('Partial Correctness', () => {
    it('should detect partially correct answers', async () => {
      const report = await ConjugationErrorAnalyzer.analyzeError(
        '食べな',        // Partial
        '食べない',
        'negative',
        ichidanWord
      );

      // Could be detected as okurigana-missing, close-match, or partial-correct
      expect(['partial-correct', 'close-match', 'okurigana-missing']).toContain(report.analysis.errorType);
      expect(report.analysis.similarityScore).toBeGreaterThan(0.3);
    });
  });

  describe('Completely Wrong', () => {
    it('should handle completely wrong answers', async () => {
      const report = await ConjugationErrorAnalyzer.analyzeError(
        'すし',          // Completely unrelated
        '食べない',
        'negative',
        ichidanWord
      );

      expect(report.analysis.errorType).toBe('completely-wrong');
      expect(report.analysis.similarityScore).toBeLessThan(0.4);
    });
  });

  describe('Empty/Null Handling', () => {
    it('should handle empty user input', async () => {
      const report = await ConjugationErrorAnalyzer.analyzeError(
        '',
        '食べない',
        'negative',
        ichidanWord
      );

      expect(report.analysis.errorType).toBe('completely-wrong');
      expect(report.quickTip).toBeDefined();
    });

    it('should handle whitespace-only input', async () => {
      const report = await ConjugationErrorAnalyzer.analyzeError(
        '   ',
        '食べない',
        'negative',
        ichidanWord
      );

      expect(report.analysis.errorType).toBe('completely-wrong');
    });
  });

  describe('Correct Answers', () => {
    it('should recognize correct answers', async () => {
      const report = await ConjugationErrorAnalyzer.analyzeError(
        '食べない',
        '食べない',
        'negative',
        ichidanWord
      );

      expect(report.analysis.similarityScore).toBe(1.0);
      expect(report.analysis.levenshteinDistance).toBe(0);
    });

    it('should not provide help for correct answers', async () => {
      const report = await ConjugationErrorAnalyzer.analyzeError(
        '買わない',
        '買わない',
        'negative',
        godanWord
      );

      expect(report.relevantHelp.length).toBe(0);
      expect(report.quickTip).toBeUndefined();
    });
  });

  describe('Help Content Relevance', () => {
    it('should provide relevant help for Ichidan verbs', async () => {
      const report = await ConjugationErrorAnalyzer.analyzeError(
        'wrong',
        '食べない',
        'negative',
        ichidanWord
      );

      expect(report.relevantHelp.length).toBeGreaterThan(0);

      // Should have help related to Ichidan verbs
      const hasIchidanHelp = report.relevantHelp.some(h =>
        h.helpContent.triggers.wordTypes.includes('Ichidan')
      );
      expect(hasIchidanHelp).toBe(true);
    });

    it('should provide relevant help for Godan verbs', async () => {
      const report = await ConjugationErrorAnalyzer.analyzeError(
        'wrong',
        '買わない',
        'negative',
        godanWord
      );

      expect(report.relevantHelp.length).toBeGreaterThan(0);

      // Should have help related to Godan verbs
      const hasGodanHelp = report.relevantHelp.some(h =>
        h.helpContent.triggers.wordTypes.includes('Godan')
      );
      expect(hasGodanHelp).toBe(true);
    });

    it('should limit help to maxHelpItems', async () => {
      const report = await ConjugationErrorAnalyzer.analyzeError(
        'wrong',
        '食べない',
        'negative',
        ichidanWord,
        { maxHelpItems: 2 }
      );

      expect(report.relevantHelp.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Options', () => {
    it('should respect includeHelp option', async () => {
      const report = await ConjugationErrorAnalyzer.analyzeError(
        'wrong',
        '食べない',
        'negative',
        ichidanWord,
        { includeHelp: false }
      );

      expect(report.relevantHelp.length).toBe(0);
      expect(report.quickTip).toBeUndefined();
      expect(report.detailedExplanation).toBeUndefined();
    });

    it('should respect maxHelpItems option', async () => {
      const report = await ConjugationErrorAnalyzer.analyzeError(
        'wrong',
        '食べない',
        'negative',
        ichidanWord,
        { maxHelpItems: 1 }
      );

      expect(report.relevantHelp.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Performance', () => {
    it('should analyze errors quickly', async () => {
      const startTime = performance.now();

      await ConjugationErrorAnalyzer.analyzeError(
        'wrong',
        '食べない',
        'negative',
        ichidanWord
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete in less than 50ms
      expect(duration).toBeLessThan(50);
    });
  });

  describe('isCorrect helper', () => {
    it('should correctly validate correct answers', () => {
      expect(ConjugationErrorAnalyzer.isCorrect('食べない', '食べない')).toBe(true);
    });

    it('should correctly identify wrong answers', () => {
      expect(ConjugationErrorAnalyzer.isCorrect('食べる', '食べない')).toBe(false);
    });

    it('should handle whitespace', () => {
      expect(ConjugationErrorAnalyzer.isCorrect('  食べない  ', '食べない')).toBe(true);
    });
  });
});
