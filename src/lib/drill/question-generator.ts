/**
 * Drill Question Generator
 * Generates quiz questions for conjugation practice using ExtendedConjugationEngine
 */

import type { JapaneseWord, DrillQuestion } from '@/types/drill';
import type { ExtendedConjugationForms } from '@/types/conjugation';
import { ExtendedConjugationEngine } from '@/lib/conjugation/engine';
import { detectWordType } from '@/lib/conjugation/wordTypeDetector';
import type { EnhancedJapaneseWord } from '@/utils/enhancedWordTypeDetection';

// Form groups for easy selection
export const CONJUGATION_FORM_GROUPS = {
  basic: ['present', 'past', 'negative', 'pastNegative'] as (keyof ExtendedConjugationForms)[],
  polite: ['polite', 'politePast', 'politeNegative', 'politePastNegative', 'politeVolitional'] as (keyof ExtendedConjugationForms)[],
  teForm: ['teForm', 'negativeTeForm', 'naiDeForm'] as (keyof ExtendedConjugationForms)[],
  conditional: ['provisional', 'provisionalNegative', 'conditional', 'conditionalNegative'] as (keyof ExtendedConjugationForms)[],
  potential: ['potential', 'potentialNegative', 'potentialPast', 'potentialPastNegative'] as (keyof ExtendedConjugationForms)[],
  passive: ['passive', 'passiveNegative', 'passivePast', 'passivePastNegative'] as (keyof ExtendedConjugationForms)[],
  causative: ['causative', 'causativeNegative', 'causativePast', 'causativePastNegative'] as (keyof ExtendedConjugationForms)[],
  taiForm: ['taiForm', 'taiFormNegative', 'taiFormPast', 'taiFormPastNegative'] as (keyof ExtendedConjugationForms)[],
} as const;

// Forms compatible with each word type
const VERB_COMPATIBLE_FORMS: (keyof ExtendedConjugationForms)[] = [
  'present', 'past', 'negative', 'pastNegative',
  'polite', 'politePast', 'politeNegative', 'politePastNegative', 'politeVolitional',
  'teForm', 'negativeTeForm', 'naiDeForm', 'adverbialNegative',
  'volitional', 'volitionalNegative',
  'imperativePlain', 'imperativePolite',
  'provisional', 'provisionalNegative', 'provisionalNegativeColloquial',
  'conditional', 'conditionalNegative',
  'alternativeForm',
  'potential', 'potentialNegative', 'potentialPast', 'potentialPastNegative',
  'potentialMasuStem', 'potentialTeForm', 'potentialNegativeTeForm',
  'potentialPolite', 'potentialPoliteNegative', 'potentialPolitePast', 'potentialPolitePastNegative',
  'passive', 'passiveNegative', 'passivePast', 'passivePastNegative',
  'passiveMasuStem', 'passiveTeForm', 'passiveNegativeTeForm',
  'passivePolite', 'passivePoliteNegative', 'passivePolitePast', 'passivePolitePastNegative',
  'causative', 'causativeNegative', 'causativePast', 'causativePastNegative',
  'causativeMasuStem', 'causativeTeForm', 'causativeNegativeTeForm',
  'causativePolite', 'causativePoliteNegative', 'causativePolitePast', 'causativePolitePastNegative',
  'causativePassive', 'causativePassiveNegative', 'causativePassivePast', 'causativePassivePastNegative',
  'causativePassiveMasuStem', 'causativePassiveTeForm', 'causativePassiveNegativeTeForm',
  'causativePassivePolite', 'causativePassivePoliteNegative', 'causativePassivePolitePast', 'causativePassivePolitePastNegative',
  'taiForm', 'taiFormNegative', 'taiFormPast', 'taiFormPastNegative',
  'taiAdjectiveStem', 'taiTeForm', 'taiNegativeTeForm', 'taiAdverbial',
  'taiProvisional', 'taiProvisionalNegative', 'taiConditional', 'taiConditionalNegative',
  'taiObjective',
  'progressive', 'progressiveNegative', 'progressivePast', 'progressivePastNegative',
  'progressivePolite', 'progressivePoliteNegative', 'progressivePolitePast', 'progressivePolitePastNegative',
  'request', 'requestNegative',
  'colloquialNegative',
  'formalNegative', 'classicalNegative', 'classicalNegativeModifier',
  'masuStem', 'negativeStem'
];

