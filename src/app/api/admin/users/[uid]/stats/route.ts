import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'
import { adminAuth, adminDb } from '@/lib/firebase/admin'

export const GET = withAdminAuth(async (request: NextRequest, context: AdminContext) => {
  try {
    if (!adminAuth || !adminDb) {
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 })
    }

    const { uid } = context.params || {}
    if (!uid) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Try to get user by UID first, then by email if that fails
    let userId: string
    try {
      const userRecord = await adminAuth.getUser(uid)
      userId = userRecord.uid
    } catch {
      // If not a valid UID, try as email
      try {
        const userRecord = await adminAuth.getUserByEmail(uid)
        userId = userRecord.uid
      } catch {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
    }

    // Get Firebase Auth user details
    const userRecord = await adminAuth.getUser(userId)

    // Get user_stats document
    const userStatsDoc = await adminDb.collection('user_stats').doc(userId).get()
    const userStats = userStatsDoc.exists ? userStatsDoc.data() : null

    // Get users document for subscription info
    const userDoc = await adminDb.collection('users').doc(userId).get()
    const userData = userDoc.exists ? userDoc.data() : null

    // Get leaderboard data
    const leaderboardDoc = await adminDb.collection('leaderboard').doc(userId).get()
    const leaderboardData = leaderboardDoc.exists ? leaderboardDoc.data() : null

    // Get achievements
    const achievementsSnapshot = await adminDb
      .collection('users')
      .doc(userId)
      .collection('achievements')
      .get()

    const achievements = {
      total: achievementsSnapshot.size,
      unlocked: achievementsSnapshot.docs.filter(doc => doc.data().unlocked === true).length,
      locked: achievementsSnapshot.docs.filter(doc => doc.data().unlocked !== true).length,
      recentUnlocked: achievementsSnapshot.docs
        .filter(doc => doc.data().unlocked === true)
        .slice(0, 5)
        .map(doc => ({
          id: doc.id,
          name: doc.data().name,
          unlockedAt: doc.data().unlockedAt
        }))
    }

    // Format the response
    const stats = {
      userId,
      displayName: userRecord.displayName || userData?.profile?.displayName || 'N/A',
      email: userRecord.email,
      emailVerified: userRecord.emailVerified,

      xp: {
        total: userStats?.xp?.total || 0,
        level: userStats?.xp?.level || 1,
        xpGainedToday: userStats?.xp?.xpGainedToday || 0,
        lastXPDate: userStats?.xp?.lastXPDate || null,
        weeklyXP: userStats?.xp?.weeklyXP || 0,
        monthlyXP: userStats?.xp?.monthlyXP || 0
      },

      streak: {
        current: userStats?.streak?.current || 0,
        best: userStats?.streak?.best || 0,
        freezesRemaining: userStats?.streak?.freezesRemaining || 0,
        lastActivityDate: userStats?.dates?.lastActivityDate || null,
        isActiveToday: userStats?.dates?.isActiveToday || false,
        brokenAt: userStats?.streak?.brokenAt || null
      },

      sessions: {
        total: userStats?.sessions?.totalSessions || 0,
        today: userStats?.sessions?.todaySessions || 0,
        week: userStats?.sessions?.weekSessions || 0,
        month: userStats?.sessions?.monthSessions || 0,
        totalItemsReviewed: userStats?.sessions?.totalItemsReviewed || 0,
        averageAccuracy: userStats?.sessions?.averageAccuracy || 0,
        totalStudyTimeMinutes: userStats?.sessions?.totalStudyTimeMinutes || 0
      },

      leaderboard: leaderboardData ? {
        weeklyXP: leaderboardData.weeklyXP || 0,
        monthlyXP: leaderboardData.monthlyXP || 0,
        allTimeXP: leaderboardData.allTimeXP || 0,
        weeklyRank: leaderboardData.weeklyRank || null,
        monthlyRank: leaderboardData.monthlyRank || null,
        allTimeRank: leaderboardData.allTimeRank || null
      } : null,

      achievements,

      subscription: userData?.subscription ? {
        status: userData.subscription.status || 'none',
        tier: userData.subscription.tier || 'free',
        plan: userData.subscription.plan || null
      } : {
        status: 'none',
        tier: 'free',
        plan: null
      },

      metadata: {
        createdAt: userRecord.metadata.creationTime,
        lastSignIn: userRecord.metadata.lastSignInTime,
        schemaVersion: userStats?.metadata?.schemaVersion || 'unknown',
        lastUpdated: userStats?.metadata?.lastUpdated || null
      }
    }

    return NextResponse.json({ success: true, data: stats })
  } catch (error: any) {
    console.error('[Admin API] Error fetching user stats:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch user stats' },
      { status: 500 }
    )
  }
})
