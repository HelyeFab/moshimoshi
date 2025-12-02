import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'
import { adminDb } from '@/lib/firebase/admin'

/**
 * GET /api/admin/users/[uid]/data
 * Gets comprehensive user data from all Firebase collections
 * with human-readable timestamp formatting
 */
export const GET = withAdminAuth(async (request: NextRequest, context: AdminContext) => {
  try {
    // Extract uid from URL path
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const encodedUidOrEmail = pathParts[pathParts.length - 2] // /api/admin/users/[uid]/data

    // Decode URL parameter (handles %40 -> @ etc)
    const uidOrEmail = decodeURIComponent(encodedUidOrEmail)

    if (!uidOrEmail) {
      return NextResponse.json({ error: 'User ID or email is required' }, { status: 400 })
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 })
    }

    // Check if input is an email or UID
    let uid = uidOrEmail
    if (uidOrEmail.includes('@')) {
      // It's an email, need to look up the UID
      try {
        const usersSnapshot = await adminDb
          .collection('users')
          .where('email', '==', uidOrEmail)
          .limit(1)
          .get()

        if (usersSnapshot.empty) {
          return NextResponse.json(
            { error: `User not found with email: ${uidOrEmail}` },
            { status: 404 }
          )
        }

        uid = usersSnapshot.docs[0].id
      } catch (error) {
        console.error('Error looking up user by email:', error)
        return NextResponse.json({ error: 'Failed to lookup user by email' }, { status: 500 })
      }
    }

    const userData: any = {
      userId: uid,
      retrievedAt: new Date().toISOString(),
      retrievedBy: context?.user?.uid || 'unknown',
    }

    // 1. Main user document
    try {
      const userDoc = await adminDb.collection('users').doc(uid).get()
      if (userDoc.exists) {
        userData.users = userDoc.data()
      } else {
        return NextResponse.json({ error: `User not found with UID: ${uid}` }, { status: 404 })
      }
    } catch (error) {
      console.error('Error fetching user document:', error)
      userData.users = null
      userData.errors = userData.errors || []
      userData.errors.push({ collection: 'users', error: String(error) })
    }

    // 2. User stats (unified)
    try {
      const userStatsDoc = await adminDb.collection('user_stats').doc(uid).get()
      userData.user_stats = userStatsDoc.exists ? userStatsDoc.data() : null
    } catch (error) {
      console.error('Error fetching user_stats:', error)
      userData.user_stats = null
    }

    // 3. Leaderboard stats
    try {
      const leaderboardDoc = await adminDb.collection('leaderboard_stats').doc(uid).get()
      userData.leaderboard_stats = leaderboardDoc.exists ? leaderboardDoc.data() : null
    } catch (error) {
      console.error('Error fetching leaderboard_stats:', error)
      userData.leaderboard_stats = null
    }

    // 4. Usage data
    try {
      const usageSnapshot = await adminDb.collection('users').doc(uid).collection('usage').get()
      userData.usage = {}
      usageSnapshot.forEach(doc => {
        userData.usage[doc.id] = doc.data()
      })
    } catch (error) {
      console.error('Error fetching usage:', error)
      userData.usage = null
    }

    // 5. Drill sessions
    try {
      const drillSnapshot = await adminDb
        .collection('drill_sessions_by_userId')
        .where('userId', '==', uid)
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get()

      userData.drill_sessions = drillSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }))
      userData.drill_sessions_count = drillSnapshot.size
    } catch (error) {
      console.error('Error fetching drill sessions:', error)
      userData.drill_sessions = []
      userData.drill_sessions_count = 0
    }

    // 6. Review sessions
    try {
      const reviewSnapshot = await adminDb
        .collection('users')
        .doc(uid)
        .collection('review_sessions')
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get()

      userData.review_sessions = reviewSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }))
      userData.review_sessions_count = reviewSnapshot.size
    } catch (error) {
      console.error('Error fetching review sessions:', error)
      userData.review_sessions = []
      userData.review_sessions_count = 0
    }

    // 7. Subcollections from users document
    const subcollections = [
      'achievements',
      'kanji_browse_history',
      'vocabulary_history',
      'lists',
      'bookmarks',
      'flashcard_decks',
      'notifications',
    ]

    userData.subcollections = {}

    for (const collectionName of subcollections) {
      try {
        const snapshot = await adminDb
          .collection('users')
          .doc(uid)
          .collection(collectionName)
          .limit(100)
          .get()

        if (!snapshot.empty) {
          userData.subcollections[collectionName] = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          }))
        }
      } catch (error) {
        console.error(`Error fetching ${collectionName}:`, error)
        // Silently skip subcollections that don't exist or error
      }
    }

    // 8. Recent activity
    try {
      const activitySnapshot = await adminDb
        .collection('userActivity')
        .where('userId', '==', uid)
        .orderBy('timestamp', 'desc')
        .limit(20)
        .get()

      userData.recent_activity = activitySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }))
    } catch (error) {
      console.error('Error fetching recent activity:', error)
      userData.recent_activity = []
    }

    // 9. Entitlement decisions
    try {
      const decisionsSnapshot = await adminDb
        .collection('logs')
        .doc('entitlements')
        .collection('entries')
        .where('userId', '==', uid)
        .orderBy('timestamp', 'desc')
        .limit(20)
        .get()

      userData.entitlement_decisions = decisionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }))
    } catch (error) {
      console.error('Error fetching entitlement decisions:', error)
      userData.entitlement_decisions = []
    }

    // Add summary statistics (keep data structure intact, just add metadata)
    userData.summary = {
      totalCollections: Object.keys(userData.subcollections || {}).length,
      drillSessionsCount: userData.drill_sessions_count || 0,
      reviewSessionsCount: userData.review_sessions_count || 0,
      recentActivityCount: userData.recent_activity?.length || 0,
      hasUserStats: !!userData.user_stats,
      hasLeaderboardStats: !!userData.leaderboard_stats,
      accountStatus: userData.users?.userState || 'unknown',
      subscription: userData.users?.subscription?.plan || 'guest',
      isAdmin: userData.users?.isAdmin || false,
      emailVerified: userData.users?.emailVerified || false,
    }

    return NextResponse.json({
      success: true,
      data: userData,
    })
  } catch (error) {
    console.error('Error fetching user data:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch user data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
