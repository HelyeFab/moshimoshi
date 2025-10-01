/**
 * Admin API: Rebuild Leaderboard
 *
 * Completely rebuilds the leaderboard_stats collection from user_stats.
 * DANGEROUS OPERATION - Use with caution!
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
    const { dryRun = false, confirmed = false } = body

    if (!dryRun && !confirmed) {
      return NextResponse.json(
        { error: 'Must set confirmed=true to run full rebuild' },
        { status: 400 }
      )
    }

    logger.warn(`[Admin] Leaderboard rebuild initiated by ${session.uid} (dryRun: ${dryRun})`)

    // Run rebuild
    const result = await leaderboardMaterializer.rebuildLeaderboard({ dryRun })

    if (dryRun) {
      return NextResponse.json({
        success: true,
        message: 'Dry run completed',
        result: {
          totalUsers: result.totalUsers,
          message: 'No changes made (dry run)'
        }
      })
    }

    logger.info('[Admin] Leaderboard rebuild completed:', result)

    return NextResponse.json({
      success: true,
      message: 'Leaderboard rebuilt successfully',
      result
    })

  } catch (error) {
    logger.error('[Admin] Leaderboard rebuild failed:', error)
    return NextResponse.json(
      { error: 'Failed to rebuild leaderboard' },
      { status: 500 }
    )
  }
}
