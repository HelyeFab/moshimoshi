// Extended Conjugation Engine with Comprehensive Forms
// Supports Godan, Ichidan, and Irregular verbs with 100+ conjugation forms

import { EnhancedJapaneseWord } from '@/utils/enhancedWordTypeDetection';
import { ExtendedConjugationForms } from '@/types/conjugation';

export class ExtendedConjugationEngine {
  
  // Main conjugation function
  static conjugate(word: EnhancedJapaneseWord): ExtendedConjugationForms {
    // Use the conjugationType for accurate classification
    switch (word.conjugationType || word.type) {
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
        return this.getEmptyConjugations();
    }
  }

  // ============= GODAN VERB CONJUGATION =============
  private static conjugateGodan(word: EnhancedJapaneseWord): ExtendedConjugationForms {
    const kanji = word.kanji || '';
    const kana = word.kana || word.kanji || '';
    const lastChar = kana.slice(-1);
    const kanjiStem = kanji.slice(0, -1);
    
    // Get the conjugation mappings for the last character
    const mappings = this.getGodanMappings(lastChar, word);
    
    if (!mappings) {
      return this.getEmptyConjugations();
    }

    // Generate potential conjugations (Godan becomes Ichidan)
    const potentialBase = kanjiStem + mappings.potential + 'る';
    const potentialConjugations = this.conjugateAsIchidan(potentialBase);
    
    // Generate passive conjugations (Godan becomes Ichidan)
    const passiveBase = kanjiStem + mappings.passive + 'れる';
    const passiveConjugations = this.conjugateAsIchidan(passiveBase);
    
    // Generate causative conjugations (Godan becomes Ichidan)
    const causativeBase = kanjiStem + mappings.causative + 'せる';
    const causativeConjugations = this.conjugateAsIchidan(causativeBase);
    
    // Generate causative-passive conjugations
    const causativePassiveBase = kanjiStem + mappings.causative + 'される';
    const causativePassiveConjugations = this.conjugateAsIchidan(causativePassiveBase);

    return {
      // ============= BASIC FORMS =============
      present: kanji,
      masuStem: kanjiStem + mappings.polite,
      negativeStem: kanjiStem + mappings.negative,
      
      past: kanjiStem + mappings.past,
      negative: kanjiStem + mappings.negative + 'ない',
      pastNegative: kanjiStem + mappings.negative + 'なかった',
      
      // ============= POLITE FORMS =============
      polite: kanjiStem + mappings.polite + 'ます',
      politePast: kanjiStem + mappings.polite + 'ました',
      politeNegative: kanjiStem + mappings.polite + 'ません',
      politePastNegative: kanjiStem + mappings.polite + 'ませんでした',
      politeVolitional: kanjiStem + mappings.polite + 'ましょう',
      
      // ============= TE FORMS =============
      teForm: kanjiStem + mappings.teForm,
      negativeTeForm: kanjiStem + mappings.negative + 'なくて',
      naiDeForm: kanjiStem + mappings.negative + 'ないで',
      adverbialNegative: kanjiStem + mappings.negative + 'なく',
      
      // ============= VOLITIONAL =============
      volitional: kanjiStem + mappings.volitional,
      volitionalNegative: kanji + 'まい',
      
      // ============= IMPERATIVE =============
      imperativePlain: kanjiStem + mappings.imperative,
      imperativePolite: kanjiStem + mappings.polite + 'なさい',
      imperativeNegative: kanji + 'な',
      
      // ============= CONDITIONAL FORMS =============
      provisional: kanjiStem + mappings.conditional + 'ば',
      provisionalNegative: kanjiStem + mappings.negative + 'なければ',
      provisionalNegativeColloquial: kanjiStem + mappings.negative + 'なきゃ',
      
      conditional: kanjiStem + mappings.past.replace(/[だた]$/, match => match === 'だ' ? 'だら' : 'たら'),
      conditionalNegative: kanjiStem + mappings.negative + 'なかったら',
      
      alternativeForm: kanjiStem + mappings.past + 'り',
      alternativeNegative: kanjiStem + mappings.negative + 'なかったり',
      
      // ============= POTENTIAL FORMS =============
      potential: potentialBase,
      potentialNegative: potentialConjugations.negative,
      potentialPast: potentialConjugations.past,
      potentialPastNegative: potentialConjugations.pastNegative,
      
      potentialMasuStem: potentialConjugations.masuStem,
      potentialTeForm: potentialConjugations.teForm,
      potentialNegativeTeForm: potentialConjugations.negativeTeForm,
      
      potentialPolite: potentialConjugations.polite,
      potentialPoliteNegative: potentialConjugations.politeNegative,
      potentialPolitePast: potentialConjugations.politePast,
      potentialPolitePastNegative: potentialConjugations.politePastNegative,
      
      // ============= PASSIVE FORMS =============
      passive: passiveBase,
      passiveNegative: passiveConjugations.negative,
      passivePast: passiveConjugations.past,
      passivePastNegative: passiveConjugations.pastNegative,
      
      passiveMasuStem: passiveConjugations.masuStem,
      passiveTeForm: passiveConjugations.teForm,
      passiveNegativeTeForm: passiveConjugations.negativeTeForm,
      
      passivePolite: passiveConjugations.polite,
      passivePoliteNegative: passiveConjugations.politeNegative,
      passivePolitePast: passiveConjugations.politePast,
      passivePolitePastNegative: passiveConjugations.politePastNegative,
      
      // ============= CAUSATIVE FORMS =============
      causative: causativeBase,
      causativeNegative: causativeConjugations.negative,
      causativePast: causativeConjugations.past,
      causativePastNegative: causativeConjugations.pastNegative,
      
      causativeMasuStem: causativeConjugations.masuStem,
      causativeTeForm: causativeConjugations.teForm,
      causativeNegativeTeForm: causativeConjugations.negativeTeForm,
      
      causativePolite: causativeConjugations.polite,
      causativePoliteNegative: causativeConjugations.politeNegative,
      causativePolitePast: causativeConjugations.politePast,
      causativePolitePastNegative: causativeConjugations.politePastNegative,
      
      // ============= CAUSATIVE-PASSIVE =============
      causativePassive: causativePassiveBase,
      causativePassiveNegative: causativePassiveConjugations.negative,
      causativePassivePast: causativePassiveConjugations.past,
      causativePassivePastNegative: causativePassiveConjugations.pastNegative,
      
      causativePassiveMasuStem: causativePassiveConjugations.masuStem,
      causativePassiveTeForm: causativePassiveConjugations.teForm,
      causativePassiveNegativeTeForm: causativePassiveConjugations.negativeTeForm,
      
      causativePassivePolite: causativePassiveConjugations.polite,
      causativePassivePoliteNegative: causativePassiveConjugations.politeNegative,
      causativePassivePolitePast: causativePassiveConjugations.politePast,
      causativePassivePolitePastNegative: causativePassiveConjugations.politePastNegative,
      
      // ============= TAI FORMS =============
      ...this.generateTaiForms(kanjiStem + mappings.polite),
      
      // ============= PROGRESSIVE FORMS =============
      progressive: kanjiStem + mappings.teForm.replace(/[てで]$/, '') + 'ている',
      progressiveNegative: kanjiStem + mappings.teForm.replace(/[てで]$/, '') + 'ていない',
      progressivePast: kanjiStem + mappings.teForm.replace(/[てで]$/, '') + 'ていた',
      progressivePastNegative: kanjiStem + mappings.teForm.replace(/[てで]$/, '') + 'ていなかった',
      progressivePolite: kanjiStem + mappings.teForm.replace(/[てで]$/, '') + 'ています',
      progressivePoliteNegative: kanjiStem + mappings.teForm.replace(/[てで]$/, '') + 'ていません',
      progressivePolitePast: kanjiStem + mappings.teForm.replace(/[てで]$/, '') + 'ていました',
      progressivePolitePastNegative: kanjiStem + mappings.teForm.replace(/[てで]$/, '') + 'ていませんでした',
      
      // ============= REQUEST FORMS =============
      request: kanjiStem + mappings.teForm + 'ください',
      requestNegative: kanjiStem + mappings.negative + 'ないでください',
      
      // ============= COLLOQUIAL FORMS =============
      colloquialNegative: kanjiStem + mappings.negative + 'ん',
      
      // ============= CLASSICAL FORMS =============
      formalNegative: kanjiStem + mappings.negative + 'ず',
      classicalNegative: kanjiStem + mappings.negative + 'ぬ',
      classicalNegativeModifier: kanjiStem + mappings.negative + 'ざる',
      
      // ============= PRESUMPTIVE FORMS =============
      presumptive: kanji + 'だろう',
      presumptiveNegative: kanjiStem + mappings.negative + 'ないだろう',
      presumptivePolite: kanji + 'でしょう',
      presumptivePoliteNegative: kanjiStem + mappings.negative + 'ないでしょう',
    };
  }

