// Google OAuth authentication endpoint
// Verifies Google ID tokens and creates sessions

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminFirestore, ensureAdminInitialized, ensureUserProfile, setAdminClaims, isAdminUser } from '@/lib/firebase/admin'
import { createSession } from '@/lib/auth/session'
import { getSecurityHeaders } from '@/lib/auth/validation'
import { logAuditEvent, AuditEvent } from '@/lib/auth/audit'

export async function POST(request: NextRequest) {
  console.log('[API /auth/google] Request received')
  
  try {
    // Ensure Firebase Admin is initialized
    console.log('[API /auth/google] Initializing Firebase Admin')
    try {
      ensureAdminInitialized()
    } catch (initError: any) {
      console.error('[API /auth/google] Firebase Admin initialization failed:', initError)
      return NextResponse.json(
        {
          error: {
            code: 'FIREBASE_INIT_FAILED',
            message: 'Firebase Admin initialization failed: ' + initError.message,
          },
        },
        {
          status: 500,
          headers: getSecurityHeaders(),
        }
      )
    }
    
    // Parse request body
    const body = await request.json()
    const { idToken } = body
    
    if (!idToken) {
      return NextResponse.json(
        {
          error: {
            code: 'MISSING_TOKEN',
            message: 'ID token is required',
          },
        },
        { 
          status: 400,
          headers: getSecurityHeaders(),
        }
      )
    }
    
    console.log('[API /auth/google] Verifying ID token')

    // Verify the ID token
    let decodedToken
    try {
      if (!adminAuth) {
        throw new Error('Firebase Admin Auth is not initialized')
      }
      decodedToken = await adminAuth.verifyIdToken(idToken)
    } catch (verifyError: any) {
      console.error('[API /auth/google] Token verification failed:', verifyError)
      return NextResponse.json(
        {
          error: {
            code: 'TOKEN_VERIFICATION_FAILED',
            message: 'Failed to verify ID token: ' + verifyError.message,
          },
        },
        {
          status: 401,
          headers: getSecurityHeaders(),
        }
      )
    }
    const uid = decodedToken.uid
    const email = decodedToken.email
    const displayName = decodedToken.name || email?.split('@')[0]
    const photoURL = decodedToken.picture
    
    console.log('[API /auth/google] Token verified for:', email)
    
    // Check if user exists in Firestore
    const userDoc = await adminFirestore!
      .collection('users')
      .doc(uid)
      .get()
    
    let isNewUser = false
    
    if (!userDoc.exists) {
      // Create new user profile
      console.log('[API /auth/google] Creating new user profile')
      isNewUser = true
      
      // Use ensureUserProfile for complete default schema
      await ensureUserProfile(uid, email)

      // Add authentication-specific fields using merge
      await adminFirestore!
        .collection('users')
        .doc(uid)
        .set({
          displayName,
          photoURL: photoURL || null,
          emailVerified: true, // Both Google and magic link verify email
          authProvider: photoURL ? 'google' : 'magic-link',
          updatedAt: adminFirestore!.FieldValue.serverTimestamp(),
        }, { merge: true })
    } else {
      // Update last login
      console.log('[API /auth/google] Updating existing user')
      // Update last login and email verification status
      // Magic link sign-in proves email ownership
      const updateData: any = {
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      }

      // If this is a magic link sign-in (no picture in token), set emailVerified to true
      if (!decodedToken.picture) {
        updateData.emailVerified = true
      }

      await adminFirestore!
        .collection('users')
        .doc(uid)
        .update(updateData)
    }
    
    // Get user data for session
    const userData = isNewUser ? 
      { uid, email, displayName, tier: 'free', emailVerified: true } :
      userDoc.data() || { uid, email, displayName, tier: 'free', emailVerified: true }
    
    // Check if user is admin using Firebase isAdmin field
    const isAdmin = await isAdminUser(uid)
    console.log('[API /auth/google] Admin check for user:', isAdmin ? 'Admin verified' : 'Regular user')
    
    // Set Firebase custom claims for admin users
    if (isAdmin) {
      const claimsSet = await setAdminClaims(uid, true)
      console.log('[API /auth/google] Admin claims set:', claimsSet)
    }
    
    // Create session token
    let sessionToken
    try {
      const { createSessionToken, decodeSessionToken, generateFingerprint } = await import('@/lib/auth/jwt')
      
      // Generate fingerprint from request headers
      const userAgent = request.headers.get('user-agent') || 'unknown'
      const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                       request.headers.get('x-real-ip') || 'unknown'
      const fingerprint = generateFingerprint(userAgent, ipAddress)
      
      sessionToken = await createSessionToken({
        uid,
        email: userData.email || email,
        tier: userData.tier || 'free',
        fingerprint,
        admin: isAdmin,
      }, 7 * 24 * 60 * 60 * 1000) // 7 days for Google auth
      
      // Store session in Redis cache for validation
      const decoded = decodeSessionToken(sessionToken)
      if (decoded) {
        try {
          const { redis } = await import('@/lib/redis/client')
          const sessionCacheKey = `session:${decoded.sid}`
          await redis.setex(sessionCacheKey, 60 * 60 * 24 * 7, JSON.stringify({
            uid,
            tier: userData.tier || 'free',
            valid: true,
            fingerprint: decoded.fingerprint,
          }))
          console.log('[API /auth/google] Session cached in Redis')
        } catch (redisError) {
          console.error('[API /auth/google] Redis error (continuing anyway):', redisError)
          // Continue even if Redis fails - the JWT is still valid
        }
      }
    } catch (sessionError) {
      console.error('[API /auth/google] Session creation error:', sessionError)
      throw sessionError
    }
    
    // Set session cookie
    const { serialize } = await import('cookie')
    serialize('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // Changed to allow external redirects
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days for Google auth
    })
    
    // Log successful authentication
    await logAuditEvent(
      isNewUser ? AuditEvent.SIGN_UP : AuditEvent.SIGN_IN,
      {
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        endpoint: '/api/auth/google',
      },
      {
        userId: uid,
        email,
        authProvider: 'google',
        isNewUser,
      },
      'success'
    )
    
    console.log('[API /auth/google] Session created successfully')
    
    const response = NextResponse.json(
      {
        success: true,
        user: {
          uid,
          email,
          displayName,
          photoURL,
          tier: userData.tier || 'free',
          emailVerified: true,
        },
        isNewUser,
      },
      { 
        status: 200,
        headers: getSecurityHeaders(),
      }
    )
    
    // Set the session cookie using NextResponse cookie method
    if (sessionToken) {
      response.cookies.set('session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax', // Changed to allow external redirects
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days for Google auth
      })
    } else {
      console.error('[API /auth/google] No session token to set in cookie')
    }
    
    return response
    
  } catch (error: any) {
    console.error('[API /auth/google] Error:', error?.message || error)
    
    // Log error
    await logAuditEvent(
      AuditEvent.SYSTEM_ERROR,
      {
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        endpoint: '/api/auth/google',
      },
      {
        error: error.message,
        code: error.code,
      },
      'failure'
    )
    
    return NextResponse.json(
      {
        error: {
          code: 'GOOGLE_AUTH_FAILED',
          message: error.message || 'Google authentication failed',
        },
      },
      { 
        status: 500,
        headers: getSecurityHeaders(),
      }
    )
  }
}