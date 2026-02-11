import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'
import { adminFirestore, ensureAdminInitialized, FieldValue } from '@/lib/firebase/admin'
import { getR2Config } from '@/lib/r2/r2-client'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import {
  DECKMARKET_NOTES_COLLECTION,
  NOTES_VERSIONS_SUBCOLLECTION,
} from '@/types/deckmarket'

export const DELETE = withAdminAuth(async (_request: NextRequest, context: AdminContext) => {
  try {
    ensureAdminInitialized()

    if (!adminFirestore) {
      throw new Error('Firebase Admin not initialized')
    }

    const noteId = context.params?.noteId
    const versionId = context.params?.versionId
    if (!noteId || !versionId) {
      return NextResponse.json({ error: 'Note ID and version ID are required' }, { status: 400 })
    }

    const noteRef = adminFirestore.collection(DECKMARKET_NOTES_COLLECTION).doc(noteId)
    const noteSnap = await noteRef.get()

    if (!noteSnap.exists) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    const versionRef = noteRef.collection(NOTES_VERSIONS_SUBCOLLECTION).doc(versionId)
    const versionSnap = await versionRef.get()

    if (!versionSnap.exists) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }

    const versionData = versionSnap.data() as Record<string, unknown>
    const pdfR2Key = (versionData.pdfR2Key as string) || ''
    const mdR2Key = (versionData.mdR2Key as string) || ''

    const { client, bucket } = getR2Config()
    if (pdfR2Key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: pdfR2Key }))
    }
    if (mdR2Key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: mdR2Key }))
    }

    await versionRef.delete()

    const noteData = noteSnap.data() as Record<string, unknown>
    const latestVersionId = (noteData.latestVersionId as string | null) ?? null

    if (latestVersionId === versionId) {
      const nextSnapshot = await noteRef
        .collection(NOTES_VERSIONS_SUBCOLLECTION)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get()

      if (nextSnapshot.docs.length > 0) {
        await noteRef.update({
          latestVersionId: nextSnapshot.docs[0].id,
          updatedAt: FieldValue.serverTimestamp(),
        })
      } else {
        await noteRef.update({
          latestVersionId: null,
          updatedAt: FieldValue.serverTimestamp(),
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[API /admin/deckmarket/notes/[noteId]/versions/[versionId]] DELETE Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete note version' },
      { status: 500 }
    )
  }
})
