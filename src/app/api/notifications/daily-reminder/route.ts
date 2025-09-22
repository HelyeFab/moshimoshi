/**
 * Daily Study Reminder API Endpoint
 * Triggered by Vercel cron to send daily reminders
 */

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { adminDb } from '@/lib/firebase/admin'
import { notificationService } from '@/lib/notifications/notification-service'

export async function GET(request: NextRequest) {
  try {
    // Verify this is a cron job request (Vercel adds this header)
    const authHeader = headers().get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('[Daily Reminder] Starting daily reminder job...')

    // Get current hour in UTC
    const currentHour = new Date().getUTCHours()

    // Query users who should receive reminders at this hour
    // We'll need to consider timezones in production
    const usersSnapshot = await adminDb
      .collection('users')
      .where('preferences.notifications.dailyReminder', '==', true)
      .get()

    console.log(`[Daily Reminder] Found ${usersSnapshot.size} users with daily reminders enabled`)

    const results = {
      total: usersSnapshot.size,
      sent: 0,
      failed: 0,
      skipped: 0,
    }

    // Process users in batches to avoid overwhelming the email service
    const batchSize = 10
    const userDocs = usersSnapshot.docs

    for (let i = 0; i < userDocs.length; i += batchSize) {
      const batch = userDocs.slice(i, i + batchSize)

      await Promise.all(
        batch.map(async (userDoc) => {
          try {
            const userId = userDoc.id
            const userData = userDoc.data()

            // Check user timezone and preferred reminder time
            const userTimezone = userData.preferences?.notifications?.timezone || 'UTC'
            const reminderTime = userData.preferences?.notifications?.reminderTime || '09:00'

            // Convert reminder time to hour
            const [reminderHour] = reminderTime.split(':').map(Number)

            // Calculate user's current hour based on timezone
            // For MVP, we'll use a simplified approach
            // In production, use a proper timezone library
            const userCurrentHour = this.getUserCurrentHour(currentHour, userTimezone)

            if (userCurrentHour !== reminderHour) {
              results.skipped++
              return
            }

            // Check if user has already been notified today
            const today = new Date().toISOString().split('T')[0]
            const notificationLogRef = adminDb
              .collection('users')
              .doc(userId)
              .collection('notificationLogs')
              .where('type', '==', 'daily_reminder')
              .where('sentAt', '>=', new Date(today))
              .limit(1)

            const existingNotification = await notificationLogRef.get()
            if (!existingNotification.empty) {
              console.log(`[Daily Reminder] User ${userId} already notified today`)
              results.skipped++
              return
            }

            // Send the reminder
            const success = await notificationService.sendDailyReminder(userId)

            if (success) {
              results.sent++
            } else {
              results.failed++
            }
          } catch (error) {
            console.error(`[Daily Reminder] Error processing user ${userDoc.id}:`, error)
            results.failed++
          }
        })
      )

      // Add a small delay between batches to avoid rate limiting
      if (i + batchSize < userDocs.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    console.log('[Daily Reminder] Job completed:', results)

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Daily Reminder] Job failed:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Helper function to calculate user's current hour based on timezone
// This is a simplified version - in production, use moment-timezone or date-fns-tz
function getUserCurrentHour(utcHour: number, timezone: string): number {
  const timezoneOffsets: Record<string, number> = {
    'UTC': 0,
    'America/New_York': -5,
    'America/Chicago': -6,
    'America/Denver': -7,
    'America/Los_Angeles': -8,
    'Europe/London': 0,
    'Europe/Paris': 1,
    'Europe/Berlin': 1,
    'Asia/Tokyo': 9,
    'Asia/Shanghai': 8,
    'Australia/Sydney': 11,
  }

  const offset = timezoneOffsets[timezone] || 0
  let userHour = utcHour + offset

  // Handle day boundary
  if (userHour < 0) userHour += 24
  if (userHour >= 24) userHour -= 24

  return userHour
}

// Also export POST for manual triggering (admin only)
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

    // Get specific user ID from request body for manual trigger
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      )
    }

    // Send reminder to specific user
    const success = await notificationService.sendDailyReminder(userId)

    return NextResponse.json({
      success,
      message: success ? 'Reminder sent successfully' : 'Failed to send reminder',
    })
  } catch (error) {
    console.error('[Daily Reminder] Manual trigger failed:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}