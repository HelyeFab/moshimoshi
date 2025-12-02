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
    const difficulty = searchParams.get('difficulty');
    const category = searchParams.get('category');
    const searchQuery = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '12');
    const offset = parseInt(searchParams.get('offset') || '0');
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

    // Build base query
    let query: any = db.collection('news_articles');

    // Add filters
    const filters: any[] = [];
    if (source && source !== 'all') filters.push(['source', '==', source]);
    if (difficulty && difficulty !== 'all') filters.push(['difficulty', '==', difficulty]);
    if (category && category !== 'all') filters.push(['category', '==', category]);

    // Apply filters
    filters.forEach(([field, op, value]) => {
      query = query.where(field, op, value);
    });

    // Always order by publishDate
    query = query.orderBy('publishDate', 'desc');

    // Get total count for pagination
    const countSnapshot = await query.get();
    const totalCount = countSnapshot.size;

    // Apply pagination
    query = query.limit(limit);
    if (offset > 0) {
      // Get the last document from previous page to use as cursor
      let offsetQuery: any = db.collection('news_articles');
      filters.forEach(([field, op, value]) => {
        offsetQuery = offsetQuery.where(field, op, value);
      });
      const offsetSnapshot = await offsetQuery
        .orderBy('publishDate', 'desc')
        .limit(offset)
        .get();

      if (!offsetSnapshot.empty) {
        const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1];
        query = query.startAfter(lastDoc);
      }
    }

    // Fetch articles
    const snapshot = await query.get();

    if (snapshot.empty && offset === 0) {
      // Return fallback articles if no articles found
      const fallbackArticles = getFallbackArticles();
      return NextResponse.json({
        success: true,
        articles: fallbackArticles,
        totalCount: fallbackArticles.length,
        hasMore: false,
        meta: {
          cached: false,
          fallback: true
        }
      });
    }

    // Convert to array and format dates
    const articles = snapshot.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        publishDate: data.publishDate?.toDate?.() || data.publishDate,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        lastUpdated: data.lastUpdated?.toDate?.() || data.lastUpdated
      };
    });

    // Filter by search query if provided (client-side for simplicity)
    let filteredArticles = articles;
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      filteredArticles = articles.filter((article: { title?: string; summary?: string; content?: string }) =>
        article.title?.toLowerCase().includes(lowerQuery) ||
        article.summary?.toLowerCase().includes(lowerQuery) ||
        article.content?.toLowerCase().includes(lowerQuery)
      );
    }

    const hasMore = (offset + limit) < totalCount;

    return NextResponse.json({
      success: true,
      articles: filteredArticles,
      totalCount,
      hasMore,
      meta: {
        offset,
        limit,
        cached: false
      }
    });
  } catch (error) {
    console.error('Error fetching articles:', error);

    // Return fallback data on error
    const fallbackArticles = getFallbackArticles();
    return NextResponse.json({
      success: true,
      articles: fallbackArticles,
      totalCount: fallbackArticles.length,
      hasMore: false,
      meta: {
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