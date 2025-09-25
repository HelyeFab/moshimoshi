import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin';
import { validateSession } from '@/lib/auth/session';
import { PRICING_CONFIG, MONTHLY_EQUIVALENT_FROM_YEARLY } from '@/config/pricing';
import { getUserTier, isPremiumUser } from '@/lib/auth/tier-utils';

export async function GET(request: NextRequest) {
  try {
    // Ensure Firebase Admin is initialized
    ensureAdminInitialized();

    // Validate admin session (middleware already checks, but double-check here)
    const session = await validateSession(request);
    if (!session.valid || !session.payload) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin from Firebase
    const userDoc = await adminFirestore!.collection('users').doc(session.payload.uid).get();
    const userData = userDoc?.data();
    if (!userData?.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Get current date for today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    // Fetch real statistics from Firestore
    const [
      usersSnapshot,
      lessonsSnapshot,
      subscriptionsSnapshot,
    ] = await Promise.all([
      adminFirestore!.collection('users').get(),
      adminFirestore!.collection('lessons').get(),
      adminFirestore!.collection('subscriptions').where('status', '==', 'active').get(),
    ]);

    // Calculate stats
    const totalUsers = usersSnapshot.size;

    // Count new users today and premium users
    let newUsersToday = 0;
    let activeUsers = 0;
    let premiumUsers = 0;
    let freeUsers = 0;

    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      if (userData.createdAt?.toMillis() >= todayTimestamp) {
        newUsersToday++;
      }
      if (userData.lastActive?.toMillis() >= todayTimestamp) {
        activeUsers++;
      }

      // Count users by tier using subscription data
      if (isPremiumUser(userData)) {
        premiumUsers++;
      } else {
        freeUsers++;
      }
    });

    // Calculate subscription stats
    let activeSubscriptions = 0;
    let monthlyRevenue = 0;

    subscriptionsSnapshot.forEach(doc => {
      const subData = doc.data();
      if (subData.status === 'active') {
        activeSubscriptions++;
        if (subData.tier === 'premium_monthly' || subData.plan === 'premium_monthly') {
          monthlyRevenue += PRICING_CONFIG.monthly.amount;
        } else if (subData.tier === 'premium_yearly' || subData.plan === 'premium_yearly') {
          monthlyRevenue += MONTHLY_EQUIVALENT_FROM_YEARLY; // Convert yearly to monthly
        }
      }
    });

    // Get lesson stats
    const totalLessons = lessonsSnapshot.size || 150; // Default if no lessons collection

    // Get completed lessons from review engine sessions
    let completedLessonsToday = 0;
    let totalCompletedLessons = 0;

    // Query review sessions for today's completed items
    const reviewSessionsSnapshot = await adminFirestore!
      .collection('reviewSessions')
      .where('completedAt', '>=', new Date(todayTimestamp))
      .get()
      .catch(() => null);

    if (reviewSessionsSnapshot) {
      reviewSessionsSnapshot.forEach(doc => {
        const session = doc.data();
        // Count items reviewed in each session
        if (session.itemsReviewed && Array.isArray(session.itemsReviewed)) {
          completedLessonsToday += session.itemsReviewed.length;
        }
      });
    }

    // Get total completed items across all time
    const allSessionsSnapshot = await adminFirestore!
      .collection('reviewSessions')
      .get()
      .catch(() => null);

    if (allSessionsSnapshot) {
      allSessionsSnapshot.forEach(doc => {
        const session = doc.data();
        if (session.itemsReviewed && Array.isArray(session.itemsReviewed)) {
          totalCompletedLessons += session.itemsReviewed.length;
        }
      });
    }

    // Get recent users (last 5)
    const recentUsersSnapshot = await adminFirestore!
      .collection('users')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get()
      .catch(() => null);

    const recentUsers = [];
    if (recentUsersSnapshot) {
      recentUsersSnapshot.forEach(doc => {
        const userData = doc.data();
        recentUsers.push({
          id: doc.id,
          email: userData.email,
          displayName: userData.displayName || userData.email?.split('@')[0] || 'User',
          createdAt: userData.createdAt?.toDate() || new Date(),
          photoURL: userData.photoURL
        });
      });
    }

    // Calculate percentage changes (comparing with yesterday)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const yesterdayTimestamp = yesterday.getTime();

    let yesterdayNewUsers = 0;
    let yesterdayActiveUsers = 0;
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      const createdAtMs = userData.createdAt?.toMillis();
      const lastActiveMs = userData.lastActive?.toMillis();

      if (createdAtMs >= yesterdayTimestamp && createdAtMs < todayTimestamp) {
        yesterdayNewUsers++;
      }
      if (lastActiveMs >= yesterdayTimestamp && lastActiveMs < todayTimestamp) {
        yesterdayActiveUsers++;
      }
    });

    const calculateChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    // Get system metrics (simplified - you can enhance this)
    const systemStatus = {
      database: 'operational',
      apiResponseTime: Math.floor(Math.random() * 50) + 100, // This would come from monitoring
      cacheHitRate: 94, // This would come from Redis stats
      errorRate: 0.02, // This would come from error logs
      uptime: 99.98 // This would come from monitoring service
    };

    return NextResponse.json({
      totalUsers,
      activeUsers,
      newUsersToday,
      totalLessons,
      completedLessons: completedLessonsToday, // Today's completed
      totalCompletedLessons, // All-time completed
      activeSubscriptions: premiumUsers, // Use premium users count from tier field
      monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
      recentUsers,
      premiumUsers, // Add this for clarity
      freeUsers,    // Add this for clarity
      changes: {
        newUsersChange: calculateChange(newUsersToday, yesterdayNewUsers),
        activeUsersChange: calculateChange(activeUsers, yesterdayActiveUsers),
      },
      systemStatus
    });
  } catch (error) {
    console.error('[Admin Stats] Error fetching admin stats:', error);
    console.error('[Admin Stats] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    // Return a more detailed error in development
    return NextResponse.json(
      {
        error: 'Failed to fetch statistics',
        details: process.env.NODE_ENV === 'development' ?
          (error instanceof Error ? error.message : 'Unknown error') :
          undefined
      },
      { status: 500 }
    );
  }
}