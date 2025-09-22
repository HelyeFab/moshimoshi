/**
 * Analytics service interface for tracking review session events
 */

import { ReviewSession, ReviewSessionItem, SessionStatistics } from '../core/session.types';
import { ReviewEvent } from '../core/events';
import { reviewLogger } from '@/lib/monitoring/logger';

/**
 * Interface for analytics service implementation
 */
export interface IAnalyticsService {
  /**
   * Track session start
   */
  trackSessionStart(session: ReviewSession): Promise<void>;
  
  /**
   * Track individual answer
   */
  trackAnswer(item: ReviewSessionItem): Promise<void>;
  
  /**
   * Track session completion
   */
  trackSessionComplete(session: ReviewSession, statistics: SessionStatistics): Promise<void>;
  
  /**
   * Track generic event
   */
  trackEvent(event: ReviewEvent): Promise<void>;
  
  /**
   * Track performance metrics
   */
  trackPerformance(metric: string, value: number, metadata?: Record<string, any>): Promise<void>;
}

/**
 * Mock implementation of analytics service for development
 */
export class MockAnalyticsService implements IAnalyticsService {
  private events: ReviewEvent[] = [];
  private enabled: boolean;
  
  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }
  
  async trackSessionStart(session: ReviewSession): Promise<void> {
    if (!this.enabled) return;
    
    reviewLogger.info('[Analytics] Session started:', {
      id: session.id,
      userId: session.userId,
      mode: session.mode,
      itemCount: session.items.length,
      source: session.source
    });
  }
  
  async trackAnswer(item: ReviewSessionItem): Promise<void> {
    if (!this.enabled) return;
    
    reviewLogger.info('[Analytics] Answer tracked:', {
      contentId: item.content.id,
      correct: item.correct,
      responseTime: item.responseTime,
      confidence: item.confidence,
      hintsUsed: item.hintsUsed
    });
  }
  
  async trackSessionComplete(session: ReviewSession, statistics: SessionStatistics): Promise<void> {
    if (!this.enabled) return;
    
    reviewLogger.info('[Analytics] Session completed:', {
      sessionId: session.id,
      duration: session.endedAt ? session.endedAt.getTime() - session.startedAt.getTime() : 0,
      accuracy: statistics.accuracy,
      totalItems: statistics.totalItems,
      correctItems: statistics.correctItems,
      bestStreak: statistics.bestStreak
    });
  }
  
  async trackEvent(event: ReviewEvent): Promise<void> {
    if (!this.enabled) return;
    
    this.events.push(event);
    reviewLogger.info('[Analytics] Event', { type: event.type, data: event.data });
  }
  
  async trackPerformance(metric: string, value: number, metadata?: Record<string, any>): Promise<void> {
    if (!this.enabled) return;
    
    reviewLogger.info('[Analytics] Performance:', {
      metric,
      value,
      ...metadata
    });
  }
  
  /**
   * Get all tracked events (for testing)
   */
  getEvents(): ReviewEvent[] {
    return [...this.events];
  }
  
  /**
   * Clear tracked events (for testing)
   */
  clearEvents(): void {
    this.events = [];
  }
}

/**
 * Firebase Analytics implementation
 */
export class FirebaseAnalyticsService implements IAnalyticsService {
  constructor(private analytics?: any) {}
  
  async trackSessionStart(session: ReviewSession): Promise<void> {
    if (!this.analytics) return;
    
    try {
      await this.analytics.logEvent('review_session_start', {
        session_id: session.id,
        user_id: session.userId,
        mode: session.mode,
        item_count: session.items.length,
        source: session.source
      });
    } catch (error) {
      reviewLogger.error('[Analytics] Failed to track session start:', error);
    }
  }
  
  async trackAnswer(item: ReviewSessionItem): Promise<void> {
    if (!this.analytics) return;
    
    try {
      await this.analytics.logEvent('review_item_answered', {
        content_id: item.content.id,
        content_type: item.content.contentType,
        correct: item.correct,
        response_time: item.responseTime,
        confidence: item.confidence,
        hints_used: item.hintsUsed,
        attempts: item.attempts,
        score: item.finalScore
      });
    } catch (error) {
      reviewLogger.error('[Analytics] Failed to track answer:', error);
    }
  }
  
  async trackSessionComplete(session: ReviewSession, statistics: SessionStatistics): Promise<void> {
    if (!this.analytics) return;
    
    try {
      const duration = session.endedAt 
        ? session.endedAt.getTime() - session.startedAt.getTime() 
        : 0;
      
      await this.analytics.logEvent('review_session_complete', {
        session_id: session.id,
        user_id: session.userId,
        duration_ms: duration,
        total_items: statistics.totalItems,
        completed_items: statistics.completedItems,
        correct_items: statistics.correctItems,
        accuracy: statistics.accuracy,
        best_streak: statistics.bestStreak,
        total_score: statistics.totalScore,
        avg_response_time: statistics.averageResponseTime
      });
    } catch (error) {
      reviewLogger.error('[Analytics] Failed to track session complete:', error);
    }
  }
  
  async trackEvent(event: ReviewEvent): Promise<void> {
    if (!this.analytics) return;
    
    try {
      await this.analytics.logEvent(event.type.replace('.', '_'), {
        timestamp: event.timestamp.toISOString(),
        session_id: event.sessionId,
        user_id: event.userId,
        ...event.data,
        ...event.metadata
      });
    } catch (error) {
      reviewLogger.error('[Analytics] Failed to track event:', error);
    }
  }
  
  async trackPerformance(metric: string, value: number, metadata?: Record<string, any>): Promise<void> {
    if (!this.analytics) return;
    
    try {
      await this.analytics.logEvent('performance_metric', {
        metric_name: metric,
        metric_value: value,
        timestamp: new Date().toISOString(),
        ...metadata
      });
    } catch (error) {
      reviewLogger.error('[Analytics] Failed to track performance:', error);
    }
  }
}

/**
 * Factory function to create analytics service
 */
export function createAnalyticsService(type: 'mock' | 'firebase' = 'mock', config?: any): IAnalyticsService {
  switch (type) {
    case 'firebase':
      return new FirebaseAnalyticsService(config?.analytics);
    case 'mock':
    default:
      return new MockAnalyticsService(config?.enabled !== false);
  }
}

// Default analytics service instance
export const AnalyticsService = createAnalyticsService(
  process.env.NODE_ENV === 'production' ? 'firebase' : 'mock'
);