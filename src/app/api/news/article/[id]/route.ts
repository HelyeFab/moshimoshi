import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/admin';

// Cache for individual articles
const articleCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: articleId } = await params;

  try {

    if (!articleId) {
      return NextResponse.json(
        { error: 'Article ID is required' },
        { status: 400 }
      );
    }

    // Check cache first
    const cached = articleCache.get(articleId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json({
        success: true,
        article: cached.data,
        cached: true
      });
    }

    if (!db) {
      // If database is not available, skip to catch block to use fallback
      throw new Error('Database not initialized');
    }

    // Try to fetch from news_articles collection
    const articleDoc = await db.collection('news_articles').doc(articleId).get();

    if (!articleDoc.exists) {
      // Fallback: Try to fetch by matching URL or title
      const querySnapshot = await db.collection('news_articles')
        .where('id', '==', articleId)
        .limit(1)
        .get();

      if (querySnapshot.empty) {
        // Article not found in database, use fallback
        throw new Error('Article not found in database');
      }

      const doc = querySnapshot.docs[0];
      const data = doc.data();

      const article = {
        id: doc.id,
        ...data,
        publishDate: data.publishDate?.toDate?.() || data.publishDate,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        lastUpdated: data.lastUpdated?.toDate?.() || data.lastUpdated
      };

      // Cache the article
      articleCache.set(articleId, {
        data: article,
        timestamp: Date.now()
      });

      return NextResponse.json({
        success: true,
        article
      });
    }

    const data = articleDoc.data();
    const article = {
      id: articleDoc.id,
      ...data,
      publishDate: data?.publishDate?.toDate?.() || data?.publishDate,
      createdAt: data?.createdAt?.toDate?.() || data?.createdAt,
      lastUpdated: data?.lastUpdated?.toDate?.() || data?.lastUpdated
    };

    // Cache the article
    articleCache.set(articleId, {
      data: article,
      timestamp: Date.now()
    });

    return NextResponse.json({
      success: true,
      article
    });

  } catch (error) {
    console.error('Error fetching article:', error);

    // Return a fallback article for testing
    const fallbackArticle = {
      id: articleId,
      title: '日本の四季',
      content: '日本には春、夏、秋、冬の四つの季節があります。春には桜が咲き、夏には海や山で楽しむことができます。秋には紅葉が美しく、冬には雪が降る地域もあります。それぞれの季節に特別な行事や食べ物があり、日本の文化を感じることができます。',
      summary: '日本の四季の特徴と文化',
      url: '#',
      source: 'NHK Easy',
      category: 'culture',
      difficulty: 'N5',
      publishDate: new Date().toISOString(),
      tags: ['seasons', 'culture', 'japan'],
      metadata: {
        wordCount: 150,
        readingTime: 1,
        hasFurigana: false
      }
    };

    return NextResponse.json({
      success: true,
      article: fallbackArticle,
      fallback: true,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}