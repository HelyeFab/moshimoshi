import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminDb, adminStorage } from '@/lib/firebase/admin'
import { getStorageDecision } from '@/lib/api/storage-helper'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { deckId } = await params

    if (!deckId) {
      return NextResponse.json({ error: 'deckId required' }, { status: 400 })
    }

    const decision = await getStorageDecision(session)

    // Free users: nothing to delete from cloud
    if (!decision.shouldWriteToFirebase) {
      return NextResponse.json({
        success: true,
        deletedFiles: 0,
        deletedSize: 0,
        message: 'Free users store media locally only'
      })
    }

    if (!adminDb || !adminStorage) {
      return NextResponse.json({ error: 'Services unavailable' }, { status: 500 })
    }

    // 1. Get all media files for this deck from Firestore
    const mediaSnapshot = await adminDb
      .collection('users').doc(session.uid)
      .collection('ankiDecks').doc(deckId)
      .collection('media')
      .get()

    if (mediaSnapshot.empty) {
      return NextResponse.json({
        success: true,
        deletedFiles: 0,
        deletedSize: 0,
        message: 'No media files found for this deck'
      })
    }

    // 2. Delete files from Firebase Storage
    const bucket = adminStorage.bucket()
    let deletedCount = 0
    let totalSize = 0
    const errors: string[] = []

    for (const doc of mediaSnapshot.docs) {
      const fileData = doc.data()
      const filename = fileData.filename
      const size = fileData.size || 0
      const storagePath = `anki-media/${session.uid}/${deckId}/${filename}`

      try {
        await bucket.file(storagePath).delete()
        deletedCount++
        totalSize += size
      } catch (error: any) {
        // Ignore "file not found" errors
        if (error.code !== 404 && error.code !== 'storage/object-not-found') {
          console.error(`[Media API] Failed to delete ${storagePath}:`, error)
          errors.push(`${filename}: ${error.message}`)
        } else {
          // File already deleted, still count it
          deletedCount++
          totalSize += size
        }
      }
    }

    // 3. Delete Firestore metadata
    const batch = adminDb.batch()
    for (const doc of mediaSnapshot.docs) {
      batch.delete(doc.ref)
    }
    await batch.commit()

    return NextResponse.json({
      success: true,
      deletedFiles: deletedCount,
      deletedSize: totalSize,
      totalFiles: mediaSnapshot.size,
      errors: errors.length > 0 ? errors : undefined,
      formatted: {
        deletedSize: formatBytes(totalSize)
      }
    })

  } catch (error: any) {
    console.error('[Media API] Media deletion failed:', error)
    return NextResponse.json({
      error: 'Failed to delete media files',
      details: error.message
    }, { status: 500 })
  }
}

// Helper: Format bytes to human-readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}
