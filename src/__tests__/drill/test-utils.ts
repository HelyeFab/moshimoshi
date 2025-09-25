/**
 * Test utilities for drill feature testing
 */

import type { JapaneseWord, DrillQuestion, DrillSession, ConjugationForms } from '@/types/drill';

/**
 * Mock words for testing
 */
export const mockWords = {
  // Ichidan verb
  taberu: {
    id: 'test-1',
    kanji: '食べる',
    kana: 'たべる',
    meaning: 'to eat',
    type: 'Ichidan',
    jlpt: 'N5',
  } as JapaneseWord,

  // Godan verb
  nomu: {
    id: 'test-2',
    kanji: '飲む',
    kana: 'のむ',
    meaning: 'to drink',
    type: 'Godan',
    jlpt: 'N5',
  } as JapaneseWord,

  // Godan verb ending in く
  kaku: {
    id: 'test-3',
    kanji: '書く',
    kana: 'かく',
    meaning: 'to write',
    type: 'Godan',
    jlpt: 'N5',
  } as JapaneseWord,

  // Godan verb ending in ぐ
  oyogu: {
    id: 'test-4',
    kanji: '泳ぐ',
    kana: 'およぐ',
    meaning: 'to swim',
    type: 'Godan',
    jlpt: 'N4',
  } as JapaneseWord,

  // Godan verb ending in す
  hanasu: {
    id: 'test-5',
    kanji: '話す',
    kana: 'はなす',
    meaning: 'to speak',
    type: 'Godan',
    jlpt: 'N5',
  } as JapaneseWord,

  // Godan verb ending in つ
  matsu: {
    id: 'test-6',
    kanji: '待つ',
    kana: 'まつ',
    meaning: 'to wait',
    type: 'Godan',
    jlpt: 'N5',
  } as JapaneseWord,

  // Godan verb ending in ぬ
  shinu: {
    id: 'test-7',
    kanji: '死ぬ',
    kana: 'しぬ',
    meaning: 'to die',
    type: 'Godan',
    jlpt: 'N3',
  } as JapaneseWord,

  // Godan verb ending in ぶ
  asobu: {
    id: 'test-8',
    kanji: '遊ぶ',
    kana: 'あそぶ',
    meaning: 'to play',
    type: 'Godan',
    jlpt: 'N4',
  } as JapaneseWord,

  // Godan verb ending in る
  kaeru: {
    id: 'test-9',
    kanji: '帰る',
    kana: 'かえる',
    meaning: 'to return',
    type: 'Godan',
    jlpt: 'N5',
  } as JapaneseWord,

  // Godan verb ending in う
  kau: {
    id: 'test-10',
    kanji: '買う',
    kana: 'かう',
    meaning: 'to buy',
    type: 'Godan',
    jlpt: 'N5',
  } as JapaneseWord,

  // Special case - 行く
  iku: {
    id: 'test-11',
    kanji: '行く',
    kana: 'いく',
    meaning: 'to go',
    type: 'Irregular',  // Special case - treated as irregular
    jlpt: 'N5',
  } as JapaneseWord,

  // Irregular - する
  suru: {
    id: 'test-12',
    kanji: 'する',
    kana: 'する',
    meaning: 'to do',
    type: 'Irregular',
    jlpt: 'N5',
  } as JapaneseWord,

  // Irregular - 来る
  kuru: {
    id: 'test-13',
    kanji: '来る',
    kana: 'くる',
    meaning: 'to come',
    type: 'Irregular',
    jlpt: 'N5',
  } as JapaneseWord,

  // Irregular - compound する verb
  benkyouSuru: {
    id: 'test-14',
    kanji: '勉強する',
    kana: 'べんきょうする',
    meaning: 'to study',
    type: 'Irregular',
    jlpt: 'N5',
  } as JapaneseWord,

  // i-adjective
  ookii: {
    id: 'test-15',
    kanji: '大きい',
    kana: 'おおきい',
    meaning: 'big',
    type: 'i-adjective',
    jlpt: 'N5',
  } as JapaneseWord,

  // i-adjective
  takai: {
    id: 'test-16',
    kanji: '高い',
    kana: 'たかい',
    meaning: 'expensive/tall',
    type: 'i-adjective',
    jlpt: 'N5',
  } as JapaneseWord,

  // na-adjective
  genki: {
    id: 'test-17',
    kanji: '元気',
    kana: 'げんき',
    meaning: 'healthy/energetic',
    type: 'na-adjective',
    jlpt: 'N5',
  } as JapaneseWord,

  // na-adjective
  shizuka: {
    id: 'test-18',
    kanji: '静か',
    kana: 'しずか',
    meaning: 'quiet',
    type: 'na-adjective',
    jlpt: 'N5',
  } as JapaneseWord,

  // Non-conjugable noun
  hon: {
    id: 'test-19',
    kanji: '本',
    kana: 'ほん',
    meaning: 'book',
    type: 'noun',
    jlpt: 'N5',
  } as JapaneseWord,

  // Non-conjugable particle
  wa: {
    id: 'test-20',
    kanji: 'は',
    kana: 'は',
    meaning: 'topic particle',
    type: 'particle',
    jlpt: 'N5',
  } as JapaneseWord,
};

/**
 * Create a mock drill question
 */
export function createMockQuestion(
  word: JapaneseWord,
  targetForm: keyof ConjugationForms = 'past',
  correctAnswer: string = '食べた'
): DrillQuestion {
  return {
    id: `question-${word.id}-${targetForm}`,
    word,
    targetForm,
    stem: `${word.kanji}_____`,
    correctAnswer,
    options: [correctAnswer, '食べる', '食べない', '食べます'],
    rule: 'Test rule',
  };
}

/**
 * Create a mock drill session
 */
export function createMockSession(
  questions: DrillQuestion[] = [createMockQuestion(mockWords.taberu)]
): DrillSession {
  return {
    id: 'test-session-1',
    userId: 'test-user',
    questions,
    currentQuestionIndex: 0,
    score: 0,
    startedAt: new Date().toISOString(),
    mode: 'random',
    wordTypeFilter: 'all',
  };
}

/**
 * Assert conjugation forms match expected values
 */
export function assertConjugationForms(
  actual: ConjugationForms,
  expected: Partial<ConjugationForms>
): void {
  Object.entries(expected).forEach(([key, value]) => {
    if (value !== undefined) {
      expect(actual[key as keyof ConjugationForms]).toBe(value);
    }
  });
}

/**
 * Get all verb words from mock data
 */
export function getMockVerbs(): JapaneseWord[] {
  return Object.values(mockWords).filter(
    word => word.type === 'Ichidan' || word.type === 'Godan' || word.type === 'Irregular'
  );
}

/**
 * Get all adjective words from mock data
 */
export function getMockAdjectives(): JapaneseWord[] {
  return Object.values(mockWords).filter(
    word => word.type === 'i-adjective' || word.type === 'na-adjective'
  );
}

/**
 * Get all conjugable words from mock data
 */
export function getMockConjugableWords(): JapaneseWord[] {
  return [...getMockVerbs(), ...getMockAdjectives()];
}

/**
 * Get all non-conjugable words from mock data
 */
export function getMockNonConjugableWords(): JapaneseWord[] {
  return Object.values(mockWords).filter(
    word => word.type === 'noun' || word.type === 'particle' || word.type === 'other'
  );
}

/**
 * Create mock API response
 */
export function createMockApiResponse(data: any, success = true) {
  return {
    success,
    data,
    error: success ? undefined : { code: 'ERROR', message: 'Test error' },
  };
}

/**
 * Delay helper for async tests
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}