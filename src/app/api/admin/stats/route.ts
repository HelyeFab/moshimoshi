import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin';
import { validateSession } from '@/lib/auth/session';
import { PRICING_CONFIG, MONTHLY_EQUIVALENT_FROM_YEARLY } from '@/config/pricing';
import { isPremiumUser, getUserTier } from '@/lib/auth/tier-utils';

export async function GET(request: NextRequest) {
  try {
    // Ensure Firebase Admin is initialized
    ensureAdminInitialized();

    // Check adminFirestore is available
    if (!adminFirestore) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    // Validate admin session (middleware already checks, but double-check here)
    const session = await validateSession(request);
    if (!session.valid || !session.payload) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin from Firebase
    const userDoc = await adminFirestore.collection('users').doc(session.payload.uid).get();
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
    const usersSnapshot = await adminFirestore.collection('users').get();

    // Calculate stats
    const totalUsers = usersSnapshot.size;

    // Count new users today and premium users
    let newUsersToday = 0;
    let activeUsers = 0;
    let premiumUsers = 0;
    let freeUsers = 0;
    let monthlyRevenue = 0;

    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      if (userData.createdAt?.toMillis() >= todayTimestamp) {
        newUsersToday++;
      }
      if (userData.lastActive?.toMillis() >= todayTimestamp) {
        activeUsers++;
      }

      // Count users by tier and calculate revenue
      if (isPremiumUser(userData)) {
        premiumUsers++;

        // Calculate MRR based on user tier (use getUserTier for single source of truth)
        const tier = getUserTier(userData);
        if (tier === 'premium_monthly') {
          monthlyRevenue += PRICING_CONFIG.monthly.amount;
        } else if (tier === 'premium_yearly') {
          monthlyRevenue += MONTHLY_EQUIVALENT_FROM_YEARLY; // Convert yearly to monthly equivalent
        }
      } else {
        freeUsers++;
      }
    });

    // Get total view counts from content collections
    // These are cumulative counters stored on each content document
    const [
      booksSnapshot,
      storiesSnapshot,
      comicsSnapshot,
      articlesSnapshot,
    ] = await Promise.all([
      // Books - viewCount incremented when user opens book
      adminFirestore
        .collection('books')
        .where('status', '==', 'published')
        .get()
        .catch(() => null),
      // Stories - viewCount incremented when user opens story
      adminFirestore
        .collection('stories')
        .where('status', '==', 'published')
        .get()
        .catch(() => null),
      // Comics - viewCount incremented when user opens episode
      adminFirestore
        .collection('comics')
        .where('status', '==', 'published')
        .get()
        .catch(() => null),
      // Articles - count total articles (no viewCount tracking yet)
      adminFirestore
        .collection('news_articles')
        .get()
        .catch(() => null),
    ]);

    // Sum up viewCounts from each collection
    let totalBookViews = 0;
    let totalStoryViews = 0;
    let totalComicViews = 0;
    let totalArticleViews = 0;

    booksSnapshot?.forEach(doc => {
      totalBookViews += doc.data().viewCount || 0;
    });

    storiesSnapshot?.forEach(doc => {
      totalStoryViews += doc.data().viewCount || 0;
    });

    comicsSnapshot?.forEach(doc => {
      totalComicViews += doc.data().viewCount || 0;
    });

    articlesSnapshot?.forEach(doc => {
      totalArticleViews += doc.data().viewCount || 0;
    });

    // Get baseline stats for "since baseline" calculations
    const baselineDoc = await adminFirestore
      .collection('admin')
      .doc('stats_baseline')
      .get()
      .catch(() => null);

    const baseline = baselineDoc?.exists ? baselineDoc.data() : null;
    const baselineDate = baseline?.timestamp?.toDate?.() || null;

    // Calculate "since baseline" metrics
    const sinceBaseline = baseline ? {
      bookViews: Math.max(0, totalBookViews - (baseline.bookViews || 0)),
      storyViews: Math.max(0, totalStoryViews - (baseline.storyViews || 0)),
      comicViews: Math.max(0, totalComicViews - (baseline.comicViews || 0)),
      articleViews: Math.max(0, totalArticleViews - (baseline.articleViews || 0)),
      newUsers: Math.max(0, totalUsers - (baseline.totalUsers || 0)),
    } : null;

    // Get recent users (last 5)
    const recentUsersSnapshot = await adminFirestore
      .collection('users')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get()
      .catch(() => null);

    const recentUsers: Array<{
      id: string;
      email: string;
      displayName: string;
      createdAt: Date;
      photoURL?: string;
    }> = [];
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
      activeSubscriptions: premiumUsers, // Use premium users count from tier field
      monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
      // Total content views (all-time cumulative)
      totalArticleViews,
      totalBookViews,
      totalStoryViews,
      totalComicViews,
      recentUsers,
      premiumUsers, // Add this for clarity
      freeUsers,    // Add this for clarity
      changes: {
        newUsersChange: calculateChange(newUsersToday, yesterdayNewUsers),
        activeUsersChange: calculateChange(activeUsers, yesterdayActiveUsers),
      },
      systemStatus,
      // Baseline tracking (since reset)
      baseline: baseline ? {
        date: baselineDate,
        sinceBaseline,
      } : null
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

