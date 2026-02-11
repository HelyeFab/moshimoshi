import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminFirestore } from '@/lib/firebase/admin'
import {
  DECKMARKET_NOTES_COLLECTION,
  NOTES_VERSIONS_SUBCOLLECTION,
} from '@/types/deckmarket'
import type {
  DeckMarketNote,
  DeckMarketNoteVersion,
  NoteDetailResponse,
} from '@/types/deckmarket'

function toIsoString(value: unknown): string {
  const date = (value as { toDate?: () => Date })?.toDate?.()
  return date ? date.toISOString() : ''
}

function toIsoStringOrNull(value: unknown): string | null {
  const date = (value as { toDate?: () => Date })?.toDate?.()
  return date ? date.toISOString() : null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!adminFirestore) {
      console.error('[DeckMarket] Firestore not initialized for notes detail')
      return NextResponse.json({ error: 'Firestore not initialized' }, { status: 500 })
    }

    const { noteId } = await params
    const noteRef = adminFirestore.collection(DECKMARKET_NOTES_COLLECTION).doc(noteId)
    const noteSnap = await noteRef.get()

    if (!noteSnap.exists) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    const noteData = noteSnap.data() as Record<string, unknown>
    if (!noteData?.isPublished) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

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
      isPublished: true,
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
    } as NoteDetailResponse)
  } catch (error) {
    console.error('[DeckMarket] GET /api/deckmarket/notes/[noteId] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch note' },
      { status: 500 }
    )
  }
}
