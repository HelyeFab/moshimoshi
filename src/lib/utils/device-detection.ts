/**
 * Device and Platform Detection Utilities
 * Reuses existing patterns from a2hs.ts, useMediaQuery.ts, FCMManager.ts
 */

export interface DeviceInfo {
  isIOS: boolean
  isAndroid: boolean
  isMobile: boolean
  isPWA: boolean
  isIOSPWA: boolean
  platform: 'ios' | 'android' | 'desktop'
}

/**
 * Detect if running on iOS device
 * Pattern from: src/lib/pwa/a2hs.ts:113-118
 */
export function isIOSDevice(): boolean {
  if (typeof window === 'undefined') return false
  const userAgent = window.navigator.userAgent.toLowerCase()
  return /iphone|ipad|ipod/.test(userAgent)
}

/**
 * Detect if app is in standalone PWA mode
 * Pattern from: src/hooks/useMediaQuery.ts:169-183
 */
export function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false

  const standaloneMediaQuery = window.matchMedia('(display-mode: standalone)').matches
  const iosStandalone = 'standalone' in navigator && (navigator as any).standalone === true

  return standaloneMediaQuery || iosStandalone
}

/**
 * Detect iOS PWA standalone mode (critical for auth popup blocking)
 * Pattern from: src/hooks/useMediaQuery.ts:139-161
 */
export function isIOSPWAStandalone(): boolean {
  return isIOSDevice() && isStandaloneMode()
}

/**
 * Detect Android device
 * Pattern from: src/lib/pwa/a2hs.ts:121-127
 */
export function isAndroidDevice(): boolean {
  if (typeof window === 'undefined') return false
  const userAgent = window.navigator.userAgent.toLowerCase()
  return /android/.test(userAgent)
}

/**
 * Get comprehensive device information
 * Pattern from: src/lib/notifications/push/FCMManager.ts:447-479
 */
export function getDeviceInfo(): DeviceInfo {
  const isIOS = isIOSDevice()
  const isAndroid = isAndroidDevice()
  const isMobile = isIOS || isAndroid
  const isPWA = isStandaloneMode()
  const isIOSPWA = isIOSPWAStandalone()

  let platform: 'ios' | 'android' | 'desktop' = 'desktop'
  if (isIOS) platform = 'ios'
  else if (isAndroid) platform = 'android'

  return { isIOS, isAndroid, isMobile, isPWA, isIOSPWA, platform }
}

/**
 * Get platform-specific getRedirectResult timeout
 * iOS (all): 15s - Apple Sign-In on iOS Safari/Chrome needs longer timeout
 * Other platforms: 5s (current timeout works fine)
 */
export function getAuthRedirectTimeout(): number {
  return isIOSDevice() ? 15000 : 5000
}