const I_ADJECTIVE_COMPATIBLE_FORMS: (keyof ExtendedConjugationForms)[] = [
  'present', 'past', 'negative', 'pastNegative',
  'teForm', 'negativeTeForm',
  'provisional', 'provisionalNegative',
  'conditional', 'conditionalNegative',
  'adverbial',
  'polite', 'politePast', 'politeNegative', 'politePastNegative'
];

const NA_ADJECTIVE_COMPATIBLE_FORMS: (keyof ExtendedConjugationForms)[] = [
  'present', 'past', 'negative', 'pastNegative',
  'polite', 'politePast', 'politeNegative', 'politePastNegative'
];

export class QuestionGenerator {
  /**
   * Generate multiple drill questions from a list of words
   * NOW WITH REDIS CACHING: Blazing fast on repeat sessions!
   */
  static async generateQuestions(
    words: JapaneseWord[],
    questionsPerWord: number = 3,
    totalQuestions?: number,
    formFilter?: string[] // NEW: Filter specific forms
  ): Promise<DrillQuestion[]> {
    if (!words || words.length === 0) {
      return [];
    }

    const questions: DrillQuestion[] = [];
    const targetCount = totalQuestions || words.length * questionsPerWord;

    // Process questions with parallelized async conjugations
    const questionPromises: Promise<DrillQuestion | null>[] = [];

    for (let i = 0; i < targetCount; i++) {
      const word = words[i % words.length];

      // Detect word type
      const wordType = detectWordType(word.kanji || word.kana, word.kana, word.partsOfSpeech);

      if (!wordType.isConjugatable || !wordType.conjugationType) {
        console.warn(`[QuestionGenerator] Skipping non-conjugatable word: ${word.kanji || word.kana}`);
        continue;
      }

      const enhancedWord: EnhancedJapaneseWord = {
        ...word,
        conjugationType: wordType.conjugationType,
        partsOfSpeech: word.partsOfSpeech || []
      };

      // Create promise for async conjugation
      const questionPromise = (async () => {
        try {
          // Async call to cached conjugation engine
          const conjugations = await ExtendedConjugationEngine.conjugate(enhancedWord);

          // Get compatible forms for this word type
          const compatibleForms = this.getCompatibleForms(wordType.conjugationType);

          // Apply user's form filter if provided
          const allowedForms = formFilter && formFilter.length > 0
            ? compatibleForms.filter(f => formFilter.includes(f))
            : compatibleForms;

          if (allowedForms.length === 0) {
            console.warn(`[QuestionGenerator] No allowed forms for ${word.kanji || word.kana}`);
            return null;
          }

          // Pick a random form from allowed forms
          const targetForm = allowedForms[Math.floor(Math.random() * allowedForms.length)];
          const correctAnswer = conjugations[targetForm];

          if (!correctAnswer || correctAnswer.trim() === '' || correctAnswer === 'N/A') {
            return null;
          }

          return this.generateSingleQuestion(word, targetForm, correctAnswer, conjugations, wordType.conjugationType);
        } catch (error) {
          console.error(`[QuestionGenerator] Error generating question for ${word.kanji || word.kana}:`, error);
          return null;
        }
      })();

      questionPromises.push(questionPromise);
    }

    // Wait for all conjugations to complete (parallel cache lookups!)
    const generatedQuestions = await Promise.all(questionPromises);

    // Filter out null results and collect questions
    for (const question of generatedQuestions) {
      if (question) {
        questions.push(question);
      }
    }

    return this.shuffleArray(questions);
  }

