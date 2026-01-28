import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, isAdminUserCached } from '@/lib/firebase/admin'

export interface AdminContext {
  user: {
    uid: string
    email: string
    isAdmin: boolean
  }
  params?: Record<string, string>
}

/** Next.js 15 route context type */
type RouteContext = { params: Promise<Record<string, string>> }

/**
 * Middleware to protect admin API routes
 * Uses Firebase Admin SDK to verify tokens and check admin status via Firebase
 */
export function withAdminAuth(
  handler: (request: NextRequest, context: AdminContext) => Promise<NextResponse>
) {
  return async (request: NextRequest, routeContext: RouteContext): Promise<NextResponse> => {
    try {
      // Try cookie-based session first (primary method for browser requests)
      const { getSession } = await import('@/lib/auth/session')
      const session = await getSession()

      if (session) {
        // Verify admin status from Firestore
        const isAdmin = await isAdminUserCached(session.uid)

        if (!isAdmin) {
          console.warn(
            `[Admin Auth] Non-admin user attempted admin access: ${session.uid.substring(0, 8)}...`
          )
          return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
        }

        // Resolve params (Next.js 15 makes params a Promise)
        const resolvedParams = await routeContext.params

        const context: AdminContext = {
          user: {
            uid: session.uid,
            email: session.email,
            isAdmin: true,
          },
          params: resolvedParams,
        }

        return handler(request, context)
      }

      // Fallback to Bearer token authentication (for API clients, external tools)
      const authHeader = request.headers.get('authorization')
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7)

        // Verify the token using Firebase Admin SDK
        let decodedToken
        try {
          if (!adminAuth) {
            throw new Error('Firebase Admin Auth not initialized')
          }
          decodedToken = await adminAuth.verifyIdToken(token)
        } catch (tokenError) {
          console.error('[Admin Auth] Token verification failed:', tokenError)
          return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 })
        }

        // Check if user is admin using Firebase isAdmin field
        const isAdmin = await isAdminUserCached(decodedToken.uid)

        if (!isAdmin) {
          console.warn(
            `[Admin Auth] Non-admin user attempted admin access: ${decodedToken.uid.substring(0, 8)}...`
          )
          return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
        }

        // Resolve params
        const resolvedParams = await routeContext.params

        const context: AdminContext = {
          user: {
            uid: decodedToken.uid,
            email: decodedToken.email || '',
            isAdmin: true,
          },
          params: resolvedParams,
        }

        return handler(request, context)
      }

      // No valid authentication found
      return NextResponse.json(
        { error: 'Unauthorized - No valid session or token found' },
        { status: 401 }
      )
    } catch (error) {
      console.error('[Admin Auth] Unexpected error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
}

/**
 * Check admin authentication for API routes
 * Returns admin context if user is authenticated and authorized, throws error otherwise
 */
export async function checkAdminAuth(request: NextRequest): Promise<AdminContext> {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized - Missing or invalid authorization header')
    }

    const token = authHeader.substring(7)

    // Verify the token using Firebase Admin SDK
    let decodedToken
    try {
      if (!adminAuth) {
        throw new Error('Firebase Admin Auth not initialized')
      }
      decodedToken = await adminAuth.verifyIdToken(token)
    } catch (tokenError) {
      console.error('[Admin Auth] Token verification failed:', tokenError)
      throw new Error('Unauthorized - Invalid token')
    }

    // Check if user is admin using Firebase isAdmin field
    // Uses cached version for performance
    const isAdmin = await isAdminUserCached(decodedToken.uid)

    if (!isAdmin) {
      console.warn(
        `[Admin Auth] Non-admin user attempted admin access: ${decodedToken.uid.substring(0, 8)}...`
      )
      throw new Error('Forbidden - Admin access required')
    }

    return {
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email || '',
        isAdmin: true,
      },
    }
  } catch (error) {
    console.error('[Admin Auth] Authentication error:', error)
    throw error
  }
}

/**
 * Set admin claim on a user
 * This grants admin privileges to a user
 */
export async function setAdminClaim(uid: string, isAdmin: boolean = true): Promise<void> {
  if (!adminAuth) {
    throw new Error('Firebase Admin Auth not initialized')
  }
  try {
    await adminAuth.setCustomUserClaims(uid, { admin: isAdmin })
    console.log(`Admin claim ${isAdmin ? 'set' : 'removed'} for user ${uid}`)
  } catch (error) {
    console.error('Failed to set admin claim:', error)
    throw error
  }
}
