/**
 * Browser-compatible EventEmitter implementation
 * Drop-in replacement for Node.js EventEmitter
 *
 * This class provides the same API as Node.js EventEmitter but works in browser environments.
 * Used by SessionManager for client-side event-driven architecture.
 *
 * @example
 * ```typescript
 * const emitter = new ClientEventEmitter();
 * emitter.on('event', (data) => console.log(data));
 * emitter.emit('event', { message: 'Hello' });
 * ```
 */

type EventListener = (...args: any[]) => void | Promise<void>;

export class ClientEventEmitter {
  private events: Map<string, Set<EventListener>> = new Map();
  private maxListeners: number = 10;

  /**
   * Register an event listener
   * @param event - Event name to listen for
   * @param listener - Callback function to invoke when event is emitted
   * @returns this for chaining
   */
  on(event: string, listener: EventListener): this {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    const listeners = this.events.get(event)!;

    // Warn about potential memory leaks
    if (listeners.size >= this.maxListeners) {
      console.warn(
        `MaxListenersExceededWarning: Possible memory leak detected. ` +
        `${listeners.size + 1} ${event} listeners added. ` +
        `Use setMaxListeners() to increase limit.`
      );
    }

    listeners.add(listener);
    return this;
  }

  /**
   * Remove an event listener
   * @param event - Event name
   * @param listener - Callback function to remove
   * @returns this for chaining
   */
  off(event: string, listener: EventListener): this {
    const listeners = this.events.get(event);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.events.delete(event);
      }
    }
    return this;
  }

  /**
   * Emit an event to all registered listeners
   * @param event - Event name to emit
   * @param args - Arguments to pass to listeners
   * @returns true if event had listeners, false otherwise
   */
  emit(event: string, ...args: any[]): boolean {
    const listeners = this.events.get(event);
    if (!listeners || listeners.size === 0) {
      return false;
    }

    // Convert to array to avoid issues if listeners modify the set during iteration
    const listenerArray = Array.from(listeners);

    for (const listener of listenerArray) {
      try {
        const result = listener(...args);
        // Handle async listeners
        if (result instanceof Promise) {
          result.catch((error) => {
            console.error(`Error in async event listener for ${event}:`, error);
          });
        }
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    }

    return true;
  }

  /**
   * Register a one-time event listener that will be removed after first invocation
   * @param event - Event name to listen for
   * @param listener - Callback function to invoke once
   * @returns this for chaining
   */
  once(event: string, listener: EventListener): this {
    const onceWrapper = (...args: any[]) => {
      this.off(event, onceWrapper);
      listener(...args);
    };
    return this.on(event, onceWrapper);
  }

  /**
   * Remove all listeners for an event, or all listeners for all events
   * @param event - Optional event name. If omitted, removes all listeners for all events
   * @returns this for chaining
   */
  removeAllListeners(event?: string): this {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
    return this;
  }

  /**
   * Get the count of listeners for an event
   * @param event - Event name
   * @returns Number of listeners registered for the event
   */
  listenerCount(event: string): number {
    return this.events.get(event)?.size || 0;
  }

  /**
   * Set the maximum number of listeners before warning
   * @param n - Maximum number of listeners
   * @returns this for chaining
   */
  setMaxListeners(n: number): this {
    this.maxListeners = n;
    return this;
  }

  /**
   * Get all event names that have listeners
   * @returns Array of event names
   */
  eventNames(): string[] {
    return Array.from(this.events.keys());
  }

  /**
   * Get all listeners for an event
   * @param event - Event name
   * @returns Array of listener functions
   */
  listeners(event: string): EventListener[] {
    const listeners = this.events.get(event);
    return listeners ? Array.from(listeners) : [];
  }

  /**
   * Alias for on() - for compatibility with Node.js EventEmitter
   * @param event - Event name to listen for
   * @param listener - Callback function to invoke when event is emitted
   * @returns this for chaining
   */
  addListener(event: string, listener: EventListener): this {
    return this.on(event, listener);
  }

  /**
   * Alias for off() - for compatibility with Node.js EventEmitter
   * @param event - Event name
   * @param listener - Callback function to remove
   * @returns this for chaining
   */
  removeListener(event: string, listener: EventListener): this {
    return this.off(event, listener);
  }
}
