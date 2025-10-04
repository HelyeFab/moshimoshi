# Module 3: Session Management

**Status**: 🔴 Not Started  
**Priority**: HIGH  
**Owner**: Agent 3  
**Dependencies**: Core Interfaces (Module 1)  
**Estimated Time**: 5-6 hours  

## Overview
Implement session state management, persistence, analytics tracking, and progress calculation. This module is the brain of the review engine, orchestrating the review flow and maintaining state.

## Deliverables

### 1. Session Manager Class

```typescript
// lib/review-engine/session/manager.ts

import { EventEmitter } from 'events';
import { 
  ReviewSession, 
  ReviewSessionItem, 
  SessionStatistics,
  ReviewEvent,
  ReviewEventType,
  ReviewableContent,
  ReviewMode
} from '../core/interfaces';

export class SessionManager extends EventEmitter {
  private session: ReviewSession | null = null;
  private statistics: SessionStatistics | null = null;
  private timers: Map<string, NodeJS.Timeout> = new Map();
  
  constructor(
    private storage: SessionStorage,
    private analytics: AnalyticsService
  ) {
    super();
    this.setupEventHandlers();
  }
  
  /**
   * Start a new review session
   */
  async startSession(
    userId: string,
    items: ReviewableContent[],
    mode: ReviewMode,
    config?: Partial<ReviewModeConfig>
  ): Promise<ReviewSession> {
    if (this.session?.status === 'active') {
      throw new SessionError('A session is already active');
    }
    
    const sessionId = this.generateSessionId();
    
    this.session = {
      id: sessionId,
      userId,
      startedAt: new Date(),
      lastActivityAt: new Date(),
      items: items.map(content => this.createSessionItem(content)),
      currentIndex: 0,
      mode,
      config: { ...this.getDefaultConfig(mode), ...config },
      status: 'active',
      source: 'manual'
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
      mode,
      source: 'manual'
    });
    
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
        index: this.session.currentIndex
      });
    }
    
    return item;
  }
  
  /**
   * Submit answer for current item
   */
  async submitAnswer(
    answer: string,
    confidence?: 1 | 2 | 3 | 4 | 5
  ): Promise<{
    correct: boolean;
    expectedAnswer: string;
    feedback?: string;
  }> {
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
    
    // Update spaced repetition intervals
    if (this.session.config.spacedRepetition) {
      this.updateSpacedRepetition(item);
    }
    
    // Persist changes
    await this.storage.updateSession(this.session);
    
    // Emit event
    this.emitEvent(ReviewEventType.ITEM_ANSWERED, {
      itemId: item.content.id,
      correct: validation.correct,
      responseTime: item.responseTime,
      userAnswer: answer,
      expectedAnswer: validation.expectedAnswer,
      confidence
    });
    
    // Track analytics
    await this.analytics.trackAnswer(item);
    
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
      accuracy: this.statistics!.accuracy,
      streak: this.statistics!.currentStreak
    });
    
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
        itemId: item.content.id
      });
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
    this.session.pausedAt = new Date();
    
    // Stop timers
    this.stopActivityTimer();
    
    await this.storage.updateSession(this.session);
    
    this.emitEvent(ReviewEventType.SESSION_PAUSED, {
      sessionId: this.session.id
    });
  }
  
  /**
   * Resume session
   */
  async resumeSession(): Promise<void> {
    if (!this.session || this.session.status !== 'paused') {
      throw new SessionError('No paused session to resume');
    }
    
    this.session.status = 'active';
    delete this.session.pausedAt;
    
    // Restart timers
    this.startActivityTimer();
    
    await this.storage.updateSession(this.session);
    
    this.emitEvent(ReviewEventType.SESSION_RESUMED, {
      sessionId: this.session.id
    });
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
    
    // Emit completion event
    this.emitEvent(ReviewEventType.SESSION_COMPLETED, {
      sessionId: this.session.id,
      statistics: this.statistics
    });
    
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
      sessionId: this.session.id
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
   * Use hint for current item
   */
  async useHint(): Promise<string> {
    const item = this.getCurrentItem();
    if (!item) {
      throw new SessionError('No current item');
    }
    
    item.hintsUsed++;
    
    // Get hint from content
    const hints = item.content.metadata?.hints || [];
    const hint = hints[Math.min(item.hintsUsed - 1, hints.length - 1)];
    
    this.emitEvent(ReviewEventType.ITEM_HINT_USED, {
      itemId: item.content.id,
      hintNumber: item.hintsUsed
    });
    
    return hint || 'No more hints available';
  }
  
  // Private methods
  
  private createSessionItem(content: ReviewableContent): ReviewSessionItem {
    return {
      content,
      presentedAt: undefined,
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
        easy: { correct: 0, total: 0 },
        medium: { correct: 0, total: 0 },
        hard: { correct: 0, total: 0 }
      },
      performanceByMode: {}
    };
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
    
    // Update difficulty statistics
    const difficulty = this.getDifficultyCategory(item.content.difficulty);
    this.statistics.performanceByDifficulty[difficulty].total++;
    if (item.correct) {
      this.statistics.performanceByDifficulty[difficulty].correct++;
    }
    
    // Emit streak update if milestone
    if (this.statistics.currentStreak % 5 === 0 && this.statistics.currentStreak > 0) {
      this.emitEvent(ReviewEventType.STREAK_UPDATED, {
        current: this.statistics.currentStreak,
        best: this.statistics.bestStreak
      });
    }
  }
  
  private getDifficultyCategory(difficulty: number): 'easy' | 'medium' | 'hard' {
    if (difficulty < 0.33) return 'easy';
    if (difficulty < 0.67) return 'medium';
    return 'hard';
  }
  
  // ... Additional private methods
}
```

