'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '@/components/ui/Toast/ToastContext'
import type { TranscriptLine } from '@/types/youtubeShadowing'

export type TranscriptSegment = TranscriptLine & {
  [key: string]: unknown
}

export interface TranscriptState {
  segments: TranscriptSegment[]
  source: 'raw' | 'ai-enhanced'
  videoTitle?: string
  metadata?: Record<string, unknown>
}

export interface UseProgressiveTranscriptOptions {
  enableAI?: boolean
  maxSegmentLength?: number
  addFurigana?: boolean
  includeTranslations?: boolean
}

interface ProgressiveState {
  transcript: TranscriptState | null
  loading: boolean
  error: string | null
  aiEnhancing: boolean
  aiProgress: number
  refetch: () => void
}

const YOUTUBE_URL_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s]+)/,
  /youtube\.com\/v\/([^&\s]+)/,
  /youtube\.com\/shorts\/([^&\s]+)/,
  /music\.youtube\.com\/watch\?v=([^&\s]+)/,
]

const INVALID_URL_ERROR = 'Invalid YouTube URL. Please check the URL and try again.'
const MAX_PREFETCH_CHARS = 48000
const PREFETCH_CHUNK_SIZE = 8000

const normalizeYoutubeUrl = (url: string): string => {
  const videoId = extractVideoId(url)
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : url
}

export function extractVideoId(url: string): string | null {
  for (const pattern of YOUTUBE_URL_PATTERNS) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }
  return null
}

const mapToSegments = (segments: any[]): TranscriptSegment[] =>
  (segments || []).map((segment, index) => ({
    id: segment.id ?? String(index + 1),
    text: segment.text ?? '',
    startTime: typeof segment.startTime === 'number' ? segment.startTime : (segment.start ?? 0),
    endTime:
      typeof segment.endTime === 'number' ? segment.endTime : (segment.end ?? segment.start ?? 0),
    words: segment.words,
    translation: segment.translation,
    difficulty: segment.difficulty,
    textWithFurigana: segment.textWithFurigana,
  }))

const createTranscriptState = (
  segments: TranscriptSegment[],
  source: 'raw' | 'ai-enhanced',
  videoTitle?: string,
  metadata?: Record<string, unknown>
): TranscriptState => ({
  segments,
  source,
  videoTitle,
  metadata,
})

function chunkText(text: string, size: number): string[] {
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size))
  }
  return chunks
}

