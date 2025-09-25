import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

export async function POST(request: NextRequest) {
  try {
    // Get the authenticated user from session
    const session = await getSession()

    if (!session?.uid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get fresh user data from Firestore
    const userDoc = await adminDb.collection('users').doc(session.uid).get()
    const userData = userDoc.data()
    const plan = userData?.subscription?.plan || 'free'
    const isPremium = plan.startsWith('premium')

    // Only save to Firebase for premium users
    if (!isPremium) {
      return NextResponse.json(
        { message: 'Session tracking only available for premium users' },
        { status: 200 }
      )
    }

    const {
      sessionType, // 'review' or 'study'
      sessionId,
      characters,
      stats,
      startedAt,
      completedAt
    } = await request.json()

    // Validate required fields
    if (!sessionType || !sessionId || !characters || !stats) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Determine collection based on session type
    const collectionName = sessionType === 'review' ? 'review_sessions' : 'study_sessions'

    // Create session document
    const sessionData = {
      userId: session.uid,
      sessionId,
      sessionType,
      script: characters[0]?.script || 'unknown',
      characters: characters.map((char: any) => ({
        id: char.id,
        character: char.character,
        romaji: char.romaji,
        correct: char.correct,
        attempts: char.attempts,
        responseTime: char.responseTime || null,
        // Add SRS data if present
        srsData: char.srsData || null,
        nextReviewAt: char.nextReviewAt || null
      })),
      stats: {
        totalItems: stats.totalItems || characters.length,
        correctItems: stats.correctItems || 0,
        accuracy: stats.accuracy || 0,
        avgResponseTime: stats.avgResponseTime || 0,
        duration: stats.duration || 0
      },
      startedAt: startedAt ? new Date(startedAt) : FieldValue.serverTimestamp(),
      completedAt: completedAt ? new Date(completedAt) : FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp()
    }

    // Save to user's sessions subcollection
    await adminDb
      .collection('users')
      .doc(session.uid)
      .collection(collectionName)
      .doc(sessionId)
      .set(sessionData)

    console.log(`[Sessions API] Saved ${sessionType} session ${sessionId} for user ${session.uid}`)

    return NextResponse.json({
      success: true,
      sessionId,
      message: `${sessionType} session saved successfully`
    })

  } catch (error) {
    console.error('Error saving session:', error)
    return NextResponse.json(
      { error: 'Failed to save session' },
      { status: 500 }
    )
  }
}