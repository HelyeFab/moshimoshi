import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      );
    }

    // Get article counts from the last 24 hours
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const articlesSnapshot = await db
      .collection('news_articles')
      .where('createdAt', '>=', twentyFourHoursAgo)
      .limit(100)
      .get();

    const articlesBySource: Record<string, number> = {};
    articlesSnapshot.forEach(doc => {
      const source = doc.data().source || 'Unknown';
      articlesBySource[source] = (articlesBySource[source] || 0) + 1;
    });

    // Get recent scraping logs
    const logsSnapshot = await db
      .collection('scraping_logs')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

    const logs = logsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null
    }));

    return NextResponse.json({
      success: true,
      health: {
        status: articlesSnapshot.size > 0 ? 'healthy' : 'warning',
        lastRun: logs[0]?.createdAt || null,
        articlesLast24h: articlesSnapshot.size
      },
      stats: {
        articlesBySource,
        recentLogs: logs
      }
    });

  } catch (error) {
    console.error('Error fetching health status:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch health status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}