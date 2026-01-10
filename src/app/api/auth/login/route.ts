// Server-side login endpoint
// Handles authentication securely without exposing Firebase Admin SDK to client

import { NextRequest, NextResponse } from 'next/server'
import {
  adminAuth,
  adminFirestore,
  ensureAdminInitialized,
  ensureUserProfile,
  isAdminUserCached,
  setAdminClaims,
} from '@/lib/firebase/admin'
import { createSession } from '@/lib/auth/session'
import { getSecurityHeaders } from '@/lib/auth/validation'
import { getUserTier } from '@/lib/auth/tier-utils'

export async function POST(request: NextRequest) {
  try {
    ensureAdminInitialized()

    const { idToken } = await request.json()
    
    if (!idToken) {
      return NextResponse.json(
        { error: 'Missing ID token' },
        { status: 400, headers: getSecurityHeaders() }
      )
    }

    if (!adminAuth) {
      return NextResponse.json(
        { error: 'Authentication service unavailable' },
        { status: 503, headers: getSecurityHeaders() }
      )
    }

    const decoded = await adminAuth.verifyIdToken(idToken)
    const uid = decoded.uid
    const email = decoded.email

    if (!uid || !email) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401, headers: getSecurityHeaders() }
      )
    }

    await ensureUserProfile(uid, email)

    const displayName = decoded.name || email.split('@')[0]
    const photoURL = decoded.picture || null
    const emailVerified = decoded.email_verified === true

    if (adminFirestore) {
      await adminFirestore.collection('users').doc(uid).set(
        {
          displayName,
          photoURL,
          emailVerified,
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        },
        { merge: true }
      )
    }

    const isAdmin = await isAdminUserCached(uid)
    if (isAdmin) {
      await setAdminClaims(uid, true)
    }

    if (adminFirestore) {
      const userDoc = await adminFirestore.collection('users').doc(uid).get()
      const userData = userDoc.exists ? userDoc.data() : null
      if (userData) {
        const tier = getUserTier(userData)
        const { tierCache } = await import('@/lib/auth/tier-cache')
        await tierCache.setTier(uid, tier)
      }
    }

    const userAgent = request.headers.get('user-agent') || 'unknown'
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown'

    const sessionUser = await createSession(
      {
        uid,
        email,
        admin: isAdmin,
      },
      {
        userAgent,
        ipAddress,
      }
    )
    
    return NextResponse.json({
      success: true,
      user: {
        uid: sessionUser.uid,
        email: sessionUser.email,
        emailVerified,
      },
    }, { headers: getSecurityHeaders() })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 401, headers: getSecurityHeaders() }
    )
  }
}
