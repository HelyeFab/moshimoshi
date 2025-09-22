// Next-auth compatibility layer for Firebase Admin SDK
// This provides a next-auth compatible interface while using Firebase Admin SDK underneath

import { NextRequest } from 'next/server'
import { getSession, SessionUser } from '@/lib/auth/session'
import { cookies } from 'next/headers'

// Next-auth compatible session interface
export interface NextAuthSession {
  user?: {
    id: string
    email: string
    tier: string
    admin?: boolean
  }
  expires?: string
}

// Next-auth compatible auth options (empty but required for compatibility)
export const authOptions = {
  // This is a placeholder for next-auth compatibility
  // Actual authentication is handled by Firebase Admin SDK
  providers: [],
  callbacks: {},
  pages: {},
}

/**
 * Get server session - next-auth compatible function
 * This function mimics next-auth's getServerSession but uses Firebase Admin SDK
 */
export async function getServerSession(
  options?: typeof authOptions
): Promise<NextAuthSession | null> {
  try {
    // Get session using our Firebase session system
    const session = await getSession()
    
    if (!session) {
      return null
    }

    // Return in next-auth compatible format
    return {
      user: {
        id: session.uid,
        email: session.email,
        tier: session.tier,
        admin: session.admin,
      },
      expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
    }
  } catch (error) {
    console.error('Error getting server session:', error)
    return null
  }
}

/**
 * Validate session from request object (for middleware use)
 */
export async function validateSessionFromRequest(
  request: NextRequest
): Promise<{ valid: boolean; user?: SessionUser; reason?: string }> {
  try {
    const sessionCookie = request.cookies.get('session')
    
    if (!sessionCookie?.value) {
      return { valid: false, reason: 'no_session' }
    }

    // Import validateSession from session module
    const { validateSession } = await import('@/lib/auth/session')
    const validation = await validateSession(request)
    
    if (!validation.valid || !validation.payload) {
      return { valid: false, reason: validation.reason || 'invalid_session' }
    }

    // Convert SessionPayload to SessionUser
    const user: SessionUser = {
      uid: validation.payload.uid,
      email: validation.payload.email,
      tier: validation.payload.tier,
      admin: validation.payload.admin,
      sessionId: validation.payload.sid,
    }

    return { valid: true, user }
  } catch (error) {
    console.error('Error validating session from request:', error)
    return { valid: false, reason: 'validation_error' }
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession()
  return session !== null
}

/**
 * Check if user is admin
 */
export async function isAdmin(): Promise<boolean> {
  const session = await getSession()
  return session?.admin === true
}

/**
 * Get current user or throw error
 */
export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession()
  
  if (!session) {
    throw new Error('Authentication required')
  }
  
  return session
}

/**
 * Get current admin user or throw error
 */
export async function requireAdmin(): Promise<SessionUser> {
  const session = await requireAuth()
  
  if (!session.admin) {
    throw new Error('Admin access required')
  }
  
  return session
}

// Export Firebase Admin SDK utilities for direct use
export { verifyIdToken, setAdminClaim } from '@/lib/firebase/admin'
export { createSession, clearSession } from '@/lib/auth/session'
export type { SessionUser } from '@/lib/auth/session'