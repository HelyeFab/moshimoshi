import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import crypto from 'crypto';

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

const storage = getStorage();

/**
 * On-demand sentence audio generation
 * Generates Kokoro TTS audio for individual sentences and caches in Firebase Storage
 *
 * Flow:
 * 1. Check if cached audio exists in Firebase Storage
 * 2. If exists, return cached URL (free!)
 * 3. If not, generate via Kokoro API, cache, then return URL
 * 4. Falls back to app TTS on error
 */
export async function POST(request: NextRequest) {
  try {
    const { articleId, sentence, index } = await request.json();

    if (!articleId || !sentence) {
      return NextResponse.json(
        { error: 'Missing required fields: articleId, sentence' },
        { status: 400 }
      );
    }

    // Generate consistent hash for this sentence
    const sentenceHash = crypto
      .createHash('md5')
      .update(`${articleId}-${index}-${sentence}`)
      .digest('hex');

    const storagePath = `sentence-audio/${articleId}/${sentenceHash}.mp3`;

    // Check if cached audio exists
    const bucket = storage.bucket();
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();

    if (exists) {
      // Return cached audio URL
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      });

      console.log('[Sentence TTS] Using cached audio', {
        articleId,
        index,
        sentencePreview: sentence.substring(0, 30) + '...',
        cached: true
      });

      return NextResponse.json({
        success: true,
        audioUrl: url,
        cached: true,
        provider: 'kokoro'
      });
    }

    // Generate new audio via Kokoro API
    console.log('[Sentence TTS] Generating new audio via Kokoro', {
      articleId,
      index,
      sentencePreview: sentence.substring(0, 30) + '...'
    });

    const kokoroResponse = await fetch('https://api.selfmind.dev/kokoro/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.SHELDON_API_KEY || ''
      },
      body: JSON.stringify({
        model: 'kokoro',
        input: sentence,
        voice: 'jf_alpha',
        response_format: 'mp3',
        speed: 1.0
      })
    });

    if (!kokoroResponse.ok) {
      const errorText = await kokoroResponse.text();
      throw new Error(`Kokoro API error (${kokoroResponse.status}): ${errorText}`);
    }

    // Get audio buffer
    const audioBuffer = await kokoroResponse.arrayBuffer();
    const audioSize = audioBuffer.byteLength;

    if (audioSize === 0) {
      throw new Error('Kokoro API returned empty audio');
    }

    // Save to Firebase Storage
    await file.save(Buffer.from(audioBuffer), {
      metadata: {
        contentType: 'audio/mpeg',
        metadata: {
          articleId,
          sentenceIndex: String(index),
          sentenceHash,
          generatedAt: new Date().toISOString(),
          provider: 'kokoro',
          voice: 'jf_alpha'
        }
      }
    });

    // Get signed URL
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    });

    console.log('[Sentence TTS] Audio generated and cached', {
      articleId,
      index,
      size: (audioSize / 1024).toFixed(2) + ' KB',
      cached: false
    });

    return NextResponse.json({
      success: true,
      audioUrl: url,
      cached: false,
      provider: 'kokoro',
      size: audioSize
    });

  } catch (error) {
    console.error('[Sentence TTS] Generation failed:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      fallback: 'app-tts' // Client should fall back to app TTS
    }, { status: 500 });
  }
}
