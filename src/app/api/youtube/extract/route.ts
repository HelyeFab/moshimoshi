import { NextRequest, NextResponse } from 'next/server';
import ytdl from '@distube/ytdl-core';
import axios from 'axios';
import { getSubtitles } from 'youtube-captions-scraper';
import { adminFirestore as db, Timestamp } from '@/lib/firebase/admin';
import { AIService } from '@/lib/ai/AIService';
import { TranscriptProcessRequest } from '@/lib/ai/types';
import { transcriptCache } from '@/lib/transcript/cache';
import { validateSession } from '@/lib/auth/session';

// Initialize AI Service
const aiService = AIService.getInstance();

// YouTube Data API v3 endpoint
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

interface TranscriptLine {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  words?: string[];
}

// Helper function to log API usage
async function logApiUsage(api: string, success: boolean, error?: string, metadata?: any) {
  try {
    await db.collection('apiUsageLogs').add({
      api,
      success,
      error,
      metadata,
      timestamp: Timestamp.now()
    });
  } catch (err) {
    console.error('Failed to log API usage:', err);
  }
}

// Helper function to validate YouTube and YouTube Music URLs
function isValidYouTubeUrl(url: string): boolean {
  // Check standard YouTube URLs
  if (ytdl.validateURL(url)) {
    return true;
  }

  // Check YouTube Music URLs
  const youtubeMusicPattern = /^https?:\/\/(music\.)?youtube\.com\/(watch|embed)\?v=([a-zA-Z0-9_-]{11})/;
  const youtubeMusicShortPattern = /^https?:\/\/music\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/;

  return youtubeMusicPattern.test(url) || youtubeMusicShortPattern.test(url);
}

