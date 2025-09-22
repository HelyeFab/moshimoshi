import { NextRequest, NextResponse } from 'next/server';
import { scrapeNHKEasy } from '@/utils/scrapers/nhk-easy';
import { scrapeTodaii } from '@/utils/scrapers/todaii';
import { scrapeWatanoc } from '@/utils/scrapers/watanoc';
import { scrapeMainichiNews } from '@/utils/scrapers/mainichi-news';
import { scrapeMainichiShogakusei } from '@/utils/scrapers/mainichi-shogakusei';
import { db } from '@/lib/firebase/admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

// Simple in-memory cache to prevent too frequent scraping
const scrapeCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const source = searchParams.get('source') || 'nhk-easy';
    const force = searchParams.get('force') === 'true';

    // Check cache if not forcing
    if (!force) {
      const cached = scrapeCache.get(source);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return NextResponse.json({
          ...cached.data,
          cached: true,
          cacheAge: Math.round((Date.now() - cached.timestamp) / 1000)
        });
      }
    }

    let articles;
    let scraperName;

    switch (source) {
      case 'nhk-easy':
        articles = await scrapeNHKEasy();
        scraperName = 'NHK Easy';
        break;
      case 'todaii':
        articles = await scrapeTodaii();
        scraperName = 'Todaii';
        break;
      case 'watanoc':
        articles = await scrapeWatanoc();
        scraperName = 'Watanoc';
        break;
      case 'mainichi-news':
        articles = await scrapeMainichiNews();
        scraperName = 'Mainichi News';
        break;
      case 'mainichi-shogakusei':
        articles = await scrapeMainichiShogakusei();
        scraperName = 'Mainichi Shogakusei';
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid news source. Supported: nhk-easy, todaii, watanoc, mainichi-news, mainichi-shogakusei' },
          { status: 400 }
        );
    }

    // Store in Firestore
    if (articles.length > 0 && db) {
      try {
        const batch = db.batch();

        for (const article of articles) {
          const docRef = db.collection('news_articles').doc(article.id);
          batch.set(docRef, {
            ...article,
            publishDate: Timestamp.fromDate(article.publishDate),
            createdAt: FieldValue.serverTimestamp(),
            lastUpdated: FieldValue.serverTimestamp(),
          }, { merge: true });
        }

        await batch.commit();
        console.log(`✅ Stored ${articles.length} articles in Firestore`);
      } catch (error) {
        console.error('❌ Failed to store in Firestore:', error);
        // Continue even if storage fails
      }
    }

    const result = {
      success: true,
      source: scraperName,
      articlesCount: articles.length,
      articles: articles.slice(0, 10), // Return first 10 for preview
      timestamp: new Date().toISOString()
    };

    // Cache the result
    scrapeCache.set(source, {
      data: result,
      timestamp: Date.now()
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('News scraping error:', error);
    return NextResponse.json(
      {
        error: 'Failed to scrape news',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Manual trigger endpoint for testing
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { source = 'nhk-easy', adminKey } = body;

    // Simple admin key check for manual triggers
    if (adminKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Force a fresh scrape
    const url = new URL(request.url);
    url.searchParams.set('source', source);
    url.searchParams.set('force', 'true');

    // Call the GET handler
    const getRequest = new NextRequest(url, {
      method: 'GET',
      headers: request.headers
    });

    return GET(getRequest);
  } catch (error) {
    console.error('Manual scrape error:', error);
    return NextResponse.json(
      {
        error: 'Failed to trigger manual scrape',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}