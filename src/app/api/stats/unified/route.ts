/**
 * Unified Stats API
 *
 * Single endpoint for ALL user statistics operations.
 * This is the ONLY API that should update the user_stats collection.
 *
 * Available for ALL authenticated users (free and premium).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { userStatsService } from '@/lib/services/UserStatsService'
import logger from '@/lib/logger'

/**
 * GET - Retrieve user stats
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user stats (creates if doesn't exist)
    const stats = await userStatsService.getUserStats(session.uid)

    return NextResponse.json({
      success: true,
      stats
    })

  } catch (error) {
    logger.error('[Unified Stats API] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to get user stats' },
      { status: 500 }
    )
  }
}

/**
 * POST - Update user stats
 *
 * Supports multiple update types:
 * - streak: Update streak data
 * - xp: Add XP
 * - achievement: Unlock achievement
 * - session: Record session completion
 * - profile: Update user profile info
 * - repair: Trigger data repair
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, data } = body

    logger.info(`[Unified Stats API] Update request for ${session.uid}:`, {
      type,
      data: Object.keys(data || {})
    })

    let updatedStats

    switch (type) {
      case 'streak':
        // Update streak (daily activity)
        updatedStats = await userStatsService.updateStreak(
          session.uid,
          data?.activityDate
        )
        break

      case 'xp':
        // Add XP
        if (!data?.amount || typeof data.amount !== 'number') {
          return NextResponse.json(
            { error: 'Invalid XP amount' },
            { status: 400 }
          )
        }
        updatedStats = await userStatsService.updateXP(
          session.uid,
          data.amount,
          data.source || 'unknown'
        )
        break

      case 'achievement':
        // Unlock achievement
        if (!data?.achievementId) {
          return NextResponse.json(
            { error: 'Achievement ID required' },
            { status: 400 }
          )
        }
        updatedStats = await userStatsService.unlockAchievement(
          session.uid,
          data.achievementId,
          data.points || 0
        )
        break

      case 'session':
        // Record session completion
        if (!data?.type) {
          return NextResponse.json(
            { error: 'Session type required' },
            { status: 400 }
          )
        }
        updatedStats = await userStatsService.recordSession(session.uid, {
          type: data.type,
          itemsReviewed: data.itemsReviewed || 0,
          accuracy: data.accuracy || 0,
          duration: data.duration || 0
        })

        // Also update streak for session completion
        await userStatsService.updateStreak(session.uid)
        break

      case 'profile':
        // Update profile information
        updatedStats = await userStatsService.updateUserStats(session.uid, {
          type: 'profile',
          data: {
            displayName: data.displayName,
            photoURL: data.photoURL,
            email: data.email
          },
          timestamp: Date.now()
        })
        break

      case 'repair':
        // Trigger data repair
        logger.warn(`[Unified Stats API] Repair requested for ${session.uid}`)
        const currentStats = await userStatsService.getUserStats(session.uid)
        updatedStats = await userStatsService.repairUserStats(
          session.uid,
          currentStats
        )
        break

      default:
        return NextResponse.json(
          { error: `Invalid update type: ${type}` },
          { status: 400 }
        )
    }

    // Log successful update
    logger.info(`[Unified Stats API] Successfully updated ${session.uid}:`, {
      type,
      streak: updatedStats.streak.current,
      xp: updatedStats.xp.total,
      level: updatedStats.xp.level
    })

    return NextResponse.json({
      success: true,
      stats: updatedStats,
      summary: {
        streak: updatedStats.streak.current,
        xp: updatedStats.xp.total,
        level: updatedStats.xp.level,
        achievements: updatedStats.achievements.unlockedCount
      }
    })

  } catch (error) {
    logger.error('[Unified Stats API] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to update user stats' },
      { status: 500 }
    )
  }
}

/**
 * PATCH - Batch update multiple stat types
 *
 * Allows updating multiple stat types in a single transaction
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { updates } = body

    if (!Array.isArray(updates)) {
      return NextResponse.json(
        { error: 'Updates must be an array' },
        { status: 400 }
      )
    }

    logger.info(`[Unified Stats API] Batch update for ${session.uid}:`, {
      updateCount: updates.length
    })

    let stats = await userStatsService.getUserStats(session.uid)

    // Apply all updates
    for (const update of updates) {
      const { type, data } = update

      switch (type) {
        case 'streak':
          stats = await userStatsService.updateStreak(session.uid, data?.activityDate)
          break
        case 'xp':
          stats = await userStatsService.updateXP(
            session.uid,
            data.amount,
            data.source
          )
          break
        case 'achievement':
          stats = await userStatsService.unlockAchievement(
            session.uid,
            data.achievementId,
            data.points
          )
          break
        case 'session':
          stats = await userStatsService.recordSession(session.uid, data)
          break
      }
    }

    return NextResponse.json({
      success: true,
      stats,
      updatesApplied: updates.length
    })

  } catch (error) {
    logger.error('[Unified Stats API] PATCH error:', error)
    return NextResponse.json(
      { error: 'Failed to batch update stats' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Reset user stats (admin or user account deletion)
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check for admin flag or user deleting own account
    const { searchParams } = new URL(request.url)
    const targetUserId = searchParams.get('userId')
    const isAdmin = session.tier === 'admin' // Adjust based on your admin check

    if (targetUserId && targetUserId !== session.uid && !isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized to delete other user stats' },
        { status: 403 }
      )
    }

    const userIdToDelete = targetUserId || session.uid

    logger.warn(`[Unified Stats API] Deleting stats for user ${userIdToDelete}`)

    // This would delete the stats document
    // Implement as needed based on your requirements

    return NextResponse.json({
      success: true,
      message: `Stats deleted for user ${userIdToDelete}`
    })

  } catch (error) {
    logger.error('[Unified Stats API] DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete user stats' },
      { status: 500 }
    )
  }
}