/**
 * Custom Review Queue API endpoint
 * POST /api/review/queue/custom - Create a custom review queue
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isPremiumUser } from '../../_middleware/auth'
import { rateLimit } from '../../_middleware/rateLimit'
import { validateBody, queueSchemas } from '../../_middleware/validation'
import { handleApiError, successResponse, ApiError, ErrorCodes } from '../../_middleware/errors'
import { withCors } from '../../_middleware/cors'
import { PinManager } from '@/lib/review-engine/pinning/pin-manager'
import { QueueGenerator } from '@/lib/review-engine/queue/queue-generator'

// Initialize managers
const pinManager = new PinManager()
const queueGenerator = new QueueGenerator()

/**
 * POST /api/review/queue/custom - Create a custom review queue
 */
export async function POST(request: NextRequest) {
  return withCors(request, async () => {
    try {
      // Authenticate user
      const { user, response: authError } = await requireAuth(request)
      if (authError) return authError

      // Custom queues are a premium feature
      if (!isPremiumUser(user)) {
        throw new ApiError(
          'Custom review queues are a premium feature',
          ErrorCodes.PREMIUM_REQUIRED,
          403
        )
      }

      // Rate limiting
      const { success: _rateLimitOk, response: rateLimitError } = await rateLimit(
        request,
        'queue',
        user.uid
      )
      if (rateLimitError) return rateLimitError

      // Validate request body
      const { data: body, response: validationError } = await validateBody(
        request,
        queueSchemas.customQueue
      )
      if (validationError) return validationError
      if (!body) {
        return NextResponse.json(
          { error: 'Invalid request body' },
          { status: 400 }
        )
      }

      // Get all pinned items for user
      let pinnedItems = await pinManager.getPinnedItems(user.uid)

      // Apply filters
      if (body.filters) {
        const { contentTypes, tags, status, dueByDate } = body.filters

        pinnedItems = pinnedItems.filter(item => {
          // Filter by content type
          if (contentTypes && contentTypes.length > 0) {
            if (!contentTypes.includes(item.contentType as any)) {
              return false
            }
          }

          // Filter by tags
          if (tags && tags.length > 0) {
            const hasMatchingTag = tags.some(tag => item.tags.includes(tag))
            if (!hasMatchingTag) {
              return false
            }
          }

          // Filter by status
          if (status && status.length > 0) {
            if (!status.includes(item.status || 'new')) {
              return false
            }
          }

          // Filter by due date
          if (dueByDate) {
            const dueBy = new Date(dueByDate)
            const nextReview = item.nextReviewAt || item.srsData?.nextReviewAt
            if (!nextReview || nextReview > dueBy) {
              return false
            }
          }

          return true
        })
      }

      // Apply ordering
      switch (body.order) {
        case 'due':
          pinnedItems.sort((a, b) => {
            const aDue = (a.nextReviewAt || a.srsData?.nextReviewAt || a.pinnedAt)?.getTime() || Infinity
            const bDue = (b.nextReviewAt || b.srsData?.nextReviewAt || b.pinnedAt)?.getTime() || Infinity
            return aDue - bDue
          })
          break
        
        case 'difficulty':
          pinnedItems.sort((a, b) => (b.difficulty || 0.5) - (a.difficulty || 0.5))
          break
        
        case 'priority':
          const priorityOrder = { high: 3, normal: 2, low: 1 }
          pinnedItems.sort((a, b) => {
            const aPriority = priorityOrder[a.priority || 'normal']
            const bPriority = priorityOrder[b.priority || 'normal']
            return bPriority - aPriority
          })
          break
        
        case 'random':
          // Fisher-Yates shuffle
          for (let i = pinnedItems.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pinnedItems[i], pinnedItems[j]] = [pinnedItems[j], pinnedItems[i]]
          }
          break
      }

      // Generate queue with filtered items
      const { items, stats } = await queueGenerator.generateQueue(
        user.uid,
        pinnedItems,
        {
          limit: body.limit,
          shuffleOrder: body.order === 'random',
          priorityBoost: body.order === 'priority',
        }
      )

      // Calculate estimated time
      const estimatedMinutes = items.length * 1.5

      return successResponse({
        queue: {
          items: items.map(item => ({
            id: item.id,
            contentType: item.contentType,
            priority: item.queuePriority,
            dueIn: item.dueIn,
            source: item.source,
            status: item.srsData?.status || 'new',
            tags: item.tags,
          })),
          metadata: {
            totalMatched: pinnedItems.length,
            queueSize: items.length,
            estimatedMinutes,
            filters: body.filters,
            order: body.order,
          },
        },
        stats,
      }, {
        message: `Custom queue created with ${items.length} items`
      })
    } catch (error) {
      return handleApiError(error)
    }
  })
}