  /**
   * Get compatible forms for a word type
   */
  private static getCompatibleForms(wordType: string): (keyof ExtendedConjugationForms)[] {
    if (wordType === 'Ichidan' || wordType === 'Godan' || wordType === 'Irregular') {
      return VERB_COMPATIBLE_FORMS;
    }
    if (wordType === 'i-adjective') {
      return I_ADJECTIVE_COMPATIBLE_FORMS;
    }
    if (wordType === 'na-adjective') {
      return NA_ADJECTIVE_COMPATIBLE_FORMS;
    }
    return [];
  }

  /**
   * Generate a single drill question
   */
  static generateSingleQuestion(
    word: JapaneseWord,
    targetForm: keyof ExtendedConjugationForms,
    correctAnswer: string,
    conjugations: ExtendedConjugationForms,
    wordType: string
  ): DrillQuestion | null {
    if (!correctAnswer || correctAnswer.trim() === '' || correctAnswer === 'N/A') {
      return null;
    }

    const distractors = this.generateDistractors(word, targetForm, correctAnswer, conjugations, wordType);

    if (distractors.length < 3) {
      return null;
    }

    const options = this.shuffleArray([correctAnswer, ...distractors.slice(0, 3)]);
    const stem = this.generateQuestionStem(word, targetForm);

    return {
      id: `${word.id}-${targetForm}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      word,
      targetForm,
      stem,
      correctAnswer,
      options,
      rule: this.getFormLabel(targetForm)
    };
  }

  /**
   * Generate question stem
   */
  private static generateQuestionStem(word: JapaneseWord, targetForm: keyof ExtendedConjugationForms): string {
    const wordDisplay = word.kanji || word.kana;
    const formLabel = this.getFormLabel(targetForm);
    return `Conjugate "${wordDisplay}" to ${formLabel}`;
  }

  /**
   * Get human-readable form label
   */
  private static getFormLabel(form: keyof ExtendedConjugationForms): string {
    const labels: Record<string, string> = {
      // Basic Forms
      present: 'Present',
      past: 'Past',
      negative: 'Negative',
      pastNegative: 'Past Negative',

      // Stems
      masuStem: 'Masu Stem',
      negativeStem: 'Negative Stem',

      // Polite Forms
      polite: 'Polite',
      politePast: 'Polite Past',
      politeNegative: 'Polite Negative',
      politePastNegative: 'Polite Past Negative',
      politeVolitional: 'Polite Volitional',

      // Te Forms
      teForm: 'Te-form',
      negativeTeForm: 'Negative Te-form',
      naiDeForm: 'Naide Form',
      adverbialNegative: 'Adverbial Negative',

      // Volitional
      volitional: 'Volitional',
      volitionalNegative: 'Volitional Negative',

      // Imperative
      imperativePlain: 'Imperative',
      imperativePolite: 'Polite Imperative',
      imperativeNegative: 'Negative Imperative',

      // Conditional Forms
      provisional: 'Provisional (ba-form)',
      provisionalNegative: 'Provisional Negative',
      provisionalNegativeColloquial: 'Provisional Negative (Colloquial)',
      conditional: 'Conditional (tara-form)',
      conditionalNegative: 'Conditional Negative',
      alternativeForm: 'Alternative Form (tari)',
      alternativeNegative: 'Alternative Negative',

      // Potential Forms
      potential: 'Potential',
      potentialNegative: 'Potential Negative',
      potentialPast: 'Potential Past',
      potentialPastNegative: 'Potential Past Negative',
      potentialMasuStem: 'Potential Masu Stem',
      potentialTeForm: 'Potential Te-form',
      potentialNegativeTeForm: 'Potential Negative Te-form',
      potentialPolite: 'Potential Polite',
      potentialPoliteNegative: 'Potential Polite Negative',
      potentialPolitePast: 'Potential Polite Past',
      potentialPolitePastNegative: 'Potential Polite Past Negative',

      // Passive Forms
      passive: 'Passive',
      passiveNegative: 'Passive Negative',
      passivePast: 'Passive Past',
      passivePastNegative: 'Passive Past Negative',
      passiveMasuStem: 'Passive Masu Stem',
      passiveTeForm: 'Passive Te-form',
      passiveNegativeTeForm: 'Passive Negative Te-form',
      passivePolite: 'Passive Polite',
      passivePoliteNegative: 'Passive Polite Negative',
      passivePolitePast: 'Passive Polite Past',
      passivePolitePastNegative: 'Passive Polite Past Negative',

      // Causative Forms
      causative: 'Causative',
      causativeNegative: 'Causative Negative',
      causativePast: 'Causative Past',
      causativePastNegative: 'Causative Past Negative',
      causativeMasuStem: 'Causative Masu Stem',
      causativeTeForm: 'Causative Te-form',
      causativeNegativeTeForm: 'Causative Negative Te-form',
      causativePolite: 'Causative Polite',
      causativePoliteNegative: 'Causative Polite Negative',
      causativePolitePast: 'Causative Polite Past',
      causativePolitePastNegative: 'Causative Polite Past Negative',

      // Causative-Passive Forms
      causativePassive: 'Causative-Passive',
      causativePassiveNegative: 'Causative-Passive Negative',
      causativePassivePast: 'Causative-Passive Past',
      causativePassivePastNegative: 'Causative-Passive Past Negative',
      causativePassiveMasuStem: 'Causative-Passive Masu Stem',
      causativePassiveTeForm: 'Causative-Passive Te-form',
      causativePassiveNegativeTeForm: 'Causative-Passive Negative Te-form',
      causativePassivePolite: 'Causative-Passive Polite',
      causativePassivePoliteNegative: 'Causative-Passive Polite Negative',
      causativePassivePolitePast: 'Causative-Passive Polite Past',
      causativePassivePolitePastNegative: 'Causative-Passive Polite Past Negative',

      // Tai Forms (Desiderative)
      taiForm: 'Tai-form (Want to)',
      taiFormNegative: 'Tai-form Negative',
      taiFormPast: 'Tai-form Past',
      taiFormPastNegative: 'Tai-form Past Negative',
      taiAdjectiveStem: 'Tai Adjective Stem',
      taiTeForm: 'Tai Te-form',
      taiNegativeTeForm: 'Tai Negative Te-form',
      taiAdverbial: 'Tai Adverbial',
      taiProvisional: 'Tai Provisional',
      taiProvisionalNegative: 'Tai Provisional Negative',
      taiConditional: 'Tai Conditional',
      taiConditionalNegative: 'Tai Conditional Negative',
      taiObjective: 'Tai Objective',

      // Progressive Forms
      progressive: 'Progressive',
      progressiveNegative: 'Progressive Negative',
      progressivePast: 'Progressive Past',
      progressivePastNegative: 'Progressive Past Negative',
      progressivePolite: 'Progressive Polite',
      progressivePoliteNegative: 'Progressive Polite Negative',
      progressivePolitePast: 'Progressive Polite Past',
      progressivePolitePastNegative: 'Progressive Polite Past Negative',

      // Request Forms
      request: 'Request',
      requestNegative: 'Request Negative',
      requestPolite: 'Polite Request',

      // Colloquial Forms
      colloquialNegative: 'Colloquial Negative',
      colloquialPast: 'Colloquial Past',

      // Classical/Formal Forms
      formalNegative: 'Formal Negative',
      classicalNegative: 'Classical Negative',
      classicalNegativeModifier: 'Classical Negative Modifier',

      // Presumptive Forms
      presumptive: 'Presumptive',
      presumptiveNegative: 'Presumptive Negative',
      presumptivePolite: 'Presumptive Polite',
      presumptivePoliteNegative: 'Presumptive Polite Negative',

      // Adverbial (for adjectives)
      adverbial: 'Adverbial'
    };

    // Return the label if it exists, otherwise create a readable version from the camelCase
    return labels[form] || form
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  /**
   * Generate distractor options (wrong answers)
   */
  static generateDistractors(
    word: JapaneseWord,
    targetForm: keyof ExtendedConjugationForms,
    correctAnswer: string,
    conjugations: ExtendedConjugationForms,
    wordType: string
  ): string[] {
    const distractors: string[] = [];
    const compatibleForms = this.getCompatibleForms(wordType);

    // Get all valid forms except the correct answer
    const validForms = compatibleForms
      .map(form => conjugations[form])
      .filter(form => form && form !== correctAnswer && form !== '' && form !== 'N/A' && form.trim() !== '');

    // Remove duplicates
    const uniqueForms = Array.from(new Set(validForms));

    // Shuffle and take first 3
    const shuffled = this.shuffleArray(uniqueForms);
    distractors.push(...shuffled.slice(0, 3));

    // If we don't have enough, generate artificial ones
    if (distractors.length < 3) {
      const artificial = this.generateArtificialDistractors(
        word,
        correctAnswer,
        distractors,
        validForms
      );
      distractors.push(...artificial);
    }

    return distractors.slice(0, 3);
  }

  /**
   * Generate artificial distractors when not enough real forms
   */
  private static generateArtificialDistractors(
    word: JapaneseWord,
    correctAnswer: string,
    existingDistractors: string[],
    validForms: string[]
  ): string[] {
    const artificial: string[] = [];
    const base = (word.kanji || word.kana).slice(0, -1);
    const endings = ['る', 'た', 'ない', 'ます', 'て', 'れば', 'よう', 'せる', 'れる', 'られる'];

    for (const ending of endings) {
      if (artificial.length >= 3 - existingDistractors.length) break;

      const candidate = base + ending;
      if (
        !existingDistractors.includes(candidate) &&
        candidate !== correctAnswer &&
        !validForms.includes(candidate) &&
        candidate !== (word.kanji || word.kana)
      ) {
        artificial.push(candidate);
      }
    }

    return artificial;
  }

  /**
   * Shuffle an array
   */
  private static shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Generate questions for specific word
   */
  static generateQuestionsForWord(
    word: JapaneseWord,
    count: number = 5,
    formFilter?: string[]
  ): DrillQuestion[] {
    const questions: DrillQuestion[] = [];

    // Detect word type
    const wordType = detectWordType(word.kanji || word.kana, word.kana, word.partsOfSpeech);

    if (!wordType.isConjugatable || !wordType.conjugationType) {
      return [];
    }

    const enhancedWord: EnhancedJapaneseWord = {
      ...word,
      conjugationType: wordType.conjugationType,
      partsOfSpeech: word.partsOfSpeech || []
    };

    const conjugations = ExtendedConjugationEngine.conjugate(enhancedWord);
    const compatibleForms = this.getCompatibleForms(wordType.conjugationType);

    // Apply filter
    const allowedForms = formFilter && formFilter.length > 0
      ? compatibleForms.filter(f => formFilter.includes(f))
      : compatibleForms;

    const availableForms = allowedForms.filter(
      key => conjugations[key] && conjugations[key] !== '' && conjugations[key] !== 'N/A'
    );

    const selectedForms = this.shuffleArray(availableForms).slice(0, count);

    for (const targetForm of selectedForms) {
      const correctAnswer = conjugations[targetForm];
      if (!correctAnswer) continue;

      const question = this.generateSingleQuestion(word, targetForm, correctAnswer, conjugations, wordType.conjugationType);
      if (question) {
        questions.push(question);
      }
    }

    return questions;
  }
}
