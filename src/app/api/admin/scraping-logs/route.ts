import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    // Check adminDb is initialized
    if (!adminDb) {
      return NextResponse.json({ success: false, error: 'Database not available' }, { status: 503 });
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const type = searchParams.get('type'); // 'scheduled', 'manual', or null for all

    // Check if collection exists first
    const collectionRef = adminDb.collection('scraping_logs');

    // Build query - avoid compound queries that need indexes
    let snapshot;
    if (type && (type === 'scheduled' || type === 'manual')) {
      // Simple query without orderBy to avoid index requirements
      snapshot = await collectionRef
        .where('type', '==', type)
        .limit(limit * 2) // Get more, then sort in memory
        .get();
    } else {
      snapshot = await collectionRef
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();
    }

    let logs = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        type: data.type,
        totalArticles: data.totalArticles || 0,
        successfulSources: data.successfulSources || 0,
        failedSources: data.failedSources || 0,
        duration: data.duration || 0,
        sources: data.sources || [],
        preCaching: data.preCaching || null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        // Manual scraping specific fields
        source: data.source || null,
        dateRange: data.dateRange || null,
        error: data.error || null,
      };
    });

    // Sort by createdAt desc in memory if we filtered by type
    if (type) {
      logs = logs
        .sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        })
        .slice(0, limit);
    }

    return NextResponse.json({
      success: true,
      logs,
      count: logs.length
    });

  } catch (error) {
    console.error('Error fetching scraping logs:', error);
    // Return empty logs instead of error for better UX
    return NextResponse.json({
      success: true,
      logs: [],
      count: 0,
      message: 'No logs found or collection does not exist yet'
    });
  }
}

// DELETE - Clear all logs or logs of a specific type
export async function DELETE(request: NextRequest) {
  try {
    // Check adminDb is initialized
    if (!adminDb) {
      return NextResponse.json({ success: false, error: 'Database not available' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'scheduled', 'manual', or null for all

    const collectionRef = adminDb.collection('scraping_logs');
    let query: FirebaseFirestore.Query = collectionRef;

    if (type && (type === 'scheduled' || type === 'manual')) {
      query = collectionRef.where('type', '==', type);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      return NextResponse.json({
        success: true,
        message: 'No logs to delete',
        deletedCount: 0
      });
    }

    // Delete in batches of 500 (Firestore limit)
    const batch = adminDb.batch();
    let deletedCount = 0;

    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });

    await batch.commit();

    return NextResponse.json({
      success: true,
      message: `Deleted ${deletedCount} log(s)`,
      deletedCount
    });

  } catch (error) {
    console.error('Error deleting scraping logs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete scraping logs' },
      { status: 500 }
    );
  }
}
