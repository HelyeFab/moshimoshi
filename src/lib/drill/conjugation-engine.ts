/**
 * Japanese Conjugation Engine
 * Core logic for generating conjugations for verbs and adjectives
 * Extracted and cleaned from doshi-sensei
 */

import { JapaneseWord, WordType, ConjugationForms } from '@/types/drill';

/**
 * Main conjugation engine class
 */
export class ConjugationEngine {
  /**
   * Conjugate a Japanese word into all its forms
   */
  static conjugate(word: JapaneseWord): ConjugationForms {
    // Handle null/undefined word
    if (!word || !word.type) {
      return this.getEmptyForms();
    }

    switch (word.type) {
      case 'Ichidan':
        return this.conjugateIchidan(word);
      case 'Godan':
        return this.conjugateGodan(word);
      case 'Irregular':
        return this.conjugateIrregular(word);
      case 'i-adjective':
        return this.conjugateIAdjective(word);
      case 'na-adjective':
        return this.conjugateNaAdjective(word);
      default:
        return this.getEmptyForms();
    }
  }

  /**
   * Conjugate Ichidan (ru-verb) verbs
   */
  private static conjugateIchidan(word: JapaneseWord): ConjugationForms {
    const kana = word.kana || '';
    const kanji = word.kanji || kana || '';

    if (!kana && !kanji) {
      return this.getEmptyForms();
    }

    const stem = kana.slice(0, -1);
    const kanjiStem = kanji.slice(0, -1);

    return {
      // Basic forms
      present: kanji,
      past: kanjiStem + 'た',
      negative: kanjiStem + 'ない',
      pastNegative: kanjiStem + 'なかった',

      // Polite forms
      polite: kanjiStem + 'ます',
      politePast: kanjiStem + 'ました',
      politeNegative: kanjiStem + 'ません',
      politePastNegative: kanjiStem + 'ませんでした',

      // Te forms
      teForm: kanjiStem + 'て',
      negativeTeForm: kanjiStem + 'なくて',

      // Stems
      masuStem: kanjiStem,
      negativeStem: kanjiStem + 'な',

      // Conditional
      provisional: kanjiStem + 'れば',
      conditional: kanjiStem + 'たら',

      // Volitional
      volitional: kanjiStem + 'よう',

      // Potential
      potential: kanjiStem + 'られる',
      potentialNegative: kanjiStem + 'られない',

      // Passive
      passive: kanjiStem + 'られる',
      passiveNegative: kanjiStem + 'られない',

      // Causative
      causative: kanjiStem + 'させる',
      causativeNegative: kanjiStem + 'させない',

      // Imperative
      imperativePlain: kanjiStem + 'ろ',
      imperativePolite: kanjiStem + 'てください',

      // Tai form
      taiForm: kanjiStem + 'たい',
      taiFormNegative: kanjiStem + 'たくない',

      // Adverbial (N/A for verbs)
      adverbial: undefined,
    };
  }

  /**
   * Conjugate Godan (u-verb) verbs
   */
  private static conjugateGodan(word: JapaneseWord): ConjugationForms {
    const kana = word.kana || '';
    const kanji = word.kanji || kana || '';

    if (!kana && !kanji) {
      return this.getEmptyForms();
    }

    const lastChar = kana[kana.length - 1];
    const kanjiStem = kanji.slice(0, -1);

    // Get the appropriate stem transformations based on ending
    const stems = this.getGodanStems(kanji, lastChar);

    return {
      // Basic forms
      present: kanji,
      past: stems.ta,
      negative: stems.nai,
      pastNegative: stems.nakatta,

      // Polite forms
      polite: stems.masu,
      politePast: stems.mashita,
      politeNegative: stems.masen,
      politePastNegative: stems.masendeshita,

      // Te forms
      teForm: stems.te,
      negativeTeForm: stems.nakute,

      // Stems
      masuStem: stems.stem,
      negativeStem: stems.naiStem,

      // Conditional
      provisional: stems.eba,
      conditional: stems.tara,

      // Volitional
      volitional: stems.volitional,

      // Potential
      potential: stems.potential,
      potentialNegative: stems.potentialNegative,

      // Passive
      passive: stems.passive,
      passiveNegative: stems.passiveNegative,

      // Causative
      causative: stems.causative,
      causativeNegative: stems.causativeNegative,

      // Imperative
      imperativePlain: stems.imperative,
      imperativePolite: stems.te + 'ください',

      // Tai form
      taiForm: stems.tai,
      taiFormNegative: stems.taiNegative,

      // Adverbial (N/A for verbs)
      adverbial: undefined,
    };
  }

