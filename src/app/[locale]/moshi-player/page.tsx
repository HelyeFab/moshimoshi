'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import PageContainer from '@/components/ui/PageContainer'
import PageHeader from '@/components/ui/PageHeader'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/button'
import { Play, Link2, AlertCircle, Loader2, FileText } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type PlayerState = 'idle' | 'loading' | 'ready' | 'error'

interface PlayerError {
  message: string
  code?: string
}

/** Minimal type for the YT player instance we hold in a ref. */
interface YTPlayerInstance {
  destroy: () => void
}

/** Shape of a single transcript segment from the API. */
interface TranscriptSegment {
  start: number
  end: number
  duration: number
  text: string
}

/** Subset of the transcript API response we consume. */
interface TranscriptResponse {
  available: boolean
  videoId: string
  title?: string
  segments?: TranscriptSegment[]
  language?: string
  totalSegments?: number
  error?: string
  message?: string
}

type TranscriptState = 'idle' | 'loading' | 'loaded' | 'unavailable' | 'error'

// ─── YouTube helpers (standalone — no old imports) ───────────────────────────

/** Extract a YouTube video ID from various URL formats. */
function extractVideoId(input: string): string | null {
  const trimmed = input.trim()

  // Already a bare 11-char video ID
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed

  try {
    const url = new URL(trimmed)
    // youtu.be/<id>
    if (url.hostname === 'youtu.be') {
      const id = url.pathname.slice(1).split('/')[0]
      return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
    }
    // youtube.com/watch?v=<id>  |  youtube.com/embed/<id>  |  youtube.com/v/<id>
    if (url.hostname.includes('youtube.com') || url.hostname.includes('youtube-nocookie.com')) {
      const v = url.searchParams.get('v')
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v

      const segments = url.pathname.split('/')
      const embedIdx = segments.indexOf('embed')
      const vIdx = segments.indexOf('v')
      const shortsIdx = segments.indexOf('shorts')
      const idx = Math.max(embedIdx, vIdx, shortsIdx)
      if (idx !== -1 && segments[idx + 1]) {
        const id = segments[idx + 1]
        if (/^[A-Za-z0-9_-]{11}$/.test(id)) return id
      }
    }
  } catch {
    // not a valid URL
  }

  return null
}

// ─── YouTube IFrame Player API loader ────────────────────────────────────────

let ytApiReady: Promise<void> | null = null

