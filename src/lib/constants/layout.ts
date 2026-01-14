/**
 * Layout constants for consistent spacing and sizing across the application
 */

/**
 * Bottom Navigation Bar Height (Standard Mode)
 *
 * Breakdown:
 * - py-2 top padding: 8px
 * - Nav item height (h-[64px]): 64px
 * - Base bottom padding: 6px
 * - Total: 78px
 *
 * This does NOT include env(safe-area-inset-bottom) which is added dynamically
 * to support iPhone home indicators and Android gesture bars. The safe area extends
 * the background color below the navbar without adding visual empty space.
 */
export const BOTTOM_NAV_HEIGHT = 78; // px

/**
 * Bottom Navigation Bar Height (iOS Standalone Mode Only)
 *
 * Breakdown:
 * - py-2 top padding: 8px
 * - Nav item height (h-[64px]): 64px
 * - Base bottom padding: 2px (ultra-tight, safe area is reliable)
 * - Total: 74px
 *
 * Used only when app is installed as PWA on iOS via "Add to Home Screen".
 * Safe area inset is reliably reported in this mode, allowing aggressive optimization.
 */
export const BOTTOM_NAV_HEIGHT_IOS_STANDALONE = 74; // px

/**
 * Fallback safe area inset for devices that don't report it
 * Used as a safety buffer for Android gesture bars
 */
export const SAFE_AREA_FALLBACK = 24; // px