  /**
   * Get Godan verb stems based on ending
   */
  private static getGodanStems(kanji: string, lastKana: string): any {
    const stem = kanji.slice(0, -1);

    // Map endings to their conjugation patterns
    const patterns: Record<string, any> = {
      'う': {
        stem: stem + 'い',
        ta: stem + 'った',
        te: stem + 'って',
        nai: stem + 'わない',
        nakatta: stem + 'わなかった',
        nakute: stem + 'わなくて',
        naiStem: stem + 'わ',
        masu: stem + 'います',
        mashita: stem + 'いました',
        masen: stem + 'いません',
        masendeshita: stem + 'いませんでした',
        eba: stem + 'えば',
        tara: stem + 'ったら',
        volitional: stem + 'おう',
        potential: stem + 'える',
        potentialNegative: stem + 'えない',
        passive: stem + 'われる',
        passiveNegative: stem + 'われない',
        causative: stem + 'わせる',
        causativeNegative: stem + 'わせない',
        imperative: stem + 'え',
        tai: stem + 'いたい',
        taiNegative: stem + 'いたくない',
      },
      'く': {
        stem: stem + 'き',
        ta: stem + 'いた',
        te: stem + 'いて',
        nai: stem + 'かない',
        nakatta: stem + 'かなかった',
        nakute: stem + 'かなくて',
        naiStem: stem + 'か',
        masu: stem + 'きます',
        mashita: stem + 'きました',
        masen: stem + 'きません',
        masendeshita: stem + 'きませんでした',
        eba: stem + 'けば',
        tara: stem + 'いたら',
        volitional: stem + 'こう',
        potential: stem + 'ける',
        potentialNegative: stem + 'けない',
        passive: stem + 'かれる',
        passiveNegative: stem + 'かれない',
        causative: stem + 'かせる',
        causativeNegative: stem + 'かせない',
        imperative: stem + 'け',
        tai: stem + 'きたい',
        taiNegative: stem + 'きたくない',
      },
      'ぐ': {
        stem: stem + 'ぎ',
        ta: stem + 'いだ',
        te: stem + 'いで',
        nai: stem + 'がない',
        nakatta: stem + 'がなかった',
        nakute: stem + 'がなくて',
        naiStem: stem + 'が',
        masu: stem + 'ぎます',
        mashita: stem + 'ぎました',
        masen: stem + 'ぎません',
        masendeshita: stem + 'ぎませんでした',
        eba: stem + 'げば',
        tara: stem + 'いだら',
        volitional: stem + 'ごう',
        potential: stem + 'げる',
        potentialNegative: stem + 'げない',
        passive: stem + 'がれる',
        passiveNegative: stem + 'がれない',
        causative: stem + 'がせる',
        causativeNegative: stem + 'がせない',
        imperative: stem + 'げ',
        tai: stem + 'ぎたい',
        taiNegative: stem + 'ぎたくない',
      },
      'す': {
        stem: stem + 'し',
        ta: stem + 'した',
        te: stem + 'して',
        nai: stem + 'さない',
        nakatta: stem + 'さなかった',
        nakute: stem + 'さなくて',
        naiStem: stem + 'さ',
        masu: stem + 'します',
        mashita: stem + 'しました',
        masen: stem + 'しません',
        masendeshita: stem + 'しませんでした',
        eba: stem + 'せば',
        tara: stem + 'したら',
        volitional: stem + 'そう',
        potential: stem + 'せる',
        potentialNegative: stem + 'せない',
        passive: stem + 'される',
        passiveNegative: stem + 'されない',
        causative: stem + 'させる',
        causativeNegative: stem + 'させない',
        imperative: stem + 'せ',
        tai: stem + 'したい',
        taiNegative: stem + 'したくない',
      },
      'つ': {
        stem: stem + 'ち',
        ta: stem + 'った',
        te: stem + 'って',
        nai: stem + 'たない',
        nakatta: stem + 'たなかった',
        nakute: stem + 'たなくて',
        naiStem: stem + 'た',
        masu: stem + 'ちます',
        mashita: stem + 'ちました',
        masen: stem + 'ちません',
        masendeshita: stem + 'ちませんでした',
        eba: stem + 'てば',
        tara: stem + 'ったら',
        volitional: stem + 'とう',
        potential: stem + 'てる',
        potentialNegative: stem + 'てない',
        passive: stem + 'たれる',
        passiveNegative: stem + 'たれない',
        causative: stem + 'たせる',
        causativeNegative: stem + 'たせない',
        imperative: stem + 'て',
        tai: stem + 'ちたい',
        taiNegative: stem + 'ちたくない',
      },
      'ぬ': {
        stem: stem + 'に',
        ta: stem + 'んだ',
        te: stem + 'んで',
        nai: stem + 'なない',
        nakatta: stem + 'ななかった',
        nakute: stem + 'ななくて',
        naiStem: stem + 'な',
        masu: stem + 'にます',
        mashita: stem + 'にました',
        masen: stem + 'にません',
        masendeshita: stem + 'にませんでした',
        eba: stem + 'ねば',
        tara: stem + 'んだら',
        volitional: stem + 'のう',
        potential: stem + 'ねる',
        potentialNegative: stem + 'ねない',
        passive: stem + 'なれる',
        passiveNegative: stem + 'なれない',
        causative: stem + 'なせる',
        causativeNegative: stem + 'なせない',
        imperative: stem + 'ね',
        tai: stem + 'にたい',
        taiNegative: stem + 'にたくない',
      },
      'ぶ': {
        stem: stem + 'び',
        ta: stem + 'んだ',
        te: stem + 'んで',
        nai: stem + 'ばない',
        nakatta: stem + 'ばなかった',
        nakute: stem + 'ばなくて',
        naiStem: stem + 'ば',
        masu: stem + 'びます',
        mashita: stem + 'びました',
        masen: stem + 'びません',
        masendeshita: stem + 'びませんでした',
        eba: stem + 'べば',
        tara: stem + 'んだら',
        volitional: stem + 'ぼう',
        potential: stem + 'べる',
        potentialNegative: stem + 'べない',
        passive: stem + 'ばれる',
        passiveNegative: stem + 'ばれない',
        causative: stem + 'ばせる',
        causativeNegative: stem + 'ばせない',
        imperative: stem + 'べ',
        tai: stem + 'びたい',
        taiNegative: stem + 'びたくない',
      },
      'む': {
        stem: stem + 'み',
        ta: stem + 'んだ',
        te: stem + 'んで',
        nai: stem + 'まない',
        nakatta: stem + 'まなかった',
        nakute: stem + 'まなくて',
        naiStem: stem + 'ま',
        masu: stem + 'みます',
        mashita: stem + 'みました',
        masen: stem + 'みません',
        masendeshita: stem + 'みませんでした',
        eba: stem + 'めば',
        tara: stem + 'んだら',
        volitional: stem + 'もう',
        potential: stem + 'める',
        potentialNegative: stem + 'めない',
        passive: stem + 'まれる',
        passiveNegative: stem + 'まれない',
        causative: stem + 'ませる',
        causativeNegative: stem + 'ませない',
        imperative: stem + 'め',
        tai: stem + 'みたい',
        taiNegative: stem + 'みたくない',
      },
      'る': {
        stem: stem + 'り',
        ta: stem + 'った',
        te: stem + 'って',
        nai: stem + 'らない',
        nakatta: stem + 'らなかった',
        nakute: stem + 'らなくて',
        naiStem: stem + 'ら',
        masu: stem + 'ります',
        mashita: stem + 'りました',
        masen: stem + 'りません',
        masendeshita: stem + 'りませんでした',
        eba: stem + 'れば',
        tara: stem + 'ったら',
        volitional: stem + 'ろう',
        potential: stem + 'れる',
        potentialNegative: stem + 'れない',
        passive: stem + 'られる',
        passiveNegative: stem + 'られない',
        causative: stem + 'らせる',
        causativeNegative: stem + 'らせない',
        imperative: stem + 'れ',
        tai: stem + 'りたい',
        taiNegative: stem + 'りたくない',
      },
    };

    return patterns[lastKana] || patterns['う'];
  }

