/**
 * News Progress Manager
 * Lightweight manager for tracking reading time on news articles
 *
 * Unlike other URE managers, this doesn't use IndexedDB for sessions.
 * Sessions are tracked in memory since we only need the current session.
 * Progress is persisted via API calls when the user completes reading.
 */

import { v4 as uuidv4 } from 'uuid'
import type { NewsReadingSession } from './news-progress.types'

const IDLE_TIMEOUT_MS = 60000 // 60 seconds

export class NewsProgressManager {
  private static instance: NewsProgressManager | null = null
  private currentSession: NewsReadingSession | null = null
  private idleTimer: ReturnType<typeof setTimeout> | null = null
  private scrollHandler: (() => void) | null = null

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): NewsProgressManager {
    if (!NewsProgressManager.instance) {
      NewsProgressManager.instance = new NewsProgressManager()
    }
    return NewsProgressManager.instance
  }

  /**
   * Start a new reading session for an article
   */
  startSession(articleId: string, userId: string, difficulty: string): NewsReadingSession {
    // End any existing session first
    if (this.currentSession) {
      this.endSession()
    }

    const now = Date.now()
    this.currentSession = {
      sessionId: uuidv4(),
      articleId,
      userId,
      difficulty,
      startedAt: now,
      activeTimeMs: 0,
      lastActiveAt: now,
      isPaused: false,
    }

    console.log('[NewsProgressManager] Session started:', {
      sessionId: this.currentSession.sessionId,
      articleId,
      difficulty,
    })

    // Start idle detection
    this.startIdleDetection()

    return this.currentSession
  }

  /**
   * Pause the current session (tab hidden, idle timeout, etc.)
   */
  pauseSession(): void {
    if (!this.currentSession || this.currentSession.isPaused) return

    const now = Date.now()
    // Add elapsed time since last activity
    this.currentSession.activeTimeMs += now - this.currentSession.lastActiveAt
    this.currentSession.isPaused = true
    this.currentSession.pausedAt = now

    console.log('[NewsProgressManager] Session paused:', {
      activeTimeMs: this.currentSession.activeTimeMs,
      reason: 'manual or idle',
    })

    // Clear idle timer while paused
    this.clearIdleTimer()
  }

  /**
   * Resume the current session
   */
  resumeSession(): void {
    if (!this.currentSession || !this.currentSession.isPaused) return

    const now = Date.now()
    this.currentSession.isPaused = false
    this.currentSession.lastActiveAt = now
    this.currentSession.pausedAt = undefined

    console.log('[NewsProgressManager] Session resumed')

    // Restart idle detection
    this.startIdleDetection()
  }

  /**
   * Record activity (scroll, click, etc.) to reset idle timer
   */
  recordActivity(): void {
    if (!this.currentSession) return

    // If paused due to idle, resume
    if (this.currentSession.isPaused) {
      this.resumeSession()
    } else {
      // Update last active timestamp
      const now = Date.now()
      this.currentSession.activeTimeMs += now - this.currentSession.lastActiveAt
      this.currentSession.lastActiveAt = now
    }

    // Reset idle timer
    this.resetIdleTimer()
  }

  /**
   * End the current session and return the total active time
   */
  endSession(): { activeTimeMs: number; sessionId: string } | null {
    if (!this.currentSession) return null

    // Calculate final active time
    if (!this.currentSession.isPaused) {
      const now = Date.now()
      this.currentSession.activeTimeMs += now - this.currentSession.lastActiveAt
    }

    const result = {
      activeTimeMs: this.currentSession.activeTimeMs,
      sessionId: this.currentSession.sessionId,
    }

    console.log('[NewsProgressManager] Session ended:', {
      sessionId: this.currentSession.sessionId,
      totalActiveTimeMs: this.currentSession.activeTimeMs,
      totalActiveMinutes: Math.round((this.currentSession.activeTimeMs / 60000) * 10) / 10,
    })

    // Cleanup
    this.stopIdleDetection()
    this.currentSession = null

    return result
  }

  /**
   * Get current session info
   */
  getCurrentSession(): NewsReadingSession | null {
    return this.currentSession
  }

  /**
   * Get current active reading time in milliseconds
   */
  getActiveTimeMs(): number {
    if (!this.currentSession) return 0

    if (this.currentSession.isPaused) {
      return this.currentSession.activeTimeMs
    }

    // Include time since last activity
    return this.currentSession.activeTimeMs + (Date.now() - this.currentSession.lastActiveAt)
  }

  /**
   * Check if currently paused
   */
  isPaused(): boolean {
    return this.currentSession?.isPaused ?? false
  }

  // ============= Private Methods =============

  private startIdleDetection(): void {
    // Setup scroll listener
    if (typeof window !== 'undefined') {
      this.scrollHandler = () => this.recordActivity()
      window.addEventListener('scroll', this.scrollHandler, { passive: true })
    }

    // Start idle timer
    this.resetIdleTimer()
  }

  private stopIdleDetection(): void {
    // Remove scroll listener
    if (this.scrollHandler && typeof window !== 'undefined') {
      window.removeEventListener('scroll', this.scrollHandler)
      this.scrollHandler = null
    }

    // Clear timer
    this.clearIdleTimer()
  }

  private resetIdleTimer(): void {
    this.clearIdleTimer()
    this.idleTimer = setTimeout(() => {
      console.log('[NewsProgressManager] Idle timeout - pausing session')
      this.pauseSession()
    }, IDLE_TIMEOUT_MS)
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }
  }
}

// Export singleton getter for convenience
export const getNewsProgressManager = () => NewsProgressManager.getInstance()
