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
    logger.warn('[DEPRECATED] /api/xp/track POST called - redirecting to /api/stats/unified')

    // Parse the request body
    const body = await request.json()
    const { eventType, amount, source, metadata, sessionId, contentType } = body

    // Transform to unified API format
    const unifiedBody = {
      type: 'xp',
      data: {
        add: amount || 0,
        source: source || eventType,
        eventType,
        metadata: {
          ...metadata,
          sessionId,
          contentType,
          // Ensure idempotency key exists
          idempotencyKey: metadata?.idempotencyKey ||
                         (sessionId ? `session_${sessionId}` : `${eventType}_${Date.now()}`)
        }
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
        { error: { code: 'INTERNAL_ERROR', message: 'Failed to track XP' } },
        { status: response.status }
      )
    }

    const data = await response.json()

    // Transform response to old format for backward compatibility
    const legacyResponse = {
      success: true,
      data: {
        xpGained: amount || 0,
        totalXP: data.stats?.xp?.total || 0,
        currentLevel: data.stats?.xp?.level || 1,
        leveledUp: false, // Can be calculated client-side if needed
        levelInfo: {
          level: data.stats?.xp?.level || 1,
          title: data.stats?.xp?.levelTitle || 'Beginner',
          xpToNextLevel: 100 - (data.stats?.xp?.levelProgress || 0),
          progressPercentage: data.stats?.xp?.levelProgress || 0
        }
      },
      storage: data.storage
    }

    return NextResponse.json(legacyResponse)

  } catch (error) {
    logger.error('[DEPRECATED API] Error in XP track:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to track XP' } },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    logger.warn('[DEPRECATED] /api/xp/track GET called - redirecting to /api/stats/unified')

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
        { error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
        { status: response.status }
      )
    }

    const data = await response.json()

    // Transform response to old format for backward compatibility
    const legacyResponse = {
      success: true,
      data: {
        totalXP: data.stats?.xp?.total || 0,
        currentLevel: data.stats?.xp?.level || 1,
        lastXPGain: 0, // Not tracked in unified stats
        levelInfo: {
          level: data.stats?.xp?.level || 1,
          title: data.stats?.xp?.levelTitle || 'Beginner',
          xpToNextLevel: 100 - (data.stats?.xp?.levelProgress || 0),
          progressPercentage: data.stats?.xp?.levelProgress || 0
        },
        levelBadge: null,
        levelColor: null,
        recentEvents: [],
        updatedAt: data.stats?.metadata?.lastUpdated
      },
      storage: data.storage
    }

    return NextResponse.json(legacyResponse)

  } catch (error) {
    logger.error('[DEPRECATED API] Error in XP track GET:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch XP status' } },
      { status: 500 }
    )
  }
}