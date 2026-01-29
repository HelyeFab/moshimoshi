import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/admin/adminAuth'
import { adminFirestore } from '@/lib/firebase/admin'

function parseDateParam(value: string | null): string | null {
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

function getUtcDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    if (!adminFirestore) {
      return NextResponse.json({ error: { message: 'Database not available' } }, { status: 503 })
    }

    const { searchParams } = new URL(request.url)
    const dateKey = parseDateParam(searchParams.get('date')) || getUtcDateKey()
    const includeMarketing = searchParams.get('includeMarketing') === 'true'
    const start = new Date(`${dateKey}T00:00:00.000Z`)
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)

    const snapshot = await adminFirestore
      .collection('page_visits')
      .where('startedAt', '>=', start)
      .where('startedAt', '<', end)
      .get()

    const visitorSets = new Map<string, Set<string>>()
    const visitCounts = new Map<string, number>()

    snapshot.docs.forEach((doc) => {
      const data = doc.data() || {}
      const path = typeof data.path === 'string' ? data.path : ''
      const normalizedPath = path.split('?')[0] || ''
      const segments = normalizedPath.split('/').filter(Boolean)
      const section = segments.length > 0 && segments[0].length === 2 ? segments[1] : segments[0]
      const isMarketingSection = !section || ['auth', 'pricing', 'contact', 'privacy'].includes(section) || normalizedPath === '/en' || normalizedPath === '/'

      if (!includeMarketing && isMarketingSection) {
        return
      }

      const visitorType = data.visitorType || 'unknown'
      const visitorId = typeof data.visitorId === 'string' ? data.visitorId : null

      visitCounts.set(visitorType, (visitCounts.get(visitorType) || 0) + 1)

      if (!visitorId) return
      if (!visitorSets.has(visitorType)) {
        visitorSets.set(visitorType, new Set())
      }
      visitorSets.get(visitorType)!.add(visitorId)
    })

    const uniqueCounts = Array.from(visitorSets.entries()).map(([name, set]) => ({
      name,
      value: set.size,
    }))

    const visitTotals = Array.from(visitCounts.entries()).map(([name, value]) => ({
      name,
      value,
    }))

    return NextResponse.json({
      success: true,
      date: dateKey,
      timezone: 'UTC',
      totals: {
        visits: snapshot.size,
      },
      uniqueVisitors: uniqueCounts,
      visitCounts: visitTotals,
    })
  } catch (error) {
    console.error('[API /admin/analytics/page-visits-summary] Error:', error)
    return NextResponse.json(
      { error: { message: 'Failed to fetch page visit summary' } },
      { status: 500 }
    )
  }
})