export function useProgressiveTranscript(
  url: string | null | undefined,
  options: UseProgressiveTranscriptOptions = {}
): ProgressiveState {
  const {
    enableAI = false,
    maxSegmentLength = 20,
    addFurigana = false,
    includeTranslations = true,
  } = options

  const { showToast } = useToast()
  const [transcript, setTranscript] = useState<TranscriptState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aiEnhancing, setAiEnhancing] = useState(false)
  const [aiProgress, setAiProgress] = useState(0)
  const [reloadFlag, setReloadFlag] = useState(0)
  const lastPrecomputeVideoIdRef = useRef<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const latestRequestIdRef = useRef(0)

  const normalizedOptions = useMemo(
    () => ({ enableAI, maxSegmentLength, addFurigana, includeTranslations }),
    [enableAI, maxSegmentLength, addFurigana, includeTranslations]
  )

  const triggerWordPrecompute = useCallback(async (videoId: string, segments: TranscriptSegment[]) => {
    if (!videoId || lastPrecomputeVideoIdRef.current === videoId) {
      return
    }

    const fullText = segments
      .map(segment => segment.text || '')
      .filter(Boolean)
      .join(' ')

    if (!fullText.trim()) {
      return
    }

    lastPrecomputeVideoIdRef.current = videoId

    const safeText = fullText.length > MAX_PREFETCH_CHARS
      ? fullText.slice(0, MAX_PREFETCH_CHARS)
      : fullText

    const chunks = chunkText(safeText, PREFETCH_CHUNK_SIZE).slice(0, 6)

    try {
      for (let idx = 0; idx < chunks.length; idx++) {
        const chunk = chunks[idx]
        const response = await fetch('/api/word/precompute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contentId: videoId,
            contentType: 'youtube',
            text: chunk,
            chunkIndex: idx,
            allowWhileGenerating: idx > 0,
            includeParticles: true,
            minLength: 1,
          }),
        })

        if (!response.ok) {
          continue
        }

        const payload = await response.json().catch(() => null)
        if (payload?.skipped === 'locked' || payload?.skipped === 'complete') {
          break
        }
      }
    } catch (error) {
      console.warn('[ProgressiveTranscript] Word precompute failed', error)
    }
  }, [])

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!url) {
      setTranscript(null)
      setError(null)
      setLoading(false)
      setAiEnhancing(false)
      setAiProgress(0)
      return
    }

    const videoId = extractVideoId(url)
    if (!videoId) {
      setTranscript(null)
      setError(INVALID_URL_ERROR)
      setLoading(false)
      setAiEnhancing(false)
      setAiProgress(0)
      return
    }

    const controller = new AbortController()
    abortControllerRef.current?.abort()
    abortControllerRef.current = controller

    const requestId = ++latestRequestIdRef.current

    const resetProgressInterval = () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
    }

    const startProgressInterval = () => {
      resetProgressInterval()
      setAiProgress(5)
      progressIntervalRef.current = setInterval(() => {
        setAiProgress(prev => {
          if (prev >= 90) {
            return prev
          }
          return Math.min(prev + Math.random() * 12 + 4, 90)
        })
      }, 700)
    }

    const fetchRawTranscript = async () => {
      try {
        setLoading(true)
        setError(null)
        setAiEnhancing(false)
        setAiProgress(0)
        setTranscript(null)

        const normalizedUrl = normalizeYoutubeUrl(url)
        const response = await fetch(`/api/youtube/extract?videoId=${videoId}&phase=raw`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: normalizedUrl,
            provider: 'youtube-native',
            forceRegenerate: false,
            maxSegmentLength: normalizedOptions.maxSegmentLength,
            addFurigana: normalizedOptions.addFurigana,
            includeTranslations: normalizedOptions.includeTranslations,
          }),
          signal: controller.signal,
        })

        if (!response.ok) {
          const payload = await safeParseJson(response)
          throw new Error(payload?.message || 'Failed to load transcript')
        }

        const data = await response.json()

        if (!data?.success) {
          throw new Error(data?.message || 'Transcript unavailable')
        }

        if (!Array.isArray(data?.transcript) || data.transcript.length === 0) {
          throw new Error(data?.message || 'No Japanese transcript available for this video.')
        }

        const rawSegments = mapToSegments(data.transcript)
        const formattedSegments = Array.isArray(data.formattedTranscript)
          ? mapToSegments(data.formattedTranscript)
          : null

        const initialState = createTranscriptState(
          formattedSegments ?? rawSegments,
          formattedSegments ? 'ai-enhanced' : 'raw',
          data.videoTitle,
          {
            ...data.videoMetadata,
            method: data.method,
            forcedJapanese: data.forcedJapanese,
            formattingPending: data.formattingPending,
            fromCache: data.fromCache,
          }
        )

        if (latestRequestIdRef.current === requestId) {
          setTranscript(initialState)
          setLoading(false)

          showToast('Transcript loaded! You can start shadowing right away.', 'success')
        }

        if (latestRequestIdRef.current === requestId) {
          const precomputeSegments = formattedSegments ?? rawSegments
          void triggerWordPrecompute(videoId, precomputeSegments)
        }

        // If AI already provided formatted transcript, skip enhancement.
        if (!normalizedOptions.enableAI || formattedSegments) {
          if (formattedSegments && latestRequestIdRef.current === requestId) {
            setAiProgress(100)
          }
          return
        }

        // Kick off AI enhancement.
        if (latestRequestIdRef.current === requestId) {
          setAiEnhancing(true)
          startProgressInterval()
        }

        try {
          const aiResponse = await fetch(`/api/youtube/extract?videoId=${videoId}&phase=enhance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: normalizedUrl,
              enhanceOnly: true,
              rawTranscript: rawSegments.map(segment => ({
                text: segment.text,
                startTime: segment.startTime,
                endTime: segment.endTime,
              })),
              maxSegmentLength: normalizedOptions.maxSegmentLength,
              addFurigana: normalizedOptions.addFurigana,
              includeTranslations: normalizedOptions.includeTranslations,
            }),
            signal: controller.signal,
          })

          if (!aiResponse.ok) {
            const payload = await safeParseJson(aiResponse)
            throw new Error(payload?.message || 'AI enhancement failed')
          }

          const aiData = await aiResponse.json()

          if (!aiData?.success || !Array.isArray(aiData.formattedTranscript)) {
            throw new Error(aiData?.message || 'AI enhancement returned invalid response')
          }

          const enhancedSegments = mapToSegments(aiData.formattedTranscript)
          const enhancedState = createTranscriptState(
            enhancedSegments,
            'ai-enhanced',
            data.videoTitle,
            {
              ...initialState.metadata,
              aiMethod: aiData.method,
              aiUsage: aiData.usage,
            }
          )

          if (latestRequestIdRef.current === requestId) {
            setTranscript(enhancedState)
            setAiProgress(100)
            setAiEnhancing(false)
            resetProgressInterval()
            showToast('Transcript enhanced with AI magic ✨', 'success')
          }
        } catch (aiError: any) {
          if (controller.signal.aborted) return

          console.warn('[ProgressiveTranscript] AI enhancement failed:', aiError)
          if (latestRequestIdRef.current === requestId) {
            setAiEnhancing(false)
            resetProgressInterval()
            setAiProgress(0)
            showToast('AI enhancement failed. Continuing with raw transcript.', 'warning')
          }
        }
      } catch (fetchError: any) {
        if (controller.signal.aborted) return

        console.error('[ProgressiveTranscript] Error loading transcript:', fetchError)
        if (latestRequestIdRef.current === requestId) {
          setError(fetchError.message || 'Failed to load transcript')
          setLoading(false)
          setAiEnhancing(false)
          setAiProgress(0)
        }
      } finally {
        if (latestRequestIdRef.current === requestId) {
          resetProgressInterval()
        }
      }
    }

    fetchRawTranscript()

    return () => {
      controller.abort()
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
    }
  }, [url, reloadFlag, normalizedOptions])

  const refetch = useCallback(() => {
    setReloadFlag(flag => flag + 1)
  }, [])

  return {
    transcript,
    loading,
    error,
    aiEnhancing,
    aiProgress,
    refetch,
  }
}

async function safeParseJson(response: Response): Promise<any | null> {
  try {
    return await response.json()
  } catch (parseError) {
    return null
  }
}
