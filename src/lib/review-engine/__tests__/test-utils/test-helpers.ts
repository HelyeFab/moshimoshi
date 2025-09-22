/**
 * Shared Test Helpers and Custom Matchers
 */

import { ReviewableContent } from '../../core/interfaces';
import { ReviewMode } from '../../core/types';
import { reviewLogger } from '@/lib/monitoring/logger';

// Custom Jest Matchers
export const customMatchers = {
  toBeValidReviewableContent(received: any) {
    const pass = 
      received &&
      typeof received.id === 'string' &&
      typeof received.contentType === 'string' &&
      typeof received.primaryDisplay === 'string' &&
      typeof received.primaryAnswer === 'string' &&
      Array.isArray(received.supportedModes) &&
      typeof received.difficulty === 'number' &&
      received.difficulty >= 0 &&
      received.difficulty <= 1;

    return {
      pass,
      message: () => 
        pass 
          ? `expected ${JSON.stringify(received)} not to be valid ReviewableContent`
          : `expected ${JSON.stringify(received)} to be valid ReviewableContent`
    };
  },

  toHaveRequiredAdapterMethods(received: any) {
    const requiredMethods = [
      'transform',
      'generateOptions',
      'getSupportedModes',
      'prepareForMode',
      'calculateDifficulty',
      'generateHints'
    ];

    const missingMethods = requiredMethods.filter(
      method => typeof received[method] !== 'function'
    );

    const pass = missingMethods.length === 0;

    return {
      pass,
      message: () =>
        pass
          ? `expected adapter not to have all required methods`
          : `expected adapter to have methods: ${missingMethods.join(', ')}`
    };
  },

  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be within range ${floor} - ${ceiling}`
          : `expected ${received} to be within range ${floor} - ${ceiling}`
    };
  }
};

// Test Utilities
export class TestHelpers {
  static async measurePerformance<T>(
    fn: () => Promise<T>,
    maxMs: number = 100
  ): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    
    if (duration > maxMs) {
      reviewLogger.warn(`Performance warning: Operation took ${duration}ms (max: ${maxMs}ms)`);
    }
    
    return { result, duration };
  }

  static validateContentTransformation(
    original: any,
    transformed: ReviewableContent
  ): void {
    expect(transformed).toHaveProperty('id');
    expect(transformed).toHaveProperty('contentType');
    expect(transformed).toHaveProperty('primaryDisplay');
    expect(transformed).toHaveProperty('primaryAnswer');
    expect(transformed.difficulty).toBeGreaterThanOrEqual(0);
    expect(transformed.difficulty).toBeLessThanOrEqual(1);
    expect(Array.isArray(transformed.supportedModes)).toBeTruthy();
    expect(transformed.supportedModes.length).toBeGreaterThan(0);
  }

  static validateOptionsGeneration(
    options: ReviewableContent[],
    correctAnswer: ReviewableContent,
    expectedCount: number
  ): void {
    expect(options).toHaveLength(expectedCount - 1);
    expect(options.every(opt => opt.id !== correctAnswer.id)).toBeTruthy();
    expect(new Set(options.map(opt => opt.id)).size).toBe(options.length);
  }

  static validateModePreparation(
    original: ReviewableContent,
    prepared: ReviewableContent,
    mode: ReviewMode
  ): void {
    expect(prepared.id).toBe(original.id);
    expect(prepared.contentType).toBe(original.contentType);
    
    switch (mode) {
      case 'recognition':
        expect(prepared.primaryDisplay).toBeDefined();
        break;
      case 'recall':
        expect(prepared.primaryDisplay).toBeDefined();
        break;
      case 'listening':
        if (original.audioUrl) {
          expect(prepared.audioUrl).toBe(original.audioUrl);
        }
        break;
    }
  }

  static async simulateUserResponse(
    sessionItem: any,
    answer: string,
    responseTimeMs: number = 2000
  ): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, responseTimeMs));
    sessionItem.answer = answer;
    sessionItem.responseTime = responseTimeMs;
  }

  static generateTestMatrix<T>(
    inputs: T[],
    scenarios: Array<(input: T) => any>
  ): Array<[T, any]> {
    const matrix: Array<[T, any]> = [];
    for (const input of inputs) {
      for (const scenario of scenarios) {
        matrix.push([input, scenario(input)]);
      }
    }
    return matrix;
  }

  static assertNoMemoryLeaks(fn: () => void, iterations: number = 1000): void {
    const memBefore = process.memoryUsage().heapUsed;
    
    for (let i = 0; i < iterations; i++) {
      fn();
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const memAfter = process.memoryUsage().heapUsed;
    const memIncrease = memAfter - memBefore;
    const memIncreasePerIteration = memIncrease / iterations;
    
    // Allow max 1KB per iteration
    expect(memIncreasePerIteration).toBeLessThan(1024);
  }

  static createSpyObject<T>(methods: string[]): T {
    const spy: any = {};
    methods.forEach(method => {
      spy[method] = jest.fn();
    });
    return spy as T;
  }

  static async waitForCondition(
    condition: () => boolean,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<void> {
    const startTime = Date.now();
    
    while (!condition()) {
      if (Date.now() - startTime > timeout) {
        throw new Error('Timeout waiting for condition');
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
}

// API Test Helpers
export class ApiTestHelpers {
  static createMockRequest(overrides?: any) {
    return {
      method: 'GET',
      headers: new Headers({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      }),
      url: 'http://localhost:3000/api/test',
      ...overrides
    };
  }

  static createMockResponse() {
    const response: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      headers: new Headers(),
      statusCode: 200
    };
    return response;
  }

  static async parseJsonResponse(response: Response): Promise<any> {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON response: ${text}`);
    }
  }

  static expectSuccessResponse(response: any, expectedData?: any) {
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    if (expectedData) {
      expect(response.body.data).toMatchObject(expectedData);
    }
  }

  static expectErrorResponse(response: any, statusCode: number, errorCode?: string) {
    expect(response.status).toBe(statusCode);
    expect(response.body.success).toBe(false);
    if (errorCode) {
      expect(response.body.error.code).toBe(errorCode);
    }
  }
}

