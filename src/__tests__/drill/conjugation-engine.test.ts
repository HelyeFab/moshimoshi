/**
 * Tests for Conjugation Engine
 * Comprehensive testing of all conjugation patterns
 */

import { ConjugationEngine } from '@/lib/drill/conjugation-engine';
import { mockWords, assertConjugationForms } from './test-utils';
import type { ConjugationForms } from '@/types/drill';

describe('ConjugationEngine', () => {
  describe('Ichidan Verbs', () => {
    let conjugations: ConjugationForms;

    beforeEach(() => {
      conjugations = ConjugationEngine.conjugate(mockWords.taberu);
    });

    test('should conjugate present forms correctly', () => {
      assertConjugationForms(conjugations, {
        present: '食べる',
        polite: '食べます',
      });
    });

    test('should conjugate past forms correctly', () => {
      assertConjugationForms(conjugations, {
        past: '食べた',
        politePast: '食べました',
      });
    });

    test('should conjugate negative forms correctly', () => {
      assertConjugationForms(conjugations, {
        negative: '食べない',
        pastNegative: '食べなかった',
        politeNegative: '食べません',
        politePastNegative: '食べませんでした',
      });
    });

    test('should conjugate te forms correctly', () => {
      assertConjugationForms(conjugations, {
        teForm: '食べて',
        negativeTeForm: '食べなくて',
      });
    });

    test('should conjugate conditional forms correctly', () => {
      assertConjugationForms(conjugations, {
        provisional: '食べれば',
        conditional: '食べたら',
      });
    });

    test('should conjugate volitional form correctly', () => {
      expect(conjugations.volitional).toBe('食べよう');
    });

    test('should conjugate potential forms correctly', () => {
      assertConjugationForms(conjugations, {
        potential: '食べられる',
        potentialNegative: '食べられない',
      });
    });

    test('should conjugate passive forms correctly', () => {
      assertConjugationForms(conjugations, {
        passive: '食べられる',
        passiveNegative: '食べられない',
      });
    });

    test('should conjugate causative forms correctly', () => {
      assertConjugationForms(conjugations, {
        causative: '食べさせる',
        causativeNegative: '食べさせない',
      });
    });

    test('should conjugate imperative forms correctly', () => {
      assertConjugationForms(conjugations, {
        imperativePlain: '食べろ',
        imperativePolite: '食べてください',
      });
    });

    test('should conjugate tai forms correctly', () => {
      assertConjugationForms(conjugations, {
        taiForm: '食べたい',
        taiFormNegative: '食べたくない',
      });
    });

    test('should get correct stems', () => {
      assertConjugationForms(conjugations, {
        masuStem: '食べ',
        negativeStem: '食べな',
      });
    });
  });

  describe('Godan Verbs', () => {
    describe('Godan ending in う', () => {
      test('should conjugate 買う correctly', () => {
        const conjugations = ConjugationEngine.conjugate(mockWords.kau);
        assertConjugationForms(conjugations, {
          present: '買う',
          past: '買った',
          negative: '買わない',
          teForm: '買って',
          polite: '買います',
          potential: '買える',
          passive: '買われる',
          causative: '買わせる',
          volitional: '買おう',
          conditional: '買ったら',
        });
      });
    });

    describe('Godan ending in く', () => {
      test('should conjugate 書く correctly', () => {
        const conjugations = ConjugationEngine.conjugate(mockWords.kaku);
        assertConjugationForms(conjugations, {
          present: '書く',
          past: '書いた',
          negative: '書かない',
          teForm: '書いて',
          polite: '書きます',
          potential: '書ける',
          passive: '書かれる',
          causative: '書かせる',
          volitional: '書こう',
          conditional: '書いたら',
        });
      });
    });

    describe('Godan ending in ぐ', () => {
      test('should conjugate 泳ぐ correctly', () => {
        const conjugations = ConjugationEngine.conjugate(mockWords.oyogu);
        assertConjugationForms(conjugations, {
          present: '泳ぐ',
          past: '泳いだ',
          negative: '泳がない',
          teForm: '泳いで',
          polite: '泳ぎます',
          potential: '泳げる',
          passive: '泳がれる',
          causative: '泳がせる',
          volitional: '泳ごう',
        });
      });
    });

    describe('Godan ending in す', () => {
      test('should conjugate 話す correctly', () => {
        const conjugations = ConjugationEngine.conjugate(mockWords.hanasu);
        assertConjugationForms(conjugations, {
          present: '話す',
          past: '話した',
          negative: '話さない',
          teForm: '話して',
          polite: '話します',
          potential: '話せる',
          passive: '話される',
          causative: '話させる',
          volitional: '話そう',
        });
      });
    });

    describe('Godan ending in つ', () => {
      test('should conjugate 待つ correctly', () => {
        const conjugations = ConjugationEngine.conjugate(mockWords.matsu);
        assertConjugationForms(conjugations, {
          present: '待つ',
          past: '待った',
          negative: '待たない',
          teForm: '待って',
          polite: '待ちます',
          potential: '待てる',
          passive: '待たれる',
          causative: '待たせる',
          volitional: '待とう',
        });
      });
    });

    describe('Godan ending in ぬ', () => {
      test('should conjugate 死ぬ correctly', () => {
        const conjugations = ConjugationEngine.conjugate(mockWords.shinu);
        assertConjugationForms(conjugations, {
          present: '死ぬ',
          past: '死んだ',
          negative: '死なない',
          teForm: '死んで',
          polite: '死にます',
          potential: '死ねる',
          passive: '死なれる',
          causative: '死なせる',
          volitional: '死のう',
        });
      });
    });

    describe('Godan ending in ぶ', () => {
      test('should conjugate 遊ぶ correctly', () => {
        const conjugations = ConjugationEngine.conjugate(mockWords.asobu);
        assertConjugationForms(conjugations, {
          present: '遊ぶ',
          past: '遊んだ',
          negative: '遊ばない',
          teForm: '遊んで',
          polite: '遊びます',
          potential: '遊べる',
          passive: '遊ばれる',
          causative: '遊ばせる',
          volitional: '遊ぼう',
        });
      });
    });

    describe('Godan ending in む', () => {
      test('should conjugate 飲む correctly', () => {
        const conjugations = ConjugationEngine.conjugate(mockWords.nomu);
        assertConjugationForms(conjugations, {
          present: '飲む',
          past: '飲んだ',
          negative: '飲まない',
          teForm: '飲んで',
          polite: '飲みます',
          potential: '飲める',
          passive: '飲まれる',
          causative: '飲ませる',
          volitional: '飲もう',
        });
      });
    });

    describe('Godan ending in る', () => {
      test('should conjugate 帰る correctly', () => {
        const conjugations = ConjugationEngine.conjugate(mockWords.kaeru);
        assertConjugationForms(conjugations, {
          present: '帰る',
          past: '帰った',
          negative: '帰らない',
          teForm: '帰って',
          polite: '帰ります',
          potential: '帰れる',
          passive: '帰られる',
          causative: '帰らせる',
          volitional: '帰ろう',
        });
      });
    });

    describe('Special case: 行く', () => {
      test('should conjugate 行く with special past/te forms', () => {
        const conjugations = ConjugationEngine.conjugate(mockWords.iku);
        assertConjugationForms(conjugations, {
          present: '行く',
          past: '行った', // Not 行いた
          negative: '行かない',
          teForm: '行って', // Not 行いて
          polite: '行きます',
          potential: '行ける',
          conditional: '行ったら',
        });
      });
    });
  });

  describe('Irregular Verbs', () => {
    describe('する', () => {
      test('should conjugate する correctly', () => {
        const conjugations = ConjugationEngine.conjugate(mockWords.suru);
        assertConjugationForms(conjugations, {
          present: 'する',
          past: 'した',
          negative: 'しない',
          pastNegative: 'しなかった',
          polite: 'します',
          teForm: 'して',
          potential: 'できる',
          passive: 'される',
          causative: 'させる',
          volitional: 'しよう',
          imperativePlain: 'しろ',
        });
      });

      test('should conjugate compound する verbs correctly', () => {
        const conjugations = ConjugationEngine.conjugate(mockWords.benkyouSuru);
        assertConjugationForms(conjugations, {
          present: '勉強する',
          past: '勉強した',
          negative: '勉強しない',
          polite: '勉強します',
          teForm: '勉強して',
          potential: '勉強できる',
        });
      });
    });

    describe('来る', () => {
      test('should conjugate 来る correctly', () => {
        const conjugations = ConjugationEngine.conjugate(mockWords.kuru);
        assertConjugationForms(conjugations, {
          present: '来る',
          past: '来た',
          negative: '来ない',
          pastNegative: '来なかった',
          polite: '来ます',
          teForm: '来て',
          potential: '来られる',
          passive: '来られる',
          causative: '来させる',
          volitional: '来よう',
          imperativePlain: '来い',
        });
      });
    });
  });

  describe('I-Adjectives', () => {
    test('should conjugate i-adjectives correctly', () => {
      const conjugations = ConjugationEngine.conjugate(mockWords.ookii);
      assertConjugationForms(conjugations, {
        present: '大きい',
        past: '大きかった',
        negative: '大きくない',
        pastNegative: '大きくなかった',
        polite: '大きいです',
        politePast: '大きかったです',
        politeNegative: '大きくないです',
        politePastNegative: '大きくなかったです',
        teForm: '大きくて',
        negativeTeForm: '大きくなくて',
        conditional: '大きかったら',
        provisional: '大きければ',
        adverbial: '大きく',
      });
    });

    test('should not have verb-specific forms for adjectives', () => {
      const conjugations = ConjugationEngine.conjugate(mockWords.takai);
      expect(conjugations.potential).toBeUndefined();
      expect(conjugations.passive).toBeUndefined();
      expect(conjugations.causative).toBeUndefined();
      expect(conjugations.imperativePlain).toBeUndefined();
      expect(conjugations.taiForm).toBeUndefined();
    });
  });

  describe('Na-Adjectives', () => {
    test('should conjugate na-adjectives correctly', () => {
      const conjugations = ConjugationEngine.conjugate(mockWords.genki);
      assertConjugationForms(conjugations, {
        present: '元気だ',
        past: '元気だった',
        negative: '元気じゃない',
        pastNegative: '元気じゃなかった',
        polite: '元気です',
        politePast: '元気でした',
        politeNegative: '元気じゃありません',
        politePastNegative: '元気じゃありませんでした',
        teForm: '元気で',
        negativeTeForm: '元気じゃなくて',
        conditional: '元気だったら',
        provisional: '元気なら',
        adverbial: '元気に',
      });
    });

    test('should handle different na-adjective patterns', () => {
      const conjugations = ConjugationEngine.conjugate(mockWords.shizuka);
      assertConjugationForms(conjugations, {
        present: '静かだ',
        adverbial: '静かに',
        teForm: '静かで',
      });
    });
  });

  describe('Non-conjugable Words', () => {
    test('should return empty forms for nouns', () => {
      const conjugations = ConjugationEngine.conjugate(mockWords.hon);
      expect(conjugations.present).toBe('');
      expect(conjugations.past).toBe('');
      expect(conjugations.negative).toBe('');
    });

    test('should return empty forms for particles', () => {
      const conjugations = ConjugationEngine.conjugate(mockWords.wa);
      expect(conjugations.present).toBe('');
      expect(conjugations.polite).toBe('');
    });
  });

  describe('Helper Methods', () => {
    describe('getAllPossibleForms', () => {
      test('should return all non-empty unique forms', () => {
        const conjugations = ConjugationEngine.conjugate(mockWords.taberu);
        const allForms = ConjugationEngine.getAllPossibleForms(conjugations);

        expect(allForms).toContain('食べる');
        expect(allForms).toContain('食べた');
        expect(allForms).toContain('食べない');
        expect(allForms).not.toContain('');
        expect(allForms).not.toContain(undefined);

        // Check uniqueness
        const uniqueForms = [...new Set(allForms)];
        expect(allForms.length).toBe(uniqueForms.length);
      });
    });

    describe('getRandomConjugationForm', () => {
      test('should return appropriate forms for verbs', () => {
        const forms = new Set<string>();
        for (let i = 0; i < 100; i++) {
          forms.add(ConjugationEngine.getRandomConjugationForm('Ichidan'));
        }

        expect(forms.has('present')).toBe(true);
        expect(forms.has('past')).toBe(true);
        expect(forms.has('negative')).toBe(true);
      });

      test('should return appropriate forms for adjectives', () => {
        const forms = new Set<string>();
        for (let i = 0; i < 100; i++) {
          forms.add(ConjugationEngine.getRandomConjugationForm('i-adjective'));
        }

        expect(forms.has('present')).toBe(true);
        expect(forms.has('adverbial')).toBe(true);
        // Should not include verb-only forms
        expect(forms.has('potential')).toBe(false);
        expect(forms.has('passive')).toBe(false);
      });
    });

    describe('generateQuestionStem', () => {
      test('should generate proper question stem', () => {
        const stem = ConjugationEngine.generateQuestionStem(mockWords.taberu, 'past');
        expect(stem).toBe('食べる_____');
      });
    });

    describe('getFormDisplayName', () => {
      test('should return proper display names', () => {
        expect(ConjugationEngine.getFormDisplayName('present')).toBe('Present');
        expect(ConjugationEngine.getFormDisplayName('past')).toBe('Past');
        expect(ConjugationEngine.getFormDisplayName('teForm')).toBe('Te Form');
        expect(ConjugationEngine.getFormDisplayName('taiForm')).toBe('Tai Form (want to)');
      });
    });

    describe('getConjugationRule', () => {
      test('should return appropriate rules', () => {
        expect(ConjugationEngine.getConjugationRule('Ichidan', 'teForm'))
          .toBe('Remove る and add て');
        expect(ConjugationEngine.getConjugationRule('Godan', 'negative'))
          .toBe('Change ending to あ-row and add ない');
        expect(ConjugationEngine.getConjugationRule('i-adjective', 'negative'))
          .toBe('Change い to くない');
        expect(ConjugationEngine.getConjugationRule('na-adjective', 'past'))
          .toBe('Add だった');
      });

      test('should return default rule for unknown combinations', () => {
        expect(ConjugationEngine.getConjugationRule('noun' as any, 'present'))
          .toBe('Apply appropriate conjugation rule');
      });
    });
  });
});