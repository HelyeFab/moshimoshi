import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getAdminDb } from '@/lib/firebase/admin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { getStorageDecision, createStorageResponse } from '@/lib/api/storage-helper'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const {
      sessionId,
      contentType,
      level,
      listId,
      selectedKanji,
      studiedItems,
      accuracy,
      completedAt,
      source
    } = await request.json()

    if (!sessionId || !contentType || studiedItems === undefined || accuracy === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, contentType, studiedItems, accuracy' },
        { status: 400 }
      )
    }

    const decision = await getStorageDecision(session)

    if (decision.shouldWriteToFirebase) {
      const db = getAdminDb()
      const completedTimestamp = completedAt
        ? Timestamp.fromDate(new Date(completedAt))
        : FieldValue.serverTimestamp()

      await db.collection('blastSessions').doc(sessionId).set(
        {
          sessionId,
          userId: session.uid,
          contentType,
          level: level || null,
          listId: listId || null,
          selectedKanji: selectedKanji || null,
          studiedItems,
          accuracy,
          source: source || 'blast-mode',
          completedAt: completedTimestamp,
          createdAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      )
    }

    return createStorageResponse(
      { sessionId },
      decision,
      { message: 'Blast session saved' }
    )
  } catch (error) {
    console.error('[Blast Session API] Error saving session:', error)
    return NextResponse.json({ error: 'Failed to save blast session' }, { status: 500 })
  }
}