function loadYouTubeIframeApi(): Promise<void> {
  if (ytApiReady) return ytApiReady

  ytApiReady = new Promise<void>((resolve) => {
    const win = window as Window & { YT?: { Player: unknown }; onYouTubeIframeAPIReady?: () => void }

    // If the API is already loaded
    if (typeof window !== 'undefined' && win.YT?.Player) {
      resolve()
      return
    }

    // Set up the callback
    const prev = win.onYouTubeIframeAPIReady
    win.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve()
    }

    // Inject the script if not already present
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    }
  })

  return ytApiReady
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MoshiPlayerPage() {
  const [urlInput, setUrlInput] = useState('')
  const [videoId, setVideoId] = useState<string | null>(null)
  const [playerState, setPlayerState] = useState<PlayerState>('idle')
  const [error, setError] = useState<PlayerError | null>(null)

  const [transcriptState, setTranscriptState] = useState<TranscriptState>('idle')
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([])
  const [transcriptTitle, setTranscriptTitle] = useState<string | null>(null)
  const [transcriptError, setTranscriptError] = useState<string | null>(null)

  const playerContainerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayerInstance | null>(null)
  const transcriptPanelRef = useRef<HTMLDivElement>(null)

  // ─── Load video ──────────────────────────────────────────────────────────

  const handleLoadVideo = useCallback(() => {
    const id = extractVideoId(urlInput)
    if (!id) {
      setError({ message: 'Invalid YouTube URL. Please paste a valid link.', code: 'INVALID_URL' })
      setPlayerState('error')
      return
    }

    setVideoId(id)
    setError(null)
    setPlayerState('loading')
  }, [urlInput])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleLoadVideo()
      }
    },
    [handleLoadVideo],
  )

  // ─── Initialize YT player when videoId changes ──────────────────────────

  useEffect(() => {
    if (!videoId) return

    let cancelled = false

    async function init() {
      await loadYouTubeIframeApi()
      if (cancelled) return

      // Destroy previous player instance
      if (playerRef.current) {
        try {
          playerRef.current.destroy()
        } catch {
          // ignore
        }
        playerRef.current = null
      }

      if (!playerContainerRef.current) return

      // Clear and create a fresh target div
      playerContainerRef.current.innerHTML = ''
      const target = document.createElement('div')
      target.id = 'moshi-yt-player'
      playerContainerRef.current.appendChild(target)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const YT = (window as any).YT
      playerRef.current = new YT.Player('moshi-yt-player', {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            if (!cancelled) setPlayerState('ready')
          },
          onError: (event: { data: number }) => {
            if (cancelled) return
            const code = event?.data
            let message = 'Failed to load video.'
            if (code === 2) message = 'Invalid video ID.'
            if (code === 5) message = 'HTML5 player error.'
            if (code === 100) message = 'Video not found or removed.'
            if (code === 101 || code === 150) message = 'Video owner does not allow embedding.'
            setError({ message, code: String(code) })
            setPlayerState('error')
          },
        },
      })
    }

    init()

    return () => {
      cancelled = true
    }
  }, [videoId])

  // ─── Cleanup on unmount ──────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy()
        } catch {
          // ignore
        }
        playerRef.current = null
      }
    }
  }, [])

  // ─── Fetch transcript (fully decoupled from player) ─────────────────────

  useEffect(() => {
    if (!videoId) {
      setTranscriptState('idle')
      setTranscriptSegments([])
      setTranscriptTitle(null)
      setTranscriptError(null)
      return
    }

    let cancelled = false
    const controller = new AbortController()

    async function fetchTranscript() {
      setTranscriptState('loading')
      setTranscriptSegments([])
      setTranscriptTitle(null)
      setTranscriptError(null)

      try {
        const res = await fetch(`/api/moshi-player/transcript/${videoId}`, {
          signal: controller.signal,
          cache: 'no-cache',
        })

        if (cancelled) return

        if (!res.ok) {
          setTranscriptError(`Server error (${res.status})`)
          setTranscriptState('error')
          return
        }

        const data: TranscriptResponse = await res.json()

        if (cancelled) return

        if (!data.available || !data.segments?.length) {
          setTranscriptError(data.message || data.error || 'No transcript available for this video')
          setTranscriptState('unavailable')
          return
        }

        setTranscriptSegments(data.segments)
        setTranscriptTitle(data.title ?? null)
        setTranscriptState('loaded')
      } catch (err) {
        if (cancelled) return
        if ((err as Error).name === 'AbortError') return
        setTranscriptError('Failed to fetch transcript')
        setTranscriptState('error')
      }
    }

    fetchTranscript()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [videoId])

  // ─── Helper: format seconds as mm:ss ───────────────────────────────────

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <PageContainer gradient="mizu" showPattern={false}>
      <PageHeader
        title="Moshi Player"
        description="Paste a YouTube link to watch with transcript"
        minimal
        backHref="/dashboard"
        showFeatureReminderToggle={false}
      />

      <div className="container mx-auto px-4 pb-8 max-w-6xl">
        {/* ── URL Input ─────────────────────────────────────────────── */}
        <div className="flex gap-2 mb-6">
          <div className="flex-1">
            <Input
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value)
                if (error) setError(null)
              }}
              onKeyDown={handleKeyDown}
              placeholder="https://www.youtube.com/watch?v=..."
              icon={<Link2 className="w-4 h-4" />}
              inputSize="lg"
              error={playerState === 'error' ? error?.message : undefined}
            />
          </div>
          <Button
            onClick={handleLoadVideo}
            disabled={!urlInput.trim() || playerState === 'loading'}
            size="lg"
            className="flex-shrink-0"
          >
            {playerState === 'loading' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Play className="w-5 h-5" />
            )}
          </Button>
        </div>

        {/* ── Main layout: Player + Transcript panel ────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Player area */}
          <div className="lg:col-span-2">
            <div className="relative w-full rounded-xl overflow-hidden bg-black shadow-lg aspect-video">
              {/* Idle state */}
              {playerState === 'idle' && !videoId && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-3">
                  <Play className="w-16 h-16 opacity-40" />
                  <p className="text-sm">Paste a YouTube URL above to get started</p>
                </div>
              )}

              {/* Loading spinner */}
              {playerState === 'loading' && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/60">
                  <Loader2 className="w-10 h-10 text-white animate-spin" />
                </div>
              )}

              {/* Error overlay */}
              {playerState === 'error' && videoId && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/80 text-white gap-3 px-4 text-center">
                  <AlertCircle className="w-12 h-12 text-red-400" />
                  <p>{error?.message || 'Something went wrong.'}</p>
                </div>
              )}

              {/* YouTube player mount point */}
              <div
                ref={playerContainerRef}
                className="absolute inset-0 w-full h-full"
              />
            </div>
          </div>

          {/* Transcript panel */}
          <div className="lg:col-span-1">
            <div className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm shadow-sm h-full min-h-[300px] lg:min-h-0 flex flex-col">
              {/* Panel header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-dark-700">
                <FileText className="w-4 h-4 text-gray-500 dark:text-dark-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-dark-300 truncate">
                  {transcriptTitle || 'Transcript'}
                </span>
                {transcriptState === 'loaded' && (
                  <span className="ml-auto text-xs text-gray-400 dark:text-dark-500">
                    {transcriptSegments.length} segments
                  </span>
                )}
                {transcriptState === 'loading' && (
                  <Loader2 className="ml-auto w-3.5 h-3.5 text-gray-400 animate-spin" />
                )}
              </div>

              {/* Panel body */}
              <div
                ref={transcriptPanelRef}
                className="flex-1 overflow-y-auto"
                style={{ maxHeight: 'calc(56.25vw * 0.66)' }}
              >
                {/* Idle — no video loaded */}
                {transcriptState === 'idle' && (
                  <div className="flex items-center justify-center h-full p-4">
                    <p className="text-sm text-gray-400 dark:text-dark-500 text-center">
                      Load a video to see the transcript
                    </p>
                  </div>
                )}

                {/* Loading */}
                {transcriptState === 'loading' && (
                  <div className="flex flex-col items-center justify-center h-full p-4 gap-2">
                    <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                    <p className="text-sm text-gray-400 dark:text-dark-500">
                      Fetching transcript…
                    </p>
                  </div>
                )}

                {/* Unavailable */}
                {transcriptState === 'unavailable' && (
                  <div className="flex flex-col items-center justify-center h-full p-4 gap-2 text-center">
                    <AlertCircle className="w-6 h-6 text-amber-400" />
                    <p className="text-sm text-gray-500 dark:text-dark-400">
                      {transcriptError || 'No transcript available'}
                    </p>
                  </div>
                )}

                {/* Error */}
                {transcriptState === 'error' && (
                  <div className="flex flex-col items-center justify-center h-full p-4 gap-2 text-center">
                    <AlertCircle className="w-6 h-6 text-red-400" />
                    <p className="text-sm text-red-500 dark:text-red-400">
                      {transcriptError || 'Failed to load transcript'}
                    </p>
                  </div>
                )}

                {/* Loaded — render segments */}
                {transcriptState === 'loaded' && (
                  <div className="divide-y divide-gray-100 dark:divide-dark-700">
                    {transcriptSegments.map((seg, i) => (
                      <div
                        key={i}
                        className="px-4 py-2 hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors"
                      >
                        <span className="text-xs text-gray-400 dark:text-dark-500 font-mono mr-2 select-none">
                          {formatTime(seg.start)}
                        </span>
                        <span className="text-sm text-gray-800 dark:text-dark-200 leading-relaxed">
                          {seg.text}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
