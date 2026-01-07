import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminDb, adminStorage } from '@/lib/firebase/admin'
import { getStorageDecision } from '@/lib/api/storage-helper'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Premium check
    const decision = await getStorageDecision(session)
    if (!decision.shouldWriteToFirebase) {
      return NextResponse.json({
        error: 'Premium subscription required for cloud sync'
      }, { status: 403 })
    }

    const body = await request.json()
    const { deckId, files } = body

    // Validate
    if (!deckId || !files || !Array.isArray(files)) {
      return NextResponse.json({
        error: 'Invalid request: deckId and files[] required'
      }, { status: 400 })
    }

    // Calculate total size
    const totalSize = files.reduce((sum: number, f: any) => sum + (f.size || 0), 0)

    // Check quota BEFORE saving metadata
    const currentUsage = await getUserStorageUsage(session.uid)
    const newUsage = currentUsage + totalSize
    const QUOTA_LIMIT = 500 * 1024 * 1024 // 500MB
    const QUOTA_WARNING = 450 * 1024 * 1024 // 90% = 450MB

    if (newUsage > QUOTA_LIMIT) {
      return NextResponse.json({
        error: 'Storage quota exceeded',
        currentUsage,
        limit: QUOTA_LIMIT,
        attempted: totalSize
      }, { status: 413 }) // 413 Payload Too Large
    }

    // Save metadata to Firestore
    // Store in: /users/{userId}/ankiDecks/{deckId}/media/{filename}
    const batch = adminDb!.batch()

    for (const file of files) {
      const mediaRef = adminDb!
        .collection('users').doc(session.uid)
        .collection('ankiDecks').doc(deckId)
        .collection('media').doc(file.filename)

      batch.set(mediaRef, {
        filename: file.filename,
        firebaseUrl: file.firebaseUrl,
        size: file.size,
        contentType: file.contentType,
        uploadedAt: file.uploadedAt,
        syncStatus: 'synced',
        userId: session.uid,
        deckId
      })
    }

    await batch.commit()

    // Check if warning needed
    const warning = newUsage > QUOTA_WARNING ? {
      message: `Storage usage at ${Math.round((newUsage / QUOTA_LIMIT) * 100)}% (${formatBytes(newUsage)} / ${formatBytes(QUOTA_LIMIT)})`,
      percentage: (newUsage / QUOTA_LIMIT) * 100
    } : null

    return NextResponse.json({
      success: true,
      filesTracked: files.length,
      totalSize,
      storageUsage: {
        current: newUsage,
        limit: QUOTA_LIMIT,
        percentage: (newUsage / QUOTA_LIMIT) * 100
      },
      warning
    })

  } catch (error: any) {
    console.error('[Media API] Metadata update failed:', error)
    return NextResponse.json({
      error: 'Failed to update media metadata',
      details: error.message
    }, { status: 500 })
  }
}

// Helper: Get user's total storage usage
async function getUserStorageUsage(userId: string): Promise<number> {
  if (!adminDb) return 0

  try {
    // Query all media files for this user across all decks
    const mediaSnapshot = await adminDb
      .collectionGroup('media')
      .where('userId', '==', userId)
      .get()

    let totalSize = 0
    mediaSnapshot.forEach(doc => {
      totalSize += doc.data().size || 0
    })

    return totalSize
  } catch (error) {
    console.error('[Media API] Failed to calculate storage usage:', error)
    return 0
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
