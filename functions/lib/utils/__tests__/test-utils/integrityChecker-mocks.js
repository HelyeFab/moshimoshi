"use strict";
/**
 * Mock Factory for Integrity Checker Tests
 * Provides consistent mock data for testing integrity checker functionality
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTestScenario = exports.IntegrityMockFactory = void 0;
class IntegrityMockFactory {
    static resetIdCounter() {
        this.idCounter = 0;
    }
    static generateId(prefix = 'test') {
        return `${prefix}-${++this.idCounter}-${Date.now()}`;
    }
    // ============================================================================
    // NEWS ARTICLE MOCKS
    // ============================================================================
    static createNewsArticle(overrides) {
        const now = new Date();
        return Object.assign({ id: this.generateId('article'), title: 'Test Article Title', source: 'NHK Easy', publishedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000), hasAudio: true, hasTranslation: true, hasWordExplanations: true, audioUrl: '/audio/article.mp3', audioSegments: [{ start: 0, end: 10 }], translation: { en: 'English translation' }, wordExplanations: [{ word: 'テスト', explanation: 'test' }], status: 'published', createdAt: now, updatedAt: now }, overrides);
    }
    static createNewsArticleWithMissingAudio(overrides) {
        return this.createNewsArticle(Object.assign({ hasAudio: false, audioUrl: undefined, audioSegments: undefined }, overrides));
    }
    static createNewsArticleWithMissingTranslation(overrides) {
        return this.createNewsArticle(Object.assign({ hasTranslation: false, translation: undefined }, overrides));
    }
    static createNewsArticleWithMissingWordExplanations(overrides) {
        return this.createNewsArticle(Object.assign({ hasWordExplanations: false, wordExplanations: undefined }, overrides));
    }
    static createBulkNewsArticles(count, options) {
        const { missingAudioPercentage = 0, missingTranslationPercentage = 0, missingWordExplanationsPercentage = 0, } = options || {};
        return Array.from({ length: count }, (_, i) => {
            const shouldMissAudio = i / count < missingAudioPercentage / 100;
            const shouldMissTranslation = i / count < missingTranslationPercentage / 100;
            const shouldMissWordExplanations = i / count < missingWordExplanationsPercentage / 100;
            return this.createNewsArticle({
                hasAudio: !shouldMissAudio,
                audioUrl: shouldMissAudio ? undefined : '/audio/article.mp3',
                hasTranslation: !shouldMissTranslation,
                translation: shouldMissTranslation ? undefined : { en: 'Translation' },
                hasWordExplanations: !shouldMissWordExplanations,
                wordExplanations: shouldMissWordExplanations
                    ? undefined
                    : [{ word: 'test', explanation: 'test' }],
            });
        });
    }
    // ============================================================================
    // STORY MOCKS
    // ============================================================================
    static createStory(overrides) {
        const now = new Date();
        return Object.assign({ id: this.generateId('story'), title: 'Test Story Title', level: 'N5', status: 'published', hasAudio: true, hasImages: true, audioUrls: ['/audio/story-1.mp3', '/audio/story-2.mp3'], imageUrls: ['/images/story-1.jpg', '/images/story-2.jpg'], createdAt: now, updatedAt: now }, overrides);
    }
    static createStoryWithMissingAudio(overrides) {
        return this.createStory(Object.assign({ hasAudio: false, audioUrls: undefined }, overrides));
    }
    static createStoryWithMissingImages(overrides) {
        return this.createStory(Object.assign({ hasImages: false, imageUrls: undefined }, overrides));
    }
    static createStalledDraftStory(overrides) {
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
        return this.createStory(Object.assign({ status: 'draft', updatedAt: hourAgo }, overrides));
    }
    static createBulkStories(count, options) {
        const { missingAudioPercentage = 0, missingImagesPercentage = 0, stalledDraftPercentage = 0, } = options || {};
        return Array.from({ length: count }, (_, i) => {
            const shouldMissAudio = i / count < missingAudioPercentage / 100;
            const shouldMissImages = i / count < missingImagesPercentage / 100;
            const isStalled = i / count < stalledDraftPercentage / 100;
            return this.createStory({
                hasAudio: !shouldMissAudio,
                audioUrls: shouldMissAudio ? undefined : ['/audio/story.mp3'],
                hasImages: !shouldMissImages,
                imageUrls: shouldMissImages ? undefined : ['/images/story.jpg'],
                status: isStalled ? 'draft' : 'published',
                updatedAt: isStalled ? new Date(Date.now() - 2 * 60 * 60 * 1000) : new Date(),
            });
        });
    }
    // ============================================================================
    // INTEGRITY LOG MOCKS
    // ============================================================================
    static createIntegrityLog(overrides) {
        return Object.assign({ id: this.generateId('log'), type: 'scheduled', checkId: `scheduled_${new Date().toISOString().replace(/[:.]/g, '-')}`, timestamp: new Date().toISOString(), duration: 5000 + Math.random() * 10000, newsArticles: {
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
            }, stories: {
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
            }, success: true }, overrides);
    }
    static createSuccessfulIntegrityLog() {
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
        });
    }
    static createFailedIntegrityLog() {
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
        });
    }
    static createBulkIntegrityLogs(count) {
        const now = Date.now();
        return Array.from({ length: count }, (_, i) => {
            const timestamp = new Date(now - i * 6 * 60 * 60 * 1000); // 6 hours apart
            const isFailure = i % 5 === 4; // Every 5th log is a failure
            return this.createIntegrityLog({
                timestamp: timestamp.toISOString(),
                type: i % 3 === 0 ? 'manual' : 'scheduled',
                success: !isFailure,
                error: isFailure ? 'Simulated failure' : undefined,
            });
        });
    }
    // ============================================================================
    // MISSING CONTENT SCENARIO MOCKS
    // ============================================================================
    static createMissingContentScenario(count) {
        const missingAudioCount = Math.floor(count * 0.1);
        const missingTranslationCount = Math.floor(count * 0.05);
        const missingWordExplanationCount = Math.floor(count * 0.03);
        const storyCount = Math.floor(count * 0.2);
        const missingStoryAudioCount = Math.floor(storyCount * 0.1);
        const missingStoryImageCount = Math.floor(storyCount * 0.05);
        const articles = [];
        const stories = [];
        // Create articles with some missing content
        for (let i = 0; i < count; i++) {
            if (i < missingAudioCount) {
                articles.push(this.createNewsArticleWithMissingAudio());
            }
            else if (i < missingAudioCount + missingTranslationCount) {
                articles.push(this.createNewsArticleWithMissingTranslation());
            }
            else if (i < missingAudioCount + missingTranslationCount + missingWordExplanationCount) {
                articles.push(this.createNewsArticleWithMissingWordExplanations());
            }
            else {
                articles.push(this.createNewsArticle());
            }
        }
        // Create stories with some missing content
        for (let i = 0; i < storyCount; i++) {
            if (i < missingStoryAudioCount) {
                stories.push(this.createStoryWithMissingAudio());
            }
            else if (i < missingStoryAudioCount + missingStoryImageCount) {
                stories.push(this.createStoryWithMissingImages());
            }
            else {
                stories.push(this.createStory());
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
        };
    }
    // ============================================================================
    // FIRESTORE MOCK HELPERS
    // ============================================================================
    static createMockFirestoreDoc(data, exists = true) {
        return {
            exists,
            data: () => data,
            id: this.generateId('doc'),
            ref: {
                delete: jest.fn(),
                update: jest.fn(),
                set: jest.fn(),
            },
        };
    }
    static createMockFirestoreSnapshot(docs) {
        return {
            empty: docs.length === 0,
            size: docs.length,
            docs: docs.map(doc => this.createMockFirestoreDoc(doc.data, true)),
        };
    }
    static createMockTimestamp(date = new Date()) {
        return {
            toMillis: () => date.getTime(),
            toDate: () => date,
        };
    }
}
exports.IntegrityMockFactory = IntegrityMockFactory;
IntegrityMockFactory.idCounter = 0;
// Helper functions for common test scenarios
exports.createTestScenario = {
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
};
exports.default = IntegrityMockFactory;
//# sourceMappingURL=integrityChecker-mocks.js.map