import { NextRequest, NextResponse } from 'next/server';
import { Innertube } from 'youtubei.js';
import { TranscriptCacheManager } from '@/utils/transcriptCache';
import { getTranscriptFromSupa, isSupaConfigured } from '@/lib/supa/client';

interface TranscriptSegment {
  start: number;
  end: number;
  duration: number;
  text: string;
  words?: string[];
}

interface TranscriptResponse {
  available: boolean;
  videoId: string;
  title?: string;
  segments?: TranscriptSegment[];
  language?: string;
  availableLanguages?: string[];
  source?: 'firebase-cache' | 'youtubei-enhanced' | 'youtubei-standard' | 'supa-api';
  cached?: boolean;
  totalSegments?: number;
  totalDuration?: number;
  message?: string;
  error?: string;
}

let youtubeClient: Innertube | null = null;

async function getClient(): Promise<Innertube> {
  if (!youtubeClient) {
    youtubeClient = await Innertube.create();
  }
  return youtubeClient;
}

function isJapaneseTitle(title: string | undefined): boolean {
  if (!title) return false;
  const lower = title.toLowerCase();
  return (
    (lower.includes('japanese') || lower.includes('日本語')) &&
    !lower.includes('english') &&
    !lower.includes('英語')
  );
}

/**
 * Try to get transcript using YouTubei.js with Japanese language selection
 */
async function tryEnhancedYouTubeiJS(videoId: string): Promise<TranscriptResponse | null> {
  try {
    console.log(`[TRANSCRIPT-API] Trying enhanced YouTubei.js for ${videoId}`);

    const client = await getClient();
    const videoInfo = await client.getInfo(videoId);
    const transcriptInfo = await videoInfo.getTranscript();

    const languageMenu = transcriptInfo?.transcript?.content?.footer?.language_menu;
    const availableLanguages = languageMenu?.sub_menu_items || [];

    const japaneseOptions = availableLanguages.filter((lang: any) =>
      isJapaneseTitle(lang.title)
    );

    if (japaneseOptions.length === 0) {
      console.log(`[TRANSCRIPT-API] No Japanese transcript available`);
      return null;
    }

    let transcriptPayload = transcriptInfo;
    let selectedLanguage = availableLanguages.find((lang: any) => lang.selected);

    // Force Japanese language if not already selected
    if (!isJapaneseTitle(selectedLanguage?.title) && japaneseOptions[0]?.continuation) {
      const session = (client as any).session;
      const payload = {
        context: session?.context,
        continuation: japaneseOptions[0].continuation,
      };

      let response: any = null;

      if (client?.actions?.execute) {
        response = await client.actions.execute('/youtubei/v1/get_transcript', payload);
      } else if (session?.actions?.execute) {
        response = await session.actions.execute('/youtubei/v1/get_transcript', payload);
      } else if (session?.http?.fetch) {
        response = await session.http.fetch('/youtubei/v1/get_transcript', payload);
      }

      if (response?.actions?.[0]?.updateEngagementPanelAction?.content) {
        transcriptPayload = {
          transcript: response.actions[0].updateEngagementPanelAction.content,
        };
        selectedLanguage = japaneseOptions[0];
      }
    }

    const body = transcriptPayload?.transcript?.content?.body;
    const segmentList = body?.initial_segments || [];

    if (!segmentList || segmentList.length === 0) {
      return null;
    }

    const segments: TranscriptSegment[] = segmentList.map((seg: any) => {
      const startMs = parseInt(seg.start_ms) || 0;
      const endMs = parseInt(seg.end_ms) || startMs + 5000;
      const text = seg.snippet?.text || '';

      return {
        start: startMs / 1000,
        end: endMs / 1000,
        duration: (endMs - startMs) / 1000,
        text,
        words: text.split(/[\s、。！？]/).filter((w: string) => w.length > 0),
      };
    });

    console.log(
      `[TRANSCRIPT-API] ✅ Enhanced YouTubei.js success: ${segments.length} segments`
    );

    return {
      available: true,
      videoId,
      title: videoInfo.basic_info?.title || 'Unknown title',
      segments,
      language: selectedLanguage?.title || 'Japanese',
      availableLanguages: availableLanguages.map((lang: any) => lang.title),
      source: 'youtubei-enhanced',
      totalSegments: segments.length,
      totalDuration: segments[segments.length - 1]?.end || 0,
    };
  } catch (error) {
    console.error(`[TRANSCRIPT-API] Enhanced YouTubei.js failed:`, error);
    return null;
  }
}

/**
 * Try to get transcript using standard YouTubei.js (no language selection)
 */
async function tryStandardYouTubeiJS(videoId: string): Promise<TranscriptResponse | null> {
  try {
    console.log(`[TRANSCRIPT-API] Trying standard YouTubei.js for ${videoId}`);

    const client = await getClient();
    const videoInfo = await client.getInfo(videoId);
    const transcriptInfo = await videoInfo.getTranscript();

    const body = transcriptInfo?.transcript?.content?.body;
    const segmentList = body?.initial_segments || [];

    if (!segmentList || segmentList.length === 0) {
      return null;
    }

    const segments: TranscriptSegment[] = segmentList.map((seg: any) => {
      const startMs = parseInt(seg.start_ms) || 0;
      const endMs = parseInt(seg.end_ms) || startMs + 5000;
      const text = seg.snippet?.text || '';

      return {
        start: startMs / 1000,
        end: endMs / 1000,
        duration: (endMs - startMs) / 1000,
        text,
        words: text.split(/[\s、。！？]/).filter((w: string) => w.length > 0),
      };
    });

    console.log(
      `[TRANSCRIPT-API] ✅ Standard YouTubei.js success: ${segments.length} segments`
    );

    return {
      available: true,
      videoId,
      title: videoInfo.basic_info?.title || 'Unknown title',
      segments,
      language: 'Auto-detected',
      source: 'youtubei-standard',
      totalSegments: segments.length,
      totalDuration: segments[segments.length - 1]?.end || 0,
    };
  } catch (error) {
    console.error(`[TRANSCRIPT-API] Standard YouTubei.js failed:`, error);
    return null;
  }
}

