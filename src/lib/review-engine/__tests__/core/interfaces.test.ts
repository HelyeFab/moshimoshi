/**
 * Unit tests for Core Interfaces
 * Tests all TypeScript interfaces and types for the Universal Review Engine
 */

import {
  ReviewableContent,
  KanaMetadata,
  KanjiMetadata,
  VocabularyMetadata,
  SentenceMetadata,
  ValidationResult,
  Hint,
  ContentFilter,
  ContentStatistics
} from '../../core/interfaces'

import {
  ReviewMode,
  ReviewModeConfig,
  ContentTypeConfig,
  DEFAULT_MODE_CONFIGS,
  PerformanceThresholds,
  ScoringConfig
} from '../../core/types'

import {
  ReviewSession,
  ReviewSessionItem,
  SessionStatistics,
  CreateSessionOptions,
  UpdateSessionPayload,
  AnswerItemPayload,
  SessionSummary,
  AggregateStatistics
} from '../../core/session.types'

import {
  ReviewEventType,
  ReviewEvent,
  SessionStartedPayload,
  ItemAnsweredPayload,
  ProgressUpdatedPayload
} from '../../core/events'

import {
  ReviewEngineError,
  ValidationError,
  SessionError,
  SyncError,
  ContentError,
  isReviewEngineError,
  isRecoverableError,
  formatErrorMessage,
  ERROR_CODES
} from '../../core/errors'

import {
  ReviewEngineConfig,
  UserPreferences,
  RuntimeConfig,
  DEFAULT_CONFIG,
  validateConfig,
  mergeConfig
} from '../../core/config.types'

