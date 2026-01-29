/**
 * User Agent Formatting Utilities
 *
 * Server-compatible utilities for formatting user agent information.
 * This file does NOT have 'use client' directive, so it can be used in API routes.
 */

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
  // Additional context fields
  referrer: string
  currentUrl: string
  cookiesEnabled: boolean
  connectionType: string
  touchSupport: boolean
  pixelRatio: number
}

/**
 * Utility function to format user agent info for email templates
 *
 * @param {UserAgentInfo} info - User agent information object
 * @returns {string} Formatted HTML string for email inclusion
 */
export function formatUserAgentForEmail(info: UserAgentInfo | null): string {
  if (!info) {
    return `
      <div style="background: #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #f59e0b;">
        <p style="margin: 0; color: #92400e; font-size: 13px;">
          ⚠️ <strong>Technical Details Not Available</strong><br>
          User agent information was not captured for this submission.
        </p>
      </div>
    `
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
          <td style="padding: 4px 0;"><strong>Pixel Ratio:</strong></td>
          <td style="padding: 4px 0;">${info.pixelRatio}x</td>
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
          <td style="padding: 4px 0;"><strong>Connection:</strong></td>
          <td style="padding: 4px 0;">${info.connectionType}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0;"><strong>Cookies:</strong></td>
          <td style="padding: 4px 0;">${info.cookiesEnabled ? '✓ Enabled' : '✗ Disabled'}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0;"><strong>Touch:</strong></td>
          <td style="padding: 4px 0;">${info.touchSupport ? '✓ Supported' : '✗ Not Supported'}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; vertical-align: top;"><strong>Current URL:</strong></td>
          <td style="padding: 4px 0; word-break: break-all; font-size: 11px;">${info.currentUrl}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; vertical-align: top;"><strong>Referrer:</strong></td>
          <td style="padding: 4px 0; word-break: break-all; font-size: 11px;">${info.referrer || '(Direct)'}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; vertical-align: top;"><strong>User Agent:</strong></td>
          <td style="padding: 4px 0; word-break: break-all; font-size: 11px; color: #6b7280;">${info.userAgent}</td>
        </tr>
      </table>
    </div>
  `
}
