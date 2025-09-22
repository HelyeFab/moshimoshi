/**
 * Check Pin Status API endpoint
 * GET /api/review/pin/check - Check if items are pinned
 */

import { NextRequest } from 'next/server'
import { requireAuth } from '../../_middleware/auth'
import { rateLimit } from '../../_middleware/rateLimit'
import { validateQuery, pinSchemas } from '../../_middleware/validation'
import { handleApiError, successResponse } from '../../_middleware/errors'
import { withCors } from '../../_middleware/cors'
import { PinManager } from '@/lib/review-engine/pinning/pin-manager'
import { redis } from '@/lib/redis/client'

// Initialize PinManager
const pinManager = new PinManager()

/**
 * GET /api/review/pin/check - Check if items are pinned
 */
export async function GET(request: NextRequest) {
  return withCors(request, async () => {
    try {
      // Authenticate user
      const { user, response: authError } = await requireAuth(request)
      if (authError) return authError

      // Rate limiting
      const { success: _rateLimitOk, response: rateLimitError } = await rateLimit(
        request,
        'pin',
        user.uid
      )
      if (rateLimitError) return rateLimitError

      // Parse query parameters
      const { searchParams } = new URL(request.url)
      const contentType = searchParams.get('contentType') || undefined
      const contentIds = searchParams.get('contentIds')?.split(',') || []

      // Validate query
      const { data: query, response: validationError } = validateQuery(
        request,
        pinSchemas.checkPinned
      )
      if (validationError) return validationError

      // Check cache first
      const cacheKey = `review:pinned:check:${user.uid}:${contentIds.join(',')}`
      const cached = await redis.get(cacheKey)
      if (cached) {
        return successResponse(JSON.parse(cached as string))
      }

      // Get all pinned items for user
      const pinnedItems = await pinManager.getPinnedItems(user.uid)
      
      // Create a map of pinned status
      const pinnedMap: Record<string, boolean> = {}
      const pinnedDetails: Record<string, any> = {}
      
      for (const contentId of contentIds) {
        const item = pinnedItems.find(p => p.contentId === contentId)
        pinnedMap[contentId] = !!item
        
        if (item) {
          pinnedDetails[contentId] = {
            pinned: true,
            pinnedAt: item.pinnedAt,
            priority: item.priority,
            tags: item.tags,
            isActive: item.isActive,
            reviewCount: item.reviewCount,
          }
        } else {
          pinnedDetails[contentId] = {
            pinned: false,
          }
        }
      }

      const response = {
        pinned: pinnedMap,
        details: pinnedDetails,
        summary: {
          checked: contentIds.length,
          pinned: Object.values(pinnedMap).filter(Boolean).length,
          unpinned: Object.values(pinnedMap).filter(v => !v).length,
        },
      }

      // Cache the result for 5 minutes
      await redis.setex(cacheKey, 300, JSON.stringify(response))

      return successResponse(response)
    } catch (error) {
      return handleApiError(error)
    }
  })
}