  // ============= ICHIDAN VERB CONJUGATION =============
  private static conjugateIchidan(word: EnhancedJapaneseWord): ExtendedConjugationForms {
    const kanji = word.kanji || '';
    const kanjiStem = kanji.slice(0, -1); // Remove る
    
    return {
      // ============= BASIC FORMS =============
      present: kanji,
      masuStem: kanjiStem,
      negativeStem: kanjiStem,
      
      past: kanjiStem + 'た',
      negative: kanjiStem + 'ない',
      pastNegative: kanjiStem + 'なかった',
      
      // ============= POLITE FORMS =============
      polite: kanjiStem + 'ます',
      politePast: kanjiStem + 'ました',
      politeNegative: kanjiStem + 'ません',
      politePastNegative: kanjiStem + 'ませんでした',
      politeVolitional: kanjiStem + 'ましょう',
      
      // ============= TE FORMS =============
      teForm: kanjiStem + 'て',
      negativeTeForm: kanjiStem + 'なくて',
      naiDeForm: kanjiStem + 'ないで',
      adverbialNegative: kanjiStem + 'なく',
      
      // ============= VOLITIONAL =============
      volitional: kanjiStem + 'よう',
      volitionalNegative: kanji + 'まい',
      
      // ============= IMPERATIVE =============
      imperativePlain: kanjiStem + 'ろ',
      imperativePolite: kanjiStem + 'なさい',
      imperativeNegative: kanji + 'な',
      
      // ============= CONDITIONAL FORMS =============
      provisional: kanjiStem + 'れば',
      provisionalNegative: kanjiStem + 'なければ',
      provisionalNegativeColloquial: kanjiStem + 'なきゃ',
      
      conditional: kanjiStem + 'たら',
      conditionalNegative: kanjiStem + 'なかったら',
      
      alternativeForm: kanjiStem + 'たり',
      alternativeNegative: kanjiStem + 'なかったり',
      
      // ============= POTENTIAL FORMS =============
      potential: kanjiStem + 'られる',
      potentialNegative: kanjiStem + 'られない',
      potentialPast: kanjiStem + 'られた',
      potentialPastNegative: kanjiStem + 'られなかった',
      
      potentialMasuStem: kanjiStem + 'られ',
      potentialTeForm: kanjiStem + 'られて',
      potentialNegativeTeForm: kanjiStem + 'られなくて',
      
      potentialPolite: kanjiStem + 'られます',
      potentialPoliteNegative: kanjiStem + 'られません',
      potentialPolitePast: kanjiStem + 'られました',
      potentialPolitePastNegative: kanjiStem + 'られませんでした',
      
      // ============= PASSIVE FORMS =============
      passive: kanjiStem + 'られる',
      passiveNegative: kanjiStem + 'られない',
      passivePast: kanjiStem + 'られた',
      passivePastNegative: kanjiStem + 'られなかった',
      
      passiveMasuStem: kanjiStem + 'られ',
      passiveTeForm: kanjiStem + 'られて',
      passiveNegativeTeForm: kanjiStem + 'られなくて',
      
      passivePolite: kanjiStem + 'られます',
      passivePoliteNegative: kanjiStem + 'られません',
      passivePolitePast: kanjiStem + 'られました',
      passivePolitePastNegative: kanjiStem + 'られませんでした',
      
      // ============= CAUSATIVE FORMS =============
      causative: kanjiStem + 'させる',
      causativeNegative: kanjiStem + 'させない',
      causativePast: kanjiStem + 'させた',
      causativePastNegative: kanjiStem + 'させなかった',
      
      causativeMasuStem: kanjiStem + 'させ',
      causativeTeForm: kanjiStem + 'させて',
      causativeNegativeTeForm: kanjiStem + 'させなくて',
      
      causativePolite: kanjiStem + 'させます',
      causativePoliteNegative: kanjiStem + 'させません',
      causativePolitePast: kanjiStem + 'させました',
      causativePolitePastNegative: kanjiStem + 'させませんでした',
      
      // ============= CAUSATIVE-PASSIVE =============
      causativePassive: kanjiStem + 'させられる',
      causativePassiveNegative: kanjiStem + 'させられない',
      causativePassivePast: kanjiStem + 'させられた',
      causativePassivePastNegative: kanjiStem + 'させられなかった',
      
      causativePassiveMasuStem: kanjiStem + 'させられ',
      causativePassiveTeForm: kanjiStem + 'させられて',
      causativePassiveNegativeTeForm: kanjiStem + 'させられなくて',
      
      causativePassivePolite: kanjiStem + 'させられます',
      causativePassivePoliteNegative: kanjiStem + 'させられません',
      causativePassivePolitePast: kanjiStem + 'させられました',
      causativePassivePolitePastNegative: kanjiStem + 'させられませんでした',
      
      // ============= TAI FORMS =============
      ...this.generateTaiForms(kanjiStem),
      
      // ============= PROGRESSIVE FORMS =============
      progressive: kanjiStem + 'ている',
      progressiveNegative: kanjiStem + 'ていない',
      progressivePast: kanjiStem + 'ていた',
      progressivePastNegative: kanjiStem + 'ていなかった',
      progressivePolite: kanjiStem + 'ています',
      progressivePoliteNegative: kanjiStem + 'ていません',
      progressivePolitePast: kanjiStem + 'ていました',
      progressivePolitePastNegative: kanjiStem + 'ていませんでした',
      
      // ============= REQUEST FORMS =============
      request: kanjiStem + 'てください',
      requestNegative: kanjiStem + 'ないでください',
      
      // ============= COLLOQUIAL FORMS =============
      colloquialNegative: kanjiStem + 'ん',
      
      // ============= CLASSICAL FORMS =============
      formalNegative: kanjiStem + 'ず',
      classicalNegative: kanjiStem + 'ぬ',
      classicalNegativeModifier: kanjiStem + 'ざる',
      
      // ============= PRESUMPTIVE FORMS =============
      presumptive: kanji + 'だろう',
      presumptiveNegative: kanjiStem + 'ないだろう',
      presumptivePolite: kanji + 'でしょう',
      presumptivePoliteNegative: kanjiStem + 'ないでしょう',
    };
  }

