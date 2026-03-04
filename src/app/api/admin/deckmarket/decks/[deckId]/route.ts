import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'
import { adminFirestore, ensureAdminInitialized, FieldValue } from '@/lib/firebase/admin'
import { getR2Config } from '@/lib/r2/r2-client'
import { isValidDeckKey } from '@/lib/r2/r2-keys'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { DECKMARKET_COLLECTION, VERSIONS_SUBCOLLECTION, DECK_LIMITS } from '@/types/deckmarket'
import type { DeckMarketDeck, DeckMarketVersion, UpdateDeckRequest } from '@/types/deckmarket'

function toIsoString(value: any): string | null {
  return value?.toDate?.()?.toISOString() || null
}

function serializeDeck(deckId: string, data: any): DeckMarketDeck {
  return {
    id: deckId,
    title: data.title || '',
    description: data.description || '',
    hasNativeAudio: data.hasNativeAudio === true,
    language: data.language || 'ja',
    jlpt: data.jlpt ?? null,
    tags: data.tags || [],
    isPublished: !!data.isPublished,
    latestVersionId: data.latestVersionId || null,
    downloadCount: data.downloadCount || 0,
    lastDownloadAt: toIsoString(data.lastDownloadAt),
    createdAt: toIsoString(data.createdAt) || '',
    updatedAt: toIsoString(data.updatedAt) || '',
  }
}

function serializeVersion(versionId: string, data: any): DeckMarketVersion {
  return {
    id: versionId,
    deckId: data.deckId || '',
    versionLabel: data.versionLabel || '',
    changelog: data.changelog || '',
    apkgR2Key: data.apkgR2Key || '',
    apkgFilename: data.apkgFilename || '',
    sizeBytes: data.sizeBytes || 0,
    csvR2Key: data.csvR2Key ?? null,
    csvFilename: data.csvFilename ?? null,
    csvSizeBytes: data.csvSizeBytes ?? null,
    sha256: data.sha256 ?? null,
    createdAt: toIsoString(data.createdAt) || '',
    createdByUid: data.createdByUid || '',
  }
}

/**
 * GET - Deck detail (admin view)
 */
export const GET = withAdminAuth(async (_request: NextRequest, context: AdminContext) => {
  try {
    ensureAdminInitialized()

    if (!adminFirestore) {
      throw new Error('Firebase Admin not initialized')
    }

    const deckId = context.params?.deckId
    if (!deckId) {
      return NextResponse.json({ error: 'Deck ID is required' }, { status: 400 })
    }

    const deckDoc = await adminFirestore.collection(DECKMARKET_COLLECTION).doc(deckId).get()
    if (!deckDoc.exists) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    const deckData = serializeDeck(deckId, deckDoc.data())

    const versionsSnapshot = await adminFirestore
      .collection(DECKMARKET_COLLECTION)
      .doc(deckId)
      .collection(VERSIONS_SUBCOLLECTION)
      .orderBy('createdAt', 'desc')
      .get()

    const versions: DeckMarketVersion[] = versionsSnapshot.docs.map((doc) =>
      serializeVersion(doc.id, doc.data())
    )

    const latestVersion = deckData.latestVersionId
      ? versions.find((version) => version.id === deckData.latestVersionId) || null
      : null

    return NextResponse.json({
      success: true,
      data: {
        deck: deckData,
        versions,
        latestVersion,
      },
    })
  } catch (error: any) {
    console.error('[API /admin/deckmarket/decks/[deckId]] GET Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch deck' },
      { status: 500 }
    )
  }
})

/**
 * PATCH - Update deck metadata + publish toggle
 */
