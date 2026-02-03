import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { requireR2Entitlement } from '@/lib/api/r2-entitlement'
import { adminDb } from '@/lib/firebase/admin'
import type { R2Metadata, BackupInfo } from '@/types/r2'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/anki/r2/backups
 *
 * Returns list of all R2 backups for the authenticated user
 * Used by the restore page to show available decks
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const session = await requireAuth()
    const entitlement = await requireR2Entitlement(session)
    if (!entitlement.allowed && entitlement.reason === 'not_premium') {
      return NextResponse.json(
        { error: { code: 'PREMIUM_REQUIRED', message: 'Premium required' } },
        { status: 403 }
      )
    }

    if (!adminDb) {
      throw new Error('Firebase Admin DB not initialized')
    }

    // Query Firestore for user's backups
    const snapshot = await adminDb
      .collection('anki_r2_backups')
      .where('userId', '==', session.uid)
      .orderBy('updatedAt', 'desc')
      .get()

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    const deletedSnapshot = await adminDb
      .collection('users')
      .doc(session.uid)
      .collection('deletedAnkiDecks')
      .where('deletedAt', '>', thirtyDaysAgo)
      .get()
    const deletedDeckIds = deletedSnapshot.docs.map(doc => doc.id)
    const deletedDeckIdSet = new Set(deletedDeckIds)

    // Transform Firestore docs to BackupInfo format
    const backups: BackupInfo[] = snapshot.docs
      .filter(doc => !deletedDeckIdSet.has(doc.id))
      .map(doc => {
      const data = doc.data() as R2Metadata
      return {
        deckId: data.deckId,
        name: data.name,
        cardCount: data.cardCount,
        hasMedia: data.hasMedia,
        lastBackup: new Date(data.updatedAt),
        r2Keys: {
          manifestKey: data.r2.manifestKey,
          packageKey: data.r2.packageKey,
        },
      }
    })

    return NextResponse.json({ backups, deletedDeckIds })
  } catch (error: any) {
    const message = error?.message || 'Failed to fetch backups'
    const status = message === 'Authentication required' ? 401 : 500

    console.error('[GET /api/anki/r2/backups] Error:', error)

    return NextResponse.json(
      { error: { code: 'BACKUPS_FETCH_ERROR', message } },
      { status }
    )
  }
}
