import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';
import { isPreLaunch, isAllowedDuringPreLaunch } from '@/lib/prelaunch/config';

// API version configuration
const API_VERSIONS = {
  current: 'v1',
  supported: ['v1'],
  deprecated: [] as string[],
  sunset: {} as Record<string, string>, // version -> sunset date
};

// Cookie name for locale preference (used by next-intl)
const LOCALE_COOKIE = 'NEXT_LOCALE';
const PRELAUNCH_AUTH_COOKIE = 'prelaunch_auth';

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
  '/intro', // Tutorial can be reviewed by authenticated users
  '/tools/kanji-mastery',
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
 * Check if a pathname is an auth route (locale-aware)
 */
function isAuthRoute(pathname: string): boolean {
  const routeWithoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '') || '/';
  return routeWithoutLocale === '/auth' || routeWithoutLocale.startsWith('/auth/');
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

async function fetchSessionInfo(request: NextRequest) {
  try {
    const response = await fetch(new URL('/api/auth/session', request.url), {
      headers: {
        cookie: request.headers.get('cookie') || '',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('[Middleware] Failed to fetch session info:', error);
    return null;
  }
}

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
  const hasPrelaunchAuth = request.cookies.get(PRELAUNCH_AUTH_COOKIE)?.value === '1';
  const allowPrelaunchAuthRoute = hasPrelaunchAuth && isAuthRoute(pathname);
  if (isPreLaunch() && !isAllowedDuringPreLaunch(pathname) && !hasSession && !allowPrelaunchAuthRoute) {
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
    const protectedResponse = await handleProtectedRoute(request);
    if (protectedResponse) {
      return protectedResponse; // Redirect to signin
    }
    // If null, user is authenticated - continue
  }

  // Apply next-intl middleware for locale routing
  const response = intlMiddleware(request);

  // Extract and pass locale to root layout via header for lang attribute
  const locale = extractLocaleFromPath(request.nextUrl.pathname);
  response.headers.set('x-locale', locale);

  // Add security headers to the response
  applySecurityHeaders(response);

  return response;
}

/**
 * Handle protected route authentication.
 * Returns a redirect response if no valid session, or null if authenticated.
 */
async function handleProtectedRoute(request: NextRequest): Promise<NextResponse | null> {
  const sessionCookie = request.cookies.get('session');

  if (!sessionCookie?.value) {
    return NextResponse.redirect(getLocaleAwareRedirect(request, '/auth/signin'));
  }

  const sessionInfo = await fetchSessionInfo(request);
  if (!sessionInfo?.authenticated) {
    return NextResponse.redirect(getLocaleAwareRedirect(request, '/auth/signin'));
  }

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

  const sessionInfo = await fetchSessionInfo(request);
  if (!sessionInfo?.authenticated) {
    return NextResponse.redirect(getLocaleAwareRedirect(request, '/auth/signin'));
  }

  if (!sessionInfo.user?.isAdmin && !sessionInfo.user?.admin) {
    console.warn('[Middleware] Non-admin user attempted admin route');
    return NextResponse.redirect(getLocaleAwareRedirect(request, '/dashboard'));
  }

  return null;
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
