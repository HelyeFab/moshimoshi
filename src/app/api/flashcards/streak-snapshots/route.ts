import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth/session'
import { getAdminDb } from '@/lib/firebase/admin'
import { isFlashcardsPremiumUser } from '@/app/api/flashcards/_lib/entitlements'

const StreakSnapshotSchema = z.object({
  date: z.string().min(1),
  streak1: z.number().int().min(0),
  streak2: z.number().int().min(0),
  streak3plus: z.number().int().min(0),
  total: z.number().int().min(0),
  updatedAt: z.number().int().min(0),
})

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await isFlashcardsPremiumUser(session.uid))) {
      return NextResponse.json({ error: 'Premium required for sync' }, { status: 403 })
    }

    const db = getAdminDb()
    const snapshot = await db
      .collection('users')
      .doc(session.uid)
      .collection('flashcardStreakSnapshots')
      .get()

    const items = snapshot.docs.map(doc => ({
      date: doc.id,
      streak1: doc.data()?.streak1 || 0,
      streak2: doc.data()?.streak2 || 0,
      streak3plus: doc.data()?.streak3plus || 0,
      total: doc.data()?.total || 0,
      updatedAt: doc.data()?.updatedAt || 0,
    }))

    return NextResponse.json({ items })
  } catch (error) {
    console.error('[API Flashcards Streak Snapshots] GET error', error)
    return NextResponse.json({ error: 'Failed to fetch streak snapshots' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await isFlashcardsPremiumUser(session.uid))) {
      return NextResponse.json({ error: 'Premium required for sync' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = StreakSnapshotSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid snapshot payload' }, { status: 400 })
    }

    const snapshot = parsed.data
    const db = getAdminDb()
    await db
      .collection('users')
      .doc(session.uid)
      .collection('flashcardStreakSnapshots')
      .doc(snapshot.date)
      .set(
        {
          userId: session.uid,
          ...snapshot,
        },
        { merge: true }
      )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API Flashcards Streak Snapshots] PUT error', error)
    return NextResponse.json({ error: 'Failed to save streak snapshot' }, { status: 500 })
  }
}