export const PATCH = withAdminAuth(async (request: NextRequest, context: AdminContext) => {
  try {
    ensureAdminInitialized()

    if (!adminFirestore) {
      throw new Error('Firebase Admin not initialized')
    }

    const deckId = context.params?.deckId
    if (!deckId) {
      return NextResponse.json({ error: 'Deck ID is required' }, { status: 400 })
    }

    const deckRef = adminFirestore.collection(DECKMARKET_COLLECTION).doc(deckId)
    const deckDoc = await deckRef.get()

    if (!deckDoc.exists) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    const body = (await request.json()) as UpdateDeckRequest

    if (typeof body.title === 'string' && body.title.trim().length > DECK_LIMITS.TITLE_MAX) {
      return NextResponse.json(
        { error: `Title must be ${DECK_LIMITS.TITLE_MAX} characters or less` },
        { status: 400 }
      )
    }

    if (
      typeof body.description === 'string' &&
      body.description.length > DECK_LIMITS.DESCRIPTION_MAX
    ) {
      return NextResponse.json(
        { error: `Description must be ${DECK_LIMITS.DESCRIPTION_MAX} characters or less` },
        { status: 400 }
      )
    }

    if (Array.isArray(body.tags)) {
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

    if (typeof body.hasNativeAudio !== 'undefined' && typeof body.hasNativeAudio !== 'boolean') {
      return NextResponse.json({ error: 'hasNativeAudio must be a boolean' }, { status: 400 })
    }

    const updateData: Record<string, any> = {}

    if (typeof body.title === 'string') updateData.title = body.title
    if (typeof body.description === 'string') updateData.description = body.description
    if (typeof body.language === 'string') updateData.language = body.language
    if (typeof body.jlpt !== 'undefined') updateData.jlpt = body.jlpt
    if (Array.isArray(body.tags)) updateData.tags = body.tags
    if (typeof body.hasNativeAudio === 'boolean') updateData.hasNativeAudio = body.hasNativeAudio
    if (typeof body.isPublished === 'boolean') updateData.isPublished = body.isPublished

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    updateData.updatedAt = FieldValue.serverTimestamp()

    await deckRef.update(updateData)

    return NextResponse.json({ success: true, data: { id: deckId } })
  } catch (error: any) {
    console.error('[API /admin/deckmarket/decks/[deckId]] PATCH Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update deck' },
      { status: 500 }
    )
  }
})

/**
 * DELETE - Remove a deck and all versions
 */
export const DELETE = withAdminAuth(async (_request: NextRequest, context: AdminContext) => {
  try {
    ensureAdminInitialized()

    if (!adminFirestore) {
      throw new Error('Firebase Admin not initialized')
    }

    const deckId = context.params?.deckId
    if (!deckId) {
      return NextResponse.json({ error: 'Deck ID is required' }, { status: 400 })
    }

    const deckRef = adminFirestore.collection(DECKMARKET_COLLECTION).doc(deckId)
    const deckDoc = await deckRef.get()

    if (!deckDoc.exists) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    const versionsSnapshot = await deckRef.collection(VERSIONS_SUBCOLLECTION).get()
    const prefix = `deckmarket/${deckId}/`
    const r2Keys: string[] = []

    versionsSnapshot.docs.forEach((doc) => {
      const data = doc.data()
      if (data?.apkgR2Key) {
        if (!isValidDeckKey(data.apkgR2Key, prefix)) {
          throw new Error('Invalid R2 key')
        }
        r2Keys.push(data.apkgR2Key)
      }
      if (data?.csvR2Key) {
        if (!isValidDeckKey(data.csvR2Key, prefix)) {
          throw new Error('Invalid R2 key')
        }
        r2Keys.push(data.csvR2Key)
      }
    })

    const coverR2Key = deckDoc.data()?.coverR2Key
    if (coverR2Key) {
      if (!isValidDeckKey(coverR2Key, prefix)) {
        throw new Error('Invalid R2 key')
      }
      r2Keys.push(coverR2Key)
    }

    if (r2Keys.length > 0) {
      const { client, bucket } = getR2Config()
      for (const key of r2Keys) {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
      }
    }

    let batch = adminFirestore.batch()
    let batchCount = 0

    for (const versionDoc of versionsSnapshot.docs) {
      batch.delete(versionDoc.ref)
      batchCount += 1
      if (batchCount >= 400) {
        await batch.commit()
        batch = adminFirestore.batch()
        batchCount = 0
      }
    }

    if (batchCount > 0) {
      await batch.commit()
    }

    await deckRef.delete()

    return NextResponse.json({ success: true })
  } catch (error: any) {
    const message = error?.message || 'Failed to delete deck'
    const status = message === 'Invalid R2 key' ? 400 : 500
    console.error('[API /admin/deckmarket/decks/[deckId]] DELETE Error:', error)
    return NextResponse.json({ error: message }, { status })
  }
})
