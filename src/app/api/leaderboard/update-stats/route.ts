/**
 * DEPRECATED: Redirects to unified stats API
 *
 * This endpoint is kept for backward compatibility.
 * All new code should use /api/stats/unified instead.
 *
 * The unified API now handles all leaderboard stats updates
 * as part of the single source of truth for user statistics.
 */

import { NextRequest, NextResponse } from 'next/server'
import logger from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    logger.warn('[DEPRECATED] /api/leaderboard/update-stats GET called - redirecting to /api/stats/unified')

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
      exists: !!data.stats,
      stats: data.stats ? {
        userId: data.stats.userId,
        totalXP: data.stats.xp?.total || 0,
        currentStreak: data.stats.streak?.current || 0,
        level: data.stats.xp?.level || 1,
        displayName: data.stats.displayName,
        photoURL: data.stats.photoURL,
        lastActivityDate: data.stats.streak?.lastActivityDate,
        updatedAt: data.stats.metadata?.lastUpdated
      } : null
    }

    return NextResponse.json(legacyResponse)

  } catch (error) {
    logger.error('[DEPRECATED API] Error in leaderboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to get leaderboard stats' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    logger.warn('[DEPRECATED] /api/leaderboard/update-stats POST called - redirecting to /api/stats/unified')

    // Parse the request body
    const body = await request.json()
    const { totalXP, currentStreak, level, displayName, photoURL } = body

    // Build updates for unified API
    const updates: any[] = []

    if (totalXP !== undefined || level !== undefined) {
      updates.push({
        type: 'xp',
        data: {
          total: totalXP,
          level: level
        }
      })
    }

    if (currentStreak !== undefined) {
      updates.push({
        type: 'streak',
        data: {
          current: currentStreak
        }
      })
    }

    if (displayName !== undefined || photoURL !== undefined) {
      updates.push({
        type: 'profile',
        data: {
          displayName,
          photoURL
        }
      })
    }

    // If no updates, return success
    if (updates.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No updates to process'
      })
    }

    // Process each update through unified API
    const baseUrl = request.nextUrl.origin
    let lastResponse: any = null

    for (const update of updates) {
      const response = await fetch(`${baseUrl}/api/stats/unified`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Forward cookies for authentication
          'Cookie': request.headers.get('cookie') || '',
        },
        body: JSON.stringify(update)
      })

      if (!response.ok) {
        const error = await response.text()
        logger.error('[DEPRECATED API] Unified API call failed:', error)
        return NextResponse.json(
          { error: 'Failed to update stats' },
          { status: response.status }
        )
      }

      lastResponse = await response.json()
    }

    // Return success
    return NextResponse.json({
      success: true,
      message: 'Leaderboard stats updated',
      updates: body
    })

  } catch (error) {
    logger.error('[DEPRECATED API] Error in leaderboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to update leaderboard stats' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    logger.warn('[DEPRECATED] /api/leaderboard/update-stats DELETE called')

    // For now, we don't delete from user_stats as it's the main collection
    // Just log the request
    logger.info('[DEPRECATED API] DELETE request received but not processed - user_stats is persistent')

    return NextResponse.json({
      success: true,
      message: 'Request acknowledged - stats remain in unified collection'
    })

  } catch (error) {
    logger.error('[DEPRECATED API] Error in leaderboard stats delete:', error)
    return NextResponse.json(
      { error: 'Failed to process delete request' },
      { status: 500 }
    )
  }
}