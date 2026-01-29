'use client'

import { useState, useEffect } from 'react'
import { UAParser } from 'ua-parser-js'
import { UserAgentInfo, formatUserAgentForEmail } from '@/utils/formatUserAgent'

// Re-export for convenience
export type { UserAgentInfo }
export { formatUserAgentForEmail }

/**
 * Custom hook to capture comprehensive user agent information
 *
 * @returns {UserAgentInfo | null} Parsed user agent data or null if not available
 *
 * @example
 * ```tsx
 * const userAgent = useUserAgent()
 *
 * // Use in form submission
 * fetch('/api/contact', {
 *   method: 'POST',
 *   body: JSON.stringify({ ...formData, userAgent })
 * })
 * ```
 */
export function useUserAgent(): UserAgentInfo | null {
  const [userAgentInfo, setUserAgentInfo] = useState<UserAgentInfo | null>(null)

  useEffect(() => {
    console.log('[useUserAgent] Hook mounted, starting capture...')
    if (typeof window === 'undefined') {
      console.log('[useUserAgent] Window undefined, skipping')
      return
    }

    try {
      const parser = new UAParser()
      const result = parser.getResult()
      console.log('[useUserAgent] Parsed UA:', result)

      // Detect connection type (with fallback for unsupported browsers)
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
      const connectionType = connection?.effectiveType || connection?.type || 'Unknown'

      // Detect touch support
      const touchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0

      const info: UserAgentInfo = {
        // Browser information
        browser: result.browser.name || 'Unknown',
        browserVersion: result.browser.version || 'Unknown',

        // Operating System
        os: result.os.name || 'Unknown',
        osVersion: result.os.version || 'Unknown',

        // Device type
        device: result.device.type
          ? result.device.type.charAt(0).toUpperCase() + result.device.type.slice(1)
          : 'Desktop',

        // Screen information
        screen: `${window.screen.width}x${window.screen.height}`,
        viewport: `${window.innerWidth}x${window.innerHeight}`,

        // Raw user agent string
        userAgent: navigator.userAgent,

        // Timezone
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,

        // Browser language
        language: navigator.language || 'Unknown',

        // Additional context
        referrer: document.referrer,
        currentUrl: window.location.href,
        cookiesEnabled: navigator.cookieEnabled,
        connectionType: connectionType,
        touchSupport: touchSupport,
        pixelRatio: window.devicePixelRatio || 1,
      }

      console.log('[useUserAgent] ✅ User agent info captured:', info)
      setUserAgentInfo(info)
    } catch (error) {
      console.error('[useUserAgent] ❌ Failed to parse user agent:', error)
      // Fallback to basic info
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
      const touchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0

      setUserAgentInfo({
        browser: 'Unknown',
        browserVersion: 'Unknown',
        os: 'Unknown',
        osVersion: 'Unknown',
        device: 'Unknown',
        screen: 'Unknown',
        viewport: 'Unknown',
        userAgent: navigator.userAgent || 'Unknown',
        timezone: 'Unknown',
        language: navigator.language || 'Unknown',
        referrer: document.referrer || '',
        currentUrl: window.location.href || 'Unknown',
        cookiesEnabled: navigator.cookieEnabled || false,
        connectionType: connection?.effectiveType || 'Unknown',
        touchSupport: touchSupport,
        pixelRatio: window.devicePixelRatio || 1,
      })
    }
  }, [])

  return userAgentInfo
}
