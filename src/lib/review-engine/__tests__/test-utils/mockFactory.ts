/**
 * Shared Mock Factory for Universal Review Engine Tests
 * Agent 1: Test Architect
 * 
 * This factory provides consistent mock data for all test suites,
 * ensuring test isolation while maintaining realistic data structures.
 */

import { 
  ReviewableContent, 
  ReviewSession, 
  ReviewSessionItem,
  SessionStatistics,
  ReviewMode,
  ContentType,
  ReviewEvent,
  ReviewEventType,
  ValidationResult,
  ProgressUpdate,
  Achievement,
  SRSData,
  PinOptions,
  ContentTypeConfig,
  ReviewModeConfig
} from '../../core/interfaces';

export class MockFactory {
  private static idCounter = 0;

  /**
   * Generate unique ID for test data
   */
  static generateId(prefix = 'test'): string {
    return `${prefix}_${Date.now()}_${++this.idCounter}`;
  }

  /**
   * Create mock ReviewableContent
   */
  static createReviewableContent(
    overrides?: Partial<ReviewableContent>
  ): ReviewableContent {
    const defaultContent: ReviewableContent = {
      id: this.generateId('content'),
      contentType: 'kana',
      primaryDisplay: 'あ',
      secondaryDisplay: 'a',
      tertiaryDisplay: 'Hiragana vowel',
      primaryAnswer: 'a',
      alternativeAnswers: ['ah'],
      audioUrl: '/audio/test.mp3',
      imageUrl: '/images/test.svg',
      difficulty: 0.3,
      tags: ['hiragana', 'vowel'],
      source: 'test',
      supportedModes: ['recognition', 'recall', 'listening'],
      preferredMode: 'recognition',
      metadata: {
        row: 'a',
        column: '1',
        type: 'vowel'
      }
    };

    return { ...defaultContent, ...overrides };
  }

  /**
   * Create bulk ReviewableContent items
   */
  static createBulkContent(
    count: number,
    contentType: ContentType = 'kana',
    overrides?: Partial<ReviewableContent>
  ): ReviewableContent[] {
    const items: ReviewableContent[] = [];
    const kanaChars = ['あ', 'い', 'う', 'え', 'お', 'か', 'き', 'く', 'け', 'こ'];
    const romaji = ['a', 'i', 'u', 'e', 'o', 'ka', 'ki', 'ku', 'ke', 'ko'];

    for (let i = 0; i < count; i++) {
      items.push(this.createReviewableContent({
        id: `${contentType}_${i}`,
        contentType,
        primaryDisplay: kanaChars[i % kanaChars.length],
        secondaryDisplay: romaji[i % romaji.length],
        primaryAnswer: romaji[i % romaji.length],
        difficulty: Math.random(),
        ...overrides
      }));
    }

    return items;
  }

  /**
   * Create mock ReviewSession
   */
  static createReviewSession(
    overrides?: Partial<ReviewSession>
  ): ReviewSession {
    const defaultSession: ReviewSession = {
      id: this.generateId('session'),
      userId: 'test_user_123',
      startedAt: new Date(),
      lastActivityAt: new Date(),
      items: [],
      currentIndex: 0,
      mode: 'recognition',
      config: this.createReviewModeConfig(),
      status: 'active',
      source: 'manual'
    };

    return { ...defaultSession, ...overrides };
  }

  /**
   * Create mock ReviewSessionItem
   */
  static createReviewSessionItem(
    content?: ReviewableContent,
    overrides?: Partial<ReviewSessionItem>
  ): ReviewSessionItem {
    const defaultItem: ReviewSessionItem = {
      content: content || this.createReviewableContent(),
      presentedAt: new Date(),
      answeredAt: undefined,
      responseTime: undefined,
      userAnswer: undefined,
      correct: undefined,
      confidence: undefined,
      hintsUsed: 0,
      attempts: 0,
      baseScore: 100,
      finalScore: 100,
      previousInterval: undefined,
      nextInterval: undefined,
      easeFactor: undefined
    };

    return { ...defaultItem, ...overrides };
  }

