/**
 * API Route: Get Pending Notifications
 * GET /api/notifications/pending
 *
 * Fetches pending notifications for the authenticated user
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/app/api/review/_middleware/auth'
import { adminDb } from '@/lib/firebase/admin'
import admin from 'firebase-admin'

type QueueDoc = FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>

function timestampToDate(value: any): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value?.toDate === 'function') return value.toDate()
  return null
}

function getScheduledDate(data: any): Date | null {
  return timestampToDate(data.scheduledFor) || timestampToDate(data.scheduled_for)
}

function getCreatedDate(data: any): Date | null {
  return timestampToDate(data.createdAt) || timestampToDate(data.created_at)
}

function dedupeDocs(docs: QueueDoc[]): QueueDoc[] {
  const seen = new Set<string>()
  const result: QueueDoc[] = []

  for (const doc of docs) {
    if (!seen.has(doc.id)) {
      seen.add(doc.id)
      result.push(doc)
    }
  }

  return result
}

async function getQueueDocsByScheduledField(params: {
  userId: string
  status: string
  field: 'scheduledFor' | 'scheduled_for'
  operator: FirebaseFirestore.WhereFilterOp
  value: FirebaseFirestore.Timestamp
  limitSize: number
}): Promise<QueueDoc[]> {
  if (!adminDb) return []

  const snapshot = await adminDb
    .collection('notifications_queue')
    .where('userId', '==', params.userId)
    .where('status', '==', params.status)
    .where(params.field, params.operator, params.value)
    .orderBy(params.field, 'asc')
    .limit(params.limitSize)
    .get()

  return snapshot.docs as QueueDoc[]
}

async function getQueueCountByScheduledField(params: {
  userId: string
  status: string
  field: 'scheduledFor' | 'scheduled_for'
  value: FirebaseFirestore.Timestamp
}): Promise<number> {
  if (!adminDb) return 0

  const snapshot = await adminDb
    .collection('notifications_queue')
    .where('userId', '==', params.userId)
    .where('status', '==', params.status)
    .where(params.field, '<=', params.value)
    .count()
    .get()

  return snapshot.data().count
}

/**
 * GET - Fetch pending notifications for the user
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const { user, response: authError } = await requireAuth(request)
    if (authError) return authError

    if (!adminDb) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 })
    }

    const userId = user.uid
    const now = admin.firestore.Timestamp.now()

    // Support both camelCase and snake_case queue schemas.
    const [pendingCamel, pendingSnake, upcomingCamel, upcomingSnake] = await Promise.all([
      getQueueDocsByScheduledField({
        userId,
        status: 'pending',
        field: 'scheduledFor',
        operator: '<=',
        value: now,
        limitSize: 10
      }),
      getQueueDocsByScheduledField({
        userId,
        status: 'pending',
        field: 'scheduled_for',
        operator: '<=',
        value: now,
        limitSize: 10
      }),
      getQueueDocsByScheduledField({
        userId,
        status: 'pending',
        field: 'scheduledFor',
        operator: '>',
        value: now,
        limitSize: 20
      }),
      getQueueDocsByScheduledField({
        userId,
        status: 'pending',
        field: 'scheduled_for',
        operator: '>',
        value: now,
        limitSize: 20
      })
    ])

    const pendingDocs = dedupeDocs([...pendingCamel, ...pendingSnake])
    const upcomingDocs = dedupeDocs([...upcomingCamel, ...upcomingSnake])

    // Format pending notifications
    const pending = pendingDocs.map(doc => {
      const data = doc.data()
      const scheduledFor = getScheduledDate(data)
      const createdAt = getCreatedDate(data)

      return {
        id: doc.id,
        type: data.type,
        itemId: data.itemId,
        channel: data.channel,
        scheduledFor,
        data: {
          item_ids: data.data?.item_ids || [data.itemId],
          review_count: data.data?.review_count || 1,
          message: data.data?.message || generateNotificationMessage(data.type),
          action_url: data.data?.action_url || `/review?item=${data.itemId}`,
          priority: data.data?.priority || 'normal',
          contentType: data.contentType
        },
        createdAt,
        attempts: data.attempts || 0,
        metadata: data.metadata
      }
    })

    // Format upcoming notifications
    const upcoming = upcomingDocs.map(doc => {
      const data = doc.data()
      const scheduledDate = getScheduledDate(data)
      const timeUntilDue = scheduledDate ? scheduledDate.getTime() - Date.now() : 0

      return {
        id: doc.id,
        itemId: data.itemId,
        scheduledFor: scheduledDate,
        timeUntilDue: Math.max(0, timeUntilDue),
        timeUntilDueText: formatTimeUntilDue(timeUntilDue),
        type: data.type,
        contentType: data.contentType,
        metadata: data.metadata
      }
    }).sort((a, b) => {
      const aMs = a.scheduledFor ? a.scheduledFor.getTime() : Number.MAX_SAFE_INTEGER
      const bMs = b.scheduledFor ? b.scheduledFor.getTime() : Number.MAX_SAFE_INTEGER
      return aMs - bMs
    })

    // Get overdue items count across both schemas.
    const overdueThreshold = admin.firestore.Timestamp.fromMillis(now.toMillis() - 24 * 60 * 60 * 1000)
    const [overdueCamelCount, overdueSnakeCount] = await Promise.all([
      getQueueCountByScheduledField({
        userId,
        status: 'pending',
        field: 'scheduledFor',
        value: overdueThreshold
      }),
      getQueueCountByScheduledField({
        userId,
        status: 'pending',
        field: 'scheduled_for',
        value: overdueThreshold
      })
    ])
    const overdueCount = overdueCamelCount + overdueSnakeCount

    // Check if user has quiet hours enabled
    const preferencesDoc = await adminDb
      .collection('notifications_preferences')
      .doc(userId)
      .get()

    const preferences = preferencesDoc.exists ? preferencesDoc.data() : null
    const isQuietHours = checkQuietHours(preferences)

    return NextResponse.json({
      pending,
      upcoming,
      overdueCount,
      isQuietHours,
      summary: {
        pendingCount: pending.length,
        upcomingCount: upcoming.length,
        nextReviewIn: upcoming[0]?.timeUntilDue || null,
        nextReviewInText: upcoming[0]?.timeUntilDueText || null
      }
    })

  } catch (error) {
    console.error('Failed to fetch pending notifications:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pending notifications' },
      { status: 500 }
    )
  }
}

/**
 * POST - Mark notifications as sent or update their status
 */
