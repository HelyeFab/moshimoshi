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
    logger.warn('[DEPRECATED] /api/achievements/activities GET called - redirecting to /api/stats/unified')

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
      dates: data.stats?.streak?.dates || {},
      currentStreak: data.stats?.streak?.current || 0,
      bestStreak: data.stats?.streak?.best || 0,
      lastActivity: data.stats?.streak?.lastActivityTimestamp || 0,
      isActiveToday: data.stats?.streak?.isActiveToday || false,
      lastActivityDate: data.stats?.streak?.lastActivityDate,
      storage: data.storage
    }

    return NextResponse.json(legacyResponse)

  } catch (error) {
    logger.error('[DEPRECATED API] Error in activities:', error)
    return NextResponse.json(
      { error: 'Failed to load activities' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    logger.warn('[DEPRECATED] /api/achievements/activities POST called - redirecting to /api/stats/unified')

    // Parse the request body
    const body = await request.json()
    const { dates, currentStreak, bestStreak, lastActivity } = body

    // Transform to unified API format
    const unifiedBody = {
      type: 'streak',
      data: {
        dates: dates || {},
        current: currentStreak || 0,
        best: bestStreak || 0,
        lastActivityTimestamp: lastActivity || Date.now()
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
      message: 'Activities saved successfully',
      success: true,
      storage: data.storage
    })

  } catch (error) {
    logger.error('[DEPRECATED API] Error in activities:', error)
    return NextResponse.json(
      { error: 'Failed to save activities' },
      { status: 500 }
    )
  }
}