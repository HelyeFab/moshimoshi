import { NextRequest, NextResponse } from 'next/server';
import { ttsService } from '@/lib/tts/service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, sequential = false } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Items array is required',
          },
        },
        { status: 400 }
      );
    }

    // Limit batch size
    if (items.length > 100) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BATCH_TOO_LARGE',
            message: 'Maximum 100 items per batch',
          },
        },
        { status: 400 }
      );
    }

    let results;
    
    if (sequential) {
      // Process sequentially
      results = [];
      for (const item of items) {
        try {
          const result = await ttsService.synthesize(item.text, item.options);
          results.push({
            id: item.id,
            text: item.text,
            audioUrl: result.audioUrl,
            cached: result.cached,
          });
        } catch (error: any) {
          results.push({
            id: item.id,
            text: item.text,
            error: error.message,
          });
        }
      }
    } else {
      // Process in parallel
      const batchResults = await ttsService.batchSynthesize(
        items.map(item => ({ text: item.text, options: item.options }))
      );
      
      results = batchResults.map((result, index) => ({
        id: items[index].id,
        text: result.text,
        audioUrl: result.result?.audioUrl,
        cached: result.result?.cached,
        error: result.error?.message,
      }));
    }

    // Calculate stats
    const stats = {
      total: results.length,
      successful: results.filter(r => r.audioUrl).length,
      failed: results.filter(r => r.error).length,
      cached: results.filter(r => r.cached).length,
    };

    return NextResponse.json({
      success: true,
      data: {
        results,
        stats,
      },
    });
  } catch (error: any) {
    console.error('Batch TTS error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Batch processing failed',
        },
      },
      { status: 500 }
    );
  }
}