import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminFirestore } from '@/lib/firebase/admin'
import { DECKMARKET_NOTES_COLLECTION } from '@/types/deckmarket'
import type { NoteListItem, NoteListResponse } from '@/types/deckmarket'

function toIsoString(value: unknown): string {
  const date = (value as { toDate?: () => Date })?.toDate?.()
  return date ? date.toISOString() : ''
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!adminFirestore) {
      console.error('[DeckMarket] Firestore not initialized for notes list')
      return NextResponse.json({ error: 'Firestore not initialized' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(searchParams.get('pageSize') || '20', 10)))
    const search = searchParams.get('search')?.trim() || ''

    let baseQuery = adminFirestore
      .collection(DECKMARKET_NOTES_COLLECTION)
      .where('isPublished', '==', true)
      .orderBy('updatedAt', 'desc')
    const hasSearch = search.length > 0
    const fetchLimit = hasSearch ? 100 : pageSize
    const offset = (page - 1) * pageSize

    let query = baseQuery
    if (!hasSearch) {
      query = query.offset(offset).limit(fetchLimit)
    } else {
      query = query.limit(fetchLimit)
    }

    const snapshot = await query.get()
    const allItems: NoteListItem[] = snapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>
      return {
        id: doc.id,
        title: (data.title as string) || '',
        description: (data.description as string) || '',
        tags: (data.tags as string[]) || [],
        language: (data.language as string) || 'ja',
        downloadCount: (data.downloadCount as number) || 0,
        updatedAt: toIsoString(data.updatedAt),
      }
    })

    let items = allItems
    let total = allItems.length

    if (hasSearch) {
      const needle = search.toLowerCase()
      const filtered = allItems.filter((item) => {
        const title = item.title.toLowerCase()
        const description = item.description.toLowerCase()
        return title.includes(needle) || description.includes(needle)
      })
      total = filtered.length
      items = filtered.slice(offset, offset + pageSize)
    } else {
      try {
        const countSnapshot = await baseQuery.count().get()
        total = countSnapshot.data().count
      } catch {
        total = allItems.length
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        items,
        page,
        pageSize,
        total,
      },
    } as NoteListResponse)
  } catch (error) {
    console.error('[DeckMarket] GET /api/deckmarket/notes error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch notes' },
      { status: 500 }
    )
  }
}
