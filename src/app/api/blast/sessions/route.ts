import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getAdminDb } from '@/lib/firebase/admin'
import { getStorageDecision } from '@/lib/api/storage-helper'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decision = await getStorageDecision(session)
    if (!decision.shouldWriteToFirebase) {
      return NextResponse.json({
        sessions: [],
        storage: { location: 'local', syncEnabled: false }
      })
    }

    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const limit = Math.min(parseInt(limitParam || '50', 10), 200)

    const db = getAdminDb()
    const snapshot = await db
      .collection('blastSessions')
      .where('userId', '==', session.uid)
      .orderBy('completedAt', 'desc')
      .limit(limit)
      .get()

    const sessions = snapshot.docs.map(doc => {
      const data = doc.data() as any
      return {
        id: doc.id,
        ...data,
        completedAt: data.completedAt?.toDate ? data.completedAt.toDate().toISOString() : data.completedAt
      }
    })
    return NextResponse.json({ sessions, storage: { location: 'both', syncEnabled: true } })
  } catch (error) {
    console.error('[Blast Sessions API] Error loading sessions:', error)
    return NextResponse.json({ error: 'Failed to load blast sessions' }, { status: 500 })
  }
}
