import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { calculateStreakFromDates, cleanNestedDates } from '@/utils/streakCalculator'

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

    const { sessionType, itemsReviewed, accuracy, duration } = await request.json()

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0]

    // Check if adminDb is initialized
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      )
    }

    // Reference to the user's activities document
    const activityRef = adminDb
      .collection('users')
      .doc(session.uid)
      .collection('achievements')
      .doc('activities')

    // Get current activities data
    const activityDoc = await activityRef.get()
    const rawData = activityDoc.exists ? activityDoc.data() : null

    // Clean up any nested structure issues using the centralized function
    // This handles dates at root level (dates.2025-09-17) and nested structures
    const cleanDates = rawData ? cleanNestedDates(rawData) : {}

    // Also check for dates directly at the root level (the corruption issue)
    if (rawData) {
      Object.entries(rawData).forEach(([key, value]) => {
        // Check for keys like "dates.2025-09-17" at root level
        if (key.startsWith('dates.') && key.match(/dates\.\d{4}-\d{2}-\d{2}$/)) {
          const dateOnly = key.replace('dates.', '')
          cleanDates[dateOnly] = true
          console.log(`[API] Found corrupted date at root: ${key}, extracting: ${dateOnly}`)
        }
      })
    }

    // Get existing best streak to preserve it
    const existingBestStreak = rawData?.bestStreak || 0

    // Mark today as active
    cleanDates[today] = true
    const lastActivity = Date.now()

    // Calculate streak using the centralized function
    const streakResult = calculateStreakFromDates(cleanDates, existingBestStreak)

    // Prepare clean data structure for Firebase
    // IMPORTANT: We use set() without merge to ensure clean structure
    const cleanData = {
      dates: cleanDates,
      currentStreak: streakResult.currentStreak,
      bestStreak: streakResult.bestStreak,
      lastActivity: lastActivity,
      lastUpdated: FieldValue.serverTimestamp()
    }

    // Update the document with clean structure
    // Using set() without merge prevents nested structure issues
    await activityRef.set(cleanData)

    console.log(`[API] Updated activity for user ${session.uid}:`, {
      currentStreak: streakResult.currentStreak,
      bestStreak: streakResult.bestStreak,
      isActiveToday: streakResult.isActiveToday,
      dateCount: Object.keys(cleanDates).length,
      today
    })

    // Also update session statistics if needed
    if (sessionType) {
      const statsRef = adminDb
        .collection('users')
        .doc(session.uid)
        .collection('statistics')
        .doc('overall')

      await statsRef.set({
        lastSessionType: sessionType,
        lastSessionDate: FieldValue.serverTimestamp(),
        totalSessions: FieldValue.increment(1),
        totalItemsReviewed: FieldValue.increment(itemsReviewed || 0),
        lastAccuracy: accuracy || 0,
        lastUpdated: FieldValue.serverTimestamp()
      }, { merge: true })
    }

    return NextResponse.json({
      success: true,
      currentStreak: streakResult.currentStreak,
      bestStreak: streakResult.bestStreak,
      isActiveToday: streakResult.isActiveToday,
      today: today
    })

  } catch (error) {
    console.error('Error updating activity:', error)
    return NextResponse.json(
      { error: 'Failed to update activity' },
      { status: 500 }
    )
  }
}