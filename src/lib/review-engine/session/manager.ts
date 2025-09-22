/**
 * Session Manager for the Universal Review Engine
 * Manages review session lifecycle, state, and coordination
 */

import { EventEmitter } from 'events';
import { reviewLogger } from '@/lib/monitoring/logger';
import { 
  ReviewSession, 
  ReviewSessionItem, 
  SessionStatistics,
  CreateSessionOptions
} from '../core/session.types';
import {
  ReviewEvent,
  ReviewEventType,
  SessionStartedPayload,
  ItemAnsweredPayload,
  ProgressUpdatedPayload,
  ItemPresentedPayload,
  ItemSkippedPayload,
  ItemHintUsedPayload,
  SessionPausedPayload,
  SessionResumedPayload,
  SessionCompletedPayload,
  StreakUpdatedPayload
} from '../core/events';
import { ReviewableContent } from '../core/interfaces';
import { ReviewMode, ReviewModeConfig } from '../core/types';
import { SessionError } from '../core/errors';
import { ISessionStorage } from './storage';
import { IAnalyticsService } from './analytics.service';
import { AdapterRegistry } from '../adapters/registry';

/**
 * Answer validation result
 */
interface ValidationResult {
  correct: boolean;
  expectedAnswer: string;
  feedback?: string;
  partialCredit?: number;
}

/**
 * Main session manager class
 */
export class SessionManager extends EventEmitter {
  private session: ReviewSession | null = null;
  private statistics: SessionStatistics | null = null;
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private readonly ACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  private readonly HINT_PENALTIES = [0.1, 0.2, 0.3]; // Progressive hint penalties
  
  constructor(
    private storage: ISessionStorage,
    private analytics: IAnalyticsService
  ) {
    super();
    this.setupEventHandlers();
  }
  
  /**
   * Start a new review session
   */
  async startSession(options: CreateSessionOptions): Promise<ReviewSession> {
    if (this.session?.status === 'active') {
      throw new SessionError('A session is already active', {
        sessionId: this.session.id,
        status: this.session.status
      });
    }
    
    const sessionId = this.generateSessionId();
    const items = options.shuffle ? this.shuffleItems(options.items) : options.items;
    
    this.session = {
      id: sessionId,
      userId: options.userId,
      startedAt: new Date(),
      lastActivityAt: new Date(),
      items: items.map(content => this.createSessionItem(content)),
      currentIndex: 0,
      mode: options.mode,
      config: { ...this.getDefaultConfig(options.mode), ...options.config },
      status: 'active',
      source: options.source,
      tags: options.tags,
      metadata: options.metadata
    };
    
    // Initialize statistics
    this.statistics = this.initializeStatistics(sessionId, items.length);
    
    // Persist to storage
    await this.storage.saveSession(this.session);
    
    // Start activity timer
    this.startActivityTimer();
    
    // Emit event
    this.emitEvent(ReviewEventType.SESSION_STARTED, {
      sessionId,
      itemCount: items.length,
      mode: options.mode,
      source: options.source,
      contentTypes: [...new Set(items.map(i => i.contentType))]
    } as SessionStartedPayload);
    
    // Track analytics
    await this.analytics.trackSessionStart(this.session);
    
    return this.session;
  }
  
  /**
   * Get current item for review
   */
  getCurrentItem(): ReviewSessionItem | null {
    if (!this.session || this.session.currentIndex >= this.session.items.length) {
      return null;
    }
    
    const item = this.session.items[this.session.currentIndex];
    
    if (!item.presentedAt) {
      item.presentedAt = new Date();
      this.emitEvent(ReviewEventType.ITEM_PRESENTED, {
        itemId: item.content.id,
        contentType: item.content.contentType,
        index: this.session.currentIndex,
        total: this.session.items.length,
        difficulty: item.content.difficulty
      } as ItemPresentedPayload);
    }
    
    return item;
  }
  
