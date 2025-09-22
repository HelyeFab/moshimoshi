import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminFirestore as db } from '@/lib/firebase/admin';
import { getFunctions } from 'firebase-admin/functions';
import { getApps } from 'firebase-admin/app';

// Use the existing Firebase Admin initialization
const functions = getApps()[0] ? getFunctions() : null;

// News source configuration
const NEWS_SOURCES = {
  nhkEasy: {
    id: 'nhkEasy',
    name: 'NHK Easy',
    functionName: 'scrapeNHKEasy',
    emoji: '📺',
  },
  watanoc: {
    id: 'watanoc',
    name: 'Watanoc',
    functionName: 'scrapeWatanoc',
    emoji: '🏯',
  },
  mainichiShogakusei: {
    id: 'mainichiShogakusei',
    name: 'Mainichi Elementary',
    functionName: 'scrapeMainichiShogakusei',
    emoji: '🎒',
  },
};

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);

    // Check if user is admin
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();

    if (!userData?.isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get source from request
    const { source, all = false } = await request.json();

    if (all) {
      // Trigger all sources
      const results = await Promise.allSettled(
        Object.entries(NEWS_SOURCES).map(async ([key, config]) => {
          try {
            // Call Firebase Function via HTTP
            const functionUrl = `https://${process.env.FIREBASE_REGION || 'us-central1'}-${process.env.FIREBASE_PROJECT_ID}.cloudfunctions.net/${config.functionName}`;

            const response = await fetch(functionUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                trigger: 'manual',
                source: config.id,
                timestamp: new Date().toISOString(),
              }),
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            return {
              source: config.id,
              success: true,
              articlesScraped: data.articlesScraped || 0,
            };
          } catch (error) {
            return {
              source: config.id,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        })
      );

      const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const totalArticles = results.reduce((acc, r) => {
        if (r.status === 'fulfilled' && r.value.success) {
          return acc + (r.value.articlesScraped || 0);
        }
        return acc;
      }, 0);

      return NextResponse.json({
        success: true,
        message: `Triggered ${successCount}/${Object.keys(NEWS_SOURCES).length} sources`,
        totalArticles,
        details: results.map(r => r.status === 'fulfilled' ? r.value : { success: false }),
      });
    } else {
      // Trigger single source
      if (!source || !NEWS_SOURCES[source as keyof typeof NEWS_SOURCES]) {
        return NextResponse.json(
          { error: 'Invalid source specified' },
          { status: 400 }
        );
      }

      const config = NEWS_SOURCES[source as keyof typeof NEWS_SOURCES];
      const functionUrl = `https://${process.env.FIREBASE_REGION || 'us-central1'}-${process.env.FIREBASE_PROJECT_ID}.cloudfunctions.net/${config.functionName}`;

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trigger: 'manual',
          source: config.id,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Scraping function returned ${response.status}`);
      }

      const data = await response.json();

      // Log the trigger event
      await db.collection('admin_logs').add({
        action: 'trigger_scraping',
        source: config.id,
        userId: decodedToken.uid,
        userEmail: decodedToken.email,
        timestamp: new Date(),
        success: true,
        articlesScraped: data.articlesScraped || 0,
      });

      return NextResponse.json({
        success: true,
        source: config.id,
        message: `Successfully triggered ${config.name} scraping`,
        articlesScraped: data.articlesScraped || 0,
      });
    }
  } catch (error) {
    console.error('Error triggering scraping:', error);
    return NextResponse.json(
      {
        error: 'Failed to trigger scraping',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}