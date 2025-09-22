/**
 * CircuitBreaker Tests
 * Comprehensive tests for circuit breaker pattern implementation
 */

import { CircuitBreaker, CircuitState, CircuitBreakerFactory } from '../utils/CircuitBreaker'

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker

  beforeEach(() => {
    jest.useFakeTimers()
    breaker = new CircuitBreaker('test-breaker', {
      failureThreshold: 3,
      resetTimeout: 5000,
      successThreshold: 0.5,
      testRequests: 2,
      requestTimeout: 1000
    })
  })

  afterEach(() => {
    breaker.destroy()
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  describe('initial state', () => {
    it('should start in CLOSED state', () => {
      expect(breaker.getState()).toBe(CircuitState.CLOSED)
    })

    it('should have zero initial statistics', () => {
      const stats = breaker.getStats()
      expect(stats.failures).toBe(0)
      expect(stats.successes).toBe(0)
      expect(stats.totalRequests).toBe(0)
      expect(stats.consecutiveFailures).toBe(0)
    })
  })

  describe('successful execution', () => {
    it('should execute function successfully in CLOSED state', async () => {
      const fn = jest.fn().mockResolvedValue('success')
      const result = await breaker.execute(fn)

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(1)
      expect(breaker.getState()).toBe(CircuitState.CLOSED)
    })

    it('should update statistics on success', async () => {
      await breaker.execute(() => Promise.resolve('success'))

      const stats = breaker.getStats()
      expect(stats.successes).toBe(1)
      expect(stats.totalRequests).toBe(1)
      expect(stats.successRate).toBe(1)
      expect(stats.lastSuccessTime).toBeDefined()
    })

    it('should reset consecutive failures on success', async () => {
      // Force some failures
      const failFn = jest.fn().mockRejectedValue(new Error('fail'))
      try {
        await breaker.execute(failFn)
      } catch {}
      try {
        await breaker.execute(failFn)
      } catch {}

      let stats = breaker.getStats()
      expect(stats.consecutiveFailures).toBe(2)

      // Now succeed
      await breaker.execute(() => Promise.resolve('success'))

      stats = breaker.getStats()
      expect(stats.consecutiveFailures).toBe(0)
      expect(stats.consecutiveSuccesses).toBe(1)
    })
  })

  describe('failure handling', () => {
    it('should propagate errors in CLOSED state', async () => {
      const error = new Error('test error')
      const fn = jest.fn().mockRejectedValue(error)

      await expect(breaker.execute(fn)).rejects.toThrow('test error')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should open circuit after threshold failures', async () => {
      const failFn = jest.fn().mockRejectedValue(new Error('fail'))

      // Fail 3 times (threshold)
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failFn)
        } catch {}
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN)
      expect(failFn).toHaveBeenCalledTimes(3)
    })

    it('should track failures within time window', async () => {
      const failFn = jest.fn().mockRejectedValue(new Error('fail'))

      // Configure breaker with time window
      const windowBreaker = new CircuitBreaker('window-test', {
        failureThreshold: 3,
        failureWindow: 10000, // 10 seconds
        resetTimeout: 5000
      })

      // Two failures
      try { await windowBreaker.execute(failFn) } catch {}
      try { await windowBreaker.execute(failFn) } catch {}

      // Advance time past window
      jest.advanceTimersByTime(11000)

      // One more failure - should not open circuit
      try { await windowBreaker.execute(failFn) } catch {}

      expect(windowBreaker.getState()).toBe(CircuitState.CLOSED)

      windowBreaker.destroy()
    })

    it('should use custom isFailure function', async () => {
      const customBreaker = new CircuitBreaker('custom', {
        failureThreshold: 2,
        isFailure: (error: any) => error.message === 'critical'
      })

      // Non-critical errors should not count
      const nonCritical = jest.fn().mockRejectedValue(new Error('minor'))
      try { await customBreaker.execute(nonCritical) } catch {}
      try { await customBreaker.execute(nonCritical) } catch {}

      expect(customBreaker.getState()).toBe(CircuitState.CLOSED)

      // Critical errors should count
      const critical = jest.fn().mockRejectedValue(new Error('critical'))
      try { await customBreaker.execute(critical) } catch {}
      try { await customBreaker.execute(critical) } catch {}

      expect(customBreaker.getState()).toBe(CircuitState.OPEN)

      customBreaker.destroy()
    })
  })

  describe('OPEN state', () => {
    beforeEach(async () => {
      // Open the circuit
      const failFn = jest.fn().mockRejectedValue(new Error('fail'))
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failFn)
        } catch {}
      }
    })

    it('should reject requests immediately when OPEN', async () => {
      const fn = jest.fn().mockResolvedValue('success')

      await expect(breaker.execute(fn)).rejects.toThrow('Circuit breaker test-breaker is OPEN')
      expect(fn).not.toHaveBeenCalled()
    })

    it('should use fallback when available', async () => {
      const fallbackBreaker = new CircuitBreaker('fallback-test', {
        failureThreshold: 1,
        fallback: () => Promise.resolve('fallback-value')
      })

      // Open the circuit
      try {
        await fallbackBreaker.execute(() => Promise.reject(new Error('fail')))
      } catch {}

      // Should use fallback
      const result = await fallbackBreaker.execute(() => Promise.resolve('normal'))
      expect(result).toBe('fallback-value')

      fallbackBreaker.destroy()
    })

    it('should transition to HALF_OPEN after reset timeout', async () => {
      expect(breaker.getState()).toBe(CircuitState.OPEN)

      // Advance time by reset timeout
      jest.advanceTimersByTime(5000)

      // Circuit should be HALF_OPEN (checked when next request comes)
      // Force state check by attempting execution
      const fn = jest.fn().mockResolvedValue('success')
      await breaker.execute(fn)

      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN)
    })
  })

  describe('HALF_OPEN state', () => {
    beforeEach(async () => {
      // Open the circuit
      const failFn = jest.fn().mockRejectedValue(new Error('fail'))
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failFn)
        } catch {}
      }

      // Transition to HALF_OPEN
      jest.advanceTimersByTime(5000)
    })

    it('should allow test requests in HALF_OPEN state', async () => {
      const fn = jest.fn().mockResolvedValue('success')
      const result = await breaker.execute(fn)

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalled()
      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN)
    })

    it('should close circuit after successful test requests', async () => {
      const fn = jest.fn().mockResolvedValue('success')

      // Need 2 successful test requests (testRequests: 2)
      await breaker.execute(fn)
      await breaker.execute(fn)

      expect(breaker.getState()).toBe(CircuitState.CLOSED)
    })

    it('should reopen circuit on test failure', async () => {
      // First request succeeds
      await breaker.execute(() => Promise.resolve('success'))
      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN)

      // Second request fails
      const failFn = jest.fn().mockRejectedValue(new Error('fail'))
      try {
        await breaker.execute(failFn)
      } catch {}

      expect(breaker.getState()).toBe(CircuitState.OPEN)
    })

    it('should respect success threshold', async () => {
      // successThreshold is 0.5, need 50% success rate
      const successFn = jest.fn().mockResolvedValue('success')

      // Execute test requests
      await breaker.execute(successFn)
      await breaker.execute(successFn)

      // Should close with 100% success rate
      expect(breaker.getState()).toBe(CircuitState.CLOSED)
    })
  })

  describe('timeout handling', () => {
    it('should timeout long-running requests', async () => {
      const slowFn = jest.fn(() => new Promise(resolve => {
        setTimeout(() => resolve('slow'), 2000)
      }))

      const promise = breaker.execute(slowFn)

      // Advance timers to trigger timeout
      jest.advanceTimersByTime(1001)

      await expect(promise).rejects.toThrow('Request timeout after 1000ms')
    })

    it('should count timeouts as failures', async () => {
      const slowFn = () => new Promise(resolve => {
        setTimeout(() => resolve('slow'), 2000)
      })

      // Three timeouts should open circuit
      for (let i = 0; i < 3; i++) {
        const promise = breaker.execute(slowFn)
        jest.advanceTimersByTime(1001)
        try {
          await promise
        } catch {}
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN)
    })
  })

  describe('event emission', () => {
    it('should emit success events', async () => {
      const listener = jest.fn()
      breaker.on('success', listener)

      await breaker.execute(() => Promise.resolve('success'))

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'success',
          state: CircuitState.CLOSED,
          timestamp: expect.any(Date)
        })
      )
    })

    it('should emit failure events', async () => {
      const listener = jest.fn()
      breaker.on('failure', listener)

      try {
        await breaker.execute(() => Promise.reject(new Error('fail')))
      } catch {}

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'failure',
          state: CircuitState.CLOSED,
          error: expect.any(Error)
        })
      )
    })

    it('should emit state change events', async () => {
      const listener = jest.fn()
      breaker.on('state_change', listener)

      // Trigger state change to OPEN
      const failFn = () => Promise.reject(new Error('fail'))
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failFn)
        } catch {}
      }

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'state_change',
          state: CircuitState.OPEN,
          metadata: { previousState: CircuitState.CLOSED }
        })
      )
    })

    it('should call monitor function if provided', async () => {
      const monitor = jest.fn()
      const monitoredBreaker = new CircuitBreaker('monitored', {
        failureThreshold: 3,
        monitor
      })

      await monitoredBreaker.execute(() => Promise.resolve('success'))

      expect(monitor).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'success',
          state: CircuitState.CLOSED
        })
      )

      monitoredBreaker.destroy()
    })
  })

  describe('manual controls', () => {
    it('should allow forcing circuit open', () => {
      breaker.forceOpen()
      expect(breaker.getState()).toBe(CircuitState.OPEN)
    })

    it('should allow forcing circuit closed', async () => {
      // First open it
      breaker.forceOpen()
      expect(breaker.getState()).toBe(CircuitState.OPEN)

      // Force close
      breaker.forceClose()
      expect(breaker.getState()).toBe(CircuitState.CLOSED)

      // Should allow execution
      const result = await breaker.execute(() => Promise.resolve('success'))
      expect(result).toBe('success')
    })

    it('should reset all statistics', async () => {
      // Generate some statistics
      await breaker.execute(() => Promise.resolve('success'))
      try {
        await breaker.execute(() => Promise.reject(new Error('fail')))
      } catch {}

      breaker.reset()

      const stats = breaker.getStats()
      expect(stats.failures).toBe(0)
      expect(stats.successes).toBe(0)
      expect(stats.totalRequests).toBe(0)
      expect(stats.state).toBe(CircuitState.CLOSED)
    })
  })

  describe('CircuitBreakerFactory', () => {
    afterEach(() => {
      CircuitBreakerFactory.destroyAll()
    })

    it('should create and cache breakers', () => {
      const breaker1 = CircuitBreakerFactory.getBreaker('shared')
      const breaker2 = CircuitBreakerFactory.getBreaker('shared')

      expect(breaker1).toBe(breaker2)
    })

    it('should remove specific breaker', () => {
      const breaker = CircuitBreakerFactory.getBreaker('to-remove')
      const destroySpy = jest.spyOn(breaker, 'destroy')

      CircuitBreakerFactory.removeBreaker('to-remove')

      expect(destroySpy).toHaveBeenCalled()

      // Getting it again should return new instance
      const newBreaker = CircuitBreakerFactory.getBreaker('to-remove')
      expect(newBreaker).not.toBe(breaker)
    })

    it('should get all breakers', () => {
      CircuitBreakerFactory.getBreaker('breaker1')
      CircuitBreakerFactory.getBreaker('breaker2')
      CircuitBreakerFactory.getBreaker('breaker3')

      const allBreakers = CircuitBreakerFactory.getAllBreakers()
      expect(allBreakers.size).toBe(3)
      expect(allBreakers.has('breaker1')).toBe(true)
      expect(allBreakers.has('breaker2')).toBe(true)
      expect(allBreakers.has('breaker3')).toBe(true)
    })

    it('should reset all breakers', () => {
      const breaker1 = CircuitBreakerFactory.getBreaker('breaker1')
      const breaker2 = CircuitBreakerFactory.getBreaker('breaker2')

      const reset1Spy = jest.spyOn(breaker1, 'reset')
      const reset2Spy = jest.spyOn(breaker2, 'reset')

      CircuitBreakerFactory.resetAll()

      expect(reset1Spy).toHaveBeenCalled()
      expect(reset2Spy).toHaveBeenCalled()
    })

    it('should destroy all breakers', () => {
      const breaker1 = CircuitBreakerFactory.getBreaker('breaker1')
      const breaker2 = CircuitBreakerFactory.getBreaker('breaker2')

      const destroy1Spy = jest.spyOn(breaker1, 'destroy')
      const destroy2Spy = jest.spyOn(breaker2, 'destroy')

      CircuitBreakerFactory.destroyAll()

      expect(destroy1Spy).toHaveBeenCalled()
      expect(destroy2Spy).toHaveBeenCalled()

      const allBreakers = CircuitBreakerFactory.getAllBreakers()
      expect(allBreakers.size).toBe(0)
    })
  })
})