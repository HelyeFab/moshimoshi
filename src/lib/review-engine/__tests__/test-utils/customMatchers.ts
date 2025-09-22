/**
 * Custom Jest Matchers for Universal Review Engine
 * Agent 1: Test Architect
 * 
 * Provides domain-specific assertions for cleaner and more expressive tests.
 */

import { 
  ReviewableContent,
  ReviewSession,
  SessionStatistics,
  SRSData,
  ValidationResult,
  ReviewEvent,
  ReviewEventType
} from '../../core/interfaces';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      // Content matchers
      toBeValidReviewableContent(): R;
      toHaveContentType(expected: string): R;
      toBePinned(): R;
      toBeDueForReview(before?: Date): R;
      
      // Session matchers
      toBeActiveSession(): R;
      toBeCompletedSession(): R;
      toHaveSessionProgress(min: number, max: number): R;
      toHaveAccuracy(minAccuracy: number): R;
      
      // SRS matchers
      toBeInLearningState(state: 'new' | 'learning' | 'mastered'): R;
      toHaveInterval(min: number, max: number): R;
      toHaveEaseFactor(min: number, max: number): R;
      
      // Validation matchers
      toBeCorrectAnswer(): R;
      toHavePartialCredit(): R;
      toHaveValidationScore(min: number, max?: number): R;
      
      // Event matchers
      toBeReviewEvent(type: ReviewEventType): R;
      toHaveEventData(expected: any): R;
      
      // Statistics matchers
      toHaveStreak(minStreak: number): R;
      toHaveCompletionRate(minRate: number): R;
      
      // Performance matchers
      toRespondWithin(milliseconds: number): R;
      toHaveCacheHitRate(minRate: number): R;
    }
  }
}

/**
 * Content Matchers
 */
expect.extend({
  toBeValidReviewableContent(received: any) {
    const pass = 
      received &&
      typeof received.id === 'string' &&
      typeof received.contentType === 'string' &&
      typeof received.primaryDisplay === 'string' &&
      typeof received.primaryAnswer === 'string' &&
      typeof received.difficulty === 'number' &&
      Array.isArray(received.tags) &&
      Array.isArray(received.supportedModes);

    return {
      pass,
      message: () => pass
        ? `expected ${JSON.stringify(received)} not to be valid ReviewableContent`
        : `expected ${JSON.stringify(received)} to be valid ReviewableContent`
    };
  },

  toHaveContentType(received: ReviewableContent, expected: string) {
    const pass = received.contentType === expected;
    
    return {
      pass,
      message: () => pass
        ? `expected content type not to be ${expected}`
        : `expected content type to be ${expected}, but got ${received.contentType}`
    };
  },

  toBePinned(received: ReviewableContent) {
    const pass = received.metadata?.isPinned === true;
    
    return {
      pass,
      message: () => pass
        ? `expected content not to be pinned`
        : `expected content to be pinned`
    };
  },

  toBeDueForReview(received: ReviewableContent, before: Date = new Date()) {
    const nextReview = received.metadata?.srsData?.nextReviewAt;
    const pass = !nextReview || new Date(nextReview) <= before;
    
    return {
      pass,
      message: () => pass
        ? `expected content not to be due for review before ${before.toISOString()}`
        : `expected content to be due for review before ${before.toISOString()}, but next review is ${nextReview}`
    };
  }
});

/**
 * Session Matchers
 */
expect.extend({
  toBeActiveSession(received: ReviewSession) {
    const pass = received.status === 'active';
    
    return {
      pass,
      message: () => pass
        ? `expected session not to be active`
        : `expected session to be active, but status is ${received.status}`
    };
  },

  toBeCompletedSession(received: ReviewSession) {
    const pass = received.status === 'completed' && received.endedAt != null;
    
    return {
      pass,
      message: () => pass
        ? `expected session not to be completed`
        : `expected session to be completed, but status is ${received.status}`
    };
  },

  toHaveSessionProgress(received: ReviewSession, min: number, max: number) {
    const progress = (received.currentIndex / received.items.length) * 100;
    const pass = progress >= min && progress <= max;
    
    return {
      pass,
      message: () => pass
        ? `expected session progress not to be between ${min}% and ${max}%`
        : `expected session progress to be between ${min}% and ${max}%, but got ${progress.toFixed(1)}%`
    };
  },

  toHaveAccuracy(received: SessionStatistics, minAccuracy: number) {
    const pass = received.accuracy >= minAccuracy;
    
    return {
      pass,
      message: () => pass
        ? `expected accuracy not to be at least ${minAccuracy}%`
        : `expected accuracy to be at least ${minAccuracy}%, but got ${received.accuracy}%`
    };
  }
});

/**
 * SRS Matchers
 */
expect.extend({
  toBeInLearningState(received: SRSData, state: 'new' | 'learning' | 'mastered') {
    const pass = received.status === state;
    
    return {
      pass,
      message: () => pass
        ? `expected SRS state not to be ${state}`
        : `expected SRS state to be ${state}, but got ${received.status}`
    };
  },

  toHaveInterval(received: SRSData, min: number, max: number) {
    const pass = received.interval >= min && received.interval <= max;
    
    return {
      pass,
      message: () => pass
        ? `expected interval not to be between ${min} and ${max} days`
        : `expected interval to be between ${min} and ${max} days, but got ${received.interval}`
    };
  },

  toHaveEaseFactor(received: SRSData, min: number, max: number) {
    const pass = received.easeFactor >= min && received.easeFactor <= max;
    
    return {
      pass,
      message: () => pass
        ? `expected ease factor not to be between ${min} and ${max}`
        : `expected ease factor to be between ${min} and ${max}, but got ${received.easeFactor}`
    };
  }
});

