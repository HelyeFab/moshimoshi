/**
 * ClientEventEmitter Tests
 *
 * Tests browser-compatible EventEmitter implementation
 * Coverage target: 85%+
 */

import { ClientEventEmitter } from '../core/client-event-emitter';

describe('ClientEventEmitter', () => {
  let emitter: ClientEventEmitter;

  beforeEach(() => {
    emitter = new ClientEventEmitter();
  });

  afterEach(() => {
    emitter.removeAllListeners();
  });

  describe('Basic Event Emission', () => {
    test('should emit and listen to events', () => {
      const listener = jest.fn();
      emitter.on('test-event', listener);

      emitter.emit('test-event', 'data');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith('data');
    });

    test('should handle multiple arguments', () => {
      const listener = jest.fn();
      emitter.on('multi-arg', listener);

      emitter.emit('multi-arg', 'arg1', 'arg2', 123);

      expect(listener).toHaveBeenCalledWith('arg1', 'arg2', 123);
    });

    test('should call multiple listeners for same event', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const listener3 = jest.fn();

      emitter.on('test', listener1);
      emitter.on('test', listener2);
      emitter.on('test', listener3);

      emitter.emit('test', 'data');

      expect(listener1).toHaveBeenCalledWith('data');
      expect(listener2).toHaveBeenCalledWith('data');
      expect(listener3).toHaveBeenCalledWith('data');
    });

    test('should return true when event has listeners', () => {
      emitter.on('test', () => {});
      const result = emitter.emit('test');
      expect(result).toBe(true);
    });

    test('should return false when event has no listeners', () => {
      const result = emitter.emit('no-listeners');
      expect(result).toBe(false);
    });
  });

  describe('Listener Management', () => {
    test('should remove specific listener', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      emitter.on('test', listener1);
      emitter.on('test', listener2);
      emitter.off('test', listener1);

      emitter.emit('test', 'data');

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledWith('data');
    });

    test('should remove all listeners for event', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      emitter.on('test', listener1);
      emitter.on('test', listener2);
      emitter.removeAllListeners('test');

      emitter.emit('test', 'data');

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });

    test('should remove all listeners for all events', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      emitter.on('event1', listener1);
      emitter.on('event2', listener2);
      emitter.removeAllListeners();

      emitter.emit('event1', 'data1');
      emitter.emit('event2', 'data2');

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });

    test('should handle removing non-existent listener gracefully', () => {
      const listener = jest.fn();
      expect(() => emitter.off('test', listener)).not.toThrow();
    });
  });

  describe('once() Method', () => {
    test('should call listener only once', () => {
      const listener = jest.fn();
      emitter.once('test', listener);

      emitter.emit('test', 'data1');
      emitter.emit('test', 'data2');
      emitter.emit('test', 'data3');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith('data1');
    });

    test('should auto-remove listener after first call', () => {
      const listener = jest.fn();
      emitter.once('test', listener);

      emitter.emit('test');
      expect(emitter.listenerCount('test')).toBe(0);
    });
  });

  describe('Listener Count', () => {
    test('should return correct listener count', () => {
      expect(emitter.listenerCount('test')).toBe(0);

      emitter.on('test', () => {});
      expect(emitter.listenerCount('test')).toBe(1);

      emitter.on('test', () => {});
      expect(emitter.listenerCount('test')).toBe(2);

      emitter.on('test', () => {});
      expect(emitter.listenerCount('test')).toBe(3);
    });

    test('should return 0 for non-existent event', () => {
      expect(emitter.listenerCount('non-existent')).toBe(0);
    });

    test('should update count after removing listeners', () => {
      const listener = jest.fn();
      emitter.on('test', listener);
      emitter.on('test', () => {});

      expect(emitter.listenerCount('test')).toBe(2);

      emitter.off('test', listener);
      expect(emitter.listenerCount('test')).toBe(1);
    });
  });

  describe('Memory Leak Detection', () => {
    test('should warn when max listeners exceeded', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      emitter.setMaxListeners(3);

      emitter.on('test', () => {});
      emitter.on('test', () => {});
      emitter.on('test', () => {});
      expect(consoleSpy).not.toHaveBeenCalled();

      // This should trigger warning
      emitter.on('test', () => {});
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('MaxListenersExceededWarning')
      );

      consoleSpy.mockRestore();
    });

    test('should allow setting max listeners', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      emitter.setMaxListeners(20);

      for (let i = 0; i < 15; i++) {
        emitter.on('test', () => {});
      }

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    test('should catch errors in listeners', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const goodListener1 = jest.fn();
      const goodListener2 = jest.fn();
      const badListener = jest.fn(() => {
        throw new Error('Listener error');
      });

      emitter.on('test', goodListener1);
      emitter.on('test', badListener);
      emitter.on('test', goodListener2);

      emitter.emit('test', 'data');

      // All good listeners should still be called
      expect(goodListener1).toHaveBeenCalledTimes(1);
      expect(goodListener2).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in event listener'),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    test('should not stop emission on listener error', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn(() => { throw new Error('fail'); });
      const listener3 = jest.fn();

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      emitter.on('test', listener1);
      emitter.on('test', listener2);
      emitter.on('test', listener3);

      emitter.emit('test');

      // All listeners should be called despite error
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in event listener'),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Chaining', () => {
    test('should allow method chaining on()', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      const result = emitter
        .on('event1', listener1)
        .on('event2', listener2);

      expect(result).toBe(emitter);

      emitter.emit('event1');
      emitter.emit('event2');

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    test('should allow method chaining off()', () => {
      const listener = jest.fn();
      emitter.on('test', listener);

      const result = emitter.off('test', listener);
      expect(result).toBe(emitter);
    });

    test('should allow method chaining removeAllListeners()', () => {
      const result = emitter.removeAllListeners();
      expect(result).toBe(emitter);
    });

    test('should allow method chaining setMaxListeners()', () => {
      const result = emitter.setMaxListeners(20);
      expect(result).toBe(emitter);
    });
  });

  describe('Async Listeners', () => {
    test('should support async listeners', async () => {
      const results: string[] = [];

      emitter.on('async-test', async (data: string) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        results.push(data);
      });

      emitter.emit('async-test', 'data1');
      emitter.emit('async-test', 'data2');

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(results).toContain('data1');
      expect(results).toContain('data2');
    });
  });

  describe('Edge Cases', () => {
    test('should prevent duplicate listeners (Set behavior)', () => {
      const listener = jest.fn();

      emitter.on('test', listener);
      emitter.on('test', listener);
      emitter.on('test', listener);

      // Set prevents duplicates - this is better than Node.js EventEmitter
      expect(emitter.listenerCount('test')).toBe(1);

      emitter.emit('test');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    test('should handle removing listener during emission', () => {
      const listener2 = jest.fn();
      const listener1 = jest.fn(() => {
        emitter.off('test', listener2);
      });

      emitter.on('test', listener1);
      emitter.on('test', listener2);

      emitter.emit('test');

      // listener2 may or may not be called depending on order
      // But this shouldn't crash
      expect(listener1).toHaveBeenCalled();
    });

    test('should handle empty event name', () => {
      const listener = jest.fn();
      emitter.on('', listener);

      emitter.emit('', 'data');
      expect(listener).toHaveBeenCalledWith('data');
    });

    test('should handle special characters in event names', () => {
      const listener = jest.fn();
      const eventName = 'event:with.special-chars_123';

      emitter.on(eventName, listener);
      emitter.emit(eventName, 'data');

      expect(listener).toHaveBeenCalledWith('data');
    });
  });

  describe('Performance', () => {
    test('should handle many listeners efficiently', () => {
      const start = Date.now();

      // Add 1000 unique listeners
      const listeners = [];
      for (let i = 0; i < 1000; i++) {
        const listener = jest.fn();
        listeners.push(listener);
        emitter.on('perf-test', listener);
      }

      const addTime = Date.now() - start;
      expect(addTime).toBeLessThan(500); // Relax time constraint

      const emitStart = Date.now();
      emitter.emit('perf-test', 'data');
      const emitTime = Date.now() - emitStart;

      expect(emitTime).toBeLessThan(200); // Relax time constraint
      expect(emitter.listenerCount('perf-test')).toBe(1000);
    });

    test('should clean up memory when removing all listeners', () => {
      emitter.on('test1', () => {});
      emitter.on('test2', () => {});
      emitter.on('test3', () => {});

      expect(emitter.listenerCount('test1')).toBe(1);
      expect(emitter.listenerCount('test2')).toBe(1);
      expect(emitter.listenerCount('test3')).toBe(1);

      emitter.removeAllListeners();

      expect(emitter.listenerCount('test1')).toBe(0);
      expect(emitter.listenerCount('test2')).toBe(0);
      expect(emitter.listenerCount('test3')).toBe(0);
    });
  });
});
