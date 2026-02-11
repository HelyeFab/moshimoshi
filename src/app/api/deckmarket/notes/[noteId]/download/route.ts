import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminFirestore, FieldValue } from '@/lib/firebase/admin'
import { rateLimitMiddleware } from '@/lib/api/rate-limiter'
import { getR2Config } from '@/lib/r2/r2-client'
import { isValidDeckKey } from '@/lib/r2/r2-keys'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { DECKMARKET_NOTES_COLLECTION, NOTES_VERSIONS_SUBCOLLECTION } from '@/types/deckmarket'
import type { DeckDownloadResponse } from '@/types/deckmarket'

const DOWNLOAD_TTL_SECONDS = 3600

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rateLimitResult = await rateLimitMiddleware(request, {
      category: 'deckmarket',
      endpoint: 'download',
      tier: 'free',
    })
    if (rateLimitResult) return rateLimitResult

    if (!adminFirestore) {
      console.error('[DeckMarket] Firestore not initialized for notes download')
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

    const latestVersionId = (noteData.latestVersionId as string | null) ?? null
    if (!latestVersionId) {
      return NextResponse.json({ error: 'No version available' }, { status: 404 })
    }

    const versionSnap = await noteRef
      .collection(NOTES_VERSIONS_SUBCOLLECTION)
      .doc(latestVersionId)
      .get()

    if (!versionSnap.exists) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }

    const versionData = versionSnap.data() as Record<string, unknown>
    const pdfR2Key = (versionData.pdfR2Key as string) || ''
    const pdfFilename = (versionData.pdfFilename as string) || 'lesson-notes.pdf'
    const pdfSizeBytes = (versionData.pdfSizeBytes as number) || 0

    if (!pdfR2Key) {
      return NextResponse.json({ error: 'File not available' }, { status: 404 })
    }

    const prefix = `deckmarket/notes/${noteId}/`
    if (!isValidDeckKey(pdfR2Key, prefix)) {
      return NextResponse.json({ error: 'Invalid R2 key' }, { status: 400 })
    }

    const { client, bucket } = getR2Config()
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: pdfR2Key,
      ResponseContentType: 'application/pdf',
    })
    const downloadUrl = await getSignedUrl(client, command, { expiresIn: DOWNLOAD_TTL_SECONDS })

    await noteRef.update({
      downloadCount: FieldValue.increment(1),
      lastDownloadAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({
      success: true,
      downloadUrl,
      filename: pdfFilename,
      sizeBytes: pdfSizeBytes,
      expiresIn: DOWNLOAD_TTL_SECONDS,
    } as DeckDownloadResponse)
  } catch (error) {
    console.error('[DeckMarket] GET /api/deckmarket/notes/[noteId]/download error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate download URL' },
      { status: 500 }
    )
  }
}