  /**
   * Create mock SessionStatistics
   */
  static createSessionStatistics(
    overrides?: Partial<SessionStatistics>
  ): SessionStatistics {
    const defaultStats: SessionStatistics = {
      sessionId: this.generateId('session'),
      totalItems: 20,
      completedItems: 15,
      correctItems: 12,
      incorrectItems: 3,
      skippedItems: 5,
      accuracy: 80,
      averageResponseTime: 3500,
      totalTime: 300000,
      currentStreak: 5,
      bestStreak: 8,
      performanceByDifficulty: {
        easy: { correct: 5, total: 5 },
        medium: { correct: 5, total: 7 },
        hard: { correct: 2, total: 3 }
      },
      performanceByMode: {
        recognition: { correct: 8, total: 10, avgTime: 3000 },
        recall: { correct: 4, total: 5, avgTime: 4500 }
      }
    };

    return { ...defaultStats, ...overrides };
  }

  /**
   * Create mock SRSData
   */
  static createSRSData(overrides?: Partial<SRSData>): SRSData {
    const defaultSRS: SRSData = {
      interval: 1,
      easeFactor: 2.5,
      repetitions: 0,
      lastReviewedAt: null,
      nextReviewAt: new Date(Date.now() + 86400000), // Tomorrow
      status: 'new'
    };

    return { ...defaultSRS, ...overrides };
  }

  /**
   * Create mock ValidationResult
   */
  static createValidationResult(
    overrides?: Partial<ValidationResult>
  ): ValidationResult {
    const defaultResult: ValidationResult = {
      correct: true,
      score: 1.0,
      expectedAnswer: 'test',
      feedback: 'Correct!',
      corrections: [],
      partialCredit: false
    };

    return { ...defaultResult, ...overrides };
  }

  /**
   * Create mock ReviewEvent
   */
  static createReviewEvent<T = any>(
    type: ReviewEventType,
    data: T,
    overrides?: Partial<ReviewEvent<T>>
  ): ReviewEvent<T> {
    const defaultEvent: ReviewEvent<T> = {
      type,
      timestamp: new Date(),
      sessionId: this.generateId('session'),
      userId: 'test_user_123',
      data,
      metadata: {}
    };

    return { ...defaultEvent, ...overrides };
  }

  /**
   * Create mock ProgressUpdate
   */
  static createProgressUpdate(
    overrides?: Partial<ProgressUpdate>
  ): ProgressUpdate {
    const defaultProgress: ProgressUpdate = {
      contentType: 'kana',
      learned: 50,
      learning: 30,
      notStarted: 20,
      totalReviewed: 100,
      accuracy: 85,
      timeSpent: 3600000,
      lastActivity: new Date()
    };

    return { ...defaultProgress, ...overrides };
  }

  /**
   * Create mock Achievement
   */
  static createAchievement(overrides?: Partial<Achievement>): Achievement {
    const defaultAchievement: Achievement = {
      id: this.generateId('achievement'),
      type: 'milestone',
      title: 'First Review',
      description: 'Complete your first review session',
      icon: '🎯',
      rarity: 'common',
      points: 10,
      unlockedAt: undefined,
      progress: 0,
      maxProgress: 1
    };

    return { ...defaultAchievement, ...overrides };
  }

  /**
   * Create mock PinOptions
   */
  static createPinOptions(overrides?: Partial<PinOptions>): PinOptions {
    const defaultOptions: PinOptions = {
      priority: 'normal',
      tags: ['test'],
      setId: this.generateId('set'),
      releaseSchedule: 'immediate',
      dailyLimit: 20
    };

    return { ...defaultOptions, ...overrides };
  }

