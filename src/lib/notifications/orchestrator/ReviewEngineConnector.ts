/**
 * ReviewEngineConnector
 * Robust connection to Review Engine with retry logic
 */

import { EventEmitter } from 'events'
import { ReviewEventType, ReviewEvent } from '@/lib/review-engine/core/events'
import { reviewLogger } from '@/lib/monitoring/logger'

/**
 * Review Engine connector options
 */
export interface ConnectorOptions {
  maxRetries?: number
  retryDelay?: number
  exponentialBackoff?: boolean
}

/**
 * Connection state
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  FAILED = 'failed'
}

/**
 * ReviewEngineConnector class
 * Handles robust connection to Review Engine with retry logic
 */
export class ReviewEngineConnector extends EventEmitter {
  private state: ConnectionState = ConnectionState.DISCONNECTED
  private retryCount = 0
  private maxRetries: number
  private retryDelay: number
  private exponentialBackoff: boolean
  private connectionTimer?: NodeJS.Timeout
  private reviewEngine?: any
  private eventHandlers: Map<string, Function> = new Map()

  constructor(options: ConnectorOptions = {}) {
    super()
    this.maxRetries = options.maxRetries || 5
    this.retryDelay = options.retryDelay || 1000
    this.exponentialBackoff = options.exponentialBackoff !== false
  }

  /**
   * Connect to Review Engine
   */
  async connect(): Promise<boolean> {
    if (this.state === ConnectionState.CONNECTED) {
      reviewLogger.info('Already connected to Review Engine')
      return true
    }

    if (this.state === ConnectionState.CONNECTING) {
      reviewLogger.info('Connection already in progress')
      return this.waitForConnection()
    }

    this.state = ConnectionState.CONNECTING
    this.emit('connecting')

    try {
      const engine = await this.findReviewEngine()

      if (engine) {
        this.reviewEngine = engine
        this.state = ConnectionState.CONNECTED
        this.retryCount = 0

        reviewLogger.info('Successfully connected to Review Engine')
        this.emit('connected', engine)

        // Set up reconnection monitoring
        this.startConnectionMonitoring()

        return true
      }

      // No engine found, start retry process
      return await this.retryConnection()
    } catch (error) {
      reviewLogger.error('Failed to connect to Review Engine', error)
      this.state = ConnectionState.FAILED
      this.emit('error', error)
      return false
    }
  }

  /**
   * Find Review Engine instance using multiple strategies
   */
  private async findReviewEngine(): Promise<any> {
    // Strategy 1: Check global window object
    if (typeof window !== 'undefined') {
      // Try multiple possible locations
      const candidates = [
        (window as any).__REVIEW_ENGINE_INSTANCE__,
        (window as any).reviewEngine,
        (window as any).ReviewEngine?.instance,
        (window as any).moshimoshi?.reviewEngine
      ]

      for (const candidate of candidates) {
        if (candidate && this.isValidReviewEngine(candidate)) {
          reviewLogger.info('Found Review Engine via global object')
          return candidate
        }
      }

      // Strategy 2: Check DOM elements
      const engineElement = document.querySelector('[data-review-engine]') as any
      if (engineElement?.__engine && this.isValidReviewEngine(engineElement.__engine)) {
        reviewLogger.info('Found Review Engine via DOM element')
        return engineElement.__engine
      }

      // Strategy 3: Check React context (if using React)
      const reactRoot = document.getElementById('__next') || document.getElementById('root')
      if (reactRoot) {
        const fiber = (reactRoot as any)._reactRootContainer?._internalRoot?.current
        const engine = this.findInReactFiber(fiber, 'reviewEngine')
        if (engine && this.isValidReviewEngine(engine)) {
          reviewLogger.info('Found Review Engine via React context')
          return engine
        }
      }
    }

    return null
  }

  /**
   * Validate Review Engine instance
   */
  private isValidReviewEngine(engine: any): boolean {
    return engine &&
           typeof engine.on === 'function' &&
           typeof engine.off === 'function' &&
           typeof engine.emit === 'function'
  }

  /**
   * Search React fiber tree for Review Engine
   */
  private findInReactFiber(fiber: any, key: string): any {
    if (!fiber) return null

    // Check current fiber
    if (fiber.memoizedProps?.[key]) {
      return fiber.memoizedProps[key]
    }

    if (fiber.memoizedState?.context?.[key]) {
      return fiber.memoizedState.context[key]
    }

    // Recursively search children
    let child = fiber.child
    while (child) {
      const result = this.findInReactFiber(child, key)
      if (result) return result
      child = child.sibling
    }

    return null
  }

