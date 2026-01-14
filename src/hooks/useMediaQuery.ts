import { useState, useEffect } from 'react'

/**
 * SSR-safe media query hook
 * Returns undefined during SSR/initial hydration, then actual value after mount
 *
 * @param query - CSS media query string (e.g., '(max-width: 639px)')
 * @returns boolean | undefined - undefined during SSR, boolean after hydration
 *
 * @example
 * const isMobile = useMediaQuery('(max-width: 639px)')
 * if (isMobile === undefined) return null // or skeleton
 * if (isMobile) return <MobileView />
 * return <DesktopView />
 */
export function useMediaQuery(query: string): boolean | undefined {
  const [matches, setMatches] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    const mediaQuery = window.matchMedia(query)
    setMatches(mediaQuery.matches)

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [query])

  return matches
}

/**
 * Check if viewport is mobile (< 640px, Tailwind 'sm' breakpoint)
 * Returns undefined during SSR, boolean after hydration
 */
export function useIsMobile(): boolean | undefined {
  return useMediaQuery('(max-width: 639px)')
}

/**
 * Check if viewport is tablet or smaller (< 768px, Tailwind 'md' breakpoint)
 * Returns undefined during SSR, boolean after hydration
 */
export function useIsTablet(): boolean | undefined {
  return useMediaQuery('(max-width: 767px)')
}

/**
 * Check if viewport is desktop or larger (>= 1024px, Tailwind 'lg' breakpoint)
 * Returns undefined during SSR, boolean after hydration
 */
export function useIsDesktop(): boolean | undefined {
  return useMediaQuery('(min-width: 1024px)')
}

/**
 * Check if user prefers reduced motion
 * Returns undefined during SSR, boolean after hydration
 */
export function usePrefersReducedMotion(): boolean | undefined {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}

/**
 * Detect if the mobile virtual keyboard is visible
 * Uses the Visual Viewport API which is well-supported on modern mobile browsers
 * Returns false during SSR or on desktop
 *
 * @param threshold - Minimum height difference to consider keyboard open (default: 150px)
 * @returns boolean - true if keyboard is likely visible
 *
 * @example
 * const isKeyboardVisible = useKeyboardVisible()
 * if (isKeyboardVisible) return null // hide bottom nav
 */
export function useKeyboardVisible(threshold: number = 150): boolean {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)

  useEffect(() => {
    // Only run on mobile/tablet and if visualViewport is available
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    if (!isTouchDevice || typeof window.visualViewport === 'undefined') {
      return
    }

    const visualViewport = window.visualViewport
    if (!visualViewport) return

    const checkKeyboard = () => {
      // Compare visual viewport height to window inner height
      // When keyboard opens, visualViewport.height shrinks
      const heightDiff = window.innerHeight - visualViewport.height
      const keyboardOpen = heightDiff > threshold

      setIsKeyboardVisible(keyboardOpen)
    }

    // Check on viewport resize (keyboard open/close)
    visualViewport.addEventListener('resize', checkKeyboard)

    // Also check on focus/blur for immediate feedback
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' ||
                      target.tagName === 'TEXTAREA' ||
                      target.isContentEditable
      if (isInput) {
        // Small delay to let keyboard fully open
        setTimeout(checkKeyboard, 100)
      }
    }

    const handleBlur = () => {
      // Small delay to let keyboard fully close
      setTimeout(checkKeyboard, 100)
    }

    document.addEventListener('focusin', handleFocus)
    document.addEventListener('focusout', handleBlur)

    // Initial check
    checkKeyboard()

    return () => {
      visualViewport.removeEventListener('resize', checkKeyboard)
      document.removeEventListener('focusin', handleFocus)
      document.removeEventListener('focusout', handleBlur)
    }
  }, [threshold])

  return isKeyboardVisible
}

/**
 * Detect if the app is running in iOS standalone mode (installed PWA via "Add to Home Screen")
 * Returns false during SSR, boolean after hydration
 *
 * Detection methods:
 * 1. navigator.standalone (iOS Safari specific)
 * 2. display-mode: standalone media query
 * 3. User agent contains iPhone/iPad
 *
 * @returns boolean - true if running as installed PWA on iOS
 *
 * @example
 * const isIOSStandalone = useIsIOSStandalone()
 * if (isIOSStandalone) {
 *   // Apply iOS-specific optimizations
 * }
 */
export function useIsIOSStandalone(): boolean {
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Check if running on iOS
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)

    if (!isIOS) {
      setIsStandalone(false)
      return
    }

    // Method 1: iOS Safari specific property
    const iosStandalone = 'standalone' in navigator && (navigator as any).standalone === true

    // Method 2: Standard display-mode media query
    const standaloneMediaQuery = window.matchMedia('(display-mode: standalone)').matches

    // App is in standalone mode if either check passes
    const standalone = iosStandalone || standaloneMediaQuery

    setIsStandalone(standalone)
  }, [])

  return isStandalone
}

/**
 * Detect if the app is running in PWA standalone mode (any platform)
 * Returns false during SSR, boolean after hydration
 *
 * @returns boolean - true if running as installed PWA
 */
export function useIsStandalone(): boolean {
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Check display-mode media query (works on all platforms)
    const standaloneMediaQuery = window.matchMedia('(display-mode: standalone)').matches

    // iOS Safari specific check
    const iosStandalone = 'standalone' in navigator && (navigator as any).standalone === true

    setIsStandalone(standaloneMediaQuery || iosStandalone)
  }, [])

  return isStandalone
}
