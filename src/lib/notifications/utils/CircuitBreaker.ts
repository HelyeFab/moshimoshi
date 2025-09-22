/**
 * CircuitBreaker
 * Implements the Circuit Breaker pattern for fault tolerance
 */

import { EventEmitter } from 'events'
import { reviewLogger } from '@/lib/monitoring/logger'

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = 'closed',     // Normal operation
  OPEN = 'open',        // Failing, reject all calls
  HALF_OPEN = 'half_open' // Testing if service recovered
}

/**
 * Circuit breaker options
 */
export interface CircuitBreakerOptions {
  /**
   * Number of failures before opening circuit
   */
  failureThreshold?: number

  /**
   * Time window for counting failures (ms)
   */
  failureWindow?: number

  /**
   * Success rate threshold to close circuit (0-1)
   */
  successThreshold?: number

  /**
   * Time to wait before trying half-open (ms)
   */
  resetTimeout?: number

  /**
   * Number of test requests in half-open state
   */
  testRequests?: number

  /**
   * Request timeout (ms)
   */
  requestTimeout?: number

  /**
   * Function to determine if error should trip breaker
   */
  isFailure?: (error: any) => boolean

  /**
   * Fallback function when circuit is open
   */
  fallback?: () => Promise<any>

  /**
   * Monitor function for metrics
   */
  monitor?: (event: CircuitBreakerEvent) => void
}

/**
 * Circuit breaker event
 */
export interface CircuitBreakerEvent {
  type: 'success' | 'failure' | 'timeout' | 'state_change' | 'fallback'
  state: CircuitState
  timestamp: Date
  duration?: number
  error?: any
  metadata?: any
}

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
  state: CircuitState
  failures: number
  successes: number
  totalRequests: number
  successRate: number
  lastFailureTime?: Date
  lastSuccessTime?: Date
  stateChangeTime: Date
  consecutiveFailures: number
  consecutiveSuccesses: number
}

/**
 * CircuitBreaker class
 */
