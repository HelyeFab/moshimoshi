// Server-side login endpoint
// Handles authentication securely without exposing Firebase Admin SDK to client

import { NextRequest, NextResponse } from 'next/server'
import { createSession } from '@/lib/auth/session'
import { adminAuth, ensureAdminInitialized } from '@/lib/firebase/admin'

export async function POST(request: NextRequest) {
  try {
    ensureAdminInitialized()

    const { idToken } = await request.json()
    
    if (!idToken) {
      return NextResponse.json(
        { error: 'Missing ID token' },
        { status: 400 }
      )
    }

    if (!adminAuth) {
      return NextResponse.json(
        { error: 'Authentication service unavailable' },
        { status: 503 }
      )
    }

    const decoded = await adminAuth.verifyIdToken(idToken)
    if (!decoded.uid || !decoded.email) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }

    const sessionUser = await createSession(
      {
        uid: decoded.uid,
        email: decoded.email,
      },
      {
        userAgent: request.headers.get('user-agent') || 'unknown',
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
      }
    )
    
    return NextResponse.json({
      success: true,
      user: {
        uid: sessionUser.uid,
        email: sessionUser.email,
        emailVerified: sessionUser.emailVerified,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 401 }
    )
  }
}
