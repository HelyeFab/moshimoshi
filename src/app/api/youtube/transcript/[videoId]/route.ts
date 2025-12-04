import { NextRequest, NextResponse } from 'next/server'
import { Innertube } from 'youtubei.js'
import { transcriptCache } from '@/lib/transcript/cache'
import { getTranscriptFromSupa, isSupaConfigured } from '@/lib/supa/client'

interface TranscriptSegment {
  start: number
  end: number
  duration: number
  startTime: number
  endTime: number
  text: string
  words?: string[]
}

interface TranscriptResponse {
  available: boolean
  videoId: string
  title?: string
  segments?: TranscriptSegment[]
  language?: string
  availableLanguages?: string[]
  source?:
    | 'firebase-cache'
    | 'railway-server'
    | 'sheldon-server'
    | 'youtubei-enhanced'
    | 'youtubei-standard'
    | 'supa-api'
  cached?: boolean
  totalSegments?: number
  totalDuration?: number
  message?: string
  error?: string
}

let youtubeClient: Innertube | null = null

async function getClient(): Promise<Innertube> {
  if (!youtubeClient) {
    youtubeClient = await Innertube.create()
  }
  return youtubeClient
}

function isJapaneseTitle(title: string | undefined): boolean {
  if (!title) return false
  const lower = title.toLowerCase()
  return (
    (lower.includes('japanese') || lower.includes('日本語')) &&
    !lower.includes('english') &&
    !lower.includes('英語')
  )
}

/**
 * Try to get transcript using YouTubei.js with Japanese language selection
 */
async function tryEnhancedYouTubeiJS(videoId: string): Promise<TranscriptResponse | null> {
  try {
    console.log(`[TRANSCRIPT-API] Trying enhanced YouTubei.js for ${videoId}`)

    const client = await getClient()
    const videoInfo = await client.getInfo(videoId)
    const transcriptInfo = await videoInfo.getTranscript()

    const languageMenu = transcriptInfo?.transcript?.content?.footer?.language_menu
    const availableLanguages = languageMenu?.sub_menu_items || []

    const japaneseOptions = availableLanguages.filter((lang: any) => isJapaneseTitle(lang.title))

    if (japaneseOptions.length === 0) {
      console.log(`[TRANSCRIPT-API] No Japanese transcript available`)
      return null
    }

    // Use flexible type to allow both original transcriptInfo and custom format
    let transcriptPayload: { transcript?: any } | typeof transcriptInfo = transcriptInfo
    let selectedLanguage = availableLanguages.find((lang: any) => lang.selected)

    // Force Japanese language if not already selected
    if (!isJapaneseTitle(selectedLanguage?.title) && japaneseOptions[0]?.continuation) {
      const session = (client as any).session
      const payload = {
        context: session?.context,
        continuation: japaneseOptions[0].continuation,
      }

      let response: any = null

      if (client?.actions?.execute) {
        response = await client.actions.execute('get_transcript', payload)
      } else if (session?.actions?.execute) {
        response = await session.actions.execute('get_transcript', payload)
      } else if (session?.http?.fetch) {
        response = await session.http.fetch('get_transcript', payload)
      }

      if (response?.actions?.[0]?.updateEngagementPanelAction?.content) {
        transcriptPayload = {
          transcript: response.actions[0].updateEngagementPanelAction.content,
        }
        selectedLanguage = japaneseOptions[0]
      }
    }

    const body = transcriptPayload?.transcript?.content?.body
    const segmentList = body?.initial_segments || []

    if (!segmentList || segmentList.length === 0) {
      return null
    }

    const segments: TranscriptSegment[] = segmentList.map((seg: any) => {
      const startMs = parseInt(seg.start_ms) || 0
      const endMs = parseInt(seg.end_ms) || startMs + 5000
      const text = seg.snippet?.text || ''
      const startSeconds = startMs / 1000
      const endSeconds = endMs / 1000

      return {
        start: startSeconds,
        end: endSeconds,
        duration: endSeconds - startSeconds,
        startTime: startSeconds,
        endTime: endSeconds,
        text,
        words: text.split(/[\s、。！？]/).filter((w: string) => w.length > 0),
      }
    })

    console.log(`[TRANSCRIPT-API] ✅ Enhanced YouTubei.js success: ${segments.length} segments`)

    // Validate that we got Japanese if Japanese was available
    const detectedLanguage = selectedLanguage?.title || 'Unknown'
    const isJapanese =
      detectedLanguage.toLowerCase().includes('japanese') ||
      detectedLanguage.toLowerCase().includes('日本語')

    if (!isJapanese && japaneseOptions.length > 0) {
      console.warn(`[TRANSCRIPT-API] ⚠️ Japanese available but got ${detectedLanguage}. Rejecting.`)
      return null // Force fallback to next method
    }

    return {
      available: true,
      videoId,
      title: videoInfo.basic_info?.title || 'Unknown title',
      segments,
      language: detectedLanguage,
      availableLanguages: availableLanguages.map((lang: any) => lang.title),
      source: 'youtubei-enhanced',
      totalSegments: segments.length,
      totalDuration: segments[segments.length - 1]?.end || 0,
    }
  } catch (error) {
    console.error(`[TRANSCRIPT-API] Enhanced YouTubei.js failed:`, error)
    return null
  }
}

