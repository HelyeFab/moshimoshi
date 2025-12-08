/**
 * Mock Factory for Integrity Checker Tests
 * Provides consistent mock data for testing integrity checker functionality
 */

export interface MockNewsArticle {
  id: string
  title: string
  source: string
  publishedAt: Date
  hasAudio: boolean
  hasTranslation: boolean
  hasWordExplanations: boolean
  audioUrl?: string
  audioSegments?: unknown[]
  translation?: Record<string, string>
  wordExplanations?: unknown[]
  status: 'published' | 'draft'
  createdAt: Date
  updatedAt: Date
}

export interface MockStory {
  id: string
  title: string
  level: 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
  status: 'published' | 'draft' | 'in_progress'
  hasAudio: boolean
  hasImages: boolean
  audioUrls?: string[]
  imageUrls?: string[]
  createdAt: Date
  updatedAt: Date
}

export interface MockIntegrityLog {
  id: string
  type: 'scheduled' | 'manual'
  checkId: string
  timestamp: string
  duration: number
  newsArticles: {
    checked: number
    missingAudio: string[]
    missingTranslations: string[]
    missingWordExplanations: string[]
    failedAudio: string[]
    repaired: {
      audio: number
      translations: number
      wordExplanations: number
    }
    repairFailed: {
      audio: number
      translations: number
      wordExplanations: number
    }
  }
  stories: {
    checked: number
    missingAudio: string[]
    missingImages: string[]
    stalledDrafts: string[]
    repaired: {
      audio: number
      images: number
    }
    repairFailed: {
      audio: number
      images: number
    }
  }
  triggeredBy?: string
  success: boolean
  error?: string
}

export class IntegrityMockFactory {
  private static idCounter = 0

  static resetIdCounter() {
    this.idCounter = 0
  }

  static generateId(prefix: string = 'test'): string {
    return `${prefix}-${++this.idCounter}-${Date.now()}`
  }

  // ============================================================================
  // NEWS ARTICLE MOCKS
  // ============================================================================

  static createNewsArticle(overrides?: Partial<MockNewsArticle>): MockNewsArticle {
    const now = new Date()
    return {
      id: this.generateId('article'),
      title: 'Test Article Title',
      source: 'NHK Easy',
      publishedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Yesterday
      hasAudio: true,
      hasTranslation: true,
      hasWordExplanations: true,
      audioUrl: '/audio/article.mp3',
      audioSegments: [{ start: 0, end: 10 }],
      translation: { en: 'English translation' },
      wordExplanations: [{ word: 'テスト', explanation: 'test' }],
      status: 'published',
      createdAt: now,
      updatedAt: now,
      ...overrides,
    }
  }

  static createNewsArticleWithMissingAudio(overrides?: Partial<MockNewsArticle>): MockNewsArticle {
    return this.createNewsArticle({
      hasAudio: false,
      audioUrl: undefined,
      audioSegments: undefined,
      ...overrides,
    })
  }

  static createNewsArticleWithMissingTranslation(
    overrides?: Partial<MockNewsArticle>
  ): MockNewsArticle {
    return this.createNewsArticle({
      hasTranslation: false,
      translation: undefined,
      ...overrides,
    })
  }

  static createNewsArticleWithMissingWordExplanations(
    overrides?: Partial<MockNewsArticle>
  ): MockNewsArticle {
    return this.createNewsArticle({
      hasWordExplanations: false,
      wordExplanations: undefined,
      ...overrides,
    })
  }

  static createBulkNewsArticles(
    count: number,
    options?: {
      missingAudioPercentage?: number
      missingTranslationPercentage?: number
      missingWordExplanationsPercentage?: number
    }
  ): MockNewsArticle[] {
    const {
      missingAudioPercentage = 0,
      missingTranslationPercentage = 0,
      missingWordExplanationsPercentage = 0,
    } = options || {}

    return Array.from({ length: count }, (_, i) => {
      const shouldMissAudio = i / count < missingAudioPercentage / 100
      const shouldMissTranslation = i / count < missingTranslationPercentage / 100
      const shouldMissWordExplanations = i / count < missingWordExplanationsPercentage / 100

      return this.createNewsArticle({
        hasAudio: !shouldMissAudio,
        audioUrl: shouldMissAudio ? undefined : '/audio/article.mp3',
        hasTranslation: !shouldMissTranslation,
        translation: shouldMissTranslation ? undefined : { en: 'Translation' },
        hasWordExplanations: !shouldMissWordExplanations,
        wordExplanations: shouldMissWordExplanations
          ? undefined
          : [{ word: 'test', explanation: 'test' }],
      })
    })
  }

  // ============================================================================
  // STORY MOCKS
  // ============================================================================