describe('Core Interfaces', () => {
  describe('ReviewableContent', () => {
    it('should create valid kana content', () => {
      const kanaContent: ReviewableContent = {
        id: 'hiragana-a',
        contentType: 'kana',
        primaryDisplay: 'あ',
        secondaryDisplay: 'a',
        tertiaryDisplay: 'Hiragana character for "a"',
        primaryAnswer: 'a',
        alternativeAnswers: ['A'],
        audioUrl: '/audio/hiragana/a.mp3',
        difficulty: 0.1,
        tags: ['hiragana', 'basic', 'vowel'],
        source: 'Basic Hiragana',
        supportedModes: ['recognition', 'recall', 'listening'],
        preferredMode: 'recognition',
        metadata: {
          script: 'hiragana',
          romaji: 'a',
          dakuten: false
        } as KanaMetadata
      }

      expect(kanaContent.contentType).toBe('kana')
      expect(kanaContent.primaryDisplay).toBe('あ')
      expect(kanaContent.supportedModes).toContain('listening')
    })

    it('should create valid kanji content', () => {
      const kanjiContent: ReviewableContent = {
        id: 'kanji-日',
        contentType: 'kanji',
        primaryDisplay: '日',
        secondaryDisplay: 'sun, day',
        tertiaryDisplay: 'にち、ひ',
        primaryAnswer: 'sun',
        alternativeAnswers: ['day', 'nichi', 'hi'],
        imageUrl: '/strokes/日.svg',
        difficulty: 0.3,
        tags: ['jlpt-n5', 'grade-1', 'common'],
        source: 'JLPT N5',
        supportedModes: ['recognition', 'recall'],
        metadata: {
          strokeCount: 4,
          onyomi: ['ニチ', 'ジツ'],
          kunyomi: ['ひ', 'か'],
          jlptLevel: 5,
          grade: 1,
          frequency: 1
        } as KanjiMetadata
      }

      expect(kanjiContent.contentType).toBe('kanji')
      expect((kanjiContent.metadata as KanjiMetadata).strokeCount).toBe(4)
    })

    it('should create valid vocabulary content', () => {
      const vocabContent: ReviewableContent = {
        id: 'vocab-食べる',
        contentType: 'vocabulary',
        primaryDisplay: '食べる',
        secondaryDisplay: 'to eat',
        tertiaryDisplay: 'たべる',
        primaryAnswer: 'to eat',
        alternativeAnswers: ['eat', 'eating'],
        audioUrl: '/audio/vocab/taberu.mp3',
        difficulty: 0.2,
        tags: ['verb', 'jlpt-n5', 'common'],
        source: 'Core Vocabulary',
        supportedModes: ['recognition', 'recall', 'listening'],
        metadata: {
          reading: 'たべる',
          partOfSpeech: ['verb', 'ichidan'],
          pitchAccent: 2,
          commonUsage: true
        } as VocabularyMetadata
      }

      expect(vocabContent.contentType).toBe('vocabulary')
      expect((vocabContent.metadata as VocabularyMetadata).partOfSpeech).toContain('verb')
    })

    it('should validate required fields', () => {
      const isValidContent = (content: any): content is ReviewableContent => {
        return (
          typeof content.id === 'string' &&
          typeof content.contentType === 'string' &&
          typeof content.primaryDisplay === 'string' &&
          typeof content.primaryAnswer === 'string' &&
          typeof content.difficulty === 'number' &&
          Array.isArray(content.tags) &&
          Array.isArray(content.supportedModes)
        )
      }

      const validContent = {
        id: 'test',
        contentType: 'custom',
        primaryDisplay: 'Test',
        primaryAnswer: 'test',
        difficulty: 0.5,
        tags: [],
        supportedModes: ['recognition']
      }

      const invalidContent = {
        id: 'test',
        primaryDisplay: 'Test'
      }

      expect(isValidContent(validContent)).toBe(true)
      expect(isValidContent(invalidContent)).toBe(false)
    })
  })

  describe('ReviewSession', () => {
    it('should create a valid session', () => {
      const session: ReviewSession = {
        id: 'session-123',
        userId: 'user-456',
        startedAt: new Date(),
        lastActivityAt: new Date(),
        items: [],
        currentIndex: 0,
        mode: 'recognition',
        config: DEFAULT_MODE_CONFIGS.recognition as ReviewModeConfig,
        status: 'active',
        source: 'manual',
        tags: ['practice']
      }

      expect(session.status).toBe('active')
      expect(session.mode).toBe('recognition')
    })

    it('should track session items correctly', () => {
      const item: ReviewSessionItem = {
        content: {
          id: 'test',
          contentType: 'kana',
          primaryDisplay: 'あ',
          primaryAnswer: 'a',
          difficulty: 0.1,
          tags: [],
          supportedModes: ['recognition']
        },
        presentedAt: new Date(),
        hintsUsed: 0,
        attempts: 1,
        baseScore: 10,
        finalScore: 10
      }

      expect(item.hintsUsed).toBe(0)
      expect(item.baseScore).toBe(10)
    })

    it('should calculate session statistics', () => {
      const stats: SessionStatistics = {
        sessionId: 'session-123',
        totalItems: 20,
        completedItems: 18,
        correctItems: 15,
        incorrectItems: 3,
        skippedItems: 2,
        accuracy: 83.33,
        averageResponseTime: 2500,
        totalTime: 45000,
        currentStreak: 5,
        bestStreak: 8,
        performanceByDifficulty: {
          easy: { correct: 8, total: 8, avgTime: 2000 },
          medium: { correct: 5, total: 7, avgTime: 2800 },
          hard: { correct: 2, total: 5, avgTime: 3200 }
        },
        totalScore: 150,
        maxPossibleScore: 200,
        totalHintsUsed: 3,
        averageHintsPerItem: 0.15
      }

      expect(stats.accuracy).toBeCloseTo(83.33, 2)
      expect(stats.completedItems).toBe(18)
      expect(stats.performanceByDifficulty.easy.correct).toBe(8)
    })
  })

  describe('Events', () => {
    it('should create session started event', () => {
      const event: ReviewEvent<SessionStartedPayload> = {
        type: ReviewEventType.SESSION_STARTED,
        timestamp: new Date(),
        sessionId: 'session-123',
        userId: 'user-456',
        data: {
          sessionId: 'session-123',
          itemCount: 20,
          mode: 'recognition',
          source: 'manual',
          contentTypes: ['kana', 'kanji']
        }
      }

      expect(event.type).toBe(ReviewEventType.SESSION_STARTED)
      expect(event.data.itemCount).toBe(20)
    })

    it('should create item answered event', () => {
      const event: ReviewEvent<ItemAnsweredPayload> = {
        type: ReviewEventType.ITEM_ANSWERED,
        timestamp: new Date(),
        sessionId: 'session-123',
        data: {
          itemId: 'item-1',
          correct: true,
          responseTime: 2500,
          userAnswer: 'a',
          expectedAnswer: 'a',
          confidence: 5,
          score: 10,
          attempts: 1
        }
      }

      expect(event.data.correct).toBe(true)
      expect(event.data.confidence).toBe(5)
    })

    it('should create progress updated event', () => {
      const event: ReviewEvent<ProgressUpdatedPayload> = {
        type: ReviewEventType.PROGRESS_UPDATED,
        timestamp: new Date(),
        sessionId: 'session-123',
        data: {
          sessionId: 'session-123',
          current: 5,
          total: 20,
          correct: 4,
          incorrect: 1,
          skipped: 0,
          accuracy: 80,
          streak: 3,
          score: 45
        }
      }

      expect(event.data.accuracy).toBe(80)
      expect(event.data.streak).toBe(3)
    })

    it('should validate event types', () => {
      const eventTypes = Object.values(ReviewEventType)
      
      expect(eventTypes).toContain('session.started')
      expect(eventTypes).toContain('item.answered')
      expect(eventTypes).toContain('progress.updated')
      expect(eventTypes).toContain('sync.failed')
    })
  })

  describe('Errors', () => {
    it('should create ReviewEngineError', () => {
      const error = new ReviewEngineError(
        'Test error',
        'TEST_ERROR',
        { detail: 'test' },
        true
      )

      expect(error.message).toBe('Test error')
      expect(error.code).toBe('TEST_ERROR')
      expect(error.recoverable).toBe(true)
      expect(error.details).toEqual({ detail: 'test' })
    })

    it('should create specific error types', () => {
      const validationError = new ValidationError('Invalid input', {
        field: 'answer',
        value: 'wrong',
        expected: 'correct'
      })

      const sessionError = new SessionError('Session not found', {
        sessionId: 'session-123',
        action: 'resume'
      })

      expect(validationError).toBeInstanceOf(ValidationError)
      expect(validationError).toBeInstanceOf(ReviewEngineError)
      expect(sessionError.name).toBe('SessionError')
    })

    it('should check if error is recoverable', () => {
      const recoverableError = new SyncError('Network timeout', {
        retryable: true
      })

      const nonRecoverableError = new ContentError('Content corrupted')

      expect(isRecoverableError(recoverableError)).toBe(true)
      expect(isRecoverableError(nonRecoverableError)).toBe(false)
    })

    it('should format error messages', () => {
      const error = new ValidationError('Invalid answer')
      const formatted = formatErrorMessage(error)

      expect(formatted).toBe('[VALIDATION_ERROR] Invalid answer')
    })

    it('should verify error codes', () => {
      expect(ERROR_CODES.INVALID_INPUT).toBe('INVALID_INPUT')
      expect(ERROR_CODES.SESSION_NOT_FOUND).toBe('SESSION_NOT_FOUND')
      expect(ERROR_CODES.NETWORK_OFFLINE).toBe('NETWORK_OFFLINE')
    })
  })

  describe('Configuration', () => {
    it('should have valid default configuration', () => {
      expect(DEFAULT_CONFIG.defaultSessionLength).toBe(20)
      expect(DEFAULT_CONFIG.offline.enabled).toBe(true)
      expect(DEFAULT_CONFIG.features.spacedRepetition).toBe(true)
      expect(DEFAULT_CONFIG.api.baseUrl).toBe('/api/review/v2')
    })

    it('should merge configurations correctly', () => {
      const custom: Partial<ReviewEngineConfig> = {
        defaultSessionLength: 30,
        features: {
          ...DEFAULT_CONFIG.features,
          videos: true
        }
      }

      const merged = mergeConfig(custom)

      expect(merged.defaultSessionLength).toBe(30)
      expect(merged.features.videos).toBe(true)
      expect(merged.features.audio).toBe(true) // Should keep default
    })

    it('should validate user preferences', () => {
      const preferences: UserPreferences = {
        preferredMode: 'recall',
        sessionLength: 25,
        audioEnabled: false,
        theme: 'dark',
        fontSize: 'large'
      }

      expect(preferences.preferredMode).toBe('recall')
      expect(preferences.theme).toBe('dark')
    })

    it('should handle runtime config', () => {
      const runtime: RuntimeConfig = {
        debug: true,
        verboseLogging: true,
        performanceMonitoring: false,
        featureFlags: {
          newFeature: true,
          experimentalMode: false
        }
      }

      expect(runtime.debug).toBe(true)
      expect(runtime.featureFlags?.newFeature).toBe(true)
    })
  })

  describe('Type Guards and Helpers', () => {
    it('should validate review modes', () => {
      const validModes: ReviewMode[] = ['recognition', 'recall', 'listening']
      const isValidMode = (mode: string): mode is ReviewMode => {
        return validModes.includes(mode as ReviewMode)
      }

      expect(isValidMode('recognition')).toBe(true)
      expect(isValidMode('invalid')).toBe(false)
    })

    it('should validate session status', () => {
      const validStatuses = ['active', 'paused', 'completed', 'abandoned']
      const status = 'active'

      expect(validStatuses).toContain(status)
    })

    it('should check ReviewEngineError type guard', () => {
      const reviewError = new ReviewEngineError('Test', 'TEST')
      const normalError = new Error('Test')

      expect(isReviewEngineError(reviewError)).toBe(true)
      expect(isReviewEngineError(normalError)).toBe(false)
    })
  })

  describe('Default Mode Configurations', () => {
    it('should have valid recognition mode defaults', () => {
      const recognitionConfig = DEFAULT_MODE_CONFIGS.recognition

      expect(recognitionConfig.showPrimary).toBe(true)
      expect(recognitionConfig.showSecondary).toBe(false)
      expect(recognitionConfig.inputType).toBe('multiple-choice')
      expect(recognitionConfig.optionCount).toBe(4)
    })

    it('should have valid recall mode defaults', () => {
      const recallConfig = DEFAULT_MODE_CONFIGS.recall

      expect(recallConfig.showPrimary).toBe(false)
      expect(recallConfig.showSecondary).toBe(true)
      expect(recallConfig.inputType).toBe('text')
      expect(recallConfig.allowRetry).toBe(true)
    })

    it('should have valid listening mode defaults', () => {
      const listeningConfig = DEFAULT_MODE_CONFIGS.listening

      expect(listeningConfig.autoPlayAudio).toBe(true)
      expect(listeningConfig.repeatLimit).toBe(3)
      expect(listeningConfig.allowHints).toBe(false)
    })
  })

  describe('Content Filters', () => {
    it('should create valid content filter', () => {
      const filter: ContentFilter = {
        contentTypes: ['kana', 'kanji'],
        tags: ['jlpt-n5'],
        difficultyRange: {
          min: 0.1,
          max: 0.5
        },
        sources: ['JLPT N5'],
        limit: 20
      }

      expect(filter.contentTypes).toContain('kana')
      expect(filter.difficultyRange?.min).toBe(0.1)
      expect(filter.limit).toBe(20)
    })
  })

  describe('Performance and Scoring', () => {
    it('should define performance thresholds', () => {
      const thresholds: PerformanceThresholds = {
        masteryThreshold: 0.9,
        passingThreshold: 0.7,
        fastResponseTime: 2000,
        minValidResponseTime: 100
      }

      expect(thresholds.masteryThreshold).toBeGreaterThan(thresholds.passingThreshold)
      expect(thresholds.fastResponseTime).toBeGreaterThan(thresholds.minValidResponseTime)
    })

    it('should define scoring configuration', () => {
      const scoring: ScoringConfig = {
        basePoints: 10,
        speedBonusMultiplier: 1.5,
        streakBonusMultiplier: 1.2,
        hintPenalty: 2,
        retryPenalty: 3,
        useDifficultyWeighting: true
      }

      expect(scoring.basePoints).toBe(10)
      expect(scoring.speedBonusMultiplier).toBeGreaterThan(1)
    })
  })
})