/**
 * Try to get transcript using standard YouTubei.js (no language selection)
 */
async function tryStandardYouTubeiJS(videoId: string): Promise<TranscriptResponse | null> {
  try {
    console.log(`[TRANSCRIPT-API] Trying standard YouTubei.js for ${videoId}`)

    const client = await getClient()
    const videoInfo = await client.getInfo(videoId)
    const transcriptInfo = await videoInfo.getTranscript()

    const body = transcriptInfo?.transcript?.content?.body
    const segmentList = body?.initial_segments || []

    if (!segmentList || segmentList.length === 0) {
      return null
    }

    const segments: TranscriptSegment[] = segmentList.map((seg: any) => {
      const startMs = parseInt(seg.start_ms) || 0
      const endMs = parseInt(seg.end_ms) || startMs + 5000
      const text = seg.snippet?.text || ''
      const startSeconds = startMs / 1000
      const endSeconds = endMs / 1000

      return {
        start: startSeconds,
        end: endSeconds,
        duration: endSeconds - startSeconds,
        startTime: startSeconds,
        endTime: endSeconds,
        text,
        words: text.split(/[\s、。！？]/).filter((w: string) => w.length > 0),
      }
    })

    console.log(`[TRANSCRIPT-API] ✅ Standard YouTubei.js success: ${segments.length} segments`)

    return {
      available: true,
      videoId,
      title: videoInfo.basic_info?.title || 'Unknown title',
      segments,
      language: 'Auto-detected',
      source: 'youtubei-standard',
      totalSegments: segments.length,
      totalDuration: segments[segments.length - 1]?.end || 0,
    }
  } catch (error) {
    console.error(`[TRANSCRIPT-API] Standard YouTubei.js failed:`, error)
    return null
  }
}

/**
 * Try to get transcript using Railway transcript server (PRIMARY)
 * Uses Webshare rotating residential proxies
 */