  // ============= IRREGULAR VERB CONJUGATION =============
  private static conjugateIrregular(word: EnhancedJapaneseWord): ExtendedConjugationForms {
    const kanji = word.kanji || '';
    const kana = word.kana || word.kanji || '';
    
    // Handle する verbs
    if (kana === 'する' || kana.endsWith('する')) {
      return this.conjugateSuru(word);
    }
    
    // Handle 来る
    if (kanji === '来る' || kana === 'くる') {
      return this.conjugateKuru(word);
    }
    
    return this.getEmptyConjugations();
  }

  // Helper: Conjugate する verbs
  private static conjugateSuru(word: JapaneseWord): ExtendedConjugationForms {
    const kanji = word.kanji || '';
    const kanjiPrefix = kanji.slice(0, -2);
    
    return {
      // ============= BASIC FORMS =============
      present: kanji,
      masuStem: kanjiPrefix + 'し',
      negativeStem: kanjiPrefix + 'し',
      
      past: kanjiPrefix + 'した',
      negative: kanjiPrefix + 'しない',
      pastNegative: kanjiPrefix + 'しなかった',
      
      // ============= POLITE FORMS =============
      polite: kanjiPrefix + 'します',
      politePast: kanjiPrefix + 'しました',
      politeNegative: kanjiPrefix + 'しません',
      politePastNegative: kanjiPrefix + 'しませんでした',
      politeVolitional: kanjiPrefix + 'しましょう',
      
      // ============= TE FORMS =============
      teForm: kanjiPrefix + 'して',
      negativeTeForm: kanjiPrefix + 'しなくて',
      naiDeForm: kanjiPrefix + 'しないで',
      adverbialNegative: kanjiPrefix + 'しなく',
      
      // ============= VOLITIONAL =============
      volitional: kanjiPrefix + 'しよう',
      volitionalNegative: kanjiPrefix + 'すまい',
      
      // ============= IMPERATIVE =============
      imperativePlain: kanjiPrefix + 'しろ',
      imperativePolite: kanjiPrefix + 'しなさい',
      imperativeNegative: kanjiPrefix + 'するな',
      
      // ============= CONDITIONAL FORMS =============
      provisional: kanjiPrefix + 'すれば',
      provisionalNegative: kanjiPrefix + 'しなければ',
      provisionalNegativeColloquial: kanjiPrefix + 'しなきゃ',
      
      conditional: kanjiPrefix + 'したら',
      conditionalNegative: kanjiPrefix + 'しなかったら',
      
      alternativeForm: kanjiPrefix + 'したり',
      alternativeNegative: kanjiPrefix + 'しなかったり',
      
      // ============= POTENTIAL FORMS =============
      potential: kanjiPrefix + 'できる',
      potentialNegative: kanjiPrefix + 'できない',
      potentialPast: kanjiPrefix + 'できた',
      potentialPastNegative: kanjiPrefix + 'できなかった',
      
      potentialMasuStem: kanjiPrefix + 'でき',
      potentialTeForm: kanjiPrefix + 'できて',
      potentialNegativeTeForm: kanjiPrefix + 'できなくて',
      
      potentialPolite: kanjiPrefix + 'できます',
      potentialPoliteNegative: kanjiPrefix + 'できません',
      potentialPolitePast: kanjiPrefix + 'できました',
      potentialPolitePastNegative: kanjiPrefix + 'できませんでした',
      
      // ============= PASSIVE FORMS =============
      passive: kanjiPrefix + 'される',
      passiveNegative: kanjiPrefix + 'されない',
      passivePast: kanjiPrefix + 'された',
      passivePastNegative: kanjiPrefix + 'されなかった',
      
      passiveMasuStem: kanjiPrefix + 'され',
      passiveTeForm: kanjiPrefix + 'されて',
      passiveNegativeTeForm: kanjiPrefix + 'されなくて',
      
      passivePolite: kanjiPrefix + 'されます',
      passivePoliteNegative: kanjiPrefix + 'されません',
      passivePolitePast: kanjiPrefix + 'されました',
      passivePolitePastNegative: kanjiPrefix + 'されませんでした',
      
      // ============= CAUSATIVE FORMS =============
      causative: kanjiPrefix + 'させる',
      causativeNegative: kanjiPrefix + 'させない',
      causativePast: kanjiPrefix + 'させた',
      causativePastNegative: kanjiPrefix + 'させなかった',
      
      causativeMasuStem: kanjiPrefix + 'させ',
      causativeTeForm: kanjiPrefix + 'させて',
      causativeNegativeTeForm: kanjiPrefix + 'させなくて',
      
      causativePolite: kanjiPrefix + 'させます',
      causativePoliteNegative: kanjiPrefix + 'させません',
      causativePolitePast: kanjiPrefix + 'させました',
      causativePolitePastNegative: kanjiPrefix + 'させませんでした',
      
      // ============= CAUSATIVE-PASSIVE =============
      causativePassive: kanjiPrefix + 'させられる',
      causativePassiveNegative: kanjiPrefix + 'させられない',
      causativePassivePast: kanjiPrefix + 'させられた',
      causativePassivePastNegative: kanjiPrefix + 'させられなかった',
      
      causativePassiveMasuStem: kanjiPrefix + 'させられ',
      causativePassiveTeForm: kanjiPrefix + 'させられて',
      causativePassiveNegativeTeForm: kanjiPrefix + 'させられなくて',
      
      causativePassivePolite: kanjiPrefix + 'させられます',
      causativePassivePoliteNegative: kanjiPrefix + 'させられません',
      causativePassivePolitePast: kanjiPrefix + 'させられました',
      causativePassivePolitePastNegative: kanjiPrefix + 'させられませんでした',
      
      // ============= TAI FORMS =============
      ...this.generateTaiForms(kanjiPrefix + 'し'),
      
      // ============= PROGRESSIVE FORMS =============
      progressive: kanjiPrefix + 'している',
      progressiveNegative: kanjiPrefix + 'していない',
      progressivePast: kanjiPrefix + 'していた',
      progressivePastNegative: kanjiPrefix + 'していなかった',
      progressivePolite: kanjiPrefix + 'しています',
      progressivePoliteNegative: kanjiPrefix + 'していません',
      progressivePolitePast: kanjiPrefix + 'していました',
      progressivePolitePastNegative: kanjiPrefix + 'していませんでした',
      
      // ============= REQUEST FORMS =============
      request: kanjiPrefix + 'してください',
      requestNegative: kanjiPrefix + 'しないでください',
      
      // ============= COLLOQUIAL FORMS =============
      colloquialNegative: kanjiPrefix + 'しん',
      
      // ============= CLASSICAL FORMS =============
      formalNegative: kanjiPrefix + 'せず',
      classicalNegative: kanjiPrefix + 'せぬ',
      classicalNegativeModifier: kanjiPrefix + 'せざる',
      
      // ============= PRESUMPTIVE FORMS =============
      presumptive: kanjiPrefix + 'するだろう',
      presumptiveNegative: kanjiPrefix + 'しないだろう',
      presumptivePolite: kanjiPrefix + 'するでしょう',
      presumptivePoliteNegative: kanjiPrefix + 'しないでしょう',
    };
  }

