import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// Initialize Firebase Admin if not already initialized
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    storageBucket: 'moshimoshi-de237.firebasestorage.app'
  });
}

const db = getFirestore();
const storage = getStorage();

/**
 * Test endpoint to:
 * 1. Trigger the manual news scraper
 * 2. Check recent articles in Firestore
 * 3. Verify audio files in Storage
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'check';

    if (action === 'trigger') {
      // Trigger the manual scraper via HTTP
      const functionUrl = 'https://us-central1-moshimoshi-de237.cloudfunctions.net/manualNewsScraperFunction';

      console.log('🚀 Triggering manual news scraper...');

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            source: 'nhk-easy',
            adminKey: 'news-scraper-admin-2025'
          }
        })
      });

      const result = await response.json();

      return NextResponse.json({
        success: response.ok,
        scraperResult: result,
        message: response.ok ? 'Scraper triggered successfully' : 'Scraper failed'
      });
    }

    // Default action: check existing articles
    console.log('🔍 Checking Firestore for articles with TTS audio...');

    const articlesRef = db.collection('news_articles');
    const snapshot = await articlesRef
      .where('source', '==', 'NHK Easy')
      .orderBy('publishDate', 'desc')
      .limit(5)
      .get();

    const articles = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title?.substring(0, 50),
        source: data.source,
        audioStatus: data.audioStatus,
        hasAudio: {
          title: !!data.generatedTitleAudioUrl,
          summary: !!data.generatedSummaryAudioUrl,
          content: !!data.generatedContentAudioUrl
        },
        audioProvider: data.audioProvider,
        audioVoice: data.audioVoice,
        audioError: data.audioError,
        urls: {
          title: data.generatedTitleAudioUrl,
          summary: data.generatedSummaryAudioUrl,
          content: data.generatedContentAudioUrl
        }
      };
    });

    // Check storage for audio files
    const bucket = storage.bucket();
    const [files] = await bucket.getFiles({
      prefix: 'news-audio/nhk-easy/',
      maxResults: 10
    });

    const audioFiles = files.map(file => ({
      name: file.name,
      size: file.metadata.size,
      created: file.metadata.timeCreated
    }));

    return NextResponse.json({
      success: true,
      articlesFound: articles.length,
      articles,
      audioFilesInStorage: audioFiles.length,
      audioFiles: audioFiles.slice(0, 5), // First 5 files
      instructions: {
        trigger: 'Add ?action=trigger to trigger the scraper',
        check: 'Default action checks existing articles and audio files'
      }
    });

  } catch (error) {
    console.error('❌ Test endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
