import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';

// API version configuration
const API_VERSIONS = {
  current: 'v1',
  supported: ['v1'],
  deprecated: [] as string[],
  sunset: {} as Record<string, string>, // version -> sunset date
};

// Cookie name for locale preference (used by next-intl)
const LOCALE_COOKIE = 'NEXT_LOCALE';

// Pre-launch configuration
// Launch date: January 16th, 2026 at midnight UK time (GMT)
const LAUNCH_DATE = new Date(process.env.LAUNCH_DATE || '2026-01-16T00:00:00Z');

// Routes accessible during pre-launch period
const PRE_LAUNCH_ALLOWED_ROUTES = [
  '/',           // Landing page (shows pre-launch mode)
  '/waitlist',   // Waitlist signup
  '/terms',      // Legal pages
  '/privacy',
  '/about',
];

/**
 * Check if currently in pre-launch (locked) mode
 * Can be disabled by setting PRELAUNCH_LOCK_ENABLED=false
 */
function isPreLaunchMode(): boolean {
  // Check if lock is explicitly disabled
  if (process.env.PRELAUNCH_LOCK_ENABLED === 'false') {
    return false;
  }
  return new Date() < LAUNCH_DATE;
}

/**
 * Check if a route is allowed during pre-launch
 */
function isAllowedDuringPreLaunch(pathname: string): boolean {
  // Remove locale prefix to get the actual route
  const routeWithoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '') || '/';

  return PRE_LAUNCH_ALLOWED_ROUTES.some(route =>
    routeWithoutLocale === route || routeWithoutLocale.startsWith(`${route}/`)
  );
}

// Routes that require authentication (not admin, just logged in)
// These routes will redirect to signin if no session cookie exists
const PROTECTED_ROUTES = [
  '/news',
  '/dashboard',
  '/statistics',
  '/account',
  '/lists',
  '/drill',
  '/review-hub',
  '/onboarding',
  '/tools/kanji-mastery',
  '/tools/textbook-vocabulary',
  '/textbook-vocabulary',
  '/youtube-shadowing',
  '/my-videos',
  '/stories',
  '/comics',
];

/**
 * Extract locale from pathname or return default locale
 */
function extractLocaleFromPath(pathname: string): string {
  const localeMatch = pathname.match(/^\/([a-z]{2})(?:\/|$)/);
  if (localeMatch && routing.locales.includes(localeMatch[1] as typeof routing.locales[number])) {
    return localeMatch[1];
  }
  return routing.defaultLocale;
}

/**
 * Build a locale-aware redirect URL
 */
function getLocaleAwareRedirect(request: NextRequest, path: string): URL {
  const locale = extractLocaleFromPath(request.nextUrl.pathname);
  return new URL(`/${locale}${path}`, request.url);
}

/**
 * Check if a pathname matches a protected route
 */
function isProtectedRoute(pathname: string): boolean {
  // Remove locale prefix to get the actual route
  const routeWithoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '') || '/';

  return PROTECTED_ROUTES.some(route =>
    routeWithoutLocale === route || routeWithoutLocale.startsWith(`${route}/`)
  );
}

/**
 * Create the next-intl middleware with our routing configuration.
 *
 * Locale detection priority:
 * 1. URL path (e.g., /ja/dashboard)
 * 2. Cookie (NEXT_LOCALE)
 * 3. Accept-Language header
 * 4. Default locale (en)
 */
const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Handle API routes separately - no locale routing for APIs
  if (pathname.startsWith('/api/')) {
    return handleApiRoute(request);
  }

  // Skip middleware for static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.')  // static files (but not locale paths like /en/)
  ) {
    return NextResponse.next();
  }

  // Pre-launch lock: Redirect all non-allowed routes to landing page
  // EXCEPTION: Logged-in users (have session cookie) can bypass the lock
  // This allows existing users (e.g., developer testing) to use the full app
  const hasSession = request.cookies.has('session');
  if (isPreLaunchMode() && !isAllowedDuringPreLaunch(pathname) && !hasSession) {
    console.log(`[Middleware] Pre-launch lock: Redirecting ${pathname} to landing page`);
    return NextResponse.redirect(getLocaleAwareRedirect(request, '/'));
  }

  // Check admin routes - Enhanced security validation
  // Admin routes are locale-prefixed (e.g., /en/admin, /ja/admin)
  const isAdminRoute = routing.locales.some(
    (locale) => pathname.startsWith(`/${locale}/admin`) || pathname === `/${locale}/admin`
  ) || pathname.startsWith('/admin');

  if (isAdminRoute) {
    const adminResponse = await handleAdminRoute(request);
    if (adminResponse) {
      return adminResponse; // Return redirect or error response
    }
    // If null, continue to intl middleware (admin access granted)
  }

  // Check protected routes - requires authentication (but not admin)
  if (isProtectedRoute(pathname)) {
    const protectedResponse = handleProtectedRoute(request);
    if (protectedResponse) {
      return protectedResponse; // Redirect to signin
    }
    // If null, user is authenticated - continue
  }

  // Apply next-intl middleware for locale routing
  const response = intlMiddleware(request);

  // Add security headers to the response
  applySecurityHeaders(response);

  return response;
}

