import { NextRequest, NextResponse } from 'next/server';
import { ttsService } from '@/lib/tts/service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { texts, priority = 'normal', options } = body;

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Texts array is required',
          },
        },
        { status: 400 }
      );
    }

    // Limit preload size
    if (texts.length > 50) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PRELOAD_TOO_LARGE',
            message: 'Maximum 50 texts per preload request',
          },
        },
        { status: 400 }
      );
    }

    // Process preload based on priority
    if (priority === 'high') {
      // Process immediately
      try {
        console.log(`[TTS Preload API] Processing ${texts.length} texts with high priority`)
        const stats = await ttsService.preload(texts, options);

        return NextResponse.json({
          success: true,
          data: {
            queued: stats.synthesized,
            cached: stats.cached,
            total: texts.length,
            failed: stats.failed,
          },
        });
      } catch (error: any) {
        console.error('[TTS Preload API] High priority preload failed:', error?.message || error);
        // Return success=true with all failed for graceful degradation
        return NextResponse.json({
          success: true,
          data: {
            queued: 0,
            cached: 0,
            total: texts.length,
            failed: texts.length,
          },
        });
      }
    } else {
      // Queue for background processing (simplified version)
      // In production, you might want to use a proper job queue
      console.log(`[TTS Preload API] Queuing ${texts.length} texts with ${priority} priority`)

      setTimeout(async () => {
        try {
          await ttsService.preload(texts, options);
        } catch (error: any) {
          console.error('[TTS Preload API] Background preload error:', error?.message || error);
        }
      }, priority === 'low' ? 5000 : 1000);

      // Check how many are already cached
      let cached = 0;
      try {
        for (const text of texts) {
          if (await ttsService.isCached(text, options)) {
            cached++;
          }
        }
      } catch (error: any) {
        console.warn('[TTS Preload API] Cache check failed:', error?.message || error);
      }

      return NextResponse.json({
        success: true,
        data: {
          queued: texts.length - cached,
          cached,
          total: texts.length,
        },
      });
    }
  } catch (error: any) {
    console.error('[TTS Preload API] Unexpected error:', error?.message || error);

    // Return success=true for graceful degradation
    return NextResponse.json(
      {
        success: true,
        data: {
          queued: 0,
          cached: 0,
          total: 0,
          failed: 0,
        },
      },
      { status: 200 }
    );
  }
}