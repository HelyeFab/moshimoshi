/**
 * Start Review Session API endpoint
 * POST /api/review/session/start - Start a new review session
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isPremiumUser } from '../../_middleware/auth'
import { rateLimitByUser } from '../../_middleware/rateLimit'
import { validateBody, sessionSchemas } from '../../_middleware/validation'
import { handleApiError, successResponse, ApiError, ErrorCodes } from '../../_middleware/errors'
import { withCors } from '../../_middleware/cors'
import { SessionManager } from '@/lib/review-engine/session/manager'
import { ServerSessionStorage } from '@/lib/review-engine/session/server-storage'
import { AnalyticsService } from '@/lib/review-engine/session/analytics.service'
import { PinManager } from '@/lib/review-engine/pinning/pin-manager'
import { QueueGenerator } from '@/lib/review-engine/queue/queue-generator'
import { redis } from '@/lib/redis/client'
import { adminFirestore as db } from '@/lib/firebase/admin'
import { v4 as uuidv4 } from 'uuid'

// Initialize services with server-side storage
const storage = new ServerSessionStorage()
// AnalyticsService is already an instance, not a class
const sessionManager = new SessionManager(storage, AnalyticsService)
const pinManager = new PinManager()
const queueGenerator = new QueueGenerator()

/**
 * POST /api/review/session/start - Start a new review session
 */
export async function POST(request: NextRequest) {
  return withCors(request, async () => {
    try {
      // Authenticate user
      const { user, response: authError } = await requireAuth(request)
      if (authError) return authError

      // Rate limiting with premium benefits
      const { success: rateLimitOk, response: rateLimitError } = await rateLimitByUser(
        request,
        user.uid,
        'sessionStart',
        isPremiumUser(user) ? 2 : 1
      )
      if (rateLimitError) return rateLimitError

      // Validate request body
      const { data: body, response: validationError } = await validateBody(
        request,
        sessionSchemas.startSession
      )
      if (validationError) return validationError
      if (!body) {
        return NextResponse.json(
          { error: 'Invalid request body' },
          { status: 400 }
        )
      }

      // Check for active session
      const activeSessionKey = `review:session:active:${user.uid}`
      const activeSession = await redis.get(activeSessionKey)
      if (activeSession) {
        throw new ApiError(
          'An active session already exists. Please complete or abandon it first.',
          ErrorCodes.CONFLICT,
          409
        )
      }

      // Get items for session
      let items: any[] = []
      
      if (body.itemIds && body.itemIds.length > 0) {
        // Use specific items provided
        const pinnedItems = await pinManager.getPinnedItems(user.uid)
        items = pinnedItems.filter(item => body.itemIds!.includes(item.id))
        
        if (items.length !== body.itemIds.length) {
          throw new ApiError(
            'Some requested items not found or not pinned',
            ErrorCodes.NOT_FOUND,
            404
          )
        }
      } else {
        // Generate queue based on session type
        const pinnedItems = await pinManager.getPinnedItems(user.uid)
        
        let queueOptions: any = {
          limit: body.settings?.maxItems || 20,
          shuffleOrder: body.settings?.shuffleOrder !== false,
        }
        
        if (body.type === 'daily') {
          // Daily review: due items + new items
          const { items: queueItems } = await queueGenerator.generateQueue(
            user.uid,
            pinnedItems,
            {
              ...queueOptions,
              includeNew: true,
              includeDue: true,
              includeLearning: true,
            }
          )
          items = queueItems
        } else if (body.type === 'quick') {
          // Quick 5-minute session
          queueOptions.limit = 5
          const { items: queueItems } = await queueGenerator.generateQueue(
            user.uid,
            pinnedItems,
            queueOptions
          )
          items = queueItems
        } else if (body.type === 'test') {
          // Test mode: no hints, timer enabled
          queueOptions.shuffleOrder = false
          const { items: queueItems } = await queueGenerator.generateQueue(
            user.uid,
            pinnedItems,
            queueOptions
          )
          items = queueItems
        } else {
          // Custom session
          const { items: queueItems } = await queueGenerator.generateQueue(
            user.uid,
            pinnedItems,
            queueOptions
          )
          items = queueItems
        }
      }

      if (items.length === 0) {
        throw new ApiError(
          'No items available for review. Pin some items first.',
          ErrorCodes.INVALID_STATE,
          400
        )
      }

      // Limit session size based on user tier
      const maxItems = isPremiumUser(user) ? 100 : 50
      if (items.length > maxItems) {
        items = items.slice(0, maxItems)
      }

      // Create session
      const session = await sessionManager.startSession({
        userId: user.uid,
        items: items.map(item => ({
          id: item.id || item.contentId,
          contentType: item.contentType,
          primaryDisplay: item.primaryDisplay || '',
          primaryAnswer: item.primaryAnswer || '',
          difficulty: item.difficulty || 0.5,
          tags: item.tags || [],
          supportedModes: ['recognition', 'recall'],
        })),
        mode: 'recognition', // Default mode
        source: body.type === 'quick' ? 'quick' : body.type === 'test' ? 'test' : 'manual',
        shuffle: body.settings?.shuffleOrder !== false,
        tags: [],
      })

      // Store active session reference
      await redis.setex(
        activeSessionKey,
        60 * 60, // 1 hour TTL
        JSON.stringify({
          sessionId: session.id,
          startedAt: session.startedAt,
          itemCount: session.items.length,
        })
      )

      // Calculate estimated time
      const estimatedMinutes = session.items.length * 1.5

      return successResponse({
        session: {
          id: session.id,
          status: session.status,
          startedAt: session.startedAt,
          currentIndex: session.currentIndex,
          totalItems: session.items.length,
          mode: session.mode,
          source: session.source,
        },
        items: session.items.map(item => ({
          id: item.content.id,
          contentType: item.content.contentType,
          // ReviewSessionItem doesn't have status - items are all new or due for review
        })),
        metadata: {
          estimatedMinutes,
          showTimer: body.settings?.showTimer !== false,
          allowSkip: body.settings?.allowSkip !== false,
          sessionType: body.type,
        },
      }, {
        message: `Session started with ${session.items.length} items`
      })
    } catch (error) {
      return handleApiError(error)
    }
  })
}