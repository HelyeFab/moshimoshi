/**
 * FlashcardSessionManager
 * Manages session history, analytics, and learning insights
 */

import { openDB, IDBPDatabase } from 'idb';
import type { SessionStats, FlashcardDeck } from '@/types/flashcards';

interface SessionDB {
  sessions: SessionStats;
  analytics: {
    userId: string;
    date: string; // YYYY-MM-DD
    totalSessions: number;
    totalCards: number;
    totalTime: number;
    averageAccuracy: number;
    decksStudied: string[];
  };
}

export interface LearningInsights {
  bestStudyTime: string; // Hour of day (0-23)
  optimalSessionLength: number; // Number of cards
  strongestTopics: string[];
  weakestTopics: string[];
  retentionRate: number;
  learningVelocity: number; // Cards mastered per day
  predictedMasteryDate?: Date;
  streakRisk: boolean;
}

export interface StudyRecommendation {
  deckId: string;
  deckName: string;
  reason: string;
  urgency: 'high' | 'medium' | 'low';
  estimatedTime: number; // minutes
  dueCards: number;
}

export class FlashcardSessionManager {
  private db: IDBPDatabase<SessionDB> | null = null;
  private static instance: FlashcardSessionManager | null = null;

  private constructor() {}

  static getInstance(): FlashcardSessionManager {
    if (!FlashcardSessionManager.instance) {
      FlashcardSessionManager.instance = new FlashcardSessionManager();
    }
    return FlashcardSessionManager.instance;
  }

  // Initialize the session database
  private async initDB(): Promise<IDBPDatabase<SessionDB>> {
    if (this.db) return this.db;

    this.db = await openDB<SessionDB>('FlashcardSessionDB', 1, {
      upgrade(db) {
        // Sessions store
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('userId', 'userId');
          sessionStore.createIndex('deckId', 'deckId');
          sessionStore.createIndex('timestamp', 'timestamp');
          sessionStore.createIndex('date', ['userId', 'timestamp']); // Composite index
        }

        // Daily analytics store
        if (!db.objectStoreNames.contains('analytics')) {
          const analyticsStore = db.createObjectStore('analytics', {
            keyPath: ['userId', 'date']
          });
          analyticsStore.createIndex('userId', 'userId');
          analyticsStore.createIndex('date', 'date');
        }
      }
    });

