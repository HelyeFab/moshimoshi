'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type PerfMetrics = {
  fps: number
  longTaskMs: number
  longTaskCount: number
  longTaskPct: number
  eventLoopLagMs: number
  jsHeapUsedMB: number | null
  jsHeapTotalMB: number | null
  visibility: string
  animationsPaused: boolean
}

const STORAGE_KEY = 'debugPerfPanel'

function getMemorySnapshot() {
  const memory = (performance as any).memory as
    | { usedJSHeapSize: number; totalJSHeapSize: number }
    | undefined

  if (!memory) {
    return { jsHeapUsedMB: null, jsHeapTotalMB: null }
  }

  const jsHeapUsedMB = Math.round((memory.usedJSHeapSize / 1024 / 1024) * 10) / 10
  const jsHeapTotalMB = Math.round((memory.totalJSHeapSize / 1024 / 1024) * 10) / 10

  return { jsHeapUsedMB, jsHeapTotalMB }
}

export default function PerfDebugPanel() {
  const searchParams = useSearchParams()
  const [enabled, setEnabled] = useState(false)
  const [metrics, setMetrics] = useState<PerfMetrics>(() => ({
    fps: 0,
    longTaskMs: 0,
    longTaskCount: 0,
    longTaskPct: 0,
    eventLoopLagMs: 0,
    jsHeapUsedMB: null,
    jsHeapTotalMB: null,
    visibility: typeof document !== 'undefined' ? document.visibilityState : 'unknown',
    animationsPaused: false,
  }))

  const isEnabledFromUrl = useMemo(() => {
    const value = searchParams?.get('debugPerf')
    return value === '1' ? true : value === '0' ? false : null
  }, [searchParams])

  useEffect(() => {
    if (isEnabledFromUrl === true) {
      localStorage.setItem(STORAGE_KEY, '1')
      setEnabled(true)
      return
    }
    if (isEnabledFromUrl === false) {
      localStorage.removeItem(STORAGE_KEY)
      setEnabled(false)
      return
    }
    setEnabled(localStorage.getItem(STORAGE_KEY) === '1')
  }, [isEnabledFromUrl])

  useEffect(() => {
    if (!enabled) {
      return
    }

    let rafId = 0
    let lastFpsSample = performance.now()
    let frameCount = 0
    let lastLagSample = performance.now()
    let lagAccumulator = 0
    let lagSamples = 0
    let longTaskMs = 0
    let longTaskCount = 0

    const longTaskObserver =
      typeof PerformanceObserver !== 'undefined' && (PerformanceObserver as any).supportedEntryTypes
        ? (PerformanceObserver as any).supportedEntryTypes.includes('longtask')
        : false

    let observer: PerformanceObserver | null = null

    if (longTaskObserver) {
      observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          longTaskMs += entry.duration
          longTaskCount += 1
        }
      })
      observer.observe({ entryTypes: ['longtask'] })
    }

    const lagTimer = window.setInterval(() => {
      const now = performance.now()
      const expected = lastLagSample + 1000
      const lag = Math.max(0, now - expected)
      lastLagSample = now
      lagAccumulator += lag
      lagSamples += 1
    }, 1000)

    const updateTimer = window.setInterval(() => {
      const now = performance.now()
      const deltaMs = Math.max(1, now - lastFpsSample)
      const fps = Math.round((frameCount / deltaMs) * 1000)
      const longTaskPct = Math.min(100, Math.round((longTaskMs / deltaMs) * 100))
      const eventLoopLagMs = lagSamples ? Math.round(lagAccumulator / lagSamples) : 0
      const memorySnapshot = getMemorySnapshot()

      const animationsPaused = document.documentElement.classList.contains('reduce-motion')

      setMetrics(prev => ({
        ...prev,
        fps,
        longTaskMs: Math.round(longTaskMs),
        longTaskCount,
        longTaskPct,
        eventLoopLagMs,
        ...memorySnapshot,
        visibility: document.visibilityState,
        animationsPaused,
      }))

      lastFpsSample = now
      frameCount = 0
      longTaskMs = 0
      longTaskCount = 0
      lagAccumulator = 0
      lagSamples = 0
    }, 1000)

    const tick = () => {
      frameCount += 1
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    const visibilityHandler = () => {
      setMetrics(prev => ({
        ...prev,
        visibility: document.visibilityState,
      }))
    }
    document.addEventListener('visibilitychange', visibilityHandler)

    return () => {
      if (observer) {
        observer.disconnect()
      }
      window.clearInterval(lagTimer)
      window.clearInterval(updateTimer)
      cancelAnimationFrame(rafId)
      document.removeEventListener('visibilitychange', visibilityHandler)
    }
  }, [enabled])

  if (!enabled) {
    return null
  }

  return (
    <div
      className="fixed bottom-4 left-4 z-[9999] rounded-xl border border-black/20 bg-black/80 text-white shadow-xl backdrop-blur-md"
      style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <div className="text-xs font-semibold tracking-wide">Perf Debug</div>
        <button
          className="text-[10px] px-2 py-1 rounded-md bg-white/10 hover:bg-white/20"
          onClick={() => {
            localStorage.removeItem(STORAGE_KEY)
            setEnabled(false)
          }}
        >
          Hide
        </button>
      </div>
      <div className="px-3 py-2 text-[11px] space-y-1">
        <div>FPS: {metrics.fps}</div>
        <div>
          Long tasks: {metrics.longTaskMs}ms ({metrics.longTaskPct}%) · {metrics.longTaskCount}
        </div>
        <div>Event loop lag: {metrics.eventLoopLagMs}ms</div>
        <div>
          JS heap: {metrics.jsHeapUsedMB ?? 'n/a'} / {metrics.jsHeapTotalMB ?? 'n/a'} MB
        </div>
        <div>Visibility: {metrics.visibility}</div>
        <div>Animations paused: {metrics.animationsPaused ? 'yes' : 'no'}</div>
      </div>
    </div>
  )
}