async function tryRailwayTranscriptServer(videoId: string): Promise<TranscriptResponse | null> {
  try {
    const RAILWAY_API_URL =
      process.env.RAILWAY_TRANSCRIPT_URL || 'https://modal-services-production.up.railway.app'

    console.log(`[TRANSCRIPT-API] Trying Railway transcript server for ${videoId}`)

    const response = await fetch(
      `${RAILWAY_API_URL}/get-japanese-transcript?videoId=${encodeURIComponent(videoId)}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    )

    if (!response.ok) {
      console.log(`[TRANSCRIPT-API] Railway server returned ${response.status}`)
      return null
    }

    const data = await response.json()

    if (!data.available || !data.isJapanese) {
      console.log(`[TRANSCRIPT-API] Railway server: transcript not available or not Japanese`)
      return null
    }

    // Transform Railway server format to our format
    const segments: TranscriptSegment[] = data.segments.map((seg: any) => ({
      start: seg.start,
      end: seg.end,
      duration: seg.duration,
      startTime: seg.start,
      endTime: seg.end,
      text: seg.text,
      words: seg.text.split(/[\s、。！？]/).filter((w: string) => w.length > 0),
    }))

    console.log(
      `[TRANSCRIPT-API] ✅ Railway transcript server success: ${segments.length} segments`
    )

    return {
      available: true,
      videoId,
      title: data.title || 'Unknown title',
      segments,
      language: data.language || 'Japanese',
      availableLanguages: data.availableLanguages || ['Japanese'],
      source: 'railway-server',
      totalSegments: segments.length,
      totalDuration: segments[segments.length - 1]?.end || 0,
    }
  } catch (error) {
    console.error(`[TRANSCRIPT-API] Railway transcript server failed:`, error)
    return null
  }
}

/**
 * Try to get transcript using Sheldon server (FALLBACK)
 * Home server with residential IP - api.selfmind.dev
 */
async function trySheldonTranscriptServer(videoId: string): Promise<TranscriptResponse | null> {
  try {
    const SHELDON_API_URL =
      process.env.SHELDON_API_URL || 'https://api.selfmind.dev/transcript/api/youtube'
    const SHELDON_API_KEY = process.env.SHELDON_API_KEY

    if (!SHELDON_API_KEY) {
      console.log(`[TRANSCRIPT-API] No SHELDON_API_KEY configured, skipping Sheldon server`)
      return null
    }

    console.log(`[TRANSCRIPT-API] Trying Sheldon transcript server for ${videoId}`)

    const response = await fetch(`${SHELDON_API_URL}/${encodeURIComponent(videoId)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': SHELDON_API_KEY,
      },
    })

    if (!response.ok) {
      console.log(`[TRANSCRIPT-API] Sheldon server returned ${response.status}`)
      return null
    }

    const data = await response.json()

    if (!data.available || !data.isJapanese) {
      console.log(`[TRANSCRIPT-API] Sheldon server: transcript not available or not Japanese`)
      return null
    }

    // Transform Sheldon server format to our format
    const segments: TranscriptSegment[] = data.segments.map((seg: any) => ({
      start: seg.start,
      end: seg.end,
      duration: seg.duration,
      startTime: seg.start,
      endTime: seg.end,
      text: seg.text,
      words: seg.text.split(/[\s、。！？]/).filter((w: string) => w.length > 0),
    }))

    console.log(
      `[TRANSCRIPT-API] ✅ Sheldon transcript server success: ${segments.length} segments`
    )

    return {
      available: true,
      videoId,
      title: data.title || 'Unknown title',
      segments,
      language: data.language || 'Japanese',
      availableLanguages: data.availableLanguages || ['Japanese'],
      source: 'sheldon-server',
      totalSegments: segments.length,
      totalDuration: segments[segments.length - 1]?.end || 0,
    }
  } catch (error) {
    console.error(`[TRANSCRIPT-API] Sheldon transcript server failed:`, error)
    return null
  }
}

