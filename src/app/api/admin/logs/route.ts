import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin/adminAuth';
import { getEntitlementLogs } from '@/lib/entitlements/adminEvaluator';
import { adminFirestore as adminDb } from '@/lib/firebase/admin';
import { FeatureId, EntitlementLog, OverrideLog } from '@/types/entitlements';

/**
 * GET /api/admin/logs
 * Gets entitlement decision logs with optional filters
 * 
 * Query params:
 * - type: 'entitlements' | 'overrides' (default: 'entitlements')
 * - userId: Filter by user ID
 * - featureId: Filter by feature ID
 * - startDate: Filter by start date (ISO string)
 * - endDate: Filter by end date (ISO string)
 * - limit: Limit number of results (default: 100, max: 500)
 * - page: Page number for pagination (default: 1)
 */
export const GET = withAdminAuth(async (request: NextRequest, context) => {
  try {
    const { searchParams } = new URL(request.url);
    
    const type = searchParams.get('type') || 'entitlements';
    const userId = searchParams.get('userId') || undefined;
    const featureId = searchParams.get('featureId') as FeatureId | undefined;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limitParam = searchParams.get('limit');
    const pageParam = searchParams.get('page');

    // Validate type
    if (type !== 'entitlements' && type !== 'overrides') {
      return NextResponse.json(
        { error: 'Invalid type. Must be "entitlements" or "overrides"' },
        { status: 400 }
      );
    }

    // Validate and parse limit
    let limit = 100;
    if (limitParam) {
      limit = parseInt(limitParam, 10);
      if (isNaN(limit) || limit < 1 || limit > 500) {
        return NextResponse.json(
          { error: 'Invalid limit. Must be between 1 and 500' },
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

    // Parse dates
    let startDateObj: Date | undefined;
    let endDateObj: Date | undefined;

    if (startDate) {
      startDateObj = new Date(startDate);
      if (isNaN(startDateObj.getTime())) {
        return NextResponse.json(
          { error: 'Invalid startDate format' },
          { status: 400 }
        );
      }
    }

    if (endDate) {
      endDateObj = new Date(endDate);
      if (isNaN(endDateObj.getTime())) {
        return NextResponse.json(
          { error: 'Invalid endDate format' },
          { status: 400 }
        );
      }
    }

    // Validate featureId if provided
    if (featureId) {
      const validFeatures: FeatureId[] = [
        'reviews', 'drills', 'customLists', 'flashcards',
        'analytics', 'export', 'apiAccess', 'premiumContent',
        'offlineMode', 'themes'
      ];

      if (!validFeatures.includes(featureId)) {
        return NextResponse.json(
          { error: `Invalid featureId. Must be one of: ${validFeatures.join(', ')}` },
          { status: 400 }
        );
      }
    }

    let logs: unknown[] = [];
    let totalCount = 0;

    if (type === 'entitlements') {
      // Get entitlement logs
      logs = await getEntitlementLogs({
        userId,
        featureId,
        startDate: startDateObj,
        endDate: endDateObj,
        limit: limit * page // Get all results up to current page
      });

      // Get total count for pagination
      let countQuery = adminDb
        .collection('logs')
        .doc('entitlements')
        .collection('entries');

      if (userId) countQuery = countQuery.where('userId', '==', userId);
      if (featureId) countQuery = countQuery.where('featureId', '==', featureId);
      if (startDateObj) countQuery = countQuery.where('timestamp', '>=', startDateObj);
      if (endDateObj) countQuery = countQuery.where('timestamp', '<=', endDateObj);

      const countSnapshot = await countQuery.count().get();
      totalCount = countSnapshot.data().count;

      // Paginate results
      const startIndex = (page - 1) * limit;
      logs = logs.slice(startIndex, startIndex + limit);
    } else {
      // Get override logs
      let query = adminDb
        .collection('logs')
        .doc('overrides')
        .collection('entries')
        .orderBy('timestamp', 'desc');

      if (userId) query = query.where('userId', '==', userId);
      if (featureId) query = query.where('featureId', '==', featureId);
      if (startDateObj) query = query.where('timestamp', '>=', startDateObj);
      if (endDateObj) query = query.where('timestamp', '<=', endDateObj);

      // Get total count
      const countSnapshot = await query.count().get();
      totalCount = countSnapshot.data().count;

      // Get paginated results
      const offset = (page - 1) * limit;
      if (offset > 0) {
        query = query.offset(offset);
      }
      query = query.limit(limit);

      const snapshot = await query.get();
      logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    }

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return NextResponse.json({
      type,
      logs,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage,
        hasPreviousPage
      },
      filters: {
        userId,
        featureId,
        startDate: startDateObj?.toISOString(),
        endDate: endDateObj?.toISOString()
      },
      retrievedBy: context.user.uid,
      retrievedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting logs:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get logs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
});