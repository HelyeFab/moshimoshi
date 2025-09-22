/**
 * Review Queue API endpoints
 * GET /api/review/queue - Get review queue
 */

import { NextRequest } from 'next/server'
import { requireAuth, isPremiumUser } from '../_middleware/auth'
import { rateLimit } from '../_middleware/rateLimit'
import { validateQuery, queueSchemas } from '../_middleware/validation'
import { handleApiError, successResponse } from '../_middleware/errors'
import { withCors } from '../_middleware/cors'
import { PinManager } from '@/lib/review-engine/pinning/pin-manager'
import { QueueGenerator } from '@/lib/review-engine/queue/queue-generator'
import { redis } from '@/lib/redis/client'

// Initialize managers
const pinManager = new PinManager()
const queueGenerator = new QueueGenerator()

/**
 * GET /api/review/queue - Get review queue
 */
export async function GET(request: NextRequest) {
  return withCors(request, async () => {
    try {
      // Authenticate user
      const { user, response: authError } = await requireAuth(request)
      if (authError) return authError

      // Rate limiting
      const { success: rateLimitOk, response: rateLimitError } = await rateLimit(
        request,
        'queue',
        user.uid
      )
      if (rateLimitError) return rateLimitError

      // Parse and validate query parameters
      const { searchParams } = new URL(request.url)
      const limit = parseInt(searchParams.get('limit') || '20')
      const type = searchParams.get('type') || undefined
      const contentType = searchParams.get('contentType') || undefined

      // Check cache first
      const cacheKey = `review:queue:${user.uid}:${type || 'all'}:${contentType || 'all'}:${limit}`
      const cached = await redis.get(cacheKey)
      if (cached) {
        return successResponse(JSON.parse(cached as string))
      }

      // Get pinned items for user
      const pinnedItems = await pinManager.getPinnedItems(user.uid)
      
      // Apply session type filters
      let filteredItems = pinnedItems
      if (type === 'daily') {
        // Daily review: due items + some new items
        const now = new Date()
        filteredItems = pinnedItems.filter(item => {
          const nextReview = item.nextReviewAt || item.srsData?.nextReviewAt || item.pinnedAt
          const isDue = nextReview <= now
          const isNew = item.status === 'new'
          const isLearning = item.status === 'learning'
          return isDue || isNew || isLearning
        })
      } else if (type === 'quick') {
        // Quick session: limit to 5 items, prefer due items
        filteredItems = pinnedItems
          .sort((a, b) => {
            const aDue = (a.nextReviewAt || a.srsData?.nextReviewAt || a.pinnedAt)?.getTime() || Infinity
            const bDue = (b.nextReviewAt || b.srsData?.nextReviewAt || b.pinnedAt)?.getTime() || Infinity
            return aDue - bDue
          })
          .slice(0, 5)
      }

      // Generate queue
      const { items, stats } = await queueGenerator.generateQueue(
        user.uid,
        filteredItems,
        {
          limit: isPremiumUser(user) ? Math.min(limit, 100) : Math.min(limit, 50),
          contentTypes: contentType ? [contentType] : undefined,
          includeNew: true,
          includeDue: true,
          includeLearning: true,
          shuffleOrder: type !== 'test', // Don't shuffle test mode
          priorityBoost: true,
        }
      )

      // Check daily new items limit
      const dailyNewKey = `review:daily:new:${user.uid}:${new Date().toDateString()}`
      const dailyNewCount = parseInt((await redis.get(dailyNewKey) as string) || '0')
      const dailyNewLimit = isPremiumUser(user) ? 30 : 10
      
      // Apply daily limit
      const finalItems = queueGenerator.applyDailyLimits(
        items,
        dailyNewCount,
        dailyNewLimit
      )

      // Add variety if more than 10 items
      const variedItems = finalItems.length > 10 
        ? queueGenerator.shuffleForVariety(finalItems)
        : finalItems

      // Calculate estimated time
      const estimatedMinutes = variedItems.length * 1.5 // 1.5 minutes per item average
      
      const response = {
        items: variedItems.map(item => ({
          id: item.id,
          contentType: item.contentType,
          priority: item.queuePriority,
          dueIn: item.dueIn,
          source: item.source,
          status: item.srsData?.status || 'new',
          streak: item.srsData?.streak || 0,
        })),
        stats: {
          ...stats,
          queueSize: variedItems.length,
          estimatedMinutes,
          dailyNewRemaining: Math.max(0, dailyNewLimit - dailyNewCount),
        },
        nextReviewIn: stats.nextReviewIn 
          ? new Date(Date.now() + stats.nextReviewIn * 60 * 1000).toISOString()
          : null,
      }

      // Cache for 5 minutes
      await redis.setex(cacheKey, 300, JSON.stringify(response))

      return successResponse(response)
    } catch (error) {
      return handleApiError(error)
    }
  })
}