  static createStory(overrides?: Partial<MockStory>): MockStory {
    const now = new Date()
    return {
      id: this.generateId('story'),
      title: 'Test Story Title',
      level: 'N5',
      status: 'published',
      hasAudio: true,
      hasImages: true,
      audioUrls: ['/audio/story-1.mp3', '/audio/story-2.mp3'],
      imageUrls: ['/images/story-1.jpg', '/images/story-2.jpg'],
      createdAt: now,
      updatedAt: now,
      ...overrides,
    }
  }

  static createStoryWithMissingAudio(overrides?: Partial<MockStory>): MockStory {
    return this.createStory({
      hasAudio: false,
      audioUrls: undefined,
      ...overrides,
    })
  }

  static createStoryWithMissingImages(overrides?: Partial<MockStory>): MockStory {
    return this.createStory({
      hasImages: false,
      imageUrls: undefined,
      ...overrides,
    })
  }

  static createStalledDraftStory(overrides?: Partial<MockStory>): MockStory {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
    return this.createStory({
      status: 'draft',
      updatedAt: hourAgo,
      ...overrides,
    })
  }

  static createBulkStories(
    count: number,
    options?: {
      missingAudioPercentage?: number
      missingImagesPercentage?: number
      stalledDraftPercentage?: number
    }
  ): MockStory[] {
    const {
      missingAudioPercentage = 0,
      missingImagesPercentage = 0,
      stalledDraftPercentage = 0,
    } = options || {}

    return Array.from({ length: count }, (_, i) => {
      const shouldMissAudio = i / count < missingAudioPercentage / 100
      const shouldMissImages = i / count < missingImagesPercentage / 100
      const isStalled = i / count < stalledDraftPercentage / 100

      return this.createStory({
        hasAudio: !shouldMissAudio,
        audioUrls: shouldMissAudio ? undefined : ['/audio/story.mp3'],
        hasImages: !shouldMissImages,
        imageUrls: shouldMissImages ? undefined : ['/images/story.jpg'],
        status: isStalled ? 'draft' : 'published',
        updatedAt: isStalled ? new Date(Date.now() - 2 * 60 * 60 * 1000) : new Date(),
      })
    })
  }

  // ============================================================================
  // INTEGRITY LOG MOCKS
  // ============================================================================

  static createIntegrityLog(overrides?: Partial<MockIntegrityLog>): MockIntegrityLog {
    return {
      id: this.generateId('log'),
      type: 'scheduled',
      checkId: `scheduled_${new Date().toISOString().replace(/[:.]/g, '-')}`,
      timestamp: new Date().toISOString(),
      duration: 5000 + Math.random() * 10000,
      newsArticles: {
        checked: 50,
        missingAudio: [],
        missingTranslations: [],
        missingWordExplanations: [],
        failedAudio: [],
        repaired: {
          audio: 0,
          translations: 0,
          wordExplanations: 0,
        },
        repairFailed: {
          audio: 0,
          translations: 0,
          wordExplanations: 0,
        },
      },
      stories: {
        checked: 10,
        missingAudio: [],
        missingImages: [],
        stalledDrafts: [],
        repaired: {
          audio: 0,
          images: 0,
        },
        repairFailed: {
          audio: 0,
          images: 0,
        },
      },
      success: true,
      ...overrides,
    }
  }

  static createSuccessfulIntegrityLog(): MockIntegrityLog {
    return this.createIntegrityLog({
      newsArticles: {
        checked: 100,
        missingAudio: ['article-1', 'article-2'],
        missingTranslations: ['article-3'],
        missingWordExplanations: [],
        failedAudio: [],
        repaired: {
          audio: 2,
          translations: 1,
          wordExplanations: 0,
        },
        repairFailed: {
          audio: 0,
          translations: 0,
          wordExplanations: 0,
        },
      },
      stories: {
        checked: 20,
        missingAudio: ['story-1'],
        missingImages: [],
        stalledDrafts: [],
        repaired: {
          audio: 1,
          images: 0,
        },
        repairFailed: {
          audio: 0,
          images: 0,
        },
      },
    })
  }

  static createFailedIntegrityLog(): MockIntegrityLog {
    return this.createIntegrityLog({
      success: false,
      error: 'TTS API error: rate limit exceeded',
      newsArticles: {
        checked: 50,
        missingAudio: ['article-1', 'article-2', 'article-3'],
        missingTranslations: [],
        missingWordExplanations: [],
        failedAudio: ['article-1', 'article-2'],
        repaired: {
          audio: 1,
          translations: 0,
          wordExplanations: 0,
        },
        repairFailed: {
          audio: 2,
          translations: 0,
          wordExplanations: 0,
        },
      },
      stories: {
        checked: 10,
        missingAudio: [],
        missingImages: [],
        stalledDrafts: [],
        repaired: {
          audio: 0,
          images: 0,
        },
        repairFailed: {
          audio: 0,
          images: 0,
        },
      },
    })
  }

