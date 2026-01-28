import 'server-only'
import { adminFirestore } from '@/lib/firebase/admin'

/**
 * Track user activity by updating lastActive timestamp
 *
 * This function updates the lastActive field in the user document,
 * which is used by the admin dashboard to calculate "Active Today" metrics.
 *
 * @param userId - The user ID to track activity for
 *
 * Usage:
 * - Call this in API routes where users perform meaningful actions
 * - Make it non-blocking (don't await) to avoid impacting response time
 * - Example: trackUserActivity(session.uid).catch(console.error)
 *
 * @example
 * ```typescript
 * import { trackUserActivity } from '@/lib/admin/trackActivity'
 *
 * export async function GET(request: NextRequest) {
 *   const session = await getSession()
 *   if (session?.uid) {
 *     // Track activity (non-blocking)
 *     trackUserActivity(session.uid).catch(console.error)
 *   }
 *   // Rest of your code...
 * }
 * ```
 */
export async function trackUserActivity(userId: string): Promise<void> {
  if (!userId || !adminFirestore) return

  try {
    await adminFirestore
      .collection('users')
      .doc(userId)
      .update({
        lastActive: new Date()
      })
  } catch (error) {
    // Log but don't fail the request
    console.error('[Activity Tracking] Failed to update lastActive:', error)
  }
}
