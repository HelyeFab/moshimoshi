/**
 * API Route: Notification Preferences Management
 * /api/notifications/preferences
 *
 * Manages user notification preferences
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/app/api/review/_middleware/auth'
import { adminDb } from '@/lib/firebase/admin'
import admin from 'firebase-admin'

interface NotificationPreferences {
  userId: string
  channels: {
    browser: boolean
    inApp: boolean
    push: boolean
    email: boolean
  }
  timing: {
    immediate: boolean      // 10min, 30min reviews
    daily: boolean         // daily summary
    overdue: boolean       // overdue items
  }
  quiet_hours: {
    enabled: boolean
    start: string  // "22:00"
    end: string    // "08:00"
    timezone: string
  }
  batching: {
    enabled: boolean
    window_minutes: number  // batch notifications within X minutes
  }
  email: {
    dailyReminder: boolean
    achievementAlerts: boolean
    weeklyProgress: boolean
    marketingEmails: boolean
    reminderTime: string    // "09:00"
  }
  sound: {
    enabled: boolean
    volume: number         // 0-100
    customSound: string    // sound file name
  }
  vibration: {
    enabled: boolean
    pattern: number[]      // vibration pattern
  }
  updated_at: admin.firestore.Timestamp
  created_at: admin.firestore.Timestamp
}

/**
 * GET - Retrieve user's notification preferences
 */
