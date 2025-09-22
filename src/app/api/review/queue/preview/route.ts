/**
 * Review Queue Preview API endpoint
 * GET /api/review/queue/preview - Preview upcoming reviews
 */

import { NextRequest } from 'next/server'
import { requireAuth } from '../../_middleware/auth'
import { rateLimit } from '../../_middleware/rateLimit'
import { validateQuery, queueSchemas } from '../../_middleware/validation'
import { handleApiError, successResponse } from '../../_middleware/errors'
import { withCors } from '../../_middleware/cors'
import { PinManager } from '@/lib/review-engine/pinning/pin-manager'
import { redis } from '@/lib/redis/client'

// Initialize PinManager
const pinManager = new PinManager()

/**
 * GET /api/review/queue/preview - Preview upcoming reviews
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
        'queue',
        user.uid
      )
      if (rateLimitError) return rateLimitError

      // Parse query parameters
      const { searchParams } = new URL(request.url)
      const days = parseInt(searchParams.get('days') || '7')

      // Validate query
      const { data: query, response: validationError } = validateQuery(
        request,
        queueSchemas.queuePreview
      )
      if (validationError) return validationError

      // Check cache
      const cacheKey = `review:preview:${user.uid}:${days}`
      const cached = await redis.get(cacheKey)
      if (cached) {
        return successResponse(JSON.parse(cached as string))
      }

      // Get all pinned items for user
      const pinnedItems = await pinManager.getPinnedItems(user.uid)
      
      // Calculate schedule for the next N days
      const now = new Date()
      const schedule: Record<string, number> = {}
      const hourlyBreakdown: Record<string, Record<string, number>> = {}
      
      // Initialize days
      for (let i = 0; i <= days; i++) {
        const date = new Date(now)
        date.setDate(date.getDate() + i)
        const dateStr = date.toISOString().split('T')[0]
        schedule[dateStr] = 0
        hourlyBreakdown[dateStr] = {}
      }

      // Count items per day
      const endDate = new Date(now)
      endDate.setDate(endDate.getDate() + days)
      
      let totalDue = 0
      let overdueCount = 0
      const byContentType: Record<string, number> = {}
      const byStatus: Record<string, number> = {
        new: 0,
        learning: 0,
        mastered: 0,
      }

      for (const item of pinnedItems) {
        // Count by status
        byStatus[item.status || 'new']++
        
        // Count by content type
        byContentType[item.contentType] = (byContentType[item.contentType] || 0) + 1

        // Check if item is due within the preview period
        const nextReview = item.nextReviewAt || item.srsData?.nextReviewAt || item.pinnedAt
        if (nextReview && nextReview <= endDate) {
          const reviewDate = new Date(nextReview)
          const dateStr = reviewDate.toISOString().split('T')[0]
          
          if (schedule[dateStr] !== undefined) {
            schedule[dateStr]++
            totalDue++
            
            // Track hourly breakdown
            const hour = reviewDate.getHours()
            if (!hourlyBreakdown[dateStr][hour]) {
              hourlyBreakdown[dateStr][hour] = 0
            }
            hourlyBreakdown[dateStr][hour]++
          }
          
          // Count overdue items
          if (nextReview < now) {
            overdueCount++
          }
        }
      }

      // Calculate peak review times
      const peakTimes: Array<{ date: string; hour: number; count: number }> = []
      for (const [date, hours] of Object.entries(hourlyBreakdown)) {
        for (const [hour, count] of Object.entries(hours)) {
          peakTimes.push({ date, hour: parseInt(hour), count })
        }
      }
      peakTimes.sort((a, b) => b.count - a.count)

      // Calculate workload estimate
      const avgItemsPerDay = totalDue / days
      const estimatedMinutesPerDay = avgItemsPerDay * 1.5
      
      // Identify heavy days
      const heavyDays = Object.entries(schedule)
        .filter(([_, count]) => count > avgItemsPerDay * 1.5)
        .map(([date, count]) => ({ date, count }))

      const response = {
        schedule,
        summary: {
          totalItems: pinnedItems.length,
          totalDue,
          overdueCount,
          avgItemsPerDay: Math.round(avgItemsPerDay),
          estimatedMinutesPerDay: Math.round(estimatedMinutesPerDay),
        },
        breakdown: {
          byStatus,
          byContentType,
        },
        insights: {
          heavyDays,
          peakTimes: peakTimes.slice(0, 5),
          recommendation: getScheduleRecommendation(
            avgItemsPerDay,
            overdueCount,
            heavyDays.length
          ),
        },
      }

      // Cache for 1 hour
      await redis.setex(cacheKey, 3600, JSON.stringify(response))

      return successResponse(response)
    } catch (error) {
      return handleApiError(error)
    }
  })
}

// Helper function for recommendations
function getScheduleRecommendation(
  avgItemsPerDay: number,
  overdueCount: number,
  heavyDaysCount: number
): string {
  if (overdueCount > 20) {
    return 'You have many overdue items. Consider a catch-up session today.'
  }
  if (avgItemsPerDay > 50) {
    return 'Heavy review load ahead. Consider spreading reviews throughout the day.'
  }
  if (heavyDaysCount > 2) {
    return 'Some days have heavy loads. Try to review ahead when possible.'
  }
  if (avgItemsPerDay < 10) {
    return 'Light review schedule. Good time to add new items!'
  }
  return 'Review schedule looks manageable. Keep up the good work!'
}