  // Helper: Conjugate 来る
  private static conjugateKuru(word: JapaneseWord): ExtendedConjugationForms {
    return {
      // ============= BASIC FORMS =============
      present: '来る',
      masuStem: '来',
      negativeStem: '来',
      
      past: '来た',
      negative: '来ない',
      pastNegative: '来なかった',
      
      // ============= POLITE FORMS =============
      polite: '来ます',
      politePast: '来ました',
      politeNegative: '来ません',
      politePastNegative: '来ませんでした',
      politeVolitional: '来ましょう',
      
      // ============= TE FORMS =============
      teForm: '来て',
      negativeTeForm: '来なくて',
      naiDeForm: '来ないで',
      adverbialNegative: '来なく',
      
      // ============= VOLITIONAL =============
      volitional: '来よう',
      volitionalNegative: '来まい',
      
      // ============= IMPERATIVE =============
      imperativePlain: '来い',
      imperativePolite: '来なさい',
      imperativeNegative: '来るな',
      
      // ============= CONDITIONAL FORMS =============
      provisional: '来れば',
      provisionalNegative: '来なければ',
      provisionalNegativeColloquial: '来なきゃ',
      
      conditional: '来たら',
      conditionalNegative: '来なかったら',
      
      alternativeForm: '来たり',
      alternativeNegative: '来なかったり',
      
      // ============= POTENTIAL FORMS =============
      potential: '来られる',
      potentialNegative: '来られない',
      potentialPast: '来られた',
      potentialPastNegative: '来られなかった',
      
      potentialMasuStem: '来られ',
      potentialTeForm: '来られて',
      potentialNegativeTeForm: '来られなくて',
      
      potentialPolite: '来られます',
      potentialPoliteNegative: '来られません',
      potentialPolitePast: '来られました',
      potentialPolitePastNegative: '来られませんでした',
      
      // ============= PASSIVE FORMS =============
      passive: '来られる',
      passiveNegative: '来られない',
      passivePast: '来られた',
      passivePastNegative: '来られなかった',
      
      passiveMasuStem: '来られ',
      passiveTeForm: '来られて',
      passiveNegativeTeForm: '来られなくて',
      
      passivePolite: '来られます',
      passivePoliteNegative: '来られません',
      passivePolitePast: '来られました',
      passivePolitePastNegative: '来られませんでした',
      
      // ============= CAUSATIVE FORMS =============
      causative: '来させる',
      causativeNegative: '来させない',
      causativePast: '来させた',
      causativePastNegative: '来させなかった',
      
      causativeMasuStem: '来させ',
      causativeTeForm: '来させて',
      causativeNegativeTeForm: '来させなくて',
      
      causativePolite: '来させます',
      causativePoliteNegative: '来させません',
      causativePolitePast: '来させました',
      causativePolitePastNegative: '来させませんでした',
      
      // ============= CAUSATIVE-PASSIVE =============
      causativePassive: '来させられる',
      causativePassiveNegative: '来させられない',
      causativePassivePast: '来させられた',
      causativePassivePastNegative: '来させられなかった',
      
      causativePassiveMasuStem: '来させられ',
      causativePassiveTeForm: '来させられて',
      causativePassiveNegativeTeForm: '来させられなくて',
      
      causativePassivePolite: '来させられます',
      causativePassivePoliteNegative: '来させられません',
      causativePassivePolitePast: '来させられました',
      causativePassivePolitePastNegative: '来させられませんでした',
      
      // ============= TAI FORMS =============
      ...this.generateTaiForms('来'),
      
      // ============= PROGRESSIVE FORMS =============
      progressive: '来ている',
      progressiveNegative: '来ていない',
      progressivePast: '来ていた',
      progressivePastNegative: '来ていなかった',
      progressivePolite: '来ています',
      progressivePoliteNegative: '来ていません',
      progressivePolitePast: '来ていました',
      progressivePolitePastNegative: '来ていませんでした',
      
      // ============= REQUEST FORMS =============
      request: '来てください',
      requestNegative: '来ないでください',
      
      // ============= COLLOQUIAL FORMS =============
      colloquialNegative: '来ん',
      
      // ============= CLASSICAL FORMS =============
      formalNegative: '来ず',
      classicalNegative: '来ぬ',
      classicalNegativeModifier: '来ざる',
      
      // ============= PRESUMPTIVE FORMS =============
      presumptive: '来るだろう',
      presumptiveNegative: '来ないだろう',
      presumptivePolite: '来るでしょう',
      presumptivePoliteNegative: '来ないでしょう',
    };
  }

