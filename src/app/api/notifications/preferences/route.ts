/**
 * API Route: Notification Preferences Management
 * /api/notifications/preferences
 *
 * Manages user notification preferences
 *
 * IMPORTANT: INTENTIONAL DUAL STORAGE EXCEPTION
 *
 * This route writes notification preferences to Firebase for ALL authenticated users
 * (both free and premium), not just premium users. This is an INTENTIONAL DESIGN
 * DECISION, not a violation of the dual storage pattern.
 *
 * Reasons for Firebase writes for all users:
 * 1. Preferences include leaderboard opt-out settings (privacy feature)
 * 2. All users must be able to control their privacy settings
 * 3. Opt-out preferences need to be centrally stored for the leaderboard to respect them
 * 4. This is a privacy feature that benefits all users equally
 *
 * The POST and DELETE methods intentionally bypass storage helper checks because
 * these privacy controls must be available to all users.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/app/api/review/_middleware/auth'
import { adminDb } from '@/lib/firebase/admin'
import admin from 'firebase-admin'
import { getStorageDecision, createStorageResponse } from '@/lib/api/storage-helper'
import { getSession } from '@/lib/auth/session'

const FEATURE_REMINDER_KEYS = [
  'kana',
  'kanji_mastery',
  'flashcards_srs',
  'news',
  'stories',
  'library',
  'vocabulary'
] as const

type FeatureReminderKey = typeof FEATURE_REMINDER_KEYS[number]

const DEFAULT_FEATURE_REMINDERS: Record<FeatureReminderKey, boolean> = {
  kana: true,
  kanji_mastery: true,
  flashcards_srs: true,
  news: true,
  stories: true,
  library: true,
  vocabulary: true
}

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
  feature_reminders: {
    enabled: boolean
    features: Record<FeatureReminderKey, boolean>
  }
  updated_at: admin.firestore.Timestamp
  created_at: admin.firestore.Timestamp
}

function buildDefaultPreferences(userId: string): Omit<NotificationPreferences, 'created_at' | 'updated_at'> {
  return {
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
    },
    feature_reminders: {
      enabled: true,
      features: { ...DEFAULT_FEATURE_REMINDERS }
    }
  }
}

function normalizeFeatureReminderMap(features: unknown): Record<FeatureReminderKey, boolean> {
  const normalized = { ...DEFAULT_FEATURE_REMINDERS }
  if (!features || typeof features !== 'object') return normalized

  for (const key of FEATURE_REMINDER_KEYS) {
    if (key in (features as Record<string, unknown>)) {
      normalized[key] = !!(features as Record<string, unknown>)[key]
    }
  }

  return normalized
}

function mergeWithDefaultPreferences(
  userId: string,
  prefs: Partial<NotificationPreferences> | null | undefined
): Omit<NotificationPreferences, 'created_at' | 'updated_at'> {
  const defaults = buildDefaultPreferences(userId)
  const merged = {
    ...defaults,
    ...prefs,
    userId,
    channels: {
      ...defaults.channels,
      ...(prefs?.channels || {})
    },
    timing: {
      ...defaults.timing,
      ...(prefs?.timing || {})
    },
    quiet_hours: {
      ...defaults.quiet_hours,
      ...(prefs?.quiet_hours || {})
    },
    batching: {
      ...defaults.batching,
      ...(prefs?.batching || {})
    },
    email: {
      ...defaults.email,
      ...(prefs?.email || {})
    },
    sound: {
      ...defaults.sound,
      ...(prefs?.sound || {})
    },
    vibration: {
      ...defaults.vibration,
      ...(prefs?.vibration || {})
    },
    feature_reminders: {
      enabled: prefs?.feature_reminders?.enabled ?? defaults.feature_reminders.enabled,
      features: normalizeFeatureReminderMap(prefs?.feature_reminders?.features)
    }
  }

  return merged
}

function needsFeatureReminderMigration(prefs: Partial<NotificationPreferences> | null | undefined): boolean {
  if (!prefs?.feature_reminders) return true
  if (typeof prefs.feature_reminders.enabled !== 'boolean') return true
  if (!prefs.feature_reminders.features || typeof prefs.feature_reminders.features !== 'object') return true

  const features = prefs.feature_reminders.features
  return FEATURE_REMINDER_KEYS.some((key) => !(key in features))
}

/**
 * GET - Retrieve user's notification preferences
 */
