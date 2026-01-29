import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/admin/adminAuth'
import { adminFirestore } from '@/lib/firebase/admin'
import { timestampToISOString } from '@/lib/utils/date-formatters'

const MAX_LIMIT = 50

type PathMeta =
  | { type: 'news'; id: string }
  | { type: 'comics'; id: string }
  | { type: 'stories'; slug: string }
  | { type: 'library'; id: string }
  | { type: 'unknown' }

function getUtcDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

function parseDateParam(value: string | null): string | null {
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

function normalizePath(path: string): string {
  return path.split('?')[0] || ''
}

function stripLocale(path: string): string[] {
  const segments = normalizePath(path).split('/').filter(Boolean)
  if (segments.length === 0) return []
  if (segments[0].length === 2) return segments.slice(1)
  return segments
}

function parsePathMeta(path: string | null): PathMeta {
  if (!path) return { type: 'unknown' }
  const segments = stripLocale(path)
  if (segments.length === 0) return { type: 'unknown' }
  const [section, id] = segments
  if (!section) return { type: 'unknown' }
  if (section === 'news' && id) return { type: 'news', id }
  if (section === 'comics' && id) return { type: 'comics', id }
  if (section === 'stories' && id) return { type: 'stories', slug: id }
  if (section === 'library' && id) return { type: 'library', id }
  return { type: 'unknown' }
}

function titleCase(value: string): string {
  return value
    .split('-')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ')
}

function resolveSection(path: string, section?: string | null): string {
  if (section) return section
  const segments = stripLocale(path)
  if (segments.length === 0) return 'home'
  return segments[0] || 'home'
}

function mapContentType(meta: PathMeta, section: string): string | null {
  if (meta.type === 'news') return 'articles'
  if (meta.type === 'comics') return 'comics'
  if (meta.type === 'stories') return 'stories'
  if (meta.type === 'library') return 'books'
  if (section === 'news') return 'articles'
  if (section === 'comics') return 'comics'
  if (section === 'stories') return 'stories'
  if (section === 'library') return 'books'
  return null
}

function normalizeContentType(value: string): string {
  if (value === 'news_articles') return 'articles'
  return value
}

export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    const db = adminFirestore
    if (!db) {
      return NextResponse.json({ error: { message: 'Database not available' } }, { status: 503 })
    }

    const { searchParams } = new URL(request.url)
    const limitParam = Number(searchParams.get('limit') || '10')
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(Math.floor(limitParam), 1), MAX_LIMIT)
      : 10

    const dateKey = parseDateParam(searchParams.get('date')) || getUtcDateKey()
    const includeAdmin = searchParams.get('includeAdmin') === 'true'

    let query = db.collection('page_visit_daily_summaries').where('date', '==', dateKey)
    if (!includeAdmin) {
      query = query.where('isAdmin', '==', false)
    }

    const [snapshot, contentSnapshot] = await Promise.all([
      query.get(),
      db.collection('content_view_daily').where('date', '==', dateKey).get()
    ])

    const aggregate = new Map<
      string,
      {
        path: string
        section: string
        totalViews: number
        lastViewAt: string | null
      }
    >()

    const sectionTotals = new Map<string, number>()
    const contentTotals = new Map<string, number>()
    const contentAggregate = new Map<
      string,
      {
        type: string
        id: string
        path: string
        totalViews: number
        lastViewAt: string | null
      }
    >()

    let totalViews = 0

    snapshot.docs.forEach((doc) => {
      const data = doc.data() || {}
      const path = typeof data.path === 'string' ? data.path : null
      if (!path) return

      const total = typeof data.totalViews === 'number' ? data.totalViews : 0
      const lastViewAt = timestampToISOString(data.lastViewAt)
      const section = resolveSection(path, typeof data.section === 'string' ? data.section : null)

      totalViews += total

      const existing = aggregate.get(path)
      if (!existing) {
        aggregate.set(path, { path, section, totalViews: total, lastViewAt })
      } else {
        existing.totalViews += total
        if (lastViewAt && (!existing.lastViewAt || lastViewAt > existing.lastViewAt)) {
          existing.lastViewAt = lastViewAt
        }
      }

      sectionTotals.set(section, (sectionTotals.get(section) || 0) + total)

    })

    contentSnapshot.docs.forEach((doc) => {
      const data = doc.data() || {}
      const rawType = typeof data.contentType === 'string' ? data.contentType : null
      const contentId = typeof data.contentId === 'string' ? data.contentId : null
      if (!rawType || !contentId) return

      const contentType = normalizeContentType(rawType)
      const total = typeof data.totalViews === 'number' ? data.totalViews : 0
      const lastViewAt = timestampToISOString(data.lastViewedAt)

      contentTotals.set(contentType, (contentTotals.get(contentType) || 0) + total)

      const key = `${rawType}:${contentId}`
      const existing = contentAggregate.get(key)
      if (!existing) {
        contentAggregate.set(key, {
          type: rawType,
          id: contentId,
          path: '',
          totalViews: total,
          lastViewAt,
        })
      } else {
        existing.totalViews += total
        if (lastViewAt && (!existing.lastViewAt || lastViewAt > existing.lastViewAt)) {
          existing.lastViewAt = lastViewAt
        }
      }
    })

    const topPages = Array.from(aggregate.values())
      .sort((a, b) => b.totalViews - a.totalViews)
      .slice(0, limit)

    const sectionBreakdown = Array.from(sectionTotals.entries())
      .map(([section, count]) => ({ section, count }))
      .sort((a, b) => b.count - a.count)

    const contentBreakdown = Array.from(contentTotals.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)

    const topContentRaw = Array.from(contentAggregate.values())
      .sort((a, b) => b.totalViews - a.totalViews)
      .slice(0, limit)

    const nameCache = new Map<string, string | null>()

    const topPagesWithNames = await Promise.all(
      topPages.map(async (item) => {
        if (nameCache.has(item.path)) {
          return { ...item, displayName: nameCache.get(item.path) }
        }

        const meta = parsePathMeta(item.path)
        let displayName: string | null = null

        try {
          if (meta.type === 'news') {
            const doc = await db.collection('news_articles').doc(meta.id).get()
            const data = doc.exists ? doc.data() : null
            displayName = data?.title || data?.titleJa || null
          } else if (meta.type === 'comics') {
            const doc = await db.collection('comics').doc(meta.id).get()
            const data = doc.exists ? doc.data() : null
            if (data?.title) {
              displayName = `Comics: ${data.title}`
            } else if (data?.episodeNumber) {
              displayName = `Comics: EP${String(data.episodeNumber).padStart(3, '0')}`
            }
          } else if (meta.type === 'stories') {
            const snapshot = await db
              .collection('stories')
              .where('slug', '==', meta.slug)
              .limit(1)
              .get()
            const storyDoc = snapshot.docs[0]
            const data = storyDoc?.data()
            displayName = data?.titleJa || data?.title || null
            if (displayName && data?.id) {
              displayName = `${displayName} ${String(data.id).slice(0, 8)}`
            }
          } else if (meta.type === 'library') {
            const doc = await db.collection('books').doc(meta.id).get()
            const data = doc.exists ? doc.data() : null
            displayName = data?.title || data?.titleJa || null
          }
        } catch (error) {
          console.warn('[daily-summary] Failed to resolve display name:', error)
        }

        if (!displayName) {
          const segments = stripLocale(item.path)
          if (segments.length === 0) {
            displayName = 'Home'
          } else {
            const [section, value] = segments
            if (section && value) {
              displayName = `${titleCase(section)}: ${titleCase(value)}`
            } else if (section) {
              displayName = titleCase(section)
            }
          }
        }

        nameCache.set(item.path, displayName)
        return { ...item, displayName }
      })
    )

    const topContent = await Promise.all(
      topContentRaw.map(async (item) => {
        const meta: PathMeta = item.type === 'news_articles'
          ? { type: 'news', id: item.id }
          : item.type === 'comics'
            ? { type: 'comics', id: item.id }
            : item.type === 'stories'
              ? { type: 'stories', slug: item.id }
              : item.type === 'books'
                ? { type: 'library', id: item.id }
                : { type: 'unknown' }
        let displayName: string | null = null

        try {
          if (meta.type === 'news') {
            const doc = await db.collection('news_articles').doc(item.id).get()
            const data = doc.exists ? doc.data() : null
            displayName = data?.title || data?.titleJa || null
          } else if (meta.type === 'comics') {
            const doc = await db.collection('comics').doc(item.id).get()
            const data = doc.exists ? doc.data() : null
            if (data?.title) {
              displayName = `Comics: ${data.title}`
            } else if (data?.episodeNumber) {
              displayName = `Comics: EP${String(data.episodeNumber).padStart(3, '0')}`
            }
          } else if (meta.type === 'stories') {
            const doc = await db.collection('stories').doc(item.id).get()
            const data = doc.exists ? doc.data() : null
            displayName = data?.titleJa || data?.title || null
            if (displayName && data?.id) {
              displayName = `${displayName} ${String(data.id).slice(0, 8)}`
            }
          } else if (meta.type === 'library') {
            const doc = await db.collection('books').doc(item.id).get()
            const data = doc.exists ? doc.data() : null
            displayName = data?.title || data?.titleJa || null
          }
        } catch (error) {
          console.warn('[daily-summary] Failed to resolve content display name:', error)
        }

        return {
          ...item,
          displayName: displayName || item.id,
          contentType: normalizeContentType(item.type),
        }
      })
    )

    return NextResponse.json({
      success: true,
      date: dateKey,
      timezone: 'UTC',
      totals: {
        totalViews,
      },
      sections: sectionBreakdown,
      contentTypes: contentBreakdown,
      topPages: topPagesWithNames,
      topContent,
    })
  } catch (error) {
    console.error('[API /admin/analytics/daily-summary] Error:', error)
    return NextResponse.json(
      { error: { message: 'Failed to fetch daily activity summary' } },
      { status: 500 }
    )
  }
})
