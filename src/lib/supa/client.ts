/**
 * Supa API Client for YouTube Transcript Fetching
 * Provides fallback transcript service when YouTubei.js fails
 */

interface TranscriptLine {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  words?: string[];
}

interface SupaDataResponse {
  lang: string;
  content: Array<{
    offset: number;    // milliseconds
    duration: number;  // milliseconds
    text: string;
  }>;
  availableLangs?: string[];
  title?: string;
}

interface SupaTranscriptResult {
  transcript: TranscriptLine[];
  language: string;
  availableLanguages: string[];
  title?: string;
}

/**
 * Fetch transcript from Supa API
 * @param videoId YouTube video ID
 * @returns Transcript data or null if failed
 */
export async function getTranscriptFromSupa(
  videoId: string
): Promise<SupaTranscriptResult | null> {
  const API_KEY = process.env.SUPA_YOUTUBE_API_KEY;

  if (!API_KEY) {
    console.warn('[SUPA] API key not configured');
    return null;
  }

  try {
    console.log(`[SUPA] Fetching transcript for video: ${videoId}`);

    const response = await fetch(
      `https://api.supadata.ai/v1/transcript?url=https://www.youtube.com/watch?v=${videoId}&type=json`,
      {
        headers: {
          'x-api-key': API_KEY,
        },
        // 10 second timeout
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        console.warn('[SUPA] Rate limit exceeded - monthly limit reached');
      } else if (response.status === 401) {
        console.error('[SUPA] API key invalid or expired');
      } else if (response.status === 403) {
        console.error('[SUPA] API key forbidden - check permissions');
      } else if (response.status === 404) {
        console.warn('[SUPA] No transcript available for this video');
      } else {
        console.error(`[SUPA] API error: ${response.status} ${response.statusText}`);
      }
      return null;
    }

    const data: SupaDataResponse = await response.json();

    // Validate response
    if (!data.content || !Array.isArray(data.content)) {
      console.error('[SUPA] Invalid response format - missing content array');
      return null;
    }

    // Parse transcript segments
    const transcript: TranscriptLine[] = data.content.map((segment, index) => {
      // Convert milliseconds to seconds
      const startTime = (segment.offset || 0) / 1000;
      const duration = (segment.duration || 5000) / 1000;
      const endTime = startTime + duration;

      return {
        id: String(index + 1),
        text: segment.text || '',
        startTime,
        endTime,
        // Split Japanese text into words/phrases
        words: (segment.text || '')
          .split(/[\s、。！？]/)
          .filter((w) => w.length > 0),
      };
    });

    console.log(
      `[SUPA] ✅ Successfully fetched ${transcript.length} segments (language: ${data.lang})`
    );

    return {
      transcript,
      language: data.lang || 'ja',
      availableLanguages: data.availableLangs || [data.lang || 'ja'],
      title: data.title,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error('[SUPA] Request timeout - service may be slow');
      } else {
        console.error('[SUPA] Error fetching transcript:', error.message);
      }
    } else {
      console.error('[SUPA] Unknown error fetching transcript');
    }
    return null;
  }
}

/**
 * Check if Supa API is configured
 */
export function isSupaConfigured(): boolean {
  return !!process.env.SUPA_YOUTUBE_API_KEY;
}
