import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'
import { adminFirestore, ensureAdminInitialized, FieldValue } from '@/lib/firebase/admin'
import {
  DECKMARKET_COLLECTION,
  JLPT_LEVELS,
  DECK_LIMITS,
} from '@/types/deckmarket'
import type { CreateDeckRequest, DeckListItem } from '@/types/deckmarket'

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/

function toIsoString(value: any): string | null {
  return value?.toDate?.()?.toISOString() || null
}

function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
}

function isValidSlug(slug: string): boolean {
  return slug.length >= 3 && SLUG_REGEX.test(slug)
}

function isValidJlpt(value: string | null | undefined): boolean {
  if (value == null) return true
  return (JLPT_LEVELS as readonly string[]).includes(value)
}

/**
 * GET - List all DeckMarket decks (published + drafts)
 */
export const GET = withAdminAuth(async (request: NextRequest, _context: AdminContext) => {
  try {
    ensureAdminInitialized()

    if (!adminFirestore) {
      throw new Error('Firebase Admin not initialized')
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim().toLowerCase() || ''
    const publishedParam = searchParams.get('published')

    let query: FirebaseFirestore.Query = adminFirestore.collection(DECKMARKET_COLLECTION)

    if (publishedParam === 'true') {
      query = query.where('isPublished', '==', true)
    } else if (publishedParam === 'false') {
      query = query.where('isPublished', '==', false)
    }

    query = query.orderBy('updatedAt', 'desc')

    const snapshot = await query.get()

    let items: Array<DeckListItem & { isPublished: boolean }> = snapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        title: data.title || '',
        description: data.description || '',
        tags: data.tags || [],
        jlpt: data.jlpt ?? null,
        language: data.language || 'ja',
        downloadCount: data.downloadCount || 0,
        updatedAt: toIsoString(data.updatedAt) || '',
        isPublished: !!data.isPublished,
      }
    })

    if (search) {
      items = items.filter((item) => {
        const haystack = `${item.title} ${item.description}`.toLowerCase()
        return haystack.includes(search)
      })
    }

    return NextResponse.json({ success: true, data: items })
  } catch (error: any) {
    console.error('[API /admin/deckmarket/decks] GET Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch decks' },
      { status: 500 }
    )
  }
})

/**
 * POST - Create a new DeckMarket deck
 */
export const POST = withAdminAuth(async (request: NextRequest, _context: AdminContext) => {
  try {
    ensureAdminInitialized()

    if (!adminFirestore) {
      throw new Error('Firebase Admin not initialized')
    }

    const body = (await request.json()) as CreateDeckRequest

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
      if (body.tags.some((tag: string) => typeof tag !== 'string' || tag.length > DECK_LIMITS.TAG_MAX_LENGTH)) {
        return NextResponse.json(
          { error: `Each tag must be ${DECK_LIMITS.TAG_MAX_LENGTH} characters or less` },
          { status: 400 }
        )
      }
    }

    if (!isValidJlpt(body.jlpt)) {
      return NextResponse.json({ error: 'Invalid JLPT level' }, { status: 400 })
    }

    if (typeof body.hasNativeAudio !== 'undefined' && typeof body.hasNativeAudio !== 'boolean') {
      return NextResponse.json({ error: 'hasNativeAudio must be a boolean' }, { status: 400 })
    }

    const slug = body.id ? body.id.trim() : normalizeSlug(body.title)

    if (!isValidSlug(slug)) {
      return NextResponse.json(
        { error: 'Invalid slug. Use lowercase letters, numbers, and hyphens (min 3 chars).' },
        { status: 400 }
      )
    }

    const existing = await adminFirestore.collection(DECKMARKET_COLLECTION).doc(slug).get()
    if (existing.exists) {
      return NextResponse.json({ error: 'Deck ID already exists' }, { status: 400 })
    }

    await adminFirestore.collection(DECKMARKET_COLLECTION).doc(slug).set({
      id: slug,
      title: body.title.trim(),
      description: body.description || '',
      hasNativeAudio: body.hasNativeAudio === true,
      language: body.language || 'ja',
      jlpt: body.jlpt || null,
      tags: body.tags || [],
      isPublished: false,
      latestVersionId: null,
      downloadCount: 0,
      lastDownloadAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({ success: true, data: { id: slug } })
  } catch (error: any) {
    console.error('[API /admin/deckmarket/decks] POST Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create deck' },
      { status: 500 }
    )
  }
})
