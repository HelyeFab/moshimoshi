import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin/adminAuth';
import { adminDb } from '@/lib/firebase/admin';
import { getUserOverrides } from '@/lib/entitlements/adminEvaluator';

/**
 * GET /api/admin/users
 * Gets a list of all users with their subscription info and override counts
 * 
 * Query params:
 * - limit: Number of users to return (default: 50, max: 200)
 * - page: Page number for pagination (default: 1)
 * - search: Search by email or display name
 * - plan: Filter by plan (guest, free, premium)
 * - hasOverrides: Filter by users with overrides (true/false)
 */
export const GET = withAdminAuth(async (request: NextRequest, context) => {
  try {
    const { searchParams } = new URL(request.url);
    
    const limitParam = searchParams.get('limit');
    const pageParam = searchParams.get('page');
    const search = searchParams.get('search');
    const plan = searchParams.get('plan');
    const hasOverrides = searchParams.get('hasOverrides');

    // Validate and parse limit
    let limit = 50;
    if (limitParam) {
      limit = parseInt(limitParam, 10);
      if (isNaN(limit) || limit < 1 || limit > 200) {
        return NextResponse.json(
          { error: 'Invalid limit. Must be between 1 and 200' },
          { status: 400 }
        );
      }
    }

    // Validate and parse page
    let page = 1;
    if (pageParam) {
      page = parseInt(pageParam, 10);
      if (isNaN(page) || page < 1) {
        return NextResponse.json(
          { error: 'Invalid page. Must be a positive integer' },
          { status: 400 }
        );
      }
    }

    // Validate plan filter
    if (plan && !['guest', 'free', 'premium', 'admin'].includes(plan)) {
      return NextResponse.json(
        { error: 'Invalid plan. Must be guest, free, premium, or admin' },
        { status: 400 }
      );
    }

    // Build query
    let query = adminDb.collection('users').orderBy('createdAt', 'desc');

    // Apply plan filter
    if (plan) {
      query = query.where('subscription.plan', '==', plan);
    }

    // Get all users (we'll filter by search and overrides in memory)
    const snapshot = await query.get();
    let users = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      users = users.filter(user => 
        user.email?.toLowerCase().includes(searchLower) ||
        user.displayName?.toLowerCase().includes(searchLower) ||
        user.id.toLowerCase().includes(searchLower)
      );
    }

    // Get override counts for each user (batch for efficiency)
    const usersWithOverrides = await Promise.all(
      users.map(async (user) => {
        const overrides = await getUserOverrides(user.id);
        const overrideCount = Object.keys(overrides).length;
        
        return {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          plan: user.subscription?.plan || 'guest',
          subscriptionStatus: user.subscription?.status,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
          overrideCount,
          hasOverrides: overrideCount > 0
        };
      })
    );

    // Apply hasOverrides filter
    let filteredUsers = usersWithOverrides;
    if (hasOverrides === 'true') {
      filteredUsers = usersWithOverrides.filter(u => u.hasOverrides);
    } else if (hasOverrides === 'false') {
      filteredUsers = usersWithOverrides.filter(u => !u.hasOverrides);
    }

    // Calculate pagination
    const totalCount = filteredUsers.length;
    const totalPages = Math.ceil(totalCount / limit);
    const startIndex = (page - 1) * limit;
    const paginatedUsers = filteredUsers.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      users: paginatedUsers,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      },
      filters: {
        search,
        plan,
        hasOverrides
      },
      retrievedBy: context.user.uid,
      retrievedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting users:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get users',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
});