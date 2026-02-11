import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'
import { adminFirestore, ensureAdminInitialized, FieldValue } from '@/lib/firebase/admin'
import { getR2Config } from '@/lib/r2/r2-client'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import {
  DECKMARKET_NOTES_COLLECTION,
  NOTES_VERSIONS_SUBCOLLECTION,
  DECK_LIMITS,
} from '@/types/deckmarket'
import type { DeckMarketNote, DeckMarketNoteVersion, UpdateNoteRequest } from '@/types/deckmarket'

function toIsoString(value: unknown): string {
  const date = (value as { toDate?: () => Date })?.toDate?.()
  return date ? date.toISOString() : ''
}

function toIsoStringOrNull(value: unknown): string | null {
  const date = (value as { toDate?: () => Date })?.toDate?.()
  return date ? date.toISOString() : null
}

export const GET = withAdminAuth(async (_request: NextRequest, context: AdminContext) => {
  try {
    ensureAdminInitialized()

    if (!adminFirestore) {
      throw new Error('Firebase Admin not initialized')
    }

    const noteId = context.params?.noteId
    if (!noteId) {
      return NextResponse.json({ error: 'Note ID is required' }, { status: 400 })
    }

    const noteRef = adminFirestore.collection(DECKMARKET_NOTES_COLLECTION).doc(noteId)
    const noteSnap = await noteRef.get()

    if (!noteSnap.exists) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    const noteData = noteSnap.data() as Record<string, unknown>
    const versionsSnapshot = await noteRef
      .collection(NOTES_VERSIONS_SUBCOLLECTION)
      .orderBy('createdAt', 'desc')
      .get()

    const versions: DeckMarketNoteVersion[] = versionsSnapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>
      return {
        id: doc.id,
        noteId,
        versionLabel: (data.versionLabel as string) || '',
        changelog: (data.changelog as string) || '',
        pdfR2Key: (data.pdfR2Key as string) || '',
        pdfFilename: (data.pdfFilename as string) || '',
        pdfSizeBytes: (data.pdfSizeBytes as number) || 0,
        mdR2Key: (data.mdR2Key as string) || '',
        mdFilename: (data.mdFilename as string) || '',
        mdSizeBytes: (data.mdSizeBytes as number) || 0,
        createdAt: toIsoString(data.createdAt),
        createdByUid: (data.createdByUid as string) || '',
      }
    })

    const latestVersionId = (noteData.latestVersionId as string | null) ?? null
    const latestVersion =
      latestVersionId ? versions.find((version) => version.id === latestVersionId) || null : null

    const note: DeckMarketNote = {
      id: noteSnap.id,
      title: (noteData.title as string) || '',
      description: (noteData.description as string) || '',
      language: (noteData.language as string) || 'ja',
      tags: (noteData.tags as string[]) || [],
      isPublished: (noteData.isPublished as boolean) || false,
      latestVersionId,
      downloadCount: (noteData.downloadCount as number) || 0,
      lastDownloadAt: toIsoStringOrNull(noteData.lastDownloadAt),
      createdAt: toIsoString(noteData.createdAt),
      updatedAt: toIsoString(noteData.updatedAt),
    }

    return NextResponse.json({
      success: true,
      data: {
        note,
        versions,
        latestVersion,
      },
    })
  } catch (error: any) {
    console.error('[API /admin/deckmarket/notes/[noteId]] GET Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch note' },
      { status: 500 }
    )
  }
})

export const PATCH = withAdminAuth(async (request: NextRequest, context: AdminContext) => {
  try {
    ensureAdminInitialized()

    if (!adminFirestore) {
      throw new Error('Firebase Admin not initialized')
    }

    const noteId = context.params?.noteId
    if (!noteId) {
      return NextResponse.json({ error: 'Note ID is required' }, { status: 400 })
    }

    const noteRef = adminFirestore.collection(DECKMARKET_NOTES_COLLECTION).doc(noteId)
    const noteSnap = await noteRef.get()

    if (!noteSnap.exists) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    const body = (await request.json()) as UpdateNoteRequest
    const updateData: Record<string, unknown> = {}

    if (body.title !== undefined) {
      if (!body.title || !body.title.trim()) {
        return NextResponse.json({ error: 'Title is required' }, { status: 400 })
      }
      if (body.title.trim().length > DECK_LIMITS.TITLE_MAX) {
        return NextResponse.json(
          { error: `Title must be ${DECK_LIMITS.TITLE_MAX} characters or less` },
          { status: 400 }
        )
      }
      updateData.title = body.title.trim()
    }

    if (body.description !== undefined) {
      if (typeof body.description !== 'string') {
        return NextResponse.json({ error: 'Description must be a string' }, { status: 400 })
      }
      if (body.description.length > DECK_LIMITS.DESCRIPTION_MAX) {
        return NextResponse.json(
          { error: `Description must be ${DECK_LIMITS.DESCRIPTION_MAX} characters or less` },
          { status: 400 }
        )
      }
      updateData.description = body.description
    }

    if (body.tags !== undefined) {
      if (!Array.isArray(body.tags)) {
        return NextResponse.json({ error: 'Tags must be an array' }, { status: 400 })
      }
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
      updateData.tags = body.tags
    }

    if (body.language !== undefined) {
      if (!body.language || typeof body.language !== 'string') {
        return NextResponse.json({ error: 'Language must be a string' }, { status: 400 })
      }
      updateData.language = body.language
    }

    if (body.isPublished !== undefined) {
      updateData.isPublished = body.isPublished
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
    }

    updateData.updatedAt = FieldValue.serverTimestamp()

    await noteRef.update(updateData)

    return NextResponse.json({ success: true, data: { id: noteId } })
  } catch (error: any) {
    console.error('[API /admin/deckmarket/notes/[noteId]] PATCH Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update note' },
      { status: 500 }
    )
  }
})

export const DELETE = withAdminAuth(async (_request: NextRequest, context: AdminContext) => {
  try {
    ensureAdminInitialized()

    if (!adminFirestore) {
      throw new Error('Firebase Admin not initialized')
    }

    const noteId = context.params?.noteId
    if (!noteId) {
      return NextResponse.json({ error: 'Note ID is required' }, { status: 400 })
    }

    const noteRef = adminFirestore.collection(DECKMARKET_NOTES_COLLECTION).doc(noteId)
    const noteSnap = await noteRef.get()

    if (!noteSnap.exists) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    const versionsSnapshot = await noteRef.collection(NOTES_VERSIONS_SUBCOLLECTION).get()
    const { client, bucket } = getR2Config()

    for (const doc of versionsSnapshot.docs) {
      const data = doc.data() as Record<string, unknown>
      const pdfR2Key = (data.pdfR2Key as string) || ''
      const mdR2Key = (data.mdR2Key as string) || ''

      if (pdfR2Key) {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: pdfR2Key }))
      }
      if (mdR2Key) {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: mdR2Key }))
      }

      await doc.ref.delete()
    }

    await noteRef.delete()

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[API /admin/deckmarket/notes/[noteId]] DELETE Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete note' },
      { status: 500 }
    )
  }
})
