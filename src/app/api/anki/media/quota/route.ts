import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminDb, adminStorage } from '@/lib/firebase/admin'
import { getStorageDecision } from '@/lib/api/storage-helper'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decision = await getStorageDecision(session)
    const QUOTA_LIMIT = 500 * 1024 * 1024 // 500MB
    const QUOTA_WARNING = 450 * 1024 * 1024 // 90%

    // Premium users: get actual usage
    if (decision.shouldWriteToFirebase && adminDb) {
      const usage = await getUserStorageUsage(session.uid)
      const percentage = (usage / QUOTA_LIMIT) * 100

      return NextResponse.json({
        currentUsage: usage,
        limit: QUOTA_LIMIT,
        available: QUOTA_LIMIT - usage,
        percentage: Math.round(percentage * 100) / 100,
        warning: usage > QUOTA_WARNING,
        isPremium: true,
        formatted: {
          current: formatBytes(usage),
          limit: formatBytes(QUOTA_LIMIT),
          available: formatBytes(QUOTA_LIMIT - usage)
        }
      })
    }

    // Free users: no quota (local only)
    return NextResponse.json({
      currentUsage: 0,
      limit: 0,
      available: 0,
      percentage: 0,
      warning: false,
      isPremium: false,
      message: 'Free users store media locally only'
    })

  } catch (error: any) {
    console.error('[Media API] Quota check failed:', error)
    return NextResponse.json({
      error: 'Failed to check storage quota',
      details: error.message
    }, { status: 500 })
  }
}

// Helper: Get user's total storage usage
async function getUserStorageUsage(userId: string): Promise<number> {
  if (!adminDb) return 0

  try {
    // Try collectionGroup query (requires index, may fail initially)
    try {
      const mediaSnapshot = await adminDb
        .collectionGroup('media')
        .where('userId', '==', userId)
        .get()

      let totalSize = 0
      mediaSnapshot.forEach(doc => {
        totalSize += doc.data().size || 0
      })

      return totalSize
    } catch (collectionGroupError: any) {
      // If index not ready (FAILED_PRECONDITION), use fallback method
      if (collectionGroupError.code === 9 || collectionGroupError.message?.includes('FAILED_PRECONDITION')) {
        console.log('[Media API] CollectionGroup index not ready, using fallback method')
        return await getUserStorageUsageFallback(userId)
      }
      throw collectionGroupError
    }
  } catch (error) {
    console.error('[Media API] Failed to calculate storage usage:', error)
    return 0
  }
}

// Fallback: Use Firebase Storage to calculate usage (source of truth)
async function getUserStorageUsageFallback(userId: string): Promise<number> {
  if (!adminStorage) return 0

  let totalSize = 0

  try {
    const bucket = adminStorage.bucket()
    const [files] = await bucket.getFiles({
      prefix: `anki-media/${userId}/`
    })

    totalSize = files.reduce((sum, file) => {
      const size = parseInt(file.metadata.size || '0')
      return sum + size
    }, 0)

    console.log(`[Media API] Fallback calculated ${totalSize} bytes from ${files.length} files in Storage`)
    return totalSize
  } catch (error) {
    console.error('[Media API] Fallback method failed:', error)
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