export async function GET(request: NextRequest) {
  try {
    const { user, response: authError } = await requireAuth(request)
    if (authError) return authError

    const userId = user.id

    // Get preferences from database
    const prefsDoc = await adminDb
      .collection('notifications_preferences')
      .doc(userId)
      .get()

    if (prefsDoc.exists) {
      const data = prefsDoc.data()

      // Convert Firestore timestamps to dates
      return NextResponse.json({
        ...data,
        created_at: data?.created_at?.toDate(),
        updated_at: data?.updated_at?.toDate()
      })
    }

    // Return default preferences if none exist
    const defaultPreferences: Omit<NotificationPreferences, 'created_at' | 'updated_at'> = {
      userId,
      channels: {
        browser: false,
        inApp: true,
        push: false,
        email: true
      },
      timing: {
        immediate: true,
        daily: true,
        overdue: true
      },
      quiet_hours: {
        enabled: false,
        start: '22:00',
        end: '08:00',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      batching: {
        enabled: true,
        window_minutes: 5
      },
      email: {
        dailyReminder: true,
        achievementAlerts: true,
        weeklyProgress: false,
        marketingEmails: false,
        reminderTime: '09:00'
      },
      sound: {
        enabled: true,
        volume: 50,
        customSound: 'default'
      },
      vibration: {
        enabled: true,
        pattern: [200, 100, 200]
      }
    }

    // Save default preferences
    await adminDb
      .collection('notifications_preferences')
      .doc(userId)
      .set({
        ...defaultPreferences,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      })

    return NextResponse.json(defaultPreferences)

  } catch (error) {
    console.error('Failed to get notification preferences:', error)
    return NextResponse.json(
      { error: 'Failed to get notification preferences' },
      { status: 500 }
    )
  }
}

/**
 * PUT - Update user's notification preferences
 */
export async function PUT(request: NextRequest) {
  try {
    const { user, response: authError } = await requireAuth(request)
    if (authError) return authError

    const userId = user.id
    const body = await request.json()

    // Validate preferences structure
    const validatedPreferences = validatePreferences(body)

    // Update preferences in database
    const docRef = adminDb.collection('notifications_preferences').doc(userId)

    await docRef.set({
      ...validatedPreferences,
      userId,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true })

    // If browser notifications are being enabled, check permission status
    if (validatedPreferences.channels?.browser) {
      const tokenDoc = await adminDb
        .collection('notifications_tokens')
        .doc(userId)
        .get()

      if (!tokenDoc.exists || tokenDoc.data()?.browser_permission !== 'granted') {
        return NextResponse.json({
          success: true,
          message: 'Preferences updated',
          requiresPermission: true,
          permissionType: 'browser'
        })
      }
    }

    // If push notifications are being enabled, check FCM token
    if (validatedPreferences.channels?.push) {
      const tokenDoc = await adminDb
        .collection('notifications_tokens')
        .doc(userId)
        .get()

      if (!tokenDoc.exists || !tokenDoc.data()?.fcm_token) {
        return NextResponse.json({
          success: true,
          message: 'Preferences updated',
          requiresSetup: true,
          setupType: 'push'
        })
      }
    }

    // Log preference change
    await adminDb.collection('analytics_events').add({
      userId,
      event: 'preferences_updated',
      category: 'notifications',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      properties: {
        channels_enabled: Object.entries(validatedPreferences.channels || {})
          .filter(([_, enabled]) => enabled)
          .map(([channel]) => channel),
        quiet_hours_enabled: validatedPreferences.quiet_hours?.enabled,
        batching_enabled: validatedPreferences.batching?.enabled
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Notification preferences updated successfully'
    })

  } catch (error) {
    console.error('Failed to update notification preferences:', error)

    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update notification preferences' },
      { status: 500 }
    )
  }
}

/**
 * POST - Quick toggle for specific preference
 */
export async function POST(request: NextRequest) {
  try {
    const { user, response: authError } = await requireAuth(request)
    if (authError) return authError

    const userId = user.id
    const body = await request.json()
    const { setting, value } = body

    if (!setting || value === undefined) {
      return NextResponse.json(
        { error: 'Setting and value are required' },
        { status: 400 }
      )
    }

    // Map setting to preference path
    const updatePath = mapSettingToPath(setting)
    if (!updatePath) {
      return NextResponse.json(
        { error: `Invalid setting: ${setting}` },
        { status: 400 }
      )
    }

    // Update specific preference
    const docRef = adminDb.collection('notifications_preferences').doc(userId)

    await docRef.update({
      [updatePath]: value,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    })

    // If disabling all channels, cancel pending notifications
    if (setting === 'all_channels' && value === false) {
      await cancelAllPendingNotifications(userId)
    }

    return NextResponse.json({
      success: true,
      setting,
      value,
      message: `${setting} ${value ? 'enabled' : 'disabled'}`
    })

  } catch (error) {
    console.error('Failed to toggle notification preference:', error)
    return NextResponse.json(
      { error: 'Failed to toggle notification preference' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Reset preferences to defaults
 */
export async function DELETE(request: NextRequest) {
  try {
    const { user, response: authError } = await requireAuth(request)
    if (authError) return authError

    const userId = user.id

    // Delete existing preferences
    await adminDb
      .collection('notifications_preferences')
      .doc(userId)
      .delete()

    // Log the reset
    await adminDb.collection('analytics_events').add({
      userId,
      event: 'preferences_reset',
      category: 'notifications',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    })

    return NextResponse.json({
      success: true,
      message: 'Notification preferences reset to defaults'
    })

  } catch (error) {
    console.error('Failed to reset notification preferences:', error)
    return NextResponse.json(
      { error: 'Failed to reset notification preferences' },
      { status: 500 }
    )
  }
}

/**
 * Validation error class
 */
class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * Validate preferences structure
 */
function validatePreferences(prefs: any): Partial<NotificationPreferences> {
  const validated: Partial<NotificationPreferences> = {}

  // Validate channels
  if (prefs.channels) {
    validated.channels = {
      browser: !!prefs.channels.browser,
      inApp: !!prefs.channels.inApp,
      push: !!prefs.channels.push,
      email: !!prefs.channels.email
    }

    // At least one channel must be enabled
    const hasEnabledChannel = Object.values(validated.channels).some(v => v)
    if (!hasEnabledChannel) {
      throw new ValidationError('At least one notification channel must be enabled')
    }
  }

  // Validate timing
  if (prefs.timing) {
    validated.timing = {
      immediate: !!prefs.timing.immediate,
      daily: !!prefs.timing.daily,
      overdue: !!prefs.timing.overdue
    }
  }

  // Validate quiet hours
  if (prefs.quiet_hours) {
    validated.quiet_hours = {
      enabled: !!prefs.quiet_hours.enabled,
      start: validateTime(prefs.quiet_hours.start) || '22:00',
      end: validateTime(prefs.quiet_hours.end) || '08:00',
      timezone: prefs.quiet_hours.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
    }
  }

  // Validate batching
  if (prefs.batching) {
    validated.batching = {
      enabled: !!prefs.batching.enabled,
      window_minutes: Math.min(60, Math.max(1, parseInt(prefs.batching.window_minutes) || 5))
    }
  }

  // Validate email preferences
  if (prefs.email) {
    validated.email = {
      dailyReminder: !!prefs.email.dailyReminder,
      achievementAlerts: !!prefs.email.achievementAlerts,
      weeklyProgress: !!prefs.email.weeklyProgress,
      marketingEmails: !!prefs.email.marketingEmails,
      reminderTime: validateTime(prefs.email.reminderTime) || '09:00'
    }
  }

  // Validate sound preferences
  if (prefs.sound) {
    validated.sound = {
      enabled: !!prefs.sound.enabled,
      volume: Math.min(100, Math.max(0, parseInt(prefs.sound.volume) || 50)),
      customSound: prefs.sound.customSound || 'default'
    }
  }

  // Validate vibration preferences
  if (prefs.vibration) {
    validated.vibration = {
      enabled: !!prefs.vibration.enabled,
      pattern: Array.isArray(prefs.vibration.pattern)
        ? prefs.vibration.pattern.map(v => Math.max(0, parseInt(v) || 0))
        : [200, 100, 200]
    }
  }

  return validated
}

/**
 * Validate time format (HH:MM)
 */
function validateTime(time: string): string | null {
  if (!time) return null

  const match = time.match(/^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/)
  if (!match) return null

  const [_, hours, minutes] = match
  return `${hours.padStart(2, '0')}:${minutes}`
}

/**
 * Map setting name to database path
 */
function mapSettingToPath(setting: string): string | null {
  const mappings: Record<string, string> = {
    'browser_notifications': 'channels.browser',
    'in_app_notifications': 'channels.inApp',
    'push_notifications': 'channels.push',
    'email_notifications': 'channels.email',
    'immediate_timing': 'timing.immediate',
    'daily_timing': 'timing.daily',
    'overdue_timing': 'timing.overdue',
    'quiet_hours': 'quiet_hours.enabled',
    'batching': 'batching.enabled',
    'sound': 'sound.enabled',
    'vibration': 'vibration.enabled',
    'daily_reminder': 'email.dailyReminder',
    'achievement_alerts': 'email.achievementAlerts',
    'weekly_progress': 'email.weeklyProgress',
    'marketing_emails': 'email.marketingEmails'
  }

  return mappings[setting] || null
}

/**
 * Cancel all pending notifications for a user
 */
async function cancelAllPendingNotifications(userId: string): Promise<void> {
  const batch = adminDb.batch()

  const pendingNotifications = await adminDb
    .collection('notifications_queue')
    .where('userId', '==', userId)
    .where('status', '==', 'pending')
    .get()

  pendingNotifications.docs.forEach(doc => {
    batch.update(doc.ref, {
      status: 'cancelled',
      cancelledAt: admin.firestore.FieldValue.serverTimestamp()
    })
  })

  await batch.commit()
}