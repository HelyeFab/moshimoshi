/**
 * Test Database Utilities for Universal Review Engine
 * Agent 1: Test Architect
 * 
 * Provides in-memory database simulation and test data management
 * for consistent testing across all modules.
 */

import { MockFactory } from './mockFactory';
import {
  ReviewableContent,
  ReviewSession,
  SessionStatistics,
  SRSData,
  ReviewSessionItem,
  ContentType
} from '../../core/interfaces';

interface TestUser {
  id: string;
  email: string;
  reviewItems: Map<string, ReviewableContent & { srsData?: SRSData }>;
  sessions: Map<string, ReviewSession>;
  statistics: Map<string, SessionStatistics>;
  pinnedItems: Set<string>;
  achievements: Set<string>;
}

/**
 * In-memory test database for isolated testing
 */
export class TestDatabase {
  private users: Map<string, TestUser> = new Map();
  private content: Map<string, ReviewableContent> = new Map();
  private sessions: Map<string, ReviewSession> = new Map();
  private statistics: Map<string, SessionStatistics> = new Map();
  
  // Simulate database latency
  private simulateLatency = false;
  private latencyMs = 10;

  constructor(options?: { simulateLatency?: boolean; latencyMs?: number }) {
    this.simulateLatency = options?.simulateLatency || false;
    this.latencyMs = options?.latencyMs || 10;
    this.seedInitialData();
  }

  /**
   * Seed database with initial test data
   */
  private seedInitialData(): void {
    // Seed content library
    this.seedContentLibrary();
    
    // Create test users
    this.createTestUsers();
  }

  /**
   * Seed comprehensive content library
   */
  private seedContentLibrary(): void {
    // Hiragana vowels
    const hiraganaVowels = [
      { char: 'あ', romaji: 'a' },
      { char: 'い', romaji: 'i' },
      { char: 'う', romaji: 'u' },
      { char: 'え', romaji: 'e' },
      { char: 'お', romaji: 'o' }
    ];

    hiraganaVowels.forEach((item, index) => {
      const content = MockFactory.createReviewableContent({
        id: `hiragana_vowel_${index}`,
        contentType: 'kana',
        primaryDisplay: item.char,
        secondaryDisplay: item.romaji,
        primaryAnswer: item.romaji,
        difficulty: 0.1,
        tags: ['hiragana', 'vowel', 'basic'],
        metadata: {
          type: 'vowel',
          row: 'a',
          column: String(index + 1)
        }
      });
      this.content.set(content.id, content);
    });

    // Katakana
    const katakanaBasic = [
      { char: 'ア', romaji: 'a' },
      { char: 'カ', romaji: 'ka' },
      { char: 'サ', romaji: 'sa' },
      { char: 'タ', romaji: 'ta' },
      { char: 'ナ', romaji: 'na' }
    ];

    katakanaBasic.forEach((item, index) => {
      const content = MockFactory.createReviewableContent({
        id: `katakana_basic_${index}`,
        contentType: 'kana',
        primaryDisplay: item.char,
        secondaryDisplay: item.romaji,
        primaryAnswer: item.romaji,
        difficulty: 0.2,
        tags: ['katakana', 'basic'],
        metadata: {
          type: 'consonant',
          script: 'katakana'
        }
      });
      this.content.set(content.id, content);
    });

    // Basic Kanji
    const basicKanji = [
      { char: '日', meanings: ['sun', 'day'], readings: ['hi', 'nichi'] },
      { char: '月', meanings: ['moon', 'month'], readings: ['tsuki', 'getsu'] },
      { char: '水', meanings: ['water'], readings: ['mizu', 'sui'] },
      { char: '火', meanings: ['fire'], readings: ['hi', 'ka'] },
      { char: '木', meanings: ['tree', 'wood'], readings: ['ki', 'moku'] }
    ];

    basicKanji.forEach((item, index) => {
      const content = MockFactory.createReviewableContent({
        id: `kanji_n5_${index}`,
        contentType: 'kanji',
        primaryDisplay: item.char,
        secondaryDisplay: item.meanings.join(', '),
        tertiaryDisplay: `Readings: ${item.readings.join(', ')}`,
        primaryAnswer: item.meanings[0],
        alternativeAnswers: [...item.meanings.slice(1), ...item.readings],
        difficulty: 0.4,
        tags: ['kanji', 'jlpt-n5', 'basic'],
        metadata: {
          meanings: item.meanings,
          onyomi: item.readings.filter(r => r.length > 2),
          kunyomi: item.readings.filter(r => r.length <= 2),
          strokeCount: 4 + index,
          jlpt: 5,
          grade: 1
        }
      });
      this.content.set(content.id, content);
    });

    // Vocabulary
    const vocabulary = [
      { word: '食べる', reading: 'たべる', meaning: 'to eat' },
      { word: '飲む', reading: 'のむ', meaning: 'to drink' },
      { word: '見る', reading: 'みる', meaning: 'to see' },
      { word: '聞く', reading: 'きく', meaning: 'to listen' },
      { word: '話す', reading: 'はなす', meaning: 'to speak' }
    ];

    vocabulary.forEach((item, index) => {
      const content = MockFactory.createReviewableContent({
        id: `vocab_verb_${index}`,
        contentType: 'vocabulary',
        primaryDisplay: item.word,
        secondaryDisplay: item.meaning,
        tertiaryDisplay: item.reading,
        primaryAnswer: item.meaning,
        alternativeAnswers: [item.reading],
        difficulty: 0.5,
        tags: ['vocabulary', 'verb', 'common'],
        metadata: {
          reading: item.reading,
          partOfSpeech: ['verb'],
          jlpt: 5
        }
      });
      this.content.set(content.id, content);
    });

    // Sentences
    const sentences = [
      { 
        japanese: 'おはようございます。',
        reading: 'おはよう ございます',
        translation: 'Good morning (polite)'
      },
      {
        japanese: '元気ですか。',
        reading: 'げんき ですか',
        translation: 'How are you?'
      }
    ];

    sentences.forEach((item, index) => {
      const content = MockFactory.createReviewableContent({
        id: `sentence_greeting_${index}`,
        contentType: 'sentence',
        primaryDisplay: item.japanese,
        secondaryDisplay: item.translation,
        tertiaryDisplay: item.reading,
        primaryAnswer: item.translation,
        difficulty: 0.6,
        tags: ['sentence', 'greeting', 'polite'],
        metadata: {
          reading: item.reading,
          grammar: ['です', 'か'],
          level: 'beginner'
        }
      });
      this.content.set(content.id, content);
    });
  }

