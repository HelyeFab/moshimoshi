/**
 * Storage Guard Middleware
 * Automatically enforces dual storage patterns for all API routes
 * Ensures free users never write to Firebase
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getStorageDecision } from '@/lib/api/storage-helper'
import { firebaseTracker } from '@/lib/monitoring/firebase-tracker'

export interface StorageGuardContext {
  storageDecision: Awaited<ReturnType<typeof getStorageDecision>>
  session: Awaited<ReturnType<typeof getSession>>
}

/**
 * Storage guard middleware wrapper
 * Automatically checks premium status and injects storage decision
 *
 * Usage:
 * ```typescript
 * export const POST = storageGuard(async (request, context) => {
 *   const { storageDecision, session } = context
 *
 *   if (storageDecision.shouldWriteToFirebase) {
 *     // Write to Firebase
 *   }
 *
 *   return createStorageResponse(data, storageDecision)
 * })
 * ```
 */
export function storageGuard<T extends any[]>(
  handler: (request: NextRequest, context: StorageGuardContext, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    try {
      // Get session
      const session = await getSession()

      if (!session) {
        return NextResponse.json(
          { error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
          { status: 401 }
        )
      }

      // Get storage decision with fresh user data
      const storageDecision = await getStorageDecision(session)

      // Track operation
      const pathname = request.nextUrl.pathname
      const collection = extractCollectionFromPath(pathname)

      await firebaseTracker.trackOperation(
        session.uid,
        request.method.toLowerCase() as any,
        collection,
        storageDecision.isPremium,
        pathname
      )

      // Log storage decision
      if (process.env.NODE_ENV === 'development') {
        console.log(`[StorageGuard] ${request.method} ${pathname}`, {
          userId: session.uid,
          isPremium: storageDecision.isPremium,
          storageLocation: storageDecision.storageLocation,
          plan: storageDecision.plan
        })
      }

      // Inject storage decision into context
      const context: StorageGuardContext = {
        storageDecision,
        session
      }

      // Call the handler with injected context
      return await handler(request, context, ...args)

    } catch (error: any) {
      console.error('[StorageGuard] Error:', error)

      if (error.message === 'Unauthorized') {
        return NextResponse.json(
          { error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
          { status: 401 }
        )
      }

      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Storage guard error' } },
        { status: 500 }
      )
    }
  }
}

/**
 * Extract collection name from API path
 */
function extractCollectionFromPath(pathname: string): string {
  // Extract collection from path like /api/todos -> todos
  const parts = pathname.split('/')
  const apiIndex = parts.indexOf('api')

  if (apiIndex >= 0 && apiIndex < parts.length - 1) {
    return parts[apiIndex + 1] || 'unknown'
  }

  return 'unknown'
}

/**
 * Helper to create a protected Firebase operation
 * Only executes if user is premium
 */
export async function protectedFirebaseWrite<T>(
  context: StorageGuardContext,
  operation: () => Promise<T>
): Promise<T | null> {
  if (!context.storageDecision.shouldWriteToFirebase) {
    console.log(`[StorageGuard] Skipping Firebase write for free user ${context.session.uid}`)
    return null
  }

  console.log(`[StorageGuard] Executing Firebase write for premium user ${context.session.uid}`)
  return await operation()
}

/**
 * Batch operations helper with storage protection
 */
export async function protectedBatchOperation(
  context: StorageGuardContext,
  operations: Array<() => Promise<any>>
): Promise<any[]> {
  if (!context.storageDecision.shouldWriteToFirebase) {
    console.log(`[StorageGuard] Skipping batch operations for free user ${context.session.uid}`)
    return operations.map(() => null)
  }

  console.log(`[StorageGuard] Executing ${operations.length} batch operations for premium user ${context.session.uid}`)
  return await Promise.all(operations.map(op => op()))
}