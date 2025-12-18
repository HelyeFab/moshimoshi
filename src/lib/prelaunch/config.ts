/**
 * Pre-Launch Configuration
 *
 * Controls the pre-launch lock state for the Moshimoshi app.
 * When locked, users see the waitlist page instead of auth pages.
 *
 * Environment variables:
 * - PRELAUNCH_LOCK_ENABLED: Set to 'false' to disable lock (for testing)
 * - NEXT_PUBLIC_PRELAUNCH_LOCK_ENABLED: Client-side version
 * - LAUNCH_DATE / NEXT_PUBLIC_LAUNCH_DATE: The launch date (ISO string)
 */

// Default launch date: January 16th, 2026 at midnight UK time (GMT)
const DEFAULT_LAUNCH_DATE = '2026-01-16T00:00:00Z';

// Check if lock is explicitly disabled via env var
export const isLockExplicitlyDisabled = (): boolean => {
  const lockEnabled = process.env.PRELAUNCH_LOCK_ENABLED ||
                      process.env.NEXT_PUBLIC_PRELAUNCH_LOCK_ENABLED;
  return lockEnabled === 'false';
};

// Get launch date from env (supports both server and client contexts)
const getLaunchDateString = (): string => {
  // Server-side: check LAUNCH_DATE first, then NEXT_PUBLIC_LAUNCH_DATE
  // Client-side: only NEXT_PUBLIC_LAUNCH_DATE is available
  // Note: .trim() handles any accidental whitespace/newlines in env vars
  const envDate = process.env.LAUNCH_DATE || process.env.NEXT_PUBLIC_LAUNCH_DATE;
  return envDate?.trim() || DEFAULT_LAUNCH_DATE;
};

export const LAUNCH_DATE = new Date(getLaunchDateString());
export const LAUNCH_DATE_STRING = getLaunchDateString();

/**
 * Check if the app is currently in pre-launch (locked) mode
 * @returns true if lock is active, false if launched or lock disabled
 *
 * Lock can be disabled by setting:
 *   PRELAUNCH_LOCK_ENABLED=false (server)
 *   NEXT_PUBLIC_PRELAUNCH_LOCK_ENABLED=false (client)
 */
export function isPreLaunch(): boolean {
  // If lock is explicitly disabled, return false (not in pre-launch)
  if (isLockExplicitlyDisabled()) {
    return false;
  }
  // Otherwise, check the date
  return new Date() < LAUNCH_DATE;
}

/**
 * Get the launch date for display/countdown
 */
export function getLaunchDate(): Date {
  return LAUNCH_DATE;
}

/**
 * Routes that are accessible during pre-launch
 */
export const PRE_LAUNCH_ALLOWED_ROUTES = [
  '/',           // Landing page (modified for pre-launch)
  '/waitlist',   // Waitlist signup
  '/blog',       // Blog/articles (public content)
  '/terms',      // Legal pages
  '/privacy',
  '/about',
];

/**
 * Check if a route is accessible during pre-launch
 */
export function isAllowedDuringPreLaunch(pathname: string): boolean {
  // Remove locale prefix for checking (e.g., /en/waitlist -> /waitlist)
  const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}(?:\/|$)/, '/');

  return PRE_LAUNCH_ALLOWED_ROUTES.some(route =>
    pathWithoutLocale === route || pathWithoutLocale.startsWith(route + '/')
  );
}
