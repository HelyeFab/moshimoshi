// Session management utilities
// Handles secure JWT-based sessions with Redis caching for authentication

import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { 
  createSessionToken, 
  verifySessionToken, 
  generateFingerprint,
  isTokenNearExpiration,
  SessionPayload,
  SessionValidation,
  decodeSessionToken,
} from './jwt'
import { redis } from '@/lib/redis/client'

const SESSION_COOKIE_NAME = 'session'
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const, // Changed from 'strict' to allow Stripe redirects
  path: '/',
}

export interface SessionUser {
  uid: string
  email: string
  tier: 'guest' | 'free' | 'premium.monthly' | 'premium.yearly'
  admin?: boolean
  sessionId: string
  emailVerified?: boolean
}

export interface CreateSessionOptions {
  duration?: number
  rememberMe?: boolean
  userAgent?: string
  ipAddress?: string
}

/**
 * Create a secure JWT session
 */
export async function createSession(
  userData: {
    uid: string
    email: string
    tier: 'guest' | 'free' | 'premium.monthly' | 'premium.yearly'
    admin?: boolean
  },
  options: CreateSessionOptions = {}
): Promise<SessionUser> {
  try {
    const {
      duration = options.rememberMe ? 7 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000, // 7 days or 1 hour
      userAgent,
      ipAddress,
    } = options

    // Generate session token
    const fingerprint = generateFingerprint(userAgent, ipAddress)
    const sessionToken = createSessionToken(
      {
        uid: userData.uid,
        email: userData.email,
        tier: userData.tier,
        fingerprint,
        admin: userData.admin,
      },
      duration
    )

    // Decode to get session ID for caching
    const decoded = decodeSessionToken(sessionToken)
    if (!decoded) {
      throw new Error('Failed to decode session token')
    }

    // Cache session in Redis for fast validation
    const sessionCacheKey = `session:${decoded.sid}`
    await redis.setex(sessionCacheKey, Math.floor(duration / 1000), JSON.stringify({
      uid: userData.uid,
      tier: userData.tier,
      valid: true,
      fingerprint,
    }))

    // Set HTTP-only cookie
    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: Math.floor(duration / 1000), // Convert to seconds
    })

    const sessionUser: SessionUser = {
      uid: userData.uid,
      email: userData.email,
      tier: userData.tier,
      admin: userData.admin,
      sessionId: decoded.sid,
    }

    // Log session creation
    console.log(`Session created for user ${userData.uid} (${decoded.sid})`)
    
    return sessionUser
  } catch (error) {
    console.error('Error creating session:', error)
    throw new Error('Failed to create session')
  }
}

/**
 * Get the current session
 */
export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
    console.log('[getSession] Cookie found:', sessionCookie ? 'yes' : 'no')
    
    if (!sessionCookie?.value) {
      console.log('[getSession] No session cookie value')
      return null
    }

    // First check Redis cache for fast validation
    const decoded = decodeSessionToken(sessionCookie.value)
    console.log('[getSession] Token decoded:', decoded ? 'yes' : 'no')
    if (!decoded) {
      console.log('[getSession] Failed to decode token')
      return null
    }

    const sessionCacheKey = `session:${decoded.sid}`
    const cached = await redis.get(sessionCacheKey)
    console.log('[getSession] Redis cache check:', cached ? 'found' : 'not found')
    
    if (!cached) {
      // Session not in cache, invalid or expired
      console.log('[getSession] Session not in cache')
      return null
    }

    // Handle both string and object responses from Redis
    const cacheData = typeof cached === 'string' ? JSON.parse(cached) : cached
    if (!cacheData.valid) {
      return null
    }

    // Verify JWT token
    const validation = verifySessionToken(sessionCookie.value)
    if (!validation.valid || !validation.payload) {
      // Clear invalid session from cache
      await redis.del(sessionCacheKey)
      return null
    }

    return {
      uid: validation.payload.uid,
      email: validation.payload.email,
      tier: validation.payload.tier,
      admin: validation.payload.admin,
      sessionId: validation.payload.sid,
    }
  } catch (error) {
    console.error('Error getting session:', error)
    return null
  }
}

/**
 * Clear the session (sign out)
 */
export async function clearSession(): Promise<void> {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
    
    if (sessionCookie?.value) {
      // Get session ID to blacklist and clear cache
      const decoded = decodeSessionToken(sessionCookie.value)
      if (decoded) {
        // Blacklist the session (store in Redis with remaining TTL)
        const blacklistKey = `blacklist:${decoded.sid}`
        const remainingTTL = Math.max(0, decoded.exp - Math.floor(Date.now() / 1000))
        await redis.setex(blacklistKey, remainingTTL, '1')
        
        // Clear session cache
        await redis.del(`session:${decoded.sid}`)
      }
    }
    
    // Clear cookie
    cookieStore.delete(SESSION_COOKIE_NAME)
  } catch (error) {
    console.error('Error clearing session:', error)
  }
}

