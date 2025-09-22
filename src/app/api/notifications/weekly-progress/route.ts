/**
 * Weekly Progress Report API Endpoint
 * Triggered by Vercel cron to send weekly progress reports
 */

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { adminDb } from '@/lib/firebase/admin'
import { notificationService } from '@/lib/notifications/notification-service'

export async function GET(request: NextRequest) {
  try {
    // Verify this is a cron job request
    const authHeader = headers().get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('[Weekly Progress] Starting weekly progress job...')

    // Get current day of week (0 = Sunday, 6 = Saturday)
    const currentDay = new Date().getDay()

    // Only run on Sundays
    if (currentDay !== 0) {
      return NextResponse.json({
        success: true,
        message: 'Not Sunday, skipping weekly reports',
        currentDay,
      })
    }

    // Query users who have weekly progress enabled
    const usersSnapshot = await adminDb
      .collection('users')
      .where('preferences.notifications.weeklyProgress', '==', true)
      .get()

    console.log(`[Weekly Progress] Found ${usersSnapshot.size} users with weekly progress enabled`)

    const results = {
      total: usersSnapshot.size,
      sent: 0,
      failed: 0,
      skipped: 0,
    }

    // Process users in batches
    const batchSize = 5 // Smaller batch size for weekly reports (more data intensive)
    const userDocs = usersSnapshot.docs

    for (let i = 0; i < userDocs.length; i += batchSize) {
      const batch = userDocs.slice(i, i + batchSize)

      await Promise.all(
        batch.map(async (userDoc) => {
          try {
            const userId = userDoc.id
            const userData = userDoc.data()

            // Check if user has been active in the past week
            const lastActivityRef = await adminDb
              .collection('users')
              .doc(userId)
              .collection('reviewSessions')
              .orderBy('createdAt', 'desc')
              .limit(1)
              .get()

            if (!lastActivityRef.empty) {
              const lastActivity = lastActivityRef.docs[0].data()
              const daysSinceActivity = Math.floor(
                (Date.now() - lastActivity.createdAt.toMillis()) / (1000 * 60 * 60 * 24)
              )

              // Skip users who haven't been active in 30+ days
              if (daysSinceActivity > 30) {
                console.log(`[Weekly Progress] User ${userId} inactive for ${daysSinceActivity} days, skipping`)
                results.skipped++
                return
              }
            }

            // Check if user has already received this week's report
            const weekStart = new Date()
            weekStart.setDate(weekStart.getDate() - 7)
            weekStart.setHours(0, 0, 0, 0)

            const existingReportRef = await adminDb
              .collection('users')
              .doc(userId)
              .collection('notificationLogs')
              .where('type', '==', 'weekly_progress')
              .where('sentAt', '>=', weekStart)
              .limit(1)
              .get()

            if (!existingReportRef.empty) {
              console.log(`[Weekly Progress] User ${userId} already received this week's report`)
              results.skipped++
              return
            }

            // Send the weekly progress report
            const success = await notificationService.sendWeeklyProgressReport(userId)

            if (success) {
              results.sent++
            } else {
              results.failed++
            }
          } catch (error) {
            console.error(`[Weekly Progress] Error processing user ${userDoc.id}:`, error)
            results.failed++
          }
        })
      )

      // Add delay between batches
      if (i + batchSize < userDocs.length) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    console.log('[Weekly Progress] Job completed:', results)

    // Log job execution
    await adminDb.collection('cronJobs').add({
      type: 'weekly_progress',
      executedAt: new Date(),
      results,
    })

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Weekly Progress] Job failed:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Manual trigger endpoint for testing
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const authHeader = headers().get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user ID from request
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      )
    }

    // Send weekly report to specific user
    const success = await notificationService.sendWeeklyProgressReport(userId)

    return NextResponse.json({
      success,
      message: success ? 'Weekly report sent successfully' : 'Failed to send report',
    })
  } catch (error) {
    console.error('[Weekly Progress] Manual trigger failed:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}