/**
 * Main API route handler with cache-first approach
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  let videoId = '';

  try {
    const resolved = await params;
    videoId = resolved.videoId;

    if (!videoId) {
      return NextResponse.json<TranscriptResponse>(
        { available: false, videoId: '', error: 'Video ID is required' },
        { status: 400 }
      );
    }

    const contentId = `youtube_${videoId}`;

    // ==========================================
    // STEP 1: CHECK FIREBASE CACHE FIRST
    // ==========================================
    console.log(`[TRANSCRIPT-API] Step 1: Checking Firebase cache for ${videoId}`);

    const cached = await TranscriptCacheManager.getCachedTranscript(contentId);

    if (cached && cached.transcript && cached.transcript.length > 0) {
      console.log(`[TRANSCRIPT-API] ✅ Cache hit! Returning ${cached.transcript.length} segments`);

      // Transform cached format to API format
      const segments: TranscriptSegment[] = cached.transcript.map((line) => ({
        start: line.startTime,
        end: line.endTime,
        duration: line.endTime - line.startTime,
        text: line.text,
        words: line.words,
      }));

      return NextResponse.json<TranscriptResponse>({
        available: true,
        videoId,
        title: cached.videoTitle || 'Cached Video',
        segments,
        language: cached.language || 'ja',
        source: 'firebase-cache',
        cached: true,
        totalSegments: segments.length,
        totalDuration: segments[segments.length - 1]?.end || 0,
      });
    }

    console.log(`[TRANSCRIPT-API] Cache miss - proceeding to fetch`);

    // ==========================================
    // STEP 2: TRY ENHANCED YOUTUBEI.JS
    // ==========================================
    const enhancedResult = await tryEnhancedYouTubeiJS(videoId);

    if (enhancedResult && enhancedResult.segments) {
      // Store to Firebase cache (async, don't block response)
      TranscriptCacheManager.cacheTranscript({
        contentId,
        contentType: 'youtube',
        transcript: enhancedResult.segments.map((seg, i) => ({
          id: String(i + 1),
          text: seg.text,
          startTime: seg.start,
          endTime: seg.end,
          words: seg.words,
        })),
        language: enhancedResult.language || 'ja',
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        videoTitle: enhancedResult.title,
        metadata: {
          youtubeVideoId: videoId,
        },
      }).catch((err) => console.error('[TRANSCRIPT-API] Cache save failed:', err));

      return NextResponse.json<TranscriptResponse>(enhancedResult);
    }

    // ==========================================
    // STEP 3: TRY STANDARD YOUTUBEI.JS
    // ==========================================
    const standardResult = await tryStandardYouTubeiJS(videoId);

    if (standardResult && standardResult.segments) {
      // Store to Firebase cache
      TranscriptCacheManager.cacheTranscript({
        contentId,
        contentType: 'youtube',
        transcript: standardResult.segments.map((seg, i) => ({
          id: String(i + 1),
          text: seg.text,
          startTime: seg.start,
          endTime: seg.end,
          words: seg.words,
        })),
        language: standardResult.language || 'ja',
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        videoTitle: standardResult.title,
        metadata: {
          youtubeVideoId: videoId,
        },
      }).catch((err) => console.error('[TRANSCRIPT-API] Cache save failed:', err));

      return NextResponse.json<TranscriptResponse>(standardResult);
    }

    // ==========================================
    // STEP 4: TRY SUPA API (FALLBACK)
    // ==========================================
    if (isSupaConfigured()) {
      console.log(`[TRANSCRIPT-API] Step 4: Trying Supa API`);

      const supaResult = await getTranscriptFromSupa(videoId);

      if (supaResult && supaResult.transcript) {
        const segments: TranscriptSegment[] = supaResult.transcript.map((seg) => ({
          start: seg.startTime,
          end: seg.endTime,
          duration: seg.endTime - seg.startTime,
          text: seg.text,
          words: seg.words,
        }));

        // Store to Firebase cache
        TranscriptCacheManager.cacheTranscript({
          contentId,
          contentType: 'youtube',
          transcript: supaResult.transcript,
          language: supaResult.language,
          videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
          videoTitle: supaResult.title,
          metadata: {
            youtubeVideoId: videoId,
          },
        }).catch((err) => console.error('[TRANSCRIPT-API] Cache save failed:', err));

        console.log(`[TRANSCRIPT-API] ✅ Supa API success: ${segments.length} segments`);

        return NextResponse.json<TranscriptResponse>({
          available: true,
          videoId,
          title: supaResult.title || 'Unknown title',
          segments,
          language: supaResult.language,
          availableLanguages: supaResult.availableLanguages,
          source: 'supa-api',
          totalSegments: segments.length,
          totalDuration: segments[segments.length - 1]?.end || 0,
        });
      }
    }

    // ==========================================
    // ALL METHODS FAILED
    // ==========================================
    console.log(`[TRANSCRIPT-API] ❌ All methods failed for ${videoId}`);

    return NextResponse.json<TranscriptResponse>(
      {
        available: false,
        videoId,
        message: 'No transcript available for this video.',
        error: 'All transcript fetch methods failed',
      },
      { status: 404 }
    );
  } catch (error) {
    console.error(`[TRANSCRIPT-API] Fatal error for ${videoId}:`, error);

    return NextResponse.json<TranscriptResponse>(
      {
        available: false,
        videoId,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
