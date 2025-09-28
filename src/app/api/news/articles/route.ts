import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';

// Cache for articles
let articlesCache: { data: any; timestamp: number } | null = null;
const CACHE_DURATION = 1000 * 60 * 10; // 10 minutes

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const articleId = searchParams.get('id');
    const source = searchParams.get('source');
    const maxResults = parseInt(searchParams.get('limit') || '50');
    const forceRefresh = searchParams.get('refresh') === 'true';

    // Optional: Get session for user tracking
    const session = await getSession();
    const userId = session?.uid || 'anonymous';

    if (!db) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      );
    }

    if (articleId) {
      // Get single article by ID
      const articleDoc = await db.collection('news_articles').doc(articleId).get();

      if (!articleDoc.exists) {
        return NextResponse.json(
          { error: 'Article not found' },
          { status: 404 }
        );
      }

      const data = articleDoc.data();
      return NextResponse.json({
        success: true,
        data: {
          id: articleDoc.id,
          ...data,
          publishDate: data?.publishDate?.toDate?.() || data?.publishDate,
          createdAt: data?.createdAt?.toDate?.() || data?.createdAt
        }
      });
    }

    // Check cache for list requests
    if (!forceRefresh && articlesCache && Date.now() - articlesCache.timestamp < CACHE_DURATION) {
      return NextResponse.json({
        success: true,
        data: articlesCache.data,
        meta: {
          total: articlesCache.data.length,
          cached: true
        }
      });
    }

    // Build query for multiple articles
    let query = db.collection('news_articles')
      .orderBy('publishDate', 'desc')
      .limit(maxResults);

    // Add source filter if specified
    if (source) {
      query = db.collection('news_articles')
        .where('source', '==', source)
        .orderBy('publishDate', 'desc')
        .limit(maxResults);
    }

    // Fetch articles
    const snapshot = await query.get();

    if (snapshot.empty) {
      // Return fallback articles if no articles found
      const fallbackArticles = getFallbackArticles();
      return NextResponse.json({
        success: true,
        data: fallbackArticles,
        meta: {
          total: fallbackArticles.length,
          cached: false,
          fallback: true
        }
      });
    }

    // Convert to array and format dates
    const articles = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        publishDate: data.publishDate?.toDate?.() || data.publishDate,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        lastUpdated: data.lastUpdated?.toDate?.() || data.lastUpdated
      };
    });

    // Update cache
    articlesCache = {
      data: articles,
      timestamp: Date.now()
    };

    return NextResponse.json({
      success: true,
      data: articles,
      meta: {
        total: articles.length,
        cached: false
      }
    });
  } catch (error) {
    console.error('Error fetching articles:', error);

    // Return fallback data on error
    const fallbackArticles = getFallbackArticles();
    return NextResponse.json({
      success: true,
      data: fallbackArticles,
      meta: {
        total: fallbackArticles.length,
        cached: false,
        fallback: true,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
}

// Fallback articles for when database is unavailable
function getFallbackArticles() {
  return [
    {
      id: 'fallback-1',
      title: '日本の文化について',
      content: '日本には古い歴史と豊かな文化があります。茶道、華道、書道などの伝統的な芸術は、今でも多くの人に愛されています。',
      summary: '日本の伝統文化についての紹介',
      url: '#',
      source: 'NHK Easy',
      category: 'culture',
      difficulty: 'N4',
      publishDate: new Date().toISOString(),
      tags: ['culture', 'tradition'],
      metadata: {
        wordCount: 100,
        readingTime: 1,
        hasFurigana: true
      }
    },
    {
      id: 'fallback-2',
      title: '東京の観光地',
      content: '東京にはたくさんの観光地があります。浅草寺、東京タワー、スカイツリーなど、国内外から多くの観光客が訪れます。',
      summary: '東京の人気観光スポット',
      url: '#',
      source: 'NHK Easy',
      category: 'travel',
      difficulty: 'N5',
      publishDate: new Date().toISOString(),
      tags: ['tokyo', 'tourism'],
      metadata: {
        wordCount: 80,
        readingTime: 1,
        hasFurigana: true
      }
    },
    {
      id: 'fallback-3',
      title: '日本の四季',
      content: '日本には春、夏、秋、冬の四つの季節があります。春には桜が咲き、秋には紅葉が美しいです。',
      summary: '日本の四季の特徴',
      url: '#',
      source: 'NHK Easy',
      category: 'nature',
      difficulty: 'N5',
      publishDate: new Date().toISOString(),
      tags: ['seasons', 'nature'],
      metadata: {
        wordCount: 60,
        readingTime: 1,
        hasFurigana: true
      }
    }
  ];
}