  // Helper: Generate TAI forms (treating as i-adjective)
  private static generateTaiForms(stem: string): Partial<ExtendedConjugationForms> {
    const taiBase = stem + 'たい';
    
    return {
      taiForm: taiBase,
      taiFormNegative: stem + 'たくない',
      taiFormPast: stem + 'たかった',
      taiFormPastNegative: stem + 'たくなかった',
      
      taiAdjectiveStem: stem + 'た',
      taiTeForm: stem + 'たくて',
      taiNegativeTeForm: stem + 'たくなくて',
      taiAdverbial: stem + 'たく',
      
      taiProvisional: stem + 'たければ',
      taiProvisionalNegative: stem + 'たくなければ',
      taiConditional: stem + 'たかったら',
      taiConditionalNegative: stem + 'たくなかったら',
      
      taiObjective: stem + 'たさ',
    };
  }

  // Helper: Conjugate as Ichidan (for potential/passive/causative forms)
  private static conjugateAsIchidan(base: string): ExtendedConjugationForms {
    const stem = base.slice(0, -1);
    const word: JapaneseWord = {
      id: 'temp',
      kanji: base,
      kana: base,
      meaning: '',
      type: 'Ichidan',
      jlpt: '',
      romaji: ''
    };
    
    return this.conjugateIchidan(word);
  }

  // ============= I-ADJECTIVE CONJUGATION =============
  private static conjugateIAdjective(word: EnhancedJapaneseWord): ExtendedConjugationForms {
    const kanji = word.kanji || word.kana || '';
    if (!kanji.endsWith('い')) {
      return this.getEmptyConjugations();
    }

    // Special case for いい (good) - uses よ as stem for all conjugations except dictionary form
    const isIi = kanji === 'いい' || kanji === '良い' || kanji === '好い';
    const stem = isIi ? 'よ' : kanji.slice(0, -1);

    return {
      // Basic forms
      present: kanji,
      negative: stem + 'くない',
      past: stem + 'かった',
      pastNegative: stem + 'くなかった',
      
      // Te-forms
      teForm: stem + 'くて',
      negativeTeForm: stem + 'くなくて',
      
      // Polite forms (with です)
      polite: kanji + 'です',
      politeNegative: stem + 'くないです',
      politePast: stem + 'かったです',
      politePastNegative: stem + 'くなかったです',
      
      // Adverbial
      adverbialNegative: stem + 'く',
      
      // Conditional
      provisional: stem + 'ければ',
      provisionalNegative: stem + 'くなければ',
      conditional: stem + 'かったら',
      conditionalNegative: stem + 'くなかったら',
      
      // Alternative
      alternativeForm: stem + 'かったり',
      alternativeNegative: stem + 'くなかったり',
      
      // Presumptive
      presumptive: kanji + 'だろう',
      presumptiveNegative: stem + 'くないだろう',
      presumptivePolite: kanji + 'でしょう',
      presumptivePoliteNegative: stem + 'くないでしょう',
      
      // Fill other forms with empty to avoid undefined
      masuStem: '',
      negativeStem: '',
      naideForm: '',
      volitional: '',
      volitionalNegative: '',
      imperativePlain: '',
      imperativePolite: '',
      imperativeNegative: '',
      provisionalNegativeColloquial: '',
      potential: '',
      potentialNegative: '',
      potentialPast: '',
      potentialPastNegative: '',
      potentialMasuStem: '',
      potentialTeForm: '',
      potentialNegativeTeForm: '',
      potentialPolite: '',
      potentialPoliteNegative: '',
      potentialPolitePast: '',
      potentialPolitePastNegative: '',
      passive: '',
      passiveNegative: '',
      passivePast: '',
      passivePastNegative: '',
      passiveMasuStem: '',
      passiveTeForm: '',
      passiveNegativeTeForm: '',
      passivePolite: '',
      passivePoliteNegative: '',
      passivePolitePast: '',
      passivePolitePastNegative: '',
      causative: '',
      causativeNegative: '',
      causativePast: '',
      causativePastNegative: '',
      causativeMasuStem: '',
      causativeTeForm: '',
      causativeNegativeTeForm: '',
      causativePolite: '',
      causativePoliteNegative: '',
      causativePolitePast: '',
      causativePolitePastNegative: '',
      causativePassive: '',
      causativePassiveNegative: '',
      causativePassivePast: '',
      causativePassivePastNegative: '',
      causativePassiveMasuStem: '',
      causativePassiveTeForm: '',
      causativePassiveNegativeTeForm: '',
      causativePassivePolite: '',
      causativePassivePoliteNegative: '',
      causativePassivePolitePast: '',
      causativePassivePolitePastNegative: '',
      taiForm: '',
      taiFormNegative: '',
      taiFormPast: '',
      taiFormPastNegative: '',
      taiAdjectiveStem: '',
      taiTeForm: '',
      taiNegativeTeForm: '',
      taiAdverbial: '',
      taiProvisional: '',
      taiProvisionalNegative: '',
      taiConditional: '',
      taiConditionalNegative: '',
      taiObjective: '',
      progressive: '',
      progressiveNegative: '',
      progressivePast: '',
      progressivePastNegative: '',
      progressivePolite: '',
      progressivePoliteNegative: '',
      progressivePolitePast: '',
      progressivePolitePastNegative: '',
      request: '',
      requestNegative: '',
      colloquialNegative: '',
      formalNegative: '',
      classicalNegative: '',
      classicalNegativeModifier: '',
      politeVolitional: '',
    };
  }

