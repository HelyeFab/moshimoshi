/**
 * Virtual Clock for Testing Time-Dependent Features
 *
 * This module provides a single source of truth for time in the application,
 * allowing deterministic testing of time-dependent features like FSRS scheduling
 * and achievement unlocking.
 */

interface VirtualClockState {
  offsetMs: number;
  frozenTime: number | null;
  isEnabled: boolean;
  history: Array<{
    action: string;
    timestamp: number;
    realTime: number;
  }>;
}

class VirtualClock {
  private state: VirtualClockState = {
    offsetMs: 0,
    frozenTime: null,
    isEnabled: false,
    history: []
  };

  private listeners: Set<(state: VirtualClockState) => void> = new Set();

  constructor() {
    // Load persisted state from localStorage if in dev mode
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      const saved = localStorage.getItem('virtualClock');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          this.state = {
            ...parsed,
            history: parsed.history || []
          };
        } catch (e) {
          console.error('Failed to load virtual clock state:', e);
        }
      }
    }
  }

  /**
   * Get the current time, accounting for virtual time offset/freeze
   */
  now(): number {
    if (!this.state.isEnabled) {
      return Date.now();
    }

    if (this.state.frozenTime !== null) {
      return this.state.frozenTime;
    }

    return Date.now() + this.state.offsetMs;
  }

  /**
   * Get a Date object for the current virtual time
   */
  nowDate(): Date {
    return new Date(this.now());
  }

  /**
   * Enable/disable virtual time
   */
  setEnabled(enabled: boolean): void {
    this.state.isEnabled = enabled;
    this.notifyListeners();
    this.persistState();
  }

  /**
   * Check if virtual time is enabled
   */
  isEnabled(): boolean {
    return this.state.isEnabled;
  }

  /**
   * Freeze time at a specific date/time
   */
  freeze(date: Date | number): void {
    const timestamp = typeof date === 'number' ? date : date.getTime();
    this.state.frozenTime = timestamp;
    this.addHistory('freeze', timestamp);
    this.notifyListeners();
    this.persistState();
  }

  /**
   * Unfreeze time (but maintain offset)
   */
  unfreeze(): void {
    if (this.state.frozenTime !== null) {
      // Calculate offset to maintain continuity
      const timePassed = this.state.frozenTime - Date.now();
      this.state.offsetMs += timePassed;
      this.state.frozenTime = null;
      this.addHistory('unfreeze', this.now());
      this.notifyListeners();
      this.persistState();
    }
  }

  /**
   * Travel forward or backward by a specified number of days
   */
  travelDays(days: number): void {
    this.travelMs(days * 24 * 60 * 60 * 1000);
  }

  /**
   * Travel forward or backward by a specified number of hours
   */
  travelHours(hours: number): void {
    this.travelMs(hours * 60 * 60 * 1000);
  }

  /**
   * Travel forward or backward by a specified number of milliseconds
   */
  travelMs(ms: number): void {
    if (this.state.frozenTime !== null) {
      this.state.frozenTime += ms;
    } else {
      this.state.offsetMs += ms;
    }
    this.addHistory(`travel ${ms}ms`, this.now());
    this.notifyListeners();
    this.persistState();
  }

  /**
   * Jump to a specific date/time
   */
  jumpTo(date: Date | number): void {
    const targetTime = typeof date === 'number' ? date : date.getTime();
    const currentTime = Date.now();
    this.state.offsetMs = targetTime - currentTime;
    this.state.frozenTime = null;
    this.addHistory('jumpTo', targetTime);
    this.notifyListeners();
    this.persistState();
  }

  /**
   * Reset to real time
   */
  reset(): void {
    this.state.offsetMs = 0;
    this.state.frozenTime = null;
    this.state.history = [];
    this.addHistory('reset', Date.now());
    this.notifyListeners();
    this.persistState();
  }

  /**
   * Get the current state
   */
  getState(): Readonly<VirtualClockState> {
    return { ...this.state };
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: VirtualClockState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get formatted information about the current time state
   */
  getInfo(): {
    realTime: Date;
    virtualTime: Date;
    offset: {
      days: number;
      hours: number;
      minutes: number;
      totalMs: number;
    };
    isFrozen: boolean;
    isEnabled: boolean;
  } {
    const realTime = new Date();
    const virtualTime = this.nowDate();
    const offsetMs = this.state.frozenTime !== null
      ? this.state.frozenTime - Date.now()
      : this.state.offsetMs;

    const days = Math.floor(Math.abs(offsetMs) / (24 * 60 * 60 * 1000));
    const hours = Math.floor(Math.abs(offsetMs) % (24 * 60 * 60 * 1000) / (60 * 60 * 1000));
    const minutes = Math.floor(Math.abs(offsetMs) % (60 * 60 * 1000) / (60 * 1000));

    return {
      realTime,
      virtualTime,
      offset: {
        days: offsetMs >= 0 ? days : -days,
        hours: offsetMs >= 0 ? hours : -hours,
        minutes: offsetMs >= 0 ? minutes : -minutes,
        totalMs: offsetMs
      },
      isFrozen: this.state.frozenTime !== null,
      isEnabled: this.state.isEnabled
    };
  }

  /**
   * Get time travel history
   */
  getHistory(): VirtualClockState['history'] {
    return [...this.state.history];
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.state.history = [];
    this.persistState();
  }

  private addHistory(action: string, timestamp: number): void {
    this.state.history.push({
      action,
      timestamp,
      realTime: Date.now()
    });
    // Keep only last 100 history items
    if (this.state.history.length > 100) {
      this.state.history = this.state.history.slice(-100);
    }
  }

  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach(listener => listener(state));
  }

  private persistState(): void {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      localStorage.setItem('virtualClock', JSON.stringify(this.state));
    }
  }
}

// Export singleton instance
export const virtualClock = new VirtualClock();

// Export helper functions for convenience
export const vnow = () => virtualClock.now();
export const vnowDate = () => virtualClock.nowDate();

// Export for testing
export type { VirtualClockState };