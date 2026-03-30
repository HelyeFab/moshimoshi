/**
 * Stage A — Moshi Player transcript provider waterfall.
 *
 * Ported from the old retrieval layer. Only raw transcript retrieval logic.
 * No AI formatting, no merge/chunk/resegmentation, no practice segments,
 * no quota/history/auth side effects.
 *
 * Provider order:
 *   1. YouTubei.js getTranscript() + selectLanguage()
 *   2. YouTubei.js timedtext caption-track URL
 *   3. Sheldon transcript server (residential IP)
 *   4. Supa API (last resort)
 */

import { Innertube } from 'youtubei.js'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RawSegment {
  start: number
  end: number
  duration: number
  text: string
}

export interface TranscriptSuccess {
  available: true
  videoId: string
  title: string
  language: string
  availableLanguages: string[]
  source: string
  segments: RawSegment[]
  totalSegments: number
  totalDuration: number
}

export interface TranscriptUnavailable {
  available: false
  videoId: string
  error: string
  source?: string
}

export type TranscriptResult = TranscriptSuccess | TranscriptUnavailable

// ─── Shared Innertube client ────────────────────────────────────────────────

let innertubeClient: Innertube | null = null

async function getInnertube(forceNew = false): Promise<Innertube> {
  if (!innertubeClient || forceNew) {
    innertubeClient = await Innertube.create()
  }
  return innertubeClient
}

/** Reset the cached Innertube client (e.g., after a stale session error). */
export function resetInnertubeClient(): void {
  innertubeClient = null
}

// ─── Language helpers ───────────────────────────────────────────────────────

function isJapaneseLanguage(title: string | undefined): boolean {
  if (!title) return false
  const lower = title.toLowerCase()
  return (
    (lower.includes('japanese') || lower.includes('日本語') || lower === 'ja') &&
    !lower.includes('english') &&
    !lower.includes('英語')
  )
}

function findJapaneseLanguage(languages: string[]): string | null {
  const tests = [
    (l: string) => l === '日本語',
    (l: string) => l.includes('日本語'),
    (l: string) => l.toLowerCase() === 'japanese',
    (l: string) => isJapaneseLanguage(l),
  ]
  for (const test of tests) {
    const found = languages.find(test)
    if (found) return found
  }
  return null
}

// ─── Provider 1: YouTubei.js getTranscript() API ────────────────────────────

/**
 * Use youtubei.js built-in getTranscript() + selectLanguage().
 * Returns null on API errors (e.g., /get_transcript 400) to allow fallback.
 * Returns unavailable result if no Japanese track exists.
 */
export async function tryYouTubeiTranscriptApi(
  videoId: string,
): Promise<TranscriptResult | null> {
  try {
    const yt = await getInnertube()
    const videoInfo = await yt.getInfo(videoId)
    const title = videoInfo.basic_info?.title || 'Untitled'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let transcriptInfo: any
    try {
      transcriptInfo = await videoInfo.getTranscript()
    } catch (err) {
      const msg = (err as Error)?.message || ''
      if (msg.includes('panel not found')) {
        return {
          available: false,
          videoId,
          error: 'No transcript available for this video',
          source: 'youtubei-api',
        }
      }
      // API error (e.g., 400) — return null to try fallback
      console.warn(`[moshi-player] YouTubei getTranscript failed:`, msg)
      return null
    }

    const languages: string[] = transcriptInfo.languages || []
    const selectedLanguage: string = transcriptInfo.selectedLanguage || ''

    // Use current language if already Japanese
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let targetTranscript: any = transcriptInfo
    let lang = selectedLanguage

    if (!isJapaneseLanguage(selectedLanguage)) {
      const jaLang = findJapaneseLanguage(languages)
      if (!jaLang) {
        return {
          available: false,
          videoId,
          error: languages.length > 0
            ? `No Japanese transcript. Available: ${languages.join(', ')}`
            : 'No Japanese transcript available',
          source: 'youtubei-api',
        }
      }
      try {
        targetTranscript = await transcriptInfo.selectLanguage(jaLang)
        lang = jaLang
      } catch (err) {
        console.warn(`[moshi-player] YouTubei selectLanguage failed:`, (err as Error)?.message)
        return null
      }
    }

    // Extract segments
    const body = targetTranscript?.transcript?.content?.body
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const segmentList: any[] = body?.initial_segments || []
    const segments: RawSegment[] = segmentList
      .filter((seg) => seg.type === 'TranscriptSegment')
      .map((seg) => {
        const startMs = parseInt(seg.start_ms) || 0
        const endMs = parseInt(seg.end_ms) || startMs + 3000
        return {
          start: startMs / 1000,
          end: endMs / 1000,
          duration: (endMs - startMs) / 1000,
          text: (seg.snippet?.text ?? seg.snippet?.toString?.() ?? '').trim(),
        }
      })
      .filter((seg) => seg.text.length > 0)

    if (segments.length === 0) {
      return { available: false, videoId, error: 'Japanese transcript has no segments', source: 'youtubei-api' }
    }

    const lastSeg = segments[segments.length - 1]
    return {
      available: true,
      videoId,
      title,
      language: lang,
      availableLanguages: languages,
      source: 'youtubei-api',
      segments,
      totalSegments: segments.length,
      totalDuration: lastSeg.end,
    }
  } catch (err) {
    console.warn(`[moshi-player] YouTubei API provider failed:`, (err as Error)?.message)
    return null
  }
}

