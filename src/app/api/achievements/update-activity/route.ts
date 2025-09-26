/**
 * DEPRECATED: Redirects to unified stats API
 *
 * This endpoint is kept for backward compatibility.
 * All new code should use /api/stats/unified instead.
 */

import { NextRequest, NextResponse } from 'next/server'
import logger from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    logger.warn('[DEPRECATED] /api/achievements/update-activity called - redirecting to /api/stats/unified')

    // Parse the request body
    const body = await request.json()
    const { sessionType, itemsReviewed, accuracy, duration } = body

    // Transform to unified API format
    const unifiedBody = {
      type: 'session',
      data: {
        type: sessionType,
        itemsReviewed: itemsReviewed || 0,
        accuracy: accuracy || 0,
        duration: duration || 0
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

    // Transform response to old format for backward compatibility
    const legacyResponse = {
      success: true,
      currentStreak: data.stats?.streak?.current || 0,
      bestStreak: data.stats?.streak?.best || 0,
      today: data.stats?.streak?.lastActivityDate || new Date().toISOString().split('T')[0],
      isActiveToday: data.stats?.streak?.isActiveToday || false
    }

    return NextResponse.json(legacyResponse)

  } catch (error) {
    logger.error('[DEPRECATED API] Error in update-activity:', error)
    return NextResponse.json(
      { error: 'Failed to update activity' },
      { status: 500 }
    )
  }
}