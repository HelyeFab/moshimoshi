/**
 * Improved Retry Mechanism with Circuit Breaker Pattern
 * Replaces complex exponential backoff with intelligent failure handling
 */

import { performanceMonitor } from '@/lib/monitoring/performance-monitor';
import { reviewLogger } from '@/lib/monitoring/logger';

export interface RetryConfig {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  timeout?: number;
  retryableErrors?: string[];
  circuitBreakerThreshold?: number;
  circuitBreakerTimeout?: number;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalDuration: number;
  circuitState: CircuitState;
}

export type CircuitState = 'closed' | 'open' | 'half-open';

export class RetryManager {
  private static instance: RetryManager;
  private circuits = new Map<string, CircuitBreaker>();
  private defaultConfig: Required<RetryConfig> = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    timeout: 30000,
    retryableErrors: ['NetworkError', 'TimeoutError', 'ServiceUnavailable'],
    circuitBreakerThreshold: 5,
    circuitBreakerTimeout: 60000
  };
  
  private constructor() {}
  
  static getInstance(): RetryManager {
    if (!this.instance) {
      this.instance = new RetryManager();
    }
    return this.instance;
  }
  
  /**
   * Execute an operation with retry logic and circuit breaker protection
   */
  async executeWithRetry<T>(
    operationName: string,
    operation: () => Promise<T>,
    config?: RetryConfig
  ): Promise<RetryResult<T>> {
    const finalConfig = { ...this.defaultConfig, ...config };
    const circuit = this.getOrCreateCircuit(operationName, finalConfig);
    
    const startTime = Date.now();
    let attempts = 0;
    let lastError: Error | undefined;
    
    // Check circuit state first
    if (circuit.getState() === 'open') {
      performanceMonitor.trackError('CircuitOpen');
      return {
        success: false,
        error: new Error(`Circuit breaker is open for ${operationName}`),
        attempts: 0,
        totalDuration: 0,
        circuitState: 'open'
      };
    }
    
    while (attempts < finalConfig.maxAttempts) {
      attempts++;
      
      try {
        // Execute with timeout
        const result = await this.executeWithTimeout(
          operation,
          finalConfig.timeout
        );
        
        // Success - reset circuit
        circuit.recordSuccess();
        
        return {
          success: true,
          data: result,
          attempts,
          totalDuration: Date.now() - startTime,
          circuitState: circuit.getState()
        };
      } catch (error: any) {
        lastError = error;
        
        // Record failure in circuit breaker
        circuit.recordFailure();
        
        // Check if error is retryable
        if (!this.isRetryableError(error, finalConfig.retryableErrors)) {
          performanceMonitor.trackError('NonRetryableError');
          break;
        }
        
        // Check if circuit is now open
        if (circuit.getState() === 'open') {
          performanceMonitor.trackError('CircuitOpened');
          break;
        }
        
        // Calculate delay for next attempt
        if (attempts < finalConfig.maxAttempts) {
          const delay = this.calculateDelay(
            attempts,
            finalConfig.baseDelay,
            finalConfig.maxDelay
          );
          
          await this.delay(delay);
        }
      }
    }
    
    // All attempts failed
    return {
      success: false,
      error: lastError,
      attempts,
      totalDuration: Date.now() - startTime,
      circuitState: circuit.getState()
    };
  }
  
  /**
   * Execute with bulk retry - optimized for multiple operations
   */
  async executeBulkWithRetry<T>(
    operations: Array<{
      name: string;
      operation: () => Promise<T>;
    }>,
    config?: RetryConfig
  ): Promise<Map<string, RetryResult<T>>> {
    const results = new Map<string, RetryResult<T>>();
    
    // Group operations by circuit state
    const grouped = this.groupByCircuitState(operations);
    
    // Execute closed circuit operations in parallel
    if (grouped.closed.length > 0) {
      const closedResults = await Promise.all(
        grouped.closed.map(op =>
          this.executeWithRetry(op.name, op.operation, config)
            .then(result => ({ name: op.name, result }))
        )
      );
      
      closedResults.forEach(({ name, result }) => {
        results.set(name, result);
      });
    }
    
    // Skip open circuit operations
    grouped.open.forEach(op => {
      results.set(op.name, {
        success: false,
        error: new Error(`Circuit breaker is open for ${op.name}`),
        attempts: 0,
        totalDuration: 0,
        circuitState: 'open'
      });
    });
    
    // Execute half-open operations sequentially (testing)
    for (const op of grouped.halfOpen) {
      const result = await this.executeWithRetry(op.name, op.operation, config);
      results.set(op.name, result);
    }
    
    return results;
  }
  
  /**
   * Adaptive retry with jitter to prevent thundering herd
   */
  private calculateDelay(attempt: number, baseDelay: number, maxDelay: number): number {
    // Exponential backoff with jitter
    const exponentialDelay = Math.min(
      baseDelay * Math.pow(2, attempt - 1),
      maxDelay
    );
    
    // Add random jitter (±25%)
    const jitter = exponentialDelay * (0.75 + Math.random() * 0.5);
    
    return Math.round(jitter);
  }
  
  /**
   * Execute operation with timeout
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Operation timeout'));
        }, timeout);
      })
    ]);
  }
  
  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any, retryableErrors: string[]): boolean {
    // Network errors are always retryable
    if (error.code === 'NETWORK_ERROR' || error.code === 'ECONNREFUSED') {
      return true;
    }
    
    // Check HTTP status codes
    if (error.statusCode) {
      const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
      return retryableStatusCodes.includes(error.statusCode);
    }
    
    // Check error name/message
    return retryableErrors.some(retryable =>
      error.name?.includes(retryable) ||
      error.message?.includes(retryable)
    );
  }
  
  /**
   * Get or create circuit breaker for operation
   */
  private getOrCreateCircuit(name: string, config: Required<RetryConfig>): CircuitBreaker {
    if (!this.circuits.has(name)) {
      this.circuits.set(name, new CircuitBreaker(
        config.circuitBreakerThreshold,
        config.circuitBreakerTimeout
      ));
    }
    return this.circuits.get(name)!;
  }
  
  /**
   * Group operations by circuit state
   */
  private groupByCircuitState<T>(
    operations: Array<{ name: string; operation: () => Promise<T> }>
  ): {
    closed: Array<{ name: string; operation: () => Promise<T> }>;
    open: Array<{ name: string; operation: () => Promise<T> }>;
    halfOpen: Array<{ name: string; operation: () => Promise<T> }>;
  } {
    const grouped = {
      closed: [] as Array<{ name: string; operation: () => Promise<T> }>,
      open: [] as Array<{ name: string; operation: () => Promise<T> }>,
      halfOpen: [] as Array<{ name: string; operation: () => Promise<T> }>
    };
    
    operations.forEach(op => {
      const circuit = this.circuits.get(op.name);
      const state = circuit?.getState() || 'closed';
      
      switch (state) {
        case 'closed':
          grouped.closed.push(op);
          break;
        case 'open':
          grouped.open.push(op);
          break;
        case 'half-open':
          grouped.halfOpen.push(op);
          break;
      }
    });
    
    return grouped;
  }
  
  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get circuit breaker statistics
   */
  getCircuitStats(): Map<string, {
    state: CircuitState;
    failures: number;
    successRate: number;
    lastFailure: Date | null;
  }> {
    const stats = new Map();
    
    this.circuits.forEach((circuit, name) => {
      stats.set(name, circuit.getStats());
    });
    
    return stats;
  }
  
  /**
   * Reset specific circuit breaker
   */
  resetCircuit(operationName: string): void {
    this.circuits.get(operationName)?.reset();
  }
  
  /**
   * Reset all circuit breakers
   */
  resetAllCircuits(): void {
    this.circuits.forEach(circuit => circuit.reset());
  }
}