  /**
   * Submit answer for current item
   */
  async submitAnswer(
    answer: string,
    confidence?: 1 | 2 | 3 | 4 | 5
  ): Promise<ValidationResult> {
    if (!this.session || this.session.status !== 'active') {
      throw new SessionError('No active session');
    }
    
    const item = this.getCurrentItem();
    if (!item) {
      throw new SessionError('No current item');
    }
    
    // Record answer timing
    item.answeredAt = new Date();
    item.responseTime = item.answeredAt.getTime() - item.presentedAt!.getTime();
    item.userAnswer = answer;
    item.confidence = confidence;
    item.attempts++;
    
    // Validate answer
    const validation = await this.validateAnswer(item, answer);
    item.correct = validation.correct;
    
    // Calculate scores
    item.baseScore = this.calculateBaseScore(item);
    item.finalScore = this.applyModifiers(item);
    
    // Update statistics
    this.updateStatistics(item);
    
    // Update spaced repetition intervals if applicable
    this.updateSpacedRepetition(item);
    
    // Persist changes
    await this.storage.updateSession(this.session);
    
    // Calculate next review date if correct
    let nextReviewAt: Date | undefined;
    let srsData: any = undefined;

    if (validation.correct && item.content.srsData) {
      // Calculate next review based on SRS data
      const intervalDays = item.content.srsData.interval || 1;
      nextReviewAt = new Date();
      nextReviewAt.setTime(nextReviewAt.getTime() + intervalDays * 24 * 60 * 60 * 1000);

      srsData = {
        interval: item.content.srsData.interval,
        repetitions: item.content.srsData.repetitions,
        easeFactor: item.content.srsData.easeFactor,
        status: item.content.srsData.status
      };
    }

    // Emit event with SRS data
    this.emitEvent(ReviewEventType.ITEM_ANSWERED, {
      itemId: item.content.id,
      correct: validation.correct,
      responseTime: item.responseTime,
      userAnswer: answer,
      expectedAnswer: validation.expectedAnswer,
      confidence,
      score: item.finalScore,
      attempts: item.attempts,
      nextReviewAt,
      contentType: item.content.contentType,
      srsData
    } as ItemAnsweredPayload);
    
    // Track analytics
    await this.analytics.trackAnswer(item);
    
    // Reset activity timer
    this.resetActivityTimer();
    
    return validation;
  }
  
  /**
   * Move to next item
   */
  async nextItem(): Promise<ReviewSessionItem | null> {
    if (!this.session) {
      throw new SessionError('No active session');
    }
    
    this.session.currentIndex++;
    this.session.lastActivityAt = new Date();
    
    // Check if session is complete
    if (this.session.currentIndex >= this.session.items.length) {
      await this.completeSession();
      return null;
    }
    
    // Update progress
    this.emitEvent(ReviewEventType.PROGRESS_UPDATED, {
      sessionId: this.session.id,
      current: this.session.currentIndex,
      total: this.session.items.length,
      correct: this.statistics!.correctItems,
      incorrect: this.statistics!.incorrectItems,
      skipped: this.statistics!.skippedItems,
      accuracy: this.statistics!.accuracy,
      streak: this.statistics!.currentStreak,
      score: this.statistics!.totalScore
    } as ProgressUpdatedPayload);
    
    await this.storage.updateSession(this.session);
    
    return this.getCurrentItem();
  }
  
  /**
   * Skip current item
   */
  async skipItem(): Promise<void> {
    if (!this.session) {
      throw new SessionError('No active session');
    }
    
    const item = this.getCurrentItem();
    if (item) {
      item.skipped = true;
      this.statistics!.skippedItems++;
      
      this.emitEvent(ReviewEventType.ITEM_SKIPPED, {
        itemId: item.content.id,
        index: this.session.currentIndex
      } as ItemSkippedPayload);
    }
    
    await this.nextItem();
  }
  
