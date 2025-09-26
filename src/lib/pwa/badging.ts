// Badging API Management
// Handles app badge updates with graceful fallback

import { canCurrentUser } from './entitlements'

interface BadgeState {
  count: number
  lastUpdated: Date
}

class BadgeManager {
  private isSupported = false
  private currentBadge: BadgeState = { count: 0, lastUpdated: new Date() }
  private listeners: Set<(count: number) => void> = new Set()

  constructor() {
    if (typeof window !== 'undefined') {
      this.isSupported = 'setAppBadge' in navigator && 'clearAppBadge' in navigator
      this.loadState()
    }
  }

  private loadState() {
    const stored = localStorage.getItem('badge_state')
    if (stored) {
      try {
        const state = JSON.parse(stored)
        this.currentBadge = {
          count: state.count || 0,
          lastUpdated: new Date(state.lastUpdated || Date.now())
        }
      } catch (error) {
        console.error('Failed to load badge state:', error)
      }
    }
  }

  private saveState() {
    localStorage.setItem('badge_state', JSON.stringify(this.currentBadge))
  }

  public async setBadge(count: number): Promise<boolean> {
    // Check entitlements
    if (!canCurrentUser('badging')) {
      console.warn('User not entitled to use badging')
      return false
    }

    // Normalize count (must be non-negative)
    const normalizedCount = Math.max(0, Math.floor(count))

    // Update internal state
    this.currentBadge = {
      count: normalizedCount,
      lastUpdated: new Date()
    }
    this.saveState()

    // Notify listeners (for fallback UI)
    this.notifyListeners(normalizedCount)

    // Try to set native badge
    if (this.isSupported) {
      try {
        if (normalizedCount === 0) {
          await (navigator as any).clearAppBadge()
        } else {
          await (navigator as any).setAppBadge(normalizedCount)
        }

        // Track badge update
        this.trackBadgeUpdate(normalizedCount)

        return true
      } catch (error) {
        console.error('Failed to set app badge:', error)
        return false
      }
    }

    // Return false if not supported (fallback UI will handle it)
    return false
  }

  public async clearBadge(): Promise<boolean> {
    return this.setBadge(0)
  }

  public getBadgeCount(): number {
    return this.currentBadge.count
  }

  public getLastUpdated(): Date {
    return this.currentBadge.lastUpdated
  }

  public isBadgingSupported(): boolean {
    return this.isSupported
  }

  public onBadgeChange(callback: (count: number) => void) {
    this.listeners.add(callback)

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback)
    }
  }

  private notifyListeners(count: number) {
    this.listeners.forEach(callback => callback(count))
  }

  private trackBadgeUpdate(count: number) {
    // Track analytics event
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'badge_updated', {
        badge_count: count
      })
    }
  }

  // Helper method to calculate badge from review data
  public async updateBadgeFromReviews(dueCount: number, urgentCount: number = 0): Promise<boolean> {
    // You can customize the logic here
    // For example, show urgent count or total due count
    const badgeCount = urgentCount > 0 ? urgentCount : dueCount
    return this.setBadge(badgeCount)
  }

  // Sync badge with review queue (called from review engine)
  public async syncWithReviewQueue(): Promise<void> {
    try {
      // This would connect to your review engine
      // For now, using mock data
      const reviewData = this.getMockReviewData()
      await this.updateBadgeFromReviews(reviewData.dueCount, reviewData.urgentCount)
    } catch (error) {
      console.error('Failed to sync badge with review queue:', error)
    }
  }

  private getMockReviewData() {
    // Mock implementation - replace with actual review engine integration
    const stored = localStorage.getItem('review_queue_stats')
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch {
        // Ignore parse errors
      }
    }
    return { dueCount: 0, urgentCount: 0 }
  }

  // Update badge when app becomes visible
  public handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      // Refresh badge when app comes to foreground
      this.syncWithReviewQueue()
    }
  }

  // Initialize visibility change listener
  public initVisibilityListener() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        this.handleVisibilityChange()
      })
    }
  }
}

// Export singleton instance
export const badgeManager = new BadgeManager()

// Initialize visibility listener
if (typeof window !== 'undefined') {
  badgeManager.initVisibilityListener()
}