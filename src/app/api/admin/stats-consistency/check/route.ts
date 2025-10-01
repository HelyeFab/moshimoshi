/**
 * Admin API: Check Stats Consistency
 *
 * Compares user_stats (source of truth) with leaderboard_stats (materialized view)
 * and reports any inconsistencies.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { leaderboardMaterializer } from '@/lib/leaderboard/LeaderboardMaterializer'
import logger from '@/lib/logger'

export async function GET(request: NextRequest) {
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

    // Get query params
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '1000')

    logger.info(`[Admin] Checking stats consistency (limit: ${limit})`)

    // Run consistency check
    const inconsistencies = await leaderboardMaterializer.checkConsistency({ limit })

    // Calculate summary
    const summary = {
      totalUsers: limit,
      inconsistentUsers: inconsistencies.length,
      highSeverity: inconsistencies.filter(i => i.severity === 'high').length,
      mediumSeverity: inconsistencies.filter(i => i.severity === 'medium').length,
      lowSeverity: inconsistencies.filter(i => i.severity === 'low').length,
      lastFullScan: new Date().toISOString()
    }

    return NextResponse.json({
      success: true,
      inconsistencies,
      summary
    })

  } catch (error) {
    logger.error('[Admin] Stats consistency check failed:', error)
    return NextResponse.json(
      { error: 'Failed to check consistency' },
      { status: 500 }
    )
  }
}
