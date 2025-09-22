import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'

// GET endpoint to retrieve user's achievement data
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

    console.log(`[API Achievements] Loading achievements for user ${session.uid}`)

    // Get achievements document from Firebase
    const achievementsRef = adminDb
      .collection('users')
      .doc(session.uid)
      .collection('achievements')
      .doc('data')

    const achievementsDoc = await achievementsRef.get()

    if (!achievementsDoc.exists) {
      console.log(`[API Achievements] No achievements found for user ${session.uid}, returning defaults`)
      // Return default achievements if not found
      return NextResponse.json({
        unlocked: [],
        totalPoints: 0,
        totalXp: 0,
        currentLevel: 1,
        lessonsCompleted: 0,
        statistics: {}
      })
    }

    const data = achievementsDoc.data()
    console.log(`[API Achievements] Found achievements for user ${session.uid}:`, {
      unlocked: data?.unlocked?.length || 0,
      totalPoints: data?.totalPoints || 0
    })

    // Return the achievements data
    return NextResponse.json({
      unlocked: data?.unlocked || [],
      totalPoints: data?.totalPoints || 0,
      totalXp: data?.totalXp || 0,
      currentLevel: data?.currentLevel || 1,
      lessonsCompleted: data?.lessonsCompleted || 0,
      statistics: data?.statistics || {},
      lastUpdated: data?.lastUpdated
    })

  } catch (error) {
    console.error('[API Achievements] Error loading achievements:', error)
    return NextResponse.json(
      { error: 'Failed to load achievements' },
      { status: 500 }
    )
  }
}

// POST endpoint to save achievements
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

    console.log(`[API Achievements] Saving achievements for user ${session.uid}:`, {
      unlocked: body.unlocked?.length || 0,
      totalPoints: body.totalPoints || 0
    })

    // Save to Firebase
    const achievementsRef = adminDb
      .collection('users')
      .doc(session.uid)
      .collection('achievements')
      .doc('data')

    await achievementsRef.set({
      ...body,
      lastUpdated: new Date().toISOString()
    }, { merge: true })

    return NextResponse.json({
      success: true,
      message: 'Achievements saved successfully'
    })

  } catch (error) {
    console.error('[API Achievements] Error saving achievements:', error)
    return NextResponse.json(
      { error: 'Failed to save achievements' },
      { status: 500 }
    )
  }
}