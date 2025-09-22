// Session validation endpoint
// Returns current user session status and information

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminFirestore } from '@/lib/firebase/admin'
import { getSecurityHeaders } from '@/lib/auth/validation'
import { checkSessionRateLimit, getRateLimitHeaders } from '@/lib/auth/rateLimit'
import { verifySessionToken } from '@/lib/auth/jwt'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  console.log('[API /auth/session] Checking session')
  
  try {
    // Check rate limiting - use more lenient session check limits
    const rateLimitResult = await checkSessionRateLimit(request)
    if (!rateLimitResult.success) {
      console.log('[API /auth/session] Rate limited')
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

    const session = await getSession()
    console.log('[API /auth/session] Session result:', session ? 'found' : 'not found', session)

    if (!session) {
      // Check if there's a guest session cookie
      const cookieStore = await cookies()
      const sessionCookie = cookieStore.get('session')

      if (sessionCookie?.value) {
        try {
          const validation = verifySessionToken(sessionCookie.value)

          // Check if this is a guest session
          if (validation.valid && validation.payload?.tier === 'guest') {
            console.log('[API /auth/session] Guest session found')
            return NextResponse.json(
              {
                authenticated: true,
                user: {
                  uid: validation.payload.uid,
                  email: validation.payload.email,
                  tier: 'guest',
                  displayName: 'Guest User',
                  photoURL: null,
                  emailVerified: false,
                  isAdmin: false,
                  isGuest: true,
                  admin: false,
                },
                expiresIn: validation.expiresIn || 0,
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
        } catch (err) {
          console.log('[API /auth/session] Invalid session token:', err)
        }
      }

      // No valid session found
      return NextResponse.json(
        {
          authenticated: false,
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

    // Get additional user information from Firestore
    let userProfile = null
    try {
      const userDoc = await adminFirestore!.collection('users').doc(session.uid).get()
      userProfile = userDoc.data()
      console.log('[API /auth/session] User profile fetched, isAdmin:', userProfile?.isAdmin)
    } catch (error) {
      console.error('Error fetching user profile:', error)
      // Continue without profile data
    }

    // Calculate session expiration time
    let expiresIn = 0
    try {
      const cookieStore = await cookies()
      const sessionCookie = cookieStore.get('session')
      if (sessionCookie?.value) {
        const validation = verifySessionToken(sessionCookie.value)
        expiresIn = validation.expiresIn || 0
      }
    } catch (error) {
      console.error('Error calculating session expiration:', error)
    }
    
    return NextResponse.json(
      {
        authenticated: true,
        user: {
          uid: session.uid,
          email: session.email,
          tier: session.tier,
          displayName: userProfile?.displayName || null,
          photoURL: userProfile?.photoURL || null,
          emailVerified: userProfile?.emailVerified || false,
          isAdmin: userProfile?.isAdmin === true, // Use isAdmin field from Firebase
          admin: session.admin || false, // Keep for backward compatibility
        },
        expiresIn,
      },
      { 
        status: 200,
        headers: {
          ...getSecurityHeaders(),
          ...getRateLimitHeaders(rateLimitResult),
        },
      }
    )

  } catch (error) {
    console.error('Session validation error:', error)
    
    return NextResponse.json(
      {
        authenticated: false,
        error: {
          code: 'SESSION_ERROR',
          message: 'Failed to validate session',
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
export async function POST() {
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