### 2. Session Storage

```typescript
// lib/review-engine/session/storage.ts

import { ReviewSession, SessionStatistics } from '../core/interfaces';

export interface SessionStorage {
  saveSession(session: ReviewSession): Promise<void>;
  updateSession(session: ReviewSession): Promise<void>;
  loadSession(sessionId: string): Promise<ReviewSession | null>;
  deleteSession(sessionId: string): Promise<void>;
  
  saveStatistics(stats: SessionStatistics): Promise<void>;
  loadStatistics(sessionId: string): Promise<SessionStatistics | null>;
  
  getUserSessions(userId: string, limit?: number): Promise<ReviewSession[]>;
  getActiveSession(userId: string): Promise<ReviewSession | null>;
}

export class LocalSessionStorage implements SessionStorage {
  private readonly SESSION_KEY = 'review_sessions';
  private readonly STATS_KEY = 'review_statistics';
  
  async saveSession(session: ReviewSession): Promise<void> {
    const sessions = await this.getAllSessions();
    sessions[session.id] = session;
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(sessions));
  }
  
  async updateSession(session: ReviewSession): Promise<void> {
    await this.saveSession(session);
  }
  
  async loadSession(sessionId: string): Promise<ReviewSession | null> {
    const sessions = await this.getAllSessions();
    const session = sessions[sessionId];
    
    if (session) {
      // Restore dates
      session.startedAt = new Date(session.startedAt);
      session.lastActivityAt = new Date(session.lastActivityAt);
      if (session.endedAt) {
        session.endedAt = new Date(session.endedAt);
      }
    }
    
    return session || null;
  }
  
  async deleteSession(sessionId: string): Promise<void> {
    const sessions = await this.getAllSessions();
    delete sessions[sessionId];
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(sessions));
  }
  
  async saveStatistics(stats: SessionStatistics): Promise<void> {
    const allStats = await this.getAllStatistics();
    allStats[stats.sessionId] = stats;
    localStorage.setItem(this.STATS_KEY, JSON.stringify(allStats));
  }
  
  async loadStatistics(sessionId: string): Promise<SessionStatistics | null> {
    const allStats = await this.getAllStatistics();
    return allStats[sessionId] || null;
  }
  
  async getUserSessions(userId: string, limit = 10): Promise<ReviewSession[]> {
    const sessions = await this.getAllSessions();
    
    return Object.values(sessions)
      .filter(s => s.userId === userId)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, limit);
  }
  
  async getActiveSession(userId: string): Promise<ReviewSession | null> {
    const sessions = await this.getAllSessions();
    
    return Object.values(sessions).find(
      s => s.userId === userId && s.status === 'active'
    ) || null;
  }
  
  private async getAllSessions(): Promise<Record<string, ReviewSession>> {
    const data = localStorage.getItem(this.SESSION_KEY);
    return data ? JSON.parse(data) : {};
  }
  
  private async getAllStatistics(): Promise<Record<string, SessionStatistics>> {
    const data = localStorage.getItem(this.STATS_KEY);
    return data ? JSON.parse(data) : {};
  }
}
```

