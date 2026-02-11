import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminFirestore } from '@/lib/firebase/admin'
import { getR2Config } from '@/lib/r2/r2-client'
import { isValidDeckKey } from '@/lib/r2/r2-keys'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { DECKMARKET_COLLECTION, VERSIONS_SUBCOLLECTION } from '@/types/deckmarket'
import type { DeckPreviewResponse, DeckPreviewFormat } from '@/types/deckmarket'

const PREVIEW_TTL_SECONDS = 300

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!adminFirestore) {
      console.error('[DeckMarket] Firestore not initialized for preview request')
      return NextResponse.json({ error: 'Firestore not initialized' }, { status: 500 })
    }

    const { deckId } = await params
    const deckRef = adminFirestore.collection(DECKMARKET_COLLECTION).doc(deckId)
    const deckSnap = await deckRef.get()

    if (!deckSnap.exists) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    const deckData = deckSnap.data() as Record<string, unknown>
    if (!deckData?.isPublished) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    const latestVersionId = (deckData.latestVersionId as string | null) ?? null
    if (!latestVersionId) {
      return NextResponse.json({ error: 'No version available' }, { status: 404 })
    }

    const versionSnap = await deckRef
      .collection(VERSIONS_SUBCOLLECTION)
      .doc(latestVersionId)
      .get()

    if (!versionSnap.exists) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }

    const versionData = versionSnap.data() as Record<string, unknown>
    const apkgR2Key = (versionData.apkgR2Key as string) || ''
    const csvR2Key = (versionData.csvR2Key as string | null) ?? null
    const format: DeckPreviewFormat = csvR2Key ? 'csv' : 'apkg'
    const r2Key = format === 'csv' ? csvR2Key : apkgR2Key
    const filename =
      format === 'csv'
        ? (versionData.csvFilename as string | null) || 'deck.csv'
        : (versionData.apkgFilename as string) || 'deck.apkg'
    const sizeBytes =
      format === 'csv'
        ? (versionData.csvSizeBytes as number | null) || 0
        : (versionData.sizeBytes as number) || 0
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
    const downloadUrl = await getSignedUrl(client, command, { expiresIn: PREVIEW_TTL_SECONDS })

    return NextResponse.json({
      success: true,
      format,
      downloadUrl,
      filename,
      sizeBytes,
      expiresIn: PREVIEW_TTL_SECONDS,
    } as DeckPreviewResponse)
  } catch (error) {
    console.error('[DeckMarket] GET /api/deckmarket/decks/[deckId]/preview error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate preview' },
      { status: 500 }
    )
  }
}