  /**
   * Conjugate irregular verbs (する, 来る, etc.)
   */
  private static conjugateIrregular(word: JapaneseWord): ConjugationForms {
    if (word.kanji === 'する' || word.kanji.endsWith('する')) {
      return this.conjugateSuru(word);
    }
    if (word.kanji === '来る' || word.kanji === 'くる') {
      return this.conjugateKuru(word);
    }
    if (word.kanji === '行く' || word.kanji === 'いく') {
      return this.conjugateIku(word);
    }

    // Default to する conjugation for other irregular verbs
    return this.conjugateSuru(word);
  }

  /**
   * Conjugate する verbs
   */
  private static conjugateSuru(word: JapaneseWord): ConjugationForms {
    const stem = word.kanji.endsWith('する') ? word.kanji.slice(0, -2) : '';

    return {
      present: word.kanji,
      past: stem + 'した',
      negative: stem + 'しない',
      pastNegative: stem + 'しなかった',
      polite: stem + 'します',
      politePast: stem + 'しました',
      politeNegative: stem + 'しません',
      politePastNegative: stem + 'しませんでした',
      teForm: stem + 'して',
      negativeTeForm: stem + 'しなくて',
      masuStem: stem + 'し',
      negativeStem: stem + 'しな',
      provisional: stem + 'すれば',
      conditional: stem + 'したら',
      volitional: stem + 'しよう',
      potential: stem + 'できる',
      potentialNegative: stem + 'できない',
      passive: stem + 'される',
      passiveNegative: stem + 'されない',
      causative: stem + 'させる',
      causativeNegative: stem + 'させない',
      imperativePlain: stem + 'しろ',
      imperativePolite: stem + 'してください',
      taiForm: stem + 'したい',
      taiFormNegative: stem + 'したくない',
      adverbial: undefined,
    };
  }