### 3. Session State Machine

```typescript
// lib/review-engine/session/state-machine.ts

export enum SessionState {
  IDLE = 'idle',
  STARTING = 'starting',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETING = 'completing',
  COMPLETED = 'completed',
  ERROR = 'error'
}

export enum SessionAction {
  START = 'START',
  PAUSE = 'PAUSE',
  RESUME = 'RESUME',
  ANSWER = 'ANSWER',
  SKIP = 'SKIP',
  COMPLETE = 'COMPLETE',
  ABANDON = 'ABANDON',
  ERROR = 'ERROR'
}

export class SessionStateMachine {
  private state: SessionState = SessionState.IDLE;
  
  private transitions: Record<SessionState, Partial<Record<SessionAction, SessionState>>> = {
    [SessionState.IDLE]: {
      [SessionAction.START]: SessionState.STARTING
    },
    [SessionState.STARTING]: {
      [SessionAction.ERROR]: SessionState.ERROR
    },
    [SessionState.ACTIVE]: {
      [SessionAction.PAUSE]: SessionState.PAUSED,
      [SessionAction.ANSWER]: SessionState.ACTIVE,
      [SessionAction.SKIP]: SessionState.ACTIVE,
      [SessionAction.COMPLETE]: SessionState.COMPLETING,
      [SessionAction.ABANDON]: SessionState.COMPLETED,
      [SessionAction.ERROR]: SessionState.ERROR
    },
    [SessionState.PAUSED]: {
      [SessionAction.RESUME]: SessionState.ACTIVE,
      [SessionAction.ABANDON]: SessionState.COMPLETED
    },
    [SessionState.COMPLETING]: {
      [SessionAction.ERROR]: SessionState.ERROR
    },
    [SessionState.COMPLETED]: {
      [SessionAction.START]: SessionState.STARTING
    },
    [SessionState.ERROR]: {
      [SessionAction.START]: SessionState.STARTING,
      [SessionAction.ABANDON]: SessionState.COMPLETED
    }
  };
  
  transition(action: SessionAction): SessionState {
    const validTransition = this.transitions[this.state]?.[action];
    
    if (!validTransition) {
      throw new Error(
        `Invalid transition: ${action} from state ${this.state}`
      );
    }
    
    this.state = validTransition;
    return this.state;
  }
  
  getState(): SessionState {
    return this.state;
  }
  
  canTransition(action: SessionAction): boolean {
    return !!this.transitions[this.state]?.[action];
  }
}
```

## Testing Requirements

```typescript
// __tests__/session/manager.test.ts

describe('SessionManager', () => {
  let manager: SessionManager;
  let storage: MockSessionStorage;
  let analytics: MockAnalyticsService;
  
  beforeEach(() => {
    storage = new MockSessionStorage();
    analytics = new MockAnalyticsService();
    manager = new SessionManager(storage, analytics);
  });
  
  describe('Session Lifecycle', () => {
    it('should start a session');
    it('should handle answer submission');
    it('should calculate statistics correctly');
    it('should complete session');
    it('should handle pause/resume');
    it('should detect streaks');
  });
  
  describe('Error Handling', () => {
    it('should prevent multiple active sessions');
    it('should handle invalid answers');
    it('should recover from errors');
  });
});
```

## Acceptance Criteria

- [ ] Complete session lifecycle management
- [ ] Accurate statistics calculation
- [ ] Event emission for all state changes
- [ ] Persistence to storage
- [ ] Activity timeout handling
- [ ] Streak detection and tracking
- [ ] Achievement checking
- [ ] 95% test coverage

## Dependencies

- Core Interfaces (Module 1)
- Validation System (Module 6) for answer checking
- Analytics service implementation
- Storage implementation (localStorage or IndexedDB)