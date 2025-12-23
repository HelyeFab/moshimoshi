// Add to Home Screen (A2HS) Detection and Management
// Consolidated implementation with anti-harassment protections

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Consolidated localStorage keys (using 'pwa_' prefix for consistency)
const STORAGE_KEYS = {
  DISMISSED_AT: 'pwa_install_dismissed',
  LAST_PROMPT: 'pwa_last_prompt',
  VISIT_COUNT: 'pwa_visit_count',
  INSTALLED: 'pwa_installed',
} as const

// Anti-harassment thresholds
const THRESHOLDS = {
  MIN_VISITS: 3,                    // Must visit 3+ times before showing prompt
  DISMISSAL_COOLDOWN_DAYS: 7,       // 7-day cooldown after dismissal
  REPROMPT_COOLDOWN_HOURS: 48,     // 48-hour minimum between prompts
  INITIAL_DELAY_IOS_MS: 30000,      // 30 seconds on iOS
  INITIAL_DELAY_CHROME_MS: 15000,   // 15 seconds on Chrome/Android
} as const

class A2HSManager {
  private deferredPrompt: BeforeInstallPromptEvent | null = null
  private isInstalled = false
  private listeners: Set<(available: boolean) => void> = new Set()

  constructor() {
    if (typeof window !== 'undefined') {
      this.initialize()
    }
  }