  /**
   * Retry connection with exponential backoff
   */
  private async retryConnection(): Promise<boolean> {
    if (this.retryCount >= this.maxRetries) {
      reviewLogger.error('Max retries exceeded, giving up')
      this.state = ConnectionState.FAILED
      this.emit('failed', new Error('Could not connect to Review Engine'))
      return false
    }

    this.retryCount++

    const delay = this.exponentialBackoff
      ? this.retryDelay * Math.pow(2, this.retryCount - 1)
      : this.retryDelay

    reviewLogger.info(`Retrying connection in ${delay}ms (attempt ${this.retryCount}/${this.maxRetries})`)

    await this.delay(delay)

    // Try to connect again
    const engine = await this.findReviewEngine()

    if (engine) {
      this.reviewEngine = engine
      this.state = ConnectionState.CONNECTED
      this.retryCount = 0

      reviewLogger.info('Successfully connected to Review Engine after retry')
      this.emit('connected', engine)

      this.startConnectionMonitoring()
      return true
    }

    // Continue retrying
    return this.retryConnection()
  }

  /**
   * Wait for existing connection attempt
   */
  private waitForConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      const checkConnection = () => {
        if (this.state === ConnectionState.CONNECTED) {
          resolve(true)
        } else if (this.state === ConnectionState.FAILED) {
          resolve(false)
        } else {
          setTimeout(checkConnection, 100)
        }
      }
      checkConnection()
    })
  }

  /**
   * Start monitoring connection health
   */
  private startConnectionMonitoring(): void {
    this.stopConnectionMonitoring()

    this.connectionTimer = setInterval(() => {
      if (!this.reviewEngine || !this.isValidReviewEngine(this.reviewEngine)) {
        reviewLogger.warn('Lost connection to Review Engine, attempting to reconnect')
        this.state = ConnectionState.DISCONNECTED
        this.emit('disconnected')

        // Clear timer and reconnect
        this.stopConnectionMonitoring()
        this.connect()
      }
    }, 5000) // Check every 5 seconds
  }

  /**
   * Stop connection monitoring
   */
  private stopConnectionMonitoring(): void {
    if (this.connectionTimer) {
      clearInterval(this.connectionTimer)
      this.connectionTimer = undefined
    }
  }

  /**
   * Subscribe to Review Engine event
   */
  on(event: ReviewEventType | string, handler: Function): this {
    super.on(event, handler as any)

    // If connected, also subscribe to Review Engine
    if (this.reviewEngine && this.state === ConnectionState.CONNECTED) {
      this.reviewEngine.on(event, handler)
      this.eventHandlers.set(`${event}_${handler.toString()}`, handler)
    }

    return this
  }

  /**
   * Unsubscribe from Review Engine event
   */
  off(event: ReviewEventType | string, handler: Function): this {
    super.off(event, handler as any)

    // If connected, also unsubscribe from Review Engine
    if (this.reviewEngine && this.state === ConnectionState.CONNECTED) {
      this.reviewEngine.off(event, handler)
      this.eventHandlers.delete(`${event}_${handler.toString()}`)
    }

    return this
  }

  /**
   * Forward event to Review Engine
   */
  emit(event: ReviewEventType | string, ...args: any[]): boolean {
    // Emit locally
    const localResult = super.emit(event, ...args)

    // Forward to Review Engine if connected
    if (this.reviewEngine && this.state === ConnectionState.CONNECTED) {
      try {
        this.reviewEngine.emit(event, ...args)
      } catch (error) {
        reviewLogger.error('Failed to emit event to Review Engine', { event, error })
      }
    }

    return localResult
  }

  /**
   * Get connection state
   */
  getState(): ConnectionState {
    return this.state
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state === ConnectionState.CONNECTED
  }

  /**
   * Disconnect and clean up
   */
  disconnect(): void {
    reviewLogger.info('Disconnecting from Review Engine')

    // Remove all event handlers
    if (this.reviewEngine) {
      this.eventHandlers.forEach((handler, key) => {
        const [event] = key.split('_')
        this.reviewEngine.off(event, handler)
      })
      this.eventHandlers.clear()
    }

    // Stop monitoring
    this.stopConnectionMonitoring()

    // Reset state
    this.reviewEngine = undefined
    this.state = ConnectionState.DISCONNECTED
    this.retryCount = 0

    this.emit('disconnected')
    this.removeAllListeners()
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get retry statistics
   */
  getStats() {
    return {
      state: this.state,
      retryCount: this.retryCount,
      maxRetries: this.maxRetries,
      connected: this.isConnected(),
      hasEngine: !!this.reviewEngine
    }
  }
}