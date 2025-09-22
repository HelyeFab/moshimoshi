/**
 * API Route: Send Push Notification
 * POST /api/notifications/send-push
 *
 * Sends push notifications via Firebase Cloud Messaging
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/app/api/review/_middleware/auth'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import admin from 'firebase-admin'

// Initialize Firebase Admin Messaging if not already initialized
let messaging: admin.messaging.Messaging | null = null

if (admin.apps.length > 0) {
  messaging = admin.messaging()
}

/**
 * Send push notification to a specific device
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const { user, response: authError } = await requireAuth(request)
    if (authError) return authError

    // Parse request body
    const body = await request.json()
    const { token, title, body: notificationBody, data } = body

    // Validate required fields
    if (!token || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: token and title are required' },
        { status: 400 }
      )
    }

    if (!messaging) {
      return NextResponse.json(
        { error: 'Push notification service not available' },
        { status: 503 }
      )
    }

    // Prepare FCM message
    const message: admin.messaging.Message = {
      token,
      notification: {
        title,
        body: notificationBody || 'You have new reviews!'
      },
      data: data || {},
      webpush: {
        fcmOptions: {
          link: data?.actionUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'https://moshimoshi.app'}/review`
        },
        notification: {
          icon: '/icons/icon-192x192.svg',
          badge: '/icons/icon-72x72.svg',
          vibrate: [200, 100, 200],
          requireInteraction: true,
          actions: [
            {
              action: 'review',
              title: 'Start Review'
            },
            {
              action: 'later',
              title: 'Remind Later'
            }
          ]
        }
      },
      android: {
        notification: {
          icon: 'ic_notification',
          color: '#FF6B6B',
          priority: 'high',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK'
        }
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title,
              body: notificationBody
            },
            badge: 1,
            sound: 'default',
            contentAvailable: true
          }
        },
        fcmOptions: {
          imageUrl: '/icons/icon-512x512.png'
        }
      }
    }

    // Send the message
    const response = await messaging.send(message)

    // Log notification in database
    await adminDb.collection('notifications_log').add({
      userId: user.id,
      type: 'push',
      channel: 'fcm',
      messageId: response,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      title,
      body: notificationBody,
      data,
      token: token.substring(0, 10) + '...', // Store partial token for debugging
      status: 'sent'
    })

    // Track analytics event
    await adminDb.collection('analytics_events').add({
      userId: user.id,
      event: 'notification_sent',
      category: 'push',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      properties: {
        messageId: response,
        hasData: !!data,
        hasAction: !!data?.actionUrl
      }
    })

    return NextResponse.json({
      success: true,
      messageId: response,
      message: 'Push notification sent successfully'
    })

  } catch (error) {
    console.error('Failed to send push notification:', error)

    // Log error in database
    if (user?.id) {
      await adminDb.collection('notifications_log').add({
        userId: user.id,
        type: 'push',
        channel: 'fcm',
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined
      })
    }

    // Handle specific FCM errors
    if (error instanceof Error) {
      if (error.message.includes('registration-token-not-registered')) {
        return NextResponse.json(
          { error: 'Device token is invalid or expired' },
          { status: 400 }
        )
      }

      if (error.message.includes('quota-exceeded')) {
        return NextResponse.json(
          { error: 'Notification quota exceeded. Please try again later.' },
          { status: 429 }
        )
      }

      if (error.message.includes('invalid-argument')) {
        return NextResponse.json(
          { error: 'Invalid notification data provided' },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to send push notification',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint to check push notification service status
 */
export async function GET(request: NextRequest) {
  try {
    const { user, response: authError } = await requireAuth(request)
    if (authError) return authError

    // Check if messaging service is available
    const serviceAvailable = !!messaging

    // Get user's FCM token if exists
    let fcmToken = null
    let tokenStatus = 'not_found'

    const tokenDoc = await adminDb
      .collection('notifications_tokens')
      .doc(user.id)
      .get()

    if (tokenDoc.exists) {
      const data = tokenDoc.data()
      if (data?.fcm_token) {
        fcmToken = data.fcm_token.substring(0, 10) + '...' // Partial token for privacy
        tokenStatus = 'active'

        // Check token age
        const tokenAge = Date.now() - (data.fcm_token_updated?.toDate()?.getTime() || 0)
        const daysSinceUpdate = tokenAge / (1000 * 60 * 60 * 24)

        if (daysSinceUpdate > 30) {
          tokenStatus = 'stale'
        }
      }
    }

    // Get recent push notification stats
    const recentNotifications = await adminDb
      .collection('notifications_log')
      .where('userId', '==', user.id)
      .where('type', '==', 'push')
      .orderBy('sentAt', 'desc')
      .limit(5)
      .get()

    const stats = {
      total: recentNotifications.size,
      successful: recentNotifications.docs.filter(doc => doc.data().status === 'sent').length,
      failed: recentNotifications.docs.filter(doc => doc.data().status === 'failed').length,
      lastSent: recentNotifications.empty ? null : recentNotifications.docs[0].data().sentAt?.toDate()
    }

    return NextResponse.json({
      serviceAvailable,
      fcmToken,
      tokenStatus,
      stats,
      supportedPlatforms: ['web', 'android', 'ios']
    })

  } catch (error) {
    console.error('Failed to get push notification status:', error)
    return NextResponse.json(
      { error: 'Failed to get push notification status' },
      { status: 500 }
    )
  }
}