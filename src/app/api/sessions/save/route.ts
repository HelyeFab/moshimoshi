import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { getStorageDecision, createStorageResponse } from '@/lib/api/storage-helper'

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

    // Check storage decision
    const decision = await getStorageDecision(session)

    // For free users, return success with local storage indicator
    if (!decision.shouldWriteToFirebase) {
      console.log(`[Sessions API] Free user - should store locally: ${session.uid}`)
      return NextResponse.json({
        success: true,
        message: 'Session should be saved locally',
        storage: {
          location: 'local',
          syncEnabled: false
        }
      })
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

    return createStorageResponse(
      {
        sessionId,
        message: `${sessionType} session saved successfully`
      },
      decision
    )

  } catch (error) {
    console.error('Error saving session:', error)
    return NextResponse.json(
      { error: 'Failed to save session' },
      { status: 500 }
    )
  }
}