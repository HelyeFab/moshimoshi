import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/admin/adminAuth'
import { adminFirestore } from '@/lib/firebase/admin'
import { timestampToISOString } from '@/lib/utils/date-formatters'

const MAX_LIMIT = 200

type PathMeta =
  | { type: 'news'; id: string }
  | { type: 'comics'; id: string }
  | { type: 'stories'; slug: string }
  | { type: 'library'; id: string }
  | { type: 'unknown' }

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

export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    const db = adminFirestore
    if (!db) {
      return NextResponse.json({ error: { message: 'Database not available' } }, { status: 503 })
    }

    const { searchParams } = new URL(request.url)
    const limitParam = Number(searchParams.get('limit') || '50')
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(Math.floor(limitParam), 1), MAX_LIMIT)
      : 50

    const snapshot = await db
      .collection('page_visit_summaries')
      .orderBy('totalViews', 'desc')
      .limit(limit)
      .get()

    const rawItems = snapshot.docs.map((doc) => {
      const data = doc.data() || {}
      return {
        id: doc.id,
        path: data.path || null,
        totalViews: typeof data.totalViews === 'number' ? data.totalViews : 0,
        lastViewAt: timestampToISOString(data.lastViewAt),
      }
    })

    const nameCache = new Map<string, string | null>()

    const items = await Promise.all(
      rawItems.map(async (item) => {
        if (!item.path) return { ...item, displayName: null }
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
          console.warn('[page-visit-summaries] Failed to resolve display name:', error)
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

    return NextResponse.json({ success: true, items })
  } catch (error) {
    console.error('[API /admin/analytics/page-visit-summaries] Error:', error)
    return NextResponse.json(
      { error: { message: 'Failed to fetch page visit summaries' } },
      { status: 500 }
    )
  }
})
