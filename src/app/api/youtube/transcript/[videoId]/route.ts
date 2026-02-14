import { NextRequest, NextResponse } from 'next/server'
import { Innertube } from 'youtubei.js'
import { transcriptCache } from '@/lib/transcript/cache'
import { getTranscriptFromSupa, isSupaConfigured } from '@/lib/supa/client'
import {
  mergeTranscriptSegments,
  shouldMergeTranscriptSegments,
  type MergeableTranscriptSegment,
} from '@/lib/transcript/mergeSegments'
import { chunkTranscriptSegments } from '@/lib/transcript/chunkSegments'
import type { ResegmentedSegment } from '@/lib/transcript/resegmentation'
import { validateResegmentedOutput } from '@/lib/transcript/resegmentation'
import { computeSegmentQuality } from '@/lib/transcript/segmentQuality'
import { alignAiTextsToSourceTimeline } from '@/lib/transcript/aiTimingAlignment'

interface TranscriptSegment {
  start: number
  end: number
  duration: number
  startTime: number
  endTime: number
  text: string
  words?: string[]
  translation?: string
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
  processing?: {
    aiProcessed?: boolean
    aiMethod?: string
    aiReason?: string
    aiPipelineVersion?: string
    aiQualityBefore?: number
    aiQualityAfter?: number
    correctionApplied?: boolean
    ai_attempted?: boolean
    ai_chunks_total?: number
    ai_chunks_failed?: number
    ai_accept_ratio?: number
    ai_latency_ms_total?: number
    quality_before?: number
    quality_after?: number
    reject_reason_histogram?: Record<string, number>
  }
  message?: string
  error?: string
}

let youtubeClient: Innertube | null = null

const TINY_DUPLICATE_MAX_CHARS = 4
const TINY_DUPLICATE_MAX_DURATION = 1.2
const TINY_DUPLICATE_MAX_GAP = 0.2
const ORPHAN_PARTICLE_REGEX = /^(ね|よ|な|か|さ|ぞ|ぜ|わ|よね|ねえ|ねぇ)[。！？!?]?$/
const TIMELINE_EPSILON_SECONDS = 0.02
const MIN_SEGMENT_DURATION_SECONDS = 0.2
const OPENAI_TIMEOUT_MS = 35_000
const AI_PIPELINE_VERSION = '2.3.0'
const OPENAI_MODEL = 'gpt-4o-mini'
const AI_CHUNK_STRATEGY_VERSION = '1.0.0'
const SENTENCE_END_REGEX = /[。！？!?]$/
const LEADING_PARTICLE_REGEX = /^(は|が|を|に|へ|で|と|の|も|や|か|ね|よ|な|さ|ぞ|ぜ|わ)(?:$|[、。！？!?])/
const EMERGENCY_DISABLE_AI_SHADOWING = false
const AI_MIN_QUALITY_DELTA = 0.03
const AI_MAX_SEGMENT_DURATION_SECONDS = 10
const AI_CHUNK_MIN_SEGMENTS = 80
const AI_CHUNK_TARGET_SEGMENTS = 120
const AI_CHUNK_MAX_SEGMENTS = 180
const AI_ALIGNMENT_MIN_MATCH_RATIO = 0.9

interface AiPipelineMetrics {
  ai_attempted: boolean
  ai_chunks_total: number
  ai_chunks_failed: number
  ai_accept_ratio: number
  ai_latency_ms_total: number
  quality_before: number
  quality_after: number
  reject_reason_histogram: Record<string, number>
}

interface AiPipelineResult {
  segments: TranscriptSegment[]
  method: 'ai' | 'deterministic'
  reason: string
  qualityBefore: number
  qualityAfter: number
  correctionApplied: boolean
  metrics: AiPipelineMetrics
}

interface AiChunkWindow {
  segments: TranscriptSegment[]
}

function removeTinyAdjacentTextOverlap(segments: TranscriptSegment[]): TranscriptSegment[] {
  if (segments.length < 2) return segments

  const cleaned: TranscriptSegment[] = []
  for (const current of segments) {
    const prev = cleaned[cleaned.length - 1]
    if (!prev) {
      cleaned.push(current)
      continue
    }

    const currentText = (current.text || '').trim()
    const prevText = (prev.text || '').trim()
    if (!currentText || !prevText) {
      cleaned.push(current)
      continue
    }

    const currentDuration = Math.max(current.end - current.start, 0)
    const gap = current.start - prev.end
    const isOverlappingDuplicate = current.start < prev.end

    const isLikelyOrphanParticle = ORPHAN_PARTICLE_REGEX.test(currentText)
    const isTinyDuplicate =
      currentText.length <= TINY_DUPLICATE_MAX_CHARS &&
      (
        (currentDuration <= TINY_DUPLICATE_MAX_DURATION && gap <= TINY_DUPLICATE_MAX_GAP) ||
        isOverlappingDuplicate ||
        isLikelyOrphanParticle
      ) &&
      prevText.endsWith(currentText)

    if (isTinyDuplicate) continue
    cleaned.push(current)
  }

  return cleaned
}

