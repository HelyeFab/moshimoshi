/**
 * GET /api/admin/analytics/returning-users
 *
 * Analyzes page visit activity to identify returning users
 * A returning user = active on at least 2 distinct days in the last 7 days (UTC)
 *
 * Uses: users.createdAt and page_visits.startedAt (visitorType=user)
 */

import { NextRequest, NextResponse } from 'next/server';
import { AdminContext } from '@/lib/admin/adminAuth';
import { withAdminAnalyticsRateLimit } from '@/lib/api/admin-analytics-rate-limiter';
import { adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin';

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

    if (!adminFirestore) {
      throw new Error('Firebase Admin Firestore not initialized');
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

    const [usersSnapshot, visitsSnapshot] = await Promise.all([
      adminFirestore.collection('users').get(),
      adminFirestore
        .collection('page_visits')
        .where('startedAt', '>=', sevenDaysAgo)
        .get(),
    ]);

    const allUsers: {
      uid: string;
      email: string | undefined;
      displayName: string | undefined;
      creationTime: string | undefined;
      lastActiveTime: string | undefined;
    }[] = [];

    const userById = new Map<string, typeof allUsers[0]>();

    usersSnapshot.forEach(doc => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate?.() || data.createdAt;
      const lastActive = data.lastActive?.toDate?.() || data.lastActive;

      const userRecord = {
        uid: doc.id,
        email: data.email,
        displayName: data.displayName,
        creationTime: createdAt ? new Date(createdAt).toISOString() : undefined,
        lastActiveTime: lastActive ? new Date(lastActive).toISOString() : undefined,
      };

      allUsers.push(userRecord);
      userById.set(doc.id, userRecord);
    });

    const activityDaysByUser = new Map<string, Set<string>>();
    const activeUsersByDay = new Map<string, Set<string>>();

    visitsSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.visitorType !== 'user') return;
      const userId = typeof data.userId === 'string' ? data.userId : null;
      if (!userId) return;
      if (!data.startedAt) return;
      const startedAt = data.startedAt.toDate ? data.startedAt.toDate() : new Date(data.startedAt);
      const dateKey = startedAt.toISOString().split('T')[0];
      if (!dates.includes(dateKey)) return;

      if (!activityDaysByUser.has(userId)) {
        activityDaysByUser.set(userId, new Set());
      }
      activityDaysByUser.get(userId)!.add(dateKey);

      if (!activeUsersByDay.has(dateKey)) {
        activeUsersByDay.set(dateKey, new Set());
      }
      activeUsersByDay.get(dateKey)!.add(userId);
    });

    // Initialize daily stats
    const dailyStats: Record<string, { newUsers: Set<string>; returningUsers: Set<string> }> = {};
    for (const date of dates) {
      dailyStats[date] = { newUsers: new Set(), returningUsers: new Set() };
    }

    // Analyze each user
    const newUsersInPeriod = new Set<string>();

    for (const user of allUsers) {
      if (!user.creationTime) continue;
      const createdDate = new Date(user.creationTime).toISOString().split('T')[0];
      if (dates.includes(createdDate)) {
        dailyStats[createdDate].newUsers.add(user.uid);
        newUsersInPeriod.add(user.uid);
      }
    }

    const returningUsersSet = new Set(
      Array.from(activityDaysByUser.entries())
        .filter(([, days]) => days.size >= 2)
        .map(([userId]) => userId)
    );

    // Build daily breakdown
    const dailyBreakdown: DailyUserStats[] = dates.map(date => {
      const activeSet = activeUsersByDay.get(date) || new Set();
      const returningCount = Array.from(activeSet).filter(uid => returningUsersSet.has(uid)).length;
      return {
        date,
        newUsers: dailyStats[date].newUsers.size,
        returningUsers: returningCount,
        totalActive: activeSet.size,
      };
    });

    // Calculate retention rate
    // Users who were created before the 7-day window and returned during it
    const activeUsersSet = new Set(activityDaysByUser.keys());
    const retentionRate = activeUsersSet.size > 0
      ? Math.round((returningUsersSet.size / activeUsersSet.size) * 100)
      : 0;

    // Build list of users - prioritize ALL returning users, then recent new users
    // This ensures returning users always appear in the list
    const activeUsersInPeriod = Array.from(activeUsersSet)
      .map((uid) => userById.get(uid))
      .filter((user): user is typeof allUsers[0] => Boolean(user));

    const returningUsersList = activeUsersInPeriod.filter(u => returningUsersSet.has(u.uid));
    const newUsersList = activeUsersInPeriod.filter(u => !returningUsersSet.has(u.uid));

    // Sort both by last sign-in (most recent first)
    const sortByLastSignIn = (a: typeof allUsers[0], b: typeof allUsers[0]) => {
      const aTime = a.lastActiveTime ? new Date(a.lastActiveTime).getTime() : 0;
      const bTime = b.lastActiveTime ? new Date(b.lastActiveTime).getTime() : 0;
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
            const isReturning = returningUsersSet.has(user.uid);

        return {
          uid: user.uid,
          email: user.email || null,
          displayName: user.displayName || null,
          createdAt: user.creationTime || null,
          lastSignIn: user.lastActiveTime || null,
          type: (isReturning ? 'returning' : 'new') as 'new' | 'returning',
          reviewSessions: sessionCount,
        };
          } catch (err) {
            // If we can't get sessions, still return user info
            const isReturning = returningUsersSet.has(user.uid);

            return {
              uid: user.uid,
              email: user.email || null,
              displayName: user.displayName || null,
              createdAt: user.creationTime || null,
              lastSignIn: user.lastActiveTime || null,
              type: (isReturning ? 'returning' : 'new') as 'new' | 'returning',
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
        const isReturning = returningUsersSet.has(user.uid);

        recentUsers.push({
          uid: user.uid,
          email: user.email || null,
          displayName: user.displayName || null,
          createdAt: user.creationTime || null,
          lastSignIn: user.lastActiveTime || null,
          type: isReturning ? 'returning' : 'new',
          reviewSessions: 0,
        });
      }
    }

    const summary: UserEngagementSummary = {
      totalUsers: allUsers.length,
      newUsersLast7Days: newUsersInPeriod.size,
      returningUsersLast7Days: returningUsersSet.size,
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
