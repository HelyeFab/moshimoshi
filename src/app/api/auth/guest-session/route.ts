// Guest session creation endpoint
// Creates temporary session for unauthenticated users to try the app

import { NextRequest, NextResponse } from 'next/server'
import { createSessionToken, generateFingerprint } from '@/lib/auth/jwt'
import { cookies } from 'next/headers'
import { getSecurityHeaders } from '@/lib/auth/validation'
import { checkApiRateLimit, getRateLimitHeaders } from '@/lib/auth/rateLimit'

const GUEST_SESSION_DURATION = 4 * 60 * 60 * 1000 // 4 hours
const SESSION_COOKIE_NAME = 'session'
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

export async function POST(request: NextRequest) {
  console.log('[API /auth/guest-session] Creating guest session')

  try {
    // Check rate limiting
    const rateLimitResult = await checkApiRateLimit(request)
    if (!rateLimitResult.success) {
      console.log('[API /auth/guest-session] Rate limited')
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

    // Generate guest user ID
    const guestId = `guest_${Date.now()}_${Math.random().toString(36).substring(7)}`

    // Get request info for fingerprinting
    const userAgent = request.headers.get('user-agent') || undefined
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                      request.headers.get('x-real-ip') ||
                      undefined

    // Generate fingerprint for the guest session
    const fingerprint = generateFingerprint(userAgent, ipAddress)

    // Create guest session token
    const sessionToken = createSessionToken(
      {
        uid: guestId,
        email: `${guestId}@guest.local`,
        tier: 'guest',
        fingerprint,
        admin: false,
      },
      GUEST_SESSION_DURATION
    )

    // Set HTTP-only cookie for the session
    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: Math.floor(GUEST_SESSION_DURATION / 1000), // Convert to seconds
    })

    // Store guest session in sessionStorage via client
    const guestUser = {
      uid: guestId,
      email: `${guestId}@guest.local`,
      tier: 'guest',
      displayName: 'Guest User',
      isGuest: true,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + GUEST_SESSION_DURATION).toISOString(),
    }

    console.log('[API /auth/guest-session] Guest session created:', guestId)

    return NextResponse.json(
      {
        success: true,
        user: guestUser,
        expiresIn: GUEST_SESSION_DURATION,
        message: 'Guest session created. Progress will not be saved.',
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
    console.error('Guest session creation error:', error)

    return NextResponse.json(
      {
        error: {
          code: 'GUEST_SESSION_ERROR',
          message: 'Failed to create guest session',
        },
      },
      {
        status: 500,
        headers: getSecurityHeaders(),
      }
    )
  }
}

// Only POST method allowed for creating sessions
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