  private initialize() {
    // Check if app is already installed
    this.checkIfInstalled()

    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      this.deferredPrompt = e as BeforeInstallPromptEvent
      this.notifyListeners(true)

      // Track that the prompt is available
      this.trackPromptAvailable()
    })

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
      this.isInstalled = true
      this.deferredPrompt = null
      localStorage.setItem(STORAGE_KEYS.INSTALLED, 'true')
      this.notifyListeners(false)

      // Track successful installation
      this.trackInstallation()
    })

    // Increment visit count
    this.incrementVisitCount()

    // Check for iOS
    if (this.isIOS() && !this.isInStandaloneMode()) {
      // iOS doesn't support beforeinstallprompt, but we can still show custom UI
      this.notifyListeners(true)
    }
  }

  private checkIfInstalled() {
    // Check if app is running in standalone mode (installed)
    if (this.isInStandaloneMode()) {
      this.isInstalled = true
      return
    }

    // Check if install flag is set
    if (localStorage.getItem(STORAGE_KEYS.INSTALLED) === 'true') {
      this.isInstalled = true
      return
    }

    // Check if dismissed recently (treat as "installed" to suppress prompt)
    const dismissedAt = localStorage.getItem(STORAGE_KEYS.DISMISSED_AT)
    if (dismissedAt) {
      const dismissedDate = new Date(dismissedAt)
      const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24)

      // Don't show prompt again for configured days after dismissal
      if (daysSinceDismissed < THRESHOLDS.DISMISSAL_COOLDOWN_DAYS) {
        this.isInstalled = true // Temporarily treat as installed to suppress prompt
      }
    }
  }

  private isInStandaloneMode(): boolean {
    // Check various methods for standalone detection
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes('android-app://')
    )
  }

  private isIOS(): boolean {
    const userAgent = window.navigator.userAgent.toLowerCase()
    return /iphone|ipad|ipod/.test(userAgent)
  }

  private isAndroid(): boolean {
    const userAgent = window.navigator.userAgent.toLowerCase()
    return /android/.test(userAgent)
  }

  private incrementVisitCount(): void {
    const count = this.getVisitCount() + 1
    localStorage.setItem(STORAGE_KEYS.VISIT_COUNT, count.toString())
  }

  private getVisitCount(): number {
    return parseInt(localStorage.getItem(STORAGE_KEYS.VISIT_COUNT) || '0', 10)
  }

  private hasEnoughVisits(): boolean {
    return this.getVisitCount() >= THRESHOLDS.MIN_VISITS
  }

  private wasRecentlyDismissed(): boolean {
    const dismissed = localStorage.getItem(STORAGE_KEYS.DISMISSED_AT)
    if (!dismissed) return false

    const dismissedTime = new Date(dismissed).getTime()
    const cooldownMs = THRESHOLDS.DISMISSAL_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
    return Date.now() - dismissedTime < cooldownMs
  }

  private wasRecentlyPrompted(): boolean {
    const lastPromptTime = localStorage.getItem(STORAGE_KEYS.LAST_PROMPT)
    if (!lastPromptTime) return false

    const hoursSinceLastPrompt = (Date.now() - new Date(lastPromptTime).getTime()) / (1000 * 60 * 60)
    return hoursSinceLastPrompt < THRESHOLDS.REPROMPT_COOLDOWN_HOURS
  }

  private trackPromptAvailable() {
    // Track analytics event when prompt becomes available
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'pwa_prompt_available')
    }
  }

  private trackInstallation() {
    // Track analytics event when app is installed
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'pwa_installed')
    }
  }

  /**
   * Check if the native prompt can be shown
   */
  public canPrompt(): boolean {
    // For iOS, we can always show our custom prompt
    if (this.isIOS() && !this.isInStandaloneMode()) {
      return true
    }

    // For other platforms, check if we have the deferred prompt
    return this.deferredPrompt !== null && !this.isInstalled
  }

  /**
   * Check if we should show the install prompt based on all criteria
   * This includes anti-harassment protections
   */
  public shouldShowPrompt(): boolean {
    // Don't show if already installed
    if (this.isAppInstalled()) {
      return false
    }

    // Check engagement threshold (visit count)
    if (!this.hasEnoughVisits()) {
      return false
    }

    // Check dismissal cooldown
    if (this.wasRecentlyDismissed()) {
      return false
    }

    // Check re-prompt cooldown
    if (this.wasRecentlyPrompted()) {
      return false
    }

    return this.canPrompt()
  }

  /**
   * Show the native install prompt (Chrome/Android)
   */
  public async prompt(): Promise<'accepted' | 'dismissed' | 'not-available'> {
    // For iOS, we can't trigger native prompt
    if (this.isIOS()) {
      return 'not-available'
    }

    if (!this.deferredPrompt) {
      return 'not-available'
    }

    try {
      // Show the native install prompt
      await this.deferredPrompt.prompt()

      // Wait for user choice
      const { outcome } = await this.deferredPrompt.userChoice

      // Clear the deferred prompt
      this.deferredPrompt = null

      // If dismissed, save the timestamp
      if (outcome === 'dismissed') {
        this.dismissPrompt()
      }

      // Track user choice
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'pwa_user_choice', { outcome })
      }

      this.notifyListeners(false)
      return outcome
    } catch (error) {
      console.error('[A2HS] Error showing install prompt:', error)
      return 'not-available'
    }
  }

  /**
   * Mark the prompt as dismissed
   */
  public dismissPrompt() {
    // Save dismissal timestamp
    localStorage.setItem(STORAGE_KEYS.DISMISSED_AT, new Date().toISOString())
    this.deferredPrompt = null
    this.notifyListeners(false)

    // Track dismissal
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'pwa_dismissed')
    }
  }

  /**
   * Mark that the prompt was shown (for re-prompt cooldown)
   */
  public markPromptShown() {
    localStorage.setItem(STORAGE_KEYS.LAST_PROMPT, new Date().toISOString())
  }

  /**
   * Get platform-specific install instructions
   */
  public getInstallInstructions() {
    if (this.isIOS()) {
      return {
        platform: 'ios',
        steps: [
          'Tap the Share button',
          'Scroll down and tap "Add to Home Screen"',
          'Tap "Add" to install'
        ]
      }
    } else if (this.isAndroid()) {
      return {
        platform: 'android',
        steps: [
          'Tap the menu button (three dots)',
          'Tap "Add to Home Screen"',
          'Tap "Add" to install'
        ]
      }
    } else {
      return {
        platform: 'desktop',
        steps: [
          'Click the install icon in the address bar',
          'Click "Install" to add the app'
        ]
      }
    }
  }

  /**
   * Get recommended initial delay based on platform
   */
  public getRecommendedDelay(): number {
    return this.isIOS() ? THRESHOLDS.INITIAL_DELAY_IOS_MS : THRESHOLDS.INITIAL_DELAY_CHROME_MS
  }

  /**
   * Subscribe to availability changes
   */
  public onAvailabilityChange(callback: (available: boolean) => void) {
    this.listeners.add(callback)

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback)
    }
  }

  private notifyListeners(available: boolean) {
    this.listeners.forEach(callback => callback(available))
  }

  /**
   * Check if app is installed
   */
  public isAppInstalled(): boolean {
    return this.isInstalled || this.isInStandaloneMode()
  }

  /**
   * Get current visit count
   */
  public getCurrentVisitCount(): number {
    return this.getVisitCount()
  }

  /**
   * Get platform name
   */
  public getPlatform(): 'ios' | 'android' | 'desktop' {
    if (this.isIOS()) return 'ios'
    if (this.isAndroid()) return 'android'
    return 'desktop'
  }
}

// Export singleton instance
export const a2hsManager = new A2HSManager()

// Export types and thresholds
export type { BeforeInstallPromptEvent }
export { THRESHOLDS, STORAGE_KEYS }
