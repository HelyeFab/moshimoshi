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
   */
  static generateQuestions(
    words: JapaneseWord[],
    questionsPerWord: number = 3,
    totalQuestions?: number,
    formFilter?: string[] // NEW: Filter specific forms
  ): DrillQuestion[] {
    if (!words || words.length === 0) {
      return [];
    }

    const questions: DrillQuestion[] = [];
    const targetCount = totalQuestions || words.length * questionsPerWord;

    for (let i = 0; i < targetCount; i++) {
      const word = words[i % words.length];

      // Detect word type and conjugate
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

      const conjugations = ExtendedConjugationEngine.conjugate(enhancedWord);

      // Get compatible forms for this word type
      const compatibleForms = this.getCompatibleForms(wordType.conjugationType);

      // Apply user's form filter if provided
      const allowedForms = formFilter && formFilter.length > 0
        ? compatibleForms.filter(f => formFilter.includes(f))
        : compatibleForms;

      if (allowedForms.length === 0) {
        console.warn(`[QuestionGenerator] No allowed forms for ${word.kanji || word.kana}`);
        continue;
      }

      // Pick a random form from allowed forms
      const targetForm = allowedForms[Math.floor(Math.random() * allowedForms.length)];
      const correctAnswer = conjugations[targetForm];

      if (!correctAnswer || correctAnswer.trim() === '' || correctAnswer === 'N/A') {
        continue;
      }

      const question = this.generateSingleQuestion(word, targetForm, correctAnswer, conjugations, wordType.conjugationType);
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
      present: 'Present',
      past: 'Past',
      negative: 'Negative',
      pastNegative: 'Past Negative',
      polite: 'Polite',
      politePast: 'Polite Past',
      politeNegative: 'Polite Negative',
      politePastNegative: 'Polite Past Negative',
      teForm: 'Te-form',
      potential: 'Potential',
      passive: 'Passive',
      causative: 'Causative',
      taiForm: 'Tai-form (want to)',
      volitional: 'Volitional',
      conditional: 'Conditional',
      provisional: 'Provisional',
      // Add more as needed
    };
    return labels[form] || form.replace(/([A-Z])/g, ' $1').trim();
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