  /**
   * Conjugate 来る (kuru)
   */
  private static conjugateKuru(word: JapaneseWord): ConjugationForms {
    return {
      present: '来る',
      past: '来た',
      negative: '来ない',
      pastNegative: '来なかった',
      polite: '来ます',
      politePast: '来ました',
      politeNegative: '来ません',
      politePastNegative: '来ませんでした',
      teForm: '来て',
      negativeTeForm: '来なくて',
      masuStem: '来',
      negativeStem: '来な',
      provisional: '来れば',
      conditional: '来たら',
      volitional: '来よう',
      potential: '来られる',
      potentialNegative: '来られない',
      passive: '来られる',
      passiveNegative: '来られない',
      causative: '来させる',
      causativeNegative: '来させない',
      imperativePlain: '来い',
      imperativePolite: '来てください',
      taiForm: '来たい',
      taiFormNegative: '来たくない',
      adverbial: undefined,
    };
  }

  /**
   * Conjugate 行く (iku) - special case for past tense
   */
  private static conjugateIku(word: JapaneseWord): ConjugationForms {
    return {
      present: '行く',
      past: '行った', // Special case: not 行いた
      negative: '行かない',
      pastNegative: '行かなかった',
      polite: '行きます',
      politePast: '行きました',
      politeNegative: '行きません',
      politePastNegative: '行きませんでした',
      teForm: '行って', // Special case: not 行いて
      negativeTeForm: '行かなくて',
      masuStem: '行き',
      negativeStem: '行か',
      provisional: '行けば',
      conditional: '行ったら',
      volitional: '行こう',
      potential: '行ける',
      potentialNegative: '行けない',
      passive: '行かれる',
      passiveNegative: '行かれない',
      causative: '行かせる',
      causativeNegative: '行かせない',
      imperativePlain: '行け',
      imperativePolite: '行ってください',
      taiForm: '行きたい',
      taiFormNegative: '行きたくない',
      adverbial: undefined,
    };
  }

  /**
   * Conjugate i-adjectives
   */
  private static conjugateIAdjective(word: JapaneseWord): ConjugationForms {
    const stem = word.kanji.slice(0, -1);

    return {
      present: word.kanji,
      past: stem + 'かった',
      negative: stem + 'くない',
      pastNegative: stem + 'くなかった',
      polite: word.kanji + 'です',
      politePast: stem + 'かったです',
      politeNegative: stem + 'くないです',
      politePastNegative: stem + 'くなかったです',
      teForm: stem + 'くて',
      negativeTeForm: stem + 'くなくて',
      masuStem: stem,
      negativeStem: stem + 'くな',
      provisional: stem + 'ければ',
      conditional: stem + 'かったら',
      volitional: undefined,
      adverbial: stem + 'く',
    };
  }

