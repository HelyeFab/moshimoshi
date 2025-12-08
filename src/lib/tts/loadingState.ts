/**
 * Global TTS Loading State
 *
 * Simple pub/sub singleton that tracks when ANY useTTS hook instance
 * is fetching audio from the API (cache miss). This enables a single
 * app-level loading overlay instead of per-component overlays.
 *
 * Features:
 * - Count-based tracking (multiple concurrent fetches = still one overlay)
 * - Automatic cleanup when fetch count returns to zero
 * - Type-safe subscriptions with automatic initial state
 */

type Listener = (isFetching: boolean) => void

class TTSLoadingState {
  private fetchCount = 0
  private listeners = new Set<Listener>()

  /**
   * Subscribe to loading state changes
   * @param listener Callback fired when fetching state changes
   * @returns Unsubscribe function
   */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    // Immediately notify with current state
    listener(this.fetchCount > 0)
    return () => this.listeners.delete(listener)
  }

  /**
   * Update fetching state
   * @param isFetching true when starting a fetch, false when complete
   */
  setFetching(isFetching: boolean): void {
    const wasFetching = this.fetchCount > 0

    if (isFetching) {
      this.fetchCount++
    } else {
      this.fetchCount = Math.max(0, this.fetchCount - 1)
    }

    const nowFetching = this.fetchCount > 0

    // Only notify if the boolean state actually changed
    if (wasFetching !== nowFetching) {
      this.listeners.forEach(listener => listener(nowFetching))
    }
  }

  /**
   * Get current fetching state (for debugging/testing)
   */
  isFetching(): boolean {
    return this.fetchCount > 0
  }

  /**
   * Reset state (for testing)
   */
  reset(): void {
    this.fetchCount = 0
    this.listeners.forEach(listener => listener(false))
  }
}

// Singleton instance
export const ttsLoadingState = new TTSLoadingState()
