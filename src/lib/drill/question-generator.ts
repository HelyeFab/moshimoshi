/**
 * Drill Question Generator
 * Generates quiz questions for conjugation practice
 */

import { JapaneseWord, DrillQuestion, ConjugationForms } from '@/types/drill';
import { ConjugationEngine } from './conjugation-engine';

export class QuestionGenerator {
  /**
   * Generate multiple drill questions from a list of words
   */
  static generateQuestions(
    words: JapaneseWord[],
    questionsPerWord: number = 3,
    totalQuestions?: number
  ): DrillQuestion[] {
    // Handle null/undefined/empty words
    if (!words || words.length === 0) {
      return [];
    }

    const questions: DrillQuestion[] = [];
    const targetCount = totalQuestions || words.length * questionsPerWord;

    for (let i = 0; i < targetCount; i++) {
      const word = words[i % words.length];
      const conjugations = ConjugationEngine.conjugate(word);
      const targetForm = ConjugationEngine.getRandomConjugationForm(word.type);
      const correctAnswer = conjugations[targetForm];

      if (!correctAnswer || correctAnswer.trim() === '') {
        continue;
      }

      const question = this.generateSingleQuestion(word, targetForm, correctAnswer, conjugations);
      if (question) {
        questions.push(question);
      }
    }

    return this.shuffleArray(questions);
  }

  /**
   * Generate a single drill question
   */
  static generateSingleQuestion(
    word: JapaneseWord,
    targetForm: keyof ConjugationForms,
    correctAnswer: string,
    conjugations: ConjugationForms
  ): DrillQuestion | null {
    // Return null if no correct answer provided
    if (!correctAnswer || correctAnswer.trim() === '') {
      return null;
    }

    const distractors = this.generateDistractors(word, targetForm, correctAnswer, conjugations);

    if (distractors.length < 3) {
      return null;
    }

    const options = this.shuffleArray([correctAnswer, ...distractors.slice(0, 3)]);
    const stem = ConjugationEngine.generateQuestionStem(word, targetForm);
    const rule = ConjugationEngine.getConjugationRule(word.type, targetForm);

    return {
      id: `${word.id}-${targetForm}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      word,
      targetForm,
      stem,
      correctAnswer,
      options,
      rule,
    };
  }

  /**
   * Generate distractor options (wrong answers)
   */
  static generateDistractors(
    word: JapaneseWord,
    targetForm: keyof ConjugationForms,
    correctAnswer: string,
    conjugations: ConjugationForms
  ): string[] {
    const distractors: string[] = [];
    const allForms = ConjugationEngine.getAllPossibleForms(conjugations);

    // Filter out correct answer and empty forms
    const validForms = allForms.filter(form =>
      form && form !== correctAnswer && form !== '' && form !== 'N/A'
    );

    // Smart distractor selection
    const usedPatterns = new Set<string>();
    const candidates = this.shuffleArray([...validForms]);

    for (const candidate of candidates) {
      if (distractors.length >= 4) break;

      // Create a simple pattern to avoid too similar forms
      const pattern = this.getFormPattern(candidate);

      if (!usedPatterns.has(pattern)) {
        distractors.push(candidate);
        usedPatterns.add(pattern);
      }
    }

    // If we don't have enough, generate artificial distractors
    if (distractors.length < 4) {
      const artificialDistractors = this.generateArtificialDistractors(
        word,
        correctAnswer,
        distractors,
        validForms
      );
      distractors.push(...artificialDistractors);
    }

    return distractors.slice(0, 4);
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
    const kanjiStem = word.kanji.slice(0, -1);
    const endings = ['る', 'た', 'ない', 'ます', 'て', 'れば', 'よう', 'せる', 'れる'];

    for (const ending of endings) {
      if (artificial.length >= 4 - existingDistractors.length) break;

      const candidate = kanjiStem + ending;
      if (
        !existingDistractors.includes(candidate) &&
        candidate !== correctAnswer &&
        !validForms.includes(candidate) &&
        candidate !== word.kanji
      ) {
        artificial.push(candidate);
      }
    }

    return artificial;
  }

  /**
   * Get pattern from form to avoid similar distractors
   */
  private static getFormPattern(form: string): string {
    return form
      .replace(/です$/, '')
      .replace(/でした$/, '')
      .replace(/ません$/, '')
      .replace(/ませんでした$/, '')
      .replace(/だろう$/, '')
      .replace(/でしょう$/, '');
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
    count: number = 5
  ): DrillQuestion[] {
    const questions: DrillQuestion[] = [];
    const conjugations = ConjugationEngine.conjugate(word);
    const availableForms = Object.keys(conjugations).filter(
      key => conjugations[key as keyof ConjugationForms] &&
            conjugations[key as keyof ConjugationForms] !== ''
    ) as (keyof ConjugationForms)[];

    const selectedForms = this.shuffleArray(availableForms).slice(0, count);

    for (const targetForm of selectedForms) {
      const correctAnswer = conjugations[targetForm];
      if (!correctAnswer) continue;

      const question = this.generateSingleQuestion(word, targetForm, correctAnswer, conjugations);
      if (question) {
        questions.push(question);
      }
    }

    return questions;
  }
}