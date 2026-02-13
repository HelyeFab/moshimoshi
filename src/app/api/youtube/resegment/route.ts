/**
 * POST /api/youtube/resegment
 *
 * Resegments a transcript for repeat-friendly shadowing practice.
 *
 * Behaviour:
 * - When AI_RESEGMENTATION flag is OFF (default): deterministic pipeline only.
 * - When AI_RESEGMENTATION flag is ON: attempt AI, validated, with deterministic fallback.
 *
 * Cache: results are persisted keyed by videoId + modelVersion + pipelineVersion.
 *
 * Cost/latency assumptions (AI path, when enabled):
 * - Model: gpt-4o-mini (~$0.15/1M input, ~$0.60/1M output)
 * - Typical transcript: ~2 000 tokens input → ~2 500 tokens output
 * - Estimated cost per call: ~$0.002
 * - Estimated latency: 2-5 s (timeout: 15 s)
 *
 * Fallback behaviour table:
 * ┌──────────────────────┬──────────────────┬─────────────────────┐
 * │ Condition            │ Result           │ source field        │
 * ├──────────────────────┼──────────────────┼─────────────────────┤
 * │ Flag OFF             │ Deterministic    │ "deterministic"     │
 * │ Flag ON + cache hit  │ Cached result    │ cached source       │
 * │ Flag ON + AI success │ AI result        │ "ai"                │
 * │ Flag ON + AI fail    │ Deterministic    │ "deterministic"     │
 * │ Flag ON + AI timeout │ Deterministic    │ "deterministic"     │
 * │ Flag ON + validation │ Deterministic    │ "deterministic"     │
 * │   fails on AI output │                  │                     │
 * └──────────────────────┴──────────────────┴─────────────────────┘
 */

import { NextRequest, NextResponse } from 'next/server'
import { isFeatureEnabled } from '@/lib/features/featureFlags'
import {
  resegmentDeterministic,
  validateResegmentedOutput,
  PIPELINE_VERSION,
  type ResegmentedSegment,
  type ResegmentationResult,
} from '@/lib/transcript/resegmentation'
import { resegmentationCache } from '@/lib/transcript/resegmentationCache'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Model version used for AI resegmentation. Bump when prompt/model changes. */
const AI_MODEL_VERSION = 'gpt-4o-mini-v1'
/** Deterministic path uses a fixed "none" model version */
const DETERMINISTIC_MODEL_VERSION = 'none'
/** AI request timeout in ms */
const AI_TIMEOUT_MS = 15_000
/** Maximum number of input segments we accept */
const MAX_INPUT_SEGMENTS = 5_000

type FallbackReason =
  | 'none'
  | 'flag_off'
  | 'cache_hit'
  | 'ai_timeout'
  | 'ai_error'
  | 'ai_unsuccessful_response'
  | 'ai_validation_failed'
  | 'ai_service_import_failed'

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

interface ResegmentRequestBody {
  videoId: string
  segments: Array<{ text: string; start: number; end: number }>
  videoDuration?: number
}

function parseAndValidateBody(body: unknown): {
  ok: true; data: ResegmentRequestBody
} | {
  ok: false; error: string
} {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Request body is required' }
  }

  const b = body as Record<string, unknown>

  if (!b.videoId || typeof b.videoId !== 'string') {
    return { ok: false, error: 'videoId (string) is required' }
  }

  if (!Array.isArray(b.segments) || b.segments.length === 0) {
    return { ok: false, error: 'segments (non-empty array) is required' }
  }

  if (b.segments.length > MAX_INPUT_SEGMENTS) {
    return { ok: false, error: `Too many segments (max ${MAX_INPUT_SEGMENTS})` }
  }

  // Validate each segment has required shape
  for (let i = 0; i < b.segments.length; i++) {
    const seg = b.segments[i]
    if (
      !seg ||
      typeof seg !== 'object' ||
      typeof seg.text !== 'string' ||
      typeof seg.start !== 'number' ||
      typeof seg.end !== 'number'
    ) {
      return {
        ok: false,
        error: `segments[${i}] must have text (string), start (number), end (number)`,
      }
    }
  }

  const videoDuration =
    typeof b.videoDuration === 'number' && b.videoDuration > 0
      ? b.videoDuration
      : undefined

  return {
    ok: true,
    data: {
      videoId: b.videoId as string,
      segments: b.segments as ResegmentRequestBody['segments'],
      videoDuration,
    },
  }
}

