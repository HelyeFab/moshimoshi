/**
 * Comprehensive test suite for ExtendedConjugationEngine
 * Tests all verb types, adjectives, special cases, and edge cases
 */

import { ExtendedConjugationEngine } from '../engine';
import { EnhancedJapaneseWord } from '@/utils/enhancedWordTypeDetection';

describe('ExtendedConjugationEngine', () => {

  // Clear cache before each test to ensure isolation
  beforeEach(() => {
    ExtendedConjugationEngine.clearCache();
  });

  describe('Input Validation', () => {
    test('handles null word', async () => {
      const result = await ExtendedConjugationEngine.conjugate(null as any);
      expect(result.present).toBe('');
      expect(result.past).toBe('');
    });

    test('handles undefined word', async () => {
      const result = await ExtendedConjugationEngine.conjugate(undefined as any);
      expect(result.present).toBe('');
      expect(result.past).toBe('');
    });

    test('handles word without kanji or kana', async () => {
      const word: any = { conjugationType: 'Godan' };
      const result = await ExtendedConjugationEngine.conjugate(word);
      expect(result.present).toBe('');
    });

    test('handles word without conjugationType', async () => {
      const word: any = { kanji: '買う', kana: 'かう' };
      const result = await ExtendedConjugationEngine.conjugate(word);
      expect(result.present).toBe('');
    });

    test('handles non-conjugatable word type', async () => {
      const word: EnhancedJapaneseWord = {
        id: 'test',
        kanji: '本',
        kana: 'ほん',
        meaning: 'book',
        type: 'noun',
        conjugationType: 'noun',
        jlpt: 'N5',
        romaji: 'hon',
        isConjugatable: false,
        typeConfidence: 'high'
      };
      const result = await ExtendedConjugationEngine.conjugate(word);
      expect(result.present).toBe('');
    });
  });

  describe('Godan Verb Conjugation', () => {
    describe('う ending verbs', () => {
      const word: EnhancedJapaneseWord = {
        id: 'kau',
        kanji: '買う',
        kana: 'かう',
        meaning: 'to buy',
        type: 'Godan',
        conjugationType: 'Godan',
        jlpt: 'N5',
        romaji: 'kau',
        isConjugatable: true,
        typeConfidence: 'high'
      };

      test('generates basic forms correctly', async () => {
        const result = await ExtendedConjugationEngine.conjugate(word);
        expect(result.present).toBe('買う');
        expect(result.past).toBe('買った');
        expect(result.negative).toBe('買わない');
        expect(result.pastNegative).toBe('買わなかった');
      });

      test('generates polite forms correctly', async () => {
        const result = await ExtendedConjugationEngine.conjugate(word);
        expect(result.polite).toBe('買います');
        expect(result.politePast).toBe('買いました');
        expect(result.politeNegative).toBe('買いません');
        expect(result.politePastNegative).toBe('買いませんでした');
      });

      test('generates te-form correctly', async () => {
        const result = await ExtendedConjugationEngine.conjugate(word);
        expect(result.teForm).toBe('買って');
        expect(result.negativeTeForm).toBe('買わなくて');
      });

      test('generates potential forms correctly', async () => {
        const result = await ExtendedConjugationEngine.conjugate(word);
        expect(result.potential).toBe('買える');
        expect(result.potentialNegative).toBe('買えない');
      });

      test('generates passive forms correctly', async () => {
        const result = await ExtendedConjugationEngine.conjugate(word);
        expect(result.passive).toBe('買われる');
        expect(result.passiveNegative).toBe('買われない');
      });

      test('generates causative forms correctly', async () => {
        const result = await ExtendedConjugationEngine.conjugate(word);
        expect(result.causative).toBe('買わせる');
        expect(result.causativeNegative).toBe('買わせない');
      });
    });

    describe('く ending verbs', () => {
      const word: EnhancedJapaneseWord = {
        id: 'kaku',
        kanji: '書く',
        kana: 'かく',
        meaning: 'to write',
        type: 'Godan',
        conjugationType: 'Godan',
        jlpt: 'N5',
        romaji: 'kaku',
        isConjugatable: true,
        typeConfidence: 'high'
      };

      test('generates correct te-form', async () => {
        const result = await ExtendedConjugationEngine.conjugate(word);
        expect(result.teForm).toBe('書いて');
        expect(result.past).toBe('書いた');
      });
    });

    describe('ぐ ending verbs', () => {
      const word: EnhancedJapaneseWord = {
        id: 'oyogu',
        kanji: '泳ぐ',
        kana: 'およぐ',
        meaning: 'to swim',
        type: 'Godan',
        conjugationType: 'Godan',
        jlpt: 'N4',
        romaji: 'oyogu',
        isConjugatable: true,
        typeConfidence: 'high'
      };

      test('generates correct te-form', async () => {
        const result = await ExtendedConjugationEngine.conjugate(word);
        expect(result.teForm).toBe('泳いで');
        expect(result.past).toBe('泳いだ');
      });
    });

    describe('す ending verbs', () => {
      const word: EnhancedJapaneseWord = {
        id: 'hanasu',
        kanji: '話す',
        kana: 'はなす',
        meaning: 'to speak',
        type: 'Godan',
        conjugationType: 'Godan',
        jlpt: 'N5',
        romaji: 'hanasu',
        isConjugatable: true,
        typeConfidence: 'high'
      };

      test('generates correct te-form', async () => {
        const result = await ExtendedConjugationEngine.conjugate(word);
        expect(result.teForm).toBe('話して');
        expect(result.past).toBe('話した');
      });
    });

    describe('つ ending verbs', () => {
      const word: EnhancedJapaneseWord = {
        id: 'matsu',
        kanji: '待つ',
        kana: 'まつ',
        meaning: 'to wait',
        type: 'Godan',
        conjugationType: 'Godan',
        jlpt: 'N5',
        romaji: 'matsu',
        isConjugatable: true,
        typeConfidence: 'high'
      };

      test('generates correct te-form', async () => {
        const result = await ExtendedConjugationEngine.conjugate(word);
        expect(result.teForm).toBe('待って');
        expect(result.past).toBe('待った');
      });
    });

    describe('ぬ ending verbs', () => {
      const word: EnhancedJapaneseWord = {
        id: 'shinu',
        kanji: '死ぬ',
        kana: 'しぬ',
        meaning: 'to die',
        type: 'Godan',
        conjugationType: 'Godan',
        jlpt: 'N4',
        romaji: 'shinu',
        isConjugatable: true,
        typeConfidence: 'high'
      };

      test('generates correct te-form', async () => {
        const result = await ExtendedConjugationEngine.conjugate(word);
        expect(result.teForm).toBe('死んで');
        expect(result.past).toBe('死んだ');
      });
    });

    describe('ぶ ending verbs', () => {
      const word: EnhancedJapaneseWord = {
        id: 'asobu',
        kanji: '遊ぶ',
        kana: 'あそぶ',
        meaning: 'to play',
        type: 'Godan',
        conjugationType: 'Godan',
        jlpt: 'N5',
        romaji: 'asobu',
        isConjugatable: true,
        typeConfidence: 'high'
      };

      test('generates correct te-form', async () => {
        const result = await ExtendedConjugationEngine.conjugate(word);
        expect(result.teForm).toBe('遊んで');
        expect(result.past).toBe('遊んだ');
      });
    });

    describe('む ending verbs', () => {
      const word: EnhancedJapaneseWord = {
        id: 'nomu',
        kanji: '飲む',
        kana: 'のむ',
        meaning: 'to drink',
        type: 'Godan',
        conjugationType: 'Godan',
        jlpt: 'N5',
        romaji: 'nomu',
        isConjugatable: true,
        typeConfidence: 'high'
      };

      test('generates correct te-form', async () => {
        const result = await ExtendedConjugationEngine.conjugate(word);
        expect(result.teForm).toBe('飲んで');
        expect(result.past).toBe('飲んだ');
      });
    });

    describe('る ending verbs', () => {
      const word: EnhancedJapaneseWord = {
        id: 'kaeru',
        kanji: '帰る',
        kana: 'かえる',
        meaning: 'to return',
        type: 'Godan',
        conjugationType: 'Godan',
        jlpt: 'N5',
        romaji: 'kaeru',
        isConjugatable: true,
        typeConfidence: 'high'
      };

      test('generates correct te-form', async () => {
        const result = await ExtendedConjugationEngine.conjugate(word);
        expect(result.teForm).toBe('帰って');
        expect(result.past).toBe('帰った');
      });
    });
  });

  describe('Special Case: 行く (iku)', () => {
    const word: EnhancedJapaneseWord = {
      id: 'iku',
      kanji: '行く',
      kana: 'いく',
      meaning: 'to go',
      type: 'Godan',
      conjugationType: 'Godan',
      jlpt: 'N5',
      romaji: 'iku',
      isConjugatable: true,
      typeConfidence: 'high'
    };

    test('generates special te-form (って not いて)', async () => {
      const result = await ExtendedConjugationEngine.conjugate(word);
      expect(result.teForm).toBe('行って');
      expect(result.past).toBe('行った');
    });

    test('generates normal other forms', async () => {
      const result = await ExtendedConjugationEngine.conjugate(word);
      expect(result.negative).toBe('行かない');
      expect(result.polite).toBe('行きます');
    });
  });

  describe('Ichidan Verb Conjugation', () => {
    const word: EnhancedJapaneseWord = {
      id: 'taberu',
      kanji: '食べる',
      kana: 'たべる',
      meaning: 'to eat',
      type: 'Ichidan',
      conjugationType: 'Ichidan',
      jlpt: 'N5',
      romaji: 'taberu',
      isConjugatable: true,
      typeConfidence: 'high'
    };

    test('generates basic forms correctly', async () => {
      const result = await ExtendedConjugationEngine.conjugate(word);
      expect(result.present).toBe('食べる');
      expect(result.past).toBe('食べた');
      expect(result.negative).toBe('食べない');
      expect(result.pastNegative).toBe('食べなかった');
    });

    test('generates polite forms correctly', async () => {
      const result = await ExtendedConjugationEngine.conjugate(word);
      expect(result.polite).toBe('食べます');
      expect(result.politePast).toBe('食べました');
      expect(result.politeNegative).toBe('食べません');
      expect(result.politePastNegative).toBe('食べませんでした');
    });

    test('generates te-form correctly', async () => {
      const result = await ExtendedConjugationEngine.conjugate(word);
      expect(result.teForm).toBe('食べて');
      expect(result.negativeTeForm).toBe('食べなくて');
    });

    test('generates potential forms correctly', async () => {
      const result = await ExtendedConjugationEngine.conjugate(word);
      expect(result.potential).toBe('食べられる');
      expect(result.potentialNegative).toBe('食べられない');
    });

    test('generates passive forms correctly', async () => {
      const result = await ExtendedConjugationEngine.conjugate(word);
      expect(result.passive).toBe('食べられる');
      expect(result.passiveNegative).toBe('食べられない');
    });

    test('generates causative forms correctly', async () => {
      const result = await ExtendedConjugationEngine.conjugate(word);
      expect(result.causative).toBe('食べさせる');
      expect(result.causativeNegative).toBe('食べさせない');
    });

    test('generates volitional forms correctly', async () => {
      const result = await ExtendedConjugationEngine.conjugate(word);
      expect(result.volitional).toBe('食べよう');
      expect(result.politeVolitional).toBe('食べましょう');
    });
  });

  describe('Irregular Verb Conjugation - する', () => {
    describe('plain する', () => {
      const word: EnhancedJapaneseWord = {
        id: 'suru',
        kanji: 'する',
        kana: 'する',
        meaning: 'to do',
        type: 'Irregular',
        conjugationType: 'Irregular',
        jlpt: 'N5',
        romaji: 'suru',
        isConjugatable: true,
        typeConfidence: 'high'
      };

      test('generates basic forms correctly', async () => {
        const result = await ExtendedConjugationEngine.conjugate(word);
        expect(result.present).toBe('する');
        expect(result.past).toBe('した');
        expect(result.negative).toBe('しない');
        expect(result.pastNegative).toBe('しなかった');
      });

      test('generates polite forms correctly', async () => {
        const result = await ExtendedConjugationEngine.conjugate(word);
        expect(result.polite).toBe('します');
        expect(result.politePast).toBe('しました');
        expect(result.politeNegative).toBe('しません');
      });

      test('generates te-form correctly', async () => {
        const result = await ExtendedConjugationEngine.conjugate(word);
        expect(result.teForm).toBe('して');
      });

      test('generates potential forms correctly', async () => {
        const result = await ExtendedConjugationEngine.conjugate(word);
        expect(result.potential).toBe('できる');
        expect(result.potentialNegative).toBe('できない');
      });
    });

    describe('compound する verbs', () => {
      const word: EnhancedJapaneseWord = {
        id: 'benkyousuru',
        kanji: '勉強する',
        kana: 'べんきょうする',
        meaning: 'to study',
        type: 'Irregular',
        conjugationType: 'Irregular',
        jlpt: 'N5',
        romaji: 'benkyousuru',
        isConjugatable: true,
        typeConfidence: 'high'
      };

      test('generates basic forms correctly', async () => {
        const result = await ExtendedConjugationEngine.conjugate(word);
        expect(result.present).toBe('勉強する');
        expect(result.past).toBe('勉強した');
        expect(result.negative).toBe('勉強しない');
      });

      test('generates polite forms correctly', async () => {
        const result = await ExtendedConjugationEngine.conjugate(word);
        expect(result.polite).toBe('勉強します');
        expect(result.politePast).toBe('勉強しました');
      });

      test('generates potential forms correctly', async () => {
        const result = await ExtendedConjugationEngine.conjugate(word);
        expect(result.potential).toBe('勉強できる');
        expect(result.potentialNegative).toBe('勉強できない');
      });
    });
  });

  describe('Irregular Verb Conjugation - 来る (kuru)', () => {
    const word: EnhancedJapaneseWord = {
      id: 'kuru',
      kanji: '来る',
      kana: 'くる',
      meaning: 'to come',
      type: 'Irregular',
      conjugationType: 'Irregular',
      jlpt: 'N5',
      romaji: 'kuru',
      isConjugatable: true,
      typeConfidence: 'high'
    };

    test('generates basic forms correctly', async () => {
      const result = await ExtendedConjugationEngine.conjugate(word);
      expect(result.present).toBe('来る');
      expect(result.past).toBe('来た');
      expect(result.negative).toBe('来ない');
      expect(result.pastNegative).toBe('来なかった');
    });

    test('generates polite forms correctly', async () => {
      const result = await ExtendedConjugationEngine.conjugate(word);
      expect(result.polite).toBe('来ます');
      expect(result.politePast).toBe('来ました');
      expect(result.politeNegative).toBe('来ません');
    });

    test('generates te-form correctly', async () => {
      const result = await ExtendedConjugationEngine.conjugate(word);
      expect(result.teForm).toBe('来て');
    });

    test('generates potential forms correctly', async () => {
      const result = await ExtendedConjugationEngine.conjugate(word);
      expect(result.potential).toBe('来られる');
      expect(result.potentialNegative).toBe('来られない');
    });

    test('generates imperative forms correctly', async () => {
      const result = await ExtendedConjugationEngine.conjugate(word);
      expect(result.imperativePlain).toBe('来い');
      expect(result.imperativeNegative).toBe('来るな');
    });
  });

  describe('I-Adjective Conjugation', () => {
    const word: EnhancedJapaneseWord = {
      id: 'takai',
      kanji: '高い',
      kana: 'たかい',
      meaning: 'expensive, tall',
      type: 'i-adjective',
      conjugationType: 'i-adjective',
      jlpt: 'N5',
      romaji: 'takai',
      isConjugatable: true,
      typeConfidence: 'high'
    };

    test('generates basic forms correctly', async () => {
      const result = await ExtendedConjugationEngine.conjugate(word);
      expect(result.present).toBe('高い');
      expect(result.past).toBe('高かった');
      expect(result.negative).toBe('高くない');
      expect(result.pastNegative).toBe('高くなかった');
    });

    test('generates polite forms correctly', async () => {
      const result = await ExtendedConjugationEngine.conjugate(word);
      expect(result.polite).toBe('高いです');
      expect(result.politePast).toBe('高かったです');
      expect(result.politeNegative).toBe('高くないです');
    });

    test('generates te-form correctly', async () => {
      const result = await ExtendedConjugationEngine.conjugate(word);
      expect(result.teForm).toBe('高くて');
      expect(result.negativeTeForm).toBe('高くなくて');
    });

    test('generates conditional forms correctly', async () => {
      const result = await ExtendedConjugationEngine.conjugate(word);
      expect(result.provisional).toBe('高ければ');
      expect(result.conditional).toBe('高かったら');
    });

    test('does not generate verb-specific forms', async () => {
      const result = await ExtendedConjugationEngine.conjugate(word);
      expect(result.potential).toBe('');
      expect(result.passive).toBe('');
      expect(result.causative).toBe('');
    });
  });

  describe('Special Case: いい (ii) adjective', () => {
    const word: EnhancedJapaneseWord = {
      id: 'ii',
      kanji: 'いい',
      kana: 'いい',
      meaning: 'good',
      type: 'i-adjective',
      conjugationType: 'i-adjective',
      jlpt: 'N5',
      romaji: 'ii',
      isConjugatable: true,
      typeConfidence: 'high'
    };

    test('uses よ stem for conjugations except dictionary form', async () => {
      const result = await ExtendedConjugationEngine.conjugate(word);
      expect(result.present).toBe('いい'); // Dictionary form stays いい
      expect(result.past).toBe('よかった'); // Uses よ stem
      expect(result.negative).toBe('よくない'); // Uses よ stem
      expect(result.teForm).toBe('よくて'); // Uses よ stem
    });
  });

  describe('Na-Adjective Conjugation', () => {
    const word: EnhancedJapaneseWord = {
      id: 'kirei',
      kanji: '綺麗',
      kana: 'きれい',
      meaning: 'pretty, clean',
      type: 'na-adjective',
      conjugationType: 'na-adjective',
      jlpt: 'N5',
      romaji: 'kirei',
      isConjugatable: true,
      typeConfidence: 'high'
    };

    test('generates basic forms correctly', async () => {
      const result = await ExtendedConjugationEngine.conjugate(word);
      expect(result.present).toBe('綺麗だ');
      expect(result.past).toBe('綺麗だった');
      expect(result.negative).toBe('綺麗じゃない');
      expect(result.pastNegative).toBe('綺麗じゃなかった');
    });

    test('generates polite forms correctly', async () => {
      const result = await ExtendedConjugationEngine.conjugate(word);
      expect(result.polite).toBe('綺麗です');
      expect(result.politePast).toBe('綺麗でした');
      expect(result.politeNegative).toBe('綺麗じゃありません');
    });

    test('generates te-form correctly', async () => {
      const result = await ExtendedConjugationEngine.conjugate(word);
      expect(result.teForm).toBe('綺麗で');
      expect(result.negativeTeForm).toBe('綺麗じゃなくて');
    });

    test('does not generate verb-specific forms', async () => {
      const result = await ExtendedConjugationEngine.conjugate(word);
      expect(result.potential).toBe('');
      expect(result.passive).toBe('');
      expect(result.causative).toBe('');
    });
  });

  describe('Caching Behavior', () => {
    const word: EnhancedJapaneseWord = {
      id: 'taberu',
      kanji: '食べる',
      kana: 'たべる',
      meaning: 'to eat',
      type: 'Ichidan',
      conjugationType: 'Ichidan',
      jlpt: 'N5',
      romaji: 'taberu',
      isConjugatable: true,
      typeConfidence: 'high'
    };

    test('caches conjugation results', async () => {
      const result1 = await ExtendedConjugationEngine.conjugate(word);
      const cacheSize1 = ExtendedConjugationEngine.getCacheSize();
      expect(cacheSize1).toBe(1);

      const result2 = await ExtendedConjugationEngine.conjugate(word);
      const cacheSize2 = ExtendedConjugationEngine.getCacheSize();
      expect(cacheSize2).toBe(1); // Should still be 1 (cached)

      // Results should be identical
      expect(result1).toBe(result2);
    });

    test('clearCache() empties the cache', async () => {
      await ExtendedConjugationEngine.conjugate(word);
      expect(ExtendedConjugationEngine.getCacheSize()).toBeGreaterThan(0);

      ExtendedConjugationEngine.clearCache();
      expect(ExtendedConjugationEngine.getCacheSize()).toBe(0);
    });

    test('caches different words separately', async () => {
      const word2: EnhancedJapaneseWord = {
        ...word,
        id: 'miru',
        kanji: '見る',
        kana: 'みる',
        meaning: 'to see'
      };

      await ExtendedConjugationEngine.conjugate(word);
      await ExtendedConjugationEngine.conjugate(word2);

      expect(ExtendedConjugationEngine.getCacheSize()).toBe(2);
    });
  });

  describe('Progressive Forms', () => {
    const word: EnhancedJapaneseWord = {
      id: 'taberu',
      kanji: '食べる',
      kana: 'たべる',
      meaning: 'to eat',
      type: 'Ichidan',
      conjugationType: 'Ichidan',
      jlpt: 'N5',
      romaji: 'taberu',
      isConjugatable: true,
      typeConfidence: 'high'
    };

    test('generates progressive forms correctly', async () => {
      const result = await ExtendedConjugationEngine.conjugate(word);
      expect(result.progressive).toBe('食べている');
      expect(result.progressiveNegative).toBe('食べていない');
      expect(result.progressivePast).toBe('食べていた');
      expect(result.progressivePastNegative).toBe('食べていなかった');
    });

    test('generates polite progressive forms correctly', async () => {
      const result = await ExtendedConjugationEngine.conjugate(word);
      expect(result.progressivePolite).toBe('食べています');
      expect(result.progressivePoliteNegative).toBe('食べていません');
      expect(result.progressivePolitePast).toBe('食べていました');
      expect(result.progressivePolitePastNegative).toBe('食べていませんでした');
    });
  });

  describe('Tai Forms (Desiderative)', () => {
    const word: EnhancedJapaneseWord = {
      id: 'taberu',
      kanji: '食べる',
      kana: 'たべる',
      meaning: 'to eat',
      type: 'Ichidan',
      conjugationType: 'Ichidan',
      jlpt: 'N5',
      romaji: 'taberu',
      isConjugatable: true,
      typeConfidence: 'high'
    };

    test('generates tai forms correctly', async () => {
      const result = await ExtendedConjugationEngine.conjugate(word);
      expect(result.taiForm).toBe('食べたい');
      expect(result.taiFormNegative).toBe('食べたくない');
      expect(result.taiFormPast).toBe('食べたかった');
      expect(result.taiFormPastNegative).toBe('食べたくなかった');
    });

    test('generates tai conditional forms correctly', async () => {
      const result = await ExtendedConjugationEngine.conjugate(word);
      expect(result.taiProvisional).toBe('食べたければ');
      expect(result.taiConditional).toBe('食べたかったら');
    });
  });

  describe('Edge Cases', () => {
    test('handles empty string for kanji', async () => {
      const word: EnhancedJapaneseWord = {
        id: 'test',
        kanji: '',
        kana: 'する',
        meaning: 'to do',
        type: 'Irregular',
        conjugationType: 'Irregular',
        jlpt: 'N5',
        romaji: 'suru',
        isConjugatable: true,
        typeConfidence: 'high'
      };

      const result = await ExtendedConjugationEngine.conjugate(word);
      expect(result.present).toBe('する');
      expect(result.past).toBe('した');
    });

    test('handles word with only kana property', async () => {
      const word: EnhancedJapaneseWord = {
        id: 'test',
        kana: '食べる',
        meaning: 'to eat',
        type: 'Ichidan',
        conjugationType: 'Ichidan',
        jlpt: 'N5',
        romaji: 'taberu',
        isConjugatable: true,
        typeConfidence: 'high'
      };

      const result = await ExtendedConjugationEngine.conjugate(word);
      expect(result.present).toBe('食べる');
      expect(result.past).toBe('食べた');
    });
  });

  describe('getAllPossibleForms', () => {
    test('returns all non-empty forms', async () => {
      const word: EnhancedJapaneseWord = {
        id: 'taberu',
        kanji: '食べる',
        kana: 'たべる',
        meaning: 'to eat',
        type: 'Ichidan',
        conjugationType: 'Ichidan',
        jlpt: 'N5',
        romaji: 'taberu',
        isConjugatable: true,
        typeConfidence: 'high'
      };

      const conjugations = await ExtendedConjugationEngine.conjugate(word);
      const forms = ExtendedConjugationEngine.getAllPossibleForms(conjugations);

      expect(forms.length).toBeGreaterThan(0);
      expect(forms).toContain('食べる');
      expect(forms).toContain('食べた');
      expect(forms).toContain('食べない');

      // Should not contain empty strings
      expect(forms.every(form => form.trim() !== '')).toBe(true);
    });

    test('removes duplicate forms', async () => {
      const word: EnhancedJapaneseWord = {
        id: 'taberu',
        kanji: '食べる',
        kana: 'たべる',
        meaning: 'to eat',
        type: 'Ichidan',
        conjugationType: 'Ichidan',
        jlpt: 'N5',
        romaji: 'taberu',
        isConjugatable: true,
        typeConfidence: 'high'
      };

      const conjugations = await ExtendedConjugationEngine.conjugate(word);
      const forms = ExtendedConjugationEngine.getAllPossibleForms(conjugations);

      // Check that there are no duplicates
      const uniqueForms = new Set(forms);
      expect(forms.length).toBe(uniqueForms.size);
    });
  });
});
