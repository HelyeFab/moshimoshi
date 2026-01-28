/**
 * Announcement Analytics API
 *
 * GET - Get analytics for a specific announcement
 *
 * Returns view counts, dismissal counts, and engagement metrics
 */

import { NextRequest, NextResponse } from 'next/server'
import { AdminContext } from '@/lib/admin/adminAuth'
import { withAdminAnalyticsRateLimit } from '@/lib/api/admin-analytics-rate-limiter'
import { adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin'
import type { AnnouncementAnalytics } from '@/lib/announcements/types'

/**
 * GET - Get analytics for an announcement
 *
 * Path params:
 * - id: The announcement ID
 */
export const GET = withAdminAnalyticsRateLimit(
  async (request: NextRequest, context: AdminContext) => {
    try {
      ensureAdminInitialized()

      if (!adminFirestore) {
        throw new Error('Firebase Admin not initialized')
      }

      const announcementId = context.params?.id

      if (!announcementId) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_REQUEST',
              message: 'Announcement ID is required',
            },
          },
          { status: 400 }
        )
      }

      // Verify announcement exists
      const announcementDoc = await adminFirestore
        .collection('announcements')
        .doc(announcementId)
        .get()

      if (!announcementDoc.exists) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Announcement not found',
            },
          },
          { status: 404 }
        )
      }

      // Fetch views and dismissals in parallel
      const [viewsSnapshot, dismissalsSnapshot] = await Promise.all([
        adminFirestore
          .collection('announcement_views')
          .where('announcementId', '==', announcementId)
          .get(),
        adminFirestore
          .collection('announcement_dismissals')
          .where('announcementId', '==', announcementId)
          .get(),
      ])

      // Process views
      let totalViews = 0
      let uniqueViewers = 0
      let authenticatedViews = 0
      let guestViews = 0

      if (!viewsSnapshot.empty) {
        totalViews = viewsSnapshot.size
        uniqueViewers = viewsSnapshot.size // Each doc is unique by visitor

        viewsSnapshot.forEach((doc) => {
          const data = doc.data()
          if (data.visitorType === 'user') {
            authenticatedViews++
          } else {
            guestViews++
          }
        })
      }

      // Process dismissals
      let totalDismissals = 0
      let authenticatedDismissals = 0
      let guestDismissals = 0

      if (!dismissalsSnapshot.empty) {
        totalDismissals = dismissalsSnapshot.size

        dismissalsSnapshot.forEach((doc) => {
          const data = doc.data()
          if (data.visitorType === 'user') {
            authenticatedDismissals++
          } else {
            guestDismissals++
          }
        })
      }

      // Calculate dismissal rate
      const dismissalRate = totalViews > 0 ? (totalDismissals / totalViews) * 100 : 0

      // Build analytics response
      const analytics: AnnouncementAnalytics = {
        announcementId,
        totalViews,
        uniqueViewers,
        totalDismissals,
        dismissalRate: Math.round(dismissalRate * 100) / 100, // Round to 2 decimal places
        viewsByType: {
          authenticated: authenticatedViews,
          guest: guestViews,
        },
        dismissalsByType: {
          authenticated: authenticatedDismissals,
          guest: guestDismissals,
        },
      }

      console.log(
        `[API /admin/announcements/analytics/${announcementId}] Analytics fetched by ${context.user.email}`
      )

      return NextResponse.json({
        success: true,
        analytics,
      })
    } catch (error: any) {
      console.error('[API /admin/announcements/analytics] Error:', error)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: error.message || 'Failed to fetch analytics',
          },
        },
        { status: 500 }
      )
    }
  }
)