    return this.db;
  }

  // Save a study session
  async saveSession(session: SessionStats): Promise<void> {
    const db = await this.initDB();

    // Save session
    await db.put('sessions', session);

    // Update daily analytics
    await this.updateDailyAnalytics(session);
  }

  // Update daily analytics
  private async updateDailyAnalytics(session: SessionStats): Promise<void> {
    const db = await this.initDB();
    const date = new Date(session.timestamp).toISOString().split('T')[0];

    try {
      // Get existing analytics for the day
      const existing = await db.get('analytics', [session.userId, date]);

      if (existing) {
        // Update existing record
        existing.totalSessions++;
        existing.totalCards += session.cardsStudied;
        existing.totalTime += session.duration;
        existing.averageAccuracy =
          (existing.averageAccuracy * (existing.totalSessions - 1) + session.accuracy) /
          existing.totalSessions;

        if (!existing.decksStudied.includes(session.deckId)) {
          existing.decksStudied.push(session.deckId);
        }

        await db.put('analytics', existing);
      } else {
        // Create new record
        await db.put('analytics', {
          userId: session.userId,
          date,
          totalSessions: 1,
          totalCards: session.cardsStudied,
          totalTime: session.duration,
          averageAccuracy: session.accuracy,
          decksStudied: [session.deckId]
        });
      }
    } catch (error) {
      console.error('Failed to update daily analytics:', error);
    }
  }

  // Get sessions for a user
  async getUserSessions(
    userId: string,
    limit?: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<SessionStats[]> {
    const db = await this.initDB();
    let sessions = await db.getAllFromIndex('sessions', 'userId', userId);

    // Filter by date range if provided
    if (startDate || endDate) {
      const start = startDate?.getTime() || 0;
      const end = endDate?.getTime() || Date.now();
      sessions = sessions.filter(s => s.timestamp >= start && s.timestamp <= end);
    }

    // Sort by timestamp (newest first)
    sessions.sort((a, b) => b.timestamp - a.timestamp);

    // Apply limit if provided
    if (limit && limit > 0) {
      sessions = sessions.slice(0, limit);
    }

    return sessions;
  }

  // Get deck-specific sessions
  async getDeckSessions(deckId: string, limit?: number): Promise<SessionStats[]> {
    const db = await this.initDB();
    let sessions = await db.getAllFromIndex('sessions', 'deckId', deckId);

    // Sort by timestamp (newest first)
    sessions.sort((a, b) => b.timestamp - a.timestamp);

    // Apply limit if provided
    if (limit && limit > 0) {
      sessions = sessions.slice(0, limit);
    }

    return sessions;
  }

  // Calculate learning insights
  async getLearningInsights(userId: string): Promise<LearningInsights> {
    const sessions = await this.getUserSessions(userId, 100); // Last 100 sessions

    if (sessions.length === 0) {
      return {
        bestStudyTime: '9', // Default to 9 AM
        optimalSessionLength: 20,
        strongestTopics: [],
        weakestTopics: [],
        retentionRate: 0,
        learningVelocity: 0,
        streakRisk: false
      };
    }

    // Calculate best study time (hour with highest accuracy)
    const hourlyPerformance = new Map<number, { accuracy: number; count: number }>();
    sessions.forEach(session => {
      const hour = new Date(session.timestamp).getHours();
      const existing = hourlyPerformance.get(hour) || { accuracy: 0, count: 0 };
      existing.accuracy = (existing.accuracy * existing.count + session.accuracy) / (existing.count + 1);
      existing.count++;
      hourlyPerformance.set(hour, existing);
    });

    let bestHour = 9;
    let bestAccuracy = 0;
    hourlyPerformance.forEach((perf, hour) => {
      if (perf.accuracy > bestAccuracy && perf.count >= 3) { // Minimum 3 sessions
        bestAccuracy = perf.accuracy;
        bestHour = hour;
      }
    });

    // Calculate optimal session length
    const sessionsByLength = new Map<number, { accuracy: number; count: number }>();
    sessions.forEach(session => {
      const lengthBucket = Math.floor(session.cardsStudied / 10) * 10; // Round to nearest 10
      const existing = sessionsByLength.get(lengthBucket) || { accuracy: 0, count: 0 };
      existing.accuracy = (existing.accuracy * existing.count + session.accuracy) / (existing.count + 1);
      existing.count++;
      sessionsByLength.set(lengthBucket, existing);
    });

    let optimalLength = 20;
    let optimalAccuracy = 0;
    sessionsByLength.forEach((perf, length) => {
      if (perf.accuracy > optimalAccuracy && perf.count >= 3) {
        optimalAccuracy = perf.accuracy;
        optimalLength = length || 20;
      }
    });

    // Calculate deck performance
    const deckPerformance = new Map<string, { accuracy: number; count: number; name: string }>();
    sessions.forEach(session => {
      const existing = deckPerformance.get(session.deckId) ||
        { accuracy: 0, count: 0, name: session.deckName };
      existing.accuracy = (existing.accuracy * existing.count + session.accuracy) / (existing.count + 1);
      existing.count++;
      deckPerformance.set(session.deckId, existing);
    });

    // Sort decks by accuracy
    const sortedDecks = Array.from(deckPerformance.entries())
      .filter(([_, perf]) => perf.count >= 3) // Minimum 3 sessions
      .sort((a, b) => b[1].accuracy - a[1].accuracy);

    const strongestTopics = sortedDecks.slice(0, 3).map(([_, perf]) => perf.name);
    const weakestTopics = sortedDecks.slice(-3).reverse().map(([_, perf]) => perf.name);

    // Calculate overall retention rate
    const overallAccuracy = sessions.reduce((sum, s) => sum + s.accuracy, 0) / sessions.length;

    // Calculate learning velocity (cards mastered per day)
    const dateRange = sessions.length > 1
      ? (sessions[0].timestamp - sessions[sessions.length - 1].timestamp) / (1000 * 60 * 60 * 24)
      : 1;
    const totalNewCards = sessions.reduce((sum, s) => sum + s.newCards, 0);
    const velocity = dateRange > 0 ? totalNewCards / dateRange : 0;

    // Check streak risk (no sessions in last 24 hours)
    const lastSessionTime = sessions[0]?.timestamp || 0;
    const hoursSinceLastSession = (Date.now() - lastSessionTime) / (1000 * 60 * 60);
    const streakRisk = hoursSinceLastSession > 20; // Risk if > 20 hours since last session

    return {
      bestStudyTime: bestHour.toString(),
      optimalSessionLength: optimalLength,
      strongestTopics,
      weakestTopics,
      retentionRate: overallAccuracy,
      learningVelocity: velocity,
      streakRisk
    };
  }

  // Get study recommendations
  async getStudyRecommendations(
    userId: string,
    decks: FlashcardDeck[]
  ): Promise<StudyRecommendation[]> {
    const recommendations: StudyRecommendation[] = [];
    const insights = await this.getLearningInsights(userId);
    const recentSessions = await this.getUserSessions(userId, 10);

    // Get recently studied deck IDs
    const recentDeckIds = new Set(recentSessions.map(s => s.deckId));

    for (const deck of decks) {
      let urgency: 'high' | 'medium' | 'low' = 'low';
      const reasons: string[] = [];

      // Count due cards
      const now = Date.now();
      const dueCards = deck.cards.filter(card => {
        if (!card.metadata?.status || card.metadata.status === 'new') return true;
        return card.metadata.nextReview && card.metadata.nextReview <= now;
      }).length;

      if (dueCards === 0) continue; // Skip decks with no due cards

      // High urgency: Many overdue cards
      const overdueCards = deck.cards.filter(card => {
        if (!card.metadata?.nextReview) return false;
        const overdueDays = (now - card.metadata.nextReview) / (1000 * 60 * 60 * 24);
        return overdueDays > 1;
      }).length;

      if (overdueCards > 10) {
        urgency = 'high';
        reasons.push(`${overdueCards} overdue cards need immediate attention`);
      } else if (overdueCards > 5) {
        urgency = 'medium';
        reasons.push(`${overdueCards} cards are overdue`);
      }

      // Check if it's a weak topic
      if (insights.weakestTopics.includes(deck.name)) {
        urgency = urgency === 'low' ? 'medium' : urgency;
        reasons.push('This is one of your challenging topics');
      }

      // Check if not studied recently
      if (!recentDeckIds.has(deck.id) && dueCards > 0) {
        urgency = urgency === 'low' ? 'medium' : urgency;
        reasons.push('You haven\'t studied this deck recently');
      }

      // Estimate study time (3 seconds per card average)
      const estimatedTime = Math.ceil((dueCards * 3) / 60);

      if (reasons.length === 0) {
        reasons.push(`${dueCards} cards ready for review`);
      }

      recommendations.push({
        deckId: deck.id,
        deckName: deck.name,
        reason: reasons.join('. '),
        urgency,
        estimatedTime,
        dueCards
      });
    }

    // Sort by urgency and due cards
    recommendations.sort((a, b) => {
      const urgencyOrder = { high: 3, medium: 2, low: 1 };
      if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
        return urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
      }
      return b.dueCards - a.dueCards;
    });

    return recommendations.slice(0, 5); // Return top 5 recommendations
  }

  // Calculate streak from sessions
  async calculateStreak(userId: string): Promise<number> {
    const sessions = await this.getUserSessions(userId, 100);
    if (sessions.length === 0) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let streak = 0;
    let currentDate = new Date(today);

    // Check each day going backwards
    for (let i = 0; i < 30; i++) { // Check last 30 days max
      const dayStart = currentDate.getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;

      const hasSession = sessions.some(
        s => s.timestamp >= dayStart && s.timestamp < dayEnd
      );

      if (hasSession) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else if (i === 0) {
        // Today - no session yet, check yesterday
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break; // Streak broken
      }
    }

    return streak;
  }

  // Get heatmap data for a year
  async getHeatmapData(userId: string): Promise<Map<string, number>> {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const sessions = await this.getUserSessions(userId, undefined, oneYearAgo);
    const heatmap = new Map<string, number>();

    sessions.forEach(session => {
      const date = new Date(session.timestamp).toISOString().split('T')[0];
      heatmap.set(date, (heatmap.get(date) || 0) + session.cardsStudied);
    });

    return heatmap;
  }

  // Clear old sessions (retention policy)
  async clearOldSessions(userId: string, daysToKeep: number = 365): Promise<number> {
    const db = await this.initDB();
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);

    const sessions = await db.getAllFromIndex('sessions', 'userId', userId);
    let deletedCount = 0;

    for (const session of sessions) {
      if (session.timestamp < cutoffTime) {
        await db.delete('sessions', session.id);
        deletedCount++;
      }
    }

    return deletedCount;
  }
}

// Export singleton instance
export const sessionManager = FlashcardSessionManager.getInstance();