function normalizeSegmentsForCache(segments: TranscriptSegment[]): TranscriptSegment[] {
  const deduped = removeTinyAdjacentTextOverlap(segments)

  const mergeCandidates: MergeableTranscriptSegment[] = deduped.map(seg => ({
    start: seg.start,
    end: seg.end,
    text: seg.text,
    words: seg.words,
  }))

  const merged = shouldMergeTranscriptSegments(mergeCandidates)
    ? mergeTranscriptSegments(mergeCandidates)
    : mergeCandidates

  // Split multi-clause lines (e.g. "...ね。山綺麗だね。") into repeat-friendly units.
  // This keeps text and timing aligned better for looped playback.
  const chunked = chunkTranscriptSegments(
    merged.map(seg => ({
      start: seg.start,
      end: seg.end,
      text: seg.text,
    }))
  )

  const healed = healBrokenWordBoundaries(chunked.map(seg => ({
    start: seg.start,
    end: seg.end,
    duration: seg.end - seg.start,
    startTime: seg.start,
    endTime: seg.end,
    text: seg.text,
    words: seg.text.split(/[\s、。！？]/).filter((w: string) => w.length > 0),
  })))

  return enforceNonOverlappingTimeline(healed)
}

function enforceNonOverlappingTimeline(segments: TranscriptSegment[]): TranscriptSegment[] {
  if (segments.length <= 1) return segments

  const normalized: TranscriptSegment[] = []

  for (let i = 0; i < segments.length; i++) {
    const current = segments[i]
    const prev = normalized[i - 1]
    const next = segments[i + 1]

    let start = current.start
    let end = current.end

    // Prevent backward/overlapping starts.
    if (prev && start < prev.end) {
      start = prev.end + TIMELINE_EPSILON_SECONDS
    }

    // Clamp end to before the next segment start to avoid audio bleed across repeats.
    if (next && end > next.start) {
      end = next.start - TIMELINE_EPSILON_SECONDS
    }

    // Keep segments playable even after clamping.
    if (end <= start) {
      end = start + MIN_SEGMENT_DURATION_SECONDS
    }

    normalized.push({
      ...current,
      start,
      end,
      startTime: start,
      endTime: end,
      duration: end - start,
    })
  }

  return normalized
}

function healBrokenWordBoundaries(segments: TranscriptSegment[]): TranscriptSegment[] {
  if (segments.length < 2) return segments

  const merged: TranscriptSegment[] = []
  for (const current of segments) {
    const prev = merged[merged.length - 1]
    if (!prev) {
      merged.push(current)
      continue
    }

    const prevText = prev.text.trim()
    const currentText = current.text.trim()
    const prevEndsKanji = /[\u4E00-\u9FFF]$/.test(prevText)
    const currentStartsHiragana = /^[ぁ-ん]/.test(currentText)
    const prevEndsSentence = SENTENCE_END_REGEX.test(prevText)
    const currentStartsParticle = LEADING_PARTICLE_REGEX.test(currentText)

    const shouldHealBoundary =
      prevEndsKanji &&
      currentStartsHiragana &&
      !prevEndsSentence &&
      !currentStartsParticle

    if (!shouldHealBoundary) {
      merged.push(current)
      continue
    }

    const mergedText = `${prev.text}${current.text}`
    const mergedEnd = Math.max(prev.end, current.end)
    merged[merged.length - 1] = {
      ...prev,
      text: mergedText,
      end: mergedEnd,
      endTime: mergedEnd,
      duration: mergedEnd - prev.start,
      words: mergedText.split(/[\s、。！？]/).filter((w: string) => w.length > 0),
    }
  }

  return merged
}

function toResegmentedSegments(segments: TranscriptSegment[]): ResegmentedSegment[] {
  return segments.map(seg => ({
    text: seg.text,
    start: seg.start,
    end: seg.end,
  }))
}

