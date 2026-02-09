import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'
import { adminFirestore, ensureAdminInitialized, FieldValue } from '@/lib/firebase/admin'
import { getR2Config } from '@/lib/r2/r2-client'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { DECKMARKET_COLLECTION, VERSIONS_SUBCOLLECTION } from '@/types/deckmarket'

/**
 * DELETE - Remove a deck version (R2 object + Firestore doc)
 */
export const DELETE = withAdminAuth(async (_request: NextRequest, context: AdminContext) => {
  try {
    ensureAdminInitialized()

    if (!adminFirestore) {
      throw new Error('Firebase Admin not initialized')
    }

    const deckId = context.params?.deckId
    const versionId = context.params?.versionId

    if (!deckId || !versionId) {
      return NextResponse.json({ error: 'Deck ID and version ID are required' }, { status: 400 })
    }

    const deckRef = adminFirestore.collection(DECKMARKET_COLLECTION).doc(deckId)
    const deckDoc = await deckRef.get()

    if (!deckDoc.exists) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    const versionRef = deckRef.collection(VERSIONS_SUBCOLLECTION).doc(versionId)
    const versionDoc = await versionRef.get()

    if (!versionDoc.exists) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }

    const versionData = versionDoc.data()
    const r2Key = versionData?.apkgR2Key
    const csvKey = versionData?.csvR2Key

    if (r2Key || csvKey) {
      const { client, bucket } = getR2Config()
      if (r2Key) {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: r2Key }))
      }
      if (csvKey) {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: csvKey }))
      }
    }

    await versionRef.delete()

    const latestVersionId = deckDoc.data()?.latestVersionId
    if (latestVersionId === versionId) {
      const latestSnapshot = await deckRef
        .collection(VERSIONS_SUBCOLLECTION)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get()

      const nextLatest = latestSnapshot.docs[0]?.id || null

      await deckRef.update({
        latestVersionId: nextLatest,
        updatedAt: FieldValue.serverTimestamp(),
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[API /admin/deckmarket/decks/[deckId]/versions/[versionId]] DELETE Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete version' },
      { status: 500 }
    )
  }
})