export async function GET(request: NextRequest) {
  try {
    const { user, response: authError } = await requireAuth(request)
    if (authError) return authError

    const userId = user.uid
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const decision = await getStorageDecision(session)

    // Only get from Firebase for premium users
    let prefsDoc = null
    if (decision.shouldWriteToFirebase && adminDb) {
      prefsDoc = await adminDb
        .collection('notifications_preferences')
        .doc(userId)
        .get()
    }

    if (prefsDoc?.exists) {
      const data = prefsDoc.data()
      const mergedData = mergeWithDefaultPreferences(userId, data as Partial<NotificationPreferences>)

      if (decision.shouldWriteToFirebase && adminDb && needsFeatureReminderMigration(data as Partial<NotificationPreferences>)) {
        await adminDb
          .collection('notifications_preferences')
          .doc(userId)
          .set({
            feature_reminders: mergedData.feature_reminders,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true })
      }

      // Convert Firestore timestamps to dates
      return createStorageResponse({
        ...mergedData,
        created_at: data?.created_at?.toDate(),
        updated_at: data?.updated_at?.toDate()
      }, decision)
    }

    // Return default preferences if none exist
    const defaultPreferences = buildDefaultPreferences(userId)

    // Only save to Firebase for premium users
    if (decision.shouldWriteToFirebase && adminDb) {
      await adminDb
        .collection('notifications_preferences')
        .doc(userId)
        .set({
          ...defaultPreferences,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        })
    }

    return createStorageResponse(defaultPreferences, decision)

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

    const userId = user.uid
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const decision = await getStorageDecision(session)
    const body = await request.json()

    // Validate preferences structure
    const validatedPreferences = validatePreferences(body)

    // Feature reminders are privacy controls — write for ALL users
    // (same bypass as POST/DELETE, see file header comment).
    // Other preferences are only persisted for premium users.
    const isFeatureReminderOnly = !!(validatedPreferences.feature_reminders && Object.keys(validatedPreferences).length === 1)
    const shouldWrite = (decision.shouldWriteToFirebase || isFeatureReminderOnly) && adminDb

    if (shouldWrite) {
      const docRef = adminDb!.collection('notifications_preferences').doc(userId)

      await docRef.set({
        ...validatedPreferences,
        userId,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true })
    }

    // If browser notifications are being enabled, check permission status (premium only)
    if (decision.shouldWriteToFirebase && adminDb && validatedPreferences.channels?.browser) {
      const tokenDoc = await adminDb
        .collection('notifications_tokens')
        .doc(userId)
        .get()

      if (!tokenDoc.exists || tokenDoc.data()?.browser_permission !== 'granted') {
        return createStorageResponse({
          success: true,
          message: 'Preferences updated',
          requiresPermission: true,
          permissionType: 'browser'
        }, decision)
      }
    }

    // If push notifications are being enabled, check FCM token (premium only)
    if (decision.shouldWriteToFirebase && adminDb && validatedPreferences.channels?.push) {
      const tokenDoc = await adminDb
        .collection('notifications_tokens')
        .doc(userId)
        .get()

      if (!tokenDoc.exists || !tokenDoc.data()?.fcm_token) {
        return createStorageResponse({
          success: true,
          message: 'Preferences updated',
          requiresSetup: true,
          setupType: 'push'
        }, decision)
      }
    }

    // Log preference change (premium only)
    if (decision.shouldWriteToFirebase && adminDb) {
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
    }

    return createStorageResponse({
      success: true,
      message: decision.shouldWriteToFirebase ? 'Notification preferences updated successfully' : 'Preferences saved locally'
    }, decision)

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

    const userId = user.uid
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const decision = await getStorageDecision(session)
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

    if (!adminDb) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
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

    const userId = user.uid

    if (!adminDb) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      )
    }

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
        ? prefs.vibration.pattern.map((v: number | string) => Math.max(0, parseInt(String(v)) || 0))
        : [200, 100, 200]
    }
  }

  // Validate reminder summary feature toggles
  if (prefs.feature_reminders) {
    validated.feature_reminders = {
      enabled: prefs.feature_reminders.enabled !== undefined ? !!prefs.feature_reminders.enabled : true,
      features: normalizeFeatureReminderMap(prefs.feature_reminders.features)
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
    'marketing_emails': 'email.marketingEmails',
    'feature_reminders_enabled': 'feature_reminders.enabled'
  }

  return mappings[setting] || null
}

/**
 * Cancel all pending notifications for a user
 */
async function cancelAllPendingNotifications(userId: string): Promise<void> {
  if (!adminDb) {
    console.warn('adminDb not available, skipping notification cancellation')
    return
  }

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