  /**
   * Conjugate na-adjectives
   */
  private static conjugateNaAdjective(word: JapaneseWord): ConjugationForms {
    return {
      present: word.kanji + 'だ',
      past: word.kanji + 'だった',
      negative: word.kanji + 'じゃない',
      pastNegative: word.kanji + 'じゃなかった',
      polite: word.kanji + 'です',
      politePast: word.kanji + 'でした',
      politeNegative: word.kanji + 'じゃありません',
      politePastNegative: word.kanji + 'じゃありませんでした',
      teForm: word.kanji + 'で',
      negativeTeForm: word.kanji + 'じゃなくて',
      masuStem: word.kanji,
      negativeStem: word.kanji + 'じゃな',
      provisional: word.kanji + 'なら',
      conditional: word.kanji + 'だったら',
      volitional: undefined,
      adverbial: word.kanji + 'に',
    };
  }

  /**
   * Get empty forms for non-conjugable words
   */
  private static getEmptyForms(): ConjugationForms {
    return {
      present: '',
      past: '',
      negative: '',
      pastNegative: '',
      polite: '',
      politePast: '',
      politeNegative: '',
      politePastNegative: '',
      teForm: '',
      negativeTeForm: '',
      masuStem: '',
      negativeStem: '',
      provisional: '',
      conditional: '',
      volitional: '',
    };
  }

  /**
   * Get all possible conjugated forms (for distractor generation)
   */
  static getAllPossibleForms(conjugations: ConjugationForms): string[] {
    return Object.values(conjugations)
      .filter(form => form && form !== '')
      .filter((value, index, self) => self.indexOf(value) === index);
  }

  /**
   * Get a random conjugation form based on word type
   */
  static getRandomConjugationForm(wordType: WordType): keyof ConjugationForms {
    const verbForms: (keyof ConjugationForms)[] = [
      'present', 'past', 'negative', 'pastNegative',
      'polite', 'politePast', 'politeNegative', 'politePastNegative',
      'teForm', 'potential', 'passive', 'causative',
      'conditional', 'volitional', 'taiForm'
    ];

    const adjectiveForms: (keyof ConjugationForms)[] = [
      'present', 'past', 'negative', 'pastNegative',
      'polite', 'politePast', 'politeNegative', 'politePastNegative',
      'teForm', 'conditional', 'adverbial'
    ];

    const forms = wordType === 'i-adjective' || wordType === 'na-adjective'
      ? adjectiveForms
      : verbForms;

    return forms[Math.floor(Math.random() * forms.length)];
  }

  /**
   * Generate question stem text
   */
  static generateQuestionStem(word: JapaneseWord, targetForm: keyof ConjugationForms): string {
    const formName = this.getFormDisplayName(targetForm);
    return `${word.kanji}_____`;
  }

  /**
   * Get display name for conjugation form
   */
  static getFormDisplayName(form: keyof ConjugationForms): string {
    const names: Record<keyof ConjugationForms, string> = {
      present: 'Present',
      past: 'Past',
      negative: 'Negative',
      pastNegative: 'Past Negative',
      polite: 'Polite',
      politePast: 'Polite Past',
      politeNegative: 'Polite Negative',
      politePastNegative: 'Polite Past Negative',
      teForm: 'Te Form',
      negativeTeForm: 'Negative Te Form',
      masuStem: 'Masu Stem',
      negativeStem: 'Negative Stem',
      provisional: 'Provisional (ば)',
      conditional: 'Conditional (たら)',
      volitional: 'Volitional',
      potential: 'Potential',
      potentialNegative: 'Potential Negative',
      passive: 'Passive',
      passiveNegative: 'Passive Negative',
      causative: 'Causative',
      causativeNegative: 'Causative Negative',
      imperativePlain: 'Imperative',
      imperativePolite: 'Polite Imperative',
      taiForm: 'Tai Form (want to)',
      taiFormNegative: 'Tai Form Negative',
      adverbial: 'Adverbial',
    };
    return names[form] || form;
  }

  /**
   * Get conjugation rule explanation
   */
  static getConjugationRule(wordType: WordType, form: keyof ConjugationForms): string {
    const rules: Record<string, string> = {
      'Ichidan-teForm': 'Remove る and add て',
      'Ichidan-past': 'Remove る and add た',
      'Ichidan-negative': 'Remove る and add ない',
      'Godan-teForm': 'Change ending based on verb group and add て/で',
      'Godan-past': 'Change ending based on verb group and add た/だ',
      'Godan-negative': 'Change ending to あ-row and add ない',
      'i-adjective-negative': 'Change い to くない',
      'i-adjective-past': 'Change い to かった',
      'na-adjective-negative': 'Add じゃない',
      'na-adjective-past': 'Add だった',
    };

    const key = `${wordType}-${form}`;
    return rules[key] || 'Apply appropriate conjugation rule';
  }
}