// ─── Provider 2: YouTubei.js timedtext caption-track URL ────────────────────

/**
 * Use caption track URLs from the player response to fetch timedtext directly.
 * Bypasses the broken /get_transcript endpoint.
 * May return empty from datacenter IPs due to YouTube xowf protection.
 */
export async function tryYouTubeiTimedtext(
  videoId: string,
): Promise<TranscriptResult | null> {
  try {
    const yt = await getInnertube()
    const videoInfo = await yt.getInfo(videoId)
    const title = videoInfo.basic_info?.title || 'Untitled'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const captionsData = (videoInfo as any).page?.[0]?.captions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tracks: any[] = captionsData?.caption_tracks || []

    if (tracks.length === 0) return null

    // Find Japanese track by language code
    const jaTrack =
      tracks.find((t) => t.language_code === 'ja') ||
      tracks.find((t) => t.language_code?.startsWith('ja'))

    if (!jaTrack?.base_url) {
      const availableLangs = tracks
        .map((t) => t.name?.text || t.language_code)
        .filter(Boolean)
      return {
        available: false,
        videoId,
        error: availableLangs.length > 0
          ? `No Japanese caption track. Available: ${availableLangs.join(', ')}`
          : 'No caption tracks available',
        source: 'youtubei-timedtext',
      }
    }

    // Fetch timedtext with json3 format
    const res = await fetch(jaTrack.base_url + '&fmt=json3', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
    })

    if (!res.ok) {
      console.warn(`[moshi-player] Timedtext HTTP ${res.status}`)
      return null
    }

    const text = await res.text()
    if (!text || text.length === 0) {
      console.warn(`[moshi-player] Timedtext empty response (xowf protection)`)
      return null
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any
    try {
      data = JSON.parse(text)
    } catch {
      return null
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events: any[] = data.events || []
    const segments: RawSegment[] = events
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((ev: any) => ev.segs && ev.segs.length > 0)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((ev: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const segText = ev.segs.map((s: any) => s.utf8 || '').join('')
        const startMs = ev.tStartMs || 0
        const durMs = ev.dDurationMs || 3000
        return {
          start: startMs / 1000,
          end: (startMs + durMs) / 1000,
          duration: durMs / 1000,
          text: segText.trim(),
        }
      })
      .filter((seg: RawSegment) => seg.text.length > 0)

    if (segments.length === 0) return null

    const allLangs = tracks.map((t) => t.name?.text || t.language_code).filter(Boolean)
    const lastSeg = segments[segments.length - 1]
    return {
      available: true,
      videoId,
      title,
      language: jaTrack.name?.text || 'Japanese',
      availableLanguages: allLangs,
      source: 'youtubei-timedtext',
      segments,
      totalSegments: segments.length,
      totalDuration: lastSeg.end,
    }
  } catch (err) {
    console.warn(`[moshi-player] Timedtext provider failed:`, (err as Error)?.message)
    return null
  }
}

// ─── Provider 3: Sheldon transcript server ──────────────────────────────────

const SHELDON_DEFAULT_URL = 'https://api.selfmind.dev/transcript/api/youtube'

/**
 * Sheldon transcript server — home server with residential IP.
 * Requires SHELDON_API_KEY env var.
 */
export async function trySheldon(
  videoId: string,
): Promise<TranscriptResult | null> {
  const apiKey = process.env.SHELDON_API_KEY
  if (!apiKey) {
    return null
  }

  const baseUrl = process.env.SHELDON_API_URL || SHELDON_DEFAULT_URL

  try {
    const res = await fetch(`${baseUrl}/${videoId}`, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      console.warn(`[moshi-player] Sheldon HTTP ${res.status}`)
      return null
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json()

    if (!data.available || !data.isJapanese) {
      return null
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawSegs: any[] = data.segments || []
    if (rawSegs.length === 0) return null

    const segments: RawSegment[] = rawSegs
      .map((seg) => ({
        start: seg.start ?? 0,
        end: seg.end ?? (seg.start ?? 0) + 3,
        duration: seg.duration ?? (((seg.end ?? 0) - (seg.start ?? 0)) || 3),
        text: (seg.text || '').trim(),
      }))
      .filter((seg) => seg.text.length > 0)

    if (segments.length === 0) return null

    const lastSeg = segments[segments.length - 1]
    return {
      available: true,
      videoId,
      title: data.title || 'Untitled',
      language: data.language || 'Japanese',
      availableLanguages: data.availableLanguages || ['Japanese'],
      source: 'sheldon',
      segments,
      totalSegments: segments.length,
      totalDuration: lastSeg.end,
    }
  } catch (err) {
    console.warn(`[moshi-player] Sheldon provider failed:`, (err as Error)?.message)
    return null
  }
}

// ─── Provider 4: Supa API ───────────────────────────────────────────────────

/**
 * Supa API — paid transcript service, last resort.
 * Requires SUPA_YOUTUBE_API_KEY env var.
 * Reuses the existing shared Supa client.
 */
export async function trySupa(
  videoId: string,
): Promise<TranscriptResult | null> {
  try {
    const { getTranscriptFromSupa, isSupaConfigured } = await import('@/lib/supa/client')

    if (!isSupaConfigured()) {
      return null
    }

    const result = await getTranscriptFromSupa(videoId)
    if (!result || !result.transcript || result.transcript.length === 0) {
      return null
    }

    // Check if the result is Japanese
    const lang = result.language || ''
    const isJa = lang === 'ja' || lang.startsWith('ja') || isJapaneseLanguage(lang)
    if (!isJa) {
      console.warn(`[moshi-player] Supa returned non-Japanese: ${lang}`)
      return null
    }

    // Map to raw segments
    const segments: RawSegment[] = result.transcript
      .map((seg) => ({
        start: seg.startTime ?? 0,
        end: seg.endTime ?? seg.startTime + 3,
        duration: (seg.endTime ?? seg.startTime + 3) - (seg.startTime ?? 0),
        text: (seg.text || '').trim(),
      }))
      .filter((seg) => seg.text.length > 0)

    if (segments.length === 0) return null

    const lastSeg = segments[segments.length - 1]
    return {
      available: true,
      videoId,
      title: result.title || 'Untitled',
      language: result.language || 'ja',
      availableLanguages: result.availableLanguages || ['ja'],
      source: 'supa',
      segments,
      totalSegments: segments.length,
      totalDuration: lastSeg.end,
    }
  } catch (err) {
    console.warn(`[moshi-player] Supa provider failed:`, (err as Error)?.message)
    return null
  }
}

// ─── Waterfall orchestrator ─────────────────────────────────────────────────

interface ProviderEntry {
  name: string
  fn: (videoId: string) => Promise<TranscriptResult | null>
}

const MIN_ACCEPTABLE_SEGMENTS = 2
const MIN_ACCEPTABLE_TOTAL_DURATION_SECONDS = 10

/**
 * Reject obviously unusable transcript payloads in normal waterfall mode.
 *
 * Example: a long video that yields only one short manual caption line from a
 * provider should not block later fallbacks. Forced-provider mode bypasses this
 * gate so debugging can still inspect the raw provider output.
 */
function isUsableTranscriptResult(result: TranscriptSuccess): boolean {
  if (result.totalSegments < MIN_ACCEPTABLE_SEGMENTS) return false
  if (result.totalDuration < MIN_ACCEPTABLE_TOTAL_DURATION_SECONDS) return false
  return true
}

const PROVIDERS: ProviderEntry[] = [
  { name: 'youtubei-api', fn: tryYouTubeiTranscriptApi },
  { name: 'youtubei-timedtext', fn: tryYouTubeiTimedtext },
  { name: 'sheldon', fn: trySheldon },
  { name: 'supa', fn: trySupa },
]

/**
 * Run the transcript retrieval waterfall.
 * Tries each provider in order. First success wins.
 * Returns a definitive unavailable result if all providers fail.
 *
 * @param videoId - YouTube video ID
 * @param specificProvider - Optional: force a specific provider for debugging
 *                           Valid values: 'youtubei-api', 'youtubei-timedtext', 'sheldon', 'supa'
 */
export async function runTranscriptWaterfall(
  videoId: string,
  specificProvider?: string,
): Promise<TranscriptResult> {
  let lastUnavailable: TranscriptUnavailable | null = null

  // If a specific provider is requested, try only that one
  if (specificProvider) {
    const provider = PROVIDERS.find((p) => p.name === specificProvider)
    if (!provider) {
      return {
        available: false,
        videoId,
        error: `Unknown provider: ${specificProvider}. Valid: ${PROVIDERS.map((p) => p.name).join(', ')}`,
      }
    }

    console.log(`[moshi-player] Forcing provider: ${provider.name}`)
    try {
      const result = await provider.fn(videoId)
      if (result === null) {
        return {
          available: false,
          videoId,
          error: `Provider ${provider.name} returned null (not configured or failed)`,
        }
      }
      return result
    } catch (err) {
      return {
        available: false,
        videoId,
        error: `Provider ${provider.name} threw: ${(err as Error)?.message}`,
      }
    }
  }

  // Normal waterfall mode
  for (const provider of PROVIDERS) {
    try {
      console.log(`[moshi-player] Trying provider: ${provider.name}`)
      const result = await provider.fn(videoId)

      if (result === null) {
        console.log(`[moshi-player] Provider ${provider.name}: skipped (null)`)
        continue
      }

      if (result.available) {
        if (!isUsableTranscriptResult(result)) {
          console.log(
            `[moshi-player] Provider ${provider.name}: rejected low-quality result (${result.totalSegments} segments, ${result.totalDuration.toFixed(3)}s)`,
          )
          lastUnavailable = {
            available: false,
            videoId,
            error: `Provider ${provider.name} returned an insufficient transcript (${result.totalSegments} segments, ${result.totalDuration.toFixed(3)}s)`,
            source: provider.name,
          }
          continue
        }

        console.log(
          `[moshi-player] Provider ${provider.name}: SUCCESS (${result.totalSegments} segments)`,
        )
        return result
      }

      // Provider returned a definitive "unavailable" — save it but keep trying
      const unavailResult = result as TranscriptUnavailable
      console.log(`[moshi-player] Provider ${provider.name}: unavailable — ${unavailResult.error}`)
      lastUnavailable = unavailResult
    } catch (err) {
      console.error(`[moshi-player] Provider ${provider.name} threw:`, (err as Error)?.message)
    }
  }

  // All providers exhausted
  return (
    lastUnavailable || {
      available: false,
      videoId,
      error: 'All transcript providers failed. No Japanese transcript could be retrieved.',
    }
  )
}
