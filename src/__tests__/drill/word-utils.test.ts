/**
 * Tests for Word Utilities
 * Testing word type detection, filtering, and utilities
 */

import { WordUtils } from '@/lib/drill/word-utils';
import { mockWords, getMockVerbs, getMockAdjectives, getMockNonConjugableWords } from './test-utils';
import type { JapaneseWord, WordType } from '@/types/drill';

describe('WordUtils', () => {
  describe('isConjugable', () => {
    test('should identify conjugable verbs', () => {
      expect(WordUtils.isConjugable(mockWords.taberu)).toBe(true);
      expect(WordUtils.isConjugable(mockWords.nomu)).toBe(true);
      expect(WordUtils.isConjugable(mockWords.suru)).toBe(true);
      expect(WordUtils.isConjugable(mockWords.kuru)).toBe(true);
    });

    test('should identify conjugable adjectives', () => {
      expect(WordUtils.isConjugable(mockWords.ookii)).toBe(true);
      expect(WordUtils.isConjugable(mockWords.genki)).toBe(true);
    });

    test('should identify non-conjugable words', () => {
      expect(WordUtils.isConjugable(mockWords.hon)).toBe(false);
      expect(WordUtils.isConjugable(mockWords.wa)).toBe(false);
    });
  });

  describe('isConjugableType', () => {
    test('should correctly identify conjugable types', () => {
      expect(WordUtils.isConjugableType('Ichidan')).toBe(true);
      expect(WordUtils.isConjugableType('Godan')).toBe(true);
      expect(WordUtils.isConjugableType('Irregular')).toBe(true);
      expect(WordUtils.isConjugableType('i-adjective')).toBe(true);
      expect(WordUtils.isConjugableType('na-adjective')).toBe(true);
    });

    test('should correctly identify non-conjugable types', () => {
      expect(WordUtils.isConjugableType('noun')).toBe(false);
      expect(WordUtils.isConjugableType('particle')).toBe(false);
      expect(WordUtils.isConjugableType('adverb')).toBe(false);
      expect(WordUtils.isConjugableType('other')).toBe(false);
    });
  });

  describe('filterConjugableWords', () => {
    test('should filter out non-conjugable words', () => {
      const allWords = Object.values(mockWords);
      const conjugable = WordUtils.filterConjugableWords(allWords);

      expect(conjugable).toContain(mockWords.taberu);
      expect(conjugable).toContain(mockWords.ookii);
      expect(conjugable).not.toContain(mockWords.hon);
      expect(conjugable).not.toContain(mockWords.wa);
    });

    test('should handle empty array', () => {
      expect(WordUtils.filterConjugableWords([])).toEqual([]);
    });

    test('should handle all conjugable words', () => {
      const verbs = getMockVerbs();
      const filtered = WordUtils.filterConjugableWords(verbs);
      expect(filtered).toEqual(verbs);
    });

    test('should handle all non-conjugable words', () => {
      const nonConjugable = getMockNonConjugableWords();
      const filtered = WordUtils.filterConjugableWords(nonConjugable);
      expect(filtered).toEqual([]);
    });
  });

  describe('detectWordTypeByPattern', () => {
    describe('Verb detection', () => {
      test('should detect Ichidan verbs by ending', () => {
        const testCases = [
          { kanji: '食べる', kana: 'たべる', expected: 'Ichidan' },
          { kanji: '見る', kana: 'みる', expected: 'Ichidan' },
          { kanji: '起きる', kana: 'おきる', expected: 'Ichidan' },
          { kanji: '教える', kana: 'おしえる', expected: 'Ichidan' },
        ];

        testCases.forEach(({ kanji, kana, expected }) => {
          const word = { kanji, kana } as JapaneseWord;
          expect(WordUtils.detectWordTypeByPattern(word)).toBe(expected);
        });
      });

      test('should detect Godan verbs by ending', () => {
        const testCases = [
          { kanji: '読む', kana: 'よむ', expected: 'Godan' },
          { kanji: '書く', kana: 'かく', expected: 'Godan' },
          { kanji: '話す', kana: 'はなす', expected: 'Godan' },
          { kanji: '待つ', kana: 'まつ', expected: 'Godan' },
          { kanji: '買う', kana: 'かう', expected: 'Godan' },
        ];

        testCases.forEach(({ kanji, kana, expected }) => {
          const word = { kanji, kana } as JapaneseWord;
          expect(WordUtils.detectWordTypeByPattern(word)).toBe(expected);
        });
      });

      test('should handle Godan る verbs correctly', () => {
        const testCases = [
          { kanji: '帰る', kana: 'かえる', expected: 'Godan' }, // Exception
          { kanji: '走る', kana: 'はしる', expected: 'Godan' },
          { kanji: '知る', kana: 'しる', expected: 'Godan' }, // Exception
        ];

        testCases.forEach(({ kanji, kana, expected }) => {
          const word = { kanji, kana } as JapaneseWord;
          expect(WordUtils.detectWordTypeByPattern(word)).toBe(expected);
        });
      });

      test('should detect irregular verbs', () => {
        const testCases = [
          { kanji: 'する', kana: 'する', expected: 'Irregular' },
          { kanji: '来る', kana: 'くる', expected: 'Irregular' },
          { kanji: '勉強する', kana: 'べんきょうする', expected: 'Irregular' },
          { kanji: '行く', kana: 'いく', expected: 'Irregular' },
        ];

        testCases.forEach(({ kanji, kana, expected }) => {
          const word = { kanji, kana } as JapaneseWord;
          expect(WordUtils.detectWordTypeByPattern(word)).toBe(expected);
        });
      });
    });

    describe('Adjective detection', () => {
      test('should detect i-adjectives', () => {
        const testCases = [
          { kanji: '大きい', kana: 'おおきい', expected: 'i-adjective' },
          { kanji: '小さい', kana: 'ちいさい', expected: 'i-adjective' },
          { kanji: '高い', kana: 'たかい', expected: 'i-adjective' },
        ];

        testCases.forEach(({ kanji, kana, expected }) => {
          const word = { kanji, kana } as JapaneseWord;
          expect(WordUtils.detectWordTypeByPattern(word)).toBe(expected);
        });
      });

      test('should detect na-adjectives', () => {
        const testCases = [
          { kanji: '元気', kana: 'げんき', expected: 'na-adjective' },
          { kanji: '静か', kana: 'しずか', expected: 'na-adjective' },
          { kanji: '有名', kana: 'ゆうめい', expected: 'na-adjective' },
          { kanji: '便利', kana: 'べんり', expected: 'na-adjective' },
        ];

        testCases.forEach(({ kanji, kana, expected }) => {
          const word = { kanji, kana } as JapaneseWord;
          expect(WordUtils.detectWordTypeByPattern(word)).toBe(expected);
        });
      });

      test('should handle na-adjective exceptions', () => {
        const testCases = [
          { kanji: '綺麗', kana: 'きれい', expected: 'na-adjective' },
          { kanji: '嫌い', kana: 'きらい', expected: 'na-adjective' },
        ];

        testCases.forEach(({ kanji, kana, expected }) => {
          const word = { kanji, kana } as JapaneseWord;
          expect(WordUtils.detectWordTypeByPattern(word)).toBe(expected);
        });
      });
    });

    describe('Other word types', () => {
      test('should default to other for unrecognized patterns', () => {
        const testCases = [
          { kanji: '本', kana: 'ほん' },
          { kanji: 'ペン', kana: 'ペン' },
          { kanji: 'これ', kana: 'これ' },
        ];

        testCases.forEach(({ kanji, kana }) => {
          const word = { kanji, kana } as JapaneseWord;
          expect(WordUtils.detectWordTypeByPattern(word)).toBe('other');
        });
      });

      test('should handle words with only kanji', () => {
        const word = { kanji: '食べる' } as JapaneseWord;
        expect(WordUtils.detectWordTypeByPattern(word)).toBe('other');
      });
    });
  });

  describe('fixWordType', () => {
    test('should not change correctly classified words', () => {
      const word = { ...mockWords.taberu };
      const fixed = WordUtils.fixWordType(word);
      expect(fixed.type).toBe('Ichidan');
      expect(fixed).toEqual(word);
    });

    test('should fix misclassified verbs', () => {
      const word = {
        ...mockWords.taberu,
        type: 'other' as WordType,
      };
      const fixed = WordUtils.fixWordType(word);
      expect(fixed.type).toBe('Ichidan');
    });

    test('should fix misclassified adjectives', () => {
      const word = {
        ...mockWords.ookii,
        type: 'noun' as WordType,
      };
      const fixed = WordUtils.fixWordType(word);
      expect(fixed.type).toBe('i-adjective');
    });

    test('should not change truly non-conjugable words', () => {
      const word = { ...mockWords.hon };
      const fixed = WordUtils.fixWordType(word);
      expect(fixed.type).toBe('noun');
    });
  });

  describe('filterByType', () => {
    test('should return all words when filter is "all"', () => {
      const words = Object.values(mockWords);
      const filtered = WordUtils.filterByType(words, 'all');
      expect(filtered).toEqual(words);
    });

    test('should filter only verbs', () => {
      const words = Object.values(mockWords);
      const filtered = WordUtils.filterByType(words, 'verbs');

      filtered.forEach(word => {
        expect(['Ichidan', 'Godan', 'Irregular']).toContain(word.type);
      });
      expect(filtered).toContain(mockWords.taberu);
      expect(filtered).toContain(mockWords.nomu);
      expect(filtered).not.toContain(mockWords.ookii);
      expect(filtered).not.toContain(mockWords.hon);
    });

    test('should filter only adjectives', () => {
      const words = Object.values(mockWords);
      const filtered = WordUtils.filterByType(words, 'adjectives');

      filtered.forEach(word => {
        expect(['i-adjective', 'na-adjective']).toContain(word.type);
      });
      expect(filtered).toContain(mockWords.ookii);
      expect(filtered).toContain(mockWords.genki);
      expect(filtered).not.toContain(mockWords.taberu);
      expect(filtered).not.toContain(mockWords.hon);
    });

    test('should handle empty array', () => {
      expect(WordUtils.filterByType([], 'verbs')).toEqual([]);
      expect(WordUtils.filterByType([], 'adjectives')).toEqual([]);
      expect(WordUtils.filterByType([], 'all')).toEqual([]);
    });
  });

  describe('getWordTypeDisplayName', () => {
    test('should return correct display names', () => {
      expect(WordUtils.getWordTypeDisplayName('Ichidan')).toBe('Ichidan Verb');
      expect(WordUtils.getWordTypeDisplayName('Godan')).toBe('Godan Verb');
      expect(WordUtils.getWordTypeDisplayName('Irregular')).toBe('Irregular Verb');
      expect(WordUtils.getWordTypeDisplayName('i-adjective')).toBe('I-Adjective');
      expect(WordUtils.getWordTypeDisplayName('na-adjective')).toBe('Na-Adjective');
      expect(WordUtils.getWordTypeDisplayName('noun')).toBe('Noun');
      expect(WordUtils.getWordTypeDisplayName('particle')).toBe('Particle');
      expect(WordUtils.getWordTypeDisplayName('other')).toBe('Other');
    });

    test('should handle unknown types', () => {
      expect(WordUtils.getWordTypeDisplayName('unknown' as WordType)).toBe('unknown');
    });
  });

  describe('getCommonPracticeWords', () => {
    test('should return array of practice words', () => {
      const words = WordUtils.getCommonPracticeWords();
      expect(Array.isArray(words)).toBe(true);
      expect(words.length).toBeGreaterThan(0);
    });

    test('should include various word types', () => {
      const words = WordUtils.getCommonPracticeWords();
      const types = new Set(words.map(w => w.type));

      expect(types.has('Ichidan')).toBe(true);
      expect(types.has('Godan')).toBe(true);
      expect(types.has('Irregular')).toBe(true);
      expect(types.has('i-adjective')).toBe(true);
      expect(types.has('na-adjective')).toBe(true);
    });

    test('should have valid word structure', () => {
      const words = WordUtils.getCommonPracticeWords();
      words.forEach(word => {
        expect(word.id).toBeDefined();
        expect(word.kanji).toBeDefined();
        expect(word.kana).toBeDefined();
        expect(word.meaning).toBeDefined();
        expect(word.type).toBeDefined();
        expect(word.jlpt).toBeDefined();
      });
    });

    test('should include common JLPT N5 words', () => {
      const words = WordUtils.getCommonPracticeWords();
      const n5Words = words.filter(w => w.jlpt === 'N5');
      expect(n5Words.length).toBeGreaterThan(0);

      // Check for some essential N5 words
      const hasTaberu = words.some(w => w.kana === 'たべる');
      const hasMiru = words.some(w => w.kana === 'みる');
      const hasIku = words.some(w => w.kana === 'いく' || w.kanji === '行く');

      expect(hasTaberu || hasMiru || hasIku).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle words with missing kana', () => {
      const word = {
        id: 'test',
        kanji: '走る',
        meaning: 'to run',
        type: 'other' as WordType,
      } as JapaneseWord;

      expect(WordUtils.isConjugable(word)).toBe(false);
      const detected = WordUtils.detectWordTypeByPattern(word);
      expect(detected).toBe('other'); // Can't detect without kana
    });

    test('should handle words with same kanji and kana', () => {
      const word = {
        id: 'test',
        kanji: 'する',
        kana: 'する',
        meaning: 'to do',
        type: 'other' as WordType,
      } as JapaneseWord;

      const detected = WordUtils.detectWordTypeByPattern(word);
      expect(detected).toBe('Irregular');
    });

    test('should handle empty word arrays gracefully', () => {
      expect(WordUtils.filterConjugableWords([])).toEqual([]);
      expect(WordUtils.filterByType([], 'all')).toEqual([]);
    });

    test('should handle undefined type gracefully', () => {
      const word = {
        id: 'test',
        kanji: '本',
        kana: 'ほん',
        meaning: 'book',
      } as JapaneseWord;

      // Type is undefined
      expect(WordUtils.isConjugable(word)).toBe(false);
    });
  });
});