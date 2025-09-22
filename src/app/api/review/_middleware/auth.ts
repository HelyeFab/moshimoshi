/**
 * Authentication middleware for review API endpoints
 * Validates session tokens and enforces access control
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateSessionFromRequest } from '@/lib/auth'
import { SessionUser } from '@/lib/auth'

export interface AuthenticatedRequest extends NextRequest {
  user?: SessionUser
}

/**
 * Authenticate the request and attach user to the request object
 */
export async function authenticate(
  request: NextRequest
): Promise<{ user: SessionUser | null; response?: NextResponse }> {
  try {
    // Get user agent and IP for fingerprinting (reserved for future use)
    const _userAgent = request.headers.get('user-agent') || undefined
    const _ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     undefined

    // Validate session
    const validation = await validateSessionFromRequest(request)

    if (!validation.valid || !validation.user) {
      return {
        user: null,
        response: NextResponse.json(
          { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
          { status: 401 }
        ),
      }
    }

    return { user: validation.user }
  } catch (error) {
    console.error('Authentication error:', error)
    return {
      user: null,
      response: NextResponse.json(
        { error: 'Authentication failed', code: 'AUTH_ERROR' },
        { status: 401 }
      ),
    }
  }
}

/**
 * Require authentication for the endpoint
 */
export async function requireAuth(
  request: NextRequest
): Promise<{ user: SessionUser; response?: NextResponse }> {
  const { user, response } = await authenticate(request)
  
  if (!user) {
    return {
      user: null as any, // Will be caught by response check
      response: response || NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      ),
    }
  }

  return { user, response: undefined }
}

/**
 * Require admin authentication for the endpoint
 */
export async function requireAdmin(
  request: NextRequest
): Promise<{ user: SessionUser; response?: NextResponse }> {
  const { user, response } = await requireAuth(request)
  
  if (response) {
    return { user: null as any, response }
  }

  if (!user.admin) {
    return {
      user: null as any,
      response: NextResponse.json(
        { error: 'Admin access required', code: 'ADMIN_REQUIRED' },
        { status: 403 }
      ),
    }
  }

  return { user, response: undefined }
}

/**
 * Check if user has premium access
 */
export function isPremiumUser(user: SessionUser): boolean {
  return user.tier === 'premium.monthly' || user.tier === 'premium.yearly'
}

/**
 * Require premium subscription for the endpoint
 */
export async function requirePremium(
  request: NextRequest
): Promise<{ user: SessionUser; response?: NextResponse }> {
  const { user, response } = await requireAuth(request)
  
  if (response) {
    return { user: null as any, response }
  }

  if (!isPremiumUser(user)) {
    return {
      user: null as any,
      response: NextResponse.json(
        { 
          error: 'Premium subscription required', 
          code: 'PREMIUM_REQUIRED',
          upgradeUrl: '/pricing'
        },
        { status: 403 }
      ),
    }
  }

  return { user, response: undefined }
}