/**
 * Mark sessions for tier refresh without invalidating them
 * This signals the client to refresh their JWT token with the new tier
 */
export async function markSessionsForTierRefresh(userId: string): Promise<void> {
  try {
    // Get all session IDs for this user from their sessions
    const userSessions = await redis.keys(`session:*`)

    for (const sessionKey of userSessions) {
      const sessionData = await redis.get(sessionKey)
      if (sessionData && typeof sessionData === 'object') {
        const data = typeof sessionData === 'string' ? JSON.parse(sessionData) : sessionData

        if (data.uid === userId) {
          // Mark this session as needing refresh
          const updatedSession = {
            ...data,
            needsTierRefresh: true
          }

          // Get the TTL to preserve expiration
          const ttl = await redis.ttl(sessionKey)

          // Update the session with the refresh flag
          if (ttl > 0) {
            await redis.set(sessionKey, JSON.stringify(updatedSession), { ex: ttl })
          }
        }
      }
    }

    console.log(`[Session] Marked sessions for tier refresh for user ${userId}`)
  } catch (error) {
    console.error('[Session] Error marking sessions for refresh:', error)
  }
}

/**
 * Middleware helper to validate session for Next.js middleware
 */
export async function validateSession(request: NextRequest): Promise<SessionValidation> {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)
  
  if (!sessionCookie?.value) {
    return { valid: false, reason: 'no_session' }
  }

  try {
    // Check if session is blacklisted first
    const decoded = decodeSessionToken(sessionCookie.value)
    if (decoded) {
      const blacklisted = await redis.get(`blacklist:${decoded.sid}`)
      if (blacklisted) {
        return { valid: false, reason: 'blacklisted' }
      }
    }

    // Verify JWT token
    const validation = verifySessionToken(sessionCookie.value)
    return validation
  } catch (error) {
    console.error('Session validation error:', error)
    return { valid: false, reason: 'validation_error' }
  }
}

/**
 * Refresh session if near expiration
 */
export async function refreshSessionIfNeeded(
  token: string, 
  userData: { uid: string; email: string; tier: string; admin?: boolean }
): Promise<string | null> {
  try {
    if (!isTokenNearExpiration(token)) {
      return null // No refresh needed
    }

    // Create new session token
    const decoded = decodeSessionToken(token)
    if (!decoded) return null

    const newToken = createSessionToken(
      {
        uid: userData.uid,
        email: userData.email,
        tier: userData.tier as any,
        fingerprint: decoded.fingerprint,
        admin: userData.admin,
      },
      60 * 60 * 1000 // 1 hour
    )

    // Update cache
    const newDecoded = decodeSessionToken(newToken)
    if (newDecoded) {
      const sessionCacheKey = `session:${newDecoded.sid}`
      await redis.setex(sessionCacheKey, 3600, JSON.stringify({
        uid: userData.uid,
        tier: userData.tier,
        valid: true,
        fingerprint: decoded.fingerprint,
      }))
    }

    return newToken
  } catch (error) {
    console.error('Error refreshing session:', error)
    return null
  }
}

/**
 * Invalidate all sessions for a user (e.g., on password change or subscription update)
 */
export async function invalidateAllUserSessions(userId: string): Promise<void> {
  try {
    console.log(`[Session] Invalidating all sessions for user ${userId}`)

    // Get all keys matching the pattern for this user's sessions
    const keys = await redis.keys(`session:*`)

    // Check each session and delete if it belongs to this user
    for (const key of keys) {
      const sessionData = await redis.get(key)
      if (sessionData) {
        try {
          const parsed = JSON.parse(sessionData)
          if (parsed.uid === userId) {
            await redis.del(key)
            console.log(`[Session] Deleted session ${key} for user ${userId}`)
          }
        } catch (e) {
          // Skip invalid session data
        }
      }
    }

    console.log(`[Session] Completed invalidation for user ${userId}`)
  } catch (error) {
    console.error('Error invalidating user sessions:', error)
  }
}

/**
 * Check if user is admin
 */
export async function isAdmin(): Promise<boolean> {
  const session = await getSession()
  return session?.admin === true
}

/**
 * Require authentication for API routes
 */
export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession()
  
  if (!session) {
    throw new Error('Authentication required')
  }
  
  return session
}

/**
 * Require admin for API routes
 */
export async function requireAdmin(): Promise<SessionUser> {
  const session = await requireAuth()
  
  if (!session.admin) {
    throw new Error('Admin access required')
  }
  
  return session
}

/**
 * Create session cookie response helper
 */
export function setSessionCookie(response: NextResponse, token: string, maxAge: number): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge,
  })
}

/**
 * Clear session cookie response helper
 */
export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
  })
}