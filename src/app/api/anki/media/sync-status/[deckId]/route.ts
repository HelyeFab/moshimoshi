import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { getStorageDecision } from '@/lib/api/storage-helper'

export async function GET(
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

    // Free users: no cloud sync
    if (!decision.shouldWriteToFirebase) {
      return NextResponse.json({
        totalFiles: 0,
        syncedFiles: 0,
        pendingFiles: 0,
        failedFiles: 0,
        isPremium: false,
        message: 'Free users store media locally only'
      })
    }

    // Premium users: query Firestore
    if (!adminDb) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const mediaSnapshot = await adminDb
      .collection('users').doc(session.uid)
      .collection('ankiDecks').doc(deckId)
      .collection('media')
      .get()

    const totalFiles = mediaSnapshot.size
    const syncedFiles = mediaSnapshot.docs.filter(
      doc => doc.data().syncStatus === 'synced'
    ).length

    return NextResponse.json({
      totalFiles,
      syncedFiles,
      pendingFiles: 0, // Server doesn't track pending (client-side only)
      failedFiles: 0,  // Server doesn't track failed (client-side only)
      isPremium: true,
      deckId
    })

  } catch (error: any) {
    console.error('[Media API] Sync status check failed:', error)
    return NextResponse.json({
      error: 'Failed to get sync status',
      details: error.message
    }, { status: 500 })
  }
}
