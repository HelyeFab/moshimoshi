import { NextRequest, NextResponse } from 'next/server'
import { runTranscriptWaterfall, resetInnertubeClient } from '@/lib/moshi-player/transcript-providers'

/**
 * Stage A — Moshi Player transcript route.
 *
 * Rebuild-owned route with provider waterfall for robust Japanese transcript retrieval.
 * Returns raw transcript only — no AI formatting, no segmentation, no practice metadata.
 *
 * Provider order:
 *   1. YouTubei.js getTranscript() + selectLanguage()
 *   2. YouTubei.js timedtext caption-track URL
 *   3. Sheldon transcript server
 *   4. Supa API
 *
 * Important: this Stage A route does not read the old shared transcript cache.
 * A successful response must come from fresh retrieval providers only.
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params

  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    return NextResponse.json(
      { available: false, videoId: videoId || '', error: 'Invalid video ID' },
      { status: 400 },
    )
  }

  try {
    const result = await runTranscriptWaterfall(videoId)

    if (!result.available) {
      return NextResponse.json(result, { status: 200 })
    }

    return NextResponse.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
    })
  } catch (err) {
    // Retry once with fresh Innertube client on unhandled errors
    console.warn(`[moshi-player/transcript] Error for ${videoId}, retrying:`, err)
    try {
      resetInnertubeClient()
      const retryResult = await runTranscriptWaterfall(videoId)
      if (!retryResult.available) {
        return NextResponse.json(retryResult, { status: 200 })
      }
      return NextResponse.json(retryResult, {
        status: 200,
        headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
      })
    } catch (retryErr) {
      console.error(`[moshi-player/transcript] Retry failed for ${videoId}:`, retryErr)
      return NextResponse.json(
        { available: false, videoId, error: 'Failed to fetch transcript' },
        { status: 500 },
      )
    }
  }
}