function toTranscriptSegments(segments: ResegmentedSegment[]): TranscriptSegment[] {
  return segments.map(seg => ({
    start: seg.start,
    end: seg.end,
    duration: seg.end - seg.start,
    startTime: seg.start,
    endTime: seg.end,
    text: seg.text,
    words: seg.text.split(/[\s、。！？]/).filter((w: string) => w.length > 0),
  }))
}

function hasUnsafeSegmentDurations(segments: TranscriptSegment[]): boolean {
  return segments.some(seg => (seg.end - seg.start) > AI_MAX_SEGMENT_DURATION_SECONDS)
}

function createDefaultAiMetrics(qualityBefore: number): AiPipelineMetrics {
  return {
    ai_attempted: false,
    ai_chunks_total: 0,
    ai_chunks_failed: 0,
    ai_accept_ratio: 0,
    ai_latency_ms_total: 0,
    quality_before: qualityBefore,
    quality_after: qualityBefore,
    reject_reason_histogram: {},
  }
}

function incrementRejectReason(metrics: AiPipelineMetrics, reason: string): void {
  metrics.reject_reason_histogram[reason] = (metrics.reject_reason_histogram[reason] || 0) + 1
}

function createAiChunkWindows(segments: TranscriptSegment[]): AiChunkWindow[] {
  if (segments.length === 0) return []

  const windows: AiChunkWindow[] = []
  let cursor = 0
  while (cursor < segments.length) {
    const remaining = segments.length - cursor
    if (remaining <= AI_CHUNK_MAX_SEGMENTS) {
      if (remaining < AI_CHUNK_MIN_SEGMENTS && windows.length > 0) {
        windows[windows.length - 1].segments.push(...segments.slice(cursor))
      } else {
        windows.push({ segments: segments.slice(cursor) })
      }
      break
    }

    const minEnd = Math.min(cursor + AI_CHUNK_MIN_SEGMENTS, segments.length)
    const targetEnd = Math.min(cursor + AI_CHUNK_TARGET_SEGMENTS, segments.length)
    const maxEnd = Math.min(cursor + AI_CHUNK_MAX_SEGMENTS, segments.length)

    let selectedEnd = targetEnd
    for (let i = targetEnd; i <= maxEnd; i++) {
      if (SENTENCE_END_REGEX.test((segments[i - 1]?.text || '').trim())) {
        selectedEnd = i
        break
      }
    }

    if (selectedEnd === targetEnd) {
      for (let i = targetEnd; i >= minEnd; i--) {
        if (SENTENCE_END_REGEX.test((segments[i - 1]?.text || '').trim())) {
          selectedEnd = i
          break
        }
      }
    }

    if (selectedEnd <= cursor) {
      selectedEnd = Math.min(cursor + AI_CHUNK_TARGET_SEGMENTS, segments.length)
    }

    windows.push({ segments: segments.slice(cursor, selectedEnd) })
    cursor = selectedEnd
  }

  return windows
}

function buildProcessingInfo(ai: AiPipelineResult): NonNullable<TranscriptResponse['processing']> {
  return {
    aiProcessed: true,
    aiMethod: ai.method,
    aiReason: ai.reason,
    aiPipelineVersion: AI_PIPELINE_VERSION,
    aiQualityBefore: ai.qualityBefore,
    aiQualityAfter: ai.qualityAfter,
    correctionApplied: ai.correctionApplied,
    ...ai.metrics,
  }
}

function buildAiMetadata(ai: AiPipelineResult): Record<string, unknown> {
  return {
    aiShadowingProcessedAt: new Date(),
    aiShadowingMethod: ai.method,
    aiShadowingReason: ai.reason,
    aiShadowingQualityBefore: ai.qualityBefore,
    aiShadowingQualityAfter: ai.qualityAfter,
    aiShadowingPipelineVersion: AI_PIPELINE_VERSION,
    aiShadowingCorrectionApplied: ai.correctionApplied,
    aiShadowingModel: OPENAI_MODEL,
    aiShadowingChunkStrategyVersion: AI_CHUNK_STRATEGY_VERSION,
    aiShadowingMetrics: ai.metrics,
  }
}

