/**
 * Shared Mock Factory for Review Engine Tests
 * Provides consistent mock data across all test suites
 */

import { ReviewableContent } from '../../core/interfaces';
import { ReviewMode, SessionStatus } from '../../core/types';
import { KanaContent } from '../../adapters/kana.adapter';
import { KanjiContent } from '../../adapters/kanji.adapter';
import { VocabularyContent } from '../../adapters/vocabulary.adapter';
import { SentenceContent } from '../../adapters/sentence.adapter';
import { CustomContent } from '../../adapters/custom.adapter';

export class MockFactory {
  private static idCounter = 0;

  static resetIdCounter() {
    this.idCounter = 0;
  }

  static generateId(): string {
    return `test-id-${++this.idCounter}`;
  }

  // Content Creation Methods
  static createReviewableContent(overrides?: Partial<ReviewableContent>): ReviewableContent {
    return {
      id: this.generateId(),
      contentType: 'vocabulary',
      primaryDisplay: 'Test Display',
      primaryAnswer: 'Test Answer',
      secondaryDisplay: 'Secondary Display',
      alternativeAnswers: ['alt1', 'alt2'],
      difficulty: 0.5,
      tags: ['test', 'mock'],
      supportedModes: ['recognition', 'recall'] as ReviewMode[],
      preferredMode: 'recognition' as ReviewMode,
      metadata: {},
      ...overrides
    };
  }

  static createKanaContent(overrides?: Partial<KanaContent>): KanaContent {
    return {
      id: this.generateId(),
      hiragana: 'あ',
      katakana: 'ア',
      romaji: 'a',
      type: 'vowel',
      row: 'a',
      column: '1',
      ...overrides
    };
  }

  static createKanjiContent(overrides?: Partial<KanjiContent>): KanjiContent {
    return {
      id: this.generateId(),
      character: '日',
      meanings: ['sun', 'day'],
      onyomi: ['ニチ', 'ジツ'],
      kunyomi: ['ひ', 'ひる'],
      grade: 1,
      jlpt: 5,
      strokeCount: 4,
      radicals: ['日'],
      examples: [
        {
          word: '今日',
          reading: 'きょう',
          meaning: 'today'
        }
      ],
      ...overrides
    };
  }

  static createVocabularyContent(overrides?: Partial<VocabularyContent>): VocabularyContent {
    return {
      id: this.generateId(),
      word: '食べる',
      reading: 'たべる',
      meanings: ['to eat', 'to consume'],
      partOfSpeech: ['verb', 'transitive'],
      level: 'N5',
      examples: ['私は寿司を食べます。', '朝食を食べました。'],
      audioUrl: '/audio/vocabulary/taberu.mp3',
      pitchAccent: [0, 1, 0],
      ...overrides
    };
  }

  static createSentenceContent(overrides?: Partial<SentenceContent>): SentenceContent {
    return {
      id: this.generateId(),
      japanese: '今日は晴れです。',
      translation: 'It is sunny today.',
      reading: 'きょうははれです。',
      level: 'N5',
      grammar: ['は particle', 'です copula'],
      vocabulary: ['今日', '晴れ'],
      audioUrl: '/audio/sentences/sunny-day.mp3',
      ...overrides
    };
  }

  static createCustomContent(overrides?: Partial<CustomContent>): CustomContent {
    return {
      id: this.generateId(),
      front: 'Custom Front',
      back: 'Custom Back',
      type: 'flashcard',
      media: {
        audio: '/audio/custom/test.mp3',
        image: '/images/custom/test.jpg'
      },
      tags: ['custom', 'user-created'],
      difficulty: 0.5,
      hints: ['This is a hint', 'Another helpful hint'],
      ...overrides
    };
  }

  // Session Creation Methods (simplified for testing)
  static createMockSession(overrides?: any) {
    return {
      id: this.generateId(),
      userId: 'test-user-id',
      status: 'active' as SessionStatus,
      mode: 'recognition' as ReviewMode,
      ...overrides
    };
  }

  // Bulk Creation Methods
  static createBulkKanaContent(count: number): KanaContent[] {
    const kanaData = [
      { hiragana: 'あ', katakana: 'ア', romaji: 'a' },
      { hiragana: 'か', katakana: 'カ', romaji: 'ka' },
      { hiragana: 'さ', katakana: 'サ', romaji: 'sa' },
      { hiragana: 'た', katakana: 'タ', romaji: 'ta' },
      { hiragana: 'な', katakana: 'ナ', romaji: 'na' },
      { hiragana: 'は', katakana: 'ハ', romaji: 'ha' },
      { hiragana: 'ま', katakana: 'マ', romaji: 'ma' },
      { hiragana: 'や', katakana: 'ヤ', romaji: 'ya' },
      { hiragana: 'ら', katakana: 'ラ', romaji: 'ra' },
      { hiragana: 'わ', katakana: 'ワ', romaji: 'wa' }
    ];

    return Array.from({ length: count }, (_, i) => {
      const data = kanaData[i % kanaData.length];
      return this.createKanaContent({
        ...data,
        type: i % 2 === 0 ? 'vowel' : 'consonant',
        row: data.romaji[0],
        column: String(i + 1)
      });
    });
  }