// Adapter Test Helpers
export class AdapterTestHelpers {
  static testAllModes<T>(
    adapter: any,
    content: T,
    modes: ReviewMode[]
  ): void {
    const transformed = adapter.transform(content);
    
    modes.forEach(mode => {
      const prepared = adapter.prepareForMode(transformed, mode);
      TestHelpers.validateModePreparation(transformed, prepared, mode);
    });
  }

  static testDifficultyRange(
    adapter: any,
    contents: any[],
    expectedRange: [number, number]
  ): void {
    contents.forEach(content => {
      const difficulty = adapter.calculateDifficulty(content);
      expect(difficulty).toBeGreaterThanOrEqual(expectedRange[0]);
      expect(difficulty).toBeLessThanOrEqual(expectedRange[1]);
    });
  }

  static testHintGeneration(
    adapter: any,
    content: ReviewableContent,
    minHints: number = 1,
    maxHints: number = 5
  ): void {
    const hints = adapter.generateHints(content);
    expect(Array.isArray(hints)).toBeTruthy();
    expect(hints.length).toBeGreaterThanOrEqual(minHints);
    expect(hints.length).toBeLessThanOrEqual(maxHints);
    hints.forEach(hint => {
      expect(typeof hint).toBe('string');
      expect(hint.length).toBeGreaterThan(0);
    });
  }

  static testOptionsUniqueness(
    options: ReviewableContent[],
    correctAnswer: ReviewableContent
  ): void {
    const ids = new Set(options.map(opt => opt.id));
    expect(ids.size).toBe(options.length);
    expect(ids.has(correctAnswer.id)).toBe(false);
  }
}

// Setup and Teardown Helpers
export const setupTest = () => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
};

export const teardownTest = () => {
  jest.clearAllTimers();
  jest.clearAllMocks();
};