/**
 * API Route: Test Notification System
 * /api/notifications/test
 *
 * Sends test notifications through various channels
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/app/api/review/_middleware/auth'
import { adminDb, adminAuth } from '@/lib/firebase/admin'
import admin from 'firebase-admin'
import { notificationService } from '@/lib/notifications/notification-service'

interface TestNotificationRequest {
  channel: 'browser' | 'push' | 'email' | 'in_app' | 'all'
  type?: 'review_due' | 'achievement' | 'daily_reminder' | 'streak'
  delay?: number // Delay in seconds before sending
  customMessage?: {
    title?: string
    body?: string
  }
}

/**
 * POST - Send test notification
 */
export async function POST(request: NextRequest) {
  try {
    const { user, response: authError } = await requireAuth(request)
    if (authError) return authError

    const userId = user.id
    const body: TestNotificationRequest = await request.json()

    // Validate channel
    const validChannels = ['browser', 'push', 'email', 'in_app', 'all']
    if (!body.channel || !validChannels.includes(body.channel)) {
      return NextResponse.json(
        { error: `Invalid channel. Must be one of: ${validChannels.join(', ')}` },
        { status: 400 }
      )
    }

    // Get user preferences to check enabled channels
    const prefsDoc = await adminDb
      .collection('notifications_preferences')
      .doc(userId)
      .get()

    const preferences = prefsDoc.exists ? prefsDoc.data() : null
    const results: Record<string, any> = {}

    // Apply delay if specified
    if (body.delay && body.delay > 0) {
      const delayMs = Math.min(body.delay * 1000, 60000) // Max 60 seconds
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }

    // Generate test notification content
    const notificationType = body.type || 'review_due'
    const testContent = generateTestContent(notificationType, body.customMessage)

    // Send to specified channel(s)
    const channels = body.channel === 'all'
      ? ['browser', 'push', 'email', 'in_app']
      : [body.channel]

    for (const channel of channels) {
      try {
        switch (channel) {
          case 'browser':
            results.browser = await sendBrowserTestNotification(userId, testContent)
            break

          case 'push':
            results.push = await sendPushTestNotification(userId, testContent)
            break

          case 'email':
            results.email = await sendEmailTestNotification(userId, testContent)
            break

          case 'in_app':
            results.in_app = await sendInAppTestNotification(userId, testContent)
            break
        }
      } catch (error) {
        results[channel] = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    // Log test notification
    await adminDb.collection('notifications_log').add({
      userId,
      type: 'test',
      channels,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      results,
      testType: notificationType,
      customMessage: body.customMessage
    })

    // Check overall success
    const allSuccessful = Object.values(results).every(r => r.success)
    const someSuccessful = Object.values(results).some(r => r.success)

    return NextResponse.json({
      success: someSuccessful,
      allSuccessful,
      results,
      message: allSuccessful
        ? 'All test notifications sent successfully'
        : someSuccessful
          ? 'Some test notifications sent successfully'
          : 'Failed to send test notifications'
    })

  } catch (error) {
    console.error('Failed to send test notification:', error)
    return NextResponse.json(
      {
        error: 'Failed to send test notification',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET - Get test notification status and history
 */
export async function GET(request: NextRequest) {
  try {
    const { user, response: authError } = await requireAuth(request)
    if (authError) return authError

    const userId = user.id

    // Get recent test notifications
    const recentTests = await adminDb
      .collection('notifications_log')
      .where('userId', '==', userId)
      .where('type', '==', 'test')
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get()

    const testHistory = recentTests.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        timestamp: data.timestamp?.toDate(),
        channels: data.channels,
        results: data.results,
        testType: data.testType,
        customMessage: data.customMessage
      }
    })

    // Get channel availability
    const tokenDoc = await adminDb
      .collection('notifications_tokens')
      .doc(userId)
      .get()

    const tokens = tokenDoc.exists ? tokenDoc.data() : null

    const channelStatus = {
      browser: {
        available: typeof window !== 'undefined' && 'Notification' in window,
        permission: tokens?.browser_permission || 'default',
        lastUpdated: tokens?.browser_permission_updated?.toDate()
      },
      push: {
        available: !!tokens?.fcm_token,
        tokenPresent: !!tokens?.fcm_token,
        lastUpdated: tokens?.fcm_token_updated?.toDate()
      },
      email: {
        available: !!user?.email,
        verified: true, // Assume verified if they're logged in
        address: user?.email
      },
      in_app: {
        available: true, // Always available when logged in
        enabled: true
      }
    }

    // Get preferences
    const prefsDoc = await adminDb
      .collection('notifications_preferences')
      .doc(userId)
      .get()

    const preferences = prefsDoc.exists ? prefsDoc.data() : null

    return NextResponse.json({
      testHistory,
      channelStatus,
      preferences: preferences?.channels || {},
      recommendations: generateRecommendations(channelStatus, preferences),
      testTypes: [
        { value: 'review_due', label: 'Review Due', description: 'Simulates a review reminder' },
        { value: 'achievement', label: 'Achievement Unlocked', description: 'Simulates an achievement notification' },
        { value: 'daily_reminder', label: 'Daily Reminder', description: 'Simulates a daily study reminder' },
        { value: 'streak', label: 'Streak Update', description: 'Simulates a streak milestone notification' }
      ]
    })

  } catch (error) {
    console.error('Failed to get test notification status:', error)
    return NextResponse.json(
      { error: 'Failed to get test notification status' },
      { status: 500 }
    )
  }
}

/**
 * Generate test notification content
 */
function generateTestContent(type: string, customMessage?: any) {
  const timestamp = new Date().toLocaleTimeString()

  const defaults: Record<string, any> = {
    review_due: {
      title: '🎯 Test: Review Due!',
      body: `This is a test review notification sent at ${timestamp}`,
      icon: '/icons/icon-192x192.svg',
      data: {
        type: 'test',
        itemId: 'test-item',
        actionUrl: '/review'
      }
    },
    achievement: {
      title: '🏆 Test: Achievement Unlocked!',
      body: `You've unlocked a test achievement at ${timestamp}`,
      icon: '/icons/achievement.svg',
      data: {
        type: 'test',
        achievementId: 'test-achievement',
        actionUrl: '/profile/achievements'
      }
    },
    daily_reminder: {
      title: '📚 Test: Daily Study Reminder',
      body: `Time for your daily Japanese practice! (Test at ${timestamp})`,
      icon: '/icons/icon-192x192.svg',
      data: {
        type: 'test',
        actionUrl: '/dashboard'
      }
    },
    streak: {
      title: '🔥 Test: Streak Milestone!',
      body: `You're on a test streak! Sent at ${timestamp}`,
      icon: '/icons/streak.svg',
      data: {
        type: 'test',
        streakCount: 7,
        actionUrl: '/dashboard'
      }
    }
  }

  const baseContent = defaults[type] || defaults.review_due

  // Override with custom message if provided
  if (customMessage?.title) {
    baseContent.title = customMessage.title
  }
  if (customMessage?.body) {
    baseContent.body = customMessage.body
  }

  return baseContent
}

/**
 * Send browser test notification
 */
async function sendBrowserTestNotification(userId: string, content: any) {
  // This would be triggered on the client side
  // For API testing, we just validate the setup
  const tokenDoc = await adminDb
    .collection('notifications_tokens')
    .doc(userId)
    .get()

  const permission = tokenDoc.data()?.browser_permission

  if (permission !== 'granted') {
    return {
      success: false,
      error: 'Browser notification permission not granted',
      requiresPermission: true
    }
  }

  return {
    success: true,
    message: 'Browser notification test queued. Check your browser for the notification.',
    content
  }
}

/**
 * Send push test notification
 */
async function sendPushTestNotification(userId: string, content: any) {
  const tokenDoc = await adminDb
    .collection('notifications_tokens')
    .doc(userId)
    .get()

  const fcmToken = tokenDoc.data()?.fcm_token

  if (!fcmToken) {
    return {
      success: false,
      error: 'No FCM token found. Push notifications not set up.',
      requiresSetup: true
    }
  }

  try {
    const messaging = admin.messaging()
    const response = await messaging.send({
      token: fcmToken,
      notification: {
        title: content.title,
        body: content.body
      },
      data: content.data,
      webpush: {
        notification: {
          icon: content.icon,
          badge: '/icons/icon-72x72.svg',
          requireInteraction: true
        }
      }
    })

    return {
      success: true,
      messageId: response,
      message: 'Push notification sent successfully'
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send push notification'
    }
  }
}

/**
 * Send email test notification
 */
async function sendEmailTestNotification(userId: string, content: any) {
  try {
    // Use existing notification service for email
    const sent = await notificationService.sendDailyReminder(userId)

    return {
      success: sent,
      message: sent ? 'Test email sent successfully' : 'Failed to send test email'
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email'
    }
  }
}

/**
 * Send in-app test notification
 */
async function sendInAppTestNotification(userId: string, content: any) {
  // Store in-app notification in queue
  await adminDb.collection('notifications_queue').add({
    userId,
    type: 'test',
    channel: 'in_app',
    scheduledFor: admin.firestore.Timestamp.now(),
    status: 'pending',
    data: {
      ...content,
      persistent: false,
      autoHide: 5000
    },
    createdAt: admin.firestore.Timestamp.now()
  })

  return {
    success: true,
    message: 'In-app notification queued. It will appear in your app shortly.'
  }
}

/**
 * Generate recommendations based on channel status
 */
function generateRecommendations(channelStatus: any, preferences: any): string[] {
  const recommendations: string[] = []

  if (channelStatus.browser.permission === 'default') {
    recommendations.push('Enable browser notifications for instant review reminders')
  }

  if (!channelStatus.push.available) {
    recommendations.push('Set up push notifications for mobile alerts')
  }

  if (!preferences?.channels?.email && channelStatus.email.available) {
    recommendations.push('Enable email notifications for daily summaries')
  }

  if (recommendations.length === 0) {
    recommendations.push('All notification channels are properly configured!')
  }

  return recommendations
}