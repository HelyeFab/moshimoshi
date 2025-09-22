import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// API version configuration
const API_VERSIONS = {
  current: 'v1',
  supported: ['v1'],
  deprecated: [] as string[],
  sunset: {} as Record<string, string>, // version -> sunset date
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Handle API routes separately
  if (pathname.startsWith('/api/')) {
    return handleApiRoute(request)
  }

  // Skip middleware for static files
  if (
    pathname.startsWith('/_next') ||
    pathname.includes('.') // static files
  ) {
    return NextResponse.next()
  }

  // Check admin routes - Enhanced security validation
  if (pathname.startsWith('/admin')) {
    const sessionCookie = request.cookies.get('session')

    if (!sessionCookie?.value) {
      // No session, redirect to signin
      console.log('[Middleware] No session for admin route access')
      return NextResponse.redirect(new URL('/auth/signin', request.url))
    }

    // Use Edge-compatible JWT decoder (no signature verification in middleware)
    try {
      // Import Edge-compatible JWT validation
      const { validateTokenBasic } = await import('@/lib/auth/jwt-edge')
      const validation = validateTokenBasic(sessionCookie.value)

      console.log('[Middleware] Token validation result:', {
        valid: validation.valid,
        hasPayload: !!validation.payload,
        admin: validation.payload?.admin,
        uid: validation.payload?.uid,
        reason: validation.reason
      })

      if (!validation.valid) {
        console.warn('[Middleware] Invalid session token for admin route:', validation.reason)
        return NextResponse.redirect(new URL('/auth/signin', request.url))
      }

      // Check if user has admin flag in JWT
      // Note: This is a preliminary check without signature verification
      // API routes will do full Firebase validation with proper JWT verification
      if (!validation.payload?.admin) {
        console.warn(`[Middleware] Non-admin user attempted admin route: ${validation.payload?.uid?.substring(0, 8)}...`)
        console.warn('[Middleware] Full payload:', validation.payload)
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }

      // Token appears valid and user appears to be admin
      // Full verification happens in API routes with Node.js runtime
    } catch (error) {
      console.error('[Middleware] Error validating admin session:', error)
      // On error, redirect to signin for security
      return NextResponse.redirect(new URL('/auth/signin', request.url))
    }
  }

  // Add security headers for non-API routes
  const response = NextResponse.next()
  applySecurityHeaders(response)

  return response
}

/**
 * Handle API route middleware
 */
async function handleApiRoute(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl
  
  // Extract and validate API version
  const version = extractApiVersion(request)
  
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
    )
  }
  
  // Create response
  const response = NextResponse.next()
  
  // Add API headers
  response.headers.set('X-API-Version', version)
  
  // Add deprecation warnings
  if (API_VERSIONS.deprecated.includes(version)) {
    response.headers.set('X-API-Deprecation', 'true')
    response.headers.set(
      'X-API-Deprecation-Date',
      API_VERSIONS.sunset[version] || 'TBD'
    )
  }
  
  // Apply security headers
  applySecurityHeaders(response)
  
  // Add CORS headers for API
  response.headers.set('Access-Control-Allow-Origin', process.env.NEXT_PUBLIC_APP_URL || '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-API-Version, X-Request-ID, X-User-ID, X-Session-ID'
  )
  response.headers.set('Access-Control-Max-Age', '86400')
  
  return response
}

/**
 * Extract API version from request
 */
function extractApiVersion(request: NextRequest): string {
  const { pathname } = request.nextUrl
  
  // Check path for version (e.g., /api/v1/...)
  const pathMatch = pathname.match(/\/api\/(v\d+)\//)
  if (pathMatch) {
    return pathMatch[1]
  }
  
  // Check header for version
  const headerVersion = request.headers.get('X-API-Version')
  if (headerVersion && /^v\d+$/.test(headerVersion)) {
    return headerVersion
  }
  
  // Check query parameter for version
  const queryVersion = request.nextUrl.searchParams.get('api_version')
  if (queryVersion && /^v\d+$/.test(queryVersion)) {
    return queryVersion
  }
  
  // Default to current version
  return API_VERSIONS.current
}

/**
 * Apply security headers to response
 */
function applySecurityHeaders(response: NextResponse): void {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  )
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}