function ensureAiTiming(
  aiSegments: ResegmentedSegment[],
  sourceSegments: TranscriptSegment[]
): ResegmentedSegment[] {
  if (aiSegments.length === 0) return aiSegments

  const validation = validateResegmentedOutput(aiSegments)
  if (validation.valid) return aiSegments

  const sourceStart = sourceSegments[0]?.start ?? 0
  const sourceEnd = sourceSegments[sourceSegments.length - 1]?.end ?? sourceStart + 1
  const totalDuration = Math.max(sourceEnd - sourceStart, 0.5)
  const cleanTexts = aiSegments.map(s => (s.text || '').trim()).filter(Boolean)
  if (cleanTexts.length === 0) return []
  const totalChars = cleanTexts.reduce((sum, t) => sum + t.length, 0)

  let cursor = sourceStart
  return cleanTexts.map((text, idx) => {
    const remaining = cleanTexts.length - idx - 1
    const minRemaining = remaining * MIN_SEGMENT_DURATION_SECONDS
    const proportional = totalChars > 0 ? (text.length / totalChars) * totalDuration : 0.8
    const desiredEnd = cursor + Math.max(proportional, MIN_SEGMENT_DURATION_SECONDS)
    const safeEnd = idx === cleanTexts.length - 1
      ? sourceEnd
      : Math.min(desiredEnd, sourceEnd - minRemaining)
    const end = Math.max(safeEnd, cursor + MIN_SEGMENT_DURATION_SECONDS)

    const seg: ResegmentedSegment = { text, start: cursor, end }
    cursor = end
    return seg
  })
}

