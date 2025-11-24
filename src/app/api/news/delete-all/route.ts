import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    // Simple auth check - allow localhost or require admin key
    const host = request.headers.get('host') || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');

    if (!isLocalhost) {
      const body = await request.json();
      const adminKey = body.adminKey || body.data?.adminKey;

      if (adminKey !== process.env.NEWS_SCRAPER_ADMIN_KEY) {
        return NextResponse.json(
          { error: 'Unauthorized - invalid admin key' },
          { status: 401 }
        );
      }
    }

    if (!db) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      );
    }

    console.log('🗑️  Starting to delete all articles from news_articles collection...');

    const collectionRef = db.collection('news_articles');
    let snapshot = await collectionRef.limit(10).get(); // Start with small batch to check

    if (snapshot.empty) {
      return NextResponse.json({
        success: true,
        message: 'No articles found in the collection',
        deletedCount: 0
      });
    }

    console.log(`📊 Found articles to delete, proceeding with deletion...`);

    // Delete in batches of 500 (Firestore limit)
    const batchSize = 500;
    let deletedCount = 0;

    while (true) {
      snapshot = await collectionRef.limit(batchSize).get();

      if (snapshot.empty) {
        break;
      }

      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      deletedCount += snapshot.size;
      console.log(`🗑️  Deleted ${deletedCount} articles so far...`);
    }

    console.log(`✅ Successfully deleted all ${deletedCount} articles!`);

    return NextResponse.json({
      success: true,
      message: `Successfully deleted all articles`,
      deletedCount
    });

  } catch (error) {
    console.error('❌ Error deleting articles:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete articles',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
