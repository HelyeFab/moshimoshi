import { useState, useEffect } from 'react'
import { UAParser } from 'ua-parser-js'

export interface UserAgentInfo {
  browser: string
  browserVersion: string
  os: string
  osVersion: string
  device: string
  screen: string
  viewport: string
  userAgent: string
  timezone: string
  language: string
}

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
    if (typeof window === 'undefined') return

    try {
      const parser = new UAParser()
      const result = parser.getResult()

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
      }

      setUserAgentInfo(info)
    } catch (error) {
      console.error('[useUserAgent] Failed to parse user agent:', error)
      // Fallback to basic info
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
      })
    }
  }, [])

  return userAgentInfo
}

/**
 * Utility function to format user agent info for email templates
 *
 * @param {UserAgentInfo} info - User agent information object
 * @returns {string} Formatted HTML string for email inclusion
 */
export function formatUserAgentForEmail(info: UserAgentInfo | null): string {
  if (!info) {
    return '<p style="color: #6b7280;">User agent information not available</p>'
  }

  return `
    <div style="background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; font-weight: bold; color: #1f2937;">Technical Details</p>
      <table style="width: 100%; font-size: 13px; color: #374151;">
        <tr>
          <td style="padding: 4px 0;"><strong>Browser:</strong></td>
          <td style="padding: 4px 0;">${info.browser} ${info.browserVersion}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0;"><strong>Operating System:</strong></td>
          <td style="padding: 4px 0;">${info.os} ${info.osVersion}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0;"><strong>Device:</strong></td>
          <td style="padding: 4px 0;">${info.device}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0;"><strong>Screen:</strong></td>
          <td style="padding: 4px 0;">${info.screen}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0;"><strong>Viewport:</strong></td>
          <td style="padding: 4px 0;">${info.viewport}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0;"><strong>Timezone:</strong></td>
          <td style="padding: 4px 0;">${info.timezone}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0;"><strong>Language:</strong></td>
          <td style="padding: 4px 0;">${info.language}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; vertical-align: top;"><strong>User Agent:</strong></td>
          <td style="padding: 4px 0; word-break: break-all; font-size: 11px; color: #6b7280;">${info.userAgent}</td>
        </tr>
      </table>
    </div>
  `
}
