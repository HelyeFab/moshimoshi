import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin';
import { validateSession } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  try {
    // Ensure Firebase Admin is initialized
    ensureAdminInitialized();

    // Check if database is initialized
    if (!adminDb) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    // Validate admin session (use cookie-based auth)
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
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const featureId = searchParams.get('featureId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = adminDb.collection('logs').doc('entitlements').collection('decisions')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .offset(offset);

    // Apply filters
    if (userId) {
      query = query.where('userId', '==', userId);
    }
    if (featureId) {
      query = query.where('featureId', '==', featureId);
    }
    if (startDate) {
      query = query.where('timestamp', '>=', new Date(startDate));
    }
    if (endDate) {
      query = query.where('timestamp', '<=', new Date(endDate));
    }

    // Execute query
    const snapshot = await query.get();
    const logs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate?.() || doc.data().timestamp
    }));

    // Get total count for pagination
    const countQuery = adminDb.collection('logs').doc('entitlements').collection('decisions');
    const countSnapshot = await countQuery.count().get();
    const totalCount = countSnapshot.data().count;

    return NextResponse.json({
      logs,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    });
  } catch (error) {
    console.error('Error fetching decision logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch decision logs' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Check if database is initialized
    if (!adminDb) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    // Verify authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await verifyIdToken(token);
    
    // Check admin permission
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();
    
    if (!userData?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { olderThanDays = 30 } = body;

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    // Delete old logs in batches
    const batchSize = 500;
    let deleted = 0;

    while (true) {
      const snapshot = await adminDb.collection('logs')
        .doc('entitlements')
        .collection('decisions')
        .where('timestamp', '<', cutoffDate)
        .limit(batchSize)
        .get();

      if (snapshot.empty) {
        break;
      }

      const batch = adminDb.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      deleted += snapshot.size;
    }

    return NextResponse.json({
      message: `Deleted ${deleted} decision logs older than ${olderThanDays} days`,
      deleted,
      cutoffDate: cutoffDate.toISOString()
    });
  } catch (error) {
    console.error('Error deleting decision logs:', error);
    return NextResponse.json(
      { error: 'Failed to delete decision logs' },
      { status: 500 }
    );
  }
}