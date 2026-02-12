import { NextRequest, NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { withAdminAnalyticsRateLimit } from '@/lib/api/admin-analytics-rate-limiter'
import { adminFirestore } from '@/lib/firebase/admin'
import { timestampToISOString } from '@/lib/utils/date-formatters'

const MAX_LIMIT = 500

type JournalStatus = 'sent' | 'failed' | 'all'

function parseDateStart(value: string | null): Date | null {
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function parseDateEnd(value: string | null): Date | null {
  if (!value) return null
  const parsed = new Date(`${value}T23:59:59.999Z`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

export const GET = withAdminAnalyticsRateLimit(async (request: NextRequest) => {
  try {
    const db = adminFirestore
    if (!db) {
      return NextResponse.json({ error: { message: 'Database not available' } }, { status: 503 })
    }

    const { searchParams } = new URL(request.url)
    const limitParam = Number(searchParams.get('limit') || '200')
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(Math.floor(limitParam), 1), MAX_LIMIT)
      : 200

    const status = (searchParams.get('status') || 'all') as JournalStatus
    const notificationType = (searchParams.get('notificationType') || '').trim()
    const startDate = parseDateStart(searchParams.get('startDate'))
    const endDate = parseDateEnd(searchParams.get('endDate'))

    if ((searchParams.get('startDate') && !startDate) || (searchParams.get('endDate') && !endDate)) {
      return NextResponse.json({ error: { message: 'Invalid date range' } }, { status: 400 })
    }

    let query: FirebaseFirestore.Query = db.collection('email_send_journal').orderBy('sentAt', 'desc')

    if (startDate) {
      query = query.where('sentAt', '>=', Timestamp.fromDate(startDate))
    }
    if (endDate) {
      query = query.where('sentAt', '<=', Timestamp.fromDate(endDate))
    }

    const snapshot = await query.limit(limit).get()

    const allItems = snapshot.docs.map((doc) => {
      const data = doc.data() || {}
      return {
        id: doc.id,
        campaignId: typeof data.campaignId === 'string' ? data.campaignId : null,
        template: typeof data.template === 'string' ? data.template : null,
        templateId: typeof data.templateId === 'string' ? data.templateId : null,
        notificationType:
          typeof data.notificationType === 'string' ? data.notificationType : 'campaign',
        status: typeof data.status === 'string' ? data.status : 'sent',
        sentAt: timestampToISOString(data.sentAt),
        sentDateKey: typeof data.sentDateKey === 'string' ? data.sentDateKey : null,
        retentionDays: typeof data.retentionDays === 'number' ? data.retentionDays : null,
        source: typeof data.source === 'string' ? data.source : null,
        recipient: {
          uid: typeof data.recipient?.uid === 'string' ? data.recipient.uid : null,
          emailHash:
            typeof data.recipient?.emailHash === 'string' ? data.recipient.emailHash : null,
          emailMasked:
            typeof data.recipient?.emailMasked === 'string' ? data.recipient.emailMasked : null,
          emailDomain:
            typeof data.recipient?.emailDomain === 'string' ? data.recipient.emailDomain : null,
        },
        content: {
          summaryDate:
            typeof data.content?.summaryDate === 'string' ? data.content.summaryDate : null,
          topFeatureCount:
            typeof data.content?.topFeatureCount === 'number' ? data.content.topFeatureCount : 0,
          topFeatureNames: Array.isArray(data.content?.topFeatureNames)
            ? data.content.topFeatureNames.filter((value: unknown) => typeof value === 'string')
            : [],
        },
        errorMessage:
          typeof data.error?.message === 'string' ? data.error.message : null,
      }
    })

    const filtered = allItems.filter((item) => {
      if (status !== 'all' && item.status !== status) return false
      if (notificationType && item.notificationType !== notificationType) return false
      return true
    })

    const uniqueRecipientHashes = new Set(
      filtered
        .map((item) => item.recipient.emailHash)
        .filter((value): value is string => Boolean(value))
    )

    const byNotificationType = filtered.reduce<Record<string, number>>((acc, item) => {
      const key = item.notificationType || 'unknown'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})

    return NextResponse.json({
      success: true,
      items: filtered,
      summary: {
        total: filtered.length,
        sent: filtered.filter((item) => item.status === 'sent').length,
        failed: filtered.filter((item) => item.status === 'failed').length,
        uniqueRecipients: uniqueRecipientHashes.size,
        byNotificationType,
      },
    })
  } catch (error) {
    console.error('[API /admin/analytics/email-send-journal] Error:', error)
    return NextResponse.json(
      { error: { message: 'Failed to fetch email send journal' } },
      { status: 500 }
    )
  }
})
