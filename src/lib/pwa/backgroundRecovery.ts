/**
 * PWA Background Recovery Utility
 *
 * Detects when the PWA goes to background (user switches apps) and
 * handles recovery when returning to prevent stale/frozen states.
 *
 * On mobile PWAs, the app can get into a stuck state when:
 * - User switches away for extended time
 * - OS suspends/freezes the PWA to save resources
 * - Network state changes while app is in background
 * - Auth tokens expire while backgrounded
 *
 * This utility monitors visibility changes and forces a clean reload
 * when the app has been backgrounded for too long.
 */

// Configuration
const CONFIG = {
  // Time in background before forcing reload (1 minute)
  // On mobile PWAs, state can become stale quickly
  BACKGROUND_THRESHOLD_MS: 1 * 60 * 1000,

  // Time in background before soft refresh (30 seconds)
  SOFT_REFRESH_THRESHOLD_MS: 30 * 1000,

  // Storage keys
  BACKGROUND_TIME_KEY: 'pwa_background_time',
  PRESERVED_ROUTE_KEY: 'pwa_preserved_route',
  LAST_ACTIVE_KEY: 'pwa_last_active',

  // Enable debug logging
  DEBUG: process.env.NODE_ENV === 'development',
}

function log(...args: unknown[]) {
  if (CONFIG.DEBUG) {
    console.log('[PWA Background]', ...args)
  }
}

function warn(...args: unknown[]) {
  console.warn('[PWA Background]', ...args)
}

/**
 * Preserve current state before going to background or reloading
 */
function preserveState(): void {
  try {
    // Save current route for restoration
    const currentPath = window.location.pathname + window.location.search
    sessionStorage.setItem(CONFIG.PRESERVED_ROUTE_KEY, currentPath)

    // Save timestamp
    sessionStorage.setItem(CONFIG.LAST_ACTIVE_KEY, String(Date.now()))

    log('State preserved:', currentPath)
  } catch (err) {
    // Storage might be unavailable
    warn('Failed to preserve state:', err)
  }
}

/**
 * Get the preserved route (if any) and clear it
 */
export function getPreservedRoute(): string | null {
  try {
    const route = sessionStorage.getItem(CONFIG.PRESERVED_ROUTE_KEY)
    // Clear it so we don't restore again
    sessionStorage.removeItem(CONFIG.PRESERVED_ROUTE_KEY)
    return route
  } catch {
    return null
  }
}

/**
 * Check if we should restore to a preserved route after reload
 */
export function shouldRestoreRoute(): boolean {
  try {
    const preserved = sessionStorage.getItem(CONFIG.PRESERVED_ROUTE_KEY)
    const lastActive = sessionStorage.getItem(CONFIG.LAST_ACTIVE_KEY)

    if (!preserved || !lastActive) return false

    // Only restore if reload was recent (within 30 seconds)
    const timeSinceActive = Date.now() - parseInt(lastActive)
    return timeSinceActive < 30000
  } catch {
    return false
  }
}

/**
 * Force a clean app reload
 */
function forceCleanReload(reason: string): void {
  warn(`Forcing clean reload: ${reason}`)

  // Preserve current route before reload
  preserveState()

  // Add a query param to indicate this is a recovery reload
  const url = new URL(window.location.href)
  url.searchParams.set('_pwa_recovery', 'bg')
  url.searchParams.set('_t', String(Date.now()))

  // Use replace to avoid polluting history
  window.location.replace(url.toString())
}

/**
 * Soft refresh - just refresh auth state without full reload
 */
async function softRefresh(): Promise<void> {
  log('Performing soft refresh (auth state only)')

  try {
    // Dispatch a custom event that auth providers can listen to
    window.dispatchEvent(new CustomEvent('pwa-soft-refresh', {
      detail: { reason: 'background-return' }
    }))

    // Also try to refresh the auth session directly
    const response = await fetch('/api/auth/session', {
      credentials: 'include',
      cache: 'no-store',
    })

    if (!response.ok) {
      warn('Session check failed on soft refresh, may need login')
    } else {
      log('Soft refresh completed successfully')
    }
  } catch (err) {
    warn('Soft refresh failed:', err)
  }
}

/**
 * Handle app returning to foreground
 */
function handleVisibilityChange(): void {
  if (document.visibilityState === 'hidden') {
    // App going to background
    log('App going to background')

    try {
      sessionStorage.setItem(CONFIG.BACKGROUND_TIME_KEY, String(Date.now()))
      preserveState()
    } catch {
      // Storage unavailable
    }

    return
  }

  // App returning to foreground
  log('App returning to foreground')

  try {
    const backgroundTimeStr = sessionStorage.getItem(CONFIG.BACKGROUND_TIME_KEY)
    sessionStorage.removeItem(CONFIG.BACKGROUND_TIME_KEY)

    if (!backgroundTimeStr) {
      log('No background time recorded, skipping recovery check')
      return
    }

    const backgroundTime = parseInt(backgroundTimeStr)
    const timeInBackground = Date.now() - backgroundTime

    log(`Was in background for ${Math.round(timeInBackground / 1000)}s`)

    // Check if we need to do a full reload
    if (timeInBackground >= CONFIG.BACKGROUND_THRESHOLD_MS) {
      forceCleanReload(`in background for ${Math.round(timeInBackground / 60000)} minutes`)
      return
    }

    // Check if we need a soft refresh
    if (timeInBackground >= CONFIG.SOFT_REFRESH_THRESHOLD_MS) {
      softRefresh()
      return
    }

    log('Background time within acceptable range, no action needed')
  } catch (err) {
    warn('Error handling visibility change:', err)
  }
}

