/**
 * API endpoints for vocabulary search history
 * Handles storage and retrieval of search history for premium users
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { reviewLogger } from '@/lib/monitoring/logger'

/**
 * GET /api/vocabulary/history
 * Load search history for authenticated premium users
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession()
    if (!session?.uid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is premium
    const userDoc = await adminDb.collection('users').doc(session.uid).get()
    const userData = userDoc.data()
    const isPremium = userData?.subscription?.plan === 'premium_monthly' ||
                      userData?.subscription?.plan === 'premium_yearly'

    if (!isPremium) {
      return NextResponse.json(
        { error: 'Premium feature only' },
        { status: 403 }
      )
    }

    // Get query parameters
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '50')

    // Load search history from Firebase
    const historySnapshot = await adminDb
      .collection('users')
      .doc(session.uid)
      .collection('searched_words')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get()

    const history = historySnapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        term: data.term,
        timestamp: data.timestamp?.toDate() || new Date(),
        resultCount: data.resultCount || 0,
        searchSource: data.searchSource,
        deviceType: data.deviceType,
        clickedResults: data.clickedResults || []
      }
    })

    reviewLogger.info(`[API] Loaded ${history.length} search history items for user ${session.uid}`)

    return NextResponse.json({
      success: true,
      history,
      count: history.length
    })

  } catch (error) {
    reviewLogger.error('[API] Failed to load search history:', error)
    return NextResponse.json(
      { error: 'Failed to load search history' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/vocabulary/history
 * Save a new search entry for premium users
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession()
    if (!session?.uid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is premium
    const userDoc = await adminDb.collection('users').doc(session.uid).get()
    const userData = userDoc.data()
    const isPremium = userData?.subscription?.plan === 'premium_monthly' ||
                      userData?.subscription?.plan === 'premium_yearly'

    if (!isPremium) {
      return NextResponse.json(
        { error: 'Premium feature only' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { entry } = body

    if (!entry?.term) {
      return NextResponse.json(
        { error: 'Invalid search entry' },
        { status: 400 }
      )
    }

    // Prepare data for Firebase
    const searchData = {
      term: entry.term,
      timestamp: entry.timestamp ? new Date(entry.timestamp) : FieldValue.serverTimestamp(),
      resultCount: entry.resultCount || 0,
      searchSource: entry.searchSource || 'jmdict',
      deviceType: entry.deviceType || 'desktop',
      clickedResults: entry.clickedResults || [],
      userId: session.uid,
      syncedAt: FieldValue.serverTimestamp()
    }

    // Save to Firebase
    const docRef = await adminDb
      .collection('users')
      .doc(session.uid)
      .collection('searched_words')
      .add(searchData)

    reviewLogger.info(`[API] Saved search "${entry.term}" for user ${session.uid}`)

    // Also update user's last activity
    await adminDb
      .collection('users')
      .doc(session.uid)
      .update({
        'lastActivity.vocabularySearch': FieldValue.serverTimestamp()
      })

    return NextResponse.json({
      success: true,
      id: docRef.id,
      message: 'Search history saved'
    })

  } catch (error) {
    reviewLogger.error('[API] Failed to save search history:', error)
    return NextResponse.json(
      { error: 'Failed to save search history' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/vocabulary/history
 * Clear all search history for a user
 */
export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession()
    if (!session?.uid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is premium
    const userDoc = await adminDb.collection('users').doc(session.uid).get()
    const userData = userDoc.data()
    const isPremium = userData?.subscription?.plan === 'premium_monthly' ||
                      userData?.subscription?.plan === 'premium_yearly'

    if (!isPremium) {
      // Free users can still clear their local history
      // Just return success without Firebase operations
      return NextResponse.json({
        success: true,
        message: 'Local history cleared'
      })
    }

    // Get all search history documents
    const historySnapshot = await adminDb
      .collection('users')
      .doc(session.uid)
      .collection('searched_words')
      .get()

    // Batch delete for efficiency
    const batch = adminDb.batch()
    historySnapshot.docs.forEach(doc => {
      batch.delete(doc.ref)
    })

    await batch.commit()

    reviewLogger.info(`[API] Cleared ${historySnapshot.size} search history items for user ${session.uid}`)

    return NextResponse.json({
      success: true,
      message: 'Search history cleared',
      deletedCount: historySnapshot.size
    })

  } catch (error) {
    reviewLogger.error('[API] Failed to clear search history:', error)
    return NextResponse.json(
      { error: 'Failed to clear search history' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/vocabulary/history
 * Update a search entry (e.g., add clicked results)
 */
export async function PATCH(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession()
    if (!session?.uid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is premium
    const userDoc = await adminDb.collection('users').doc(session.uid).get()
    const userData = userDoc.data()
    const isPremium = userData?.subscription?.plan === 'premium_monthly' ||
                      userData?.subscription?.plan === 'premium_yearly'

    if (!isPremium) {
      return NextResponse.json(
        { error: 'Premium feature only' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { entryId, clickedWord } = body

    if (!entryId || !clickedWord) {
      return NextResponse.json(
        { error: 'Invalid update data' },
        { status: 400 }
      )
    }

    // Update the search entry
    const docRef = adminDb
      .collection('users')
      .doc(session.uid)
      .collection('searched_words')
      .doc(entryId)

    const doc = await docRef.get()
    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Search entry not found' },
        { status: 404 }
      )
    }

    const currentData = doc.data()
    const clickedResults = currentData?.clickedResults || []

    if (!clickedResults.includes(clickedWord)) {
      clickedResults.push(clickedWord)

      await docRef.update({
        clickedResults,
        lastUpdated: FieldValue.serverTimestamp()
      })

      reviewLogger.info(`[API] Updated search entry ${entryId} with clicked word "${clickedWord}"`)
    }

    return NextResponse.json({
      success: true,
      message: 'Search entry updated'
    })

  } catch (error) {
    reviewLogger.error('[API] Failed to update search history:', error)
    return NextResponse.json(
      { error: 'Failed to update search history' },
      { status: 500 }
    )
  }
}