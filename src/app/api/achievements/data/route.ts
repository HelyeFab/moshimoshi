/**
 * DEPRECATED: Redirects to unified stats API
 *
 * This endpoint is kept for backward compatibility.
 * All new code should use /api/stats/unified instead.
 */

import { NextRequest, NextResponse } from 'next/server'
import logger from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    logger.warn('[DEPRECATED] /api/achievements/data GET called - redirecting to /api/stats/unified')

    // Forward to unified API
    const baseUrl = request.nextUrl.origin
    const response = await fetch(`${baseUrl}/api/stats/unified`, {
      method: 'GET',
      headers: {
        // Forward cookies for authentication
        'Cookie': request.headers.get('cookie') || '',
      }
    })

    if (!response.ok) {
      const error = await response.text()
      logger.error('[DEPRECATED API] Unified API call failed:', error)
      return NextResponse.json(
        { error: 'Failed to fetch stats' },
        { status: response.status }
      )
    }

    const data = await response.json()

    // Transform response to old format for backward compatibility
    const legacyResponse = {
      unlocked: data.stats?.achievements?.unlockedIds || [],
      totalPoints: data.stats?.achievements?.totalPoints || 0,
      totalXp: data.stats?.xp?.total || 0,
      currentLevel: data.stats?.xp?.level || 1,
      lessonsCompleted: data.stats?.sessions?.totalSessions || 0,
      statistics: data.stats?.achievements?.statistics || {},
      lastUpdated: data.stats?.metadata?.lastUpdated,
      storage: data.storage
    }

    return NextResponse.json(legacyResponse)

  } catch (error) {
    logger.error('[DEPRECATED API] Error in achievements data:', error)
    return NextResponse.json(
      { error: 'Failed to load achievements' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    logger.warn('[DEPRECATED] /api/achievements/data POST called - redirecting to /api/stats/unified')

    // Parse the request body
    const body = await request.json()
    const { unlocked, totalPoints, totalXp, currentLevel, lessonsCompleted, statistics } = body

    // Transform to unified API format
    const unifiedBody = {
      type: 'achievement',
      data: {
        unlockedIds: unlocked || [],
        totalPoints: totalPoints || 0,
        statistics: statistics || {},
        // Include XP and level updates
        xp: {
          total: totalXp || 0,
          level: currentLevel || 1
        },
        sessionsCompleted: lessonsCompleted || 0
      }
    }

    // Forward to unified API
    const baseUrl = request.nextUrl.origin
    const response = await fetch(`${baseUrl}/api/stats/unified`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward cookies for authentication
        'Cookie': request.headers.get('cookie') || '',
      },
      body: JSON.stringify(unifiedBody)
    })

    if (!response.ok) {
      const error = await response.text()
      logger.error('[DEPRECATED API] Unified API call failed:', error)
      return NextResponse.json(
        { error: 'Failed to update stats' },
        { status: response.status }
      )
    }

    const data = await response.json()

    // Return success with storage info
    return NextResponse.json({
      message: 'Achievements saved successfully',
      success: true,
      storage: data.storage
    })

  } catch (error) {
    logger.error('[DEPRECATED API] Error in achievements data:', error)
    return NextResponse.json(
      { error: 'Failed to save achievements' },
      { status: 500 }
    )
  }
}