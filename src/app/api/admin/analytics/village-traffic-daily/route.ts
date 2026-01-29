import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/admin/adminAuth'
import { adminFirestore } from '@/lib/firebase/admin'
import {
  learningVillageTrackedRoutes,
  normalizeLearningVillagePath,
} from '@/lib/analytics/learningVillageRoutes'
import { timestampToISOString } from '@/lib/utils/date-formatters'

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

    const start = new Date(`${dateKey}T00:00:00.000Z`)
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)

    const [snapshot, visitsSnapshot] = await Promise.all([
      adminFirestore
        .collection('page_visit_daily_summaries')
        .where('date', '==', dateKey)
        .get(),
      adminFirestore
        .collection('page_visits')
        .where('startedAt', '>=', start)
        .where('startedAt', '<', end)
        .get(),
    ])

    const routeStats = new Map<
      string,
      {
        route: string
        pageKey: string
        pageViews: number
        uniqueVisitors: number
        totalDurationMs: number
        durationCount: number
        lastVisit: string | null
      }
    >()

    const trackedSet = new Set(learningVillageTrackedRoutes)
    const uniqueVisitorsByRoute = new Map<string, Set<string>>()

    visitsSnapshot.docs.forEach((doc) => {
      const data = doc.data() || {}
      const path = typeof data.path === 'string' ? data.path : null
      const visitorId = typeof data.visitorId === 'string' ? data.visitorId : null
      if (!path || !visitorId) return

      const normalizedPath = normalizeLearningVillagePath(path)
      const baseRoute = learningVillageTrackedRoutes.find(
        (route) => normalizedPath === route || normalizedPath.startsWith(`${route}/`)
      )
      if (!baseRoute || !trackedSet.has(baseRoute)) return

      if (!uniqueVisitorsByRoute.has(baseRoute)) {
        uniqueVisitorsByRoute.set(baseRoute, new Set())
      }
      uniqueVisitorsByRoute.get(baseRoute)!.add(visitorId)
    })

    snapshot.docs.forEach((doc) => {
      const data = doc.data() || {}
      const path = typeof data.path === 'string' ? data.path : null
      if (!path) return

      const normalizedPath = normalizeLearningVillagePath(path)
      const baseRoute = learningVillageTrackedRoutes.find((route) => normalizedPath === route || normalizedPath.startsWith(`${route}/`))
      if (!baseRoute || !trackedSet.has(baseRoute)) return

      const totalViews = typeof data.totalViews === 'number' ? data.totalViews : 0
      const totalDurationMs = typeof data.totalDurationMs === 'number' ? data.totalDurationMs : 0
      const durationCount = typeof data.durationCount === 'number' ? data.durationCount : 0
      const lastVisit = timestampToISOString(data.lastViewAt)

      const existing = routeStats.get(baseRoute)
      if (!existing) {
        routeStats.set(baseRoute, {
          route: baseRoute,
          pageKey: baseRoute.replace(/^\//, '').replace(/\//g, '_'),
          pageViews: totalViews,
          uniqueVisitors: uniqueVisitorsByRoute.get(baseRoute)?.size || 0,
          totalDurationMs,
          durationCount,
          lastVisit,
        })
      } else {
        existing.pageViews += totalViews
        existing.totalDurationMs += totalDurationMs
        existing.durationCount += durationCount
        if (lastVisit && (!existing.lastVisit || lastVisit > existing.lastVisit)) {
          existing.lastVisit = lastVisit
        }
      }
    })

    const pages = learningVillageTrackedRoutes.map((route) => {
      const entry = routeStats.get(route) || {
        route,
        pageKey: route.replace(/^\//, '').replace(/\//g, '_'),
        pageViews: 0,
        uniqueVisitors: uniqueVisitorsByRoute.get(route)?.size || 0,
        totalDurationMs: 0,
        durationCount: 0,
        lastVisit: null,
      }

      const avgDurationMs = entry.durationCount > 0
        ? Math.round(entry.totalDurationMs / entry.durationCount)
        : 0

      return {
        route: entry.route,
        pageKey: entry.pageKey,
        pageViews: entry.pageViews,
        uniqueVisitors: uniqueVisitorsByRoute.get(route)?.size || entry.uniqueVisitors,
        avgDurationMs,
        lastVisit: entry.lastVisit,
      }
    })

    const totals = pages.reduce(
      (acc, page) => {
        acc.pageViews += page.pageViews
        acc.uniqueVisitors += page.uniqueVisitors
        acc.avgDurationMsSum += page.avgDurationMs
        acc.count += 1
        return acc
      },
      { pageViews: 0, uniqueVisitors: 0, avgDurationMsSum: 0, count: 0 }
    )

    const totalsWithAvg = {
      pageViews: totals.pageViews,
      uniqueVisitors: totals.uniqueVisitors,
      avgDurationMs: totals.count > 0 ? Math.round(totals.avgDurationMsSum / totals.count) : 0,
    }

    return NextResponse.json({
      success: true,
      date: dateKey,
      timezone: 'UTC',
      learningVillage: {
        pages,
        totals: totalsWithAvg,
      },
    })
  } catch (error) {
    console.error('[API /admin/analytics/village-traffic-daily] Error:', error)
    return NextResponse.json(
      { error: { message: 'Failed to fetch village traffic daily data' } },
      { status: 500 }
    )
  }
})
