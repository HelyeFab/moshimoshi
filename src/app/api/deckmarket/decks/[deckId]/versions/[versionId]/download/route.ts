import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminFirestore, FieldValue } from '@/lib/firebase/admin'
import { rateLimitMiddleware } from '@/lib/api/rate-limiter'
import { getR2Config } from '@/lib/r2/r2-client'
import { isValidDeckKey } from '@/lib/r2/r2-keys'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { DECKMARKET_COLLECTION, VERSIONS_SUBCOLLECTION } from '@/types/deckmarket'
import type { DeckDownloadResponse } from '@/types/deckmarket'

const DOWNLOAD_TTL_SECONDS = 3600

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string; versionId: string }> }
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
      console.error('[DeckMarket] Firestore not initialized for version download request')
      return NextResponse.json({ error: 'Firestore not initialized' }, { status: 500 })
    }

    const { deckId, versionId } = await params
    const { searchParams } = new URL(request.url)
    const format = (searchParams.get('format') || 'apkg').toLowerCase()
    if (format !== 'apkg' && format !== 'csv') {
      return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
    }
    const deckRef = adminFirestore.collection(DECKMARKET_COLLECTION).doc(deckId)
    const deckSnap = await deckRef.get()

    if (!deckSnap.exists) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    const deckData = deckSnap.data() as Record<string, unknown>
    if (!deckData?.isPublished) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    const versionSnap = await deckRef
      .collection(VERSIONS_SUBCOLLECTION)
      .doc(versionId)
      .get()

    if (!versionSnap.exists) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }

    const versionData = versionSnap.data() as Record<string, unknown>
    const apkgR2Key = (versionData.apkgR2Key as string) || ''
    const csvR2Key = (versionData.csvR2Key as string | null) ?? null
    const csvFilename = (versionData.csvFilename as string | null) ?? null
    const csvSizeBytes = (versionData.csvSizeBytes as number | null) ?? null
    const r2Key = format === 'csv' ? csvR2Key : apkgR2Key
    const filename = format === 'csv' ? csvFilename : (versionData.apkgFilename as string) || 'deck.apkg'
    const sizeBytes = format === 'csv' ? csvSizeBytes : (versionData.sizeBytes as number) || 0
    const contentType = format === 'csv' ? 'text/csv' : 'application/octet-stream'

    if (!r2Key) {
      return NextResponse.json({ error: 'File not available' }, { status: 404 })
    }

    const prefix = `deckmarket/${deckId}/`
    if (!isValidDeckKey(r2Key, prefix)) {
      return NextResponse.json({ error: 'Invalid R2 key' }, { status: 400 })
    }

    const { client, bucket } = getR2Config()
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: r2Key,
      ResponseContentType: contentType,
    })
    const downloadUrl = await getSignedUrl(client, command, { expiresIn: DOWNLOAD_TTL_SECONDS })

    await deckRef.update({
      downloadCount: FieldValue.increment(1),
      lastDownloadAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({
      success: true,
      downloadUrl,
      filename: filename || (format === 'csv' ? 'deck.csv' : 'deck.apkg'),
      sizeBytes: sizeBytes || 0,
      expiresIn: DOWNLOAD_TTL_SECONDS,
    } as DeckDownloadResponse)
  } catch (error) {
    console.error(
      '[DeckMarket] GET /api/deckmarket/decks/[deckId]/versions/[versionId]/download error:',
      error
    )
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate download URL' },
      { status: 500 }
    )
  }
}