  // ============= NA-ADJECTIVE CONJUGATION =============
  private static conjugateNaAdjective(word: EnhancedJapaneseWord): ExtendedConjugationForms {
    const kanji = word.kanji || word.kana || '';
    
    return {
      // Basic forms
      present: kanji + 'だ',
      negative: kanji + 'じゃない',
      past: kanji + 'だった',
      pastNegative: kanji + 'じゃなかった',
      
      // Te-forms
      teForm: kanji + 'で',
      negativeTeForm: kanji + 'じゃなくて',
      
      // Polite forms
      polite: kanji + 'です',
      politeNegative: kanji + 'じゃありません',
      politePast: kanji + 'でした',
      politePastNegative: kanji + 'じゃありませんでした',
      
      // Adverbial
      adverbialNegative: kanji + 'に',
      
      // Conditional
      provisional: kanji + 'なら',
      provisionalNegative: kanji + 'じゃなければ',
      conditional: kanji + 'だったら',
      conditionalNegative: kanji + 'じゃなかったら',
      
      // Alternative
      alternativeForm: kanji + 'だったり',
      alternativeNegative: kanji + 'じゃなかったり',
      
      // Presumptive
      presumptive: kanji + 'だろう',
      presumptiveNegative: kanji + 'じゃないだろう',
      presumptivePolite: kanji + 'でしょう',
      presumptivePoliteNegative: kanji + 'じゃないでしょう',
      
      // Fill other forms with empty to avoid undefined
      masuStem: '',
      negativeStem: '',
      naideForm: '',
      volitional: '',
      volitionalNegative: '',
      imperativePlain: '',
      imperativePolite: '',
      imperativeNegative: '',
      provisionalNegativeColloquial: '',
      potential: '',
      potentialNegative: '',
      potentialPast: '',
      potentialPastNegative: '',
      potentialMasuStem: '',
      potentialTeForm: '',
      potentialNegativeTeForm: '',
      potentialPolite: '',
      potentialPoliteNegative: '',
      potentialPolitePast: '',
      potentialPolitePastNegative: '',
      passive: '',
      passiveNegative: '',
      passivePast: '',
      passivePastNegative: '',
      passiveMasuStem: '',
      passiveTeForm: '',
      passiveNegativeTeForm: '',
      passivePolite: '',
      passivePoliteNegative: '',
      passivePolitePast: '',
      passivePolitePastNegative: '',
      causative: '',
      causativeNegative: '',
      causativePast: '',
      causativePastNegative: '',
      causativeMasuStem: '',
      causativeTeForm: '',
      causativeNegativeTeForm: '',
      causativePolite: '',
      causativePoliteNegative: '',
      causativePolitePast: '',
      causativePolitePastNegative: '',
      causativePassive: '',
      causativePassiveNegative: '',
      causativePassivePast: '',
      causativePassivePastNegative: '',
      causativePassiveMasuStem: '',
      causativePassiveTeForm: '',
      causativePassiveNegativeTeForm: '',
      causativePassivePolite: '',
      causativePassivePoliteNegative: '',
      causativePassivePolitePast: '',
      causativePassivePolitePastNegative: '',
      taiForm: '',
      taiFormNegative: '',
      taiFormPast: '',
      taiFormPastNegative: '',
      taiAdjectiveStem: '',
      taiTeForm: '',
      taiNegativeTeForm: '',
      taiAdverbial: '',
      taiProvisional: '',
      taiProvisionalNegative: '',
      taiConditional: '',
      taiConditionalNegative: '',
      taiObjective: '',
      progressive: '',
      progressiveNegative: '',
      progressivePast: '',
      progressivePastNegative: '',
      progressivePolite: '',
      progressivePoliteNegative: '',
      progressivePolitePast: '',
      progressivePolitePastNegative: '',
      request: '',
      requestNegative: '',
      colloquialNegative: '',
      formalNegative: '',
      classicalNegative: '',
      classicalNegativeModifier: '',
      politeVolitional: '',
    };
  }

  // Get Godan conjugation mappings
  private static getGodanMappings(ending: string, word?: EnhancedJapaneseWord) {
    // Special case for 行く
    if (word && (word.kanji === '行く' || word.kana === 'いく')) {
      return {
        past: 'った',
        negative: 'か',
        polite: 'き',
        teForm: 'って',
        potential: 'け',
        passive: 'か',
        causative: 'か',
        conditional: 'け',
        volitional: 'こう',
        imperative: 'け'
      };
    }

    const mappings: { [key: string]: any } = {
      'う': {
        past: 'った',
        negative: 'わ',
        polite: 'い',
        teForm: 'って',
        potential: 'え',
        passive: 'わ',
        causative: 'わ',
        conditional: 'え',
        volitional: 'おう',
        imperative: 'え'
      },
      'く': {
        past: 'いた',
        negative: 'か',
        polite: 'き',
        teForm: 'いて',
        potential: 'け',
        passive: 'か',
        causative: 'か',
        conditional: 'け',
        volitional: 'こう',
        imperative: 'け'
      },
      'ぐ': {
        past: 'いだ',
        negative: 'が',
        polite: 'ぎ',
        teForm: 'いで',
        potential: 'げ',
        passive: 'が',
        causative: 'が',
        conditional: 'げ',
        volitional: 'ごう',
        imperative: 'げ'
      },
      'す': {
        past: 'した',
        negative: 'さ',
        polite: 'し',
        teForm: 'して',
        potential: 'せ',
        passive: 'さ',
        causative: 'さ',
        conditional: 'せ',
        volitional: 'そう',
        imperative: 'せ'
      },
      'つ': {
        past: 'った',
        negative: 'た',
        polite: 'ち',
        teForm: 'って',
        potential: 'て',
        passive: 'た',
        causative: 'た',
        conditional: 'て',
        volitional: 'とう',
        imperative: 'て'
      },
      'ぬ': {
        past: 'んだ',
        negative: 'な',
        polite: 'に',
        teForm: 'んで',
        potential: 'ね',
        passive: 'な',
        causative: 'な',
        conditional: 'ね',
        volitional: 'のう',
        imperative: 'ね'
      },
      'ぶ': {
        past: 'んだ',
        negative: 'ば',
        polite: 'び',
        teForm: 'んで',
        potential: 'べ',
        passive: 'ば',
        causative: 'ば',
        conditional: 'べ',
        volitional: 'ぼう',
        imperative: 'べ'
      },
      'む': {
        past: 'んだ',
        negative: 'ま',
        polite: 'み',
        teForm: 'んで',
        potential: 'め',
        passive: 'ま',
        causative: 'ま',
        conditional: 'め',
        volitional: 'もう',
        imperative: 'め'
      },
      'る': {
        past: 'った',
        negative: 'ら',
        polite: 'り',
        teForm: 'って',
        potential: 'れ',
        passive: 'ら',
        causative: 'ら',
        conditional: 'れ',
        volitional: 'ろう',
        imperative: 'れ'
      }
    };

    return mappings[ending] || null;
  }