/**
 * Handle protected route authentication.
 * Returns a redirect response if no session, or null if authenticated.
 * This is a lightweight check - just verifies session cookie exists.
 */
function handleProtectedRoute(request: NextRequest): NextResponse | null {
  const sessionCookie = request.cookies.get('session');

  if (!sessionCookie?.value) {
    // No session cookie - redirect to signin
    return NextResponse.redirect(getLocaleAwareRedirect(request, '/auth/signin'));
  }

  // Session exists - allow access (full validation happens in the page/API)
  return null;
}

/**
 * Handle admin route authentication and authorization.
 * Returns a redirect response if access denied, or null if access granted.
 */
async function handleAdminRoute(request: NextRequest): Promise<NextResponse | null> {
  const sessionCookie = request.cookies.get('session');

  if (!sessionCookie?.value) {
    // No session, redirect to signin
    console.log('[Middleware] No session for admin route access');
    return NextResponse.redirect(getLocaleAwareRedirect(request, '/auth/signin'));
  }

  // Use Edge-compatible JWT decoder (no signature verification in middleware)
  try {
    // Import Edge-compatible JWT validation
    const { validateTokenBasic } = await import('@/lib/auth/jwt-edge');
    const validation = validateTokenBasic(sessionCookie.value);

    console.log('[Middleware] Token validation result:', {
      valid: validation.valid,
      hasPayload: !!validation.payload,
      admin: validation.payload?.admin,
      uid: validation.payload?.uid,
      reason: validation.reason,
    });

    if (!validation.valid) {
      console.warn(
        '[Middleware] Invalid session token for admin route:',
        validation.reason
      );
      return NextResponse.redirect(getLocaleAwareRedirect(request, '/auth/signin'));
    }

    // Check if user has admin flag in JWT
    // Note: This is a preliminary check without signature verification
    // API routes will do full Firebase validation with proper JWT verification
    if (!validation.payload?.admin) {
      console.warn(
        `[Middleware] Non-admin user attempted admin route: ${validation.payload?.uid?.substring(0, 8)}...`
      );
      console.warn('[Middleware] Full payload:', validation.payload);
      return NextResponse.redirect(getLocaleAwareRedirect(request, '/dashboard'));
    }

    // Token appears valid and user appears to be admin
    // Full verification happens in API routes with Node.js runtime
    return null; // Access granted
  } catch (error) {
    console.error('[Middleware] Error validating admin session:', error);
    // On error, redirect to signin for security
    return NextResponse.redirect(getLocaleAwareRedirect(request, '/auth/signin'));
  }
}

/**
 * Handle API route middleware
 */
async function handleApiRoute(request: NextRequest): Promise<NextResponse> {
  // Extract and validate API version
  const version = extractApiVersion(request);

  // Validate API version
  if (!API_VERSIONS.supported.includes(version)) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_API_VERSION',
          message: `API version ${version} is not supported`,
          supportedVersions: API_VERSIONS.supported,
        },
      },
      { status: 400 }
    );
  }

  // Create response
  const response = NextResponse.next();

  // Add API headers
  response.headers.set('X-API-Version', version);

  // Add deprecation warnings
  if (API_VERSIONS.deprecated.includes(version)) {
    response.headers.set('X-API-Deprecation', 'true');
    response.headers.set(
      'X-API-Deprecation-Date',
      API_VERSIONS.sunset[version] || 'TBD'
    );
  }

  // Apply security headers
  applySecurityHeaders(response);

  // Add CORS headers for API
  response.headers.set(
    'Access-Control-Allow-Origin',
    process.env.NEXT_PUBLIC_APP_URL || '*'
  );
  response.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, PATCH, OPTIONS'
  );
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-API-Version, X-Request-ID, X-User-ID, X-Session-ID'
  );
  response.headers.set('Access-Control-Max-Age', '86400');

  return response;
}

/**
 * Extract API version from request
 */
function extractApiVersion(request: NextRequest): string {
  const { pathname } = request.nextUrl;

  // Check path for version (e.g., /api/v1/...)
  const pathMatch = pathname.match(/\/api\/(v\d+)\//);
  if (pathMatch) {
    return pathMatch[1];
  }

  // Check header for version
  const headerVersion = request.headers.get('X-API-Version');
  if (headerVersion && /^v\d+$/.test(headerVersion)) {
    return headerVersion;
  }

  // Check query parameter for version
  const queryVersion = request.nextUrl.searchParams.get('api_version');
  if (queryVersion && /^v\d+$/.test(queryVersion)) {
    return queryVersion;
  }

  // Default to current version
  return API_VERSIONS.current;
}

/**
 * Apply security headers to response
 */
function applySecurityHeaders(response: NextResponse): void {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static files with extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