export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED
  private failures = 0
  private successes = 0
  private totalRequests = 0
  private consecutiveFailures = 0
  private consecutiveSuccesses = 0
  private lastFailureTime?: Date
  private lastSuccessTime?: Date
  private stateChangeTime = new Date()
  private resetTimer?: NodeJS.Timeout
  private halfOpenTests = 0
  private failureTimestamps: number[] = []

  // Options with defaults
  private readonly failureThreshold: number
  private readonly failureWindow: number
  private readonly successThreshold: number
  private readonly resetTimeout: number
  private readonly testRequests: number
  private readonly requestTimeout: number
  private readonly isFailure: (error: any) => boolean
  private readonly fallback?: () => Promise<any>
  private readonly monitor?: (event: CircuitBreakerEvent) => void

  constructor(
    private readonly name: string,
    options: CircuitBreakerOptions = {}
  ) {
    super()

    // Set options with defaults
    this.failureThreshold = options.failureThreshold || 5
    this.failureWindow = options.failureWindow || 60000 // 1 minute
    this.successThreshold = options.successThreshold || 0.5
    this.resetTimeout = options.resetTimeout || 30000 // 30 seconds
    this.testRequests = options.testRequests || 3
    this.requestTimeout = options.requestTimeout || 5000 // 5 seconds
    this.isFailure = options.isFailure || (() => true)
    this.fallback = options.fallback
    this.monitor = options.monitor

    reviewLogger.info(`CircuitBreaker ${name} initialized`, {
      failureThreshold: this.failureThreshold,
      resetTimeout: this.resetTimeout
    })
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      return this.handleOpen()
    }

    // Check if in half-open state
    if (this.state === CircuitState.HALF_OPEN) {
      return this.handleHalfOpen(fn)
    }

    // Circuit is closed, execute normally
    return this.handleClosed(fn)
  }

  /**
   * Handle execution when circuit is closed
   */
  private async handleClosed<T>(fn: () => Promise<T>): Promise<T> {
    const startTime = Date.now()

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(fn)

      this.recordSuccess(Date.now() - startTime)

      return result
    } catch (error) {
      this.recordFailure(error, Date.now() - startTime)

      // Check if we should open the circuit
      if (this.shouldOpen()) {
        this.open()
      }

      throw error
    }
  }

  /**
   * Handle execution when circuit is open
   */
  private async handleOpen<T>(): Promise<T> {
    reviewLogger.debug(`CircuitBreaker ${this.name} is OPEN, rejecting request`)

    this.emitEvent({
      type: 'failure',
      state: this.state,
      timestamp: new Date(),
      error: new Error('Circuit breaker is OPEN')
    })

    // Use fallback if available
    if (this.fallback) {
      try {
        const result = await this.fallback()
        this.emitEvent({
          type: 'fallback',
          state: this.state,
          timestamp: new Date()
        })
        return result
      } catch (fallbackError) {
        reviewLogger.error(`CircuitBreaker ${this.name} fallback failed`, fallbackError)
        throw fallbackError
      }
    }

    throw new Error(`Circuit breaker ${this.name} is OPEN`)
  }

  /**
   * Handle execution when circuit is half-open
   */
  private async handleHalfOpen<T>(fn: () => Promise<T>): Promise<T> {
    const startTime = Date.now()

    try {
      // Execute test request
      const result = await this.executeWithTimeout(fn)

      this.recordSuccess(Date.now() - startTime)
      this.halfOpenTests++

      // Check if we should close the circuit
      if (this.shouldClose()) {
        this.close()
      }

      return result
    } catch (error) {
      this.recordFailure(error, Date.now() - startTime)

      // Failed test, reopen circuit
      this.open()

      throw error
    }
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | undefined

      // Set timeout
      timeoutId = setTimeout(() => {
        reject(new Error(`Request timeout after ${this.requestTimeout}ms`))
      }, this.requestTimeout)

      // Execute function
      fn()
        .then(result => {
          if (timeoutId) clearTimeout(timeoutId)
          resolve(result)
        })
        .catch(error => {
          if (timeoutId) clearTimeout(timeoutId)
          reject(error)
        })
    })
  }

  /**
   * Record a successful execution
   */
  private recordSuccess(duration: number): void {
    this.successes++
    this.totalRequests++
    this.consecutiveSuccesses++
    this.consecutiveFailures = 0
    this.lastSuccessTime = new Date()

    this.emitEvent({
      type: 'success',
      state: this.state,
      timestamp: new Date(),
      duration
    })
  }

  /**
   * Record a failed execution
   */
  private recordFailure(error: any, duration: number): void {
    // Check if this error should count as failure
    if (!this.isFailure(error)) {
      return
    }

    this.failures++
    this.totalRequests++
    this.consecutiveFailures++
    this.consecutiveSuccesses = 0
    this.lastFailureTime = new Date()

    // Track failure timestamp
    const now = Date.now()
    this.failureTimestamps.push(now)

    // Remove old failures outside window
    const windowStart = now - this.failureWindow
    this.failureTimestamps = this.failureTimestamps.filter(ts => ts > windowStart)

    reviewLogger.warn(`CircuitBreaker ${this.name} recorded failure`, {
      consecutiveFailures: this.consecutiveFailures,
      recentFailures: this.failureTimestamps.length,
      error: error.message
    })

    this.emitEvent({
      type: 'failure',
      state: this.state,
      timestamp: new Date(),
      duration,
      error
    })
  }

  /**
   * Check if circuit should open
   */
  private shouldOpen(): boolean {
    // Check consecutive failures
    if (this.consecutiveFailures >= this.failureThreshold) {
      return true
    }

    // Check failures within time window
    const recentFailures = this.failureTimestamps.length
    return recentFailures >= this.failureThreshold
  }

  /**
   * Check if circuit should close
   */
  private shouldClose(): boolean {
    if (this.state !== CircuitState.HALF_OPEN) {
      return false
    }

    // Check if we've tested enough requests
    if (this.halfOpenTests < this.testRequests) {
      return false
    }

    // Calculate success rate for test requests
    const recentTotal = Math.min(this.testRequests, this.totalRequests)
    const successRate = this.consecutiveSuccesses / recentTotal

    return successRate >= this.successThreshold
  }

  /**
   * Open the circuit
   */
  private open(): void {
    if (this.state === CircuitState.OPEN) {
      return
    }

    const previousState = this.state
    this.state = CircuitState.OPEN
    this.stateChangeTime = new Date()
    this.halfOpenTests = 0

    reviewLogger.warn(`CircuitBreaker ${this.name} opened`, {
      previousState,
      failures: this.failures,
      consecutiveFailures: this.consecutiveFailures
    })

    this.emitEvent({
      type: 'state_change',
      state: this.state,
      timestamp: new Date(),
      metadata: { previousState }
    })

    // Schedule transition to half-open
    this.scheduleHalfOpen()
  }

  /**
   * Close the circuit
   */
  private close(): void {
    if (this.state === CircuitState.CLOSED) {
      return
    }

    const previousState = this.state
    this.state = CircuitState.CLOSED
    this.stateChangeTime = new Date()
    this.halfOpenTests = 0
    this.consecutiveFailures = 0
    this.failureTimestamps = []

    reviewLogger.info(`CircuitBreaker ${this.name} closed`, {
      previousState,
      successes: this.successes
    })

    this.emitEvent({
      type: 'state_change',
      state: this.state,
      timestamp: new Date(),
      metadata: { previousState }
    })

    // Cancel reset timer if exists
    if (this.resetTimer) {
      clearTimeout(this.resetTimer)
      this.resetTimer = undefined
    }
  }

  /**
   * Transition to half-open state
   */
  private halfOpen(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      return
    }

    const previousState = this.state
    this.state = CircuitState.HALF_OPEN
    this.stateChangeTime = new Date()
    this.halfOpenTests = 0

    reviewLogger.info(`CircuitBreaker ${this.name} half-opened for testing`, {
      previousState
    })

    this.emitEvent({
      type: 'state_change',
      state: this.state,
      timestamp: new Date(),
      metadata: { previousState }
    })
  }

  /**
   * Schedule transition to half-open
   */
  private scheduleHalfOpen(): void {
    // Clear existing timer
    if (this.resetTimer) {
      clearTimeout(this.resetTimer)
    }

    // Schedule transition
    this.resetTimer = setTimeout(() => {
      this.halfOpen()
      this.resetTimer = undefined
    }, this.resetTimeout)
  }

  /**
   * Emit circuit breaker event
   */
  private emitEvent(event: CircuitBreakerEvent): void {
    this.emit(event.type, event)

    // Call monitor if provided
    if (this.monitor) {
      try {
        this.monitor(event)
      } catch (error) {
        reviewLogger.error(`CircuitBreaker ${this.name} monitor error`, error)
      }
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state
  }

  /**
   * Get statistics
   */
  getStats(): CircuitBreakerStats {
    const successRate = this.totalRequests > 0
      ? this.successes / this.totalRequests
      : 0

    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      totalRequests: this.totalRequests,
      successRate,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      stateChangeTime: this.stateChangeTime,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses
    }
  }

  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED
    this.failures = 0
    this.successes = 0
    this.totalRequests = 0
    this.consecutiveFailures = 0
    this.consecutiveSuccesses = 0
    this.lastFailureTime = undefined
    this.lastSuccessTime = undefined
    this.stateChangeTime = new Date()
    this.halfOpenTests = 0
    this.failureTimestamps = []

    if (this.resetTimer) {
      clearTimeout(this.resetTimer)
      this.resetTimer = undefined
    }

    reviewLogger.info(`CircuitBreaker ${this.name} reset`)
  }

  /**
   * Force open the circuit (for testing)
   */
  forceOpen(): void {
    this.open()
  }

  /**
   * Force close the circuit (for testing)
   */
  forceClose(): void {
    this.close()
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer)
      this.resetTimer = undefined
    }

    this.removeAllListeners()

    reviewLogger.info(`CircuitBreaker ${this.name} destroyed`)
  }
}

/**
 * Circuit breaker factory
 */
export class CircuitBreakerFactory {
  private static breakers = new Map<string, CircuitBreaker>()

  /**
   * Get or create a circuit breaker
   */
  static getBreaker(
    name: string,
    options?: CircuitBreakerOptions
  ): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, options))
    }
    return this.breakers.get(name)!
  }

  /**
   * Remove a circuit breaker
   */
  static removeBreaker(name: string): void {
    const breaker = this.breakers.get(name)
    if (breaker) {
      breaker.destroy()
      this.breakers.delete(name)
    }
  }

  /**
   * Get all circuit breakers
   */
  static getAllBreakers(): Map<string, CircuitBreaker> {
    return new Map(this.breakers)
  }

  /**
   * Reset all circuit breakers
   */
  static resetAll(): void {
    this.breakers.forEach(breaker => breaker.reset())
  }

  /**
   * Destroy all circuit breakers
   */
  static destroyAll(): void {
    this.breakers.forEach(breaker => breaker.destroy())
    this.breakers.clear()
  }
}