  /**
   * Create test users with different states
   */
  private createTestUsers(): void {
    // New user with no progress
    this.createUser({
      id: 'user_new',
      email: 'new@test.com',
      reviewItemsCount: 0,
      sessionsCount: 0
    });

    // Active user with progress
    this.createUser({
      id: 'user_active',
      email: 'active@test.com',
      reviewItemsCount: 20,
      sessionsCount: 5,
      pinnedItemsCount: 10
    });

    // Advanced user with many mastered items
    this.createUser({
      id: 'user_advanced',
      email: 'advanced@test.com',
      reviewItemsCount: 100,
      sessionsCount: 50,
      pinnedItemsCount: 30,
      masteredRatio: 0.6
    });
  }

  /**
   * Create a test user with specified characteristics
   */
  createUser(config: {
    id: string;
    email: string;
    reviewItemsCount?: number;
    sessionsCount?: number;
    pinnedItemsCount?: number;
    masteredRatio?: number;
  }): TestUser {
    const user: TestUser = {
      id: config.id,
      email: config.email,
      reviewItems: new Map(),
      sessions: new Map(),
      statistics: new Map(),
      pinnedItems: new Set(),
      achievements: new Set()
    };

    // Add review items
    if (config.reviewItemsCount) {
      const contentArray = Array.from(this.content.values());
      for (let i = 0; i < Math.min(config.reviewItemsCount, contentArray.length); i++) {
        const content = contentArray[i];
        const srsData = MockFactory.createSRSData({
          status: config.masteredRatio && Math.random() < config.masteredRatio 
            ? 'mastered' 
            : Math.random() < 0.5 ? 'learning' : 'new',
          interval: Math.floor(Math.random() * 30),
          easeFactor: 2.5 + Math.random() * 0.5,
          repetitions: Math.floor(Math.random() * 10)
        });
        
        user.reviewItems.set(content.id, { ...content, srsData });
      }
    }

    // Add pinned items
    if (config.pinnedItemsCount) {
      const items = Array.from(user.reviewItems.keys());
      for (let i = 0; i < Math.min(config.pinnedItemsCount, items.length); i++) {
        user.pinnedItems.add(items[i]);
      }
    }

    // Add sessions
    if (config.sessionsCount) {
      for (let i = 0; i < config.sessionsCount; i++) {
        const session = MockFactory.createReviewSession({
          id: `session_${config.id}_${i}`,
          userId: config.id,
          status: i === 0 ? 'active' : 'completed'
        });
        
        const stats = MockFactory.createSessionStatistics({
          sessionId: session.id
        });
        
        user.sessions.set(session.id, session);
        user.statistics.set(session.id, stats);
      }
    }

    this.users.set(config.id, user);
    return user;
  }

  /**
   * Database operations with optional latency simulation
   */
  private async delay(): Promise<void> {
    if (this.simulateLatency) {
      await new Promise(resolve => setTimeout(resolve, this.latencyMs));
    }
  }

  // User operations
  async getUser(userId: string): Promise<TestUser | undefined> {
    await this.delay();
    return this.users.get(userId);
  }

  async saveUser(user: TestUser): Promise<void> {
    await this.delay();
    this.users.set(user.id, user);
  }

