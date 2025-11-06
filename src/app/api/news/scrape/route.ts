import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory cache to prevent too frequent scraping
const scrapeCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

// Firebase Function URL
const FIREBASE_FUNCTION_URL = `https://us-central1-moshimoshi-de237.cloudfunctions.net/manualNewsScraperFunction`;

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

    console.log(`[Moshimoshi Admin] Triggering ${source} scraper via Firebase Function`);

    // Call the Firebase Function via HTTP with admin key
    try {
      const adminKey = process.env.NEWS_SCRAPER_ADMIN_KEY || 'news-scraper-admin-2025';

      const functionResponse = await fetch(FIREBASE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            source,
            timestamp: new Date().toISOString(),
            adminKey
          }
        })
      });

      if (!functionResponse.ok) {
        const errorText = await functionResponse.text();
        throw new Error(`Function returned ${functionResponse.status}: ${errorText}`);
      }

      const data = await functionResponse.json();
      const result = data.result;

      if (!result.success) {
        throw new Error(result.message || 'Scraping failed');
      }

      // Map source endpoint to display name
      const sourceNameMap: Record<string, string> = {
        'nhk-easy': 'NHK Easy',
        'todaii': 'Todaii',
        'watanoc': 'Watanoc',
        'mainichi-news': 'Mainichi News',
        'mainichi-shogakusei': 'Mainichi Elementary'
      };

      const sourceName = sourceNameMap[source] || source;

      const response = {
        success: true,
        source: sourceName,
        articlesCount: result.summary?.sources?.[sourceName]?.articles || result.summary?.totalArticles || 0,
        timestamp: new Date().toISOString(),
        summary: result.summary
      };

      // Cache the result
      scrapeCache.set(source, {
        data: response,
        timestamp: Date.now()
      });

      console.log(`[Moshimoshi Admin] Successfully scraped ${response.articlesCount} articles from ${source}`);

      return NextResponse.json(response);

    } catch (functionError) {
      console.error('[Moshimoshi Admin] Firebase Function error:', functionError);
      throw new Error(`Failed to call Firebase Function: ${functionError instanceof Error ? functionError.message : 'Unknown error'}`);
    }

  } catch (error) {
    console.error('[Moshimoshi Admin] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to scrape news',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Manual trigger endpoint for testing (just redirects to GET with force=true)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { source = 'nhk-easy' } = body;

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
    console.error('[Moshimoshi Admin] Manual scrape error:', error);
    return NextResponse.json(
      {
        error: 'Failed to trigger manual scrape',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