/**
 * Validation Matchers
 */
expect.extend({
  toBeCorrectAnswer(received: ValidationResult) {
    const pass = received.correct === true;
    
    return {
      pass,
      message: () => pass
        ? `expected answer not to be correct`
        : `expected answer to be correct, but validation returned ${received.correct}`
    };
  },

  toHavePartialCredit(received: ValidationResult) {
    const pass = received.partialCredit === true && received.score > 0 && received.score < 1;
    
    return {
      pass,
      message: () => pass
        ? `expected answer not to have partial credit`
        : `expected answer to have partial credit, but got score ${received.score}`
    };
  },

  toHaveValidationScore(received: ValidationResult, min: number, max: number = 1) {
    const pass = received.score >= min && received.score <= max;
    
    return {
      pass,
      message: () => pass
        ? `expected validation score not to be between ${min} and ${max}`
        : `expected validation score to be between ${min} and ${max}, but got ${received.score}`
    };
  }
});

/**
 * Event Matchers
 */
expect.extend({
  toBeReviewEvent(received: ReviewEvent, type: ReviewEventType) {
    const pass = received.type === type;
    
    return {
      pass,
      message: () => pass
        ? `expected event type not to be ${type}`
        : `expected event type to be ${type}, but got ${received.type}`
    };
  },

  toHaveEventData(received: ReviewEvent, expected: any) {
    const pass = JSON.stringify(received.data) === JSON.stringify(expected);
    
    return {
      pass,
      message: () => pass
        ? `expected event data not to match`
        : `expected event data to be ${JSON.stringify(expected)}, but got ${JSON.stringify(received.data)}`
    };
  }
});

/**
 * Statistics Matchers
 */
expect.extend({
  toHaveStreak(received: SessionStatistics, minStreak: number) {
    const pass = received.currentStreak >= minStreak;
    
    return {
      pass,
      message: () => pass
        ? `expected streak not to be at least ${minStreak}`
        : `expected streak to be at least ${minStreak}, but got ${received.currentStreak}`
    };
  },

  toHaveCompletionRate(received: SessionStatistics, minRate: number) {
    const rate = (received.completedItems / received.totalItems) * 100;
    const pass = rate >= minRate;
    
    return {
      pass,
      message: () => pass
        ? `expected completion rate not to be at least ${minRate}%`
        : `expected completion rate to be at least ${minRate}%, but got ${rate.toFixed(1)}%`
    };
  }
});

/**
 * Performance Matchers
 */
expect.extend({
  async toRespondWithin(received: () => Promise<any>, milliseconds: number) {
    const start = Date.now();
    try {
      await received();
      const duration = Date.now() - start;
      const pass = duration <= milliseconds;
      
      return {
        pass,
        message: () => pass
          ? `expected response time not to be within ${milliseconds}ms`
          : `expected response time to be within ${milliseconds}ms, but took ${duration}ms`
      };
    } catch (error) {
      return {
        pass: false,
        message: () => `expected function to complete, but it threw: ${error}`
      };
    }
  },

  toHaveCacheHitRate(received: { hits: number; misses: number }, minRate: number) {
    const total = received.hits + received.misses;
    const rate = total > 0 ? (received.hits / total) * 100 : 0;
    const pass = rate >= minRate;
    
    return {
      pass,
      message: () => pass
        ? `expected cache hit rate not to be at least ${minRate}%`
        : `expected cache hit rate to be at least ${minRate}%, but got ${rate.toFixed(1)}% (${received.hits} hits, ${received.misses} misses)`
    };
  }
});

/**
 * Utility function to create custom matcher combinations
 */
export function expectReviewSession(session: ReviewSession) {
  return {
    toBeActive: () => expect(session).toBeActiveSession(),
    toBeCompleted: () => expect(session).toBeCompletedSession(),
    toHaveProgress: (min: number, max: number) => 
      expect(session).toHaveSessionProgress(min, max)
  };
}

export function expectSRSData(srsData: SRSData) {
  return {
    toBeNew: () => expect(srsData).toBeInLearningState('new'),
    toBeLearning: () => expect(srsData).toBeInLearningState('learning'),
    toBeMastered: () => expect(srsData).toBeInLearningState('mastered'),
    toHaveReasonableInterval: () => expect(srsData).toHaveInterval(0, 365),
    toHaveValidEaseFactor: () => expect(srsData).toHaveEaseFactor(1.3, 2.5)
  };
}

export function expectValidation(result: ValidationResult) {
  return {
    toBeCorrect: () => expect(result).toBeCorrectAnswer(),
    toBePartiallyCorrect: () => expect(result).toHavePartialCredit(),
    toHavePerfectScore: () => expect(result).toHaveValidationScore(1, 1),
    toHaveMinimumScore: (min: number) => 
      expect(result).toHaveValidationScore(min)
  };
}

/**
 * Test helper for async expectations
 */
export async function expectAsync<T>(
  promise: Promise<T>
): Promise<{ 
  toResolve: () => Promise<void>;
  toReject: () => Promise<void>;
  toResolveWithin: (ms: number) => Promise<void>;
}> {
  return {
    toResolve: async () => {
      await expect(promise).resolves.toBeDefined();
    },
    toReject: async () => {
      await expect(promise).rejects.toThrow();
    },
    toResolveWithin: async (ms: number) => {
      const start = Date.now();
      await promise;
      const duration = Date.now() - start;
      expect(duration).toBeLessThanOrEqual(ms);
    }
  };
}

// Export matcher type augmentations
export {};