  /**
   * Pause session
   */
  async pauseSession(): Promise<void> {
    if (!this.session || this.session.status !== 'active') {
      throw new SessionError('No active session to pause');
    }
    
    this.session.status = 'paused';
    this.session.lastActivityAt = new Date();
    
    // Stop timers
    this.stopActivityTimer();
    
    await this.storage.updateSession(this.session);
    
    this.emitEvent(ReviewEventType.SESSION_PAUSED, {
      sessionId: this.session.id,
      currentIndex: this.session.currentIndex,
      timeElapsed: new Date().getTime() - this.session.startedAt.getTime()
    } as SessionPausedPayload);
  }
  
  /**
   * Resume session
   */
  async resumeSession(): Promise<void> {
    if (!this.session || this.session.status !== 'paused') {
      throw new SessionError('No paused session to resume');
    }
    
    // Calculate pause duration based on lastActivityAt
    const now = new Date();
    const pauseDuration = now.getTime() - this.session.lastActivityAt.getTime();
    
    this.session.status = 'active';
    this.session.lastActivityAt = now;
    
    // Restart timers
    this.startActivityTimer();
    
    await this.storage.updateSession(this.session);
    
    this.emitEvent(ReviewEventType.SESSION_RESUMED, {
      sessionId: this.session.id,
      pauseDuration
    } as SessionResumedPayload);
  }
  
  /**
   * Complete session
   */
  async completeSession(): Promise<SessionStatistics> {
    if (!this.session) {
      throw new SessionError('No session to complete');
    }

    this.session.status = 'completed';
    this.session.endedAt = new Date();

    // Calculate final statistics
    this.finalizeStatistics();

    // Stop all timers
    this.stopAllTimers();

    // Persist final state
    await this.storage.updateSession(this.session);
    await this.storage.saveStatistics(this.statistics!);

    // Record daily activity for streak tracking (only in browser environment)
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      this.recordDailyActivity(this.session.userId);
    }

    // Emit completion event
    this.emitEvent(ReviewEventType.SESSION_COMPLETED, {
      sessionId: this.session.id,
      statistics: this.statistics!,
      duration: this.session.endedAt.getTime() - this.session.startedAt.getTime()
    } as SessionCompletedPayload);

    // Track analytics
    await this.analytics.trackSessionComplete(this.session, this.statistics!);

    // Check for achievements
    await this.checkAchievements();

    const stats = this.statistics!;

    // Clear session
    this.session = null;
    this.statistics = null;

