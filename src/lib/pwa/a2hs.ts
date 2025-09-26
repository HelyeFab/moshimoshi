// Add to Home Screen (A2HS) Detection and Management
// Handles PWA install prompt detection and timing logic

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

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
      this.notifyListeners(false)

      // Track successful installation
      this.trackInstallation()
    })

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

    // Check if the app was previously installed (using localStorage)
    const installDismissedAt = localStorage.getItem('a2hs_dismissed_at')
    if (installDismissedAt) {
      const dismissedDate = new Date(installDismissedAt)
      const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24)

      // Don't show prompt again for 14 days after dismissal
      if (daysSinceDismissed < 14) {
        this.isInstalled = true
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

  private trackPromptAvailable() {
    // Track analytics event when prompt becomes available
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'a2hs_prompt_available')
    }
  }

  private trackInstallation() {
    // Track analytics event when app is installed
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'a2hs_installed')
    }
  }

  public canPrompt(): boolean {
    // For iOS, we can always show our custom prompt
    if (this.isIOS() && !this.isInStandaloneMode()) {
      return true
    }

    // For other platforms, check if we have the deferred prompt
    return this.deferredPrompt !== null && !this.isInstalled
  }

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
        localStorage.setItem('a2hs_dismissed_at', new Date().toISOString())
      }

      // Track user choice
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'a2hs_user_choice', { outcome })
      }

      this.notifyListeners(false)
      return outcome
    } catch (error) {
      console.error('Error showing install prompt:', error)
      return 'not-available'
    }
  }

  public dismissPrompt() {
    // Save dismissal timestamp
    localStorage.setItem('a2hs_dismissed_at', new Date().toISOString())
    this.deferredPrompt = null
    this.notifyListeners(false)

    // Track dismissal
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'a2hs_dismissed_custom')
    }
  }

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

  public isAppInstalled(): boolean {
    return this.isInstalled || this.isInStandaloneMode()
  }

  public shouldShowPrompt(): boolean {
    // Don't show if already installed
    if (this.isAppInstalled()) {
      return false
    }

    // Check if user has used the app enough (e.g., visited 3+ times)
    const visitCount = parseInt(localStorage.getItem('visit_count') || '0', 10)
    if (visitCount < 3) {
      return false
    }

    // Check if enough time has passed since last prompt
    const lastPromptTime = localStorage.getItem('a2hs_last_prompt')
    if (lastPromptTime) {
      const hoursSinceLastPrompt = (Date.now() - new Date(lastPromptTime).getTime()) / (1000 * 60 * 60)
      if (hoursSinceLastPrompt < 48) { // Don't show more than once every 48 hours
        return false
      }
    }

    return this.canPrompt()
  }

  public markPromptShown() {
    localStorage.setItem('a2hs_last_prompt', new Date().toISOString())
  }
}

// Export singleton instance
export const a2hsManager = new A2HSManager()

// Export types
export type { BeforeInstallPromptEvent }