// Helper to extract video ID from YouTube Music URLs
function extractVideoIdFromUrl(url: string): string | null {
  // Try standard extraction first
  try {
    return ytdl.getVideoID(url);
  } catch {
    // Fallback for YouTube Music URLs
    const patterns = [
      /[?&]v=([a-zA-Z0-9_-]{11})/,
      /youtu\.be\/([a-zA-Z0-9_-]{11})/,
      /embed\/([a-zA-Z0-9_-]{11})/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    return null;
  }
}

// Note: Using the new transcriptCache service from /lib/transcript/cache.ts
// The old inline functions have been removed in favor of the singleton service

// Helper function to save video to user's YouTube history
async function saveToYouTubeHistory(
  userId: string,
  videoId: string,
  videoTitle: string,
  videoUrl: string,
  transcript: any[],
  metadata: any
): Promise<void> {
  try {
    const docId = `${userId}_${videoId}`;
    const docRef = db.collection('userYouTubeHistory').doc(docId);

    // Check if document exists
    const doc = await docRef.get();

    if (doc.exists) {
      // Update existing record
      await docRef.update({
        lastWatched: Timestamp.now(),
        watchCount: (doc.data()?.watchCount || 0) + 1,
        transcript: transcript, // Update transcript if it's better
        metadata: metadata || doc.data()?.metadata
      });
      console.log('✅ Updated YouTube history for video:', videoId);
    } else {
      // Create new record
      await docRef.set({
        userId,
        videoId,
        videoTitle,
        videoUrl,
        transcript,
        metadata,
        firstWatched: Timestamp.now(),
        lastWatched: Timestamp.now(),
        watchCount: 1,
        createdAt: Timestamp.now()
      });
      console.log('✅ Created new YouTube history entry for video:', videoId);
    }
  } catch (error) {
    console.error('❌ Error saving to YouTube history:', error);
  }
}

// Helper function to format transcript with AI
async function formatTranscriptWithAI(
  transcript: any[],
  videoTitle?: string,
  contentId?: string
): Promise<any[] | null> {
  try {
    // Skip if transcript too short
    if (transcript.length < 3) {
      console.log('🤖 [AI] Skipping formatting - transcript too short');
      return null;
    }

    console.log('🤖 [AI] Starting AI formatting for', transcript.length, 'segments');

    // Prepare request for unified AI service
    const request: TranscriptProcessRequest = {
      content: {
        transcript: transcript.map(seg => ({
          text: seg.text,
          startTime: seg.startTime,
          endTime: seg.endTime
        })),
        videoTitle,
        language: 'ja'
      },
      splitForShadowing: true,
      maxSegmentLength: 20,
      addFurigana: false
    };

    // Call unified AI service
    const response = await aiService.process({
      task: 'clean_transcript',
      content: request,
      config: {
        jlptLevel: 'N4' // Default level
      },
      metadata: {
        source: 'youtube-extract',
        contentId
      }
    });

    if (!response.success || !response.data) {
      console.error('❌ [AI] Failed to format transcript:', response.error);
      return null;
    }

    // Convert back to the expected format
    const formattedTranscript = response.data.segments.map(seg => ({
      id: seg.id,
      text: seg.text,
      startTime: seg.startTime,
      endTime: seg.endTime,
      words: [seg.text]
    }));

    // Log statistics
    const lengths = formattedTranscript.map(s => s.text.length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const longSegments = lengths.filter(l => l > 20).length;

    console.log(`✅ [AI] Successfully formatted ${formattedTranscript.length} segments`);
    console.log(`📊 [AI] Avg length: ${avgLength.toFixed(1)} chars, Long segments (>20): ${longSegments}/${formattedTranscript.length}`);
    if (response.cached) {
      console.log(`💾 [AI] Response was cached`);
    }

    if (longSegments > 0) {
      console.warn(`⚠️ [AI] ${longSegments} segments exceed 20 chars - may be difficult for shadowing`);
    }

    return formattedTranscript;

  } catch (error) {
    console.error('❌ [AI] Error formatting transcript:', error);
    return null;
  }
}

// Helper function to extract with YouTube-Transcript.io
async function extractWithYouTubeTranscriptIO(
  videoId: string | null,
  apiKey: string | undefined,
  contentId: string,
  isAuthenticated: boolean,
  videoMetadata: any,
  url: string
): Promise<NextResponse> {
  try {

    if (!videoId) {
      return NextResponse.json({
        success: false,
        error: 'INVALID_VIDEO_ID',
        message: 'Could not extract video ID from URL'
      });
    }

    // YouTube-Transcript.io API endpoint
    const apiUrl = `https://youtube-transcript.io/api/transcript`;

    // Prepare request parameters
    const params: any = {
      video_id: videoId,
      lang: 'ja' // Request Japanese transcripts
    };

    // Add API key if provided (for paid plans)
    const headers: any = {
      'Accept': 'application/json',
      'User-Agent': 'Moshimoshi/1.0'
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await axios.get(apiUrl, {
      params,
      headers,
      timeout: 15000
    });

    if (response.data && response.data.transcript) {
      const transcript = response.data.transcript.map((segment: any, index: number) => ({
        id: String(index + 1),
        text: segment.text || '',
        startTime: segment.start || index * 5,
        endTime: segment.end || segment.start + segment.duration || (index + 1) * 5,
        words: (segment.text || '').split(/[\s、。！？]/g).filter((w: string) => w.length > 0)
      }));

      // Save to cache only for authenticated users
      if (isAuthenticated) {
        try {
          await transcriptCache.set({
            contentId,
            contentType: 'youtube',
            videoUrl: url,
            videoTitle: videoMetadata?.title || response.data.title || 'Unknown',
            transcript,
            language: response.data.language || 'ja',
            metadata: {
              youtubeVideoId: videoId,
              channelName: videoMetadata?.channelTitle,
              uploadDate: videoMetadata?.publishedAt,
              thumbnailUrl: videoMetadata?.thumbnails?.medium?.url,
              duration: videoMetadata?.duration,
              method: 'youtube-transcript-io'
            }
          });

        } catch (cacheError) {
          console.error('Failed to cache transcript:', cacheError);
        }
      }

      // Format transcript with AI if it's Japanese
      let formattedTranscript = null;
      if ((response.data.language || 'ja').startsWith('ja')) {
        formattedTranscript = await formatTranscriptWithAI(
          transcript,
          videoMetadata?.title || response.data.title,
          contentId
        );
      }

      await logApiUsage('youtube-transcript-io', true, undefined, { videoId });

      // Only cache if we have the AI-processed version
      if (formattedTranscript && formattedTranscript.length > 0) {
        await transcriptCache.set({
          contentId,
          contentType: 'youtube',
          transcript: formattedTranscript, // Use AI-processed version as main transcript
          formattedTranscript: formattedTranscript,
          language: response.data.language || 'ja',
          videoUrl: url,
          videoTitle: videoMetadata?.title || response.data.title || 'Unknown',
          metadata: {
            youtubeVideoId: videoId,
            channelName: videoMetadata?.channelTitle,
            uploadDate: videoMetadata?.publishedAt,
            thumbnailUrl: videoMetadata?.thumbnails?.high?.url,
            thumbnails: videoMetadata?.thumbnails,
            description: videoMetadata?.description,
            wasFormatted: true,
            formattingModel: 'gpt-3.5-turbo'
          }
        });
        console.log('✅ Cached AI-processed transcript for:', videoId);
      } else {
        console.log('⏭️ Skipping cache - no AI-processed transcript available');
      }

      return NextResponse.json({
        success: true,
        transcript,
        formattedTranscript,
        language: response.data.language || 'ja',
        videoTitle: videoMetadata?.title || response.data.title || 'Unknown',
        videoMetadata: videoMetadata,
        method: 'youtube-transcript-io',
        hasFormattedVersion: !!formattedTranscript
      });
    } else {
      throw new Error('No transcript data in response');
    }
  } catch (error: any) {
    console.error('YouTube-Transcript.io error:', error.message);

    await logApiUsage('youtube-transcript-io', false, error.message, { videoId });

    // Handle specific error cases
    if (error.response?.status === 429) {
      return NextResponse.json({
        success: false,
        error: 'RATE_LIMIT',
        message: 'YouTube-Transcript.io rate limit exceeded. Please try again later or use a different provider.'
      });
    } else if (error.response?.status === 401) {
      return NextResponse.json({
        success: false,
        error: 'AUTH_FAILED',
        message: 'Invalid API key for YouTube-Transcript.io. Please check your API key.'
      });
    } else if (error.response?.status === 404) {
      return NextResponse.json({
        success: false,
        error: 'NO_TRANSCRIPT',
        message: 'No transcript available for this video on YouTube-Transcript.io'
      });
    }

    return NextResponse.json({
      success: false,
      error: 'EXTRACTION_FAILED',
      message: error.message || 'Failed to extract transcript via YouTube-Transcript.io'
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url, provider = 'auto', forceRegenerate = false, forceReformat = false, apiKey } = await request.json();

    if (!url || !isValidYouTubeUrl(url)) {
      return NextResponse.json(
        { error: 'Invalid YouTube or YouTube Music URL' },
        { status: 400 }
      );
    }

    // Validate session to get user information
    const session = await validateSession(request);
    const isAuthenticated = !!session;
    const userId = session?.userId;

    console.log('🔐 [AUTH] Session validation:', {
      isAuthenticated,
      userId: userId || 'anonymous',
      userEmail: session?.email || 'none'
    });

    // Extract video ID for YouTube API calls (need this BEFORE creating contentId)
    const videoId = extractVideoIdFromUrl(url);

    // Check cache FIRST before making any API calls
    const contentId = `youtube_${videoId}`;

    // Skip cache if force regenerate is requested
    if (!forceRegenerate) {

      const cachedTranscript = await transcriptCache.get(contentId);

      if (cachedTranscript && cachedTranscript.transcript.length > 0) {
        // Save to YouTube history even for cached videos (to update watch count)
        if (userId) {
          await saveToYouTubeHistory(
            userId,
            videoId,
            cachedTranscript.videoTitle || 'Unknown',
            url,
            cachedTranscript.formattedTranscript || cachedTranscript.transcript,
            cachedTranscript.metadata || {}
          );
        }

        return NextResponse.json({
        success: true,
        transcript: cachedTranscript.transcript,
        formattedTranscript: cachedTranscript.formattedTranscript || null,
        language: cachedTranscript.language,
        videoTitle: cachedTranscript.videoTitle,
        videoMetadata: cachedTranscript.metadata,
        method: 'cache',
        fromCache: true,
        hasFormattedVersion: !!cachedTranscript.formattedTranscript
      });
      }
    }
    let videoMetadata = null;
    let hitRateLimit = false; // Track if we hit rate limits

    // Provider-specific extraction
    if (provider === 'youtube-transcript-io') {
      return await extractWithYouTubeTranscriptIO(videoId, apiKey, contentId, isAuthenticated, videoMetadata, url);
    } else if (provider === 'youtube-native') {
      // Continue with OAuth/native methods below
    } else if (provider === 'whisper') {
      // This would require audio extraction - not implemented yet
      return NextResponse.json({
        success: false,
        error: 'PROVIDER_NOT_IMPLEMENTED',
        message: 'Whisper provider requires audio extraction which is not yet implemented'
      });
    }

    // Try to get video metadata using server-side API key
    const GOOGLE_API_KEY = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY;

    if (GOOGLE_API_KEY) {
      try {

        const videoResponse = await axios.get(`${YOUTUBE_API_BASE}/videos`, {
          params: {
            part: 'snippet,contentDetails',
            id: videoId,
            key: GOOGLE_API_KEY
          }
        });

        if (videoResponse.data.items && videoResponse.data.items.length > 0) {
          const video = videoResponse.data.items[0];
          videoMetadata = {
            title: video.snippet.title,
            channelTitle: video.snippet.channelTitle,
            description: video.snippet.description,
            thumbnails: video.snippet.thumbnails,
            duration: video.contentDetails.duration,
            publishedAt: video.snippet.publishedAt
          };

        }
      } catch (youtubeApiError) {
        console.error('YouTube Data API error:', youtubeApiError.message);
        if (youtubeApiError.response) {
          console.error('API Response:', youtubeApiError.response.status, youtubeApiError.response.data);
        }
        // Continue with other methods - don't let this block SupaData
      }
    } else {

    }

    // Method 2: Try SupaData AI for transcripts (with better error handling)
    const SUPA_API_KEY = process.env.SUPA_YOUTUBE_API_KEY;

    if (SUPA_API_KEY) {
      // Enhanced retry logic with exponential backoff for SupaData API
      let supaResponse = null;
      let lastError = null;
      const maxRetries = 2; // Reduced retries to save API calls

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          console.log(`=== Trying SupaData AI (attempt ${attempt + 1}/${maxRetries}) ===`);
          console.log('SupaData API Key first 10 chars:', SUPA_API_KEY.substring(0, 10) + '...');

          // Exponential backoff: 0ms, 1000ms
          if (attempt > 0) {
            const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            console.log(`Waiting ${backoffDelay}ms before retry (exponential backoff)...`);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
          }

          supaResponse = await axios.get(
            `https://api.supadata.ai/v1/transcript`,
            {
              params: {
                url,
                lang: 'ja' // Request Japanese subtitles specifically
              },
              headers: {
                'x-api-key': SUPA_API_KEY
              },
              timeout: 30000 // 30 second timeout
            }
          );

          // If successful, break out of retry loop
          if (supaResponse && supaResponse.data) {

            await logApiUsage('supadata', true, undefined, { videoId, attempt: attempt + 1 });
            break;
          }
        } catch (error: any) {
          lastError = error;
          console.error(`SupaData attempt ${attempt + 1} failed:`, error.message);

          // Special handling for different error types
          if (error.response?.status === 429) {
            console.warn('⚠️ SupaData rate limit exceeded (429) - Monthly limit reached');

            hitRateLimit = true;
            await logApiUsage('supadata', false, 'rate_limit_exceeded', { videoId, status: 429 });
            // Don't retry on 429, just move to fallback methods
            break;
          } else if (error.response?.status === 401) {
            console.error('❌ SupaData API key invalid or expired (401)');
            break; // Don't retry on auth errors
          } else if (error.response?.status === 403) {
            console.error('❌ SupaData API key forbidden - check permissions (403)');
            break; // Don't retry on permission errors
          } else if (error.response?.status === 404) {

            break; // Don't retry if transcript doesn't exist
          }

          // Only retry on network errors or 5xx server errors
          const shouldRetry = !error.response || error.response.status >= 500;
          if (!shouldRetry || attempt === maxRetries - 1) {

            break;
          }
        }
      }

      if (supaResponse && supaResponse.data) {

        console.log('SupaData response data keys:', Object.keys(supaResponse.data || {}));

          // Check if Japanese subtitles are available
          if (supaResponse.data.lang !== 'ja' && !supaResponse.data.availableLangs?.includes('ja')) {

            throw new Error('No Japanese subtitles available');
          }

          // Parse SupaData response to our format
          const transcript = parseSupaDataTranscript(supaResponse.data);

          if (transcript && transcript.length > 0) {
            // Save to cache only for authenticated users
            if (isAuthenticated) {
              console.log('=== Saving to transcript cache (authenticated user) ===');

              try {
                await transcriptCache.set({
                  contentId,
                  contentType: 'youtube',
                  videoUrl: url,
                  videoTitle: videoMetadata?.title || supaResponse.data.title || 'Unknown',
                  transcript,
                  language: 'ja',
                  metadata: {
                    youtubeVideoId: videoId,
                    channelName: videoMetadata?.channelTitle,
                    uploadDate: videoMetadata?.publishedAt,
                    thumbnailUrl: videoMetadata?.thumbnails?.medium?.url || videoMetadata?.thumbnails?.default?.url,
                    duration: videoMetadata?.duration,
                    method: 'supadata-ai'
                  }
                });

              } catch (cacheError) {
                console.error('=== Cache save failed ===', cacheError);
              }
            } else {

            }

            // Format transcript with AI for Japanese content
            // TEMPORARILY: Always try formatting for testing
            let formattedTranscript = null;
            console.log('🤖 [EXTRACT] Attempting AI formatting (TESTING MODE - always format)');
            formattedTranscript = await formatTranscriptWithAI(
              transcript,
              videoMetadata?.title || supaResponse.data.title,
              contentId
            );

            // Only cache if we have the AI-processed version
            if (formattedTranscript && formattedTranscript.length > 0) {
              await transcriptCache.set({
                contentId,
                contentType: 'youtube',
                transcript: formattedTranscript, // Use AI-processed version as main transcript
                formattedTranscript: formattedTranscript,
                language: 'ja',
                videoUrl: url,
                videoTitle: videoMetadata?.title || supaResponse.data.title || 'Unknown',
                metadata: {
                  youtubeVideoId: videoId,
                  channelName: videoMetadata?.channelTitle,
                  uploadDate: videoMetadata?.publishedAt,
                  thumbnailUrl: videoMetadata?.thumbnails?.high?.url,
                  thumbnails: videoMetadata?.thumbnails,
                  description: videoMetadata?.description,
                  wasFormatted: true,
                  formattingModel: 'gpt-3.5-turbo'
                }
              });
              console.log('✅ Cached AI-processed transcript for:', videoId);
            } else {
              console.log('⏭️ Skipping cache - no AI-processed transcript available');
            }

            // Save to YouTube history if user is authenticated
            if (userId) {
              await saveToYouTubeHistory(
                userId,
                videoId,
                videoMetadata?.title || supaResponse.data.title || 'Unknown',
                url,
                formattedTranscript || transcript,
                {
                  channelTitle: videoMetadata?.channelTitle,
                  thumbnails: videoMetadata?.thumbnails,
                  duration: videoMetadata?.duration,
                  publishedAt: videoMetadata?.publishedAt
                }
              );
            }

            return NextResponse.json({
              success: true,
              transcript,
              formattedTranscript,
              language: 'ja',
              isAutoGenerated: false, // SupaData provides quality transcripts
              videoTitle: videoMetadata?.title || supaResponse.data.title || 'Unknown',
              videoMetadata: videoMetadata,
              method: 'supadata-ai',
              hasFormattedVersion: !!formattedTranscript
            });
          }
      } else if (lastError) {
        // Handle error if all retries failed
        console.error('=== SupaData AI error after all retries ===');
        console.error('Error message:', lastError.message);
        console.error('Error response status:', lastError.response?.status);
        console.error('Error response data:', lastError.response?.data);
        if (lastError.response?.status === 404) {

        } else if (lastError.response?.status === 401) {
          console.error('SupaData API key authentication failed');
        } else if (lastError.response?.status === 403) {
          console.error('SupaData API key forbidden - check permissions');
        } else if (lastError.code === 'ECONNABORTED' || lastError.code === 'ETIMEDOUT') {
          console.error('SupaData request timed out - service may be slow');
        } else if (lastError.response?.status >= 500) {
          console.error('SupaData server error - service may be temporarily down');
        }
        // Continue to fallback methods
      }
    } else {

    }

    // Method 3: Try youtube-captions-scraper (JavaScript package)
    try {

      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('youtube-captions-scraper timeout')), 5000);
      });

      // Race between getting captions and timeout
      let captions: any[] = [];

      // First try to get Japanese captions
      try {
        captions = await Promise.race([
          getSubtitles({
            videoID: videoId!,
            lang: 'ja'
          }),
          timeoutPromise
        ]) as any[];
      } catch (jaError: any) {

        // Continue to next method
      }

      if (captions && captions.length > 0) {

        // Convert to our format
        const transcript = captions.map((caption: any, index: number) => ({
          id: String(index + 1),
          text: caption.text || '',
          startTime: (caption.start || 0) / 1000, // Convert ms to seconds
          endTime: ((caption.start || 0) + (caption.dur || 5000)) / 1000,
          words: (caption.text || '').split(/[\s、。！？]/g).filter((w: string) => w.length > 0)
        }));

        // Save to cache only for authenticated users
        if (isAuthenticated) {

          try {
            await transcriptCache.set({
              contentId,
              contentType: 'youtube',
              videoUrl: url,
              videoTitle: videoMetadata?.title || `YouTube Video ${videoId}`,
              transcript,
              language: 'ja',
              metadata: {
                youtubeVideoId: videoId,
                channelName: videoMetadata?.channelTitle,
                uploadDate: videoMetadata?.publishedAt,
                thumbnailUrl: videoMetadata?.thumbnails?.medium?.url || videoMetadata?.thumbnails?.default?.url,
                duration: videoMetadata?.duration
              }
            });

          } catch (cacheError) {
            console.error('Failed to cache youtube-captions-scraper transcript:', cacheError);
          }
        } else {

        }

        return NextResponse.json({
          success: true,
          transcript,
          language: 'ja',
          isAutoGenerated: false, // youtube-captions-scraper doesn't provide this info
          videoTitle: videoMetadata?.title || `YouTube Video ${videoId}`,
          videoMetadata: videoMetadata,
          method: 'youtube-captions-scraper'
        });
      }
    } catch (captionScraperError: any) {
      console.error('youtube-captions-scraper error:', captionScraperError.message);
      // Continue to next fallback method
    }

    // No captions found - check why

    // Check if API keys are configured
    const missingApis = [];
    if (!process.env.SUPA_YOUTUBE_API_KEY) {
      missingApis.push('SupaData API');
    }
    if (!process.env.YOUTUBE_API_KEY && !process.env.GOOGLE_API_KEY) {
      missingApis.push('YouTube/Google API');
    }

    // Provide more specific error message
    let errorMessage = 'This video does not have Japanese captions available. Try uploading the audio for AI transcription.';
    let errorCode = 'NO_CAPTIONS';
    let suggestions = [
      'Try uploading the audio file directly for AI transcription',
      'Check if the video has Japanese captions enabled on YouTube',
      'Try a different video with Japanese subtitles'
    ];

    // Check if we have a specific error to report
    if (missingApis.length > 0) {
      errorMessage = `API keys not configured: ${missingApis.join(', ')}. Please add the required API keys to enable transcript extraction.`;
      errorCode = 'MISSING_API_KEYS';
      suggestions = [
        `Add ${missingApis.join(' and ')} keys to .env.local`,
        'SupaData API provides fallback transcript extraction when YouTube captions are unavailable',
        'See documentation for how to obtain these API keys'
      ];
    } else if (hitRateLimit) {
      errorMessage = 'Our transcript service has reached its monthly limit. Please try again later or upload the audio directly for AI transcription.';
      errorCode = 'RATE_LIMIT';
    }

    return NextResponse.json({
      success: false,
      error: errorCode,
      message: errorMessage,
      videoTitle: videoMetadata?.title,
      videoMetadata: videoMetadata,
      suggestions: suggestions
    });

  } catch (error) {
    console.error('=== API route critical error ===');
    console.error('Error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');

    return NextResponse.json(
      {
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
      },
      { status: 500 }
    );
  }
}

