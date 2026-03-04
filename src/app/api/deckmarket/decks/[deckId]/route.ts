import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminFirestore } from '@/lib/firebase/admin'
import { DECKMARKET_COLLECTION, VERSIONS_SUBCOLLECTION } from '@/types/deckmarket'
import type { DeckDetailResponse, DeckMarketDeck, DeckMarketVersion } from '@/types/deckmarket'

function toIsoString(value: unknown): string {
  const date = (value as { toDate?: () => Date })?.toDate?.()
  return date ? date.toISOString() : ''
}

function toIsoStringOrNull(value: unknown): string | null {
  const date = (value as { toDate?: () => Date })?.toDate?.()
  return date ? date.toISOString() : null
}

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
      console.error('[DeckMarket] Firestore not initialized for detail request')
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

    const versionsSnapshot = await deckRef
      .collection(VERSIONS_SUBCOLLECTION)
      .orderBy('createdAt', 'desc')
      .get()

    const versions: DeckMarketVersion[] = versionsSnapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>
      return {
        id: doc.id,
        deckId,
        versionLabel: (data.versionLabel as string) || '',
        changelog: (data.changelog as string) || '',
        apkgR2Key: (data.apkgR2Key as string) || '',
        apkgFilename: (data.apkgFilename as string) || '',
        sizeBytes: (data.sizeBytes as number) || 0,
        csvR2Key: (data.csvR2Key as string | null) ?? null,
        csvFilename: (data.csvFilename as string | null) ?? null,
        csvSizeBytes: (data.csvSizeBytes as number | null) ?? null,
        sha256: (data.sha256 as string | null) ?? null,
        createdAt: toIsoString(data.createdAt),
        createdByUid: (data.createdByUid as string) || '',
      }
    })

    const latestVersionId = (deckData.latestVersionId as string | null) ?? null
    const latestVersion =
      latestVersionId ? versions.find((version) => version.id === latestVersionId) || null : null

    const deck: DeckMarketDeck = {
      id: deckSnap.id,
      title: (deckData.title as string) || '',
      description: (deckData.description as string) || '',
      hasNativeAudio: deckData.hasNativeAudio === true,
      language: (deckData.language as string) || 'ja',
      jlpt: (deckData.jlpt as string | null) ?? null,
      tags: (deckData.tags as string[]) || [],
      isPublished: true,
      latestVersionId,
      downloadCount: (deckData.downloadCount as number) || 0,
      lastDownloadAt: toIsoStringOrNull(deckData.lastDownloadAt),
      createdAt: toIsoString(deckData.createdAt),
      updatedAt: toIsoString(deckData.updatedAt),
    }

    return NextResponse.json({
      success: true,
      data: {
        deck,
        versions,
        latestVersion,
      },
    } as DeckDetailResponse)
  } catch (error) {
    console.error('[DeckMarket] GET /api/deckmarket/decks/[deckId] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch deck' },
      { status: 500 }
    )
  }
}
