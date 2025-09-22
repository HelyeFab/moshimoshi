// Server-side login endpoint
// Handles authentication securely without exposing Firebase Admin SDK to client

import { NextRequest, NextResponse } from 'next/server'
import { createSession } from '@/lib/auth/session'

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json()
    
    if (!idToken) {
      return NextResponse.json(
        { error: 'Missing ID token' },
        { status: 400 }
      )
    }

    // Create session with the ID token
    const sessionUser = await createSession(idToken)
    
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