export async function POST(request: NextRequest) {
  try {
    const { user, response: authError } = await requireAuth(request)
    if (authError) return authError

    if (!adminDb) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 })
    }

    const body = await request.json()
    const { notificationIds, status, error } = body

    if (!notificationIds || !Array.isArray(notificationIds) || !status) {
      return NextResponse.json(
        { error: 'Invalid request: notificationIds array and status are required' },
        { status: 400 }
      )
    }

    // Validate status
    const validStatuses = ['sent', 'failed', 'cancelled', 'snoozed']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    // Update notification statuses in batch
    const batch = adminDb.batch()
    const updateData: any = {
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    }

    if (status === 'sent') {
      updateData.sentAt = admin.firestore.FieldValue.serverTimestamp()
      updateData.sent_at = admin.firestore.FieldValue.serverTimestamp()
    }

    if (status === 'failed') {
      updateData.attempts = admin.firestore.FieldValue.increment(1)
      if (error) {
        updateData.error = error
      }
    }

    if (status === 'snoozed') {
      // Snooze for 30 minutes
      const snoozeUntil = new Date(Date.now() + 30 * 60 * 1000)
      updateData.scheduledFor = admin.firestore.Timestamp.fromDate(snoozeUntil)
      updateData.scheduled_for = admin.firestore.Timestamp.fromDate(snoozeUntil)
      updateData.status = 'pending' // Reset to pending
    }

    // Update each notification
    for (const notificationId of notificationIds) {
      const docRef = adminDb.collection('notifications_queue').doc(notificationId)
      batch.update(docRef, updateData)
    }

    await batch.commit()

    // Log the update
    await adminDb.collection('notifications_log').add({
      userId: user.uid,
      action: 'batch_update',
      notificationIds,
      status,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    })

    return NextResponse.json({
      success: true,
      updated: notificationIds.length,
      status
    })

  } catch (error) {
    console.error('Failed to update notification status:', error)
    return NextResponse.json(
      { error: 'Failed to update notification status' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Clear old or processed notifications
 */
export async function DELETE(request: NextRequest) {
  try {
    const { user, response: authError } = await requireAuth(request)
    if (authError) return authError

    if (!adminDb) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const clearType = searchParams.get('type') || 'sent' // 'sent', 'failed', 'old', 'all'

    const userId = user.uid
    const baseQuery = adminDb
      .collection('notifications_queue')
      .where('userId', '==', userId)

    let docsToDelete: QueueDoc[] = []

    if (clearType === 'sent') {
      const snapshot = await baseQuery.where('status', '==', 'sent').get()
      docsToDelete = snapshot.docs as QueueDoc[]
    } else if (clearType === 'failed') {
      const snapshot = await baseQuery.where('status', '==', 'failed').get()
      docsToDelete = snapshot.docs as QueueDoc[]
    } else if (clearType === 'old') {
      // Clear notifications older than 7 days across both schemas.
      const sevenDaysAgo = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      )

      const [camelSnapshot, snakeSnapshot] = await Promise.all([
        baseQuery.where('createdAt', '<', sevenDaysAgo).get(),
        baseQuery.where('created_at', '<', sevenDaysAgo).get()
      ])

      docsToDelete = dedupeDocs([
        ...(camelSnapshot.docs as QueueDoc[]),
        ...(snakeSnapshot.docs as QueueDoc[])
      ])
    } else {
      const snapshot = await baseQuery.get()
      docsToDelete = snapshot.docs as QueueDoc[]
    }

    // Delete in batches
    const batchSize = 500
    let deletedCount = 0

    while (deletedCount < docsToDelete.length) {
      const batch = adminDb.batch()
      const docs = docsToDelete.slice(deletedCount, deletedCount + batchSize)

      docs.forEach(doc => {
        batch.delete(doc.ref)
      })

      await batch.commit()
      deletedCount += docs.length
    }

    return NextResponse.json({
      success: true,
      deleted: deletedCount,
      type: clearType
    })

  } catch (error) {
    console.error('Failed to clear notifications:', error)
    return NextResponse.json(
      { error: 'Failed to clear notifications' },
      { status: 500 }
    )
  }
}

/**
 * Helper function to generate notification message based on type
 */
function generateNotificationMessage(type: string): string {
  switch (type) {
    case 'review_due':
      return 'You have reviews ready to practice!'
    case 'overdue':
      return 'You have overdue reviews. Don\'t lose your progress!'
    case 'daily_summary':
      return 'Check out your daily review summary'
    case 'streak_reminder':
      return 'Keep your streak alive! Review now'
    case 'achievement':
      return 'You\'ve unlocked a new achievement!'
    default:
      return 'You have new notifications'
  }
}

/**
 * Helper function to format time until due
 */
function formatTimeUntilDue(milliseconds: number): string {
  if (milliseconds <= 0) return 'Due now'

  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days} day${days > 1 ? 's' : ''}`
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`
  return `${seconds} second${seconds > 1 ? 's' : ''}`
}

/**
 * Helper function to check if currently in quiet hours
 */
function checkQuietHours(preferences: any): boolean {
  if (!preferences?.quiet_hours?.enabled) return false

  const now = new Date()
  const currentTime = now.getHours() * 60 + now.getMinutes()

  const [startHour, startMin] = (preferences.quiet_hours.start || '22:00').split(':').map(Number)
  const [endHour, endMin] = (preferences.quiet_hours.end || '08:00').split(':').map(Number)

  const startTime = startHour * 60 + startMin
  const endTime = endHour * 60 + endMin

  if (startTime <= endTime) {
    // Quiet hours don't cross midnight
    return currentTime >= startTime && currentTime < endTime
  } else {
    // Quiet hours cross midnight
    return currentTime >= startTime || currentTime < endTime
  }
}