/**
 * Circuit Breaker implementation
 */
class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;
  private consecutiveSuccesses = 0;
  
  constructor(
    private threshold: number,
    private timeout: number
  ) {}
  
  recordSuccess(): void {
    this.successes++;
    this.consecutiveSuccesses++;
    
    if (this.state === 'half-open' && this.consecutiveSuccesses >= 2) {
      // Close circuit after successful test
      this.state = 'closed';
      this.failures = 0;
      reviewLogger.info('Circuit breaker closed after successful recovery');
    }
  }
  
  recordFailure(): void {
    this.failures++;
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold && this.state === 'closed') {
      this.state = 'open';
      reviewLogger.warn(`Circuit breaker opened after ${this.failures} failures`);
    } else if (this.state === 'half-open') {
      // Failed during test, reopen
      this.state = 'open';
      reviewLogger.warn('Circuit breaker reopened after test failure');
    }
  }
  
  getState(): CircuitState {
    if (this.state === 'open') {
      // Check if timeout has passed
      if (Date.now() - this.lastFailureTime >= this.timeout) {
        this.state = 'half-open';
        reviewLogger.info('Circuit breaker entering half-open state for testing');
      }
    }
    return this.state;
  }
  
  getStats() {
    const total = this.successes + this.failures;
    return {
      state: this.state,
      failures: this.failures,
      successRate: total > 0 ? this.successes / total : 1,
      lastFailure: this.lastFailureTime ? new Date(this.lastFailureTime) : null
    };
  }
  
  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = 0;
  }
}

// Export singleton instance
export const retryManager = RetryManager.getInstance();