  // Return empty conjugations
  private static getEmptyConjugations(): ExtendedConjugationForms {
    const empty = '';
    return {
      present: empty,
      masuStem: empty,
      negativeStem: empty,
      past: empty,
      negative: empty,
      pastNegative: empty,
      polite: empty,
      politePast: empty,
      politeNegative: empty,
      politePastNegative: empty,
      politeVolitional: empty,
      teForm: empty,
      negativeTeForm: empty,
      naiDeForm: empty,
      adverbialNegative: empty,
      volitional: empty,
      volitionalNegative: empty,
      imperativePlain: empty,
      imperativePolite: empty,
      imperativeNegative: empty,
      provisional: empty,
      provisionalNegative: empty,
      provisionalNegativeColloquial: empty,
      conditional: empty,
      conditionalNegative: empty,
      alternativeForm: empty,
      alternativeNegative: empty,
      potential: empty,
      potentialNegative: empty,
      potentialPast: empty,
      potentialPastNegative: empty,
      potentialMasuStem: empty,
      potentialTeForm: empty,
      potentialNegativeTeForm: empty,
      potentialPolite: empty,
      potentialPoliteNegative: empty,
      potentialPolitePast: empty,
      potentialPolitePastNegative: empty,
      passive: empty,
      passiveNegative: empty,
      passivePast: empty,
      passivePastNegative: empty,
      passiveMasuStem: empty,
      passiveTeForm: empty,
      passiveNegativeTeForm: empty,
      passivePolite: empty,
      passivePoliteNegative: empty,
      passivePolitePast: empty,
      passivePolitePastNegative: empty,
      causative: empty,
      causativeNegative: empty,
      causativePast: empty,
      causativePastNegative: empty,
      causativeMasuStem: empty,
      causativeTeForm: empty,
      causativeNegativeTeForm: empty,
      causativePolite: empty,
      causativePoliteNegative: empty,
      causativePolitePast: empty,
      causativePolitePastNegative: empty,
      causativePassive: empty,
      causativePassiveNegative: empty,
      causativePassivePast: empty,
      causativePassivePastNegative: empty,
      causativePassiveMasuStem: empty,
      causativePassiveTeForm: empty,
      causativePassiveNegativeTeForm: empty,
      causativePassivePolite: empty,
      causativePassivePoliteNegative: empty,
      causativePassivePolitePast: empty,
      causativePassivePolitePastNegative: empty,
      taiForm: empty,
      taiFormNegative: empty,
      taiFormPast: empty,
      taiFormPastNegative: empty,
      taiAdjectiveStem: empty,
      taiTeForm: empty,
      taiNegativeTeForm: empty,
      taiAdverbial: empty,
      taiProvisional: empty,
      taiProvisionalNegative: empty,
      taiConditional: empty,
      taiConditionalNegative: empty,
      taiObjective: empty,
      progressive: empty,
      progressiveNegative: empty,
      progressivePast: empty,
      progressivePastNegative: empty,
      progressivePolite: empty,
      progressivePoliteNegative: empty,
      progressivePolitePast: empty,
      progressivePolitePastNegative: empty,
      request: empty,
      requestNegative: empty,
      colloquialNegative: empty,
      formalNegative: empty,
      classicalNegative: empty,
      classicalNegativeModifier: empty,
      presumptive: empty,
      presumptiveNegative: empty,
      presumptivePolite: empty,
      presumptivePoliteNegative: empty,
    };
  }

  // Get all possible conjugation forms as an array (for drill distractors)
  static getAllPossibleForms(conjugations: ExtendedConjugationForms): string[] {
    const forms: string[] = [];
    
    // Iterate through all properties of the conjugations object
    Object.values(conjugations).forEach(value => {
      if (value && typeof value === 'string' && value.trim() !== '') {
        forms.push(value);
      }
    });
    
    // Remove duplicates
    return [...new Set(forms)];
  }

  // Get conjugation rule explanation
  static getConjugationRule(wordType: WordType, form: keyof ExtendedConjugationForms): string {
    const rules: { [key in WordType]: { [key: string]: string } } = {
      'Ichidan': {
        present: 'Dictionary form - no change',
        past: 'Remove る, add た',
        negative: 'Remove る, add ない',
        pastNegative: 'Remove る, add なかった',
        polite: 'Remove る, add ます',
        politePast: 'Remove る, add ました',
        teForm: 'Remove る, add て',
        potential: 'Remove る, add られる',
        conditional: 'Remove る, add たら',
        provisional: 'Remove る, add れば'
      },
      'Godan': {
        present: 'Dictionary form - no change',
        past: 'Change ending to う-column, add た/だ',
        negative: 'Change ending to あ-column, add ない',
        polite: 'Change ending to い-column, add ます',
        teForm: 'Change ending according to て-form rules',
        potential: 'Change ending to え-column, add る',
        conditional: 'Change ending to conditional form',
        provisional: 'Change ending to え-column, add ば'
      },
      'Irregular': {
        present: 'Irregular - memorize the form',
        past: 'Irregular - memorize the form',
        negative: 'Irregular - memorize the form',
        polite: 'Irregular - memorize the form',
        teForm: 'Irregular - memorize the form'
      },
      'i-adjective': {
        present: 'Dictionary form - no change',
        past: 'Remove い, add かった',
        negative: 'Remove い, add くない',
        pastNegative: 'Remove い, add くなかった',
        polite: 'Add です to dictionary form',
        conditional: 'Remove い, add かったら',
        provisional: 'Remove い, add ければ'
      },
      'na-adjective': {
        present: 'Add だ to stem',
        past: 'Add だった to stem',
        negative: 'Add じゃない to stem',
        pastNegative: 'Add じゃなかった to stem',
        polite: 'Add です to stem',
        conditional: 'Add だったら to stem',
        provisional: 'Add なら to stem'
      },
      'noun': {
        present: 'Nouns do not conjugate'
      },
      'adverb': {
        present: 'Adverbs do not conjugate'
      },
      'particle': {
        present: 'Particles do not conjugate'
      },
      'other': {
        present: 'This word type does not conjugate'
      }
    };

    return rules[wordType]?.[form] || 'No rule available for this combination';
  }
}

