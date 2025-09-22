/**
 * Bulk Pin Management API endpoint
 * POST /api/review/pin/bulk - Pin multiple items at once
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isPremiumUser } from '../../_middleware/auth'
import { rateLimitByUser } from '../../_middleware/rateLimit'
import { validateBody, pinSchemas } from '../../_middleware/validation'
import { handleApiError, successResponse, ApiError, ErrorCodes } from '../../_middleware/errors'
import { withCors } from '../../_middleware/cors'
import { PinManager } from '@/lib/review-engine/pinning/pin-manager'
import { ReleaseScheduler } from '@/lib/review-engine/pinning/release-scheduler'
import { redis } from '@/lib/redis/client'

// Initialize managers
const pinManager = new PinManager({
  maxPinnedItems: 1000,
  defaultPriority: 'normal',
  defaultDailyLimit: 10,
})

const releaseScheduler = new ReleaseScheduler()

/**
 * POST /api/review/pin/bulk - Pin multiple items at once
 */
export async function POST(request: NextRequest) {
  return withCors(request, async () => {
    try {
      // Authenticate user
      const { user, response: authError } = await requireAuth(request)
      if (authError) return authError

      // Apply different limits for premium users
      const premiumMultiplier = isPremiumUser(user) ? 2 : 1
      
      // Rate limiting with premium multiplier
      const { success: rateLimitOk, response: rateLimitError } = await rateLimitByUser(
        request,
        user.uid,
        'pinBulk',
        premiumMultiplier
      )
      if (rateLimitError) return rateLimitError

      // Validate request body
      const { data: body, response: validationError } = await validateBody(
        request,
        pinSchemas.pinBulk
      )
      if (validationError) return validationError

      // Check bulk operation limit
      const maxBulkItems = isPremiumUser(user) ? 500 : 100
      if (body && body.items.length > maxBulkItems) {
        throw new ApiError(
          `Maximum bulk pin limit is ${maxBulkItems} items`,
          ErrorCodes.LIMIT_EXCEEDED,
          400
        )
      }

      // Check current pinned count
      const currentStats = await pinManager.getStatistics(user.uid)
      const availableSlots = (pinManager as any).config.maxPinnedItems - currentStats.totalPinned
      
      if (body && body.items.length > availableSlots) {
        throw new ApiError(
          `Only ${availableSlots} slots available. Unpin some items first.`,
          ErrorCodes.LIMIT_EXCEEDED,
          400
        )
      }

      // Body should be defined after validation
      if (!body) {
        throw new ApiError('Invalid request body', ErrorCodes.VALIDATION_ERROR, 400)
      }

      // Apply gradual release if requested
      let itemsToPin = body.items
      let releaseSchedule = null
      
      if (body.releaseSchedule === 'gradual' && body.dailyLimit) {
        // Create release schedule
        const schedule = await releaseScheduler.scheduleGradualRelease(
          body.items.map((item, index) => ({
            ...item,
            releaseOrder: index,
          }) as any),
          { dailyLimit: body.dailyLimit } as any
        )
        
        releaseSchedule = schedule
        
        // Only pin today's items immediately
        const todaysItems = await releaseScheduler.getItemsForToday(schedule as any)
        itemsToPin = todaysItems as any
      }

      // Perform bulk pin operation
      const result = await pinManager.pinBulk(
        user.uid,
        itemsToPin.map(item => ({
          contentId: item.contentId,
          contentType: item.contentType,
          options: {
            priority: body.priority,
            tags: body.tags,
            releaseSchedule: body.releaseSchedule,
          },
        }))
      )

      // Store release schedule if gradual
      if (releaseSchedule) {
        const scheduleKey = `review:schedule:${user.uid}`
        await redis.setex(
          scheduleKey,
          30 * 24 * 60 * 60, // 30 days TTL
          JSON.stringify(releaseSchedule)
        )
      }

      // Invalidate caches
      await redis.del(`review:queue:${user.uid}`)
      await redis.del(`review:stats:${user.uid}`)
      await redis.del(`review:pinned:${user.uid}`)

      // Get updated statistics
      const stats = await pinManager.getStatistics(user.uid)

      return successResponse(
        {
          result: {
            successful: result.succeeded.length,
            failed: result.failed.length,
            errors: result.failed.map(f => ({
              contentId: f.contentId,
              error: f.reason,
            })),
          },
          releaseSchedule: releaseSchedule ? {
            totalItems: body.items.length,
            dailyLimit: body.dailyLimit,
            startDate: new Date().toISOString(),
            estimatedDays: Math.ceil(body.items.length / (body.dailyLimit || 10)),
          } : undefined,
          stats: {
            totalPinned: stats.totalPinned,
            activeItems: stats.activeItems,
            scheduledItems: stats.scheduledItems,
          },
        },
        { 
          message: `${result.succeeded.length} items pinned successfully${
            releaseSchedule ? ' with gradual release schedule' : ''
          }` 
        }
      )
    } catch (error) {
      return handleApiError(error)
    }
  })
}