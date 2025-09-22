/**
 * Unsubscribe API Endpoint
 * Allows users to unsubscribe from specific notification types
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Invalid unsubscribe link' },
        { status: 400 }
      )
    }

    // Decode the token (in production, use proper JWT verification)
    const decoded = Buffer.from(token, 'base64').toString('utf-8')
    const [userId, notificationType, timestamp] = decoded.split(':')

    if (!userId || !notificationType) {
      return NextResponse.json(
        { error: 'Invalid unsubscribe token' },
        { status: 400 }
      )
    }

    // Check if token is expired (24 hours)
    const tokenAge = Date.now() - parseInt(timestamp)
    if (tokenAge > 24 * 60 * 60 * 1000) {
      return NextResponse.json(
        { error: 'Unsubscribe link has expired' },
        { status: 400 }
      )
    }

    // Update user preferences
    const userRef = adminDb.collection('users').doc(userId)
    const prefsRef = userRef.collection('preferences').doc('settings')

    // Map notification type to preference field
    const preferenceMap: Record<string, string> = {
      'daily_reminder': 'notifications.dailyReminder',
      'achievement_alerts': 'notifications.achievementAlerts',
      'weekly_progress': 'notifications.weeklyProgress',
      'marketing': 'notifications.marketingEmails',
    }

    const field = preferenceMap[notificationType]
    if (!field) {
      return NextResponse.json(
        { error: 'Invalid notification type' },
        { status: 400 }
      )
    }

    // Update the specific notification preference
    await prefsRef.update({
      [field]: false,
      'updatedAt': new Date(),
    })

    // Log the unsubscribe action
    await userRef.collection('notificationLogs').add({
      type: 'unsubscribe',
      notificationType,
      timestamp: new Date(),
      method: 'email_link',
    })

    // Return success page (in production, redirect to a nice unsubscribe confirmation page)
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Unsubscribed - Moshimoshi</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            margin: 0;
            padding: 20px;
          }
          .container {
            background: white;
            border-radius: 12px;
            padding: 40px;
            max-width: 500px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            text-align: center;
          }
          h1 {
            color: #1f2937;
            margin-bottom: 10px;
          }
          p {
            color: #6b7280;
            line-height: 1.6;
            margin-bottom: 30px;
          }
          .emoji {
            font-size: 48px;
            margin-bottom: 20px;
          }
          .button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 30px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            margin: 0 10px;
          }
          .secondary-button {
            background: #f3f4f6;
            color: #4b5563;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="emoji">✅</div>
          <h1>Successfully Unsubscribed</h1>
          <p>
            You've been unsubscribed from ${notificationType.replace(/_/g, ' ')} notifications.
            You won't receive these emails anymore.
          </p>
          <p style="font-size: 14px;">
            Changed your mind? You can always re-enable notifications from your account settings.
          </p>
          <div>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/settings" class="button">
              Manage Preferences
            </a>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}" class="button secondary-button">
              Back to App
            </a>
          </div>
        </div>
      </body>
      </html>
      `,
      {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
        },
      }
    )
  } catch (error) {
    console.error('[Unsubscribe] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process unsubscribe request' },
      { status: 500 }
    )
  }
}

// POST endpoint for programmatic unsubscribe
export async function POST(request: NextRequest) {
  try {
    const { userId, notificationType } = await request.json()

    if (!userId || !notificationType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Update user preferences
    const prefsRef = adminDb
      .collection('users')
      .doc(userId)
      .collection('preferences')
      .doc('settings')

    const preferenceMap: Record<string, any> = {
      'daily_reminder': { 'notifications.dailyReminder': false },
      'achievement_alerts': { 'notifications.achievementAlerts': false },
      'weekly_progress': { 'notifications.weeklyProgress': false },
      'marketing': { 'notifications.marketingEmails': false },
      'all': {
        'notifications.dailyReminder': false,
        'notifications.achievementAlerts': false,
        'notifications.weeklyProgress': false,
        'notifications.marketingEmails': false,
      },
    }

    const updates = preferenceMap[notificationType]
    if (!updates) {
      return NextResponse.json(
        { error: 'Invalid notification type' },
        { status: 400 }
      )
    }

    await prefsRef.update({
      ...updates,
      'updatedAt': new Date(),
    })

    return NextResponse.json({
      success: true,
      message: `Unsubscribed from ${notificationType} notifications`,
    })
  } catch (error) {
    console.error('[Unsubscribe] POST Error:', error)
    return NextResponse.json(
      { error: 'Failed to unsubscribe' },
      { status: 500 }
    )
  }
}