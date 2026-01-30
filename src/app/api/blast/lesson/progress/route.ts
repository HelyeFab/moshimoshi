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
      lessonId,
      level,
      lessonIndex,
      lessonSize,
      totalLessons,
      kanjiIds,
      accuracy,
      completed,
      attempts,
      lastAttemptAt,
      updatedAt,
      completedAt,
      source
    } = await request.json()

    if (
      !lessonId ||
      !level ||
      lessonIndex === undefined ||
      lessonSize === undefined ||
      totalLessons === undefined ||
      accuracy === undefined ||
      completed === undefined ||
      attempts === undefined ||
      !lastAttemptAt ||
      !updatedAt
    ) {
      return NextResponse.json(
        { error: 'Missing required lesson progress fields' },
        { status: 400 }
      )
    }

    const decision = await getStorageDecision(session)

    if (decision.shouldWriteToFirebase) {
      const db = getAdminDb()
      const updatedTimestamp = Timestamp.fromDate(new Date(updatedAt))
      const attemptTimestamp = Timestamp.fromDate(new Date(lastAttemptAt))
      const completedTimestamp = completedAt ? Timestamp.fromDate(new Date(completedAt)) : null

      await db.collection('blastLessonProgress').doc(lessonId).set(
        {
          lessonId,
          userId: session.uid,
          level,
          lessonIndex,
          lessonSize,
          totalLessons,
          kanjiIds: kanjiIds || [],
          accuracy,
          completed,
          attempts,
          lastAttemptAt: attemptTimestamp,
          updatedAt: updatedTimestamp,
          completedAt: completedTimestamp,
          source: source || 'blast-lesson',
          createdAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      )
    }

    return createStorageResponse(
      { lessonId },
      decision,
      { message: 'Blast lesson progress saved' }
    )
  } catch (error) {
    console.error('[Blast Lesson API] Error saving lesson progress:', error)
    return NextResponse.json({ error: 'Failed to save lesson progress' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decision = await getStorageDecision(session)
    if (!decision.shouldWriteToFirebase) {
      return NextResponse.json({
        lessons: [],
        storage: { location: 'local', syncEnabled: false }
      })
    }

    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const level = searchParams.get('level') || undefined
    const limit = Math.min(parseInt(limitParam || '50', 10), 200)

    const db = getAdminDb()
    let query = db
      .collection('blastLessonProgress')
      .where('userId', '==', session.uid)

    if (level) {
      query = query.where('level', '==', level)
    }

    const snapshot = await query
      .orderBy('updatedAt', 'desc')
      .limit(limit)
      .get()

    const lessons = snapshot.docs.map(doc => {
      const data = doc.data() as any
      return {
        id: doc.id,
        ...data,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
        lastAttemptAt: data.lastAttemptAt?.toDate ? data.lastAttemptAt.toDate().toISOString() : data.lastAttemptAt,
        completedAt: data.completedAt?.toDate ? data.completedAt.toDate().toISOString() : data.completedAt
      }
    })

    return NextResponse.json({ lessons, storage: { location: 'both', syncEnabled: true } })
  } catch (error) {
    console.error('[Blast Lesson API] Error loading lesson progress:', error)
    return NextResponse.json({ error: 'Failed to load lesson progress' }, { status: 500 })
  }
}
