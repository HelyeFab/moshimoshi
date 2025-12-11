/**
 * Adds bottom spacing on mobile to prevent content from being hidden
 * behind the fixed bottom navigation bar.
 *
 * - Mobile: h-24 (96px) to clear the 80px navbar + safe area
 * - Desktop (sm+): No height (bottom nav not visible)
 */
export default function MobileNavSpacer() {
  return <div className="h-24 sm:h-0" aria-hidden="true" />;
}