  static createBulkVocabularyContent(count: number): VocabularyContent[] {
    const vocabData = [
      { word: '食べる', reading: 'たべる', meanings: ['to eat'], partOfSpeech: ['verb'] },
      { word: '飲む', reading: 'のむ', meanings: ['to drink'], partOfSpeech: ['verb'] },
      { word: '見る', reading: 'みる', meanings: ['to see', 'to watch'], partOfSpeech: ['verb'] },
      { word: '聞く', reading: 'きく', meanings: ['to hear', 'to listen'], partOfSpeech: ['verb'] },
      { word: '話す', reading: 'はなす', meanings: ['to speak'], partOfSpeech: ['verb'] },
      { word: '本', reading: 'ほん', meanings: ['book'], partOfSpeech: ['noun'] },
      { word: '学校', reading: 'がっこう', meanings: ['school'], partOfSpeech: ['noun'] },
      { word: '大きい', reading: 'おおきい', meanings: ['big', 'large'], partOfSpeech: ['i-adjective'] }
    ];

    return Array.from({ length: count }, (_, i) => {
      const data = vocabData[i % vocabData.length];
      return this.createVocabularyContent({
        ...data,
        level: i < 3 ? 'N5' : 'N4'
      });
    });
  }

  static createBulkSentenceContent(count: number): SentenceContent[] {
    const sentenceData = [
      { 
        japanese: '今日は晴れです。', 
        translation: 'It is sunny today.',
        grammar: ['は particle', 'です copula'],
        vocabulary: ['今日', '晴れ']
      },
      { 
        japanese: '私は学生です。', 
        translation: 'I am a student.',
        grammar: ['は particle', 'です copula'],
        vocabulary: ['私', '学生']
      },
      { 
        japanese: '本を読みます。', 
        translation: 'I read a book.',
        grammar: ['を particle', 'ます form'],
        vocabulary: ['本', '読む']
      },
      { 
        japanese: '映画を見ました。', 
        translation: 'I watched a movie.',
        grammar: ['を particle', 'past tense'],
        vocabulary: ['映画', '見る']
      },
      { 
        japanese: '友達と話します。', 
        translation: 'I talk with friends.',
        grammar: ['と particle', 'ます form'],
        vocabulary: ['友達', '話す']
      }
    ];

    return Array.from({ length: count }, (_, i) => {
      const data = sentenceData[i % sentenceData.length];
      return this.createSentenceContent({
        ...data,
        level: i < 3 ? 'N5' : 'N4'
      });
    });
  }

  static createBulkCustomContent(count: number): CustomContent[] {
    const customData = [
      { front: 'Capital of Japan', back: 'Tokyo', type: 'geography' },
      { front: 'What is 2 + 2?', back: '4', type: 'math' },
      { front: 'Largest planet', back: 'Jupiter', type: 'science' },
      { front: 'Author of 1984', back: 'George Orwell', type: 'literature' },
      { front: 'Chemical symbol for gold', back: 'Au', type: 'chemistry' }
    ];

    return Array.from({ length: count }, (_, i) => {
      const data = customData[i % customData.length];
      return this.createCustomContent({
        ...data,
        difficulty: 0.3 + (i % 5) * 0.15
      });
    });
  }

  // API Mock Data
  static createApiRequest(overrides?: any) {
    return {
      body: {
        type: 'daily',
        settings: {
          maxItems: 20,
          shuffleOrder: true,
          showTimer: true,
          allowSkip: true
        },
        ...overrides
      }
    };
  }

  static createAuthUser(overrides?: any) {
    return {
      uid: 'test-user-id',
      email: 'test@example.com',
      emailVerified: true,
      customClaims: {},
      ...overrides
    };
  }

  static createPremiumUser(overrides?: any) {
    return this.createAuthUser({
      customClaims: {
        stripeCustomerId: 'cus_test123',
        subscription: {
          tier: 'premium',
          status: 'active'
        }
      },
      ...overrides
    });
  }

  // Error Scenarios
  static createErrorScenarios() {
    return {
      invalidContent: {
        id: null,
        contentType: 'custom' as any,
        primaryDisplay: '',
        primaryAnswer: ''
      },
      emptySession: {
        items: [],
        currentIndex: -1
      },
      malformedRequest: {
        body: null
      }
    };
  }

  // Performance Test Data
  static createLargeDataset(size: 'small' | 'medium' | 'large') {
    const counts = {
      small: 10,
      medium: 100,
      large: 1000
    };
    const count = counts[size];

    return {
      kana: this.createBulkKanaContent(count),
      vocabulary: this.createBulkVocabularyContent(count),
      sentences: this.createBulkSentenceContent(count),
      custom: this.createBulkCustomContent(count),
      sessions: Array.from({ length: Math.floor(count / 10) }, () => 
        this.createMockSession()
      )
    };
  }
}

// Helper functions for common test scenarios
export const createTestScenario = {
  happyPath: () => ({
    user: MockFactory.createAuthUser(),
    content: MockFactory.createReviewableContent(),
    session: MockFactory.createMockSession()
  }),

  premiumUser: () => ({
    user: MockFactory.createPremiumUser(),
    content: MockFactory.createReviewableContent(),
    session: MockFactory.createMockSession({ userId: 'premium-user-id' })
  }),

  errorCase: () => ({
    user: null,
    content: MockFactory.createErrorScenarios().invalidContent,
    session: MockFactory.createErrorScenarios().emptySession
  }),

  performance: (size: 'small' | 'medium' | 'large' = 'medium') => 
    MockFactory.createLargeDataset(size)
};