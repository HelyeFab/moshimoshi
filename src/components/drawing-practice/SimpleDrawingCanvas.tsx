'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import DOMPurify from 'isomorphic-dompurify'
import { useI18n } from '@/i18n/I18nContext'

interface Point {
  x: number
  y: number
}

interface Stroke {
  points: Point[]
}

interface SimpleDrawingCanvasProps {
  width?: number
  height?: number
  ghostSVG?: string
  showGhost?: boolean
  strokeColor?: string
  strokeWidth?: number
  className?: string
  onyomi?: string[]
  kunyomi?: string[]
  expectedStrokes?: number
  cellIndex?: number
}

export default function SimpleDrawingCanvas({
  width = 200,
  height = 200,
  ghostSVG,
  showGhost = false,
  strokeColor = '#000000',
  strokeWidth = 3,
  className = '',
  onyomi,
  kunyomi,
  expectedStrokes,
  cellIndex,
}: SimpleDrawingCanvasProps) {
  const { t } = useI18n()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentStroke, setCurrentStroke] = useState<Point[]>([])
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null)
  const [showReadings, setShowReadings] = useState(false)

  const hasReadings = (onyomi && onyomi.length > 0) || (kunyomi && kunyomi.length > 0)
  const allStrokesDrawn = expectedStrokes ? strokes.length >= expectedStrokes : false

  // Show readings once all expected strokes are drawn and user stops
  useEffect(() => {
    if (allStrokesDrawn && !isDrawing && hasReadings) {
      const timer = setTimeout(() => setShowReadings(true), 300)
      return () => clearTimeout(timer)
    }
    setShowReadings(false)
  }, [allStrokesDrawn, isDrawing, hasReadings])

  // Initialize canvas context
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = strokeWidth

    setContext(ctx)
    ctx.clearRect(0, 0, width, height)
  }, [width, height, strokeColor, strokeWidth])

  const getCoordinates = useCallback((e: MouseEvent | TouchEvent): Point | null => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    let clientX: number, clientY: number

    if ('touches' in e) {
      if (e.touches.length === 0) return null
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    }
  }, [])

  const startDrawing = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault()
    if (showReadings) return // Block drawing when readings overlay is shown
    const point = getCoordinates(e)
    if (!point || !context) return

    setIsDrawing(true)
    setCurrentStroke([point])

    context.beginPath()
    context.moveTo(point.x, point.y)
  }, [context, getCoordinates, showReadings])

  const draw = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault()
    if (!isDrawing || !context) return

    const point = getCoordinates(e)
    if (!point) return

    setCurrentStroke(prev => [...prev, point])

    context.lineTo(point.x, point.y)
    context.stroke()
  }, [isDrawing, context, getCoordinates])

  const stopDrawing = useCallback((e?: MouseEvent | TouchEvent) => {
    if (e) e.preventDefault()
    if (!isDrawing) return

    setIsDrawing(false)

    if (currentStroke.length > 1) {
      setStrokes(prev => [...prev, { points: currentStroke }])
    }

    setCurrentStroke([])
  }, [isDrawing, currentStroke])

  const clearCanvas = useCallback(() => {
    if (!context) return
    context.clearRect(0, 0, width, height)
    setStrokes([])
    setCurrentStroke([])
    setShowReadings(false)
  }, [context, width, height])

  const undoLastStroke = useCallback(() => {
    if (strokes.length === 0 || !context) return

    const newStrokes = strokes.slice(0, -1)
    setStrokes(newStrokes)
    setShowReadings(false)

    context.clearRect(0, 0, width, height)

    newStrokes.forEach(stroke => {
      if (stroke.points.length < 2) return
      context.beginPath()
      context.moveTo(stroke.points[0].x, stroke.points[0].y)
      stroke.points.slice(1).forEach(point => {
        context.lineTo(point.x, point.y)
      })
      context.stroke()
    })
  }, [strokes, context, width, height])

  // Keyboard shortcuts when canvas container is focused
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault()
      undoLastStroke()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      clearCanvas()
    }
  }, [undoLastStroke, clearCanvas])

  // Add event listeners
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleMouseDown = (e: MouseEvent) => startDrawing(e)
    const handleMouseMove = (e: MouseEvent) => draw(e)
    const handleMouseUp = (e: MouseEvent) => stopDrawing(e)
    const handleMouseOut = (e: MouseEvent) => stopDrawing(e)

    const handleTouchStart = (e: TouchEvent) => startDrawing(e)
    const handleTouchMove = (e: TouchEvent) => draw(e)
    const handleTouchEnd = (e: TouchEvent) => stopDrawing(e)
    const handleTouchCancel = (e: TouchEvent) => stopDrawing(e)

    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('mouseout', handleMouseOut)

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false })
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false })
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false })
    canvas.addEventListener('touchcancel', handleTouchCancel, { passive: false })

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('mouseout', handleMouseOut)

      canvas.removeEventListener('touchstart', handleTouchStart)
      canvas.removeEventListener('touchmove', handleTouchMove)
      canvas.removeEventListener('touchend', handleTouchEnd)
      canvas.removeEventListener('touchcancel', handleTouchCancel)
    }
  }, [startDrawing, draw, stopDrawing])

  const canvasLabel = cellIndex != null
    ? `${t('kanjiMasteryTool.drawingApproach.drawHere')} - ${t('kanjiMasteryTool.drawingApproach.cell')} ${cellIndex + 1}`
    : t('kanjiMasteryTool.drawingApproach.drawHere')

  const strokeStatus = expectedStrokes
    ? `${strokes.length} ${t('kanjiMasteryTool.drawingApproach.of')} ${expectedStrokes} ${t('kanjiMasteryTool.drawingApproach.strokes').toLowerCase()}`
    : `${strokes.length} ${t('kanjiMasteryTool.drawingApproach.strokes').toLowerCase()}`

  return (
    <div
      ref={containerRef}
      className={`flex flex-col items-center gap-2 ${className}`}
      onKeyDown={handleKeyDown}
      role="group"
      aria-label={canvasLabel}
    >
      <div className="relative bg-white dark:bg-dark-900 rounded-lg border-2 border-gray-200 dark:border-dark-700 focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-1">
        {/* Ghost character overlay */}
        {showGhost && ghostSVG && !showReadings && (
          <svg
            viewBox="0 0 109 109"
            width={width}
            height={height}
            className="absolute inset-0 opacity-15 pointer-events-none"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(ghostSVG.replace(/<svg[^>]*>|<\/svg>/g, ''), { USE_PROFILES: { svg: true, svgFilters: true } }) }}
          />
        )}

        {/* Drawing canvas */}
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="cursor-crosshair touch-none"
          role="img"
          aria-label={canvasLabel}
          tabIndex={0}
        />

        {/* Crosshair grid overlay */}
        {!showReadings && (
          <svg
            className="absolute inset-0 pointer-events-none opacity-10"
            width={width}
            height={height}
            aria-hidden="true"
          >
            <line x1={width / 2} y1={0} x2={width / 2} y2={height} stroke="currentColor" />
            <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="currentColor" />
            <line x1={0} y1={0} x2={width} y2={height} stroke="currentColor" strokeDasharray="5,5" />
            <line x1={width} y1={0} x2={0} y2={height} stroke="currentColor" strokeDasharray="5,5" />
          </svg>
        )}

        {/* Stroke counter badge */}
        {!showReadings && (
          <div
            className="absolute top-1 right-1 bg-primary-500 text-white text-[10px] px-1.5 py-0.5 rounded-full"
            aria-hidden="true"
          >
            {strokes.length}
          </div>
        )}

        {/* Accessible stroke count for screen readers */}
        <span className="sr-only" aria-live="polite">{strokeStatus}</span>

        {/* Readings overlay - shown after drawing */}
        {showReadings && (
          <div
            className="absolute inset-0 flex flex-col items-center bg-amber-50/95 dark:bg-amber-900/80 rounded-md overflow-y-auto px-2 pt-2 pb-1 gap-1 scrollbar-none"
            style={{ scrollbarWidth: 'none' }}
            role="status"
            aria-live="polite"
            aria-label={t('kanjiMasteryTool.drawingApproach.readingCell')}
          >
            {onyomi && onyomi.length > 0 && (
              <div className="text-center w-full">
                <span className="text-[10px] uppercase font-semibold text-amber-600/80 dark:text-amber-400/80 leading-none">
                  {t('kanjiMasteryTool.drawingApproach.onyomi')}
                </span>
                {onyomi.map((r, i) => (
                  <p key={i} className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-snug">
                    {r}
                  </p>
                ))}
              </div>
            )}
            {kunyomi && kunyomi.length > 0 && (
              <div className="text-center w-full">
                <span className="text-[10px] uppercase font-semibold text-amber-600/80 dark:text-amber-400/80 leading-none">
                  {t('kanjiMasteryTool.drawingApproach.kunyomi')}
                </span>
                {kunyomi.map((r, i) => (
                  <p key={i} className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-snug">
                    {r}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Control buttons */}
      <div className="flex gap-1.5" role="toolbar" aria-label={t('kanjiMasteryTool.drawingApproach.drawHere')}>
        <button
          onClick={clearCanvas}
          aria-label={`${t('kanjiMasteryTool.drawingApproach.clear')} (Esc)`}
          className="px-2.5 py-1 text-xs bg-gray-200 dark:bg-dark-700 hover:bg-gray-300 dark:hover:bg-dark-600 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1"
        >
          {t('kanjiMasteryTool.drawingApproach.clear')}
        </button>
        <button
          onClick={undoLastStroke}
          disabled={strokes.length === 0 || showReadings}
          aria-label={`${t('kanjiMasteryTool.drawingApproach.undo')} (Ctrl+Z)`}
          className="px-2.5 py-1 text-xs bg-gray-200 dark:bg-dark-700 hover:bg-gray-300 dark:hover:bg-dark-600 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1"
        >
          {t('kanjiMasteryTool.drawingApproach.undo')}
        </button>
      </div>
    </div>
  )
}