// ---------------------------------------------------------------------------
// AI resegmentation (stubbed – wired when flag is ON)
// ---------------------------------------------------------------------------

/**
 * Attempt AI-powered resegmentation.
 * Returns null on any failure so the caller can fall back to deterministic.
 *
 * NOTE: This path is ONLY reachable when AI_RESEGMENTATION flag is ON.
 * With the flag OFF (current default) this function is never called.
 */
async function attemptAIResegmentation(
  _videoId: string,
  segments: ResegmentedSegment[],
  _videoDuration?: number
): Promise<{
  segments: ResegmentedSegment[] | null
  providerAttempted: string
  failureReason: FallbackReason
}> {
  const primaryProvider = process.env.AI_PROVIDER || 'openai'
  const ollamaEnabled = process.env.AI_OLLAMA_ENABLED === 'true'
  const providerAttempted =
    primaryProvider === 'ollama' && ollamaEnabled ? 'ollama' : 'openai'

  try {
    // TranscriptProcessorHybrid routes >50 segments into a parent batching path
    // that currently uses OpenAI. For resegmentation we only need full text, so
    // collapse input to one segment to keep Ollama path active on long videos.
    const aiInputSegments =
      segments.length > 50
        ? [
            {
              text: segments.map(s => s.text).join(''),
              start: segments[0]?.start ?? 0,
              end: segments[segments.length - 1]?.end ?? segments[0]?.end ?? 0,
            },
          ]
        : segments

    // Dynamic import to avoid loading AI deps when flag is off
    const { AIService } = await import('@/lib/ai/AIService')
    const aiService = AIService.getInstance()

    // Enforce timeout with Promise.race so a hung AI call cannot block indefinitely
    const aiPromise = aiService.processTranscript({
      content: {
        transcript: aiInputSegments.map(s => ({
          text: s.text,
          startTime: s.start,
          endTime: s.end,
        })),
      },
      splitForShadowing: true,
      maxSegmentLength: 20,
    })

    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(() => reject(new Error('AI_RESEGMENTATION_TIMEOUT')), AI_TIMEOUT_MS)
    })

    let response
    try {
      response = await Promise.race([aiPromise, timeoutPromise])
    } catch (raceError: unknown) {
      const msg = raceError instanceof Error ? raceError.message : String(raceError)
      if (msg === 'AI_RESEGMENTATION_TIMEOUT') {
        console.warn('[Resegment] AI request timed out after', AI_TIMEOUT_MS, 'ms')
        return { segments: null, providerAttempted, failureReason: 'ai_timeout' }
      } else {
        console.warn('[Resegment] AI processing error:', msg)
        return { segments: null, providerAttempted, failureReason: 'ai_error' }
      }
    } finally {
      clearTimeout(timeoutId)
    }

    if (!response.success || !response.data?.segments) {
      console.warn('[Resegment] AI returned unsuccessful response')
      return {
        segments: null,
        providerAttempted,
        failureReason: 'ai_unsuccessful_response',
      }
    }

    // Map AI output to ResegmentedSegment[]
    const aiSegments: ResegmentedSegment[] = response.data.segments.map(
      (seg: { text: string; startTime?: number; endTime?: number; start?: number; end?: number }) => ({
        text: seg.text,
        start: seg.startTime ?? seg.start ?? 0,
        end: seg.endTime ?? seg.end ?? 0,
      })
    )

    return { segments: aiSegments, providerAttempted, failureReason: 'none' }
  } catch (importError) {
    console.warn('[Resegment] Failed to load AI service:', importError)
    return {
      segments: null,
      providerAttempted,
      failureReason: 'ai_service_import_failed',
    }
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const forceRefresh =
      request.nextUrl.searchParams.get('forceRefresh') === '1' ||
      request.nextUrl.searchParams.get('forceRefresh') === 'true'

    const body = await request.json()
    const parsed = parseAndValidateBody(body)

    if (!parsed.ok) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: parsed.error },
        { status: 400 }
      )
    }

    const { videoId, segments: inputSegments, videoDuration } = parsed.data
    const aiEnabled = isFeatureEnabled('AI_RESEGMENTATION')
    const defaultProviderAttempted =
      process.env.AI_PROVIDER === 'ollama' && process.env.AI_OLLAMA_ENABLED === 'true'
        ? 'ollama'
        : 'openai'

    const modelVersion = aiEnabled ? AI_MODEL_VERSION : DETERMINISTIC_MODEL_VERSION
    const cacheKey = { videoId, modelVersion, pipelineVersion: PIPELINE_VERSION }

    // -----------------------------------------------------------------------
    // 1. Check cache
    // -----------------------------------------------------------------------
    const cached = forceRefresh ? null : await resegmentationCache.get(cacheKey)
    if (cached) {
      console.log(`[Resegment] cache hit for ${videoId} (${cached.source})`)
      return NextResponse.json({
        success: true,
        segments: cached.segments,
        source: cached.source,
        fromCache: true,
        pipelineVersion: PIPELINE_VERSION,
        segmentCount: cached.segmentCount,
        processingTime: Date.now() - startTime,
        aiEnabled,
        aiAttempted: false,
        providerAttempted: aiEnabled ? defaultProviderAttempted : null,
        fallbackReason: 'cache_hit' as FallbackReason,
        cacheBypassed: false,
      })
    }

    // -----------------------------------------------------------------------
    // 2. Normalise input
    // -----------------------------------------------------------------------
    const normalised: ResegmentedSegment[] = inputSegments.map(seg => ({
      text: seg.text,
      start: seg.start,
      end: seg.end,
    }))

    // -----------------------------------------------------------------------
    // 3. Run resegmentation pipeline
    // -----------------------------------------------------------------------
    let result: ResegmentationResult
    let aiAttempted = false
    let providerAttempted: string | null = aiEnabled ? defaultProviderAttempted : null
    let fallbackReason: FallbackReason = aiEnabled ? 'none' : 'flag_off'

    if (aiEnabled) {
      // AI path: attempt AI, validate, fallback to deterministic on failure
      aiAttempted = true
      const aiAttempt = await attemptAIResegmentation(videoId, normalised, videoDuration)
      providerAttempted = aiAttempt.providerAttempted
      const aiSegments = aiAttempt.segments

      if (aiSegments) {
        const validation = validateResegmentedOutput(aiSegments, {
          videoDuration,
        })

        if (validation.valid) {
          result = {
            segments: aiSegments,
            source: 'ai',
            pipelineVersion: PIPELINE_VERSION,
            validationPassed: true,
            validationErrors: [],
          }
          fallbackReason = 'none'
        } else {
          console.warn(
            `[Resegment] AI output failed validation for ${videoId}:`,
            validation.errors
          )
          // Fall back to deterministic
          result = resegmentDeterministic({
            segments: normalised,
            videoDurationHint: videoDuration,
          })
          fallbackReason = 'ai_validation_failed'
        }
      } else {
        // AI failed or timed out – fall back to deterministic
        result = resegmentDeterministic({
          segments: normalised,
          videoDurationHint: videoDuration,
        })
        fallbackReason = aiAttempt.failureReason
      }
    } else {
      // Flag OFF: deterministic only, no AI invocation
      result = resegmentDeterministic({
        segments: normalised,
        videoDurationHint: videoDuration,
      })
      fallbackReason = 'flag_off'
    }

    // -----------------------------------------------------------------------
    // 4. Cache result (fire-and-forget)
    // -----------------------------------------------------------------------
    resegmentationCache
      .set(cacheKey, result.segments, result.source)
      .catch(err => console.warn('[Resegment] cache write failed:', err))

    // -----------------------------------------------------------------------
    // 5. Respond
    // -----------------------------------------------------------------------
    const processingTime = Date.now() - startTime
    console.log(
      `[Resegment] ${videoId}: ${result.segments.length} segments via ${result.source} in ${processingTime}ms`
    )

    return NextResponse.json({
      success: true,
      segments: result.segments,
      source: result.source,
      fromCache: false,
      pipelineVersion: result.pipelineVersion,
      segmentCount: result.segments.length,
      validationPassed: result.validationPassed,
      validationErrors: result.validationErrors.length > 0 ? result.validationErrors : undefined,
      processingTime,
      aiEnabled,
      aiAttempted,
      providerAttempted,
      fallbackReason,
      cacheBypassed: forceRefresh,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('[Resegment] Unhandled error:', error)

    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR', message },
      { status: 500 }
    )
  }
}
