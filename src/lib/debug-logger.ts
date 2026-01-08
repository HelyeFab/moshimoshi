/**
 * Visual Debug Logger with Colored Banners
 * Makes it easy to track R2 operations in console
 */

const COLORS = {
  red: '#ff4444',
  green: '#44ff44',
  blue: '#4444ff',
  yellow: '#ffff44',
  purple: '#ff44ff',
  orange: '#ff8844',
  cyan: '#44ffff',
}

export const debugLogger = {
  /**
   * DECK IMPORT - Red Banner
   */
  deckImport: (message: string, data?: any) => {
    console.log(
      '%c🔴 DECK IMPORT 🔴',
      `background: ${COLORS.red}; color: black; padding: 4px 8px; font-weight: bold; font-size: 14px;`,
      message,
      data || ''
    )
  },

  /**
   * R2 UPLOAD - Green Banner
   */
  r2Upload: (message: string, data?: any) => {
    console.log(
      '%c🟢 R2 UPLOAD 🟢',
      `background: ${COLORS.green}; color: black; padding: 4px 8px; font-weight: bold; font-size: 14px;`,
      message,
      data || ''
    )
  },

  /**
   * R2 DELETE - Purple Banner
   */
  r2Delete: (message: string, data?: any) => {
    console.log(
      '%c🟣 R2 DELETE 🟣',
      `background: ${COLORS.purple}; color: black; padding: 4px 8px; font-weight: bold; font-size: 14px;`,
      message,
      data || ''
    )
  },

  /**
   * DECK DELETE - Orange Banner
   */
  deckDelete: (message: string, data?: any) => {
    console.log(
      '%c🟠 DECK DELETE 🟠',
      `background: ${COLORS.orange}; color: black; padding: 4px 8px; font-weight: bold; font-size: 14px;`,
      message,
      data || ''
    )
  },

  /**
   * QUEUE STATUS - Blue Banner
   */
  queueStatus: (message: string, data?: any) => {
    console.log(
      '%c🔵 QUEUE STATUS 🔵',
      `background: ${COLORS.blue}; color: black; padding: 4px 8px; font-weight: bold; font-size: 14px;`,
      message,
      data || ''
    )
  },

  /**
   * ERROR - Red Background
   */
  error: (message: string, error?: any) => {
    console.error(
      '%c❌ ERROR ❌',
      `background: ${COLORS.red}; color: white; padding: 4px 8px; font-weight: bold; font-size: 14px;`,
      message,
      error || ''
    )
  },

  /**
   * SUCCESS - Green Background
   */
  success: (message: string, data?: any) => {
    console.log(
      '%c✅ SUCCESS ✅',
      `background: ${COLORS.green}; color: black; padding: 4px 8px; font-weight: bold; font-size: 14px;`,
      message,
      data || ''
    )
  },

  /**
   * STEP - Cyan numbered steps
   */
  step: (step: number, message: string, data?: any) => {
    console.log(
      `%c📍 STEP ${step} 📍`,
      `background: ${COLORS.cyan}; color: black; padding: 4px 8px; font-weight: bold; font-size: 14px;`,
      message,
      data || ''
    )
  }
}
