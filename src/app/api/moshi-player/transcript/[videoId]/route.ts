import { NextRequest, NextResponse } from 'next/server'
import {
  runTranscriptWaterfall,
  resetInnertubeClient,
  type TranscriptSuccess,
} from '@/lib/moshi-player/transcript-providers'
import { normalizeRawTranscript } from '@/lib/moshi-player/raw-transcript'
import { reconstructSegments } from '@/lib/moshi-player/reconstruct-segments'
import { assignCoarseTiming } from '@/lib/moshi-player/segment-timings'
import { buildPlayerSegments } from '@/lib/moshi-player/player-segments'
import type { TranscriptComputedLayers } from '@/lib/moshi-player/transcript-types'

/**
 * Stage C1 — Moshi Player transcript route with computed segment layers.
 *
 * Rebuild-owned route with provider waterfall + segment reconstruction pipeline.
 * Returns:
 * - raw transcript (normalized provider output)
 * - reconstructed segments (learner-facing text)
 * - player segments (final playback contract)
 *
 * Provider order:
 *   1. YouTubei.js getTranscript() + selectLanguage()
 *   2. YouTubei.js timedtext caption-track URL
 *   3. Sheldon transcript server
 *   4. Supa API
 *
 * Stage C1 responsibilities:
 * - normalize provider output into rebuild-owned types
 * - reconstruct learner-facing text segments
 * - compute coarse timing (earliest start, latest end)
 * - build final player segment contract
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params

  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    return NextResponse.json(
      { available: false, videoId: videoId || '', error: 'Invalid video ID' },
      { status: 400 },
    )
  }

  // Support ?provider= query param for debugging
  const { searchParams } = new URL(request.url)
  const providerOverride = searchParams.get('provider') || undefined

  try {
    const result = await runTranscriptWaterfall(videoId, providerOverride)

    if (!result.available) {
      return NextResponse.json(result, { status: 200 })
    }

    // Run the Stage C1 pipeline
    const computedLayers = computeSegmentLayers(result as TranscriptSuccess)

    return NextResponse.json(computedLayers, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    // Retry once with fresh Innertube client on unhandled errors
    console.warn(`[moshi-player/transcript] Error for ${videoId}, retrying:`, err)
    try {
      resetInnertubeClient()
      const retryResult = await runTranscriptWaterfall(videoId, providerOverride)
      if (!retryResult.available) {
        return NextResponse.json(retryResult, { status: 200 })
      }

      // Run the Stage C1 pipeline on retry
      const computedLayers = computeSegmentLayers(retryResult as TranscriptSuccess)

      return NextResponse.json(computedLayers, {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
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

/**
 * Stage C1 — Compute segment layers from provider result.
 *
 * Pipeline:
 * 1. Normalize provider output → RawTranscriptUnit[]
 * 2. Reconstruct learner-facing text → ReconstructedTextSegment[]
 * 3. Assign coarse timing → AlignedPracticeSegment[]
 * 4. Build player segments → PlayerSegment[]
 */
function computeSegmentLayers(
  providerResult: TranscriptSuccess,
): TranscriptComputedLayers {
  // Layer 1: Normalize raw transcript
  const rawTranscript = normalizeRawTranscript(providerResult)

  // Layer 2: Reconstruct learner-facing text segments
  const reconstructedSegments = reconstructSegments(rawTranscript)

  // Layer 3: Assign coarse timing (internal, not exposed)
  const alignedSegments = assignCoarseTiming(reconstructedSegments, rawTranscript)

  // Layer 4: Build final player segments
  const playerSegments = buildPlayerSegments(alignedSegments)

  return {
    available: true,
    videoId: providerResult.videoId,
    title: providerResult.title,
    language: providerResult.language,
    availableLanguages: providerResult.availableLanguages,
    source: providerResult.source,
    totalDuration: providerResult.totalDuration,
    totalSegments: providerResult.totalSegments,

    // BACKWARD COMPATIBILITY: Include raw provider segments for Stage A page
    // This will be removed in Stage C2 when the page migrates to playerSegments
    segments: providerResult.segments,

    rawTranscript,
    reconstructedSegments,
    playerSegments,
  }
}
