/**
 * Admin API: Manual Sync to Leaderboard
 *
 * Triggers manual sync from user_stats to leaderboard_stats
 * for a specific user or all users.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { leaderboardMaterializer } from '@/lib/leaderboard/LeaderboardMaterializer'
import logger from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    // Admin auth check
    const session = await getSession()
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin status
    const userDoc = await adminDb.collection('users').doc(session.uid).get()
    const userData = userDoc.data()
    if (!userData?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const { userId, userIds, syncAll } = body

    logger.info('[Admin] Manual sync requested:', { userId, userIds, syncAll })

    if (syncAll) {
      // Sync all users (expensive operation!)
      logger.warn('[Admin] Starting full leaderboard sync - this may take a while')

      const result = await leaderboardMaterializer.rebuildLeaderboard({ dryRun: false })

      return NextResponse.json({
        success: true,
        message: 'Full sync completed',
        result
      })
    } else if (userIds && Array.isArray(userIds)) {
      // Batch sync specific users
      logger.info(`[Admin] Batch syncing ${userIds.length} users`)

      const result = await leaderboardMaterializer.batchSyncUsers(userIds)

      return NextResponse.json({
        success: true,
        message: `Synced ${result.success}/${userIds.length} users`,
        result
      })
    } else if (userId) {
      // Sync single user
      logger.info(`[Admin] Syncing single user: ${userId}`)

      await leaderboardMaterializer.syncUserToLeaderboard(userId, true) // immediate sync

      return NextResponse.json({
        success: true,
        message: `User ${userId} synced successfully`
      })
    } else {
      return NextResponse.json(
        { error: 'Must provide userId, userIds, or syncAll' },
        { status: 400 }
      )
    }

  } catch (error) {
    logger.error('[Admin] Manual sync failed:', error)
    return NextResponse.json(
      { error: 'Failed to sync users' },
      { status: 500 }
    )
  }
}
