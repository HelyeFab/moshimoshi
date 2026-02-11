import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'
import { adminFirestore, ensureAdminInitialized, FieldValue } from '@/lib/firebase/admin'
import {
  DECKMARKET_NOTES_COLLECTION,
  DECK_LIMITS,
} from '@/types/deckmarket'
import type { CreateNoteRequest } from '@/types/deckmarket'

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function toIsoString(value: unknown): string {
  const date = (value as { toDate?: () => Date })?.toDate?.()
  return date ? date.toISOString() : ''
}

export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    ensureAdminInitialized()

    if (!adminFirestore) {
      throw new Error('Firebase Admin not initialized')
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.toLowerCase().trim() || ''
    const publishedParam = searchParams.get('published')

    let query = adminFirestore
      .collection(DECKMARKET_NOTES_COLLECTION)
      .orderBy('updatedAt', 'desc')

    if (publishedParam === 'true') {
      query = query.where('isPublished', '==', true)
    } else if (publishedParam === 'false') {
      query = query.where('isPublished', '==', false)
    }

    const snapshot = await query.get()
    let items = snapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>
      return {
        id: doc.id,
        title: (data.title as string) || '',
        description: (data.description as string) || '',
        tags: (data.tags as string[]) || [],
        language: (data.language as string) || 'ja',
        downloadCount: (data.downloadCount as number) || 0,
        updatedAt: toIsoString(data.updatedAt),
        isPublished: (data.isPublished as boolean) || false,
      }
    })

    if (search) {
      items = items.filter((item) =>
        item.title.toLowerCase().includes(search) ||
        item.description.toLowerCase().includes(search)
      )
    }

    return NextResponse.json({ success: true, data: items })
  } catch (error: any) {
    console.error('[API /admin/deckmarket/notes] GET Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch notes' },
      { status: 500 }
    )
  }
})

export const POST = withAdminAuth(async (request: NextRequest, context: AdminContext) => {
  try {
    ensureAdminInitialized()

    if (!adminFirestore) {
      throw new Error('Firebase Admin not initialized')
    }

    const body = (await request.json()) as CreateNoteRequest

    if (!body?.title || typeof body.title !== 'string' || !body.title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    if (body.title.trim().length > DECK_LIMITS.TITLE_MAX) {
      return NextResponse.json(
        { error: `Title must be ${DECK_LIMITS.TITLE_MAX} characters or less` },
        { status: 400 }
      )
    }

    if (
      body.description &&
      typeof body.description === 'string' &&
      body.description.length > DECK_LIMITS.DESCRIPTION_MAX
    ) {
      return NextResponse.json(
        { error: `Description must be ${DECK_LIMITS.DESCRIPTION_MAX} characters or less` },
        { status: 400 }
      )
    }

    if (body.tags && Array.isArray(body.tags)) {
      if (body.tags.length > DECK_LIMITS.TAGS_MAX_COUNT) {
        return NextResponse.json(
          { error: `Maximum ${DECK_LIMITS.TAGS_MAX_COUNT} tags allowed` },
          { status: 400 }
        )
      }
      if (body.tags.some((tag) => typeof tag !== 'string' || tag.length > DECK_LIMITS.TAG_MAX_LENGTH)) {
        return NextResponse.json(
          { error: `Each tag must be ${DECK_LIMITS.TAG_MAX_LENGTH} characters or less` },
          { status: 400 }
        )
      }
    }

    const slug = body.id ? body.id.trim() : generateSlug(body.title)
    if (!slug || !SLUG_REGEX.test(slug)) {
      return NextResponse.json({ error: 'Invalid slug format' }, { status: 400 })
    }

    const existing = await adminFirestore.collection(DECKMARKET_NOTES_COLLECTION).doc(slug).get()
    if (existing.exists) {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 400 })
    }

    await adminFirestore.collection(DECKMARKET_NOTES_COLLECTION).doc(slug).set({
      id: slug,
      title: body.title.trim(),
      description: body.description || '',
      language: body.language || 'ja',
      tags: body.tags || [],
      isPublished: false,
      latestVersionId: null,
      downloadCount: 0,
      lastDownloadAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdByUid: context.user.uid,
    })

    return NextResponse.json({ success: true, data: { id: slug } })
  } catch (error: any) {
    console.error('[API /admin/deckmarket/notes] POST Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create note' },
      { status: 500 }
    )
  }
})
