import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { cleanNestedDates, calculateStreakFromDates } from '@/utils/streakCalculator'

// GET endpoint to retrieve user's achievement activities (streak data)
export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user from session
    const session = await getSession()

    if (!session?.uid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log(`[API Activities] Loading activities for user ${session.uid}`)

    // Check if adminDb is initialized
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      )
    }

    // Get activities document from Firebase
    const activitiesRef = adminDb
      .collection('users')
      .doc(session.uid)
      .collection('achievements')
      .doc('activities')

    const activitiesDoc = await activitiesRef.get()

    if (!activitiesDoc.exists) {
      console.log(`[API Activities] No activities found for user ${session.uid}, returning defaults`)
      // Return default activities if not found
      return NextResponse.json({
        dates: {},
        currentStreak: 0,
        bestStreak: 0,
        lastActivity: 0
      })
    }

    const rawData = activitiesDoc.data()

    // Clean up any nested structure issues using centralized function
    const cleanDates = cleanNestedDates(rawData)

    // Also check for dates directly at the root level (the corruption issue)
    Object.entries(rawData).forEach(([key, value]) => {
      // Check for keys like "dates.2025-09-17" at root level
      if (key.startsWith('dates.') && key.match(/dates\.\d{4}-\d{2}-\d{2}$/)) {
        const dateOnly = key.replace('dates.', '')
        cleanDates[dateOnly] = true
        console.log(`[API Activities GET] Found corrupted date at root: ${key}, extracting: ${dateOnly}`)
      }
    })

    // Get existing best streak from data
    const existingBestStreak = rawData?.bestStreak || 0

    // Calculate current streak using centralized function
    const streakResult = calculateStreakFromDates(cleanDates, existingBestStreak)

    console.log(`[API Activities] Returning cleaned data for user ${session.uid}:`, {
      currentStreak: streakResult.currentStreak,
      bestStreak: streakResult.bestStreak,
      isActiveToday: streakResult.isActiveToday,
      dateCount: Object.keys(cleanDates).length
    })

    // Return the cleaned activities data
    return NextResponse.json({
      dates: cleanDates,
      currentStreak: streakResult.currentStreak,
      bestStreak: streakResult.bestStreak,
      lastActivity: rawData?.lastActivity || 0,
      isActiveToday: streakResult.isActiveToday,
      lastActivityDate: streakResult.lastActivityDate
    })

  } catch (error) {
    console.error('[API Activities] Error loading activities:', error)
    return NextResponse.json(
      { error: 'Failed to load activities' },
      { status: 500 }
    )
  }
}

// POST endpoint to save activities
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.uid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()

    console.log(`[API Activities] Saving activities for user ${session.uid}:`, {
      currentStreak: body.currentStreak,
      bestStreak: body.bestStreak
    })

    // Check if adminDb is initialized
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      )
    }

    // Save to Firebase
    const activitiesRef = adminDb
      .collection('users')
      .doc(session.uid)
      .collection('achievements')
      .doc('activities')

    await activitiesRef.set(body, { merge: true })

    return NextResponse.json({
      success: true,
      message: 'Activities saved successfully'
    })

  } catch (error) {
    console.error('[API Activities] Error saving activities:', error)
    return NextResponse.json(
      { error: 'Failed to save activities' },
      { status: 500 }
    )
  }
}