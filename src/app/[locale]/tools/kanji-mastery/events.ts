/**
 * Kanji Mastery Event System
 *
 * This event system allows external services (like gamification) to listen
 * to kanji mastery events without tight coupling.
 *
 * Usage in external service:
 * ```ts
 * import { kanjiMasteryEvents } from '@/app/[locale]/tools/kanji-mastery/events'
 *
 * kanjiMasteryEvents.on('round1:complete', (data) => {
 *   // Award XP, update streaks, etc.
 * })
 * ```
 */

export interface RoundCompleteEvent {
  userId: string
  kanjiId: string
  kanji: string
  round: 1 | 2 | 3
  timestamp: number
}

export interface Round2CompleteEvent extends RoundCompleteEvent {
  round: 2
  results: Array<{
    type: string
    correct: boolean
    userAnswer?: string
  }>
  correctCount: number
  totalTests: number
  accuracy: number
}

export interface Round3CompleteEvent extends RoundCompleteEvent {
  round: 3
  rating: number
  accuracy: number
}

export interface SessionCompleteEvent {
  sessionId: string
  userId: string
  kanji: Array<{
    id: string
    character: string
    finalScore: number
  }>
  sessionStats: {
    totalKanji: number
    perfectKanji: number
    reviewAgainCount: number
    averageAccuracy: number
    timeSpentSeconds: number
  }
  isPremium: boolean
  timestamp: number
}

type EventCallback<T> = (data: T) => void | Promise<void>

interface EventMap {
  'round1:complete': RoundCompleteEvent
  'round2:complete': Round2CompleteEvent
  'round3:complete': Round3CompleteEvent
  'session:complete': SessionCompleteEvent
}

class KanjiMasteryEventEmitter {
  private listeners: Map<keyof EventMap, EventCallback<any>[]> = new Map()

  /**
   * Register an event listener
   */
  on<K extends keyof EventMap>(event: K, callback: EventCallback<EventMap[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }

    this.listeners.get(event)!.push(callback)

    // Return unsubscribe function
    return () => this.off(event, callback)
  }

  /**
   * Remove an event listener
   */
  off<K extends keyof EventMap>(event: K, callback: EventCallback<EventMap[K]>): void {
    const callbacks = this.listeners.get(event)
    if (!callbacks) return

    const index = callbacks.indexOf(callback)
    if (index > -1) {
      callbacks.splice(index, 1)
    }
  }

  /**
   * Emit an event to all registered listeners
   */
  async emit<K extends keyof EventMap>(event: K, data: EventMap[K]): Promise<void> {
    const callbacks = this.listeners.get(event)
    if (!callbacks || callbacks.length === 0) return

    // Execute all callbacks (in parallel for performance)
    await Promise.all(
      callbacks.map(callback =>
        Promise.resolve(callback(data)).catch(error => {
          console.error(`Error in ${event} listener:`, error)
        })
      )
    )
  }

  /**
   * Remove all listeners for an event, or all listeners if no event specified
   */
  removeAllListeners(event?: keyof EventMap): void {
    if (event) {
      this.listeners.delete(event)
    } else {
      this.listeners.clear()
    }
  }

  /**
   * Get count of listeners for an event
   */
  listenerCount(event: keyof EventMap): number {
    return this.listeners.get(event)?.length || 0
  }
}

// Export singleton instance
export const kanjiMasteryEvents = new KanjiMasteryEventEmitter()
