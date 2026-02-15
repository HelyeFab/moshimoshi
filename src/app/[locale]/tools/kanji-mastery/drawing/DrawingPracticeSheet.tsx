'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useI18n } from '@/i18n/I18nContext'
import { ArrowLeft } from 'lucide-react'
import { kanjiService } from '@/services/kanjiService'
import SimpleDrawingCanvas from '@/components/drawing-practice/SimpleDrawingCanvas'
import StrokeBuildup from '@/components/drawing-practice/StrokeBuildup'
import type { Kanji } from '@/types/kanji'

interface DrawingPracticeSheetProps {
  kanji: Kanji
  onBack: () => void
}

const TOTAL_CELLS = 12

export default function DrawingPracticeSheet({ kanji, onBack }: DrawingPracticeSheetProps) {
  const { t } = useI18n()
  const [svgData, setSvgData] = useState<string | null>(null)
  const [loadingSvg, setLoadingSvg] = useState(true)
  const gridRef = useRef<HTMLDivElement>(null)
  const [cellSize, setCellSize] = useState(120)

  const updateCellSize = useCallback(() => {
    if (!gridRef.current) return
    const width = gridRef.current.offsetWidth
    const cols = window.innerWidth >= 1024 ? 6 : 3
    const gap = 12 // Tailwind gap-3
    const available = Math.floor((width - (cols - 1) * gap) / cols)
    // Subtract padding for border (4px) and breathing room (8px)
    setCellSize(Math.min(120, available - 12))
  }, [])

  useEffect(() => {
    updateCellSize()
    window.addEventListener('resize', updateCellSize)
    return () => window.removeEventListener('resize', updateCellSize)
  }, [updateCellSize])

  useEffect(() => {
    let cancelled = false
    setLoadingSvg(true)

    kanjiService.getStrokeOrderSVG(kanji.kanji).then(svg => {
      if (!cancelled) {
        setSvgData(svg)
        setLoadingSvg(false)
      }
    }).catch(() => {
      if (!cancelled) setLoadingSvg(false)
    })

    return () => { cancelled = true }
  }, [kanji.kanji])

  return (
    <div className="space-y-6" role="main" aria-label={`${t('kanjiMasteryTool.drawingApproach.practiceSheetTitle')} — ${kanji.kanji} (${kanji.meaning})`}>
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 rounded"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        {t('kanjiMasteryTool.drawingApproach.backToSelection')}
      </button>

      {/* Kanji info card */}
      <section className="bg-white dark:bg-dark-800 rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-6" aria-label={`${kanji.kanji} — ${kanji.meaning}`}>
        <div className="flex items-start gap-6">
          {/* Large kanji character */}
          <div className="flex-shrink-0 w-28 h-28 bg-gray-50 dark:bg-dark-700 rounded-xl flex items-center justify-center border border-gray-200 dark:border-dark-600" aria-hidden="true">
            <span className="text-7xl font-serif text-gray-900 dark:text-gray-100">{kanji.kanji}</span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {kanji.meaning}
            </h2>
            <div className="space-y-1 text-sm">
              {kanji.onyomi.length > 0 && (
                <p className="text-gray-600 dark:text-gray-400">
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {t('kanjiMasteryTool.drawingApproach.onyomi')}:
                  </span>{' '}
                  {kanji.onyomi.join(', ')}
                </p>
              )}
              {kanji.kunyomi.length > 0 && (
                <p className="text-gray-600 dark:text-gray-400">
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {t('kanjiMasteryTool.drawingApproach.kunyomi')}:
                  </span>{' '}
                  {kanji.kunyomi.join(', ')}
                </p>
              )}
              <p className="text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {t('kanjiMasteryTool.drawingApproach.strokes')}:
                </span>{' '}
                {kanji.strokeCount}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stroke buildup */}
      {loadingSvg ? (
        <div className="text-sm text-gray-500 dark:text-gray-400" role="status">
          {t('kanjiMasteryTool.drawingApproach.loadingSvg')}
        </div>
      ) : svgData ? (
        <StrokeBuildup svgData={svgData} totalStrokes={kanji.strokeCount} />
      ) : (
        <div className="text-sm text-gray-400 dark:text-gray-500 italic">
          {t('kanjiMasteryTool.drawingApproach.unavailable')}
        </div>
      )}

      {/* Practice grid: 12 drawing cells each followed by a reading cell */}
      <section aria-label={`${t('kanjiMasteryTool.drawingApproach.practiceSheetTitle')} — ${TOTAL_CELLS} ${t('kanjiMasteryTool.drawingApproach.drawingCell')}`}>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          {t('kanjiMasteryTool.drawingApproach.practiceSheetTitle')} — {TOTAL_CELLS} {t('kanjiMasteryTool.drawingApproach.drawingCell')}
        </h3>

        <div ref={gridRef} className="grid grid-cols-3 lg:grid-cols-6 gap-3" role="list">
          {Array.from({ length: TOTAL_CELLS }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5" role="listitem">
              {/* Cell label */}
              <span className="text-[10px] text-gray-400 dark:text-gray-500" aria-hidden="true">
                {i + 1}/{TOTAL_CELLS}
              </span>

              {/* Drawing canvas - shows readings after drawing */}
              <SimpleDrawingCanvas
                width={cellSize}
                height={cellSize}
                ghostSVG={svgData ?? undefined}
                showGhost={i === 0}
                onyomi={kanji.onyomi}
                kunyomi={kanji.kunyomi}
                expectedStrokes={kanji.strokeCount}
                cellIndex={i}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
