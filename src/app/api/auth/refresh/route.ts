// Session refresh endpoint
// Refreshes JWT session tokens to extend user sessions

import { NextRequest, NextResponse } from 'next/server'
import { getSession, refreshSessionIfNeeded } from '@/lib/auth/session'
import { adminFirestore } from '@/lib/firebase/admin'
import { getSecurityHeaders } from '@/lib/auth/validation'
import { checkApiRateLimit, getRateLimitHeaders } from '@/lib/auth/rateLimit'
import { logAuditEvent, AuditEvent } from '@/lib/auth/audit'
import { verifySessionToken, isTokenNearExpiration } from '@/lib/auth/jwt'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    // Check rate limiting
    const rateLimitResult = await checkApiRateLimit(request)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMITED',
            message: rateLimitResult.message || 'Too many requests',
          },
        },
        { 
          status: 429,
          headers: {
            ...getSecurityHeaders(),
            ...getRateLimitHeaders(rateLimitResult),
          },
        }
      )
    }

    // Get current session
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json(
        {
          error: {
            code: 'SESSION_EXPIRED',
            message: 'Session has expired. Please sign in again.',
          },
        },
        { 
          status: 401,
          headers: {
            ...getSecurityHeaders(),
            ...getRateLimitHeaders(rateLimitResult),
          },
        }
      )
    }

    // Get client information for audit logging
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                     request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Get current session token
    let currentToken: string | null = null
    let needsRefresh = false
    
    try {
      const cookieStore = await cookies()
      const sessionCookie = cookieStore.get('session')
      
      if (!sessionCookie?.value) {
        throw new Error('No session cookie found')
      }
      
      currentToken = sessionCookie.value
      
      // Check if token is near expiration
      needsRefresh = isTokenNearExpiration(currentToken, 30 * 60 * 1000) // 30 minutes threshold
      
      if (!needsRefresh) {
        // Token doesn't need refresh yet, return current expiration time
        const validation = verifySessionToken(currentToken)
        
        return NextResponse.json(
          {
            success: true,
            message: 'Session is still valid',
            expiresIn: validation.expiresIn || 0,
            refreshed: false,
          },
          { 
            status: 200,
            headers: {
              ...getSecurityHeaders(),
              ...getRateLimitHeaders(rateLimitResult),
            },
          }
        )
      }
    } catch (error) {
      console.error('Error checking session token:', error)
      
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_SESSION',
            message: 'Invalid session token',
          },
        },
        { 
          status: 401,
          headers: {
            ...getSecurityHeaders(),
            ...getRateLimitHeaders(rateLimitResult),
          },
        }
      )
    }

    try {
      // Get fresh user data from Firestore to ensure current tier and status
      const userDoc = await adminFirestore!.collection('users').doc(session.uid).get()
      const userData = userDoc.data()

      if (!userData) {
        throw new Error('User profile not found')
      }

      // Check if user account is still active
      if (userData.userState === 'suspended' || userData.userState === 'deleted') {
        await logAuditEvent(
          AuditEvent.SESSION_REFRESH,
          {
            userId: session.uid,
            sessionId: session.sessionId,
            ipAddress,
            userAgent,
            endpoint: '/api/auth/refresh',
          },
          {
            reason: 'account_inactive',
            userState: userData.userState,
          },
          'failure'
        )

        return NextResponse.json(
          {
            error: {
              code: 'ACCOUNT_INACTIVE',
              message: 'Account is no longer active. Please sign in again.',
            },
          },
          { 
            status: 403,
            headers: {
              ...getSecurityHeaders(),
              ...getRateLimitHeaders(rateLimitResult),
            },
          }
        )
      }

      // Refresh the session if needed
      const newToken = await refreshSessionIfNeeded(
        currentToken,
        {
          uid: session.uid,
          email: session.email,
          tier: userData.tier || 'free',
          admin: session.admin,
        }
      )

      if (!newToken) {
        // This shouldn't happen since we already checked, but handle gracefully
        return NextResponse.json(
          {
            success: true,
            message: 'Session refresh not needed',
            expiresIn: 3600000, // Default 1 hour
            refreshed: false,
          },
          { 
            status: 200,
            headers: {
              ...getSecurityHeaders(),
              ...getRateLimitHeaders(rateLimitResult),
            },
          }
        )
      }

      // Update last activity time
      await adminFirestore!.collection('users').doc(session.uid).update({
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      })

      // Log successful session refresh
      await logAuditEvent(
        AuditEvent.SESSION_REFRESH,
        {
          userId: session.uid,
          sessionId: session.sessionId,
          ipAddress,
          userAgent,
          endpoint: '/api/auth/refresh',
        },
        {
          email: session.email,
          tier: userData.tier || 'free',
        },
        'success'
      )

      // Return success with new expiration time
      const validation = verifySessionToken(newToken)
      
      return NextResponse.json(
        {
          success: true,
          message: 'Session refreshed successfully',
          expiresIn: validation.expiresIn || 3600000, // 1 hour default
          refreshed: true,
        },
        { 
          status: 200,
          headers: {
            ...getSecurityHeaders(),
            ...getRateLimitHeaders(rateLimitResult),
          },
        }
      )

    } catch (refreshError) {
      console.error('Session refresh error:', refreshError)

      // Log failed session refresh
      await logAuditEvent(
        AuditEvent.SESSION_REFRESH,
        {
          userId: session.uid,
          sessionId: session.sessionId,
          ipAddress,
          userAgent,
          endpoint: '/api/auth/refresh',
        },
        {
          error: refreshError instanceof Error ? refreshError.message : 'Unknown error',
        },
        'failure'
      )

      return NextResponse.json(
        {
          error: {
            code: 'REFRESH_FAILED',
            message: 'Failed to refresh session. Please sign in again.',
          },
        },
        { 
          status: 500,
          headers: {
            ...getSecurityHeaders(),
            ...getRateLimitHeaders(rateLimitResult),
          },
        }
      )
    }

  } catch (error) {
    console.error('Refresh endpoint error:', error)
    
    // Log system error
    await logAuditEvent(
      AuditEvent.SYSTEM_ERROR,
      {
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        endpoint: '/api/auth/refresh',
      },
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'failure'
    )

    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
      },
      { 
        status: 500,
        headers: getSecurityHeaders(),
      }
    )
  }
}

// All other methods not allowed
export async function GET() {
  return NextResponse.json(
    { error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } },
    { status: 405, headers: getSecurityHeaders() }
  )
}

export async function PUT() {
  return NextResponse.json(
    { error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } },
    { status: 405, headers: getSecurityHeaders() }
  )
}

export async function DELETE() {
  return NextResponse.json(
    { error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } },
    { status: 405, headers: getSecurityHeaders() }
  )
}

export async function PATCH() {
  return NextResponse.json(
    { error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } },
    { status: 405, headers: getSecurityHeaders() }
  )
}