/**
 * Request Manager
 *
 * Manages AbortControllers for API requests to allow clean cancellation
 * during sign out or component unmounting.
 *
 * Usage:
 * - Register controllers when making API calls
 * - Call cancelAllRequests() on sign out
 */

class RequestManager {
  private controllers: Set<AbortController> = new Set()

  /**
   * Create and register a new AbortController
   * @returns AbortController and its signal
   */
  createController(): { controller: AbortController; signal: AbortSignal } {
    const controller = new AbortController()
    this.controllers.add(controller)

    // Auto-cleanup when request completes
    controller.signal.addEventListener('abort', () => {
      this.controllers.delete(controller)
    })

    return { controller, signal: controller.signal }
  }

  /**
   * Cancel all pending requests
   * Called during sign out to prevent 401 errors
   */
  cancelAllRequests(reason: string = 'User signed out') {
    console.log(`[RequestManager] Cancelling ${this.controllers.size} pending requests`)

    this.controllers.forEach(controller => {
      try {
        controller.abort(reason)
      } catch (error) {
        // Ignore errors from already aborted controllers
        console.warn('[RequestManager] Error aborting controller:', error)
      }
    })

    this.controllers.clear()
  }

  /**
   * Get count of pending requests (for debugging)
   */
  getPendingCount(): number {
    return this.controllers.size
  }

  /**
   * Manually remove a controller (optional, auto-cleanup handles this)
   */
  removeController(controller: AbortController) {
    this.controllers.delete(controller)
  }
}

// Singleton instance
export const requestManager = new RequestManager()

/**
 * Hook for React components to use with fetch
 * Automatically cancels request on component unmount
 */
export function useAbortController() {
  if (typeof window === 'undefined') {
    // SSR fallback
    return { signal: null }
  }

  const { signal } = requestManager.createController()
  return { signal }
}

/**
 * Wrapper for fetch that automatically registers with RequestManager
 * Drop-in replacement for regular fetch
 */
export async function managedFetch(
  url: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const { signal } = requestManager.createController()

  // Merge with existing signal if provided
  const mergedInit: RequestInit = {
    ...init,
    signal: init?.signal || signal
  }

  try {
    const response = await fetch(url, mergedInit)
    return response
  } catch (error: any) {
    // Suppress AbortError after sign out (expected behavior)
    if (error.name === 'AbortError') {
      console.debug('[RequestManager] Request cancelled:', url)
      throw error
    }
    throw error
  }
}
