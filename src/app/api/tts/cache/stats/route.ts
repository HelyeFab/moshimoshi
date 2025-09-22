import { NextRequest, NextResponse } from 'next/server';
import { ttsService } from '@/lib/tts/service';
import { formatFileSize } from '@/lib/tts/utils';

export async function GET(request: NextRequest) {
  try {
    const stats = await ttsService.getCacheStats();

    // Format the response
    const formattedStats = {
      totalEntries: stats.totalEntries,
      totalSize: stats.totalSize,
      totalSizeFormatted: formatFileSize(stats.totalSize),
      providers: {
        google: {
          count: stats.providers.google.count,
          size: stats.providers.google.size,
          sizeFormatted: formatFileSize(stats.providers.google.size),
        },
        elevenlabs: {
          count: stats.providers.elevenlabs.count,
          size: stats.providers.elevenlabs.size,
          sizeFormatted: formatFileSize(stats.providers.elevenlabs.size),
        },
      },
      recent: stats.recent.slice(0, 10).map(entry => ({
        text: entry.text.substring(0, 50) + (entry.text.length > 50 ? '...' : ''),
        provider: entry.provider,
        accessCount: entry.accessCount,
        lastAccessed: entry.lastAccessedAt,
      })),
      popular: stats.popular.slice(0, 10).map(entry => ({
        text: entry.text.substring(0, 50) + (entry.text.length > 50 ? '...' : ''),
        accessCount: entry.accessCount,
      })),
    };

    return NextResponse.json(formattedStats);
  } catch (error: any) {
    console.error('Cache stats error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get cache statistics',
        },
      },
      { status: 500 }
    );
  }
}