  /**
   * Create mock ContentTypeConfig
   */
  static createContentTypeConfig(
    overrides?: Partial<ContentTypeConfig>
  ): ContentTypeConfig {
    const defaultConfig: ContentTypeConfig = {
      contentType: 'kana',
      availableModes: [
        this.createReviewModeConfig({ mode: 'recognition' }),
        this.createReviewModeConfig({ mode: 'recall' }),
        this.createReviewModeConfig({ mode: 'listening' })
      ],
      defaultMode: 'recognition',
      validationStrategy: 'fuzzy',
      validationOptions: {
        caseSensitive: false,
        allowTypos: true,
        typoThreshold: 0.8
      },
      fontSize: 'large',
      fontFamily: 'Noto Sans JP',
      features: {
        strokeOrder: false,
        furigana: false,
        pitch: false,
        conjugation: false
      }
    };

    return { ...defaultConfig, ...overrides };
  }

  /**
   * Create mock ReviewModeConfig
   */
  static createReviewModeConfig(
    overrides?: Partial<ReviewModeConfig>
  ): ReviewModeConfig {
    const defaultConfig: ReviewModeConfig = {
      mode: 'recognition',
      showPrimary: true,
      showSecondary: false,
      showTertiary: false,
      showMedia: false,
      inputType: 'multiple-choice',
      optionCount: 4,
      optionSource: 'similar',
      timeLimit: undefined,
      minResponseTime: 500,
      allowHints: true,
      hintPenalty: 0.1,
      autoPlayAudio: false,
      repeatLimit: 3
    };

    return { ...defaultConfig, ...overrides };
  }

  /**
   * Create a complete test scenario with related data
   */
  static createTestScenario(itemCount = 10): {
    session: ReviewSession;
    items: ReviewableContent[];
    statistics: SessionStatistics;
    events: ReviewEvent[];
  } {
    const items = this.createBulkContent(itemCount);
    const sessionItems = items.map(content => 
      this.createReviewSessionItem(content)
    );
    
    const session = this.createReviewSession({
      items: sessionItems,
      currentIndex: Math.floor(itemCount / 2)
    });

    const statistics = this.createSessionStatistics({
      sessionId: session.id,
      totalItems: itemCount,
      completedItems: Math.floor(itemCount / 2)
    });

    const events: ReviewEvent[] = [
      this.createReviewEvent(ReviewEventType.SESSION_STARTED, {
        sessionId: session.id,
        itemCount,
        mode: session.mode
      }),
      this.createReviewEvent(ReviewEventType.PROGRESS_UPDATED, {
        sessionId: session.id,
        current: session.currentIndex,
        total: itemCount
      })
    ];

    return { session, items, statistics, events };
  }

  /**
   * Create mock API response
   */
  static createApiResponse<T>(data: T, success = true): {
    success: boolean;
    data?: T;
    error?: string;
    timestamp: string;
  } {
    return {
      success,
      data: success ? data : undefined,
      error: success ? undefined : 'Test error',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create mock user with subscription
   */
  static createUser(tier: 'free' | 'premium' = 'free'): {
    id: string;
    email: string;
    subscription: {
      tier: string;
      status: string;
      expiresAt?: Date;
    };
    settings: {
      dailyGoal: number;
      reviewReminders: boolean;
      soundEffects: boolean;
    };
  } {
    return {
      id: this.generateId('user'),
      email: 'test@example.com',
      subscription: {
        tier,
        status: 'active',
        expiresAt: tier === 'premium' 
          ? new Date(Date.now() + 30 * 86400000) 
          : undefined
      },
      settings: {
        dailyGoal: 20,
        reviewReminders: true,
        soundEffects: true
      }
    };
  }

  /**
   * Reset factory state (call between test suites)
   */
  static reset(): void {
    this.idCounter = 0;
  }
}

// Export individual creation functions for convenience
export const {
  createReviewableContent,
  createBulkContent,
  createReviewSession,
  createReviewSessionItem,
  createSessionStatistics,
  createSRSData,
  createValidationResult,
  createReviewEvent,
  createProgressUpdate,
  createAchievement,
  createPinOptions,
  createContentTypeConfig,
  createReviewModeConfig,
  createTestScenario,
  createApiResponse,
  createUser
} = MockFactory;