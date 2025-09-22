import { NextRequest, NextResponse } from 'next/server';
import { firestore as db } from '@/lib/firebase/client';
import { collection, getDocs, query, where, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { NewsArticle } from '@/types/news';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const articleId = searchParams.get('id');
    const source = searchParams.get('source');
    const maxResults = parseInt(searchParams.get('limit') || '20');

    if (articleId) {
      // Get single article by ID
      const articleRef = doc(db, 'newsArticles', articleId);
      const articleDoc = await getDoc(articleRef);
      
      if (!articleDoc.exists()) {
        return NextResponse.json(
          { error: 'Article not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: { id: articleDoc.id, ...articleDoc.data() } as NewsArticle
      });
    }

    // Get multiple articles
    let q = query(collection(db, 'newsArticles'));

    // Add filters
    if (source) {
      q = query(q, where('source.id', '==', source));
    }

    // Add ordering and limit
    q = query(q, orderBy('publishDate', 'desc'), limit(maxResults));

    const querySnapshot = await getDocs(q);
    const articles: NewsArticle[] = [];

    querySnapshot.forEach((doc) => {
      articles.push({ id: doc.id, ...doc.data() } as NewsArticle);
    });

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
    return NextResponse.json(
      { error: 'Failed to fetch articles', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}