// Helper function to get random conjugation form for drill
export function getRandomConjugationForm(wordType: WordType): keyof ExtendedConjugationForms {
  // Define all available forms by frequency/importance
  const veryCommonForms: (keyof ExtendedConjugationForms)[] = [
    'present', 'past', 'negative', 'pastNegative',
    'polite', 'politePast', 'politeNegative', 'politePastNegative',
    'teForm'
  ];

  const commonForms: (keyof ExtendedConjugationForms)[] = [
    'progressive', 'progressivePolite', 'progressiveNegative', 'progressivePoliteNegative',
    'conditional', 'provisional', 'conditionalNegative', 'provisionalNegative',
    'volitional', 'politeVolitional'
  ];

  const intermediateForms: (keyof ExtendedConjugationForms)[] = [
    'potential', 'potentialNegative', 'potentialPast', 'potentialPastNegative',
    'potentialPolite', 'potentialPoliteNegative', 'potentialPolitePast', 'potentialPolitePastNegative',
    'taiForm', 'taiFormNegative', 'taiFormPast', 'taiFormPastNegative',
    'imperativePlain', 'imperativePolite', 'request', 'requestNegative'
  ];

  const advancedForms: (keyof ExtendedConjugationForms)[] = [
    'passive', 'passiveNegative', 'passivePast', 'passivePastNegative',
    'passivePolite', 'passivePoliteNegative', 'passivePolitePast', 'passivePolitePastNegative',
    'causative', 'causativeNegative', 'causativePast', 'causativePastNegative',
    'causativePolite', 'causativePoliteNegative', 'causativePolitePast', 'causativePolitePastNegative',
    'causativePassive', 'causativePassiveNegative', 'causativePassivePast', 'causativePassivePastNegative',
    'causativePassivePolite', 'causativePassivePoliteNegative', 'causativePassivePolitePast', 'causativePassivePolitePastNegative'
  ];

  // Extra advanced forms unique to Extended engine
  const expertForms: (keyof ExtendedConjugationForms)[] = [
    'alternativeForm', 'alternativeNegative',
    'provisionalNegativeColloquial',
    'volitionalNegative',
    'imperativeNegative',
    'adverbialNegative',
    'colloquialNegative', 'formalNegative', 'classicalNegative',
    'presumptive', 'presumptiveNegative', 'presumptivePolite', 'presumptivePoliteNegative'
  ];

  // Filter forms based on word type
  if (wordType === 'i-adjective' || wordType === 'na-adjective') {
    // For adjectives, only use forms that actually work with adjectives
    const adjectiveForms: (keyof ExtendedConjugationForms)[] = [
      // Basic forms that adjectives have
      'present', 'past', 'negative', 'pastNegative',
      'polite', 'politePast', 'politeNegative', 'politePastNegative',
      'teForm', 'negativeTeForm', // Adjectives DO have te-forms!
      // Conditional forms
      'conditional', 'provisional', 'conditionalNegative', 'provisionalNegative',
      // Presumptive forms
      'presumptive', 'presumptiveNegative', 'presumptivePolite', 'presumptivePoliteNegative'
    ];
    
    // Weighted selection: prefer common forms
    const weights = [
      ...Array(4).fill(0, 0, 4),   // indices 0-3 (present, past, negative, pastNegative) - 4x weight
      ...Array(4).fill(1, 0, 4),   // indices 4-7 (polite forms) - 4x weight
      ...Array(2).fill(2, 0, 2),   // indices 8-9 (te-forms) - 2x weight
      ...Array(1).fill(3, 0, 4),   // indices 10-13 (conditional) - 1x weight each
      ...Array(1).fill(4, 0, 4)    // indices 14-17 (presumptive) - 1x weight each
    ];
    
    const weightedIndex = weights[Math.floor(Math.random() * weights.length)];
    const formGroups = [
      adjectiveForms.slice(0, 4),   // Basic
      adjectiveForms.slice(4, 8),   // Polite
      adjectiveForms.slice(8, 10),  // Te-forms
      adjectiveForms.slice(10, 14), // Conditional
      adjectiveForms.slice(14, 18)  // Presumptive
    ];
    
    const selectedGroup = formGroups[weightedIndex] || formGroups[0];
    return selectedGroup[Math.floor(Math.random() * selectedGroup.length)];
  }

  // For verbs (Ichidan, Godan, Irregular), use weighted selection
  const allForms: (keyof ExtendedConjugationForms)[] = [];

  // Weight distribution: 35% very common, 25% common, 20% intermediate, 15% advanced, 5% expert
  const random = Math.random();

  if (random < 0.35) {
    // 35% chance for very common forms
    allForms.push(...veryCommonForms);
  } else if (random < 0.6) {
    // 25% chance for common forms
    allForms.push(...commonForms);
  } else if (random < 0.8) {
    // 20% chance for intermediate forms
    allForms.push(...intermediateForms);
  } else if (random < 0.95) {
    // 15% chance for advanced forms
    allForms.push(...advancedForms);
  } else {
    // 5% chance for expert forms
    allForms.push(...expertForms);
  }

  return allForms[Math.floor(Math.random() * allForms.length)];
}

// Generate drill question stem
export function generateQuestionStem(word: JapaneseWord, targetForm: keyof ExtendedConjugationForms): string {
  // Create a partial conjugation to show the stem
  switch (word.type) {
    case 'Ichidan': {
      const kana = word.kana || word.kanji || '';
      if (!kana) return '？';
      return kana.slice(0, -1) + '？';
    }
    case 'Godan': {
      // For Godan verbs, show the full word since conjugation changes the ending vowel
      const kana = word.kana || word.kanji || '';
      if (!kana) return '？';
      return kana + '？';
    }
    case 'i-adjective': {
      const kana = word.kana || word.kanji || '';
      if (!kana) return '？';
      return kana.slice(0, -1) + '？';
    }
    case 'na-adjective': {
      const kana = word.kana || word.kanji || '';
      if (!kana) return '？';
      return kana + '？';
    }
    case 'Irregular': {
      const kana = word.kana || word.kanji || '';
      if (!kana) return '？';
      // For irregular verbs, show partial stem
      if (kana === 'する' || kana.endsWith('する')) {
        return kana.slice(0, -2) + '？';
      }
      return kana + '？';
    }
    default: {
      const kana = word.kana || word.kanji || '';
      if (!kana) return '？';
      return kana + '？';
    }
  }
}