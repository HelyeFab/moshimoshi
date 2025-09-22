import { NextRequest, NextResponse } from 'next/server';
import { ttsCache } from '@/lib/tts/cache';
import { selectProvider } from '@/lib/tts/utils';
import { ttsConfig } from '@/lib/tts/config';
import { TTSProvider } from '@/lib/tts/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const text = searchParams.get('text');
    const providerParam = searchParams.get('provider');
    const voiceParam = searchParams.get('voice');

    if (!text) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Text parameter is required',
          },
        },
        { status: 400 }
      );
    }

    // Determine provider
    let provider: TTSProvider;
    if (providerParam && (providerParam === 'google' || providerParam === 'elevenlabs')) {
      provider = providerParam as TTSProvider;
    } else {
      provider = selectProvider(text);
    }

    // Determine voice
    const voice = voiceParam || 
      (provider === 'google' ? ttsConfig.google.defaultVoice : ttsConfig.elevenlabs.voiceId);

    // Check cache
    const cacheEntry = await ttsCache.get(text, provider, voice);

    if (cacheEntry) {
      return NextResponse.json({
        cached: true,
        data: {
          audioUrl: cacheEntry.audioUrl,
          provider: cacheEntry.provider,
          createdAt: cacheEntry.createdAt,
          size: cacheEntry.size,
          duration: cacheEntry.duration,
          accessCount: cacheEntry.accessCount,
        },
      });
    }

    return NextResponse.json({
      cached: false,
    });
  } catch (error: any) {
    console.error('Cache check error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Cache check failed',
        },
      },
      { status: 500 }
    );
  }
}