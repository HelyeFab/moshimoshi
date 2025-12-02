import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminDb, getAdminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { getStorageDecision, createStorageResponse } from '@/lib/api/storage-helper'

// Use centralized getAdminDb() for null-safe database access
const getDb = getAdminDb

interface ProgressItem {
  contentId: string
  progress: any
  timestamp: number
}

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

    const { contentType, items, reviewHistory } = await request.json()

    if (!contentType || !items) {
      return NextResponse.json(
        { error: 'Missing required fields: contentType and items' },
        { status: 400 }
      )
    }

    // Check storage decision
    const decision = await getStorageDecision(session)

    console.log(`[API Progress] User ${session.uid} - Premium: ${decision.isPremium}, Content Type: ${contentType}`)

    // Only save to Firebase for premium users
    if (decision.shouldWriteToFirebase) {
      console.log(`[API Progress] Premium user - saving to Firebase`)

      const db = getDb()
      // Save each item as an individual document in progress subcollection
      const batch = db.batch()

      for (const [contentId, progressData] of items) {
        const progressRef = db
          .collection('users')
          .doc(session.uid)
          .collection('progress')
          .doc(contentId) // Use the content ID as the document ID

        // Save with proper structure for scheduled API
        batch.set(progressRef, {
          contentId,
          contentType,
          ...progressData, // Include all progress data including srsData
          lastUpdated: FieldValue.serverTimestamp(),
          userId: session.uid
        }, { merge: true })
      }

      await batch.commit()
      console.log(`[API Progress] Saved ${items.length} progress items to Firebase`)
    } else {
      console.log(`[API Progress] Free user - skipping Firebase save, data should be stored locally`)
    }

    // Save review history if provided and user is premium
    if (reviewHistory && reviewHistory.length > 0 && decision.isPremium) {
      const db = getDb()
      const batch = db.batch()

      for (const entry of reviewHistory) {
        const historyRef = db
          .collection('users')
          .doc(session.uid)
          .collection('review_history')
          .doc() // Auto-generate ID

        batch.set(historyRef, {
          ...entry,
          userId: session.uid,
          createdAt: FieldValue.serverTimestamp()
        })
      }

      await batch.commit()
      console.log(`[API Progress] Saved ${reviewHistory.length} review history entries`)
    }

    return createStorageResponse(
      {
        message: `Progress saved for ${contentType}`,
        itemsCount: items.length
      },
      decision
    )

  } catch (error) {
    console.error('[API Progress] Error saving progress:', error)
    return NextResponse.json(
      { error: 'Failed to save progress' },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve progress
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.uid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const contentType = searchParams.get('contentType')

    if (!contentType) {
      return NextResponse.json(
        { error: 'Missing contentType parameter' },
        { status: 400 }
      )
    }

    // Check storage decision
    const decision = await getStorageDecision(session)

    // For free users, return empty with local storage indicator
    if (!decision.shouldWriteToFirebase) {
      console.log(`[GET /api/progress] Free user - should use local storage: ${session.uid}`)
      return NextResponse.json({
        items: {},
        contentType,
        storage: {
          location: 'local',
          message: 'Free users should fetch from IndexedDB'
        }
      })
    }

    // Get progress from Firestore (premium only)
    // SPECIAL CASE: drill-srs uses a subcollection structure
    const db = getDb()
    if (contentType === 'drill-srs') {
      const srsCollectionRef = db
        .collection('users')
        .doc(session.uid)
        .collection('drill-srs')

      const srsSnapshot = await srsCollectionRef.get()
      const items: Record<string, any> = {}

      srsSnapshot.forEach(doc => {
        items[doc.id] = doc.data()
      })

      console.log(`[GET /api/progress] Loaded ${srsSnapshot.size} SRS words from Firebase for user ${session.uid}`)

      return NextResponse.json({
        items,
        contentType,
        storage: {
          location: decision.storageLocation,
          syncEnabled: decision.shouldWriteToFirebase
        }
      })
    }

    // Standard progress document structure
    const progressRef = db
      .collection('users')
      .doc(session.uid)
      .collection('progress')
      .doc(contentType)

    const progressDoc = await progressRef.get()

    if (!progressDoc.exists) {
      return NextResponse.json({
        items: {},
        contentType
      })
    }

    const data = progressDoc.data()

    return NextResponse.json({
      items: data?.items || {},
      contentType,
      lastUpdated: data?.lastUpdated?.toDate?.() || null,
      storage: {
        location: decision.storageLocation,
        syncEnabled: decision.shouldWriteToFirebase
      }
    })

  } catch (error) {
    console.error('[API Progress] Error loading progress:', error)
    return NextResponse.json(
      { error: 'Failed to load progress' },
      { status: 500 }
    )
  }
}