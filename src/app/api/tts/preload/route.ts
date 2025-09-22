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
    } else {
      // Queue for background processing (simplified version)
      // In production, you might want to use a proper job queue
      setTimeout(async () => {
        try {
          await ttsService.preload(texts, options);
        } catch (error) {
          console.error('Background preload error:', error);
        }
      }, priority === 'low' ? 5000 : 1000);
      
      // Check how many are already cached
      let cached = 0;
      for (const text of texts) {
        if (await ttsService.isCached(text, options)) {
          cached++;
        }
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
    console.error('Preload error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Preload failed',
        },
      },
      { status: 500 }
    );
  }
}