/**
 * Main API route handler with cache-first approach
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  let videoId = ''

  try {
    const resolved = await params
    videoId = resolved.videoId

    if (!videoId) {
      return NextResponse.json<TranscriptResponse>(
        { available: false, videoId: '', error: 'Video ID is required' },
        { status: 400 }
      )
    }

    const contentId = `youtube_${videoId}`

    // ==========================================
    // STEP 1: CHECK FIREBASE CACHE FIRST (Admin SDK)
    // ==========================================
    console.log(`[TRANSCRIPT-API] Step 1: Checking Firebase cache for ${videoId}`)

    const cached = await transcriptCache.get(contentId)

    if (cached && cached.transcript && cached.transcript.length > 0) {
      console.log(`[TRANSCRIPT-API] ✅ Cache hit! Returning ${cached.transcript.length} segments`)

      // Transform cached format to API format
      const segments: TranscriptSegment[] = cached.transcript.map(line => ({
        start: line.startTime,
        end: line.endTime,
        duration: line.endTime - line.startTime,
        startTime: line.startTime,
        endTime: line.endTime,
        text: line.text,
        words: line.words,
      }))

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
      })
    }

    console.log(`[TRANSCRIPT-API] Cache miss - proceeding to fetch`)

    // ==========================================
    // STEP 2: TRY RAILWAY TRANSCRIPT SERVER (PRIMARY)
    // ==========================================
    const railwayResult = await tryRailwayTranscriptServer(videoId)

    if (railwayResult && railwayResult.segments) {
      // Store to Firebase cache (async, don't block response)
      transcriptCache
        .set({
          contentId,
          contentType: 'youtube',
          transcript: railwayResult.segments.map((seg, i) => ({
            id: String(i + 1),
            text: seg.text,
            startTime: seg.start,
            endTime: seg.end,
            words: seg.words,
          })),
          language: railwayResult.language || 'ja',
          videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
          videoTitle: railwayResult.title,
          metadata: {
            youtubeVideoId: videoId,
          },
        })
        .catch(err => console.error('[TRANSCRIPT-API] Cache save failed:', err))

      return NextResponse.json<TranscriptResponse>(railwayResult)
    }

    // ==========================================
    // STEP 3: TRY SHELDON TRANSCRIPT SERVER (FALLBACK)
    // ==========================================
    const sheldonResult = await trySheldonTranscriptServer(videoId)

    if (sheldonResult && sheldonResult.segments) {
      // Store to Firebase cache (async, don't block response)
      transcriptCache
        .set({
          contentId,
          contentType: 'youtube',
          transcript: sheldonResult.segments.map((seg, i) => ({
            id: String(i + 1),
            text: seg.text,
            startTime: seg.start,
            endTime: seg.end,
            words: seg.words,
          })),
          language: sheldonResult.language || 'ja',
          videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
          videoTitle: sheldonResult.title,
          metadata: {
            youtubeVideoId: videoId,
          },
        })
        .catch(err => console.error('[TRANSCRIPT-API] Cache save failed:', err))

      return NextResponse.json<TranscriptResponse>(sheldonResult)
    }

    // ==========================================
    // STEP 4: TRY ENHANCED YOUTUBEI.JS
    // ==========================================
    const enhancedResult = await tryEnhancedYouTubeiJS(videoId)

    if (enhancedResult && enhancedResult.segments) {
      // Store to Firebase cache (async, don't block response) - using Admin SDK
      transcriptCache
        .set({
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
        })
        .catch(err => console.error('[TRANSCRIPT-API] Cache save failed:', err))

      return NextResponse.json<TranscriptResponse>(enhancedResult)
    }

    // ==========================================
    // STEP 5: TRY STANDARD YOUTUBEI.JS
    // ==========================================
    const standardResult = await tryStandardYouTubeiJS(videoId)

    if (standardResult && standardResult.segments) {
      // Store to Firebase cache - using Admin SDK
      transcriptCache
        .set({
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
        })
        .catch(err => console.error('[TRANSCRIPT-API] Cache save failed:', err))

      return NextResponse.json<TranscriptResponse>(standardResult)
    }

    // ==========================================
    // STEP 6: TRY SUPA API (LAST RESORT)
    // ==========================================
    if (isSupaConfigured()) {
      console.log(`[TRANSCRIPT-API] Step 6: Trying Supa API`)

      const supaResult = await getTranscriptFromSupa(videoId)

      if (supaResult && supaResult.transcript) {
        const segments: TranscriptSegment[] = supaResult.transcript.map(seg => ({
          start: seg.startTime,
          end: seg.endTime,
          duration: seg.endTime - seg.startTime,
          startTime: seg.startTime,
          endTime: seg.endTime,
          text: seg.text,
          words: seg.words,
        }))

        // Store to Firebase cache - using Admin SDK
        transcriptCache
          .set({
            contentId,
            contentType: 'youtube',
            transcript: supaResult.transcript,
            language: supaResult.language,
            videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
            videoTitle: supaResult.title,
            metadata: {
              youtubeVideoId: videoId,
            },
          })
          .catch(err => console.error('[TRANSCRIPT-API] Cache save failed:', err))

        console.log(`[TRANSCRIPT-API] ✅ Supa API success: ${segments.length} segments`)

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
        })
      }
    }

    // ==========================================
    // ALL METHODS FAILED
    // ==========================================
    console.log(`[TRANSCRIPT-API] ❌ All methods failed for ${videoId}`)

    return NextResponse.json<TranscriptResponse>(
      {
        available: false,
        videoId,
        message: 'No transcript available for this video.',
        error: 'All transcript fetch methods failed',
      },
      { status: 404 }
    )
  } catch (error) {
    console.error(`[TRANSCRIPT-API] Fatal error for ${videoId}:`, error)

    return NextResponse.json<TranscriptResponse>(
      {
        available: false,
        videoId,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}