async function runAiShadowingPipeline(
  videoId: string,
  videoTitle: string,
  segments: TranscriptSegment[]
): Promise<AiPipelineResult> {
  const baseline = normalizeSegmentsForCache(segments)
  const qualityBefore = computeSegmentQuality(
    baseline.map(seg => ({ text: seg.text, start: seg.start, end: seg.end }))
  ).score
  const metrics = createDefaultAiMetrics(qualityBefore)

  // Emergency rollback: AI-first pipeline introduced timing regressions in player looping.
  // Keep deterministic normalization active while we redesign AI timing alignment.
  if (EMERGENCY_DISABLE_AI_SHADOWING) {
    return {
      segments: baseline,
      method: 'deterministic',
      reason: 'ai_emergency_disabled',
      qualityBefore,
      qualityAfter: qualityBefore,
      correctionApplied: false,
      metrics,
    }
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return {
      segments: baseline,
      method: 'deterministic',
      reason: 'openai_unconfigured',
      qualityBefore,
      qualityAfter: qualityBefore,
      correctionApplied: false,
      metrics,
    }
  }

  try {
    const chunkWindows = createAiChunkWindows(baseline)
    if (chunkWindows.length === 0) {
      return {
        segments: baseline,
        method: 'deterministic',
        reason: 'openai_empty_baseline',
        qualityBefore,
        qualityAfter: qualityBefore,
        correctionApplied: false,
        metrics,
      }
    }

    const correctionApplied = false
    metrics.ai_attempted = true
    metrics.ai_chunks_total = chunkWindows.length

    const merged: TranscriptSegment[] = []
    let acceptedChunks = 0

    for (const window of chunkWindows) {
      const chunkSource = window.segments
      const chunkSourceQuality = computeSegmentQuality(
        chunkSource.map(seg => ({ text: seg.text, start: seg.start, end: seg.end }))
      ).score

      const sourceText = chunkSource.map(seg => seg.text).join('')
      const chunkStartTime = Date.now()
      let fallbackReason = 'openai_unsuccessful_response'
      let acceptedChunk: TranscriptSegment[] | null = null

      try {
        const aiMapped = await requestOpenAiShadowingSegmentation(videoTitle, sourceText)
        if (!aiMapped || aiMapped.length === 0) {
          fallbackReason = 'openai_unsuccessful_response'
        } else {
          const anchored = alignAiTextsToSourceTimeline(
            aiMapped.map(seg => seg.text),
            chunkSource.map(seg => ({ text: seg.text, start: seg.start, end: seg.end })),
            AI_ALIGNMENT_MIN_MATCH_RATIO
          )

          if (!anchored) {
            fallbackReason = 'openai_alignment_failed'
          } else {
            const aiValidation = validateResegmentedOutput(anchored.segments)
            if (!aiValidation.valid) {
              fallbackReason = 'ai_validation_failed'
            } else {
              const aiNormalized = normalizeSegmentsForCache(toTranscriptSegments(anchored.segments))
              const chunkQualityAfter = computeSegmentQuality(
                aiNormalized.map(seg => ({ text: seg.text, start: seg.start, end: seg.end }))
              ).score
              const chunkQualityDelta = chunkQualityAfter - chunkSourceQuality

              if (hasUnsafeSegmentDurations(aiNormalized)) {
                fallbackReason = 'openai_duration_safety_reject'
              } else if (chunkQualityDelta < AI_MIN_QUALITY_DELTA) {
                fallbackReason = 'openai_quality_regression'
              } else {
                acceptedChunk = aiNormalized
              }
            }
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        fallbackReason = message === 'OPENAI_TIMEOUT' ? 'openai_timeout' : 'openai_error'
      }

      metrics.ai_latency_ms_total += Date.now() - chunkStartTime
      if (acceptedChunk) {
        acceptedChunks += 1
        merged.push(...acceptedChunk)
      } else {
        metrics.ai_chunks_failed += 1
        incrementRejectReason(metrics, fallbackReason)
        merged.push(...chunkSource)
      }
    }

    metrics.ai_accept_ratio = metrics.ai_chunks_total > 0
      ? acceptedChunks / metrics.ai_chunks_total
      : 0

    if (acceptedChunks === 0) {
      const topReason = Object.entries(metrics.reject_reason_histogram)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'openai_all_chunks_failed'
      metrics.quality_after = qualityBefore
      return {
        segments: baseline,
        method: 'deterministic',
        reason: topReason,
        qualityBefore,
        qualityAfter: qualityBefore,
        correctionApplied,
        metrics,
      }
    }

    const aiNormalized = enforceNonOverlappingTimeline(removeTinyAdjacentTextOverlap(merged))
    const qualityAfter = computeSegmentQuality(
      aiNormalized.map(seg => ({ text: seg.text, start: seg.start, end: seg.end }))
    ).score
    metrics.quality_after = qualityAfter

    console.log(
      `[TRANSCRIPT-API] ✅ OpenAI shadowing pipeline applied for ${videoId}: ${baseline.length} -> ${aiNormalized.length} segments, chunks accepted=${acceptedChunks}/${metrics.ai_chunks_total} (quality ${qualityBefore.toFixed(2)} -> ${qualityAfter.toFixed(2)}), correction=${correctionApplied}`
    )
    return {
      segments: aiNormalized,
      method: 'ai',
      reason: acceptedChunks < metrics.ai_chunks_total
        ? 'openai_segmented_partial_fallback'
        : (correctionApplied ? 'openai_corrected_and_segmented' : 'openai_segmented'),
      qualityBefore,
      qualityAfter,
      correctionApplied,
      metrics,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`[TRANSCRIPT-API] OpenAI shadowing pipeline failed for ${videoId}:`, message)
    incrementRejectReason(metrics, message === 'OPENAI_TIMEOUT' ? 'openai_timeout' : 'openai_error')
    return {
      segments: baseline,
      method: 'deterministic',
      reason: message === 'OPENAI_TIMEOUT' ? 'openai_timeout' : 'openai_error',
      qualityBefore,
      qualityAfter: qualityBefore,
      correctionApplied: false,
      metrics,
    }
  }
}

async function requestOpenAiShadowingSegmentation(
  videoTitle: string,
  sourceText: string
): Promise<ResegmentedSegment[] | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  if (!sourceText.trim()) return null

  const systemPrompt = [
    'You are a Japanese shadowing segmentation engine.',
    'Split transcript text into natural short units for repetition.',
    'Rules:',
    '1) Keep each segment <= 20 Japanese characters when possible.',
    '2) Never split inside a word/morpheme (e.g. 結ばれる must stay together).',
    '3) Prefer clause boundaries and punctuation boundaries.',
    '4) Keep semantic coherence; avoid orphan particles like ね。 by themselves.',
    'Return strict JSON object: {"segments":["...","..."]}',
  ].join('\n')

  const userPrompt = `Title: ${videoTitle}\n\nTranscript:\n${sourceText}`

  const requestBody = {
    model: OPENAI_MODEL,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  }

  const fetchPromise = fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  })

  let timeoutId: ReturnType<typeof setTimeout> | null = null
  const response = await Promise.race([
    fetchPromise,
    new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('OPENAI_TIMEOUT')), OPENAI_TIMEOUT_MS)
    }),
  ])
  if (timeoutId) clearTimeout(timeoutId)
  if (!response.ok) {
    const err = await response.text().catch(() => '')
    throw new Error(`OPENAI_HTTP_${response.status}:${err}`)
  }

  const payload = await response.json()
  const content = payload?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) return null

  let parsed: any
  try {
    parsed = JSON.parse(content)
  } catch {
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) return null
    parsed = JSON.parse(match[0])
  }

  const rawSegments = Array.isArray(parsed?.segments) ? parsed.segments : []
  const texts = rawSegments
    .map((seg: any) => (typeof seg === 'string' ? seg : seg?.text))
    .filter((text: any): text is string => typeof text === 'string' && text.trim().length > 0)
    .map((text: string): string => text.trim())

  if (texts.length === 0) return null

  return texts.map((text: string) => ({ text, start: 0, end: 0 }))
}