/**
 * Handle page freeze (iOS/Chrome can freeze backgrounded tabs)
 */
function handleFreeze(): void {
  log('App frozen by browser')
  preserveState()
}

/**
 * Handle page resume from frozen state
 */
function handleResume(): void {
  log('App resumed from frozen state')

  // When resuming from freeze, always do at least a soft refresh
  // because the app state may be stale
  softRefresh()
}

/**
 * Handle page hide (navigating away or closing)
 */
function handlePageHide(event: PageTransitionEvent): void {
  if (event.persisted) {
    // Page is being put in bfcache
    log('Page entering bfcache')
    preserveState()
  }
}

/**
 * Handle page show (navigating back or opening)
 */
function handlePageShow(event: PageTransitionEvent): void {
  if (event.persisted) {
    // Page was restored from bfcache
    log('Page restored from bfcache')

    // bfcache restoration can have stale state, do a soft refresh
    softRefresh()
  }
}

/**
 * Check if the app was likely killed and restarted
 * (detected by checking if we have preserved state but no background time)
 */
function checkForColdStart(): void {
  try {
    const preserved = sessionStorage.getItem(CONFIG.PRESERVED_ROUTE_KEY)
    const backgroundTime = sessionStorage.getItem(CONFIG.BACKGROUND_TIME_KEY)
    const lastActive = sessionStorage.getItem(CONFIG.LAST_ACTIVE_KEY)

    if (preserved && lastActive && !backgroundTime) {
      const timeSinceActive = Date.now() - parseInt(lastActive)

      // If we have preserved state but no background time, and it's been a while,
      // the app was likely killed and restarted
      if (timeSinceActive > CONFIG.SOFT_REFRESH_THRESHOLD_MS) {
        log('Cold start detected after', Math.round(timeSinceActive / 1000), 'seconds')
        // Don't force reload on cold start, just let the app initialize normally
        // but clear the preserved state if it's too old
        if (timeSinceActive > CONFIG.BACKGROUND_THRESHOLD_MS) {
          sessionStorage.removeItem(CONFIG.PRESERVED_ROUTE_KEY)
        }
      }
    }
  } catch {
    // Ignore errors
  }
}

/**
 * Initialize background recovery monitoring
 * Call this early in app initialization
 */
export function initBackgroundRecovery(): void {
  if (typeof window === 'undefined') return

  // Only run in standalone mode (installed PWA)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                       (window.navigator as any).standalone === true

  if (!isStandalone) {
    log('Not in standalone mode, background recovery disabled')
    return
  }

  log('Initializing background recovery for standalone PWA')

  // Check for cold start scenario
  checkForColdStart()

  // Listen for visibility changes (primary mechanism)
  document.addEventListener('visibilitychange', handleVisibilityChange)

  // Listen for freeze/resume events (Page Lifecycle API)
  document.addEventListener('freeze', handleFreeze)
  document.addEventListener('resume', handleResume)

  // Listen for pagehide/pageshow (bfcache)
  window.addEventListener('pagehide', handlePageHide)
  window.addEventListener('pageshow', handlePageShow)

  // Also update last active time periodically while app is in foreground
  const updateLastActive = () => {
    if (document.visibilityState === 'visible') {
      try {
        sessionStorage.setItem(CONFIG.LAST_ACTIVE_KEY, String(Date.now()))
      } catch {
        // Ignore
      }
    }
  }

  // Update every 30 seconds while active
  setInterval(updateLastActive, 30000)

  // Initial update
  updateLastActive()

  log('Background recovery initialized')
}

/**
 * Cleanup function (call on unmount if needed)
 */
export function cleanupBackgroundRecovery(): void {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  document.removeEventListener('freeze', handleFreeze)
  document.removeEventListener('resume', handleResume)
  window.removeEventListener('pagehide', handlePageHide)
  window.removeEventListener('pageshow', handlePageShow)
}

/**
 * Manually trigger a clean reload (for error recovery buttons, etc.)
 */
export function manualCleanReload(): void {
  forceCleanReload('manual trigger')
}

/**
 * Check if this page load is a recovery reload
 */
export function isRecoveryReload(): boolean {
  if (typeof window === 'undefined') return false

  const url = new URL(window.location.href)
  return url.searchParams.has('_pwa_recovery')
}

/**
 * Clean up recovery query params from URL (call after handling recovery)
 */
export function cleanupRecoveryParams(): void {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)
  if (url.searchParams.has('_pwa_recovery') || url.searchParams.has('_t')) {
    url.searchParams.delete('_pwa_recovery')
    url.searchParams.delete('_t')
    window.history.replaceState({}, '', url.toString())
  }
}