function parseYouTubeCaptions(data: string): any[] {
  const transcript: any[] = [];

  try {
    if (typeof data === 'string') {
      if (data.includes('<text')) {
        // Parse XML format
        const textRegex = /<text\s+start="([\d.]+)"\s+dur="([\d.]+)"[^>]*>([^<]+)<\/text>/g;
        let match;
        let index = 1;

        while ((match = textRegex.exec(data)) !== null) {
          const start = parseFloat(match[1]);
          const duration = parseFloat(match[2]);
          const text = match[3]
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\n/g, ' ')
            .trim();

          if (text) {
            transcript.push({
              id: String(index++),
              text: text,
              startTime: start,
              endTime: start + duration,
              words: text.split(/[\s、。！？]/g).filter(w => w.length > 0)
            });
          }
        }
      } else if (data.startsWith('{') || data.startsWith('[')) {
        // Parse JSON format
        const json = JSON.parse(data);
        const events = json.events || json;

        if (Array.isArray(events)) {
          events.forEach((event, index) => {
            if (event.segs || event.text) {
              const text = event.text || event.segs.map(s => s.utf8).join('');
              const start = (event.tStartMs || event.start || 0) / 1000;
              const duration = (event.dDurationMs || event.dur || 5000) / 1000;

              transcript.push({
                id: String(index + 1),
                text: text.trim(),
                startTime: start,
                endTime: start + duration,
                words: text.trim().split(/[\s、。！？]/g).filter(w => w.length > 0)
              });
            }
          });
        }
      }
    }
  } catch (error) {
    console.error('Error parsing captions:', error);
  }

  return transcript;
}

