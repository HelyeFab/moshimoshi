/**
 * TimerManager Tests
 * Comprehensive tests for timer management and memory leak prevention
 */

import { TimerManager, getTimerManager, destroyTimerManager, destroyAllTimerManagers } from '../utils/TimerManager'

describe('TimerManager', () => {
  let manager: TimerManager

  beforeEach(() => {
    jest.useFakeTimers()
    manager = new TimerManager('test')
  })

  afterEach(() => {
    manager.destroy()
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  describe('setTimeout', () => {
    it('should execute callback after specified delay', () => {
      const callback = jest.fn()
      manager.setTimeout(callback, 1000)

      expect(callback).not.toHaveBeenCalled()
      jest.advanceTimersByTime(1000)
      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('should return unique timer ID', () => {
      const id1 = manager.setTimeout(() => {}, 1000)
      const id2 = manager.setTimeout(() => {}, 1000)

      expect(id1).not.toBe(id2)
    })

    it('should track active timers', () => {
      expect(manager.getActiveCount()).toBe(0)

      manager.setTimeout(() => {}, 1000)
      manager.setTimeout(() => {}, 2000)

      expect(manager.getActiveCount()).toBe(2)
    })

    it('should remove timer after execution', () => {
      manager.setTimeout(() => {}, 1000)
      expect(manager.getActiveCount()).toBe(1)

      jest.advanceTimersByTime(1000)
      expect(manager.getActiveCount()).toBe(0)
    })

    it('should handle errors in callback', () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Test error')
      })

      manager.setTimeout(errorCallback, 1000)

      // Should not throw
      expect(() => jest.advanceTimersByTime(1000)).not.toThrow()
      expect(errorCallback).toHaveBeenCalled()
    })

    it('should respect custom timer ID', () => {
      const customId = 'custom-timer-123'
      const returnedId = manager.setTimeout(() => {}, 1000, customId)

      expect(returnedId).toBe(customId)
      expect(manager.hasTimer(customId)).toBe(true)
    })

    it('should cancel existing timer with same ID', () => {
      const callback1 = jest.fn()
      const callback2 = jest.fn()

      manager.setTimeout(callback1, 1000, 'same-id')
      manager.setTimeout(callback2, 500, 'same-id')

      jest.advanceTimersByTime(500)
      expect(callback1).not.toHaveBeenCalled()
      expect(callback2).toHaveBeenCalled()
    })

    it('should enforce maximum timer limit', () => {
      // Create manager with low limit for testing
      const limitedManager = new TimerManager('limited')
      ;(limitedManager as any).maxTimers = 2

      limitedManager.setTimeout(() => {}, 1000)
      limitedManager.setTimeout(() => {}, 1000)

      expect(() => limitedManager.setTimeout(() => {}, 1000)).toThrow('Maximum timer limit reached')

      limitedManager.destroy()
    })
  })

  describe('setInterval', () => {
    it('should execute callback repeatedly', () => {
      const callback = jest.fn()
      manager.setInterval(callback, 1000)

      jest.advanceTimersByTime(3500)
      expect(callback).toHaveBeenCalledTimes(3)
    })

    it('should track execution count in metadata', () => {
      manager.setInterval(() => {}, 1000, 'interval-1')
      const timer = manager.getTimer('interval-1')

      expect(timer?.metadata?.executionCount).toBe(0)
    })

    it('should handle errors without stopping interval', () => {
      let callCount = 0
      const errorCallback = jest.fn(() => {
        callCount++
        if (callCount === 2) {
          throw new Error('Test error')
        }
      })

      manager.setInterval(errorCallback, 1000)

      jest.advanceTimersByTime(3500)
      expect(errorCallback).toHaveBeenCalledTimes(3) // Continues despite error
    })
  })

  describe('clearTimer', () => {
    it('should cancel timeout', () => {
      const callback = jest.fn()
      const id = manager.setTimeout(callback, 1000)

      manager.clearTimer(id)
      jest.advanceTimersByTime(1000)

      expect(callback).not.toHaveBeenCalled()
      expect(manager.getActiveCount()).toBe(0)
    })

    it('should cancel interval', () => {
      const callback = jest.fn()
      const id = manager.setInterval(callback, 1000)

      jest.advanceTimersByTime(1500)
      expect(callback).toHaveBeenCalledTimes(1)

      manager.clearTimer(id)
      jest.advanceTimersByTime(2000)

      expect(callback).toHaveBeenCalledTimes(1) // No additional calls
    })

    it('should return false for non-existent timer', () => {
      expect(manager.clearTimer('non-existent')).toBe(false)
    })

    it('should update statistics', () => {
      const id = manager.setTimeout(() => {}, 1000)
      const statsBefore = manager.getStats()

      manager.clearTimer(id)
      const statsAfter = manager.getStats()

      expect(statsAfter.totalCleared).toBe(statsBefore.totalCleared + 1)
    })
  })

  describe('clearAll', () => {
    it('should clear all active timers', () => {
      const callbacks = [jest.fn(), jest.fn(), jest.fn()]

      callbacks.forEach((cb, i) => {
        manager.setTimeout(cb, (i + 1) * 1000)
      })

      expect(manager.getActiveCount()).toBe(3)

      manager.clearAll()
      expect(manager.getActiveCount()).toBe(0)

      jest.advanceTimersByTime(3000)
      callbacks.forEach(cb => {
        expect(cb).not.toHaveBeenCalled()
      })
    })
  })

  describe('clearByMetadata', () => {
    it('should clear timers matching metadata filter', () => {
      manager.setTimeout(() => {}, 1000, 'timer1', { type: 'notification' })
      manager.setTimeout(() => {}, 1000, 'timer2', { type: 'reminder' })
      manager.setTimeout(() => {}, 1000, 'timer3', { type: 'notification' })

      const cleared = manager.clearByMetadata(meta => meta?.type === 'notification')

      expect(cleared).toBe(2)
      expect(manager.getActiveCount()).toBe(1)
      expect(manager.hasTimer('timer2')).toBe(true)
    })
  })

  describe('reschedule', () => {
    it('should reschedule existing timeout', () => {
      const callback = jest.fn()
      const id = manager.setTimeout(callback, 1000, 'reschedule-test')

      manager.reschedule('reschedule-test', 2000)

      jest.advanceTimersByTime(1000)
      expect(callback).not.toHaveBeenCalled()

      jest.advanceTimersByTime(1000)
      expect(callback).toHaveBeenCalled()
    })

    it('should return false for non-timeout timer', () => {
      manager.setInterval(() => {}, 1000, 'interval-test')
      expect(manager.reschedule('interval-test', 2000)).toBe(false)
    })
  })

  describe('pauseAll and resumeAll', () => {
    it('should pause and resume all timers', () => {
      const callback1 = jest.fn()
      const callback2 = jest.fn()

      manager.setTimeout(callback1, 1000, 'timer1')
      manager.setTimeout(callback2, 2000, 'timer2')

      // Pause all timers
      const paused = manager.pauseAll()
      expect(paused.size).toBe(2)
      expect(manager.getActiveCount()).toBe(0)

      // Advance time - callbacks should not fire
      jest.advanceTimersByTime(2000)
      expect(callback1).not.toHaveBeenCalled()
      expect(callback2).not.toHaveBeenCalled()

      // Resume timers
      manager.resumeAll(paused)
      expect(manager.getActiveCount()).toBe(2)

      // Now callbacks should fire at adjusted times
      jest.advanceTimersByTime(1000)
      expect(callback1).toHaveBeenCalled()

      jest.advanceTimersByTime(1000)
      expect(callback2).toHaveBeenCalled()
    })
  })

  describe('memory management', () => {
    it('should update memory usage estimates', () => {
      const statsBefore = manager.getStats()

      manager.setTimeout(() => {}, 1000)
      manager.setTimeout(() => {}, 1000)

      const statsAfter = manager.getStats()
      expect(statsAfter.memoryUsage).toBeGreaterThan(statsBefore.memoryUsage)
    })

    it('should clean up expired timeouts automatically', () => {
      // Mock the private cleanupExpired method
      const cleanupSpy = jest.spyOn(manager as any, 'cleanupExpired')

      // Trigger cleanup (normally runs every 30 seconds)
      jest.advanceTimersByTime(30000)

      expect(cleanupSpy).toHaveBeenCalled()
    })
  })

  describe('destroy', () => {
    it('should clear all timers on destroy', () => {
      const callback = jest.fn()
      manager.setTimeout(callback, 1000)

      manager.destroy()
      jest.advanceTimersByTime(1000)

      expect(callback).not.toHaveBeenCalled()
    })

    it('should prevent new timers after destroy', () => {
      manager.destroy()

      expect(() => manager.setTimeout(() => {}, 1000)).toThrow('TimerManager test has been destroyed')
    })
  })

  describe('global instances', () => {
    afterEach(() => {
      destroyAllTimerManagers()
    })

    it('should return same instance for same name', () => {
      const instance1 = getTimerManager('shared')
      const instance2 = getTimerManager('shared')

      expect(instance1).toBe(instance2)
    })

    it('should return different instances for different names', () => {
      const instance1 = getTimerManager('manager1')
      const instance2 = getTimerManager('manager2')

      expect(instance1).not.toBe(instance2)
    })

    it('should destroy specific manager', () => {
      const instance = getTimerManager('to-destroy')
      destroyTimerManager('to-destroy')

      const newInstance = getTimerManager('to-destroy')
      expect(newInstance).not.toBe(instance)
    })
  })

  describe('statistics', () => {
    it('should track timer statistics accurately', () => {
      manager.setTimeout(() => {}, 1000)
      manager.setTimeout(() => {}, 2000)
      manager.setInterval(() => {}, 1000)

      const id = manager.setTimeout(() => {}, 3000)
      manager.clearTimer(id)

      jest.advanceTimersByTime(2000)

      const stats = manager.getStats()
      expect(stats.activeTimers).toBe(1) // Only interval remains
      expect(stats.totalCreated).toBe(4)
      expect(stats.totalCleared).toBe(1)
      expect(stats.totalFired).toBe(3) // 2 timeouts + 1 interval execution
    })
  })
})