import { BOTTOM_NAV_HEIGHT, SAFE_AREA_FALLBACK } from '@/lib/constants/layout';

/**
 * Adds bottom spacing on mobile to prevent content from being hidden
 * behind the fixed bottom navigation bar.
 *
 * - Mobile: ${BOTTOM_NAV_HEIGHT}px to clear the navbar + safe area
 * - Desktop (sm+): No height (bottom nav not visible)
 */
export default function MobileNavSpacer() {
  return (
    <div
      className="md:hidden w-full shrink-0 pointer-events-none sm:h-0"
      style={{ height: `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom, ${SAFE_AREA_FALLBACK}px))` }}
      aria-hidden="true"
    />
  );
}