function parseSupaDataTranscript(data: any): any[] {
  const transcript: any[] = [];

  try {
    // SupaData returns data in format: { lang: 'ja', content: [...], availableLangs: [...] }
    if (data.content && Array.isArray(data.content)) {
      data.content.forEach((segment, index) => {
        // Convert milliseconds to seconds
        const startTime = (segment.offset || 0) / 1000;
        const duration = (segment.duration || 5000) / 1000;
        const endTime = startTime + duration;

        transcript.push({
          id: String(index + 1),
          text: segment.text || '',
          startTime: startTime,
          endTime: endTime,
          words: (segment.text || '').split(/[\s、。！？]/g).filter(w => w.length > 0)
        });
      });
    }
    // Fallback for other possible formats
    else if (data.transcript) {
      // If it's already formatted as an array of segments
      if (Array.isArray(data.transcript)) {
        data.transcript.forEach((segment, index) => {
          transcript.push({
            id: String(index + 1),
            text: segment.text || segment.content || '',
            startTime: segment.start || segment.startTime || index * 5,
            endTime: segment.end || segment.endTime || (index + 1) * 5,
            words: (segment.text || segment.content || '').split(/[\s、。！？]/g).filter(w => w.length > 0)
          });
        });
      }
      // If it's a plain text transcript
      else if (typeof data.transcript === 'string') {
        // Split by sentences or paragraphs and create segments
        const sentences = data.transcript.split(/[。！？\n]+/).filter(s => s.trim());
        const avgDuration = 5; // 5 seconds per segment as default

        sentences.forEach((sentence, index) => {
          transcript.push({
            id: String(index + 1),
            text: sentence.trim(),
            startTime: index * avgDuration,
            endTime: (index + 1) * avgDuration,
            words: sentence.trim().split(/[\s、。！？]/g).filter(w => w.length > 0)
          });
        });
      }
    }
  } catch (error) {
    console.error('Error parsing SupaData transcript:', error);
  }

  return transcript;
}