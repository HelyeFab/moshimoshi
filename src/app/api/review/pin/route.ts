/**
 * Pin Management API endpoints
 * POST /api/review/pin - Pin a single item
 * DELETE /api/review/pin - Unpin items
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../_middleware/auth'
import { rateLimit } from '../_middleware/rateLimit'
import { validateBody, pinSchemas } from '../_middleware/validation'
import { handleApiError, successResponse, ApiError, ErrorCodes } from '../_middleware/errors'
import { withCors } from '../_middleware/cors'
import { PinManager } from '@/lib/review-engine/pinning/pin-manager'
import { redis } from '@/lib/redis/client'

// Initialize PinManager
const pinManager = new PinManager({
  maxPinnedItems: 1000,
  defaultPriority: 'normal',
  defaultDailyLimit: 10,
})

/**
 * POST /api/review/pin - Pin a single item
 */
export async function POST(request: NextRequest) {
  return withCors(request, async () => {
    try {
      // Authenticate user
      const { user, response: authError } = await requireAuth(request)
      if (authError) return authError

      // Rate limiting
      const { success: rateLimitOk, response: rateLimitError } = await rateLimit(
        request,
        'pin',
        user.uid
      )
      if (rateLimitError) return rateLimitError

      // Validate request body
      const { data: body, response: validationError } = await validateBody(
        request,
        pinSchemas.pinSingle
      )
      if (validationError) return validationError

      // Body should be defined after validation
      if (!body) {
        throw new ApiError('Invalid request body', ErrorCodes.VALIDATION_ERROR, 400)
      }

      // Pin the item
      const pinnedItem = await pinManager.pin(
        user.uid,
        body.contentId,
        body.contentType,
        {
          priority: body.priority,
          tags: body.tags,
          setId: body.setId,
        }
      )

      // Invalidate cache
      await redis.del(`review:queue:${user.uid}`)
      await redis.del(`review:stats:${user.uid}`)

      // Get updated statistics
      const stats = await pinManager.getStatistics(user.uid)

      return successResponse(
        {
          item: pinnedItem,
          stats: {
            totalPinned: stats.totalPinned,
            activeItems: stats.activeItems,
            scheduledItems: stats.scheduledItems,
          },
        },
        { message: 'Item pinned successfully' }
      )
    } catch (error) {
      if (error instanceof Error && error.message.includes('already pinned')) {
        throw new ApiError(
          'Item is already pinned',
          ErrorCodes.ALREADY_EXISTS,
          409
        )
      }
      if (error instanceof Error && error.message.includes('limit')) {
        throw new ApiError(
          error.message,
          ErrorCodes.LIMIT_EXCEEDED,
          400
        )
      }
      return handleApiError(error)
    }
  })
}

/**
 * DELETE /api/review/pin - Unpin items
 */
export async function DELETE(request: NextRequest) {
  return withCors(request, async () => {
    try {
      // Authenticate user
      const { user, response: authError } = await requireAuth(request)
      if (authError) return authError

      // Rate limiting
      const { success: rateLimitOk, response: rateLimitError } = await rateLimit(
        request,
        'pin',
        user.uid
      )
      if (rateLimitError) return rateLimitError

      // Validate request body
      const { data: body, response: validationError } = await validateBody(
        request,
        pinSchemas.unpin
      )
      if (validationError) return validationError

      // Body should be defined after validation
      if (!body) {
        throw new ApiError('Invalid request body', ErrorCodes.VALIDATION_ERROR, 400)
      }

      // Unpin items
      const results = await Promise.allSettled(
        body.itemIds.map(itemId => pinManager.unpin(user.uid, itemId))
      )

      const successful = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length

      // Invalidate cache
      await redis.del(`review:queue:${user.uid}`)
      await redis.del(`review:stats:${user.uid}`)

      // Get updated statistics
      const stats = await pinManager.getStatistics(user.uid)

      return successResponse(
        {
          unpinned: successful,
          failed,
          stats: {
            totalPinned: stats.totalPinned,
            activeItems: stats.activeItems,
            scheduledItems: stats.scheduledItems,
          },
        },
        { message: `${successful} items unpinned successfully` }
      )
    } catch (error) {
      return handleApiError(error)
    }
  })
}