/**
 * Transcript Translation API
 * Generates or retrieves translations for YouTube transcript segments
 *
 * POST /api/transcript/translate - Queue translation generation (background)
 * GET /api/transcript/translate - Get translation status
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateTranscriptTranslations,
  queueTranscriptTranslations,
  getTranslationStatus,
  hasTranslations,
  getTranscriptWithTranslations,
  TranscriptSegment
} from '@/lib/ai/utils/transcriptTranslationGenerator';
import { transcriptCache } from '@/lib/transcript/cache';
import { extractVideoId } from '@/lib/video';

export const maxDuration = 300; // 5 minutes for long transcripts

/**
 * GET - Check translation status or get translated transcript
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawVideoId = searchParams.get('videoId') || '';
  const statusOnly = searchParams.get('status') === 'true';

  const videoId = extractVideoId(rawVideoId);
  if (!videoId) {
    return NextResponse.json(
      { error: 'Invalid YouTube URL or ID' },
      { status: 400 }
    );
  }

  const contentId = `youtube_${videoId}`;

  try {
    // If status only requested, return just the status
    if (statusOnly) {
      const status = await getTranslationStatus(contentId);
      return NextResponse.json(status);
    }

    // Otherwise return full transcript with translations
    const transcript = await getTranscriptWithTranslations(contentId);

    if (!transcript) {
      return NextResponse.json(
        { error: 'Transcript not found' },
        { status: 404 }
      );
    }

    // Check if translations exist
    const translatedCount = transcript.filter(seg => seg.translation).length;

    return NextResponse.json({
      contentId,
      segments: transcript,
      translatedCount,
      totalCount: transcript.length,
      hasTranslations: translatedCount >= transcript.length * 0.8
    });
  } catch (error) {
    console.error('[Translate API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get translation status' },
      { status: 500 }
    );
  }
}

/**
 * POST - Generate translations for transcript
 * Supports both sync (wait for completion) and async (queue and return)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      videoId: rawVideoId,
      mode = 'full',
      userLevel = 'N4',
      async = true // Default to background processing
    } = body;

    const videoId = extractVideoId(rawVideoId || '');
    if (!videoId) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL or ID' },
        { status: 400 }
      );
    }

    const contentId = `youtube_${videoId}`;

    // Check if translations already exist
    const hasExisting = await hasTranslations(contentId);
    if (hasExisting) {
      const transcript = await getTranscriptWithTranslations(contentId);
      return NextResponse.json({
        success: true,
        message: 'Translations already exist',
        contentId,
        alreadyExists: true,
        translatedCount: transcript?.filter(seg => seg.translation).length || 0,
        totalCount: transcript?.length || 0
      });
    }

    // Get cached transcript (must exist before we can translate)
    const cached = await transcriptCache.get(contentId);
    if (!cached || !cached.transcript || cached.transcript.length === 0) {
      return NextResponse.json(
        { error: 'Transcript not cached. Load the video first.' },
        { status: 404 }
      );
    }

    // Transform cached format to generator format
    const segments: TranscriptSegment[] = cached.transcript.map((line) => ({
      id: line.id,
      text: line.text,
      startTime: line.startTime,
      endTime: line.endTime,
      words: line.words,
      translation: line.translation // Preserve any existing
    }));

    // Async mode - queue and return immediately
    if (async) {
      const result = await queueTranscriptTranslations(contentId, segments, {
        mode,
        userLevel
      });

      return NextResponse.json({
        success: result.queued,
        message: result.message,
        contentId,
        queued: result.queued,
        totalSegments: segments.length
      });
    }

    // Sync mode - wait for completion (can be slow!)
    console.log(`[Translate API] Starting sync translation for ${contentId}`);

    const result = await generateTranscriptTranslations(contentId, segments, {
      mode,
      userLevel
    });

    return NextResponse.json({
      success: true,
      contentId,
      translatedCount: result.translatedCount,
      failedCount: result.failedCount,
      totalSegments: result.totalSegments,
      duration: result.duration,
      costInfo: result.costInfo
    });
  } catch (error) {
    console.error('[Translate API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to generate translations' },
      { status: 500 }
    );
  }
}