  // Content operations
  async getContent(contentId: string): Promise<ReviewableContent | undefined> {
    await this.delay();
    return this.content.get(contentId);
  }

  async getContentByType(type: ContentType): Promise<ReviewableContent[]> {
    await this.delay();
    return Array.from(this.content.values()).filter(c => c.contentType === type);
  }

  async saveContent(content: ReviewableContent): Promise<void> {
    await this.delay();
    this.content.set(content.id, content);
  }

  // Session operations
  async getSession(sessionId: string): Promise<ReviewSession | undefined> {
    await this.delay();
    return this.sessions.get(sessionId);
  }

  async saveSession(session: ReviewSession): Promise<void> {
    await this.delay();
    this.sessions.set(session.id, session);
  }

  async getUserSessions(userId: string): Promise<ReviewSession[]> {
    await this.delay();
    return Array.from(this.sessions.values()).filter(s => s.userId === userId);
  }

  // Statistics operations
  async getStatistics(sessionId: string): Promise<SessionStatistics | undefined> {
    await this.delay();
    return this.statistics.get(sessionId);
  }

  async saveStatistics(stats: SessionStatistics): Promise<void> {
    await this.delay();
    this.statistics.set(stats.sessionId, stats);
  }

  // Pinning operations
  async getPinnedItems(userId: string): Promise<ReviewableContent[]> {
    await this.delay();
    const user = this.users.get(userId);
    if (!user) return [];
    
    return Array.from(user.pinnedItems)
      .map(id => this.content.get(id))
      .filter((c): c is ReviewableContent => c !== undefined);
  }

  async pinItem(userId: string, contentId: string): Promise<void> {
    await this.delay();
    const user = this.users.get(userId);
    if (user) {
      user.pinnedItems.add(contentId);
    }
  }

  async unpinItem(userId: string, contentId: string): Promise<void> {
    await this.delay();
    const user = this.users.get(userId);
    if (user) {
      user.pinnedItems.delete(contentId);
    }
  }

  // SRS operations
  async getDueItems(userId: string, before: Date = new Date()): Promise<ReviewableContent[]> {
    await this.delay();
    const user = this.users.get(userId);
    if (!user) return [];

    return Array.from(user.reviewItems.values())
      .filter(item => {
        if (!item.srsData) return true;
        return item.srsData.nextReviewAt <= before;
      })
      .map(({ srsData, ...content }) => content);
  }

  async updateSRSData(
    userId: string, 
    contentId: string, 
    srsData: SRSData
  ): Promise<void> {
    await this.delay();
    const user = this.users.get(userId);
    if (user) {
      const item = user.reviewItems.get(contentId);
      if (item) {
        user.reviewItems.set(contentId, { ...item, srsData });
      }
    }
  }

  /**
   * Reset database to initial state
   */
  reset(): void {
    this.users.clear();
    this.content.clear();
    this.sessions.clear();
    this.statistics.clear();
    MockFactory.reset();
    this.seedInitialData();
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.users.clear();
    this.content.clear();
    this.sessions.clear();
    this.statistics.clear();
  }

  /**
   * Get database statistics for debugging
   */
  getStats(): {
    users: number;
    content: number;
    sessions: number;
    statistics: number;
  } {
    return {
      users: this.users.size,
      content: this.content.size,
      sessions: this.sessions.size,
      statistics: this.statistics.size
    };
  }

  /**
   * Export database state for snapshot testing
   */
  exportSnapshot(): {
    users: any[];
    content: any[];
    sessions: any[];
    statistics: any[];
  } {
    return {
      users: Array.from(this.users.entries()),
      content: Array.from(this.content.entries()),
      sessions: Array.from(this.sessions.entries()),
      statistics: Array.from(this.statistics.entries())
    };
  }

  /**
   * Import database state from snapshot
   */
  importSnapshot(snapshot: ReturnType<typeof this.exportSnapshot>): void {
    this.clear();
    
    snapshot.users.forEach(([key, value]) => this.users.set(key, value));
    snapshot.content.forEach(([key, value]) => this.content.set(key, value));
    snapshot.sessions.forEach(([key, value]) => this.sessions.set(key, value));
    snapshot.statistics.forEach(([key, value]) => this.statistics.set(key, value));
  }
}

// Global test database instance
let testDb: TestDatabase | null = null;

/**
 * Get or create test database instance
 */
export function getTestDatabase(options?: {
  simulateLatency?: boolean;
  latencyMs?: number;
}): TestDatabase {
  if (!testDb) {
    testDb = new TestDatabase(options);
  }
  return testDb;
}

/**
 * Reset test database
 */
export function resetTestDatabase(): void {
  if (testDb) {
    testDb.reset();
  }
}

/**
 * Clear test database
 */
export function clearTestDatabase(): void {
  if (testDb) {
    testDb.clear();
    testDb = null;
  }
}