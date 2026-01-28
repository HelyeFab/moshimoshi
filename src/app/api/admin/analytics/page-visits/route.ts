import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/admin/adminAuth'
import { adminFirestore } from '@/lib/firebase/admin'
import { timestampToISOString } from '@/lib/utils/date-formatters'

const MAX_LIMIT = 500

export const GET = withAdminAuth(async (request) => {
  try {
    if (!adminFirestore) {
      return NextResponse.json({ error: { message: 'Database not available' } }, { status: 503 })
    }

    const { searchParams } = new URL(request.url)
    const limitParam = Number(searchParams.get('limit') || '200')
    const filterField = searchParams.get('filterField')
    const filterValue = searchParams.get('filterValue')
    const dateParam = searchParams.get('date')
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(Math.floor(limitParam), 1), MAX_LIMIT)
      : 200

    let query: FirebaseFirestore.Query = adminFirestore.collection('page_visits')

    if (filterField && filterValue) {
      if (filterField === 'userId' || filterField === 'visitorId' || filterField === 'anonId') {
        query = query.where(filterField, '==', filterValue)
      }
    }

    if (dateParam) {
      const parsed = new Date(`${dateParam}T00:00:00.000Z`)
      if (!Number.isNaN(parsed.getTime())) {
        const startOfDay = parsed
        const endOfDay = new Date(parsed.getTime() + 24 * 60 * 60 * 1000)
        query = query.where('startedAt', '>=', startOfDay).where('startedAt', '<', endOfDay)
      }
    }

    const snapshot = await query.orderBy('startedAt', 'desc').limit(limit).get()

    const items = snapshot.docs.map((doc) => {
      const data = doc.data() || {}
      return {
        id: doc.id,
        visitId: data.visitId || doc.id,
        path: data.path || null,
        locale: data.locale || null,
        visitorType: data.visitorType || null,
        visitorId: data.visitorId || null,
        userId: data.userId || null,
        anonId: data.anonId || null,
        referrer: data.referrer || null,
        durationMs: typeof data.durationMs === 'number' ? data.durationMs : null,
        startedAt: timestampToISOString(data.startedAt),
        endedAt: timestampToISOString(data.endedAt),
        startedAtClient: typeof data.startedAtClient === 'string' ? data.startedAtClient : null,
        endedAtClient: typeof data.endedAtClient === 'string' ? data.endedAtClient : null,
      }
    })

    return NextResponse.json({ success: true, items })
  } catch (error) {
    console.error('[API /admin/analytics/page-visits] Error:', error)
    return NextResponse.json(
      { error: { message: 'Failed to fetch page visits' } },
      { status: 500 }
    )
  }
})
