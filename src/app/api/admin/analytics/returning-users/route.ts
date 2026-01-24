/**
 * GET /api/admin/analytics/returning-users
 *
 * Analyzes Firebase Auth metadata to identify returning users
 * A returning user = logged in on day X and came back on day Y (different day)
 *
 * Uses: creationTime (when account was created) and lastSignInTime (last login)
 */

import { NextRequest, NextResponse } from 'next/server';
import { AdminContext } from '@/lib/admin/adminAuth';
import { withAdminAnalyticsRateLimit } from '@/lib/api/admin-analytics-rate-limiter';
import { adminAuth, adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin';

interface DailyUserStats {
  date: string;
  newUsers: number;
  returningUsers: number;
  totalActive: number;
}

interface UserDetail {
  uid: string;
  email: string | null;
  displayName: string | null;
  createdAt: string | null;
  lastSignIn: string | null;
  type: 'new' | 'returning';
  reviewSessions?: number;
  lastActivity?: string | null;
}

interface UserEngagementSummary {
  totalUsers: number;
  newUsersLast7Days: number;
  returningUsersLast7Days: number;
  retentionRate: number;
  dailyBreakdown: DailyUserStats[];
  recentUsers: UserDetail[];
}

export const GET = withAdminAnalyticsRateLimit(async (request: NextRequest, context: AdminContext) => {
  try {
    ensureAdminInitialized();

    if (!adminAuth) {
      throw new Error('Firebase Admin Auth not initialized');
    }

    // Get the last 7 days of dates
    const today = new Date();
    const dates: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Fetch all users (paginated)
    // Note: For large user bases, consider caching or aggregating this data
    const allUsers: {
      uid: string;
      email: string | undefined;
      displayName: string | undefined;
      creationTime: string | undefined;
      lastSignInTime: string | undefined;
    }[] = [];

    let nextPageToken: string | undefined;

    do {
      const listResult = await adminAuth.listUsers(1000, nextPageToken);

      for (const user of listResult.users) {
        allUsers.push({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          creationTime: user.metadata.creationTime,
          lastSignInTime: user.metadata.lastSignInTime,
        });
      }

      nextPageToken = listResult.pageToken;
    } while (nextPageToken);

    // Initialize daily stats
    const dailyStats: Record<string, { newUsers: Set<string>; returningUsers: Set<string> }> = {};
    for (const date of dates) {
      dailyStats[date] = { newUsers: new Set(), returningUsers: new Set() };
    }

    // Analyze each user
    let totalNewInPeriod = 0;
    let totalReturningInPeriod = 0;

    for (const user of allUsers) {
      if (!user.creationTime) continue;

      const createdDate = new Date(user.creationTime).toISOString().split('T')[0];
      const lastSignInDate = user.lastSignInTime
        ? new Date(user.lastSignInTime).toISOString().split('T')[0]
        : null;

      // Determine if user is NEW or RETURNING (mutually exclusive)
      // NEW = account created within the 7-day window
      // RETURNING = account created BEFORE the 7-day window, but signed in within it
      const isNewUser = dates.includes(createdDate);

      if (isNewUser) {
        // User created in the last 7 days = NEW user
        dailyStats[createdDate].newUsers.add(user.uid);
        totalNewInPeriod++;
      } else if (lastSignInDate && dates.includes(lastSignInDate)) {
        // User created before 7-day window but signed in during it = RETURNING user
        dailyStats[lastSignInDate].returningUsers.add(user.uid);
        totalReturningInPeriod++;
      }
    }

    // Build daily breakdown
    const dailyBreakdown: DailyUserStats[] = dates.map(date => ({
      date,
      newUsers: dailyStats[date].newUsers.size,
      returningUsers: dailyStats[date].returningUsers.size,
      totalActive: dailyStats[date].newUsers.size + dailyStats[date].returningUsers.size,
    }));

    // Calculate retention rate
    // Users who were created before the 7-day window and returned during it
    const existingUsers = allUsers.filter(u => {
      if (!u.creationTime) return false;
      const created = new Date(u.creationTime);
      return created < sevenDaysAgo;
    });

    const existingUsersWhoReturned = existingUsers.filter(u => {
      if (!u.lastSignInTime) return false;
      const lastSignIn = new Date(u.lastSignInTime);
      return lastSignIn >= sevenDaysAgo;
    });

    const retentionRate = existingUsers.length > 0
      ? Math.round((existingUsersWhoReturned.length / existingUsers.length) * 100)
      : 0;

    // Build list of users - prioritize ALL returning users, then recent new users
    // This ensures returning users always appear in the list
    const activeUsersInPeriod = allUsers.filter(u => {
      if (!u.lastSignInTime) return false;
      const lastSignIn = new Date(u.lastSignInTime);
      return lastSignIn >= sevenDaysAgo;
    });

    // Separate returning vs new users
    const returningUsersList = activeUsersInPeriod.filter(u => {
      const createdDate = u.creationTime
        ? new Date(u.creationTime).toISOString().split('T')[0]
        : null;
      return !createdDate || !dates.includes(createdDate); // Created before the 7-day window
    });

    const newUsersList = activeUsersInPeriod.filter(u => {
      const createdDate = u.creationTime
        ? new Date(u.creationTime).toISOString().split('T')[0]
        : null;
      return createdDate && dates.includes(createdDate); // Created within the 7-day window
    });

    // Sort both by last sign-in (most recent first)
    const sortByLastSignIn = (a: typeof allUsers[0], b: typeof allUsers[0]) => {
      const aTime = a.lastSignInTime ? new Date(a.lastSignInTime).getTime() : 0;
      const bTime = b.lastSignInTime ? new Date(b.lastSignInTime).getTime() : 0;
      return bTime - aTime;
    };

    returningUsersList.sort(sortByLastSignIn);
    newUsersList.sort(sortByLastSignIn);

    // Include ALL returning users + up to 50 most recent new users
    const recentActiveUsers = [
      ...returningUsersList,
      ...newUsersList.slice(0, 50),
    ];

    // Fetch review session counts for recent users (batch query)
    const recentUsers: UserDetail[] = [];

    if (adminFirestore && recentActiveUsers.length > 0) {
      const db = adminFirestore; // Local reference for TypeScript

      // Batch fetch session counts - do in chunks of 10 for performance
      const chunks = [];
      for (let i = 0; i < recentActiveUsers.length; i += 10) {
        chunks.push(recentActiveUsers.slice(i, i + 10));
      }

      for (const chunk of chunks) {
        const sessionPromises = chunk.map(async (user) => {
          try {
            // Get session count
            const sessionsSnap = await db
              .collection('users')
              .doc(user.uid)
              .collection('sessions')
              .count()
              .get();

            const sessionCount = sessionsSnap.data().count;

            // Determine if new or returning
            const createdDate = user.creationTime
              ? new Date(user.creationTime).toISOString().split('T')[0]
              : null;
            const lastSignInDate = user.lastSignInTime
              ? new Date(user.lastSignInTime).toISOString().split('T')[0]
              : null;
            const isNew = createdDate && dates.includes(createdDate);

            return {
              uid: user.uid,
              email: user.email || null,
              displayName: user.displayName || null,
              createdAt: user.creationTime || null,
              lastSignIn: user.lastSignInTime || null,
              type: (isNew ? 'new' : 'returning') as 'new' | 'returning',
              reviewSessions: sessionCount,
            };
          } catch (err) {
            // If we can't get sessions, still return user info
            const createdDate = user.creationTime
              ? new Date(user.creationTime).toISOString().split('T')[0]
              : null;
            const isNew = createdDate && dates.includes(createdDate);

            return {
              uid: user.uid,
              email: user.email || null,
              displayName: user.displayName || null,
              createdAt: user.creationTime || null,
              lastSignIn: user.lastSignInTime || null,
              type: (isNew ? 'new' : 'returning') as 'new' | 'returning',
              reviewSessions: 0,
            };
          }
        });

        const results = await Promise.all(sessionPromises);
        recentUsers.push(...results);
      }
    } else {
      // No Firestore, just return basic user info
      for (const user of recentActiveUsers) {
        const createdDate = user.creationTime
          ? new Date(user.creationTime).toISOString().split('T')[0]
          : null;
        const isNew = createdDate && dates.includes(createdDate);

        recentUsers.push({
          uid: user.uid,
          email: user.email || null,
          displayName: user.displayName || null,
          createdAt: user.creationTime || null,
          lastSignIn: user.lastSignInTime || null,
          type: isNew ? 'new' : 'returning',
          reviewSessions: 0,
        });
      }
    }

    const summary: UserEngagementSummary = {
      totalUsers: allUsers.length,
      newUsersLast7Days: totalNewInPeriod,
      returningUsersLast7Days: totalReturningInPeriod,
      retentionRate,
      dailyBreakdown,
      recentUsers,
    };

    return NextResponse.json({
      success: true,
      data: summary,
      metadata: {
        generatedAt: new Date().toISOString(),
        periodStart: dates[0],
        periodEnd: dates[dates.length - 1],
        totalUsersAnalyzed: allUsers.length,
      },
    });

  } catch (error: any) {
    console.error('[API /admin/analytics/returning-users] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch returning users data',
        message: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
});