/**
 * POST /api/admin/stats
 * Set a new baseline for "since reset" metrics
 */
export async function POST(request: NextRequest) {
  try {
    // Ensure Firebase Admin is initialized
    ensureAdminInitialized();

    if (!adminFirestore) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    // Validate admin session
    const session = await validateSession(request);
    if (!session.valid || !session.payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const userDoc = await adminFirestore.collection('users').doc(session.payload.uid).get();
    const userData = userDoc?.data();
    if (!userData?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    // Get current counts to set as baseline
    const [usersSnapshot, booksSnapshot, storiesSnapshot, comicsSnapshot, articlesSnapshot] = await Promise.all([
      adminFirestore.collection('users').get(),
      adminFirestore
        .collection('books')
        .where('status', '==', 'published')
        .get()
        .catch(() => null),
      adminFirestore
        .collection('stories')
        .where('status', '==', 'published')
        .get()
        .catch(() => null),
      adminFirestore
        .collection('comics')
        .where('status', '==', 'published')
        .get()
        .catch(() => null),
      adminFirestore
        .collection('news_articles')
        .get()
        .catch(() => null),
    ]);

    let totalBookViews = 0;
    let totalStoryViews = 0;
    let totalComicViews = 0;
    let totalArticleViews = 0;

    booksSnapshot?.forEach(doc => {
      totalBookViews += doc.data().viewCount || 0;
    });

    storiesSnapshot?.forEach(doc => {
      totalStoryViews += doc.data().viewCount || 0;
    });

    comicsSnapshot?.forEach(doc => {
      totalComicViews += doc.data().viewCount || 0;
    });

    articlesSnapshot?.forEach(doc => {
      totalArticleViews += doc.data().viewCount || 0;
    });

    // Save baseline
    await adminFirestore.collection('admin').doc('stats_baseline').set({
      timestamp: new Date(),
      totalUsers: usersSnapshot.size,
      bookViews: totalBookViews,
      storyViews: totalStoryViews,
      comicViews: totalComicViews,
      articleViews: totalArticleViews,
      resetBy: session.payload.uid,
      resetByEmail: userData.email
    });

    return NextResponse.json({
      success: true,
      message: 'Baseline reset successfully',
      baseline: {
        timestamp: new Date().toISOString(),
        totalUsers: usersSnapshot.size,
        bookViews: totalBookViews,
        storyViews: totalStoryViews,
        comicViews: totalComicViews,
        articleViews: totalArticleViews
      }
    });

  } catch (error) {
    console.error('[Admin Stats] Error setting baseline:', error);
    return NextResponse.json(
      { error: 'Failed to set baseline' },
      { status: 500 }
    );
  }
}