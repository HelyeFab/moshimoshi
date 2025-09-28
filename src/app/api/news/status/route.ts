import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  try {
    // Optional: Check if user is authenticated
    const session = await getSession();

    if (!db) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      );
    }

    // Get scraping logs from the last 24 hours
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const logsSnapshot = await db
      .collection('scraping_logs')
      .where('createdAt', '>=', twentyFourHoursAgo)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    const logs = logsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
    }));

    // Get article counts by source from the last 24 hours
    const articlesSnapshot = await db
      .collection('news_articles')
      .where('createdAt', '>=', twentyFourHoursAgo)
      .get();

    const articlesBySource: Record<string, number> = {};
    let totalArticles = 0;

    articlesSnapshot.forEach(doc => {
      const source = doc.data().source || 'Unknown';
      articlesBySource[source] = (articlesBySource[source] || 0) + 1;
      totalArticles++;
    });

    // Get the last successful scrape time for each source
    const lastSuccessfulScrapes: Record<string, Date | null> = {};
    const sources = ['NHK Easy', 'Todaii', 'Watanoc', 'Mainichi News', 'Mainichi Elementary'];

    for (const source of sources) {
      const lastArticle = await db
        .collection('news_articles')
        .where('source', '==', source)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (!lastArticle.empty) {
        const data = lastArticle.docs[0].data();
        lastSuccessfulScrapes[source] = data.createdAt?.toDate?.() || null;
      } else {
        lastSuccessfulScrapes[source] = null;
      }
    }

    // Calculate health status
    const health = {
      healthy: logs.length > 0 && logs[0]?.success === true,
      lastRun: logs[0]?.createdAt || null,
      nextScheduledRun: calculateNextRun(),
      sources: sources.map(source => ({
        name: source,
        articlesLast24h: articlesBySource[source] || 0,
        lastSuccess: lastSuccessfulScrapes[source],
        status: getSourceStatus(lastSuccessfulScrapes[source])
      }))
    };

    return NextResponse.json({
      success: true,
      health,
      stats: {
        totalArticlesLast24h: totalArticles,
        articlesBySource,
        recentLogs: logs.slice(0, 5)
      },
      user: session?.email || 'anonymous'
    });

  } catch (error) {
    console.error('Error fetching scraping status:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch scraping status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function calculateNextRun(): Date {
  // Scheduled for 6 AM JST daily
  const now = new Date();
  const nextRun = new Date();

  // Convert to JST (UTC+9)
  const jstOffset = 9 * 60; // 9 hours in minutes
  const localOffset = now.getTimezoneOffset();
  const jstTime = new Date(now.getTime() + (jstOffset + localOffset) * 60000);

  // Set to 6 AM JST
  nextRun.setHours(6 - (jstOffset / 60), 0, 0, 0);

  // If it's already past 6 AM JST today, set to tomorrow
  if (nextRun <= now) {
    nextRun.setDate(nextRun.getDate() + 1);
  }

  return nextRun;
}

function getSourceStatus(lastSuccess: Date | null): 'healthy' | 'warning' | 'error' {
  if (!lastSuccess) return 'error';

  const hoursSinceLastSuccess = (Date.now() - lastSuccess.getTime()) / (1000 * 60 * 60);

  if (hoursSinceLastSuccess < 24) return 'healthy';
  if (hoursSinceLastSuccess < 48) return 'warning';
  return 'error';
}