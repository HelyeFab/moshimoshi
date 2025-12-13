/**
 * PWA Splash Screen Recovery Utility
 *
 * Detects when the PWA is stuck on the splash screen (app not rendering)
 * and attempts automatic recovery. This commonly happens on Android when:
 * - IndexedDB is corrupted
 * - Service worker cache is stale
 * - Auth initialization hangs
 * - Network requests timeout
 *
 * @see https://github.com/nicnocquee/pwa-splash-screen-issue
 */

const SPLASH_TIMEOUT = 15000 // 15 seconds max on splash before recovery
const RECOVERY_KEY = 'pwa_splash_recovery_attempt'
const LOAD_START_KEY = 'pwa_load_start'
const RECOVERY_COOLDOWN = 60000 // 1 minute between recovery attempts
const MAX_RECOVERY_ATTEMPTS = 3

interface RecoveryState {
  attempts: number
  lastAttempt: number
}

/**
 * Get the current recovery state from localStorage
 */
function getRecoveryState(): RecoveryState {
  try {
    const stored = localStorage.getItem(RECOVERY_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // Ignore parse errors
  }
  return { attempts: 0, lastAttempt: 0 }
}

/**
 * Save recovery state to localStorage
 */
function setRecoveryState(state: RecoveryState): void {
  try {
    localStorage.setItem(RECOVERY_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage errors
  }
}

/**
 * Clear recovery state (call this when app successfully renders)
 */
export function clearRecoveryState(): void {
  try {
    localStorage.removeItem(RECOVERY_KEY)
    sessionStorage.removeItem(LOAD_START_KEY)
  } catch {
    // Ignore errors
  }
}

/**
 * Perform a soft recovery - just reload the page
 */
function softRecovery(): void {
  console.warn('[PWA Recovery] Performing soft recovery (reload)')
  window.location.reload()
}

/**
 * Perform a hard recovery - clear caches and reload
 */
async function hardRecovery(): Promise<void> {
  console.warn('[PWA Recovery] Performing hard recovery (clear caches + reload)')

  try {
    // Clear all caches
    const cacheNames = await caches.keys()
    await Promise.all(cacheNames.map(name => caches.delete(name)))
    console.log('[PWA Recovery] Cleared', cacheNames.length, 'caches')
  } catch (err) {
    console.error('[PWA Recovery] Failed to clear caches:', err)
  }

  // Reload with cache bypass
  window.location.href = window.location.origin + window.location.pathname + '?recovery=' + Date.now()
}

/**
 * Perform a full recovery - unregister service worker, clear everything
 */
async function fullRecovery(): Promise<void> {
  console.warn('[PWA Recovery] Performing FULL recovery (nuclear option)')

  try {
    // Unregister all service workers
    const registrations = await navigator.serviceWorker?.getRegistrations()
    if (registrations) {
      await Promise.all(registrations.map(reg => reg.unregister()))
      console.log('[PWA Recovery] Unregistered', registrations.length, 'service workers')
    }
  } catch (err) {
    console.error('[PWA Recovery] Failed to unregister service workers:', err)
  }

  try {
    // Clear all caches
    const cacheNames = await caches.keys()
    await Promise.all(cacheNames.map(name => caches.delete(name)))
  } catch (err) {
    console.error('[PWA Recovery] Failed to clear caches:', err)
  }

  try {
    // Clear IndexedDB databases (careful - this removes user data!)
    // Only clear PWA-related databases, not user data
    const databases = await indexedDB.databases?.()
    if (databases) {
      const pwaDbNames = databases
        .filter(db => db.name?.includes('workbox') || db.name?.includes('sw-'))
        .map(db => db.name!)

      for (const name of pwaDbNames) {
        indexedDB.deleteDatabase(name)
      }
      console.log('[PWA Recovery] Cleared PWA-related IndexedDB databases')
    }
  } catch (err) {
    // indexedDB.databases() not supported in all browsers
    console.log('[PWA Recovery] Could not enumerate IndexedDB databases')
  }

  // Clear session storage
  sessionStorage.clear()

  // Reset recovery state since we're doing full recovery
  localStorage.removeItem(RECOVERY_KEY)

  // Force reload from server
  window.location.href = window.location.origin + '?recovery=full&t=' + Date.now()
}

/**
 * Initialize splash screen recovery detection
 * Call this as early as possible in app initialization
 */
export function initSplashRecovery(): void {
  if (typeof window === 'undefined') return

  // Only run in standalone mode (installed PWA)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                       (window.navigator as any).standalone === true

  if (!isStandalone) {
    // Not a PWA, no need for recovery
    return
  }

  console.log('[PWA Recovery] Initializing splash recovery detection (standalone mode)')

  // Record when we started loading
  const startTime = Date.now()
  sessionStorage.setItem(LOAD_START_KEY, String(startTime))

  // Check if we're in a recovery loop
  const state = getRecoveryState()
  const timeSinceLastAttempt = Date.now() - state.lastAttempt

  if (state.attempts >= MAX_RECOVERY_ATTEMPTS && timeSinceLastAttempt < RECOVERY_COOLDOWN * 5) {
    // We've tried too many times recently, give up and let user handle it
    console.error('[PWA Recovery] Max recovery attempts reached. User may need to reinstall the PWA.')
    // Clear the recovery state so next time we start fresh
    localStorage.removeItem(RECOVERY_KEY)
    return
  }

  // Set up timeout to detect stuck splash screen
  const timeoutId = setTimeout(() => {
    // Check if app has rendered by looking for our sentinel element
    const appRendered = document.querySelector('[data-app-rendered="true"]')

    if (appRendered) {
      // App rendered successfully, clear recovery state
      clearRecoveryState()
      console.log('[PWA Recovery] App rendered successfully within timeout')
      return
    }

    // App is stuck on splash screen
    console.warn('[PWA Recovery] App stuck on splash screen, attempting recovery')
    console.warn('[PWA Recovery] Recovery attempt', state.attempts + 1, 'of', MAX_RECOVERY_ATTEMPTS)

    // Update recovery state
    const newState: RecoveryState = {
      attempts: state.attempts + 1,
      lastAttempt: Date.now()
    }
    setRecoveryState(newState)

    // Choose recovery strategy based on attempt count
    if (newState.attempts === 1) {
      // First attempt: soft recovery (just reload)
      softRecovery()
    } else if (newState.attempts === 2) {
      // Second attempt: hard recovery (clear caches)
      hardRecovery()
    } else {
      // Third+ attempt: full recovery (nuclear option)
      fullRecovery()
    }
  }, SPLASH_TIMEOUT)

  // Clean up timeout if app renders before timeout
  const observer = new MutationObserver(() => {
    const appRendered = document.querySelector('[data-app-rendered="true"]')
    if (appRendered) {
      clearTimeout(timeoutId)
      observer.disconnect()
      clearRecoveryState()
      console.log('[PWA Recovery] App rendered, recovery check cleared')
    }
  })

  // Start observing for the sentinel element
  observer.observe(document.body, {
    childList: true,
    subtree: true
  })

  // Also clear timeout on window load as a fallback
  window.addEventListener('load', () => {
    // Give React a moment to hydrate
    setTimeout(() => {
      const appRendered = document.querySelector('[data-app-rendered="true"]')
      if (appRendered) {
        clearTimeout(timeoutId)
        observer.disconnect()
        clearRecoveryState()
      }
    }, 1000)
  }, { once: true })
}

/**
 * Mark the app as rendered - call this when your main app component mounts
 * This should be called from your root layout or app component
 */
export function markAppRendered(): void {
  clearRecoveryState()
}