async function requestOpenAiTranscriptCorrection(
  videoTitle: string,
  sourceText: string
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || !sourceText.trim()) return null

  const systemPrompt = [
    'You are a Japanese transcript correction engine for shadowing practice.',
    'Fix obvious ASR/caption errors while preserving meaning and style.',
    'Rules:',
    '1) Return corrected Japanese text only (single string in JSON).',
    '2) Keep punctuation natural and sentence boundaries explicit.',
    '3) Do not translate, summarize, or add new content.',
    '4) Preserve proper nouns when possible.',
    'Return strict JSON object: {"corrected":"..."}',
  ].join('\n')

  const userPrompt = `Title: ${videoTitle}\n\nTranscript:\n${sourceText}`
  const requestBody = {
    model: OPENAI_MODEL,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  }

  const fetchPromise = fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  })

  let timeoutId: ReturnType<typeof setTimeout> | null = null
  const response = await Promise.race([
    fetchPromise,
    new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('OPENAI_TIMEOUT')), OPENAI_TIMEOUT_MS)
    }),
  ])
  if (timeoutId) clearTimeout(timeoutId)
  if (!response.ok) {
    const err = await response.text().catch(() => '')
    throw new Error(`OPENAI_HTTP_${response.status}:${err}`)
  }

  const payload = await response.json()
  const content = payload?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) return null

  try {
    const parsed = JSON.parse(content)
    const corrected = typeof parsed?.corrected === 'string' ? parsed.corrected.trim() : ''
    return corrected || null
  } catch {
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) return null
    const parsed = JSON.parse(match[0])
    const corrected = typeof parsed?.corrected === 'string' ? parsed.corrected.trim() : ''
    return corrected || null
  }
}

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
    const forceRefresh = request.nextUrl.searchParams.get('forceRefresh') === 'true'

    // ==========================================
    // STEP 1: CHECK FIREBASE CACHE FIRST (Admin SDK)
    // ==========================================
    console.log(`[TRANSCRIPT-API] Step 1: Checking Firebase cache for ${videoId}`)

    const cached = forceRefresh ? null : await transcriptCache.get(contentId)

    if (cached && cached.transcript && cached.transcript.length > 0) {
      if (
        EMERGENCY_DISABLE_AI_SHADOWING &&
        (cached as any)?.metadata?.aiShadowingMethod === 'ai'
      ) {
        console.warn(
          `[TRANSCRIPT-API] Skipping cached AI-processed transcript for ${videoId} (emergency rollback)`
        )
      } else {
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
        translation: line.translation,
      }))

      const hasTranslations = segments.some(seg => !!seg.translation)
      const cleanedSegments = removeTinyAdjacentTextOverlap(segments)
      let mergedSegments = hasTranslations
        ? enforceNonOverlappingTimeline(cleanedSegments)
        : normalizeSegmentsForCache(cleanedSegments)
      let processingInfo: NonNullable<TranscriptResponse['processing']> = {
        aiProcessed: true,
        aiMethod: (cached as any)?.metadata?.aiShadowingMethod,
        aiReason: (cached as any)?.metadata?.aiShadowingReason,
        aiPipelineVersion: (cached as any)?.metadata?.aiShadowingPipelineVersion,
        aiQualityBefore: (cached as any)?.metadata?.aiShadowingQualityBefore,
        aiQualityAfter: (cached as any)?.metadata?.aiShadowingQualityAfter,
        correctionApplied: Boolean((cached as any)?.metadata?.aiShadowingCorrectionApplied),
        ai_attempted: Boolean((cached as any)?.metadata?.aiShadowingMetrics?.ai_attempted),
        ai_chunks_total: (cached as any)?.metadata?.aiShadowingMetrics?.ai_chunks_total,
        ai_chunks_failed: (cached as any)?.metadata?.aiShadowingMetrics?.ai_chunks_failed,
        ai_accept_ratio: (cached as any)?.metadata?.aiShadowingMetrics?.ai_accept_ratio,
        ai_latency_ms_total: (cached as any)?.metadata?.aiShadowingMetrics?.ai_latency_ms_total,
        quality_before: (cached as any)?.metadata?.aiShadowingMetrics?.quality_before,
        quality_after: (cached as any)?.metadata?.aiShadowingMetrics?.quality_after,
        reject_reason_histogram: (cached as any)?.metadata?.aiShadowingMetrics?.reject_reason_histogram,
      }
      const cachedAiMethod = (cached as any)?.metadata?.aiShadowingMethod
      const cachedPipelineVersion = (cached as any)?.metadata?.aiShadowingPipelineVersion
      const cachedAiModel = (cached as any)?.metadata?.aiShadowingModel
      const cachedChunkStrategy = (cached as any)?.metadata?.aiShadowingChunkStrategyVersion
      const needsAiUpgrade =
        !cachedAiMethod ||
        cachedAiMethod !== 'ai' ||
        cachedPipelineVersion !== AI_PIPELINE_VERSION ||
        cachedAiModel !== OPENAI_MODEL ||
        cachedChunkStrategy !== AI_CHUNK_STRATEGY_VERSION

      if (needsAiUpgrade) {
        const aiProcessed = await runAiShadowingPipeline(
          videoId,
          cached.videoTitle || 'Cached Video',
          mergedSegments
        )
        mergedSegments = aiProcessed.segments
        processingInfo = buildProcessingInfo(aiProcessed)
        transcriptCache
          .updateTranscriptWithMetadata({
            contentId,
            transcript: mergedSegments.map((seg, i) => ({
              id: String(i + 1),
              text: seg.text,
              startTime: seg.start,
              endTime: seg.end,
              words: seg.words,
              translation: seg.translation,
            })),
            metadata: {
              ...Object.fromEntries(
                Object.entries(buildAiMetadata(aiProcessed)).map(([key, value]) => [
                  `metadata.${key}`,
                  value,
                ])
              ),
            },
          })
          .catch(err => console.error('[TRANSCRIPT-API] Cache AI update failed:', err))
      }

      if (!hasTranslations && mergedSegments.length !== cleanedSegments.length) {
        transcriptCache
          .updateTranscriptWithMetadata({
            contentId,
            transcript: mergedSegments.map((seg, i) => ({
              id: String(i + 1),
              text: seg.text,
              startTime: seg.start,
              endTime: seg.end,
              words: seg.words,
              translation: seg.translation,
            })),
            metadata: {
              'metadata.segmentMergedAt': new Date(),
            },
          })
          .catch(err => console.error('[TRANSCRIPT-API] Cache merge update failed:', err))
      }

      return NextResponse.json<TranscriptResponse>({
        available: true,
        videoId,
        title: cached.videoTitle || 'Cached Video',
        segments: mergedSegments,
        language: cached.language || 'ja',
        source: 'firebase-cache',
        cached: true,
        totalSegments: mergedSegments.length,
        totalDuration: mergedSegments[mergedSegments.length - 1]?.end || 0,
        processing: processingInfo,
      })
      }
    }

    console.log(`[TRANSCRIPT-API] Cache miss - proceeding to fetch`)

    // ==========================================
    // STEP 2: TRY RAILWAY TRANSCRIPT SERVER (PRIMARY)
    // ==========================================
    const railwayResult = await tryRailwayTranscriptServer(videoId)

    if (railwayResult && railwayResult.segments) {
      const aiProcessed = await runAiShadowingPipeline(
        videoId,
        railwayResult.title || 'Unknown title',
        railwayResult.segments
      )
      const normalizedSegments = aiProcessed.segments
      // Store to Firebase cache (async, don't block response)
      transcriptCache
        .set({
          contentId,
          contentType: 'youtube',
          transcript: normalizedSegments.map((seg, i) => ({
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
            ...buildAiMetadata(aiProcessed),
          },
        })
        .catch(err => console.error('[TRANSCRIPT-API] Cache save failed:', err))

      return NextResponse.json<TranscriptResponse>({
        ...railwayResult,
        segments: normalizedSegments,
        totalSegments: normalizedSegments.length,
        totalDuration: normalizedSegments[normalizedSegments.length - 1]?.end || 0,
        processing: buildProcessingInfo(aiProcessed),
      })
    }

    // ==========================================
    // STEP 3: TRY SHELDON TRANSCRIPT SERVER (FALLBACK)
    // ==========================================
    const sheldonResult = await trySheldonTranscriptServer(videoId)

    if (sheldonResult && sheldonResult.segments) {
      const aiProcessed = await runAiShadowingPipeline(
        videoId,
        sheldonResult.title || 'Unknown title',
        sheldonResult.segments
      )
      const normalizedSegments = aiProcessed.segments
      // Store to Firebase cache (async, don't block response)
      transcriptCache
        .set({
          contentId,
          contentType: 'youtube',
          transcript: normalizedSegments.map((seg, i) => ({
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
            ...buildAiMetadata(aiProcessed),
          },
        })
        .catch(err => console.error('[TRANSCRIPT-API] Cache save failed:', err))

      return NextResponse.json<TranscriptResponse>({
        ...sheldonResult,
        segments: normalizedSegments,
        totalSegments: normalizedSegments.length,
        totalDuration: normalizedSegments[normalizedSegments.length - 1]?.end || 0,
        processing: buildProcessingInfo(aiProcessed),
      })
    }

    // ==========================================
    // STEP 4: TRY ENHANCED YOUTUBEI.JS
    // ==========================================
    const enhancedResult = await tryEnhancedYouTubeiJS(videoId)

    if (enhancedResult && enhancedResult.segments) {
      const aiProcessed = await runAiShadowingPipeline(
        videoId,
        enhancedResult.title || 'Unknown title',
        enhancedResult.segments
      )
      const normalizedSegments = aiProcessed.segments
      // Store to Firebase cache (async, don't block response) - using Admin SDK
      transcriptCache
        .set({
          contentId,
          contentType: 'youtube',
          transcript: normalizedSegments.map((seg, i) => ({
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
            ...buildAiMetadata(aiProcessed),
          },
        })
        .catch(err => console.error('[TRANSCRIPT-API] Cache save failed:', err))

      return NextResponse.json<TranscriptResponse>({
        ...enhancedResult,
        segments: normalizedSegments,
        totalSegments: normalizedSegments.length,
        totalDuration: normalizedSegments[normalizedSegments.length - 1]?.end || 0,
        processing: buildProcessingInfo(aiProcessed),
      })
    }

    // ==========================================
    // STEP 5: TRY STANDARD YOUTUBEI.JS
    // ==========================================
    const standardResult = await tryStandardYouTubeiJS(videoId)

    if (standardResult && standardResult.segments) {
      const aiProcessed = await runAiShadowingPipeline(
        videoId,
        standardResult.title || 'Unknown title',
        standardResult.segments
      )
      const normalizedSegments = aiProcessed.segments
      // Store to Firebase cache - using Admin SDK
      transcriptCache
        .set({
          contentId,
          contentType: 'youtube',
          transcript: normalizedSegments.map((seg, i) => ({
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
            ...buildAiMetadata(aiProcessed),
          },
        })
        .catch(err => console.error('[TRANSCRIPT-API] Cache save failed:', err))

      return NextResponse.json<TranscriptResponse>({
        ...standardResult,
        segments: normalizedSegments,
        totalSegments: normalizedSegments.length,
        totalDuration: normalizedSegments[normalizedSegments.length - 1]?.end || 0,
        processing: buildProcessingInfo(aiProcessed),
      })
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
        const aiProcessed = await runAiShadowingPipeline(
          videoId,
          supaResult.title || 'Unknown title',
          segments
        )
        const normalizedSegments = aiProcessed.segments

        // Store to Firebase cache - using Admin SDK
        transcriptCache
          .set({
            contentId,
            contentType: 'youtube',
            transcript: normalizedSegments.map((seg, i) => ({
              id: String(i + 1),
              text: seg.text,
              startTime: seg.start,
              endTime: seg.end,
              words: seg.words,
            })),
            language: supaResult.language,
            videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
            videoTitle: supaResult.title,
            metadata: {
              youtubeVideoId: videoId,
              ...buildAiMetadata(aiProcessed),
            },
          })
          .catch(err => console.error('[TRANSCRIPT-API] Cache save failed:', err))

        console.log(`[TRANSCRIPT-API] ✅ Supa API success: ${normalizedSegments.length} segments`)

        return NextResponse.json<TranscriptResponse>({
          available: true,
          videoId,
          title: supaResult.title || 'Unknown title',
          segments: normalizedSegments,
          language: supaResult.language,
          availableLanguages: supaResult.availableLanguages,
          source: 'supa-api',
          totalSegments: normalizedSegments.length,
          totalDuration: normalizedSegments[normalizedSegments.length - 1]?.end || 0,
          processing: buildProcessingInfo(aiProcessed),
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