    return stats;
  }
  
  /**
   * Abandon session
   */
  async abandonSession(): Promise<void> {
    if (!this.session) {
      throw new SessionError('No session to abandon');
    }
    
    this.session.status = 'abandoned';
    this.session.endedAt = new Date();
    
    this.stopAllTimers();
    
    await this.storage.updateSession(this.session);
    
    this.emitEvent(ReviewEventType.SESSION_ABANDONED, {
      sessionId: this.session.id,
      reason: 'user_action',
      currentIndex: this.session.currentIndex,
      completionPercentage: (this.session.currentIndex / this.session.items.length) * 100
    });
    
    this.session = null;
    this.statistics = null;
  }
  
  /**
   * Get session progress
   */
  getProgress(): {
    current: number;
    total: number;
    percentage: number;
    timeElapsed: number;
    estimatedTimeRemaining: number;
  } {
    if (!this.session) {
      throw new SessionError('No active session');
    }
    
    const current = this.session.currentIndex;
    const total = this.session.items.length;
    const percentage = Math.round((current / total) * 100);
    
    const timeElapsed = Date.now() - this.session.startedAt.getTime();
    const avgTimePerItem = current > 0 ? timeElapsed / current : 30000; // Default 30s
    const estimatedTimeRemaining = (total - current) * avgTimePerItem;
    
    return {
      current,
      total,
      percentage,
      timeElapsed,
      estimatedTimeRemaining
    };
  }
  
  /**
   * Get current statistics
   */
  getStatistics(): SessionStatistics | null {
    return this.statistics;
  }
  
  /**
   * Get current session
   */
  getSession(): ReviewSession | null {
    return this.session;
  }
  
  /**
   * Use hint for current item
   */
  async useHint(): Promise<string> {
    const item = this.getCurrentItem();
    if (!item) {
      throw new SessionError('No current item');
    }
    
    item.hintsUsed++;
    const hintLevel = Math.min(item.hintsUsed, 3) as 1 | 2 | 3;
    
    // Get hint from content adapter
    const adapter = AdapterRegistry.getAdapter(item.content.contentType);
    const hints = adapter.generateHints(item.content);
    const hint = hints[Math.min(item.hintsUsed - 1, hints.length - 1)] || 'No more hints available';
    
    // Apply penalty
    const penalty = this.HINT_PENALTIES[hintLevel - 1] || 0.3;
    
    this.emitEvent(ReviewEventType.ITEM_HINT_USED, {
      itemId: item.content.id,
      hintLevel,
      hintContent: hint,
      penaltyApplied: penalty
    } as ItemHintUsedPayload);
    
    return hint;
  }
  
  // Private methods
  
  private setupEventHandlers(): void {
    // Set up internal event handlers if needed
  }
  
  private createSessionItem(content: ReviewableContent): ReviewSessionItem {
    return {
      content,
      presentedAt: undefined as any, // Will be set when presented
      answeredAt: undefined,
      responseTime: undefined,
      userAnswer: undefined,
      correct: undefined,
      confidence: undefined,
      hintsUsed: 0,
      attempts: 0,
      baseScore: 100,
      finalScore: 100
    };
  }
  
  private initializeStatistics(sessionId: string, totalItems: number): SessionStatistics {
    return {
      sessionId,
      totalItems,
      completedItems: 0,
      correctItems: 0,
      incorrectItems: 0,
      skippedItems: 0,
      accuracy: 0,
      averageResponseTime: 0,
      totalTime: 0,
      currentStreak: 0,
      bestStreak: 0,
      performanceByDifficulty: {
        easy: { correct: 0, total: 0, avgTime: 0 },
        medium: { correct: 0, total: 0, avgTime: 0 },
        hard: { correct: 0, total: 0, avgTime: 0 }
      },
      performanceByMode: {},
      totalScore: 0,
      maxPossibleScore: totalItems * 100,
      totalHintsUsed: 0,
      averageHintsPerItem: 0
    };
  }
  
  private async validateAnswer(item: ReviewSessionItem, answer: string): Promise<ValidationResult> {
    const content = item.content;
    const expectedAnswer = content.primaryAnswer;
    
    // Check exact match first
    if (answer.toLowerCase() === expectedAnswer.toLowerCase()) {
      return { correct: true, expectedAnswer };
    }
    
    // Check alternative answers
    if (content.alternativeAnswers) {
      for (const alt of content.alternativeAnswers) {
        if (answer.toLowerCase() === alt.toLowerCase()) {
          return { correct: true, expectedAnswer: alt };
        }
      }
    }
    
    // Fuzzy matching for longer content
    if (expectedAnswer.length > 10) {
      const similarity = this.calculateSimilarity(answer, expectedAnswer);
      if (similarity > 0.8) {
        return {
          correct: true,
          expectedAnswer,
          feedback: 'Close enough!',
          partialCredit: similarity
        };
      }
    }
    
    return {
      correct: false,
      expectedAnswer,
      feedback: 'Incorrect answer'
    };
  }
  
  private calculateSimilarity(a: string, b: string): number {
    // Levenshtein distance implementation
    const matrix: number[][] = [];
    
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    const distance = matrix[b.length][a.length];
    const maxLength = Math.max(a.length, b.length);
    return 1 - (distance / maxLength);
  }
  
  private calculateBaseScore(item: ReviewSessionItem): number {
    let score = 100;
    
    // Deduct for incorrect answers
    if (!item.correct) return 0;
    
    // Response time bonus/penalty
    if (item.responseTime) {
      if (item.responseTime < 2000) score += 10; // Very fast
      else if (item.responseTime < 5000) score += 5; // Fast
      else if (item.responseTime > 30000) score -= 10; // Slow
    }
    
    // Difficulty bonus
    score += Math.floor(item.content.difficulty * 20);
    
    return Math.max(0, Math.min(100, score));
  }
  
  private applyModifiers(item: ReviewSessionItem): number {
    let score = item.baseScore;
    
    // Hint penalties
    if (item.hintsUsed > 0) {
      const totalPenalty = this.HINT_PENALTIES
        .slice(0, item.hintsUsed)
        .reduce((sum, p) => sum + p, 0);
      score *= (1 - totalPenalty);
    }
    
    // Attempt penalties
    if (item.attempts > 1) {
      score *= Math.pow(0.9, item.attempts - 1);
    }
    
    // Confidence bonus
    if (item.confidence && item.correct) {
      score *= (1 + (item.confidence - 3) * 0.05);
    }
    
    return Math.max(0, Math.round(score));
  }
  
  private updateStatistics(item: ReviewSessionItem): void {
    if (!this.statistics) return;
    
    this.statistics.completedItems++;
    
    if (item.correct) {
      this.statistics.correctItems++;
      this.statistics.currentStreak++;
      this.statistics.bestStreak = Math.max(
        this.statistics.bestStreak,
        this.statistics.currentStreak
      );
    } else {
      this.statistics.incorrectItems++;
      this.statistics.currentStreak = 0;
    }
    
    // Update accuracy
    this.statistics.accuracy = Math.round(
      (this.statistics.correctItems / this.statistics.completedItems) * 100
    );
    
    // Update average response time
    const totalResponseTime = this.session!.items
      .filter(i => i.responseTime)
      .reduce((sum, i) => sum + i.responseTime!, 0);
    
    this.statistics.averageResponseTime = Math.round(
      totalResponseTime / this.statistics.completedItems
    );
    
    // Update score
    this.statistics.totalScore += item.finalScore;
    
    // Update hints
    this.statistics.totalHintsUsed += item.hintsUsed;
    this.statistics.averageHintsPerItem = 
      this.statistics.totalHintsUsed / this.statistics.completedItems;
    
    // Update difficulty statistics
    const difficulty = this.getDifficultyCategory(item.content.difficulty);
    this.statistics.performanceByDifficulty[difficulty].total++;
    if (item.correct) {
      this.statistics.performanceByDifficulty[difficulty].correct++;
    }
    if (item.responseTime) {
      const current = this.statistics.performanceByDifficulty[difficulty].avgTime;
      const count = this.statistics.performanceByDifficulty[difficulty].total;
      this.statistics.performanceByDifficulty[difficulty].avgTime = 
        (current * (count - 1) + item.responseTime) / count;
    }
    
    // Emit streak update if milestone
    if (this.statistics.currentStreak % 5 === 0 && this.statistics.currentStreak > 0) {
      this.emitEvent(ReviewEventType.STREAK_UPDATED, {
        current: this.statistics.currentStreak,
        best: this.statistics.bestStreak,
        type: 'session'
      } as StreakUpdatedPayload);
    }
  }
  
  private getDifficultyCategory(difficulty: number): 'easy' | 'medium' | 'hard' {
    if (difficulty < 0.33) return 'easy';
    if (difficulty < 0.67) return 'medium';
    return 'hard';
  }
  
  private updateSpacedRepetition(item: ReviewSessionItem): void {
    // SuperMemo SM-2 algorithm
    const quality = item.correct 
      ? Math.max(0, Math.min(5, 3 + (item.confidence || 3) - 3))
      : 0;
    
    if (!item.easeFactor) {
      item.easeFactor = 2.5;
    }
    
    item.easeFactor = Math.max(1.3, 
      item.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    );
    
    if (quality < 3) {
      item.nextInterval = 1;
    } else {
      if (!item.previousInterval) {
        item.nextInterval = 1;
      } else if (item.previousInterval === 1) {
        item.nextInterval = 6;
      } else {
        item.nextInterval = Math.round(item.previousInterval * item.easeFactor);
      }
    }
  }
  
  private finalizeStatistics(): void {
    if (!this.statistics || !this.session) return;
    
    this.statistics.totalTime = this.session.endedAt!.getTime() - this.session.startedAt.getTime();
  }
  
  private async checkAchievements(): Promise<void> {
    // Check for various achievements
    if (this.statistics!.accuracy === 100 && this.statistics!.totalItems >= 10) {
      this.emitEvent(ReviewEventType.ACHIEVEMENT_UNLOCKED, {
        achievementId: 'perfect_session',
        achievementName: 'Perfect Session',
        description: 'Complete a session with 100% accuracy',
        category: 'accuracy',
        points: 100
      });
    }
    
    if (this.statistics!.bestStreak >= 20) {
      this.emitEvent(ReviewEventType.ACHIEVEMENT_UNLOCKED, {
        achievementId: 'streak_master',
        achievementName: 'Streak Master',
        description: 'Achieve a 20+ answer streak',
        category: 'streak',
        points: 50
      });
    }
  }
  
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private getDefaultConfig(mode: ReviewMode): ReviewModeConfig {
    // Return default config for the mode
    return {
      mode,
      showPrimary: true,
      showSecondary: mode === 'recall',
      showTertiary: false,
      showMedia: true,
      inputType: mode === 'recall' ? 'text' : 'multiple-choice',
      optionCount: 4,
      allowHints: true,
      hintPenalty: 0.1,
      autoPlayAudio: mode === 'listening'
    };
  }
  
  private shuffleItems<T>(items: T[]): T[] {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
  
  private emitEvent<T>(type: ReviewEventType, data: T): void {
    const event: ReviewEvent<T> = {
      type,
      timestamp: new Date(),
      sessionId: this.session?.id,
      userId: this.session?.userId,
      data
    };
    
    this.emit(type, event);
    
    // Also track to analytics
    this.analytics.trackEvent(event).catch(error => {
      reviewLogger.error('Failed to track analytics event:', error);
    });
  }
  
  private startActivityTimer(): void {
    this.stopActivityTimer();
    
    const timer = setTimeout(() => {
      this.handleActivityTimeout();
    }, this.ACTIVITY_TIMEOUT);
    
    this.timers.set('activity', timer);
  }
  
  private resetActivityTimer(): void {
    this.startActivityTimer();
  }
  
  private stopActivityTimer(): void {
    const timer = this.timers.get('activity');
    if (timer) {
      clearTimeout(timer);
      this.timers.delete('activity');
    }
  }
  
  private stopAllTimers(): void {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
  }
  
  private handleActivityTimeout(): void {
    this.emitEvent(ReviewEventType.TIMEOUT_WARNING, {
      sessionId: this.session?.id,
      timeRemaining: 60000,
      action: 'warning'
    });

    // Set final timeout
    const finalTimer = setTimeout(() => {
      this.pauseSession().catch(error => {
        reviewLogger.error('Failed to pause session:', error);
      });
    }, 60000);

    this.timers.set('final', finalTimer);
  }

  /**
   * Record daily activity for streak tracking
   * Records that the user has completed a learning session today
   */
  private recordDailyActivity(userId: string): void {
    try {
      const today = new Date().toISOString().split('T')[0];
      const activities = JSON.parse(
        localStorage.getItem(`activities_${userId}`) || '{}'
      );
      activities[today] = true;
      localStorage.setItem(`activities_${userId}`, JSON.stringify(activities));

      reviewLogger.info('Daily activity recorded', { userId, date: today });
    } catch (error) {
      // Don't fail the session if activity recording fails
      reviewLogger.error('Failed to record daily activity:', error);
    }
  }
}