  static createBulkIntegrityLogs(count: number): MockIntegrityLog[] {
    const now = Date.now()
    return Array.from({ length: count }, (_, i) => {
      const timestamp = new Date(now - i * 6 * 60 * 60 * 1000) // 6 hours apart
      const isFailure = i % 5 === 4 // Every 5th log is a failure

      return this.createIntegrityLog({
        timestamp: timestamp.toISOString(),
        type: i % 3 === 0 ? 'manual' : 'scheduled',
        success: !isFailure,
        error: isFailure ? 'Simulated failure' : undefined,
      })
    })
  }

  // ============================================================================
  // MISSING CONTENT SCENARIO MOCKS
  // ============================================================================

  static createMissingContentScenario(count: number): {
    articles: MockNewsArticle[]
    stories: MockStory[]
    expectedMissing: {
      audioCount: number
      translationCount: number
      wordExplanationCount: number
      storyAudioCount: number
      storyImageCount: number
    }
  } {
    const missingAudioCount = Math.floor(count * 0.1)
    const missingTranslationCount = Math.floor(count * 0.05)
    const missingWordExplanationCount = Math.floor(count * 0.03)
    const storyCount = Math.floor(count * 0.2)
    const missingStoryAudioCount = Math.floor(storyCount * 0.1)
    const missingStoryImageCount = Math.floor(storyCount * 0.05)

    const articles: MockNewsArticle[] = []
    const stories: MockStory[] = []

    // Create articles with some missing content
    for (let i = 0; i < count; i++) {
      if (i < missingAudioCount) {
        articles.push(this.createNewsArticleWithMissingAudio())
      } else if (i < missingAudioCount + missingTranslationCount) {
        articles.push(this.createNewsArticleWithMissingTranslation())
      } else if (i < missingAudioCount + missingTranslationCount + missingWordExplanationCount) {
        articles.push(this.createNewsArticleWithMissingWordExplanations())
      } else {
        articles.push(this.createNewsArticle())
      }
    }

    // Create stories with some missing content
    for (let i = 0; i < storyCount; i++) {
      if (i < missingStoryAudioCount) {
        stories.push(this.createStoryWithMissingAudio())
      } else if (i < missingStoryAudioCount + missingStoryImageCount) {
        stories.push(this.createStoryWithMissingImages())
      } else {
        stories.push(this.createStory())
      }
    }

    return {
      articles,
      stories,
      expectedMissing: {
        audioCount: missingAudioCount,
        translationCount: missingTranslationCount,
        wordExplanationCount: missingWordExplanationCount,
        storyAudioCount: missingStoryAudioCount,
        storyImageCount: missingStoryImageCount,
      },
    }
  }

  // ============================================================================
  // FIRESTORE MOCK HELPERS
  // ============================================================================

  static createMockFirestoreDoc(data: Record<string, unknown>, exists = true) {
    return {
      exists,
      data: () => data,
      id: this.generateId('doc'),
      ref: {
        delete: jest.fn(),
        update: jest.fn(),
        set: jest.fn(),
      },
    }
  }

  static createMockFirestoreSnapshot(docs: Array<{ data: Record<string, unknown>; id?: string }>) {
    return {
      empty: docs.length === 0,
      size: docs.length,
      docs: docs.map(doc => this.createMockFirestoreDoc(doc.data, true)),
    }
  }

  static createMockTimestamp(date: Date = new Date()) {
    return {
      toMillis: () => date.getTime(),
      toDate: () => date,
    }
  }
}

// Helper functions for common test scenarios
export const createTestScenario = {
  healthyContent: () => ({
    articles: IntegrityMockFactory.createBulkNewsArticles(100),
    stories: IntegrityMockFactory.createBulkStories(20),
  }),

  contentNeedingRepair: () => IntegrityMockFactory.createMissingContentScenario(100),

  highVolumeLoad: () => ({
    articles: IntegrityMockFactory.createBulkNewsArticles(500, {
      missingAudioPercentage: 10,
      missingTranslationPercentage: 5,
      missingWordExplanationsPercentage: 3,
    }),
    stories: IntegrityMockFactory.createBulkStories(100, {
      missingAudioPercentage: 10,
      missingImagesPercentage: 5,
    }),
  }),

  recentLogs: () => IntegrityMockFactory.createBulkIntegrityLogs(50),

  errorCase: () => ({
    article: IntegrityMockFactory.createNewsArticle({ id: '' }),
    story: IntegrityMockFactory.createStory({ id: '' }),
    log: IntegrityMockFactory.createFailedIntegrityLog(),
  }),
}

export default IntegrityMockFactory
