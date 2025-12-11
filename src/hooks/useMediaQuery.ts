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
